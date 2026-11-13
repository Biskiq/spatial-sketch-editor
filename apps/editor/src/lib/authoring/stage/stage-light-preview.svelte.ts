/**
 * T2 gallery UX recovery — the one session-only light preview.
 *
 * A lighting gesture must be seen as light before it is committed. The Stage
 * session owns this transient value: an overridden light replaces the accepted
 * entity for the shared renderer, and a placement candidate is appended under
 * one reserved session id. It is never authored, never saved, never selected,
 * never in history and never in a release payload; the editor Stage shell merges
 * it, and no visitor chunk imports it.
 */
import type { RuntimeScene, SceneLightEntity } from '@portfolio/project-model';

/** The reserved id a placement candidate renders under. Never persisted. */
export const LIGHT_PREVIEW_CANDIDATE_ID = 'stage-light-preview:candidate';

export type StageLightPreview = {
	/** The current overrides, keyed by the accepted entity id. */
	readonly overrides: ReadonlyMap<string, SceneLightEntity>;
	/** The placement candidate, or `null`. */
	readonly candidate: SceneLightEntity | null;
	setOverride(id: string, light: SceneLightEntity): void;
	clearOverride(id: string): void;
	setCandidate(light: SceneLightEntity | null): void;
	/** Drop every preview value. */
	clear(): void;
	/** Apply a coalesced write now; release calls this before it commits. */
	flush(): void;
};

/**
 * Create one session preview.
 *
 * Writes coalesce to one animation frame: later moves in a frame replace
 * earlier ones, so a pointer stream cannot rebuild the renderer once per event.
 * In a non-browser host (unit tests) the write is immediate.
 */
export function createStageLightPreview(): StageLightPreview {
	let overrides = $state<ReadonlyMap<string, SceneLightEntity>>(new Map());
	let candidate = $state<SceneLightEntity | null>(null);
	let pending: (() => void) | null = null;
	let frame: number | null = null;

	function apply(write: () => void): void {
		if (typeof requestAnimationFrame === 'undefined') {
			write();
			return;
		}
		pending = write;
		if (frame !== null) return;
		frame = requestAnimationFrame(() => {
			frame = null;
			const run = pending;
			pending = null;
			run?.();
		});
	}

	return {
		get overrides() {
			return overrides;
		},
		get candidate() {
			return candidate;
		},
		setOverride(id, light) {
			apply(() => {
				const next = new Map(overrides);
				next.set(id, light);
				overrides = next;
			});
		},
		clearOverride(id) {
			apply(() => {
				if (!overrides.has(id)) return;
				const next = new Map(overrides);
				next.delete(id);
				overrides = next;
			});
		},
		setCandidate(light) {
			apply(() => {
				candidate = light;
			});
		},
		clear() {
			pending = null;
			overrides = new Map();
			candidate = null;
		},
		flush() {
			if (frame !== null && typeof cancelAnimationFrame !== 'undefined') {
				cancelAnimationFrame(frame);
				frame = null;
			}
			const run = pending;
			pending = null;
			run?.();
		}
	};
}

/**
 * The Scene the shared renderer receives: accepted entities with overridden
 * lights replaced, plus the candidate under its reserved session id.
 *
 * Pure and read-only. The accepted `scene` is never mutated, so the preview
 * cannot reach persistence through a shared array.
 */
export function mergeLightPreview(
	scene: RuntimeScene,
	preview: Pick<StageLightPreview, 'overrides' | 'candidate'> | null
): RuntimeScene {
	if (preview === null) return scene;
	if (preview.overrides.size === 0 && preview.candidate === null) return scene;
	const entities = scene.entities.map(
		(entity) => preview.overrides.get(entity.id) ?? entity
	);
	if (preview.candidate !== null) {
		entities.push({ ...preview.candidate, id: LIGHT_PREVIEW_CANDIDATE_ID });
	}
	return { ...scene, entities };
}
