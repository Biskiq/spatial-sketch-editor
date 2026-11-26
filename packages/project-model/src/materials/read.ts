/**
 * Strict readers for the material wire grammar.
 *
 * The reader never throws, never clamps and never coerces:
 *
 * - unknown keys, wrong role selectors and unsupported profiles are recorded
 *   rather than ignored;
 * - a non-finite or out-of-domain dimension is refused; only authored angles
 *   and offsets are wrapped (modulo a full turn or one tile), because wrapping
 *   is a valid way to spell the same authored intent;
 * - `null` is a map binding's explicit disable, never an absent factor.
 *
 * Every successful value is deeply frozen: a definition's bytes and its
 * identity cannot diverge after admission.
 */
import { dedupeMaterialIssues, sortMaterialIssues, type MaterialIssue } from './issues';
import { deepFreeze } from './immutable';
import {
	MATERIAL_MAP_ROLES,
	MATERIAL_PROFILE,
	SCALAR_COMPONENTS,
	type Colour,
	type Finish,
	type FinishBase,
	type FinishColor,
	type FinishOverrides,
	type Hash,
	type LocalImage,
	type Mapping,
	type MapRole,
	type Maps,
	type MaterialProfile,
	type Metric,
	type Normal,
	type NormalConvention,
	type OverrideMaps,
	type Recipe,
	type Scalar,
	type ScalarComponent,
	type UvMapping,
} from './types';

const RECIPE_KEYS = [
	'profile',
	'color',
	'roughness',
	'metalness',
	'occlusionStrength',
	'normalScale',
	'mapping',
	'maps',
] as const;

const OVERRIDE_KEYS = [
	'color',
	'roughness',
	'metalness',
	'occlusionStrength',
	'normalScale',
	'mapping',
	'maps',
] as const;

const FINISH_KEYS = ['id', 'name', 'base', 'overrides'] as const;
const METRIC_KEYS = ['tileMeters', 'rotation', 'offset'] as const;
const UV_KEYS = ['kind', 'set', 'repeat', 'rotation', 'offset'] as const;
const ROLE_SELECTORS = ['convention', 'component', 'invert'] as const;

const COLOR_LITERAL = /^#[0-9a-f]{6}$/;
const HASH_IDENTITY = /^sha256-[0-9a-f]{64}$/;
const TWO_PI = Math.PI * 2;
const NORMAL_SCALE_MAX = 10;
const TILE_MIN_METERS = 0.01;
const TILE_MAX_METERS = 100;
const UV_REPEAT_MIN = 1 / 1024;
const UV_REPEAT_MAX = 1024;

export type RecipeReadResult =
	| { readonly success: true; readonly recipe: Recipe }
	| { readonly success: false; readonly issues: readonly MaterialIssue[] };

export type OverridesReadResult =
	| { readonly success: true; readonly overrides: FinishOverrides }
	| { readonly success: false; readonly issues: readonly MaterialIssue[] };

export type FinishReadResult =
	| { readonly success: true; readonly finish: Finish }
	| { readonly success: false; readonly issues: readonly MaterialIssue[] };

/** Whether a value is a lowercase `sha256-<64 hex>` identity. */
export function isHash(value: unknown): value is Hash {
	return typeof value === 'string' && HASH_IDENTITY.test(value);
}

/** Whether a value is an opaque `#rrggbb` colour. */
export function isColourLiteral(value: unknown): value is string {
	return typeof value === 'string' && COLOR_LITERAL.test(value);
}

/** Wrap an authored angle into [0, 2π). `-0` normalizes to `0`. */
export function normalizeRotation(rotation: number): number {
	if (!Number.isFinite(rotation)) return rotation;
	// A value already in range is returned byte-identically: modulo arithmetic
	// would turn 1.2 into 1.2000000000000002 and change the canonical bytes of a
	// re-read recipe for no authored reason.
	if (rotation >= 0 && rotation < TWO_PI) return cleanNumber(rotation);
	const wrapped = ((rotation % TWO_PI) + TWO_PI) % TWO_PI;
	return wrapped === 0 ? 0 : wrapped;
}

/** Wrap an authored offset component into [0, 1). `-0` normalizes to `0`. */
export function normalizeOffset(offset: number): number {
	if (!Number.isFinite(offset)) return offset;
	if (offset >= 0 && offset < 1) return cleanNumber(offset);
	const wrapped = ((offset % 1) + 1) % 1;
	return wrapped === 0 ? 0 : wrapped;
}

function cleanNumber(value: number): number {
	return value === 0 ? 0 : value;
}

class MaterialReader {
	readonly issues: MaterialIssue[] = [];

	constructor(private readonly defaultRole?: MapRole) {}

	problem(
		path: string,
		code: MaterialIssue['code'],
		action?: string,
		role: MapRole | undefined = this.defaultRole,
	): void {
		this.issues.push({
			code,
			path,
			...(role === undefined ? {} : { role }),
			...(action === undefined ? {} : { action }),
		});
	}

	object(input: unknown, path: string): Record<string, unknown> | null {
		if (typeof input !== 'object' || input === null || Array.isArray(input)) {
			this.problem(path, 'invalid-type', 'Use a JSON object.');
			return null;
		}
		return input as Record<string, unknown>;
	}

	keys(
		record: Record<string, unknown>,
		path: string,
		allowed: readonly string[],
		deferRoleSelectors = false,
	): void {
		for (const key of Object.keys(record)) {
			if (allowed.includes(key)) continue;
			// A binding reader reports a selector that belongs to another role as
			// `wrong-role-selector`, not twice as an unknown key.
			if (deferRoleSelectors && (ROLE_SELECTORS as readonly string[]).includes(key)) continue;
			this.problem(`${path}.${key}`, 'unknown-key', 'Remove the unsupported field.');
		}
	}

	required(record: Record<string, unknown>, path: string, key: string): unknown | undefined {
		if (!(key in record) || record[key] === undefined) {
			this.problem(`${path}.${key}`, 'missing-field', `Provide ${key}.`);
			return undefined;
		}
		return record[key];
	}

	string(input: unknown, path: string): string | null {
		if (typeof input !== 'string' || input.trim() === '') {
			this.problem(path, 'invalid-type', 'Use a nonempty string.');
			return null;
		}
		return input;
	}

	opaque(input: unknown, path: string): string | null {
		const value = this.string(input, path);
		if (value !== null && /\s/.test(value)) {
			this.problem(path, 'invalid-value', 'Use a stable id without whitespace.');
			return null;
		}
		return value;
	}

	number(input: unknown, path: string): number | null {
		if (typeof input !== 'number' || !Number.isFinite(input)) {
			this.problem(path, 'invalid-type', 'Use a finite number.');
			return null;
		}
		return cleanNumber(input);
	}

	unit(input: unknown, path: string): number | null {
		const value = this.number(input, path);
		if (value === null) return null;
		if (value < 0 || value > 1) {
			this.problem(path, 'out-of-range', 'Use a value in [0, 1].');
			return null;
		}
		return value;
	}

	normalScale(input: unknown, path: string): number | null {
		const value = this.number(input, path);
		if (value === null) return null;
		if (value <= 0 || value > NORMAL_SCALE_MAX) {
			this.problem(path, 'out-of-range', 'Use a normal scale in (0, 10].');
			return null;
		}
		return value;
	}

	pair(input: unknown, path: string): [number, number] | null {
		if (!Array.isArray(input) || input.length !== 2) {
			this.problem(path, 'invalid-type', 'Use a two-number array.');
			return null;
		}
		const first = this.number(input[0], `${path}[0]`);
		const second = this.number(input[1], `${path}[1]`);
		return first === null || second === null ? null : [first, second];
	}

	hash(input: unknown, path: string, role?: MapRole): Hash | null {
		if (!isHash(input)) {
			this.problem(path, 'invalid-hash', 'Use a lowercase sha256-<64 hex> content digest.', role);
			return null;
		}
		return input;
	}

	colour(input: unknown, path: string): string | null {
		if (!isColourLiteral(input)) {
			this.problem(path, 'invalid-colour', 'Use a lowercase #rrggbb colour.');
			return null;
		}
		return input;
	}

	tag<T extends string>(input: unknown, path: string, allowed: readonly T[]): T | null {
		if (typeof input !== 'string' || !allowed.includes(input as T)) {
			this.problem(path, 'unknown-key', `Use one of ${allowed.join(' | ')}.`);
			return null;
		}
		return input as T;
	}

	boolean(input: unknown, path: string): boolean | null {
		if (typeof input !== 'boolean') {
			this.problem(path, 'invalid-type', 'Use a boolean.');
			return null;
		}
		return input;
	}
}

function resultIssues(reader: MaterialReader): readonly MaterialIssue[] {
	return dedupeMaterialIssues(reader.issues);
}

function readMapping(
	reader: MaterialReader,
	input: unknown,
	path: string,
	role?: MapRole,
): Mapping | null {
	const record = reader.object(input, path);
	if (record === null) return null;
	const kind = record.kind;
	if (kind !== 'target' && kind !== 'surface' && kind !== 'uv') {
		reader.problem(`${path}.kind`, 'unknown-key', 'Use target, surface or uv.', role);
		return null;
	}
	if (kind === 'uv') {
		reader.keys(record, path, UV_KEYS);
		const setValue = reader.required(record, path, 'set');
		const repeatValue = reader.required(record, path, 'repeat');
		const rotationValue = reader.required(record, path, 'rotation');
		const offsetValue = reader.required(record, path, 'offset');
		if (
			setValue === undefined ||
			repeatValue === undefined ||
			rotationValue === undefined ||
			offsetValue === undefined
		) {
			return null;
		}
		if (setValue !== 0 && setValue !== 1) {
			reader.problem(`${path}.set`, 'out-of-range', 'Use UV set 0 or 1.', role);
			return null;
		}
		const repeat = reader.pair(repeatValue, `${path}.repeat`);
		if (repeat === null) return null;
		for (const [index, value] of repeat.entries()) {
			if (value < UV_REPEAT_MIN || value > UV_REPEAT_MAX) {
				reader.problem(
					`${path}.repeat[${index}]`,
					'out-of-range',
					'Use a repeat in [1/1024, 1024].',
					role,
				);
				return null;
			}
		}
		const rotation = reader.number(rotationValue, `${path}.rotation`);
		const offset = reader.pair(offsetValue, `${path}.offset`);
		if (rotation === null || offset === null) return null;
		const mapping: UvMapping = {
			kind: 'uv',
			set: setValue,
			repeat: [repeat[0], repeat[1]],
			rotation: normalizeRotation(rotation),
			offset: [normalizeOffset(offset[0]), normalizeOffset(offset[1])],
		};
		return mapping;
	}

	reader.keys(record, path, ['kind', 'metric']);
	const metricValue = reader.required(record, path, 'metric');
	if (metricValue === undefined) return null;
	const metricRecord = reader.object(metricValue, `${path}.metric`);
	if (metricRecord === null) return null;
	reader.keys(metricRecord, `${path}.metric`, METRIC_KEYS);
	const tileValue = reader.required(metricRecord, `${path}.metric`, 'tileMeters');
	const rotationValue = reader.required(metricRecord, `${path}.metric`, 'rotation');
	const offsetValue = reader.required(metricRecord, `${path}.metric`, 'offset');
	if (tileValue === undefined || rotationValue === undefined || offsetValue === undefined) {
		return null;
	}
	const tileMeters = reader.pair(tileValue, `${path}.metric.tileMeters`);
	if (tileMeters === null) return null;
	for (const [index, value] of tileMeters.entries()) {
		if (value < TILE_MIN_METERS || value > TILE_MAX_METERS) {
			reader.problem(
				`${path}.metric.tileMeters[${index}]`,
				'out-of-range',
				'Use a tile edge in [0.01, 100] metres.',
				role,
			);
			return null;
		}
	}
	const rotation = reader.number(rotationValue, `${path}.metric.rotation`);
	const offset = reader.pair(offsetValue, `${path}.metric.offset`);
	if (rotation === null || offset === null) return null;
	const metric: Metric = {
		tileMeters: [tileMeters[0], tileMeters[1]],
		rotation: normalizeRotation(rotation),
		offset: [normalizeOffset(offset[0]), normalizeOffset(offset[1])],
	};
	return { kind, metric };
}

function readLocalImage(
	reader: MaterialReader,
	input: unknown,
	path: string,
	role: MapRole,
): LocalImage | null {
	const record = reader.object(input, path);
	if (record === null) return null;
	reader.keys(record, path, ['textureId', 'shipped']);
	const hasTextureId = 'textureId' in record;
	const hasShipped = 'shipped' in record;
	if (hasTextureId === hasShipped) {
		reader.problem(path, 'wrong-role-selector', 'Use exactly one of textureId or shipped.', role);
		return null;
	}
	if (hasTextureId) {
		const textureId = reader.opaque(record.textureId, `${path}.textureId`);
		return textureId === null ? null : { textureId };
	}
	const shipped = reader.string(record.shipped, `${path}.shipped`);
	if (shipped === null) return null;
	if (!shipped.startsWith('/') || /\s/.test(shipped)) {
		reader.problem(
			`${path}.shipped`,
			'invalid-value',
			'Use an absolute allowlisted shipped URI.',
			role,
		);
		return null;
	}
	return { shipped };
}

function roleSelectorProblem(
	reader: MaterialReader,
	record: Record<string, unknown>,
	path: string,
	allowed: readonly string[],
	role: MapRole,
): void {
	for (const key of Object.keys(record)) {
		if (allowed.includes(key)) continue;
		if ((ROLE_SELECTORS as readonly string[]).includes(key)) {
			reader.problem(
				`${path}.${key}`,
				'wrong-role-selector',
				`Remove ${key} from the ${role} binding.`,
				role,
			);
		}
	}
}

function readColour<I>(
	reader: MaterialReader,
	input: unknown,
	path: string,
	image: (input: unknown, path: string, role: MapRole) => I | null,
	role: MapRole,
): Colour<I> | null {
	const record = reader.object(input, path);
	if (record === null) return null;
	reader.keys(record, path, ['image', 'mapping'], true);
	roleSelectorProblem(reader, record, path, ['image', 'mapping'], role);
	const imageValue = reader.required(record, path, 'image');
	if (imageValue === undefined) return null;
	const resolvedImage = image(imageValue, `${path}.image`, role);
	if (resolvedImage === null) return null;
	let mapping: Mapping | undefined;
	if (record.mapping !== undefined) {
		const read = readMapping(reader, record.mapping, `${path}.mapping`, role);
		if (read === null) return null;
		mapping = read;
	}
	return { image: resolvedImage, ...(mapping === undefined ? {} : { mapping }) };
}

function readNormal<I>(
	reader: MaterialReader,
	input: unknown,
	path: string,
	image: (input: unknown, path: string, role: MapRole) => I | null,
	role: MapRole,
): Normal<I> | null {
	const record = reader.object(input, path);
	if (record === null) return null;
	reader.keys(record, path, ['image', 'convention', 'mapping'], true);
	roleSelectorProblem(reader, record, path, ['image', 'convention', 'mapping'], role);
	const imageValue = reader.required(record, path, 'image');
	const conventionValue = reader.required(record, path, 'convention');
	if (imageValue === undefined || conventionValue === undefined) return null;
	const resolvedImage = image(imageValue, `${path}.image`, role);
	if (resolvedImage === null) return null;
	const convention = reader.tag<NormalConvention>(conventionValue, `${path}.convention`, [
		'+Y',
		'-Y',
	]);
	if (convention === null) return null;
	let mapping: Mapping | undefined;
	if (record.mapping !== undefined) {
		const read = readMapping(reader, record.mapping, `${path}.mapping`, role);
		if (read === null) return null;
		mapping = read;
	}
	return { image: resolvedImage, convention, ...(mapping === undefined ? {} : { mapping }) };
}

function readScalar<I>(
	reader: MaterialReader,
	input: unknown,
	path: string,
	image: (input: unknown, path: string, role: MapRole) => I | null,
	role: MapRole,
): Scalar<I> | null {
	const record = reader.object(input, path);
	if (record === null) return null;
	reader.keys(record, path, ['image', 'component', 'invert', 'mapping'], true);
	roleSelectorProblem(reader, record, path, ['image', 'component', 'invert', 'mapping'], role);
	const imageValue = reader.required(record, path, 'image');
	const componentValue = reader.required(record, path, 'component');
	const invertValue = reader.required(record, path, 'invert');
	if (imageValue === undefined || componentValue === undefined || invertValue === undefined)
		return null;
	const resolvedImage = image(imageValue, `${path}.image`, role);
	if (resolvedImage === null) return null;
	const component = reader.tag<ScalarComponent>(
		componentValue,
		`${path}.component`,
		SCALAR_COMPONENTS,
	);
	const invert = reader.boolean(invertValue, `${path}.invert`);
	if (component === null || invert === null) return null;
	let mapping: Mapping | undefined;
	if (record.mapping !== undefined) {
		const read = readMapping(reader, record.mapping, `${path}.mapping`, role);
		if (read === null) return null;
		mapping = read;
	}
	return { image: resolvedImage, component, invert, ...(mapping === undefined ? {} : { mapping }) };
}

type ImageReader<I> = (input: unknown, path: string, role: MapRole) => I | null;

function hashImageReader(reader: MaterialReader): ImageReader<Hash> {
	return (input, path, role) => reader.hash(input, path, role);
}

function localImageReader(reader: MaterialReader): ImageReader<LocalImage> {
	return (input, path, role) => readLocalImage(reader, input, path, role);
}

function readMaps(
	reader: MaterialReader,
	input: unknown,
	path: string,
	image: (input: unknown, path: string, role: MapRole) => string | null,
): Maps<string> | null {
	const record = reader.object(input, path);
	if (record === null) return null;
	reader.keys(record, path, MATERIAL_MAP_ROLES);
	const maps: Record<string, unknown> = {};
	for (const role of MATERIAL_MAP_ROLES) {
		const value = record[role];
		if (value === undefined) continue;
		const bindingPath = `${path}.${role}`;
		if (role === 'color') {
			const binding = readColour(reader, value, bindingPath, image, role);
			if (binding !== null) maps[role] = binding;
		} else if (role === 'normal') {
			const binding = readNormal(reader, value, bindingPath, image, role);
			if (binding !== null) maps[role] = binding;
		} else {
			const binding = readScalar(reader, value, bindingPath, image, role);
			if (binding !== null) maps[role] = binding;
		}
	}
	return maps as Maps<string>;
}

function readOverrideMaps(
	reader: MaterialReader,
	input: unknown,
	path: string,
): OverrideMaps | null {
	const record = reader.object(input, path);
	if (record === null) return null;
	reader.keys(record, path, MATERIAL_MAP_ROLES);
	const maps: Record<string, unknown> = {};
	for (const role of MATERIAL_MAP_ROLES) {
		const value = record[role];
		if (value === undefined) continue;
		const bindingPath = `${path}.${role}`;
		if (value === null) {
			maps[role] = null;
			continue;
		}
		if (role === 'color') {
			const binding = readColour(reader, value, bindingPath, localImageReader(reader), role);
			if (binding !== null) maps[role] = binding;
		} else if (role === 'normal') {
			const binding = readNormal(reader, value, bindingPath, localImageReader(reader), role);
			if (binding !== null) maps[role] = binding;
		} else {
			const binding = readScalar(reader, value, bindingPath, localImageReader(reader), role);
			if (binding !== null) maps[role] = binding;
		}
	}
	return maps as OverrideMaps;
}

/** Read one complete, normalized recipe. */
export function readRecipe(input: unknown): RecipeReadResult {
	const reader = new MaterialReader();
	const record = reader.object(input, '$');
	if (record === null) return { success: false, issues: resultIssues(reader) };
	reader.keys(record, '$', RECIPE_KEYS);
	for (const key of RECIPE_KEYS) reader.required(record, '$', key);

	const profileValue = record.profile;
	if (profileValue !== undefined && profileValue !== MATERIAL_PROFILE) {
		reader.problem('$.profile', 'unknown-profile', `Use ${MATERIAL_PROFILE}.`);
	}
	const color = record.color === undefined ? null : reader.colour(record.color, '$.color');
	const roughness =
		record.roughness === undefined ? null : reader.unit(record.roughness, '$.roughness');
	const metalness =
		record.metalness === undefined ? null : reader.unit(record.metalness, '$.metalness');
	const occlusionStrength =
		record.occlusionStrength === undefined
			? null
			: reader.unit(record.occlusionStrength, '$.occlusionStrength');
	const normalScale =
		record.normalScale === undefined
			? null
			: reader.normalScale(record.normalScale, '$.normalScale');
	const mapping =
		record.mapping === undefined ? null : readMapping(reader, record.mapping, '$.mapping');
	const maps =
		record.maps === undefined
			? null
			: readMaps(reader, record.maps, '$.maps', hashImageReader(reader));

	if (reader.issues.length > 0) return { success: false, issues: resultIssues(reader) };
	const recipe: Recipe = {
		profile: MATERIAL_PROFILE as MaterialProfile,
		color: color!,
		roughness: roughness!,
		metalness: metalness!,
		occlusionStrength: occlusionStrength!,
		normalScale: normalScale!,
		mapping: mapping!,
		maps: maps as Maps<Hash>,
	};
	return { success: true, recipe: deepFreeze(recipe) };
}

function readFinishColor(reader: MaterialReader, input: unknown, path: string): FinishColor | null {
	if (typeof input === 'string') return reader.colour(input, path);
	const record = reader.object(input, path);
	if (record === null) return null;
	reader.keys(record, path, ['slot']);
	const slotValue = reader.required(record, path, 'slot');
	if (slotValue === undefined) return null;
	const slot = reader.opaque(slotValue, `${path}.slot`);
	return slot === null ? null : { slot };
}

/** Read sparse instance overrides. An empty result is legal and later omitted. */
export function readOverrides(input: unknown): OverridesReadResult {
	const reader = new MaterialReader();
	const record = reader.object(input, '$');
	if (record === null) return { success: false, issues: resultIssues(reader) };
	reader.keys(record, '$', OVERRIDE_KEYS);

	const color =
		record.color === undefined ? undefined : readFinishColor(reader, record.color, '$.color');
	const roughness =
		record.roughness === undefined ? undefined : reader.unit(record.roughness, '$.roughness');
	const metalness =
		record.metalness === undefined ? undefined : reader.unit(record.metalness, '$.metalness');
	const occlusionStrength =
		record.occlusionStrength === undefined
			? undefined
			: reader.unit(record.occlusionStrength, '$.occlusionStrength');
	const normalScale =
		record.normalScale === undefined
			? undefined
			: reader.normalScale(record.normalScale, '$.normalScale');
	const mapping =
		record.mapping === undefined ? undefined : readMapping(reader, record.mapping, '$.mapping');
	const maps =
		record.maps === undefined ? undefined : readOverrideMaps(reader, record.maps, '$.maps');

	if (reader.issues.length > 0) return { success: false, issues: resultIssues(reader) };
	const overrides: FinishOverrides = {
		...(typeof color === 'string' || (color !== null && typeof color === 'object')
			? { color }
			: {}),
		...(typeof roughness === 'number' ? { roughness } : {}),
		...(typeof metalness === 'number' ? { metalness } : {}),
		...(typeof occlusionStrength === 'number' ? { occlusionStrength } : {}),
		...(typeof normalScale === 'number' ? { normalScale } : {}),
		...(mapping !== null && mapping !== undefined ? { mapping } : {}),
		...(maps !== null && maps !== undefined ? { maps } : {}),
	};
	return { success: true, overrides: deepFreeze(overrides) };
}

/** Drop empty override containers; `undefined` means "no overrides authored". */
export function pruneOverrides(
	overrides: FinishOverrides | undefined,
): FinishOverrides | undefined {
	if (overrides === undefined) return undefined;
	const next: Record<string, unknown> = {};
	for (const key of OVERRIDE_KEYS) {
		const value = overrides[key as keyof FinishOverrides];
		if (value === undefined) continue;
		if (key === 'maps' && typeof value === 'object' && value !== null) {
			if (Object.keys(value).length === 0) continue;
			next[key] = value;
			continue;
		}
		next[key] = value;
	}
	return Object.keys(next).length === 0 ? undefined : (next as FinishOverrides);
}

function readBase(reader: MaterialReader, input: unknown, path: string): FinishBase | null {
	const record = reader.object(input, path);
	if (record === null) return null;
	reader.keys(record, path, ['catalogue', 'material']);
	const hasCatalogue = 'catalogue' in record;
	const hasMaterial = 'material' in record;
	if (hasCatalogue === hasMaterial) {
		reader.problem(path, 'wrong-role-selector', 'Use exactly one of catalogue or material.');
		return null;
	}
	if (hasCatalogue) {
		const catalogue = reader.opaque(record.catalogue, `${path}.catalogue`);
		return catalogue === null ? null : { catalogue };
	}
	const material = reader.hash(record.material, `${path}.material`);
	return material === null ? null : { material };
}

/** Read one Finish: identity, display name, base and sparse overrides. */
export function readFinish(input: unknown): FinishReadResult {
	const reader = new MaterialReader();
	const record = reader.object(input, '$');
	if (record === null) return { success: false, issues: resultIssues(reader) };
	reader.keys(record, '$', FINISH_KEYS);
	for (const key of FINISH_KEYS) {
		if (key === 'overrides') continue;
		reader.required(record, '$', key);
	}
	const id = record.id === undefined ? null : reader.opaque(record.id, '$.id');
	const nameValue = record.name === undefined ? null : reader.string(record.name, '$.name');
	const name =
		nameValue === null
			? null
			: (() => {
					const trimmed = nameValue.trim();
					if (trimmed.length < 1 || trimmed.length > 120) {
						reader.problem('$.name', 'out-of-range', 'Use a display name of 1–120 characters.');
						return null;
					}
					return trimmed;
				})();
	const base = record.base === undefined ? null : readBase(reader, record.base, '$.base');
	const overrides =
		record.overrides === undefined
			? undefined
			: (() => {
					const read = readOverrides(record.overrides);
					if (!read.success) {
						reader.issues.push(
							...read.issues.map((issue) => ({
								...issue,
								path: issue.path === '$' ? '$.overrides' : `$.overrides${issue.path.slice(1)}`,
							})),
						);
						return undefined;
					}
					return pruneOverrides(read.overrides);
				})();

	if (reader.issues.length > 0 || id === null || name === null || base === null) {
		return { success: false, issues: resultIssues(reader) };
	}
	const finish: Finish = {
		id,
		name,
		base,
		...(overrides === undefined ? {} : { overrides }),
	};
	return { success: true, finish: deepFreeze(finish) };
}

/**
 * Every local texture id one Finish's overrides bind, with the role that names
 * it. Used by the Scene unit's texture-reference closure and the project-image
 * enumerator; a definition's digest bindings are a separate list.
 */
export function finishTextureBindings(
	finish: Finish,
): readonly { readonly role: MapRole; readonly textureId: string }[] {
	const bindings: { role: MapRole; textureId: string }[] = [];
	for (const role of MATERIAL_MAP_ROLES) {
		const binding = finish.overrides?.maps?.[role];
		if (binding === undefined || binding === null) continue;
		const source = binding.image;
		if ('textureId' in source) bindings.push({ role, textureId: source.textureId });
	}
	return bindings;
}

/** Whether a Finish is a pristine catalogue instance (its base alone). */
export function isPristineFinish(finish: Finish): boolean {
	return 'catalogue' in finish.base && finish.overrides === undefined;
}

/** The display-free identity key: pristine catalogue or project Finish. */
export function finishIdentityKey(finish: Finish): string {
	return 'catalogue' in finish.base && finish.overrides === undefined
		? `curated:${finish.base.catalogue}`
		: `project:${finish.id}`;
}

export { sortMaterialIssues };
