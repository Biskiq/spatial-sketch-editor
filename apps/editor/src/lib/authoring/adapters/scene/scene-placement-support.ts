/**
 * The Scene placement reading identity, surface registry, canonical references
 * and Compose support readings.
 *
 * These are readings over accepted Scene state. The placement session owns the
 * gesture lease and the candidate; nothing here mutates it.
 */
import { floorTransformSupport } from '@portfolio/project-model/scene-planning';
import type { SceneEntity, Vec3 } from '@portfolio/project-model/scene';
import type { FrameReference, SemanticReference } from '@portfolio/project-model/references';
import type { ViewportEvaluation } from '@portfolio/camera-core/viewport';
import { evaluateFormMesh } from '$lib/content/form-evaluation';
import type { ScenePlacementSession } from './placement';

export type SceneSurface = {
	/** The reading this surface's candidate was prepared for. */
	readonly reading: string;
	readonly session: ScenePlacementSession;
};

/**
 * The stable identity of one **reading**.
 *
 * The evaluation token's `evaluationGeneration` advances on every frame the
 * Stage draws, so an id that carries it names one frame, not one reading. A
 * proposal spans many frames — it is prepared, redrawn and redrawn again before
 * it is committed — so surfaces, and the sessions that hold proposals, are keyed
 * by this: the output, the host session, the accepted source revision and the
 * settled reading. A genuine reading change (Plan↔3D, a replaced source or a new
 * host session) changes the key; a redraw of the same reading does not.
 */
export function sceneReadingKey(evaluation: ViewportEvaluation): string {
	const token = evaluation.token;
	return `${token.outputId}::${token.sessionEpoch}::${token.sourceRevision}::${evaluation.settledReading}`;
}

const surfaces = new WeakMap<object, SceneSurface>();

/**
 * Publish the surface for one accepted snapshot and reading.
 *
 * A different **reading** for the same snapshot replaces the previous surface
 * after cancelling it, so a candidate or lease prepared for the reading that is
 * ending cannot survive it. A second publisher of the *same* reading only ends
 * any gesture the replaced session holds, so it cannot keep a lease the registry
 * no longer names. A redraw is neither: the same surface is simply re-registered.
 * A previous publisher's release is identity-checked and therefore cannot remove
 * the replacement.
 */
export function publishSceneSurface(snapshot: object, surface: SceneSurface): () => void {
	const previous = surfaces.get(snapshot);
	if (previous !== undefined && previous !== surface) {
		if (previous.reading !== surface.reading) {
			// A new reading invalidates the old proposal entirely.
			previous.session.cancel();
		} else {
			// Same reading, a second publisher: end any gesture it holds so the
			// replaced session cannot keep a lease the registry no longer names.
			previous.session.abortGesture();
		}
	}
	surfaces.set(snapshot, surface);
	return () => {
		if (surfaces.get(snapshot) === surface) surfaces.delete(snapshot);
	};
}

/** Remove the surface only if it is still the one this caller published. */
export function retireSceneSurface(snapshot: object, surface: SceneSurface): void {
	if (surfaces.get(snapshot) === surface) surfaces.delete(snapshot);
}

/**
 * The live surface for this exact accepted snapshot and reading, or `null`.
 *
 * Reads happen on every rendered frame, so this compares readings, not frame
 * ids: a candidate published once stays visible through the redraws that follow
 * it.
 */
export function sceneSurfaceFor(
	snapshot: object,
	evaluation: ViewportEvaluation
): SceneSurface | null {
	const surface = surfaces.get(snapshot) ?? null;
	return surface !== null && surface.reading === sceneReadingKey(evaluation) ? surface : null;
}

export const PROJECT_WORLD: FrameReference = { version: 1, kind: 'project-world' };
export const FRAME = { origin: [0, 0, 0] as Vec3, yaw: 0 };

/**
 * The canonical selection reference for one Scene entity at one accepted
 * revision. Canonical selection does **not** require a Plan fragment
 * (`StageSelectionEntry.representation` is optional), so a Scene-only subject is
 * selectable without fabricating Layout evidence.
 */
export function sceneEntityReference(entityId: string, contentRevision: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

export function parseNumber(text: string): { ok: true; value: number } | { ok: false; code: 'blank' | 'non-finite' | 'malformed'; reason: string } {
	const trimmed = text.trim();
	if (trimmed.length === 0) return { ok: false, code: 'blank', reason: 'Enter a value; an empty field is not zero.' };
	const value = Number(trimmed);
	if (!Number.isFinite(value)) return { ok: false, code: 'non-finite', reason: 'The value must be finite.' };
	return { ok: true, value };
}

/**
 * Local bottom contact of one entity, or `null` when the planner must refuse.
 *
 * A creator model's contact is the approved resource's recorded contact, passed
 * in by the caller that can read the envelope; it is never measured here.
 */
export function localContactMinY(entity: SceneEntity, modelContactMinY?: number | null): number | null {
	if (entity.kind === 'model') {
		return typeof modelContactMinY === 'number' && Number.isFinite(modelContactMinY)
			? modelContactMinY
			: null;
	}
	// A form's contact is derived from its authored source through the one editor
	// evaluation cache, so the Card/Compose contact and the installed one agree
	// and no second kernel evaluation runs per recompute.
	if (entity.kind === 'form') return evaluateFormMesh(entity.form)?.contactMinY ?? null;
	if (entity.kind !== 'primitive') return null;
	switch (entity.primitive) {
		case 'box':
			return -entity.dimensions.height / 2;
		case 'cylinder':
			return -entity.dimensions.height / 2;
		case 'sphere':
			return -entity.dimensions.radius;
		default:
			return 0;
	}
}

export type SceneComposeSupport = {
	readonly resize: boolean;
	readonly duplicate: boolean;
	/** The refusal code a command reports, or `null` when both are available. */
	readonly code: 'missing-contact-metadata' | 'unsupported-transform' | null;
	/** Why Resize/Duplicate are unavailable, or `null` when both are. */
	readonly reason: string | null;
};

/**
 * What Compose can truthfully do with one entity.
 *
 * Resize and Duplicate need a floor contact the retained planner can re-seat.
 * The admitted analytic primitives and approved creator models have one; a light
 * or an unapproved catalogue model does not, so offering the command would only
 * take the gesture lease and then refuse (and the adapter would advertise a
 * `Scale` fact that cannot be written). Delete needs no contact.
 *
 * A native form has a real contact but no uniform Resize: its size is per-axis
 * form source (`set-form-size`), and `resize-on-floor` refuses forms. So the
 * uniform affordance is not offered and no `Scale` fact is advertised, while
 * Duplicate — which copies the source verbatim — stays available.
 */
export function sceneComposeSupport(
	entity: SceneEntity,
	modelContactMinY?: number | null
): SceneComposeSupport {
	// The planner's own gate first: lights, vertical planes, tilted primitives and
	// primitives with no analytic contact are unsupported there, so the UI must not
	// offer them either.
	const planner = floorTransformSupport(entity);
	if (!planner.supported) {
		return { resize: false, duplicate: false, code: 'unsupported-transform', reason: planner.message };
	}
	if (localContactMinY(entity, modelContactMinY) === null) {
		return {
			resize: false,
			duplicate: false,
			code: 'missing-contact-metadata',
			reason:
				entity.kind === 'light'
					? 'A light has no verified floor contact; Resize and Duplicate are unavailable.'
					: entity.kind === 'form'
						? 'A form needs an evaluable source before it can be duplicated on the floor.'
						: 'A model needs a verified contact before it can be resized or duplicated on the floor.'
		};
	}
	if (entity.kind === 'form') {
		return {
			resize: false,
			duplicate: true,
			code: 'unsupported-transform',
			reason: 'A native form is sized per axis through its own source; uniform Resize is unavailable.'
		};
	}
	return { resize: true, duplicate: true, code: null, reason: null };
}

