/**
 * The Finish model: identity, users, the assignment normal form and the two
 * Card readings (Sheen and Metal).
 *
 * Finish identity is derived, never stored:
 *
 * - a primitive or Form with no instance has `curated:<entity.materialId>`;
 * - a model with no instance has `model-own`;
 * - an instance with only `id`, `name` and `baseMaterialId` is *pristine* and
 *   means the curated Finish it names, so the Library never lists it;
 * - any other instance is a project Finish, `project:<id>`.
 *
 * The editor imports these readings, so the Card and the planner cannot
 * disagree about what a Finish is or what a Sheen stop means.
 */
import {
	SCENE_PALETTE_MAX_SLOTS,
	type MaterialId,
	type SceneColor,
	type SceneEntity,
	type SceneMaterialInstance,
	type ScenePaletteSlot
} from '../scene';
import { sameSceneValues } from './record-scope';

/** One Finish, as a payload names it. */
export type SceneFinishRef =
	| { readonly curated: MaterialId }
	| { readonly project: string }
	| 'model-own';

/** The stable string identity of a Finish. It is never persisted. */
export type FinishKey = string;

export const FINISH_MODEL_OWN: FinishKey = 'model-own';

/** The longest palette slot name, matching the Scene unit validator. */
export const PALETTE_NAME_MAX_LENGTH = 40;
/** The longest palette slot id, matching the Scene unit validator. */
export const PALETTE_ID_MAX_LENGTH = 64;
/** The most project Finishes a name allocation will probe before giving up. */
const NAME_ALLOCATION_LIMIT = 10_000;

export type FinishEntity = SceneEntity & {
	readonly materialInstanceId?: string;
	readonly materialId?: MaterialId;
};

/** A Scene document narrowed to the records a Finish write can touch. */
export type FinishScene = {
	readonly materials: readonly SceneMaterialInstance[];
	readonly entities: readonly SceneEntity[];
	readonly palette?: readonly ScenePaletteSlot[];
};

export type FinishTargetKind = 'primitive' | 'form' | 'model';

/** Whether a Finish can be assigned to this entity at all. */
export function isFinishPaintable(entity: SceneEntity): entity is FinishEntity {
	return entity.kind === 'primitive' || entity.kind === 'form' || entity.kind === 'model';
}

export function finishKeyOfRef(ref: SceneFinishRef): FinishKey {
	if (ref === 'model-own') return FINISH_MODEL_OWN;
	if ('curated' in ref) return `curated:${ref.curated}`;
	return `project:${ref.project}`;
}

export function finishRefOfKey(key: FinishKey): SceneFinishRef | null {
	if (key === FINISH_MODEL_OWN) return 'model-own';
	if (key.startsWith('curated:')) {
		return { curated: key.slice('curated:'.length) as MaterialId };
	}
	if (key.startsWith('project:')) {
		return { project: key.slice('project:'.length) };
	}
	return null;
}

/** A pristine instance renders exactly as its base and is never listed. */
export function isPristineInstance(instance: SceneMaterialInstance): boolean {
	const keys = Object.keys(instance).sort();
	return (
		keys.length === 3 &&
		keys[0] === 'baseMaterialId' &&
		keys[1] === 'id' &&
		keys[2] === 'name' &&
		instance.color === undefined &&
		instance.roughness === undefined &&
		instance.metalness === undefined &&
		instance.maps === undefined &&
		instance.mapping === undefined &&
		instance.normalScale === undefined &&
		instance.normalFlipY === undefined
	);
}

export function materialInstanceById(
	materials: readonly SceneMaterialInstance[],
	id: string | undefined
): SceneMaterialInstance | undefined {
	if (id === undefined) return undefined;
	return materials.find((instance) => instance.id === id);
}

/**
 * The effective Finish of one entity. `null` for a subject S4 cannot paint
 * (a light or Artwork); none of those ever reaches a Finish writer.
 */
export function finishOf(
	entity: SceneEntity,
	materials: readonly SceneMaterialInstance[]
): FinishKey | null {
	if (!isFinishPaintable(entity)) return null;
	const instance = materialInstanceById(materials, entity.materialInstanceId);
	if (instance !== undefined) {
		return isPristineInstance(instance)
			? `curated:${instance.baseMaterialId}`
			: `project:${instance.id}`;
	}
	if (entity.kind === 'model') return FINISH_MODEL_OWN;
	return `curated:${entity.materialId}`;
}

/** Every Scene object using a Finish, in document order. */
export function usersOfFinish(scene: FinishScene, key: FinishKey): SceneEntity[] {
	return scene.entities.filter((entity) => finishOf(entity, scene.materials) === key);
}

/** The catalogue Finish a curated key names. */
export function curatedIdOf(key: FinishKey): MaterialId | null {
	const ref = finishRefOfKey(key);
	return ref !== null && ref !== 'model-own' && 'curated' in ref ? ref.curated : null;
}

/** The project Finish a project key names. */
export function projectIdOf(key: FinishKey): string | null {
	const ref = finishRefOfKey(key);
	return ref !== null && ref !== 'model-own' && 'project' in ref ? ref.project : null;
}

/** The catalogue base an entity renders from: its instance's base, or its own. */
export function baseMaterialIdOf(
	entity: SceneEntity,
	materials: readonly SceneMaterialInstance[]
): MaterialId | null {
	const instance = materialInstanceById(
		materials,
		(entity as FinishEntity).materialInstanceId
	);
	if (instance !== undefined) return instance.baseMaterialId;
	return isFinishPaintable(entity) && entity.kind !== 'model'
		? ((entity as FinishEntity).materialId ?? null)
		: null;
}

/**
 * The first free `<base> <n>` name, starting at 2. Names are display-only;
 * identity is the instance id.
 */
export function nextFinishName(
	base: string,
	materials: readonly SceneMaterialInstance[]
): string {
	const used = new Set(materials.map((material) => material.name));
	for (let ordinal = 2; ordinal < NAME_ALLOCATION_LIMIT; ordinal += 1) {
		const name = `${base} ${ordinal}`;
		if (!used.has(name)) return name;
	}
	return `${base} ${NAME_ALLOCATION_LIMIT}`;
}

/** `Colour n`, where n is the first number not already used by such a name. */
export function nextPaletteName(
	palette: readonly ScenePaletteSlot[] | undefined
): string {
	const used = new Set((palette ?? []).map((slot) => slot.name));
	for (let ordinal = 1; ordinal < NAME_ALLOCATION_LIMIT; ordinal += 1) {
		const name = `Colour ${ordinal}`;
		if (!used.has(name)) return name;
	}
	return `Colour ${NAME_ALLOCATION_LIMIT}`;
}

/** Whether another palette slot fits. */
export function paletteHasRoom(palette: readonly ScenePaletteSlot[] | undefined): boolean {
	return (palette?.length ?? 0) < SCENE_PALETTE_MAX_SLOTS;
}

/** The authored literal of an instance colour, or `null` for an inherited one. */
export function literalColorOf(
	entity: SceneEntity,
	materials: readonly SceneMaterialInstance[]
): string | null {
	const instance = materialInstanceById(materials, (entity as FinishEntity).materialInstanceId);
	const color = instance?.color;
	return color !== undefined && typeof color === 'string' ? color : null;
}

/** The palette slot an instance colour follows, or `null` for a literal/inherited colour. */
export function followerSlotOf(
	entity: SceneEntity,
	materials: readonly SceneMaterialInstance[]
): string | null {
	const instance = materialInstanceById(materials, (entity as FinishEntity).materialInstanceId);
	const color = instance?.color;
	return color !== undefined && typeof color !== 'string' ? color.slot : null;
}

/** The effective colour an entity's Finish resolves to, for the dropper and swatches. */
export function effectiveColorOf(
	entity: SceneEntity,
	scene: FinishScene,
	fallbackColor: (base: MaterialId) => string
): string | null {
	const key = finishOf(entity, scene.materials);
	if (key === null) return null;
	const instance = materialInstanceById(
		scene.materials,
		(entity as FinishEntity).materialInstanceId
	);
	const instanceColor = instance?.color;
	if (instanceColor !== undefined) {
		if (typeof instanceColor === 'string') return instanceColor;
		const slot = scene.palette?.find((entry) => entry.id === instanceColor.slot);
		if (slot !== undefined) return slot.color;
	}
	const base = baseMaterialIdOf(entity, scene.materials);
	return base === null ? null : fallbackColor(base);
}

/** One Sheen stop. Roughness is the authored value the stop writes. */
export type FinishSheenStop = {
	readonly id: 'matte' | 'satin' | 'gloss' | 'high-gloss';
	readonly label: string;
	readonly roughness: number;
};

export const FINISH_SHEEN_STOPS: readonly FinishSheenStop[] = [
	{ id: 'matte', label: 'Matte', roughness: 0.9 },
	{ id: 'satin', label: 'Satin', roughness: 0.6 },
	{ id: 'gloss', label: 'Gloss', roughness: 0.3 },
	{ id: 'high-gloss', label: 'High gloss', roughness: 0.1 }
];

/** The comparator precision the material resolver uses for its variant seed. */
export const FINISH_ROUGHNESS_PRECISION = 1000;

/** The lit stop, the inherited/custom caption, and the authored value. */
export type SheenReading = {
	readonly stop: FinishSheenStop['id'] | null;
	readonly caption: string;
	readonly roughness: number;
};

export function sheenReading(input: {
	readonly effectiveRoughness: number;
	readonly authored: boolean;
	readonly baseLabel: string;
}): SheenReading {
	const at = (value: number): number => Math.round(value * FINISH_ROUGHNESS_PRECISION);
	const stop = FINISH_SHEEN_STOPS.find(
		(candidate) => at(candidate.roughness) === at(input.effectiveRoughness)
	);
	const roughness = Math.round(input.effectiveRoughness * 100) / 100;
	const caption =
		stop !== undefined
			? stop.label
			: input.authored
				? `Custom (${roughness.toFixed(2)})`
				: `As ${input.baseLabel} (${roughness.toFixed(2)})`;
	return { stop: stop?.id ?? null, caption, roughness };
}

export type MetalReading = {
	readonly on: boolean;
	readonly caption: string;
	readonly metalness: number;
};

/** Metal is on at or above 0.5; a partly-metal base states its exact value. */
export function metalReading(effectiveMetalness: number): MetalReading {
	const on = effectiveMetalness >= 0.5;
	const rounded = Math.round(effectiveMetalness * 100) / 100;
	const caption =
		effectiveMetalness > 0 && effectiveMetalness < 1
			? `Partly metal (${rounded.toFixed(2)})`
			: on
				? 'Metal'
				: 'Not metal';
	return { on, caption, metalness: rounded };
}

/** The value form one `scene-finish-edit` changes. */
export type SceneFinishEdit = {
	readonly color?: SceneColor | null;
	readonly roughness?: number | null;
	readonly metalness?: 0 | 1 | null;
};

/** Apply one validated edit to an instance copy; `null` deletes a key. */
export function applyFinishEdit(
	instance: SceneMaterialInstance,
	edit: SceneFinishEdit
): SceneMaterialInstance {
	const next: Record<string, unknown> = { ...instance };
	if ('color' in edit) {
		if (edit.color === null) delete next.color;
		else next.color = edit.color;
	}
	if ('roughness' in edit) {
		if (edit.roughness === null) delete next.roughness;
		else next.roughness = edit.roughness;
	}
	if ('metalness' in edit) {
		if (edit.metalness === null) delete next.metalness;
		else next.metalness = edit.metalness;
	}
	return next as unknown as SceneMaterialInstance;
}

/** Whether an edit would change nothing on the given instance. */
export function finishEditIsNoop(
	instance: SceneMaterialInstance,
	edit: SceneFinishEdit
): boolean {
	return sameSceneValues(applyFinishEdit(instance, edit), instance);
}

/** Every material whose colour follows one palette slot. */
export function paletteFollowers(
	materials: readonly SceneMaterialInstance[],
	slotId: string
): SceneMaterialInstance[] {
	return materials.filter(
		(instance) =>
			instance.color !== undefined &&
			typeof instance.color !== 'string' &&
			instance.color.slot === slotId
	);
}

/** Convert a slot's followers to that slot's literal colour. */
export function literalizePaletteFollowers(
	materials: readonly SceneMaterialInstance[],
	slotId: string,
	color: string
): SceneMaterialInstance[] {
	return materials.map((instance) =>
		instance.color !== undefined &&
		typeof instance.color !== 'string' &&
		instance.color.slot === slotId
			? { ...instance, color }
			: instance
	);
}

/**
 * Resolve the picker's transient colours into a render-only Scene.
 *
 * The preview is a synthetic material instance per previewed object, resolved by
 * the one existing catalogue/resolver path. It never mutates the accepted Scene,
 * never allocates a planner id and never enters Undo; removing the map restores
 * the accepted bytes exactly.
 */
export function withFinishPreviews<TS extends FinishScene>(
	scene: TS,
	previews: ReadonlyMap<string, string>
): TS {
	if (previews.size === 0) return scene;
	const materials = [...scene.materials];
	const entities = scene.entities.map((entity) => {
		const color = previews.get(entity.id);
		if (color === undefined || !isFinishPaintable(entity)) return entity;
		const base = baseMaterialIdOf(entity, scene.materials);
		if (base === null) return entity;
		const source = materialInstanceById(scene.materials, entity.materialInstanceId);
		const id = `preview-finish-${entity.id}`;
		const next = {
			...(source ?? { name: 'Preview', baseMaterialId: base }),
			id,
			color
		} as SceneMaterialInstance;
		const index = materials.findIndex((material) => material.id === id);
		if (index === -1) materials.push(next);
		else materials[index] = next;
		return { ...entity, materialInstanceId: id } as SceneEntity;
	});
	return { ...scene, materials, entities } as TS;
}

/** A stable, readable label for a Finish key when no catalogue is at hand. */
export function fallbackFinishLabel(key: FinishKey, scene: FinishScene): string {
	if (key === FINISH_MODEL_OWN) return "Model's own";
	if (key.startsWith('curated:')) return key.slice('curated:'.length);
	const id = key.slice('project:'.length);
	return scene.materials.find((material) => material.id === id)?.name ?? id;
}
