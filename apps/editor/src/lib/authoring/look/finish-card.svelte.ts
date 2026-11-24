/**
 * The Finish Card adapter (T2.S8 U4).
 *
 * The Card is the quick Finish: it reads one Finish user (an object or a Layout
 * surface), shows how far an edit reaches *before* the edit (D2), and turns each
 * completed control into exactly one `scene-finish-patch` (or a
 * `scene-finish-rename`). It never writes anything else.
 *
 * - **Reach.** A curated Finish defaults to *This*; a project Finish shared by
 *   several users defaults to *All*. *All* on a curated Finish materializes one
 *   Finish for the users of the target's own kind only (D5): objects or walls
 *   and floors.
 * - **Preview.** A gesture (the colour wheel, the roughness slider) previews one
 *   synthetic instance on every reached user, objects and surfaces alike. The
 *   preview is render-only: it never enters the Scene or Undo, and cancel
 *   removes it without a write.
 * - **Refusals** appear as one line in place; a `stale-reach` refusal re-reads
 *   the Finish and writes nothing.
 *
 * The treatment rules (colour modes, sheen steps, swap carry-over, generated
 * names) live in `@portfolio/project-model/scene-planning`'s
 * `finish-treatment`, so the planner and the Card read the same facts.
 */
import {
	FINISH_NAME_MAX_LENGTH,
	SCENE_FINISH_ASSIGN,
	SCENE_SURFACE_FINISH_ASSIGN,
	applyFinishPatch,
	baseRecipeOf,
	baseTileMeters,
	colourModeEdits,
	defaultColourMode,
	editsToward,
	finishColourMode,
	finishHasColourImage,
	finishKeyOfSurface,
	finishOf,
	finishRefOfKey,
	finishSheenReading,
	inspectFinish,
	isFinishPaintable,
	materialInstanceById,
	sheenStepEdits,
	surfaceFinishFor,
	surfaceUserKey,
	swapEdits,
	type FinishColourMode,
	type FinishInstancePreview,
	type FinishPatchEdit,
	type FinishSheenReading,
	type FinishSource,
	type FinishTreatmentFacts,
	type InspectedFinishUser,
	type SceneFinishRef,
	type SheenStepId
} from '@portfolio/project-model/scene-planning';
import type {
	MaterialId,
	SceneColor,
	SceneEntity,
	SceneMaterialInstance,
	ScenePaletteSlot,
	SceneSurfaceRef
} from '@portfolio/project-model';
import type { Mapping, Recipe } from '@portfolio/project-model/materials';
import { surfaceKey } from '@portfolio/layout-core';
import { stageEnvelope, type StageAdapterServices } from '../stage/stage-adapter-host';
import type { StageSelectionEntry } from '../stage/semantic-selection';
import { layoutSurfaceTarget } from './colour-coat-port';

export type FinishCardTarget =
	| { readonly kind: 'entity'; readonly entityId: string }
	| { readonly kind: 'surface'; readonly surface: SceneSurfaceRef };

export type FinishReachChoice = 'this' | 'all';

/** What one Card edit writes, from the reach shown before it. */
export type FinishWritePlan = {
	readonly mode: 'in-place' | 'all' | 'just-this';
	readonly selectedUsers: readonly string[];
	/** Users whose Finish the edit changes (the cobalt set plus the target). */
	readonly reached: readonly string[];
	readonly allocates: boolean;
};

export type FinishCardReach = {
	/** Every user of the Finish today, dormant surfaces included. */
	readonly users: number;
	/** The line under the meta: "On North wall · only here" or "Shared by 3". */
	readonly line: string;
	readonly shared: boolean;
	/** Null when there is nothing to choose. */
	readonly options: null | {
		readonly thisLabel: string;
		readonly allLabel: string;
		readonly allTitle: string;
	};
	readonly choice: FinishReachChoice;
	/** D5: the users of the other kind that keep a curated Finish under *All*. */
	readonly keepNote: string | null;
};

export type FinishCardColour = {
	readonly modes: readonly FinishColourMode[];
	readonly mode: FinishColourMode;
	readonly colour: SceneColor | null;
	/** The hex the colour reads as today (the slot's colour for a follower). */
	readonly hex: string | null;
	readonly caption: string;
	readonly chips: readonly { readonly id: string; readonly name: string; readonly color: string; readonly active: boolean }[];
	/** A literal colour not linked to the palette. */
	readonly custom: boolean;
};

export type FinishCardPattern = {
	readonly realMeters: number;
	readonly tileMeters: number;
	/** log2(tile / real), rounded when exact; null between steps. */
	readonly step: number | null;
	readonly degrees: number;
	readonly caption: string;
	readonly canSmaller: boolean;
	readonly canLarger: boolean;
};

export type FinishCardView =
	| { readonly kind: 'none'; readonly targetKey: string; readonly message: string }
	| { readonly kind: 'model-own'; readonly targetKey: string; readonly message: string }
	| {
			readonly kind: 'finish';
			readonly targetKey: string;
			readonly finishKey: string;
			readonly ref: Exclude<SceneFinishRef, 'model-own'>;
			readonly curated: boolean;
			readonly name: string;
			readonly canRename: boolean;
			readonly renameTitle: string;
			readonly meta: string;
			/** The FinishTile source and swatch colour of the Finish itself. */
			readonly tile: { readonly source: { readonly kind: 'catalogue'; readonly id: MaterialId } | null; readonly color: string };
			readonly material: { readonly label: string; readonly catalogueId: MaterialId | null; readonly swappable: boolean };
			readonly reach: FinishCardReach;
			readonly colour: FinishCardColour;
			readonly sheen: FinishSheenReading & { readonly caption: string };
			readonly pattern: FinishCardPattern | null;
			readonly align: { readonly kind: 'wall' | 'floor'; readonly label: string } | null;
			readonly more: {
				readonly roughness: number;
				readonly roughnessMax: number;
				readonly metal: boolean;
				readonly tileMeters: number | null;
				readonly degrees: number | null;
				readonly canReplaceImage: boolean;
			};
			readonly resetCount: number;
			readonly favourite: boolean;
	  };

export type FinishCardHost = {
	readonly services: () => StageAdapterServices | null;
	readonly labelForMaterial: (id: MaterialId) => string;
	readonly facts: FinishTreatmentFacts;
	/** The curated entry's swatch colour, for the head tile's fallback. */
	readonly swatchOf?: (id: MaterialId) => string;
	readonly isFavourite?: (finishKey: string) => boolean;
	readonly toggleFavourite?: (finishKey: string) => void;
	/** More › Image › Replace for an object (S4b's From-image flow). */
	readonly replaceImage?: (entityId: string, file: File, mode: 'in-place' | 'all' | 'just-this') => Promise<void>;
	/** Called after any accepted write (e.g. to note the Finish as recently used). */
	readonly onAccepted?: (finishKey: string) => void;
	/** Select every user of a Finish (Card ⋯ › Select all). */
	readonly selectFinishUsers?: (ref: Exclude<SceneFinishRef, 'model-own'>) => Promise<boolean>;
	/** Toast notification after "Give this surface its own copy". */
	readonly onOwnCopy?: () => void;
};

type Inspected = {
	readonly target: FinishCardTarget;
	readonly targetKey: string;
	readonly ref: Exclude<SceneFinishRef, 'model-own'>;
	readonly finishKey: string;
	readonly instance: SceneMaterialInstance;
	readonly users: readonly InspectedFinishUser[];
	readonly palette: readonly ScenePaletteSlot[];
	readonly recipes: ReadonlyMap<string, Recipe>;
	readonly entityKind: 'primitive' | 'form' | 'model' | null;
};

export function finishCardTargetKey(target: FinishCardTarget): string {
	return target.kind === 'entity' ? `entity:${target.entityId}` : surfaceUserKey(target.surface);
}

const userKind = (key: string): 'entity' | 'surface' => (key.startsWith('entity:') ? 'entity' : 'surface');

/** The word a reach line uses for one user of this kind. */
export function finishTargetWord(target: FinishCardTarget): string {
	if (target.kind === 'entity') return 'object';
	switch (target.surface.kind) {
		case 'wall-side': return 'side';
		case 'room-floor': return 'floor';
		case 'room-lid': return 'ceiling';
		case 'region-face': return 'surface';
	}
}

/**
 * The reach → patch mapping (U4 plan, "Reach"). Pure, so the Card, the cobalt
 * outlines and the tests read one rule.
 */
export function finishWritePlan(
	input: { readonly curated: boolean; readonly users: readonly string[]; readonly targetKey: string },
	choice: FinishReachChoice
): FinishWritePlan {
	const { curated, users, targetKey } = input;
	if (users.length <= 1) {
		return curated
			? { mode: 'all', selectedUsers: users, reached: users, allocates: true }
			: { mode: 'in-place', selectedUsers: users, reached: users, allocates: false };
	}
	if (choice === 'this') {
		return { mode: 'just-this', selectedUsers: [targetKey], reached: [targetKey], allocates: true };
	}
	if (!curated) return { mode: 'all', selectedUsers: users, reached: users, allocates: false };
	// D5: a curated Finish materializes for the target's own kind only.
	const sameKind = users.filter((key) => userKind(key) === userKind(targetKey));
	return sameKind.length === users.length
		? { mode: 'all', selectedUsers: users, reached: users, allocates: true }
		: { mode: 'just-this', selectedUsers: sameKind, reached: sameKind, allocates: true };
}

/** The default reach: *This* for a curated Finish, *All* for a shared project Finish. */
export function defaultReach(curated: boolean): FinishReachChoice {
	return curated ? 'this' : 'all';
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function formatMeters(value: number): string {
	if (value >= 1) return `${Number(value.toFixed(2))} m`;
	return `${Number(value.toFixed(3))} m`;
}

const RATIO: Readonly<Record<string, string>> = { '-3': '⅛', '-2': '¼', '-1': '½', '1': '2', '2': '4', '3': '8' };

function mappingOf(source: FinishSource, recipes: ReadonlyMap<string, Recipe>): Mapping | undefined {
	if (source.overrides?.mapping !== undefined) return source.overrides.mapping;
	const recipe = 'catalogue' in source.base ? baseRecipeOf({ id: '', name: '', base: source.base }, recipes) : recipes.get(source.base.material);
	return recipe?.mapping;
}

function recipeOfSource(source: FinishSource, recipes: ReadonlyMap<string, Recipe>): Recipe | undefined {
	return baseRecipeOf({ id: '', name: '', base: source.base }, recipes);
}

/** The edits that set a mapping, resetting it when it equals the base's own. */
function mappingEdits(source: FinishSource, recipes: ReadonlyMap<string, Recipe>, next: Mapping): FinishPatchEdit[] {
	const base = recipeOfSource(source, recipes)?.mapping;
	const overrides = { ...(source.overrides ?? {}) } as Record<string, unknown>;
	if (base !== undefined && JSON.stringify(base) === JSON.stringify(next)) delete overrides.mapping;
	else overrides.mapping = next;
	return editsToward(source.overrides, overrides);
}

function factorEdits(
	source: FinishSource,
	recipes: ReadonlyMap<string, Recipe>,
	field: 'roughness' | 'metalness',
	value: number
): FinishPatchEdit[] {
	const base = recipeOfSource(source, recipes)?.[field];
	const overrides = { ...(source.overrides ?? {}) } as Record<string, unknown>;
	const rounded = Math.round(value * 1000) / 1000;
	if (base !== undefined && Math.abs(base - rounded) < 0.0005) delete overrides[field];
	else overrides[field] = rounded;
	return editsToward(source.overrides, overrides);
}

/** The Stage subject that owns a surface: its Wall, Room or Region. */
function subjectKeyOfSurface(surface: SceneSurfaceRef): string {
	return surface.kind === 'wall-side'
		? `wall:${surface.wallId}`
		: surface.kind === 'region-face'
			? `region:${surface.regionId}`
			: `room:${surface.roomId}`;
}

export function createFinishCard(host: FinishCardHost) {
	/** The open target's reach choice; Card-local session state. */
	let focusKey = $state<string | null>(null);
	let openTarget = $state.raw<FinishCardTarget | null>(null);
	/** A surface the host asked the Card to open (a Paint click), until the Card shows it. */
	let requested = $state<string | null>(null);
	/** The surface whose More disclosure is open; it survives an install's remount. */
	let moreOpenFor = $state<string | null>(null);
	let choice = $state<FinishReachChoice | null>(null);
	let refusal = $state.raw<{ readonly targetKey: string; readonly message: string } | null>(null);
	let preview = $state.raw<FinishInstancePreview | null>(null);
	let busy = $state(false);
	let pendingPreview: { target: FinishCardTarget; edits: readonly FinishPatchEdit[] } | null = null;
	let frame: number | null = null;

	function inspect(target: FinishCardTarget): Inspected | { kind: 'none' | 'model-own'; targetKey: string } | null {
		const services = host.services();
		const shot = services?.stage.snapshot();
		if (services === null || services === undefined || shot === undefined) return null;
		const scene = shot.domain.scene;
		const targetKey = finishCardTargetKey(target);
		let key: string | null;
		let entity: SceneEntity | null = null;
		if (target.kind === 'entity') {
			entity = scene.entities.find((candidate) => candidate.id === target.entityId) ?? null;
			if (entity === null || !isFinishPaintable(entity)) return null;
			key = finishOf(entity, scene.materials);
		} else {
			const assignment = surfaceFinishFor(scene, target.surface);
			key = assignment === null ? null : finishKeyOfSurface(scene, assignment);
		}
		if (key === null) return { kind: 'none', targetKey };
		if (key === 'model-own') return { kind: 'model-own', targetKey };
		const ref = finishRefOfKey(key);
		if (ref === null || ref === 'model-own') return { kind: 'none', targetKey };
		const envelope = stageEnvelope(shot);
		const inspection = inspectFinish(envelope, ref, { labelForMaterial: (id) => host.labelForMaterial(id as MaterialId) });
		if (inspection === null) return { kind: 'none', targetKey };
		const instance: SceneMaterialInstance =
			'curated' in ref
				? { id: `curated:${ref.curated}`, name: host.labelForMaterial(ref.curated), base: { catalogue: ref.curated } }
				: (materialInstanceById(scene.materials, ref.project) as SceneMaterialInstance);
		return {
			target,
			targetKey,
			ref,
			finishKey: key,
			instance,
			users: inspection.users,
			palette: scene.palette ?? [],
			recipes: scene.materialIndex?.definitions ?? new Map(),
			entityKind: entity === null ? null : (entity.kind as 'primitive' | 'form' | 'model')
		};
	}

	function choiceFor(inspected: Inspected): FinishReachChoice {
		return focusKey === inspected.targetKey && choice !== null ? choice : defaultReach('curated' in inspected.ref);
	}

	function planOf(inspected: Inspected): FinishWritePlan {
		return finishWritePlan(
			{ curated: 'curated' in inspected.ref, users: inspected.users.map((user) => user.key), targetKey: inspected.targetKey },
			choiceFor(inspected)
		);
	}

	function sourceOf(inspected: Inspected): FinishSource {
		return { base: inspected.instance.base, overrides: inspected.instance.overrides };
	}

	function materialLabelOf(inspected: Inspected): string {
		const base = inspected.instance.base;
		return 'catalogue' in base ? host.labelForMaterial(base.catalogue as MaterialId) : 'Imported material';
	}

	function reachOf(inspected: Inspected, label: string): FinishCardReach {
		const users = inspected.users.map((user) => user.key);
		const curated = 'curated' in inspected.ref;
		const current = choiceFor(inspected);
		const word = finishTargetWord(inspected.target);
		if (users.length <= 1) {
			return { users: users.length, line: `On ${label} · only here`, shared: false, options: null, choice: current, keepNote: null };
		}
		const sameKind = users.filter((key) => userKind(key) === userKind(inspected.targetKey));
		const others = users.length - sameKind.length;
		const line = `Shared by ${users.length}`;
		if (curated && sameKind.length <= 1) {
			// Nothing of this kind to reach: the edit is this user's alone.
			return { users: users.length, line, shared: true, options: null, choice: 'this', keepNote: null };
		}
		const count = curated ? sameKind.length : users.length;
		const otherNoun = userKind(inspected.targetKey) === 'entity' ? ['wall or floor', 'walls and floors'] : ['object', 'objects'];
		const keepNote =
			curated && others > 0 && current === 'all'
				? `${others} ${others === 1 ? otherNoun[0] : otherNoun[1]} ${others === 1 ? 'keeps' : 'keep'} ${materialLabelOf(inspected)}.`
				: null;
		return {
			users: users.length,
			line,
			shared: true,
			options: {
				thisLabel: `This ${word}`,
				allLabel: `All ${count}`,
				allTitle: curated
					? `Every ${userKind(inspected.targetKey) === 'entity' ? 'object' : 'wall and floor'} using ${materialLabelOf(inspected)} gets one new Finish — cobalt on the Stage`
					: 'Every user of this Finish changes — cobalt on the Stage'
			},
			choice: current,
			keepNote
		};
	}

	function colourOf(inspected: Inspected): FinishCardColour {
		const source = sourceOf(inspected);
		const hasImage = finishHasColourImage(source, inspected.recipes);
		const mode = finishColourMode(source, inspected.recipes);
		const colour = mode === 'natural' ? null : (source.overrides?.color ?? null);
		const slot = colour !== null && typeof colour === 'object' ? inspected.palette.find((entry) => entry.id === colour.slot) : undefined;
		const hex = colour === null ? null : typeof colour === 'string' ? colour : (slot?.color ?? null);
		const caption = colour === null ? 'Original' : typeof colour === 'string' ? colour.toUpperCase() : `${slot?.name ?? 'Palette'} · palette`;
		return {
			modes: hasImage ? ['natural', 'stained', 'painted'] : ['natural', 'painted'],
			mode,
			colour,
			hex,
			caption,
			chips: inspected.palette.map((entry) => ({
				id: entry.id,
				name: entry.name,
				color: entry.color,
				active: colour !== null && typeof colour === 'object' && colour.slot === entry.id
			})),
			custom: typeof colour === 'string'
		};
	}

	function sheenOf(inspected: Inspected): FinishSheenReading & { readonly caption: string } {
		const reading = finishSheenReading(sourceOf(inspected), inspected.recipes, host.facts);
		const step = reading.steps.find((candidate) => candidate.id === reading.current);
		const caption = !reading.changed
			? 'Original'
			: step !== undefined
				? step.label
				: `Custom · r ${reading.effective.toFixed(2)}`;
		return { ...reading, caption: reading.scan.approximate && reading.changed ? `${caption} · approximate` : caption };
	}

	function patternOf(inspected: Inspected): FinishCardPattern | null {
		if (inspected.entityKind === 'model') return null;
		const source = sourceOf(inspected);
		const real = baseTileMeters(source, inspected.recipes);
		const mapping = mappingOf(source, inspected.recipes);
		const recipe = recipeOfSource(source, inspected.recipes);
		const textured = recipe === undefined || Object.keys(recipe.maps).length > 0 || Object.keys(source.overrides?.maps ?? {}).some((role) => source.overrides?.maps?.[role as 'color'] !== null);
		if (real === null || mapping === undefined || mapping.kind === 'uv' || !textured) return null;
		const tile = mapping.metric.tileMeters[0];
		const k = Math.log2(tile / real[0]);
		const exact = Math.abs(k - Math.round(k)) < 0.01;
		const step = exact ? Math.round(k) : null;
		const degrees = Math.round(((((mapping.metric.rotation * 180) / Math.PI) % 360) + 360) % 360);
		const size = step === 0 ? `Real size ${formatMeters(real[0])}` : `${formatMeters(tile)}${step !== null && RATIO[String(step)] ? ` · ${RATIO[String(step)]}× real` : ''}`;
		return {
			realMeters: real[0],
			tileMeters: tile,
			step,
			degrees,
			caption: degrees === 0 ? size : `${size} · ${degrees}°`,
			canSmaller: (step ?? Math.floor(k)) > -3,
			canLarger: (step ?? Math.ceil(k)) < 3
		};
	}

	/** One user's whole Finish reading for the Card. `label` names the target ("North wall · Inside"). */
	function view(target: FinishCardTarget, label: string): FinishCardView | null {
		const inspected = inspect(target);
		if (inspected === null) return null;
		if ('kind' in inspected && !('ref' in inspected)) {
			return inspected.kind === 'model-own'
				? { kind: 'model-own', targetKey: inspected.targetKey, message: "A model's own materials take no edits. Paint a material first." }
				: { kind: 'none', targetKey: inspected.targetKey, message: 'No Finish here yet. Paint a material first.' };
		}
		const found = inspected as Inspected;
		const curated = 'curated' in found.ref;
		const source = sourceOf(found);
		const catalogueId = 'catalogue' in source.base ? (source.base.catalogue as MaterialId) : null;
		const materialLabel = materialLabelOf(found);
		const sheen = sheenOf(found);
		const pattern = patternOf(found);
		const mapping = mappingOf(source, found.recipes);
		const effectiveMetal = source.overrides?.metalness ?? recipeOfSource(source, found.recipes)?.metalness ?? 0;
		const users = found.users.length;
		const resetCount = curated ? 0 : editsToward(source.overrides, undefined).length;
		return {
			kind: 'finish',
			targetKey: found.targetKey,
			finishKey: found.finishKey,
			ref: found.ref,
			curated,
			name: found.instance.name,
			canRename: !curated,
			renameTitle: curated ? 'Curated names stay fixed — your first change makes a Finish you can rename' : 'Rename (Enter)',
			meta: curated
				? `Curated material · ${plural(users, 'use')}`
				: `Project Finish · from ${materialLabel} · ${plural(users, 'use')}`,
			tile: {
				source: curated && catalogueId !== null ? { kind: 'catalogue', id: catalogueId } : null,
				color:
					colourOf(found).hex ??
					(catalogueId !== null ? (host.swatchOf?.(catalogueId) ?? '#c4b4a0') : (recipeOfSource(source, found.recipes)?.color ?? '#c4b4a0'))
			},
			material: { label: materialLabel, catalogueId, swappable: true },
			reach: reachOf(found, label),
			colour: colourOf(found),
			sheen,
			pattern,
			align:
				target.kind === 'surface' && target.surface.kind === 'wall-side'
					? { kind: 'wall', label: 'Align on wall…' }
					: target.kind === 'surface' && target.surface.kind === 'room-floor'
						? { kind: 'floor', label: 'Align on floor…' }
						: null,
			more: {
				roughness: sheen.effective,
				roughnessMax: Math.min(1, sheen.scan.mean),
				metal: effectiveMetal >= 0.5,
				tileMeters: mapping !== undefined && mapping.kind !== 'uv' && found.entityKind !== 'model' ? mapping.metric.tileMeters[0] : null,
				degrees: mapping !== undefined && mapping.kind !== 'uv' && found.entityKind !== 'model' ? pattern?.degrees ?? Math.round((mapping.metric.rotation * 180) / Math.PI) : null,
				canReplaceImage: target.kind === 'entity' && host.replaceImage !== undefined
			},
			resetCount,
			favourite: host.isFavourite?.(found.finishKey) ?? false
		};
	}

	// ---------------------------------------------------------------- focus

	/** The Card opened another user (or closed): reach, gesture and refusal reset. */
	function focus(target: FinishCardTarget | null): void {
		const key = target === null ? null : finishCardTargetKey(target);
		if (key === focusKey) return;
		cancel();
		focusKey = key;
		openTarget = target;
		choice = null;
		refusal = null;
	}

	function setReach(target: FinishCardTarget, next: FinishReachChoice): void {
		const key = finishCardTargetKey(target);
		if (focusKey !== key) focus(target);
		// A reach switch mid-gesture cancels it: the preview showed the old reach.
		cancel();
		choice = next;
		refusal = null;
	}

	function refusalFor(target: FinishCardTarget): string | null {
		return refusal !== null && refusal.targetKey === finishCardTargetKey(target) ? refusal.message : null;
	}

	/** The users *All* adds, outlined in cobalt on the Stage while it is chosen. */
	function proposals(target: FinishCardTarget | null): { readonly entityIds: readonly string[]; readonly surfaces: readonly SceneSurfaceRef[] } {
		const empty = { entityIds: [], surfaces: [] };
		if (target === null) return empty;
		const inspected = inspect(target);
		if (inspected === null || !('ref' in inspected)) return empty;
		const found = inspected as Inspected;
		if (found.users.length <= 1 || choiceFor(found) !== 'all') return empty;
		const reached = new Set(planOf(found).reached);
		reached.delete(found.targetKey);
		const entityIds: string[] = [];
		const surfaces: SceneSurfaceRef[] = [];
		for (const user of found.users) {
			if (!reached.has(user.key)) continue;
			if (user.kind === 'entity') entityIds.push(user.entityId);
			else if (user.lifecycle === 'present') surfaces.push(user.surface);
		}
		return { entityIds, surfaces };
	}

	/**
	 * The open target's proposals as Stage ink entries: objects by entity, surfaces
	 * by their owning Wall or Room (an approximation of one side or floor). The open
	 * target's own subject is never re-inked: it already carries the gold selection.
	 */
	function proposalEntries(): readonly StageSelectionEntry[] {
		const services = host.services();
		if (services === null || openTarget === null) return [];
		const found = proposals(openTarget);
		if (found.entityIds.length === 0 && found.surfaces.length === 0) return [];
		const shot = services.stage.snapshot();
		const own = openTarget.kind === 'entity' ? `scene:${openTarget.entityId}` : subjectKeyOfSurface(openTarget.surface);
		const seen = new Set<string>([own]);
		const entries: StageSelectionEntry[] = [];
		for (const entityId of found.entityIds) {
			if (seen.has(`scene:${entityId}`)) continue;
			seen.add(`scene:${entityId}`);
			entries.push({
				reference: {
					version: 1,
					domain: 'scene',
					revision: { kind: 'exact', contentRevision: shot.domain.unitRevisions.scene },
					subject: { kind: 'entity', id: entityId },
					instancePath: [],
					location: { kind: 'project-root' },
					componentId: null,
					capabilityId: null
				}
			});
		}
		for (const surface of found.surfaces) {
			const key = subjectKeyOfSurface(surface);
			if (seen.has(key)) continue;
			seen.add(key);
			entries.push({ reference: { ...layoutSurfaceTarget(shot, surface), componentId: null } });
		}
		return entries;
	}

	// ---------------------------------------------------------------- writes

	/**
	 * An install rebinds the adapters and remounts the Card, which forgets which
	 * surface was open. The surface the creator just edited asks to stay open; the
	 * request is consumed only by a Card that lists it, like a Paint click's.
	 */
	function reopenAfterInstall(targetKey: string): void {
		requested = targetKey;
	}

	async function write(
		target: FinishCardTarget,
		build: (inspected: Inspected) => { readonly edits: readonly FinishPatchEdit[]; readonly base?: { readonly catalogue: MaterialId } } | null
	): Promise<boolean> {
		clearPreview();
		const services = host.services();
		const inspected = inspect(target);
		if (services === null || inspected === null || !('ref' in inspected)) return false;
		const found = inspected as Inspected;
		const built = build(found);
		if (built === null || (built.edits.length === 0 && built.base === undefined)) return false;
		const plan = planOf(found);
		busy = true;
		try {
			const outcome = await services.authoring.accept({
				version: 1,
				kind: 'scene-finish-patch',
				operationId: crypto.randomUUID(),
				expectedRevision: services.stage.snapshot().acceptedRevision,
				targets: [],
				payload: {
					finish: found.ref,
					edits: built.edits,
					mode: plan.mode,
					selectedUsers: plan.selectedUsers,
					expectedUsers: found.users.map((user) => user.key),
					...(built.base === undefined ? {} : { base: built.base })
				} as never,
				capturedInputs: [],
				allocatedIds: plan.allocates ? [{ kind: 'scene-finish', id: crypto.randomUUID() }] : []
			});
			if (outcome.kind === 'installed') {
				refusal = null;
				reopenAfterInstall(found.targetKey);
				host.onAccepted?.(found.finishKey);
				return true;
			}
			if (outcome.kind === 'refused') {
				if (outcome.code === 'no-change' || outcome.reason === 'no-change') return false;
				if (outcome.code === 'stale-reach' || outcome.reason === 'stale-reach') {
					const latest = inspect(target);
					const count = latest !== null && 'ref' in latest ? (latest as Inspected).users.length : 0;
					choice = null;
					refusal = { targetKey: found.targetKey, message: `Now used by ${count} — reach updated. Nothing changed.` };
					return false;
				}
				refusal = { targetKey: found.targetKey, message: outcome.message ?? 'That change could not be made.' };
			}
			return false;
		} finally {
			busy = false;
		}
	}

	/** One completed control: a list of typed edits, one patch, one Undo. */
	function edit(target: FinishCardTarget, edits: (source: FinishSource, recipes: ReadonlyMap<string, Recipe>) => readonly FinishPatchEdit[]): Promise<boolean> {
		return write(target, (inspected) => ({ edits: edits(sourceOf(inspected), inspected.recipes) }));
	}

	function setColourMode(target: FinishCardTarget, mode: FinishColourMode): Promise<boolean> {
		return write(target, (inspected) => {
			const source = sourceOf(inspected);
			if (mode === 'natural') return { edits: colourModeEdits(source, 'natural', null, inspected.recipes) };
			const current = finishColourMode(source, inspected.recipes) === 'natural' ? null : (source.overrides?.color ?? null);
			const fallback: SceneColor = inspected.palette[0] !== undefined ? { slot: inspected.palette[0].id } : '#9aa58c';
			return { edits: colourModeEdits(source, mode, current ?? fallback, inspected.recipes) };
		});
	}

	/** The mode a colour pick writes: the current one, or the family default from Natural. */
	function pickMode(inspected: Inspected): Exclude<FinishColourMode, 'natural'> {
		const source = sourceOf(inspected);
		const mode = finishColourMode(source, inspected.recipes);
		return mode === 'natural' ? defaultColourMode(source, inspected.recipes, host.facts) : mode;
	}

	function colourEdits(inspected: Inspected, colour: SceneColor): FinishPatchEdit[] {
		return colourModeEdits(sourceOf(inspected), pickMode(inspected), colour, inspected.recipes);
	}

	function setColour(target: FinishCardTarget, colour: SceneColor): Promise<boolean> {
		return write(target, (inspected) => ({ edits: colourEdits(inspected, colour) }));
	}

	function setSheen(target: FinishCardTarget, id: SheenStepId): Promise<boolean> {
		return write(target, (inspected) => ({
			edits: sheenStepEdits(finishSheenReading(sourceOf(inspected), inspected.recipes, host.facts), id)
		}));
	}

	/** More › Roughness: the effective value; the factor is effective ÷ the scanned mean. */
	function roughnessEdits(inspected: Inspected, effective: number): FinishPatchEdit[] {
		const source = sourceOf(inspected);
		const mean = finishSheenReading(source, inspected.recipes, host.facts).scan.mean;
		return factorEdits(source, inspected.recipes, 'roughness', Math.min(1, Math.max(0, effective / mean)));
	}

	function setRoughness(target: FinishCardTarget, effective: number): Promise<boolean> {
		return write(target, (inspected) => ({ edits: roughnessEdits(inspected, effective) }));
	}

	function setMetal(target: FinishCardTarget, on: boolean): Promise<boolean> {
		return write(target, (inspected) => ({ edits: factorEdits(sourceOf(inspected), inspected.recipes, 'metalness', on ? 1 : 0) }));
	}

	function metricMapping(inspected: Inspected, change: (metric: { tileMeters: [number, number]; rotation: number; offset: [number, number] }) => void): FinishPatchEdit[] {
		const source = sourceOf(inspected);
		const mapping = mappingOf(source, inspected.recipes);
		if (mapping === undefined || mapping.kind === 'uv') return [];
		const metric = {
			tileMeters: [mapping.metric.tileMeters[0], mapping.metric.tileMeters[1]] as [number, number],
			rotation: mapping.metric.rotation,
			offset: [mapping.metric.offset[0], mapping.metric.offset[1]] as [number, number]
		};
		change(metric);
		return mappingEdits(source, inspected.recipes, { kind: mapping.kind, metric } as Mapping);
	}

	/** Pattern −/+: the next ½× / 2× step of the base's real size, kept square to its aspect. */
	function stepPattern(target: FinishCardTarget, direction: -1 | 1): Promise<boolean> {
		return write(target, (inspected) => {
			const source = sourceOf(inspected);
			const real = baseTileMeters(source, inspected.recipes);
			const pattern = patternOf(inspected);
			if (real === null || pattern === null) return null;
			const k = Math.log2(pattern.tileMeters / real[0]);
			const exact = Math.abs(k - Math.round(k)) < 0.01;
			const next = Math.max(-3, Math.min(3, exact ? Math.round(k) + direction : direction < 0 ? Math.floor(k) : Math.ceil(k)));
			const scale = 2 ** next;
			return {
				edits: metricMapping(inspected, (metric) => {
					metric.tileMeters = [Number((real[0] * scale).toFixed(4)), Number((real[1] * scale).toFixed(4))];
				})
			};
		});
	}

	function setTileSize(target: FinishCardTarget, meters: number): Promise<boolean> {
		if (!Number.isFinite(meters) || meters <= 0) return Promise.resolve(false);
		return write(target, (inspected) => ({
			edits: metricMapping(inspected, (metric) => {
				const aspect = metric.tileMeters[1] / metric.tileMeters[0];
				metric.tileMeters = [meters, Number((meters * aspect).toFixed(4))];
			})
		}));
	}

	function setDirection(target: FinishCardTarget, degrees: number): Promise<boolean> {
		if (!Number.isFinite(degrees)) return Promise.resolve(false);
		return write(target, (inspected) => ({
			edits: metricMapping(inspected, (metric) => {
				metric.rotation = ((((degrees % 360) + 360) % 360) * Math.PI) / 180;
			})
		}));
	}

	function turnPattern(target: FinishCardTarget): Promise<boolean> {
		const current = view(target, '');
		const degrees = current?.kind === 'finish' ? (current.pattern?.degrees ?? 0) : 0;
		return setDirection(target, (degrees + 90) % 360);
	}

	/** Swap: one patch with the new base and the carried-over treatment. */
	function swap(target: FinishCardTarget, materialId: MaterialId): Promise<boolean> {
		return write(target, (inspected) => {
			const base = { catalogue: materialId } as const;
			return { edits: swapEdits(sourceOf(inspected), base, inspected.recipes, host.facts), base };
		});
	}

	function resetToOriginal(target: FinishCardTarget): Promise<boolean> {
		return write(target, (inspected) => ({ edits: editsToward(inspected.instance.overrides, undefined) }));
	}

	/** Give this surface/object its own independent copy (`derive` with `identity: 'fresh'`). */
	async function giveOwnCopy(target: FinishCardTarget): Promise<boolean> {
		const services = host.services();
		const inspected = inspect(target);
		if (services === null || inspected === null || !('ref' in inspected)) return false;
		const found = inspected as Inspected;
		if ('curated' in found.ref || found.users.length < 2) return false;
		clearPreview();
		busy = true;
		try {
			const shot = services.stage.snapshot();
			const freshId = `finish:${crypto.randomUUID()}`;
			const isEntity = target.kind === 'entity';
			const intentTarget = isEntity
				? {
						version: 1 as const,
						domain: 'scene' as const,
						revision: { kind: 'exact' as const, contentRevision: stageEnvelope(shot).units.scene.header.contentRevision },
						subject: { kind: 'entity' as const, id: target.entityId },
						instancePath: [],
						location: { kind: 'project-root' as const },
						componentId: null,
						capabilityId: null
					}
				: layoutSurfaceTarget(shot, target.surface);
			if (intentTarget === null) return false;
			const outcome = await services.authoring.accept({
				version: 1,
				kind: isEntity ? SCENE_FINISH_ASSIGN : SCENE_SURFACE_FINISH_ASSIGN,
				operationId: crypto.randomUUID(),
				expectedRevision: shot.acceptedRevision,
				targets: [intentTarget],
				payload: (isEntity
					? { finish: found.ref, entityIds: [target.entityId], derive: { edits: [], identity: 'fresh' } }
					: { finish: found.ref, surfaces: [target.surface], derive: { edits: [], identity: 'fresh' } }) as never,
				capturedInputs: [],
				allocatedIds: [{ kind: 'scene-finish', id: freshId }]
			});
			if (outcome.kind === 'installed') {
				refusal = null;
				reopenAfterInstall(found.targetKey);
				host.onAccepted?.(`project:${freshId}`);
				host.onOwnCopy?.();
				return true;
			}
			if (outcome.kind === 'refused') {
				refusal = { targetKey: found.targetKey, message: outcome.message ?? 'Could not make a separate copy.' };
			}
			return false;
		} finally {
			busy = false;
		}
	}

	/** Select all users of this Finish and set reach to All. */
	async function selectAllUsers(target: FinishCardTarget): Promise<boolean> {
		const inspected = inspect(target);
		if (inspected === null || !('ref' in inspected)) return false;
		const found = inspected as Inspected;
		if (found.users.length < 2) return false;
		setReach(target, 'all');
		return (await host.selectFinishUsers?.(found.ref)) ?? false;
	}

	/** Rename a project Finish; curated names stay fixed. */
	async function rename(target: FinishCardTarget, name: string): Promise<boolean> {
		const services = host.services();
		const inspected = inspect(target);
		if (services === null || inspected === null || !('ref' in inspected)) return false;
		const found = inspected as Inspected;
		if (!('project' in found.ref)) return false;
		const trimmed = name.trim();
		if (trimmed.length === 0 || trimmed.length > FINISH_NAME_MAX_LENGTH) {
			refusal = { targetKey: found.targetKey, message: `A Finish name must be 1-${FINISH_NAME_MAX_LENGTH} characters.` };
			return false;
		}
		if (trimmed === found.instance.name) return true;
		const outcome = await services.authoring.accept({
			version: 1,
			kind: 'scene-finish-rename',
			operationId: crypto.randomUUID(),
			expectedRevision: services.stage.snapshot().acceptedRevision,
			targets: [],
			payload: { finish: found.ref, name: trimmed } as never,
			capturedInputs: [],
			allocatedIds: []
		});
		if (outcome.kind === 'installed') {
			refusal = null;
			reopenAfterInstall(found.targetKey);
			return true;
		}
		if (outcome.kind === 'refused' && outcome.code !== 'no-change' && outcome.reason !== 'no-change') {
			refusal = { targetKey: found.targetKey, message: outcome.message ?? 'That name could not be used.' };
		}
		return false;
	}

	function replaceImage(target: FinishCardTarget, file: File): Promise<void> {
		if (target.kind !== 'entity' || host.replaceImage === undefined) return Promise.resolve();
		const inspected = inspect(target);
		if (inspected === null || !('ref' in inspected)) return Promise.resolve();
		const found = inspected as Inspected;
		const plan = planOf(found);
		// The From-image flow names one object's reach: a D5 subset it cannot
		// express narrows to *This*.
		const mode = plan.mode === 'just-this' && plan.selectedUsers.length > 1 ? 'just-this' : plan.mode;
		return host.replaceImage(target.entityId, file, found.users.length <= 1 && 'curated' in found.ref ? 'just-this' : mode);
	}

	// ---------------------------------------------------------------- preview

	function clearPreview(): void {
		pendingPreview = null;
		if (frame !== null) {
			cancelAnimationFrame(frame);
			frame = null;
		}
		if (preview !== null) preview = null;
	}

	function flushPreview(): void {
		frame = null;
		const pending = pendingPreview;
		pendingPreview = null;
		if (pending === null) return;
		const inspected = inspect(pending.target);
		// Dragged back to the accepted value (or the target vanished): show the
		// accepted Finish, not the last value the drag passed through.
		if (inspected === null || !('ref' in inspected)) {
			preview = null;
			return;
		}
		const found = inspected as Inspected;
		const result = applyFinishPatch(found.instance, pending.edits, baseRecipeOf(found.instance, found.recipes));
		if (!result.ok) {
			preview = null;
			return;
		}
		preview = { users: planOf(found).reached, instance: result.instance };
	}

	function schedulePreview(target: FinishCardTarget, edits: (inspected: Inspected) => readonly FinishPatchEdit[]): void {
		const inspected = inspect(target);
		if (inspected === null || !('ref' in inspected)) return;
		pendingPreview = { target, edits: edits(inspected as Inspected) };
		if (frame === null) {
			frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(flushPreview) : null;
			if (frame === null) flushPreview();
		}
	}

	/** Generic render-only preview over any typed Finish patch (reused by editor and Align). */
	function previewEdits(
		target: FinishCardTarget,
		edits: (source: FinishSource, recipes: ReadonlyMap<string, Recipe>) => readonly FinishPatchEdit[]
	): void {
		schedulePreview(target, (inspected) => edits(sourceOf(inspected), inspected.recipes));
	}

	/** A colour gesture in progress (the wheel): preview only. */
	function previewColour(target: FinishCardTarget, colour: SceneColor): void {
		schedulePreview(target, (inspected) => colourEdits(inspected, colour));
	}

	function previewRoughness(target: FinishCardTarget, effective: number): void {
		schedulePreview(target, (inspected) => roughnessEdits(inspected, effective));
	}

	/** Esc, pointercancel, blur, a selection change: drop the gesture; nothing is written. */
	function cancel(): boolean {
		const had = preview !== null || pendingPreview !== null;
		clearPreview();
		return had;
	}

	return {
		get preview() {
			return preview;
		},
		get busy() {
			return busy;
		},
		get gestureActive() {
			return preview !== null || pendingPreview !== null;
		},
		view,
		focus,
		setReach,
		refusalFor,
		proposals,
		proposalEntries,
		get openTarget() {
			return openTarget;
		},
		/** The host asks the Card to open this user once it lists it. */
		get moreOpenFor() {
			return moreOpenFor;
		},
		setMoreOpen(targetKey: string | null): void {
			moreOpenFor = targetKey;
		},
		requestOpen(target: FinishCardTarget): void {
			requested = finishCardTargetKey(target);
		},
		get requested() {
			return requested;
		},
		clearRequest(): void {
			requested = null;
		},
		edit,
		setColourMode,
		setColour,
		setSheen,
		setRoughness,
		setMetal,
		stepPattern,
		turnPattern,
		setTileSize,
		setDirection,
		swap,
		resetToOriginal,
		giveOwnCopy,
		selectAllUsers,
		rename,
		replaceImage,
		previewEdits,
		previewColour,
		previewRoughness,
		cancel,
		inspectedOf(target: FinishCardTarget) {
			const found = inspect(target);
			if (found === null || !('ref' in found)) return null;
			return { ...found, reach: choiceFor(found) };
		},
		toggleFavourite: (finishKey: string) => host.toggleFavourite?.(finishKey),
		surfaceKeyOf: (surface: SceneSurfaceRef) => surfaceKey(surface)
	};
}

export type FinishCard = ReturnType<typeof createFinishCard>;
