/**
 * The one bounded offline conversion from Scene 11 / resources 2 to the
 * admitted Scene 12 / resources 3 pair.
 *
 * It is deliberately not a second reader in the runtime: the current codec
 * still refuses a Scene 11 stamp. This converter is the only entry that accepts
 * the outgoing pair, and it converts exactly one version boundary:
 *
 * - F2 envelope, Layout, Camera and Experience versions are preserved byte for
 *   byte;
 * - Scene material instances become the accepted Finish grammar through the
 *   same `sceneFinishToContract` adaptation A defined;
 * - stable IDs, assignments, texture records and pins are preserved;
 * - only the Scene and resources unit content revisions are recomputed.
 *
 * Every input is structurally checked before conversion, and the result is
 * admitted by the current codec before it is returned. A refusal leaves the
 * caller's object untouched. `dryRun` returns the report without a document, so
 * an inventory can be produced without writing anything.
 */
import { catalogueRecipe } from './materials/catalogue';
import { shippedImage } from './materials/catalogue';
import { sceneFinishToContract } from './materials/scene-finish';
import type { MaterialIssue } from './materials/issues';
import {
	materialImageIndex,
	mergeImageIndexes,
	resolveFinish,
	shippedImageIndex,
	type ImageIndex,
	type PaletteSlot
} from './materials';
import type { ProjectEnvelope } from './units/types';
import { computeUnitContentRevision } from './units/canonical';
import { validateProjectEnvelope } from './units/validate';

export const OUTGOING_SCENE_FORMAT = 11;
export const ADMITTED_SCENE_FORMAT = 12;
export const OUTGOING_RESOURCES_FORMAT = 2;
export const ADMITTED_RESOURCES_FORMAT = 3;

export type SceneConversionIssue = {
	readonly path: string;
	readonly code: string;
	readonly message: string;
};

export type SceneConversionReport = {
	readonly source: { readonly scene: 11; readonly resources: 2 };
	readonly target: { readonly scene: 12; readonly resources: 3 };
	readonly materials: readonly {
		readonly id: string;
		readonly name: string;
		readonly base: string;
	}[];
	readonly preserved: {
		readonly textures: number;
		readonly entities: number;
		readonly assignments: number;
	};
};

export type SceneConversionResult =
	| {
			readonly success: true;
			readonly report: SceneConversionReport;
			/** Absent for a dry run: the caller never receives a writable document. */
			readonly document?: ProjectEnvelope;
	  }
	| { readonly success: false; readonly issues: readonly SceneConversionIssue[] };

const MATERIAL_KEYS = [
	'id',
	'name',
	'baseMaterialId',
	'color',
	'roughness',
	'metalness',
	'maps',
	'mapping',
	'normalScale',
	'normalFlipY'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path: string, code: string, message: string): SceneConversionIssue {
	return { path, code, message };
}

function readMaterial(
	input: unknown,
	index: number,
	issues: SceneConversionIssue[]
): ReturnType<typeof sceneFinishToContract> | undefined {
	const path = `$.units.scene.data.materials[${index}]`;
	if (!isRecord(input)) {
		issues.push(issue(path, 'invalid-type', 'Expected a Scene 11 material instance object.'));
		return undefined;
	}
	for (const key of Object.keys(input)) {
		if (!(MATERIAL_KEYS as readonly string[]).includes(key)) {
			issues.push(issue(`${path}.${key}`, 'unknown-key', 'Scene 11 does not define this material field.'));
		}
	}
	const id = input.id;
	const name = input.name;
	const baseMaterialId = input.baseMaterialId;
	if (typeof id !== 'string' || id.length === 0) {
		issues.push(issue(`${path}.id`, 'invalid-type', 'A Finish needs a stable non-empty id.'));
	}
	if (typeof name !== 'string' || name.length === 0) {
		issues.push(issue(`${path}.name`, 'invalid-type', 'A Finish needs a non-empty display name.'));
	}
	if (typeof baseMaterialId !== 'string' || catalogueRecipe(baseMaterialId) === undefined) {
		issues.push(issue(`${path}.baseMaterialId`, 'unknown-material', 'Use an admitted Scene 11 catalogue base.'));
	}
	if (issues.length > 0) return undefined;
	const converted = sceneFinishToContract(input as Parameters<typeof sceneFinishToContract>[0]);
	if (!converted.success) {
		issues.push(
			...converted.issues.map((entry: MaterialIssue) =>
				issue(`${path}${entry.path.replace(/^\$/, '')}`, entry.code, entry.action ?? entry.code)
			)
		);
		return undefined;
	}
	return converted;
}

function headerFormat(unit: unknown): unknown {
	return isRecord(unit) && isRecord(unit.header) ? unit.header.formatVersion : undefined;
}

/**
 * A Scene 11 texture id whose record names a frozen shipped image is a static
 * binding, not a project texture: it has no P20 pin and must not invent one.
 * Converting it to `{shipped}` preserves the exact bytes and the canonical
 * image identity without carrying a dead texture resource dependency.
 */
function staticizeShippedMaps(
	finish: import('./materials/types').Finish,
	textures: readonly { readonly id: string; readonly uri: string }[]
): import('./materials/types').Finish {
	const maps = finish.overrides?.maps;
	if (maps === undefined) return finish;
	let changed = false;
	const next = { ...maps } as Record<string, unknown>;
	for (const role of Object.keys(maps) as Array<keyof typeof maps>) {
		const binding = maps[role];
		if (binding === null || binding === undefined || !('image' in binding)) continue;
		const image = binding.image;
		if (image === null || !('textureId' in image)) continue;
		const texture = textures.find((entry) => entry.id === image.textureId);
		const shipped = texture === undefined ? undefined : shippedImage(texture.uri);
		if (shipped === undefined) continue;
		next[role] = { ...binding, image: { shipped: shipped.uri } };
		changed = true;
	}
	if (!changed) return finish;
	return {
		...finish,
		overrides: {
			...finish.overrides,
			maps: next as NonNullable<typeof finish.overrides>['maps']
		}
	};
}

/**
 * Compare A's resolved output, not just the admitted bytes. Sparse Scene 11
 * mappings inherit rotation and offset from the catalogue base, so a conversion
 * that silently drops those fields would still serialize and validate.
 * Image identity is compared by presence, not by local spelling: staticizing a
 * shipped texture changes `{textureId}` to `{shipped}` while preserving bytes.
 */
function resolvedSignature(
	finish: import('./materials/types').Finish,
	index: ImageIndex,
	palette: readonly PaletteSlot[] | undefined
): string | null {
	if (!('catalogue' in finish.base)) return null;
	const resolution = resolveFinish({ catalogue: finish.base.catalogue }, finish.overrides, palette, index);
	if (resolution.inputs === null) return `unresolved:${resolution.issues.map((entry) => entry.code).join(',')}`;
	const inputs = resolution.inputs;
	return JSON.stringify({
		color: inputs.color,
		roughness: inputs.roughness,
		metalness: inputs.metalness,
		occlusionStrength: inputs.occlusionStrength,
		normalScale: inputs.normalScale,
		maps: (['color', 'normal', 'roughness', 'metalness', 'occlusion'] as const).map((role) => {
			const binding = inputs.maps[role];
			if (binding === undefined) return null;
			return {
				role,
				mapping: binding.mapping,
				...('convention' in binding && binding.convention !== undefined
					? { convention: binding.convention }
					: {}),
				...('component' in binding && binding.component !== undefined
					? { component: binding.component }
					: {}),
				...('invert' in binding && binding.invert !== undefined ? { invert: binding.invert } : {})
			};
		})
	});
}

function dataFormat(unit: unknown): unknown {
	return isRecord(unit) && isRecord(unit.data) ? unit.data.formatVersion : undefined;
}

/**
 * Convert one outgoing envelope. Never mutates `input`.
 *
 * `dryRun` performs every check, including conversion and current-codec
 * admission, but omits the document from the result.
 */
export async function convertScene11To12(
	input: unknown,
	options: { readonly dryRun?: boolean } = {}
): Promise<SceneConversionResult> {
	const issues: SceneConversionIssue[] = [];
	if (!isRecord(input)) {
		return { success: false, issues: [issue('$', 'invalid-type', 'Expected a project envelope.')] };
	}
	if (!isRecord(input.units)) {
		return { success: false, issues: [issue('$.units', 'invalid-type', 'Expected the F2 unit envelope.')] };
	}
	const units = input.units;
	const scene = units.scene;
	const resources = units.resources;
	if (headerFormat(scene) !== OUTGOING_SCENE_FORMAT || dataFormat(scene) !== OUTGOING_SCENE_FORMAT) {
		issues.push(
			issue('$.units.scene', 'unsupported-format', `Only the exact Scene ${OUTGOING_SCENE_FORMAT} pair is convertible.`)
		);
	}
	if (
		headerFormat(resources) !== OUTGOING_RESOURCES_FORMAT ||
		dataFormat(resources) !== OUTGOING_RESOURCES_FORMAT
	) {
		issues.push(
			issue('$.units.resources', 'unsupported-format', `Only the exact resources ${OUTGOING_RESOURCES_FORMAT} pair is convertible.`)
		);
	}
	if (issues.length > 0) return { success: false, issues };
	const sceneData = (scene as { data: Record<string, unknown> }).data;
	const resourcesData = (resources as { data: Record<string, unknown> }).data;
	if (!Array.isArray(sceneData.materials) || !Array.isArray(resourcesData.resources)) {
		return {
			success: false,
			issues: [issue('$.units.scene.data.materials', 'invalid-type', 'Expected a material instance list.')]
		};
	}

	// The format stamps say what the bytes claim to be; they say nothing about
	// whether the bytes are the revision the headers name. Verify every unit's
	// content revision before conversion, so a payload edited underneath an
	// unchanged header refuses instead of being re-stamped as if it were sound.
	// This is verification only: the converter never repairs a header over
	// input it has not proved.
	for (const domain of ['layout', 'scene', 'camera', 'experience', 'resources'] as const) {
		const unit = units[domain];
		if (!isRecord(unit) || !isRecord(unit.header) || !isRecord(unit.data)) {
			issues.push(issue(`$.units.${domain}`, 'invalid-type', `Expected the ${domain} unit payload and header.`));
			continue;
		}
		const recorded = unit.header.contentRevision;
		if (typeof recorded !== 'string' || recorded.length === 0) {
			issues.push(
				issue(`$.units.${domain}.header.contentRevision`, 'invalid-type', 'Expected a recorded unit content revision.')
			);
			continue;
		}
		const recomputed = await computeUnitContentRevision(unit.data);
		if (recomputed !== recorded) {
			issues.push(
				issue(
					`$.units.${domain}.header.contentRevision`,
					'content-revision-mismatch',
					`The ${domain} payload does not match its recorded content revision; repair the source or restore the original bytes before converting.`
				)
			);
		}
	}
	if (issues.length > 0) return { success: false, issues };

	const materials: unknown[] = [];
	const textureRecords = Array.isArray(sceneData.textures)
		? (sceneData.textures as readonly { id: string; uri: string }[])
		: [];
	const sceneIndex: ImageIndex = mergeImageIndexes(
		shippedImageIndex(),
		materialImageIndex(textureRecords.map((texture) => ({
			hash: texture.id,
			source: { textureId: texture.id }
		})))
	);
	const palette = Array.isArray(sceneData.palette) ? (sceneData.palette as PaletteSlot[]) : undefined;
	for (const [index, material] of sceneData.materials.entries()) {
		const converted = readMaterial(material, index, issues);
		if (converted?.success) {
			const target = staticizeShippedMaps(converted.finish, textureRecords);
			const before = resolvedSignature(converted.finish, sceneIndex, palette);
			const after = resolvedSignature(target, sceneIndex, palette);
			if (before !== null && before !== after) {
				issues.push(issue(
					`$.units.scene.data.materials[${index}]`,
					'resolved-output-mismatch',
					'Conversion changed the finish resolved through its catalogue base.'
				));
			}
			materials.push(target);
		}
	}
	if (issues.length > 0) return { success: false, issues };

	const document = structuredClone(input) as unknown as ProjectEnvelope;
	document.units.scene.header.formatVersion = ADMITTED_SCENE_FORMAT as never;
	document.units.scene.data.formatVersion = ADMITTED_SCENE_FORMAT as never;
	document.units.scene.data.materials = materials as never;
	document.units.resources.header.formatVersion = ADMITTED_RESOURCES_FORMAT as never;
	document.units.resources.data.formatVersion = ADMITTED_RESOURCES_FORMAT as never;
	document.units.scene.header.contentRevision = await computeUnitContentRevision(document.units.scene.data);
	document.units.resources.header.contentRevision = await computeUnitContentRevision(
		document.units.resources.data
	);

	const admitted = validateProjectEnvelope(document);
	if (!admitted.success) {
		return {
			success: false,
			issues: admitted.issues.map((entry) =>
				issue(entry.path, entry.code, entry.message)
			)
		};
	}

	const report: SceneConversionReport = {
		source: { scene: OUTGOING_SCENE_FORMAT, resources: OUTGOING_RESOURCES_FORMAT },
		target: { scene: ADMITTED_SCENE_FORMAT, resources: ADMITTED_RESOURCES_FORMAT },
		materials: (sceneData.materials as readonly { id: string; name: string; baseMaterialId: string }[]).map(
			(material) => ({ id: material.id, name: material.name, base: material.baseMaterialId })
		),
		preserved: {
			textures: Array.isArray(sceneData.textures) ? sceneData.textures.length : 0,
			entities: Array.isArray(sceneData.entities) ? sceneData.entities.length : 0,
			assignments: Array.isArray(sceneData.surfaceFinishes) ? sceneData.surfaceFinishes.length : 0
		}
	};
	return options.dryRun ? { success: true, report } : { success: true, report, document: admitted.envelope };
}
