/**
 * Object Studio — the pure session model.
 *
 * Studio is a **posture** over the existing Stage, Scene and F4 history: a scope
 * on which entity the creator is editing and which context surrounds it. It owns
 * no source, no selection, no Camera and no history, and nothing here is ever
 * serialized. This module is the data and the rules; `studio-controller.svelte.ts`
 * holds the one session value and `StudioScopeStrip`/`StudioPanel` present it.
 */

/** The entities Studio can scope: the minimal shape it reads of a Scene entity. */
export type StudioEntityRead = {
	readonly id: string;
	readonly name: string;
	readonly kind: string;
};

/** A root Studio can edit. The first capability is native forms only. */
export type StudioRoot = {
	readonly id: string;
	readonly name: string;
};

/** Where the creator came from, which decides what "return" means. */
export type StudioOrigin = 'world' | 'standalone';

/** What surrounds the scoped object: the muted World, or the bare mat. */
export type StudioContext = 'world' | 'mat';

/**
 * What the pick path may reach. `entityId: null` reaches nothing — the datum
 * still supports a new form, but no existing subject can be picked.
 */
export type StudioPickScope = { readonly entityId: string | null };

/** Why a requested or scoped root cannot be edited. */
export type StudioUnavailableReason = 'missing' | 'unsupported';

/**
 * The named states Studio can be in. Every one is distinct and shown in words:
 * none is folded into another and none is inferred from a name.
 */
export type StudioPhase =
	| { readonly kind: 'inactive' }
	| { readonly kind: 'active'; readonly rootId: string }
	/** Studio mat with Objects ready and no root yet (new project, or New object here). */
	| { readonly kind: 'empty' }
	| { readonly kind: 'choose'; readonly roots: readonly StudioRoot[] }
	| { readonly kind: 'no-objects' }
	| {
			readonly kind: 'unavailable';
			readonly requestedId: string;
			readonly reason: StudioUnavailableReason;
			/** The scoped root was removed (Undo/delete) rather than never present. */
			readonly lost: boolean;
	  };

/** The World tools Studio offers: the rest of the dock stays in the World. */
export const STUDIO_WORLD_TOOLS: readonly string[] = ['select', 'objects', 'measure', 'erase'];

export function isStudioWorldTool(id: string): boolean {
	return STUDIO_WORLD_TOOLS.includes(id);
}

/**
 * The operations Object Studio offers, by owning adapter and operation id: placing a
 * form, the root's own Compose commands (resize, duplicate, delete), Measure and the
 * Eraser. Everything else — Layout, Lights, model import, Paint, Slice — stays in the
 * World. These are the contributed task ids of the Scene adapter and the host tools;
 * the facade that opens operations refuses the rest, and a test pins each spelling to
 * its owner's constant so a rename cannot silently widen the scope.
 */
const STUDIO_OPERATIONS: ReadonlySet<string> = new Set([
	'scene:scene-place',
	'scene:scene-compose',
	'host:host-measure',
	'host:host-erase'
]);

export function isStudioOperation(adapterId: string, id: string): boolean {
	return STUDIO_OPERATIONS.has(`${adapterId}:${id}`);
}

/**
 * The Card actions Object Studio offers a subject: only the Scene's own, and never on
 * the root being edited (Duplicate and Delete would end or fork the session's subject;
 * the root leaves Studio only through its own return paths). With no root, none.
 */
export function studioAdmitsCardAction(rootId: string | null, adapterId: string, subjectId: string): boolean {
	return rootId !== null && adapterId === 'scene' && subjectId !== rootId;
}

/** Eligible roots, in source order. Imported models and primitives are not forms. */
export function studioRoots(entities: readonly StudioEntityRead[]): readonly StudioRoot[] {
	return entities
		.filter((entity) => entity.kind === 'form')
		.map((entity) => ({ id: entity.id, name: entity.name }));
}

export type StudioOpening =
	| { readonly kind: 'enter'; readonly rootId: string }
	| { readonly kind: 'empty' }
	| { readonly kind: 'choose'; readonly roots: readonly StudioRoot[] }
	| { readonly kind: 'no-objects' }
	| {
			readonly kind: 'unavailable';
			readonly requestedId: string;
			readonly reason: StudioUnavailableReason;
	  };

/**
 * Decide how a loaded project opens in Studio. Pure and total.
 *
 * - An explicit target is honored or named unavailable; it never falls back to a
 *   different object by name or array order.
 * - With no target, exactly one eligible root enters; several ask which; none is
 *   `empty` for a freshly minted project and `no-objects` for a saved one.
 */
export function resolveStudioOpening(input: {
	readonly entities: readonly StudioEntityRead[];
	readonly requestedId: string | null;
	/** The identity was minted by this very navigation (`create=1`). */
	readonly minted: boolean;
}): StudioOpening {
	const roots = studioRoots(input.entities);
	if (input.requestedId !== null) {
		if (roots.some((root) => root.id === input.requestedId)) {
			return { kind: 'enter', rootId: input.requestedId };
		}
		const exists = input.entities.some((entity) => entity.id === input.requestedId);
		return {
			kind: 'unavailable',
			requestedId: input.requestedId,
			reason: exists ? 'unsupported' : 'missing'
		};
	}
	if (roots.length === 1) return { kind: 'enter', rootId: roots[0]!.id };
	if (roots.length > 1) return { kind: 'choose', roots };
	return input.minted ? { kind: 'empty' } : { kind: 'no-objects' };
}

/** The pick scope a phase implies; `null` means Studio does not scope picking. */
export function pickScopeOf(phase: StudioPhase): StudioPickScope | null {
	switch (phase.kind) {
		case 'inactive':
			return null;
		case 'active':
			return { entityId: phase.rootId };
		default:
			return { entityId: null };
	}
}

/**
 * The creation baseline: ids that existed when a creation task began, so the first
 * accepted form that is *not* among them is the new root.
 */
export function newRootSince(
	entities: readonly StudioEntityRead[],
	baseline: ReadonlySet<string>
): StudioRoot | null {
	const created = studioRoots(entities).filter((root) => !baseline.has(root.id));
	return created.length === 0 ? null : created[created.length - 1]!;
}

/** The viewing intent to realize on return: a session value, never a ticket. */
export type StudioViewRecord = {
	readonly reading: '3d' | 'plan';
	readonly eye: readonly [number, number, number];
	readonly target: readonly [number, number, number];
	readonly fovYDegrees: number;
	readonly targetPlaneHeightMeters: number;
};

type Box = { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] };

const finite3 = (value: readonly number[]): boolean =>
	value.length === 3 && value.every((component) => Number.isFinite(component));

/**
 * Revalidate a saved viewing intent against the **current** content.
 *
 * Source edits can move or delete what the record looked at. The record is only
 * a request: it is refused unless it is finite and its target still lies near
 * today's content, and a refusal falls back to Fit rather than a stale pose.
 */
export function reviewReturnView(
	record: StudioViewRecord | null,
	bounds: Box | null
): { readonly valid: true } | { readonly valid: false; readonly reason: string } {
	if (record === null) return { valid: false, reason: 'No view was saved.' };
	if (!finite3(record.eye) || !finite3(record.target) || !Number.isFinite(record.fovYDegrees)) {
		return { valid: false, reason: 'The saved view is not usable.' };
	}
	if (bounds !== null) {
		const extent = Math.max(
			bounds.max[0] - bounds.min[0],
			bounds.max[1] - bounds.min[1],
			bounds.max[2] - bounds.min[2],
			1
		);
		const margin = Math.max(10, extent * 2);
		for (let axis = 0; axis < 3; axis += 1) {
			if (
				record.target[axis]! < bounds.min[axis]! - margin ||
				record.target[axis]! > bounds.max[axis]! + margin
			) {
				return { valid: false, reason: 'The saved view no longer looks at the work.' };
			}
		}
	}
	return { valid: true };
}
