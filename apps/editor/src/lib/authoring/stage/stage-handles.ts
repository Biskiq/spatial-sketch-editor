/**
 * Stage-owned manipulation marks: one descriptor vocabulary, one admission rule
 * and one set of projected hit areas.
 *
 * A domain does not draw a knob. It publishes **descriptors** that name the real
 * fact a mark addresses, the planner a release submits and (for a disclosure) the
 * grips it reveals. This module is the host side of that contract:
 *
 * 1. **Admission** — an editing grip may only name one of the owning adapter's
 *    registered planners, and a disclosure may only reveal admitted grips of the
 *    same binding. A refused mark is reported and never drawn.
 * 2. **Disclosure** — opening a disclosure is session view state. It reveals
 *    grips, writes no source, enters no history and can never make the project
 *    dirty.
 * 3. **Projection** — marks are painted in the same Stage-local CSS space as the
 *    existing overlay, through the caller's one `ViewportEvaluation`, at the
 *    shared calibrated screen size (`STAGE_MARK_GLYPH_CSS`): a 0.6 m plinth and
 *    a 24 m roof read alike. A descriptor's `extent` names its world reach, not
 *    the length the host draws. This module never projects through a second
 *    camera.
 * 4. **Hit legibility** — marks are visually small but keep a larger invisible
 *    area (22 px fine, 44 px coarse), and the owning domain's descriptor order
 *    wins an overlap.
 *
 * It is framework-free and makes no document, so the whole lifecycle can be
 * tested in the node environment.
 */
import type { Vec3 } from '@portfolio/camera-core';

export type StageHandleKind = 'ray' | 'point' | 'ring' | 'track';

export type StageHandleBase = {
	readonly id: string;
	readonly kind: StageHandleKind;
	/** World-space anchor; every drawing/hit test starts here. */
	readonly anchor: Vec3;
	/** Ray/track direction or ring normal, in world space. */
	readonly axis?: Vec3;
	/**
	 * The mark's reach in metres: the driven distance for a ray/track, the
	 * planar radius for a ring. The host draws the shared vocabulary at a
	 * calibrated screen size (`STAGE_MARK_GLYPH_CSS`), so a 0.6 m plinth and a
	 * 24 m roof keep the same quiet mark; the reach is not a measure.
	 */
	readonly extent?: number;
	/**
	 * Draw a ray/track on both sides of its anchor — the grammar's two-way base
	 * ray. It changes the drawing and the hit area only; the gesture is the one
	 * the descriptor already names.
	 */
	readonly bothWays?: boolean;
	/**
	 * Screen-space legibility fallback for a world axis the reading hides.
	 *
	 * Plan looks down world Y, so a vertical ray projects edge-on and would be
	 * withheld. `offset` is a Stage-local CSS offset applied after the world
	 * anchor projects; `axis` is a unit CSS direction used **only** for a
	 * ray/track whose world axis is edge-on. They change the drawing and hit
	 * area only: the gesture still measures the descriptor's real world axis.
	 * A malformed or zero `axis` falls back to withholding, never guessing.
	 */
	readonly screen?: {
		readonly offset?: readonly [number, number];
		readonly axis?: readonly [number, number];
	};
	/** Accessible name, e.g. 'Size'. */
	readonly label: string;
	/**
	 * The live value the owning adapter publishes for this mark, already formatted
	 * for its units. Only shown while the mark is hovered or held.
	 */
	readonly value?: string;
	/** The adapter's own refusal words for the live candidate, if refused. */
	readonly refusal?: string | null;
};

export type StageEditingGrip = StageHandleBase & {
	readonly role: 'edit';
	/** The Card field this addresses, e.g. 'length'. */
	readonly fact: string;
	/** Tag template, e.g. 'Length {value} m'. */
	readonly verb: string;
	/** The domain intent kind a release submits. */
	readonly planner: string;
	/** Id of the disclosure mark that reveals it; omitted = always shown. */
	readonly disclosedBy?: string;
};

export type StageDisclosureMark = StageHandleBase & {
	readonly role: 'disclose';
	/** Ids of this binding's editing grips the mark reveals. */
	readonly reveals: readonly string[];
};

export type StageHandleDescriptor = StageEditingGrip | StageDisclosureMark;

export type StageHandleDiagnosticCode =
	| 'invalid-id'
	| 'duplicate-id'
	| 'invalid-geometry'
	| 'unknown-planner'
	| 'unknown-disclosure'
	| 'empty-reveal'
	| 'foreign-reveal'
	| 'disclosure-cycle';

export type StageHandleDiagnostic = {
	readonly adapterId: string;
	readonly handleId: string;
	readonly code: StageHandleDiagnosticCode;
	readonly message: string;
};

export type StageHandleAdmission = {
	readonly admitted: readonly StageHandleDescriptor[];
	readonly diagnostics: readonly StageHandleDiagnostic[];
};

function finiteVec3(value: Vec3 | undefined): value is Vec3 {
	return value !== undefined && value.length === 3 && value.every(Number.isFinite);
}

function hasUsableGeometry(descriptor: StageHandleDescriptor): boolean {
	if (!finiteVec3(descriptor.anchor)) return false;
	if (descriptor.kind === 'ray' || descriptor.kind === 'track') {
		return finiteVec3(descriptor.axis) && descriptor.extent !== undefined && Number.isFinite(descriptor.extent) && descriptor.extent > 0;
	}
	if (descriptor.kind === 'ring') {
		return finiteVec3(descriptor.axis) && descriptor.extent !== undefined && Number.isFinite(descriptor.extent) && descriptor.extent > 0;
	}
	return true;
}

/**
 * Admit one binding's descriptors against the planners that adapter registered.
 *
 * Two passes are deliberate: editing grips are decided first, so a disclosure
 * can only reveal grips that actually survived admission. A disclosure that
 * names a foreign or refused id is itself refused — revealing a mark the host
 * will not draw would be an affordance that lies.
 */
export function admitStageHandles(input: {
	readonly adapterId: string;
	readonly descriptors: readonly StageHandleDescriptor[];
	readonly plannerKinds: readonly string[];
	readonly alreadyReported?: ReadonlySet<string>;
}): StageHandleAdmission {
	const diagnostics: StageHandleDiagnostic[] = [];
	const report = (handleId: string, code: StageHandleDiagnosticCode, message: string) => {
		const key = `${input.adapterId}\u0000${handleId}\u0000${code}`;
		if (input.alreadyReported?.has(key) === true) return;
		diagnostics.push({ adapterId: input.adapterId, handleId, code, message });
	};

	const plannerKinds = new Set(input.plannerKinds);
	const byId = new Map<string, StageHandleDescriptor>();
	for (const descriptor of input.descriptors) {
		if (typeof descriptor.id !== 'string' || descriptor.id.length === 0) {
			report(String(descriptor.id), 'invalid-id', 'A mark needs a stable, non-empty id.');
			continue;
		}
		if (byId.has(descriptor.id)) {
			report(descriptor.id, 'duplicate-id', `The mark id "${descriptor.id}" is repeated in one binding.`);
			continue;
		}
		if (!hasUsableGeometry(descriptor)) {
			report(descriptor.id, 'invalid-geometry', `The mark "${descriptor.id}" has no finite anchor, axis or extent.`);
			continue;
		}
		byId.set(descriptor.id, descriptor);
	}

	const admittedEdits = new Map<string, StageEditingGrip>();
	for (const descriptor of byId.values()) {
		if (descriptor.role !== 'edit') continue;
		if (!plannerKinds.has(descriptor.planner)) {
			report(
				descriptor.id,
				'unknown-planner',
				`The grip "${descriptor.id}" names the planner "${descriptor.planner}", which this adapter has not registered.`
			);
			continue;
		}
		admittedEdits.set(descriptor.id, descriptor);
	}

	const admittedDisclosures = new Map<string, StageDisclosureMark>();
	for (const descriptor of byId.values()) {
		if (descriptor.role !== 'disclose') continue;
		if (descriptor.reveals.length === 0) {
			report(descriptor.id, 'empty-reveal', `The disclosure "${descriptor.id}" reveals no grip.`);
			continue;
		}
		let refused = false;
		for (const reveal of descriptor.reveals) {
			if (!admittedEdits.has(reveal)) {
				const reason = byId.get(reveal) === undefined ? 'foreign-reveal' : 'unknown-disclosure';
				report(
					descriptor.id,
					reason,
					`The disclosure "${descriptor.id}" reveals "${reveal}", which is not an admitted grip of this binding.`
				);
				refused = true;
			}
		}
		if (!refused) admittedDisclosures.set(descriptor.id, descriptor);
	}

	const admitted: StageHandleDescriptor[] = [];
	for (const descriptor of byId.values()) {
		if (descriptor.role === 'edit') {
			if (!admittedEdits.has(descriptor.id)) continue;
			if (descriptor.disclosedBy !== undefined) {
				const disclosure = admittedDisclosures.get(descriptor.disclosedBy);
				if (disclosure === undefined || !disclosure.reveals.includes(descriptor.id)) {
					report(
						descriptor.id,
						'unknown-disclosure',
						`The grip "${descriptor.id}" is disclosed by "${descriptor.disclosedBy}", which does not reveal it.`
					);
					continue;
				}
			}
			admitted.push(descriptor);
		} else if (admittedDisclosures.has(descriptor.id)) {
			admitted.push(descriptor);
		}
	}
	return { admitted, diagnostics };
}

/** Whether an admitted mark is drawn for the current disclosure set. */
export function stageHandleVisible(
	descriptor: StageHandleDescriptor,
	openDisclosures: ReadonlySet<string>
): boolean {
	if (descriptor.role === 'disclose') return true;
	return descriptor.disclosedBy === undefined || openDisclosures.has(descriptor.disclosedBy);
}

export type StageMarkView = {
	readonly adapterId: string;
	readonly id: string;
	readonly role: StageHandleDescriptor['role'];
	readonly kind: StageHandleKind;
	readonly label: string;
	readonly fact: string | null;
	readonly planner: string | null;
	/** Stage-local CSS anchor. */
	readonly anchor: readonly [number, number];
	/** Ray/track end in Stage-local CSS. */
	readonly tip: readonly [number, number] | null;
	/** The opposite end of a two-way ray/track, in Stage-local CSS. */
	readonly tail: readonly [number, number] | null;
	/** Ring outline in Stage-local CSS. */
	readonly ring: readonly (readonly [number, number])[] | null;
	readonly tag: string;
	readonly refusal: string | null;
	readonly open: boolean;
	readonly active: boolean;
	readonly hovered: boolean;
	readonly descriptor: StageHandleDescriptor;
};

/** A mark under a pointer, before its owning adapter is asked to claim a drag. */
export type StageMarkHit = {
	readonly adapterId: string;
	readonly id: string;
	readonly role: StageHandleDescriptor['role'];
	readonly mark: StageMarkView;
};

export type StageMarkQuery = {
	readonly css: readonly [number, number];
	readonly coarse: boolean;
};

/** A fine pointer gets a 22 px area; a coarse one gets 44 px, visibly unchanged. */
export function stageMarkHitRadiusCss(coarse: boolean): number {
	return coarse ? 22 : 11;
}

function squaredDistanceToSegment(
	point: readonly [number, number],
	start: readonly [number, number],
	end: readonly [number, number]
): number {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const squared = dx * dx + dy * dy;
	if (squared === 0) return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
	const raw = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / squared;
	const amount = Math.min(1, Math.max(0, raw));
	return (point[0] - (start[0] + dx * amount)) ** 2 + (point[1] - (start[1] + dy * amount)) ** 2;
}

function distanceToSegment(
	point: readonly [number, number],
	start: readonly [number, number],
	end: readonly [number, number]
): number {
	return Math.sqrt(squaredDistanceToSegment(point, start, end));
}

function normalize(value: Vec3): Vec3 | null {
	const length = Math.hypot(value[0], value[1], value[2]);
	if (!Number.isFinite(length) || length === 0) return null;
	return [value[0] / length, value[1] / length, value[2] / length];
}

function finiteCssPair(value: readonly [number, number] | undefined): value is readonly [number, number] {
	return value !== undefined && value.length === 2 && value.every(Number.isFinite);
}

/** A finite, non-zero CSS direction, or `null` when the hint cannot be trusted. */
function screenDirection(value: readonly [number, number] | undefined): readonly [number, number] | null {
	if (!finiteCssPair(value)) return null;
	const length = Math.hypot(value[0], value[1]);
	if (!Number.isFinite(length) || length === 0) return null;
	return [value[0] / length, value[1] / length];
}

function basisFor(axis: Vec3): { readonly u: Vec3; readonly v: Vec3 } | null {
	const unit = normalize(axis);
	if (unit === null) return null;
	// Pick the least-parallel cardinal so a vertical ring and a horizontal ring
	// both get a stable basis instead of a degenerate cross product.
	const helper: Vec3 = Math.abs(unit[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
	const u = normalize([
		unit[1] * helper[2] - unit[2] * helper[1],
		unit[2] * helper[0] - unit[0] * helper[2],
		unit[0] * helper[1] - unit[1] * helper[0]
	]);
	if (u === null) return null;
	const v = normalize([
		unit[1] * u[2] - unit[2] * u[1],
		unit[2] * u[0] - unit[0] * u[2],
		unit[0] * u[1] - unit[1] * u[0]
	]);
	return v === null ? null : { u, v };
}

const RING_SEGMENTS = 48;

/**
 * The shared vocabulary's drawing size, in CSS pixels.
 *
 * The grammar owns the mark and leaves a ring's radius to implementation; the
 * Round 2 wireframe is the evidence that a mark stays small at every zoom — a
 * 0.6 m plinth and a 24 m roof read alike — while its tag carries the value.
 * These are drawing sizes, never measures: a mark's `extent` still names the
 * world reach the domain's operation drives.
 */
export const STAGE_MARK_GLYPH_CSS = {
	/** A ray or one-way track, from its anchor to its arrowhead. */
	ray: 30,
	/** Half of a two-way ray/track (the grammar's two-way base ray). */
	twoWayHalf: 16,
	/** The planar radius of a ring, in the ring's own plane. */
	ringRadius: 30
} as const;

/** Below this a projected step is edge-on: the mark is withheld, not guessed. */
const MIN_AXIS_CSS = 3;
/** An edge-on ring is a line; its minor axis must still read as a ring. */
const MIN_RING_MINOR_CSS = 8;
const MIN_RING_RADIUS_CSS = 4;

/**
 * The projected direction of a world axis at an anchor, in Stage-local CSS.
 *
 * A one-metre step is stable at normal zoom; shorter fallbacks keep a mark near
 * the frame edge projectable. The caller withholds the mark when every step is
 * edge-on, because a grip that cannot name its axis is a misleading grip.
 */
function projectedAxis(
	anchor: readonly [number, number],
	axis: Vec3,
	worldAnchor: Vec3,
	project: (point: Vec3) => readonly [number, number] | null
): readonly [number, number] | null {
	for (const step of [1, 0.25, 0.05]) {
		const projected = project([
			worldAnchor[0] + axis[0] * step,
			worldAnchor[1] + axis[1] * step,
			worldAnchor[2] + axis[2] * step
		]);
		if (projected === null) continue;
		const dx = projected[0] - anchor[0];
		const dy = projected[1] - anchor[1];
		const length = Math.hypot(dx, dy);
		if (length >= MIN_AXIS_CSS) return [dx / length, dy / length];
	}
	return null;
}

/**
 * Project admitted marks into the overlay's Stage-local CSS space.
 *
 * `project` is the adapter context's own projection (viewport CSS); `offset` is
 * the accepted evaluation rect, so the result is in the same space as
 * `StagePointerIntent.css` and the existing overlay. Nothing here re-derives a
 * camera: a mark that cannot project is omitted rather than guessed.
 */
export function projectStageHandles(input: {
	readonly adapterId: string;
	readonly descriptors: readonly StageHandleDescriptor[];
	readonly openDisclosures: ReadonlySet<string>;
	readonly hoveredId: string | null;
	readonly activeId: string | null;
	readonly project: (point: Vec3) => readonly [number, number] | null;
	readonly offset: readonly [number, number];
}): readonly StageMarkView[] {
	const views: StageMarkView[] = [];
	for (const descriptor of input.descriptors) {
		if (!stageHandleVisible(descriptor, input.openDisclosures)) continue;
		const project = (point: Vec3): readonly [number, number] | null => {
			const css = input.project(point);
			return css === null ? null : [css[0] - input.offset[0], css[1] - input.offset[1]];
		};
		const projected = project(descriptor.anchor);
		if (projected === null) continue;
		const screenOffset = descriptor.screen?.offset;
		const anchor: readonly [number, number] = finiteCssPair(screenOffset)
			? [projected[0] + screenOffset[0], projected[1] + screenOffset[1]]
			: projected;
		let tip: readonly [number, number] | null = null;
		let tail: readonly [number, number] | null = null;
		let ring: readonly (readonly [number, number])[] | null = null;
		if (descriptor.kind === 'ray' || descriptor.kind === 'track') {
			const axis = descriptor.axis === undefined ? null : normalize(descriptor.axis);
			if (axis === null) continue;
			// The world axis wins whenever it projects. The screen hint is a
			// legibility fallback for Plan's edge-on Height, not a second axis.
			const direction =
				// Measure the world axis against the **un-offset** projected anchor: a
				// CSS offset would otherwise look like a projected axis step.
				projectedAxis(projected, axis, descriptor.anchor, project) ??
				screenDirection(descriptor.screen?.axis);
			if (direction === null) continue;
			if (descriptor.bothWays === true) {
				tip = [
					anchor[0] + direction[0] * STAGE_MARK_GLYPH_CSS.twoWayHalf,
					anchor[1] + direction[1] * STAGE_MARK_GLYPH_CSS.twoWayHalf
				];
				tail = [
					anchor[0] - direction[0] * STAGE_MARK_GLYPH_CSS.twoWayHalf,
					anchor[1] - direction[1] * STAGE_MARK_GLYPH_CSS.twoWayHalf
				];
			} else {
				tip = [
					anchor[0] + direction[0] * STAGE_MARK_GLYPH_CSS.ray,
					anchor[1] + direction[1] * STAGE_MARK_GLYPH_CSS.ray
				];
			}
		} else if (descriptor.kind === 'ring') {
			const axis = descriptor.axis === undefined ? null : normalize(descriptor.axis);
			if (axis === null || descriptor.extent === undefined) continue;
			const basis = basisFor(axis);
			if (basis === null) continue;
			const outline = (radius: number): [number, number][] => {
				const points: [number, number][] = [];
				for (let index = 0; index < RING_SEGMENTS; index += 1) {
					const angle = (index / RING_SEGMENTS) * Math.PI * 2;
					const cos = Math.cos(angle) * radius;
					const sin = Math.sin(angle) * radius;
					const projected = project([
						descriptor.anchor[0] + basis.u[0] * cos + basis.v[0] * sin,
						descriptor.anchor[1] + basis.u[1] * cos + basis.v[1] * sin,
						descriptor.anchor[2] + basis.u[2] * cos + basis.v[2] * sin
					]);
					if (projected !== null) points.push([projected[0], projected[1]]);
				}
				return points;
			};
			let points = outline(descriptor.extent);
			if (points.length < 12) continue;
			const radiusCss = Math.max(
				...points.map((point) => Math.hypot(point[0] - anchor[0], point[1] - anchor[1]))
			);
			if (radiusCss < MIN_RING_RADIUS_CSS) continue;
			// **Radius calibrated at implementation.** Draw the planar ring at the
			// shared screen radius, regenerated in its own plane so a zoomed-out
			// subject still has a reachable rotation grip and a close one never fills
			// the Stage.
			if (Math.abs(radiusCss - STAGE_MARK_GLYPH_CSS.ringRadius) > 0.5) {
				points = outline(descriptor.extent * (STAGE_MARK_GLYPH_CSS.ringRadius / radiusCss));
				if (points.length < 12) continue;
			}
			const xs = points.map((point) => point[0]);
			const ys = points.map((point) => point[1]);
			const spanX = Math.max(...xs) - Math.min(...xs);
			const spanY = Math.max(...ys) - Math.min(...ys);
			if (Math.min(spanX, spanY) < MIN_RING_MINOR_CSS) continue;
			ring = points;
		}
		const open = descriptor.role === 'disclose' && input.openDisclosures.has(descriptor.id);
		views.push({
			adapterId: input.adapterId,
			id: descriptor.id,
			role: descriptor.role,
			kind: descriptor.kind,
			label: descriptor.label,
			fact: descriptor.role === 'edit' ? descriptor.fact : null,
			planner: descriptor.role === 'edit' ? descriptor.planner : null,
			anchor,
			tip,
			tail,
			ring,
			tag: descriptor.value ?? (descriptor.role === 'edit' ? descriptor.verb : descriptor.label),
			refusal: descriptor.refusal ?? null,
			open,
			active: input.activeId === descriptor.id,
			hovered: input.hoveredId === descriptor.id,
			descriptor
		});
	}
	return views;
}

/**
 * The mark under a pointer. Descriptor order is the domain's own order, so the
 * first hit is the earliest mark the domain published — never a z-index guess
 * the host invented.
 */
export function hitStageMark(
	marks: readonly StageMarkView[],
	query: StageMarkQuery
): StageMarkHit | null {
	const radius = stageMarkHitRadiusCss(query.coarse);
	for (const mark of marks) {
		let hit = false;
		if (mark.kind === 'point' || mark.kind === 'ring') {
			if (mark.kind === 'point') {
				hit = Math.hypot(query.css[0] - mark.anchor[0], query.css[1] - mark.anchor[1]) <= radius;
			} else if (mark.ring !== null) {
				hit = mark.ring.some(
					(point, index) =>
						distanceToSegment(
							query.css,
							point,
							mark.ring![(index + 1) % mark.ring!.length]!
						) <= radius
				);
			}
		} else if (mark.tip !== null) {
			hit = distanceToSegment(query.css, mark.anchor, mark.tip) <= radius;
			if (!hit && mark.tail !== null) {
				hit = distanceToSegment(query.css, mark.anchor, mark.tail) <= radius;
			}
		}
		if (hit) return { adapterId: mark.adapterId, id: mark.id, role: mark.role, mark };
	}
	return null;
}
