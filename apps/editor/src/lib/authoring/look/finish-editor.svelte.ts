/**
 * The Material editor facet.
 *
 * Owns the editor's open state (Finish mode), view settings (display channel,
 * light turn, compare), and the pure field-group projection shared between
 * Finish mode (editing an accepted Finish from the Card) and Draft mode (the
 * Library Customise… draft). Holds no Scene data and writes only through the
 * Card adapter's `edit` / `previewEdits` (Finish mode) or the draft patch list.
 */
import {
	baseRecipeOf,
	baseTileMeters,
	colourModeEdits,
	defaultColourMode,
	editsToward,
	finishColourMode,
	finishHasColourImage,
	finishSheenReading,
	type FinishColourMode,
	type FinishPatchEdit,
	type FinishSource,
	type FinishTreatmentFacts,
} from '@portfolio/project-model/scene-planning';
import {
	NEUTRAL_RECIPE,
	shippedImage,
	shippedImageIndex,
	type MapRole,
	type Mapping,
	type Recipe,
} from '@portfolio/project-model/materials';
import type {
	MaterialId,
	SceneColor,
	SceneMaterialInstance,
	ScenePaletteSlot,
} from '@portfolio/project-model/scene';
import type { FinishCard, FinishCardTarget, FinishReachChoice } from './finish-card.svelte';

export type EditorDisplayMode =
	| 'lit'
	| 'unlit-color'
	| 'normal'
	| 'roughness'
	| 'metalness'
	| 'occlusion';

export type EditorFieldGroup =
	| 'colour'
	| 'sheen'
	| 'metal'
	| 'relief'
	| 'pattern'
	| 'mapping'
	| `map:${string}`;

export type EditorRawMapRow = {
	readonly id: string;
	readonly label: string;
	readonly roles: readonly MapRole[];
	readonly hasImage: boolean;
	readonly on: boolean;
	readonly file: string;
	readonly displayTarget: Exclude<EditorDisplayMode, 'lit'>;
	readonly changed: boolean;
};

export type EditorSheenTick = {
	readonly position: number;
	readonly label: string;
	readonly active: boolean;
};

export type EditorFieldsView = {
	readonly raw: {
		readonly label: string;
		readonly caption: string;
		readonly rows: readonly EditorRawMapRow[];
	};
	readonly colour: {
		readonly changed: boolean;
		readonly modes: readonly FinishColourMode[];
		readonly mode: FinishColourMode;
		readonly hex: string | null;
		readonly slotId: string | null;
		readonly slotName: string | null;
		readonly palette: readonly {
			readonly id: string;
			readonly name: string;
			readonly color: string;
		}[];
	};
	readonly sheen: {
		readonly changed: boolean;
		readonly effectiveR: number;
		readonly originalR: number;
		readonly factor: number;
		readonly scanMean: number;
		readonly minSlider: number;
		readonly sliderValue: number;
		readonly originalMark: number;
		readonly ticks: readonly EditorSheenTick[];
		readonly ormOff: boolean;
		readonly readout: string;
		readonly caption: string | null;
	};
	readonly metal: {
		readonly changed: boolean;
		readonly value: number;
		readonly original: number;
	};
	readonly relief: {
		readonly changed: boolean;
		readonly value: number;
		readonly original: number;
		readonly disabled: boolean;
		readonly readout: string;
	};
	readonly pattern: {
		readonly changed: boolean;
		readonly tileMeters: number;
		readonly realMeters: number;
		readonly angleDeg: number;
		readonly offsetX: number;
		readonly offsetY: number;
		readonly realCaption: string;
	};
	readonly mapping: {
		readonly changed: boolean;
		readonly isModel: boolean;
		readonly value: 'uv0' | 'uv1' | 'surface';
		readonly readOnlyText: string;
	};
	readonly changedGroups: readonly EditorFieldGroup[];
	readonly changeCount: number;
};

const EPS = 0.0005;

export function formatEditorMeters(value: number): string {
	if (!Number.isFinite(value)) return '1 m';
	return `${value >= 1 ? Number(value.toFixed(2)) : Number(value.toFixed(3))} m`;
}

export function mapEditorRefusal(
	code: string | undefined,
	fallback: string,
	fieldRange?: string,
): string | null {
	switch (code) {
		case 'no-change':
			return null;
		case 'normal-control-without-normal':
			return 'Relief needs its map';
		case 'mapping-requires-metric-basis':
			return 'This model has no metric basis; use a UV set';
		case 'invalid-value':
			return fieldRange ?? fallback;
		default:
			return fallback;
	}
}

function imageFileOf(binding: { readonly image: unknown } | undefined): string {
	if (!binding || binding.image == null) return '';
	const img = binding.image;
	if (typeof img === 'string') {
		const resolved = shippedImageIndex().byHash(img as `sha256-${string}`);
		if (resolved && 'shipped' in resolved.source) {
			const info = shippedImage(resolved.source.shipped);
			if (info?.uri) return info.uri.replace(/^\/textures\//, '');
			return resolved.source.shipped;
		}
		return img.slice(0, 16);
	}
	if (
		typeof img === 'object' &&
		'shipped' in img &&
		typeof (img as { shipped: unknown }).shipped === 'string'
	) {
		const id = (img as { shipped: string }).shipped;
		const info = shippedImage(id);
		if (info?.uri) return info.uri.replace(/^\/textures\//, '');
		return id;
	}
	if (
		typeof img === 'object' &&
		'textureId' in img &&
		typeof (img as { textureId: unknown }).textureId === 'string'
	) {
		return (img as { textureId: string }).textureId;
	}
	return '';
}

function imageIdentityOf(binding: { readonly image: unknown } | undefined): string | null {
	if (!binding || binding.image == null) return null;
	const img = binding.image;
	if (typeof img === 'string') return `hash:${img}`;
	if (
		typeof img === 'object' &&
		'shipped' in img &&
		typeof (img as { shipped: unknown }).shipped === 'string'
	) {
		return `shipped:${(img as { shipped: string }).shipped}`;
	}
	if (
		typeof img === 'object' &&
		'textureId' in img &&
		typeof (img as { textureId: unknown }).textureId === 'string'
	) {
		return `texture:${(img as { textureId: string }).textureId}`;
	}
	return null;
}

function buildRawRows(source: FinishSource, base: Recipe): EditorRawMapRow[] {
	const rows: EditorRawMapRow[] = [];
	const ovMaps = source.overrides?.maps;

	// Colour row
	const baseColor = base.maps.color;
	const ovColor = ovMaps?.color;
	const hasColorImage = baseColor !== undefined || (ovColor !== undefined && ovColor !== null);
	const colorOn = hasColorImage && ovColor !== null;
	const colorBinding = ovColor && ovColor !== null ? ovColor : baseColor;
	rows.push({
		id: 'colour',
		label: 'Colour',
		roles: ['color'],
		hasImage: hasColorImage,
		on: colorOn,
		file: hasColorImage ? imageFileOf(colorBinding) : 'no colour image · plain material',
		displayTarget: 'unlit-color',
		changed: ovColor !== undefined,
	});

	// Relief (normal) row
	const baseNormal = base.maps.normal;
	const ovNormal = ovMaps?.normal;
	const hasNormalImage = baseNormal !== undefined || (ovNormal !== undefined && ovNormal !== null);
	if (hasNormalImage) {
		const normalOn = ovNormal !== null;
		const normalBinding = ovNormal && ovNormal !== null ? ovNormal : baseNormal;
		rows.push({
			id: 'normal',
			label: 'Relief',
			roles: ['normal'],
			hasImage: true,
			on: normalOn,
			file: imageFileOf(normalBinding),
			displayTarget: 'normal',
			changed: ovNormal !== undefined,
		});
	}

	// Sheen · occlusion (and metalness) grouped by image identity (ORM packing -> one row)
	const scalarRoles: readonly MapRole[] = ['roughness', 'occlusion', 'metalness'];
	const grouped = new Map<
		string,
		{ roles: MapRole[]; binding: { readonly image: unknown } | undefined }
	>();
	for (const role of scalarRoles) {
		const ov = ovMaps?.[role];
		const b = ov && ov !== null ? ov : base.maps[role];
		const id = imageIdentityOf(b);
		if (id === null || b === undefined) continue;
		const existing = grouped.get(id);
		if (existing) existing.roles.push(role);
		else grouped.set(id, { roles: [role], binding: b });
	}
	let index = 0;
	for (const [, group] of grouped) {
		const hasRough = group.roles.includes('roughness');
		const hasOcc = group.roles.includes('occlusion');
		const hasMetal = group.roles.includes('metalness');
		const label =
			hasRough && hasOcc
				? 'Sheen · occlusion'
				: hasRough
					? 'Sheen'
					: hasOcc
						? 'Occlusion'
						: hasMetal
							? 'Metal'
							: 'Map';
		const displayTarget: Exclude<EditorDisplayMode, 'lit'> = hasRough
			? 'roughness'
			: hasOcc
				? 'occlusion'
				: 'metalness';
		const on = group.roles.some((role) => ovMaps?.[role] !== null);
		const changed = group.roles.some((role) => ovMaps?.[role] !== undefined);
		rows.push({
			id: index === 0 && hasRough ? 'orm' : `map-${group.roles.join('-')}`,
			label,
			roles: group.roles,
			hasImage: true,
			on,
			file: imageFileOf(group.binding),
			displayTarget,
			changed,
		});
		index += 1;
	}

	return rows;
}

function effectiveMapping(source: FinishSource, base: Recipe): Mapping {
	return source.overrides?.mapping ?? base.mapping;
}

function mappingKindKey(mapping: Mapping): 'uv0' | 'uv1' | 'surface' {
	if (mapping.kind === 'uv') return mapping.set === 1 ? 'uv1' : 'uv0';
	return 'surface';
}

/**
 * Project one Finish (accepted or draft) into every Material editor field view,
 * with change detection strictly against `baseRecipeOf`.
 */
export function buildFinishEditorFields(input: {
	readonly source: FinishSource;
	readonly recipes: ReadonlyMap<string, Recipe>;
	readonly palette: readonly ScenePaletteSlot[];
	readonly entityKind: 'primitive' | 'form' | 'model' | null;
	readonly facts: FinishTreatmentFacts;
	readonly materialLabel: string;
	readonly curated: boolean;
}): EditorFieldsView {
	const { source, recipes, palette, entityKind, facts, materialLabel, curated } = input;
	const base = baseRecipeOf({ id: '', name: '', base: source.base }, recipes) ?? NEUTRAL_RECIPE;
	const rawRows = buildRawRows(source, base);
	const realTile = baseTileMeters(source, recipes) ?? [1, 1];
	const caption = `Captured at ${formatEditorMeters(realTile[0])} · CC0 source${curated ? ' · curated' : ''}`;

	// Colour
	const hasColourMap = finishHasColourImage(source, recipes);
	const modes: FinishColourMode[] = hasColourMap
		? ['natural', 'stained', 'painted']
		: ['natural', 'painted'];
	const mode = finishColourMode(source, recipes);
	const ovColor = source.overrides?.color;
	let slotId: string | null = null;
	let slotName: string | null = null;
	let hex: string | null = null;
	if (mode !== 'natural' && ovColor !== undefined) {
		if (typeof ovColor === 'string') {
			hex = ovColor;
		} else if ('slot' in ovColor) {
			slotId = ovColor.slot;
			const slot = palette.find((entry) => entry.id === ovColor.slot);
			slotName = slot?.name ?? ovColor.slot;
			hex = slot?.color ?? null;
		}
	}
	const colourChanged = mode !== 'natural' || ovColor !== undefined;

	// Sheen
	const sheenReading = finishSheenReading(source, recipes, facts);
	const baseSheenReading = finishSheenReading({ base: source.base }, recipes, facts);
	const ormRow = rawRows.find((row) => row.roles.includes('roughness'));
	const ormOff = ormRow !== undefined ? !ormRow.on : base.maps.roughness === undefined;
	const scanMean = ormOff ? 1 : sheenReading.scan.mean;
	const factor = source.overrides?.roughness ?? base.roughness;
	const effectiveR = ormOff ? factor : Math.min(1, Math.max(0, scanMean * factor));
	const originalR = ormOff ? base.roughness : baseSheenReading.effective;
	const minSlider = Number(Math.max(0, 1 - Math.min(1, scanMean)).toFixed(3));
	const ticks: EditorSheenTick[] = sheenReading.steps
		.filter((step) => !step.disabled)
		.map((step) => ({
			position: Number((1 - step.target).toFixed(3)),
			label: step.label,
			active: sheenReading.current === step.id,
		}))
		.filter((tick) => tick.position >= minSlider - EPS);
	const sheenChanged =
		source.overrides?.roughness !== undefined &&
		Math.abs(source.overrides.roughness - base.roughness) > EPS;

	// Metal
	const metalValue = source.overrides?.metalness ?? base.metalness;
	const metalChanged =
		source.overrides?.metalness !== undefined &&
		Math.abs(source.overrides.metalness - base.metalness) > EPS;

	// Relief
	const normalRow = rawRows.find((row) => row.roles.includes('normal'));
	const normalBound = normalRow !== undefined && normalRow.on;
	const reliefValue = source.overrides?.normalScale ?? base.normalScale;
	const reliefChanged =
		source.overrides?.normalScale !== undefined &&
		Math.abs(source.overrides.normalScale - base.normalScale) > EPS;

	// Pattern & Mapping
	const mapping = effectiveMapping(source, base);
	const baseMap = base.mapping;
	const tileMeters = mapping.kind === 'uv' ? realTile[0] : mapping.metric.tileMeters[0];
	const angleRad = mapping.kind === 'uv' ? mapping.rotation : mapping.metric.rotation;
	const angleDeg = Number((((((angleRad * 180) / Math.PI) % 360) + 360) % 360).toFixed(1));
	const normOffset = mapping.kind === 'uv' ? mapping.offset : mapping.metric.offset;
	const offsetX = Number((normOffset[0] * tileMeters).toFixed(3));
	const offsetY = Number((normOffset[1] * tileMeters).toFixed(3));

	const baseAngleRad = baseMap.kind === 'uv' ? baseMap.rotation : baseMap.metric.rotation;
	const baseNormOffset = baseMap.kind === 'uv' ? baseMap.offset : baseMap.metric.offset;
	const patternChanged =
		Math.abs(tileMeters - realTile[0]) > EPS ||
		Math.abs(angleRad - baseAngleRad) > EPS ||
		Math.abs(normOffset[0] - baseNormOffset[0]) > EPS ||
		Math.abs(normOffset[1] - baseNormOffset[1]) > EPS;

	const mappingValue = mappingKindKey(mapping);
	const mappingChanged = mappingValue !== mappingKindKey(baseMap);

	const changedGroups: EditorFieldGroup[] = [];
	if (colourChanged) changedGroups.push('colour');
	if (sheenChanged) changedGroups.push('sheen');
	if (metalChanged) changedGroups.push('metal');
	if (reliefChanged) changedGroups.push('relief');
	if (patternChanged) changedGroups.push('pattern');
	if (mappingChanged) changedGroups.push('mapping');
	for (const row of rawRows) {
		if (row.changed) changedGroups.push(`map:${row.id}`);
	}

	return {
		raw: {
			label: materialLabel,
			caption,
			rows: rawRows,
		},
		colour: {
			changed: colourChanged,
			modes,
			mode,
			hex,
			slotId,
			slotName,
			palette: palette.map((slot) => ({ id: slot.id, name: slot.name, color: slot.color })),
		},
		sheen: {
			changed: sheenChanged,
			effectiveR,
			originalR,
			factor,
			scanMean,
			minSlider,
			sliderValue: Number((1 - effectiveR).toFixed(3)),
			originalMark: Number((1 - originalR).toFixed(3)),
			ticks,
			ormOff,
			readout: `r ${effectiveR.toFixed(2)}${ormOff ? '' : ` · ×${factor.toFixed(2)} on scan`}`,
			caption:
				scanMean < 0.97 && !ormOff
					? `Captured at r ${scanMean.toFixed(2)} — a Finish is never rougher than its capture.`
					: null,
		},
		metal: {
			changed: metalChanged,
			value: metalValue,
			original: base.metalness,
		},
		relief: {
			changed: reliefChanged,
			value: reliefValue,
			original: base.normalScale,
			disabled: !normalBound,
			readout: normalBound ? `×${reliefValue.toFixed(2)}` : 'map off',
		},
		pattern: {
			changed: patternChanged,
			tileMeters: Number(tileMeters.toFixed(3)),
			realMeters: realTile[0],
			angleDeg,
			offsetX,
			offsetY,
			realCaption: `Real size ${formatEditorMeters(realTile[0])}`,
		},
		mapping: {
			changed: mappingChanged,
			isModel: entityKind === 'model',
			value: mappingValue,
			readOnlyText: 'Metres on the surface · same size everywhere',
		},
		changedGroups,
		changeCount: changedGroups.length,
	};
}

// ------------------------------------------------------------------ pure edit builders

function scalarFactorEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	field: 'roughness' | 'metalness' | 'normalScale',
	value: number,
): FinishPatchEdit[] {
	const base = baseRecipeOf({ id: '', name: '', base: source.base }, recipes) ?? NEUTRAL_RECIPE;
	const rounded = Math.round(value * 1000) / 1000;
	if (Math.abs(base[field] - rounded) < EPS) {
		return source.overrides?.[field] === undefined ? [] : [{ field, op: 'reset' }];
	}
	return [{ field, op: 'set', value: rounded }];
}

export function editorSheenEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	facts: FinishTreatmentFacts,
	sliderValue: number,
): FinishPatchEdit[] {
	const effectiveR = Math.min(1, Math.max(0, 1 - sliderValue));
	const base = baseRecipeOf({ id: '', name: '', base: source.base }, recipes) ?? NEUTRAL_RECIPE;
	const ormOff = source.overrides?.maps?.roughness === null || base.maps.roughness === undefined;
	const scanMean = ormOff ? 1 : finishSheenReading(source, recipes, facts).scan.mean;
	const factor = Math.min(1, Math.max(0, effectiveR / Math.max(0.001, scanMean)));
	return scalarFactorEdits(source, recipes, 'roughness', factor);
}

export function editorMetalEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	value: number,
): FinishPatchEdit[] {
	return scalarFactorEdits(source, recipes, 'metalness', Math.min(1, Math.max(0, value)));
}

export function editorReliefEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	value: number,
): FinishPatchEdit[] {
	return scalarFactorEdits(source, recipes, 'normalScale', Math.min(2, Math.max(0, value)));
}

export function editorMapToggleEdits(
	roles: readonly MapRole[],
	enable: boolean,
): FinishPatchEdit[] {
	return roles.map((role) =>
		enable
			? ({ field: `maps.${role}`, op: 'reset' } as const)
			: ({ field: `maps.${role}`, op: 'disable' } as const),
	);
}

export function editorColourModeEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	palette: readonly ScenePaletteSlot[],
	mode: FinishColourMode,
): FinishPatchEdit[] {
	if (mode === 'natural') return colourModeEdits(source, 'natural', null, recipes);
	const current =
		finishColourMode(source, recipes) === 'natural' ? null : (source.overrides?.color ?? null);
	const fallback: SceneColor = palette[0] !== undefined ? { slot: palette[0].id } : '#9aa58c';
	return colourModeEdits(source, mode, current ?? fallback, recipes);
}

export function editorColourValueEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	facts: FinishTreatmentFacts,
	colour: SceneColor,
): FinishPatchEdit[] {
	const current = finishColourMode(source, recipes);
	const mode = current === 'natural' ? defaultColourMode(source, recipes, facts) : current;
	return colourModeEdits(source, mode, colour, recipes);
}

function nextMappingEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	next: Mapping,
): FinishPatchEdit[] {
	const base = (baseRecipeOf({ id: '', name: '', base: source.base }, recipes) ?? NEUTRAL_RECIPE)
		.mapping;
	if (JSON.stringify(base) === JSON.stringify(next)) {
		return source.overrides?.mapping === undefined ? [] : [{ field: 'mapping', op: 'reset' }];
	}
	return [{ field: 'mapping', op: 'set', value: next }];
}

export function editorPatternEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	change: {
		readonly tileMeters?: number;
		readonly angleDeg?: number;
		readonly offsetX?: number;
		readonly offsetY?: number;
	},
): FinishPatchEdit[] {
	const base = baseRecipeOf({ id: '', name: '', base: source.base }, recipes) ?? NEUTRAL_RECIPE;
	const current = effectiveMapping(source, base);
	if (current.kind === 'uv') {
		const tile = change.tileMeters ?? 1;
		const rotation =
			change.angleDeg !== undefined
				? ((((change.angleDeg % 360) + 360) % 360) * Math.PI) / 180
				: current.rotation;
		const ox =
			change.offsetX !== undefined ? change.offsetX / Math.max(0.02, tile) : current.offset[0];
		const oy =
			change.offsetY !== undefined ? change.offsetY / Math.max(0.02, tile) : current.offset[1];
		return nextMappingEdits(source, recipes, {
			...current,
			rotation,
			offset: [Number(ox.toFixed(4)), Number(oy.toFixed(4))],
		});
	}
	const prevTile = current.metric.tileMeters;
	const aspect = prevTile[1] / Math.max(0.001, prevTile[0]);
	const tileX = change.tileMeters ?? prevTile[0];
	const tileY = change.tileMeters !== undefined ? Number((tileX * aspect).toFixed(4)) : prevTile[1];
	const rotation =
		change.angleDeg !== undefined
			? ((((change.angleDeg % 360) + 360) % 360) * Math.PI) / 180
			: current.metric.rotation;
	const ox =
		change.offsetX !== undefined
			? change.offsetX / Math.max(0.02, tileX)
			: current.metric.offset[0];
	const oy =
		change.offsetY !== undefined
			? change.offsetY / Math.max(0.02, tileY)
			: current.metric.offset[1];
	return nextMappingEdits(source, recipes, {
		kind: current.kind,
		metric: {
			tileMeters: [Number(tileX.toFixed(4)), Number(tileY.toFixed(4))],
			rotation,
			offset: [Number(ox.toFixed(4)), Number(oy.toFixed(4))],
		},
	} as Mapping);
}

export function editorMappingKindEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	kind: 'uv0' | 'uv1' | 'surface',
): FinishPatchEdit[] {
	const base = baseRecipeOf({ id: '', name: '', base: source.base }, recipes) ?? NEUTRAL_RECIPE;
	const current = effectiveMapping(source, base);
	if (kind === 'surface') {
		const real = baseTileMeters(source, recipes) ?? [1, 1];
		const next: Mapping =
			current.kind === 'surface'
				? current
				: current.kind === 'target'
					? { kind: 'surface', metric: current.metric }
					: {
							kind: 'surface',
							metric: {
								tileMeters: [real[0], real[1]],
								rotation: current.rotation,
								offset: [current.offset[0], current.offset[1]],
							},
						};
		return nextMappingEdits(source, recipes, next);
	}
	const set: 0 | 1 = kind === 'uv1' ? 1 : 0;
	const next: Mapping =
		current.kind === 'uv'
			? { ...current, set }
			: {
					kind: 'uv',
					set,
					repeat: [1, 1],
					rotation: current.metric.rotation,
					offset: [current.metric.offset[0], current.metric.offset[1]],
				};
	return nextMappingEdits(source, recipes, next);
}

export function editorResetGroupEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	group: EditorFieldGroup,
	rawRows: readonly EditorRawMapRow[],
): FinishPatchEdit[] {
	switch (group) {
		case 'colour':
			return colourModeEdits(source, 'natural', null, recipes);
		case 'sheen':
			return source.overrides?.roughness === undefined ? [] : [{ field: 'roughness', op: 'reset' }];
		case 'metal':
			return source.overrides?.metalness === undefined ? [] : [{ field: 'metalness', op: 'reset' }];
		case 'relief':
			return source.overrides?.normalScale === undefined
				? []
				: [{ field: 'normalScale', op: 'reset' }];
		case 'pattern':
		case 'mapping':
			return source.overrides?.mapping === undefined ? [] : [{ field: 'mapping', op: 'reset' }];
		default: {
			const rowId = group.slice('map:'.length);
			const row = rawRows.find((r) => r.id === rowId);
			if (!row) return [];
			return row.roles.map((role) => ({ field: `maps.${role}` as const, op: 'reset' as const }));
		}
	}
}

export function editorResetAllEdits(source: FinishSource): FinishPatchEdit[] {
	return editsToward(source.overrides, undefined);
}

/** Merge a new patch into an existing draft patch list (last edit per field wins). */
export function mergeDraftEdits(
	current: readonly FinishPatchEdit[],
	incoming: readonly FinishPatchEdit[],
): FinishPatchEdit[] {
	const byField = new Map<FinishPatchEdit['field'], FinishPatchEdit>();
	for (const edit of current) byField.set(edit.field, edit);
	for (const edit of incoming) byField.set(edit.field, edit);
	return [...byField.values()];
}

// ------------------------------------------------------------------ reactive editor facet

export type FinishEditorHost = {
	readonly card: () => FinishCard;
	readonly facts: FinishTreatmentFacts;
	readonly labelForMaterial: (id: MaterialId) => string;
	readonly swatchOf?: (id: MaterialId) => string;
};

export function createFinishEditor(host: FinishEditorHost) {
	let target = $state.raw<FinishCardTarget | null>(null);
	let place = $state('');
	let invoker = $state.raw<HTMLElement | null>(null);
	let display = $state<EditorDisplayMode>('lit');
	let lightTurnRadians = $state(0);
	let compare = $state(false);
	let fieldRefusal = $state.raw<{ readonly field: string; readonly message: string } | null>(null);

	function open(
		nextTarget: FinishCardTarget,
		nextPlace: string,
		opener?: HTMLElement | null,
	): void {
		target = nextTarget;
		place = nextPlace;
		invoker = opener ?? null;
		fieldRefusal = null;
	}

	function close(restoreFocus = true): boolean {
		if (target === null) return false;
		const returnTo = invoker;
		host.card().cancel();
		target = null;
		place = '';
		invoker = null;
		fieldRefusal = null;
		if (restoreFocus && returnTo && returnTo.isConnected) {
			queueMicrotask(() => returnTo.focus());
		}
		return true;
	}

	function setDisplay(next: EditorDisplayMode): void {
		display = next;
	}

	function toggleMapView(channel: Exclude<EditorDisplayMode, 'lit'>): void {
		display = display === channel ? 'lit' : channel;
	}

	function turnLight(): void {
		lightTurnRadians =
			lightTurnRadians >= 1.2 - 1e-6 ? -1.2 : Number((lightTurnRadians + 0.4).toFixed(1));
	}

	function setCompare(next: boolean): void {
		compare = next;
	}

	function clearFieldRefusal(): void {
		fieldRefusal = null;
	}

	function setFieldRefusal(field: string, message: string): void {
		fieldRefusal = { field, message };
	}

	function currentInspected(): {
		readonly target: FinishCardTarget;
		readonly place: string;
		readonly inspected: NonNullable<ReturnType<FinishCard['inspectedOf']>>;
	} | null {
		if (target === null) return null;
		const inspected = host.card().inspectedOf(target);
		if (inspected === null) return null;
		return { target, place, inspected };
	}

	function view(): {
		readonly target: FinishCardTarget;
		readonly place: string;
		readonly finishKey: string;
		readonly name: string;
		readonly canRename: boolean;
		readonly curated: boolean;
		readonly usersCount: number;
		readonly reach: FinishReachChoice;
		readonly instance: SceneMaterialInstance;
		readonly fields: EditorFieldsView;
		readonly align: { readonly kind: 'wall' | 'floor'; readonly label: string } | null;
	} | null {
		const ctx = currentInspected();
		if (ctx === null) return null;
		const { inspected } = ctx;
		const curated = 'curated' in inspected.ref;
		const baseCat =
			'catalogue' in inspected.instance.base
				? (inspected.instance.base.catalogue as MaterialId)
				: null;
		const materialLabel =
			baseCat !== null ? host.labelForMaterial(baseCat) : inspected.instance.name;
		const fields = buildFinishEditorFields({
			source: { base: inspected.instance.base, overrides: inspected.instance.overrides },
			recipes: inspected.recipes,
			palette: inspected.palette,
			entityKind: inspected.entityKind,
			facts: host.facts,
			materialLabel,
			curated,
		});
		const align =
			ctx.target.kind === 'surface' && ctx.target.surface.kind === 'wall-side'
				? { kind: 'wall' as const, label: 'Align on wall…' }
				: ctx.target.kind === 'surface' && ctx.target.surface.kind === 'room-floor'
					? { kind: 'floor' as const, label: 'Align on floor…' }
					: null;
		return {
			target: ctx.target,
			place: ctx.place,
			finishKey: inspected.finishKey,
			name: inspected.instance.name,
			canRename: !curated,
			curated,
			usersCount: inspected.users.length,
			reach: inspected.reach,
			instance: inspected.instance,
			fields,
			align,
		};
	}

	function toggleReach(): void {
		const ctx = currentInspected();
		if (ctx === null || ctx.inspected.users.length <= 1) return;
		host.card().setReach(ctx.target, ctx.inspected.reach === 'all' ? 'this' : 'all');
	}

	function preview(
		edits: (
			source: FinishSource,
			recipes: ReadonlyMap<string, Recipe>,
		) => readonly FinishPatchEdit[],
	): void {
		if (target === null) return;
		host.card().previewEdits(target, edits);
	}

	async function commit(
		field: string,
		edits: (
			source: FinishSource,
			recipes: ReadonlyMap<string, Recipe>,
		) => readonly FinishPatchEdit[],
	): Promise<boolean> {
		if (target === null) return false;
		fieldRefusal = null;
		const ok = await host.card().edit(target, edits);
		if (!ok) {
			const msg = host.card().refusalFor(target);
			if (msg) fieldRefusal = { field, message: msg };
		}
		return ok;
	}

	async function resetAll(): Promise<boolean> {
		if (target === null) return false;
		fieldRefusal = null;
		return host.card().resetToOriginal(target);
	}

	function cancelPreview(): void {
		host.card().cancel();
	}

	return {
		get open() {
			return target !== null;
		},
		get target() {
			return target;
		},
		get place() {
			return place;
		},
		get display() {
			return display;
		},
		get lightTurnRadians() {
			return lightTurnRadians;
		},
		get compare() {
			return compare;
		},
		get fieldRefusal() {
			return fieldRefusal;
		},
		openFor: open,
		close,
		setDisplay,
		toggleMapView,
		turnLight,
		setCompare,
		clearFieldRefusal,
		setFieldRefusal,
		view,
		toggleReach,
		preview,
		commit,
		resetAll,
		cancelPreview,
	};
}

export type FinishEditor = ReturnType<typeof createFinishEditor>;
