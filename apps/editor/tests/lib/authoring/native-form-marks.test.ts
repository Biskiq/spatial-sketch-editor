/**
 * R217.S09 — native form marks: the domain half of the S07 mark contract.
 *
 * A selected form publishes the same Move and Turn vocabulary as an S08 object,
 * plus a Scale disclosure that reveals three per-axis size rays. These tests
 * name the values the host consumes: stable ids, descriptor order, the planners
 * that already own sizing, and the measured anchors, axes, extents and tags.
 * They do not mount a Stage; projection, admission and gestures belong to the
 * adapter and host tests.
 */
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@portfolio/camera-core';
import type { SceneFormEntity } from '$lib/content/scene';
import {
	hitStageMark,
	projectStageHandles,
	type StageHandleDescriptor
} from '$lib/authoring/stage/stage-handles';
import {
	SCENE_FORM_MARK,
	formMoveScreenOffset,
	formSizeMeasurement,
	formWorldAxis,
	formWorldPoint,
	type FormMarkScreenHeight
} from '$lib/authoring/adapters/scene/shape/form-size';
import {
	SCENE_OBJECT_MARK,
	isSceneObjectEditMarkId,
	sceneObjectMarkDescriptors,
	type SceneObjectLift,
	type SceneObjectMarkLive
} from '$lib/authoring/adapters/scene/object-marks';

function squareForm(overrides: Partial<SceneFormEntity> = {}): SceneFormEntity {
	return {
		kind: 'form',
		id: 'entity-form-1',
		name: 'Drawn table',
		position: [2, 0, 3],
		rotation: [0, 0, 0],
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				outline: [
					{ key: 1, u: 0, v: 0, smooth: false },
					{ key: 2, u: 1, v: 0, smooth: false },
					{ key: 3, u: 1, v: 1, smooth: false },
					{ key: 4, u: 0, v: 1, smooth: false }
				],
				extent: 0.75
			},
			scale: [1, 1, 1],
			nextKey: 5
		},
		materialId: 'paper-aged',
		castShadow: true,
		receiveShadow: true,
		...overrides
	};
}

function expectVec(actual: Vec3 | undefined, expected: Vec3): void {
	expect(actual).toBeDefined();
	for (let index = 0; index < 3; index += 1) {
		expect(actual![index]).toBeCloseTo(expected[index]!, 9);
	}
}

/** A form's marks through the one Scene object builder, as the adapter calls it. */
function descriptorsFor(
	entity: SceneFormEntity,
	live: SceneObjectMarkLive | null = null,
	options: {
		readonly reading?: 'plan' | '3d';
		readonly lift?: SceneObjectLift | null;
		readonly screenHeight?: FormMarkScreenHeight | null;
		readonly measurement?: ReturnType<typeof formSizeMeasurement>;
	} = {}
): readonly StageHandleDescriptor[] {
	const measurement = options.measurement ?? formSizeMeasurement(entity);
	return sceneObjectMarkDescriptors({
		entity,
		reading: options.reading,
		contactMinY: measurement.contactMinY,
		bounds: null,
		footprint: measurement.footprint,
		live,
		lift: options.lift ?? null,
		form: { measurement, baseline: measurement, form: entity.form, screenHeight: options.screenHeight }
	});
}

// A form is a Scene object: it shares Move, Turn, the chip and Lift with every
// model and primitive, and adds only its per-axis size rays.
describe('R217.S09 — native form marks', () => {
	it('publishes the chip, Height, Width, Depth, then the shared Move and Turn', () => {
		const descriptors = descriptorsFor(squareForm());
		expect(descriptors.map((descriptor) => descriptor.id)).toEqual([
			SCENE_OBJECT_MARK.scalePoint,
			SCENE_FORM_MARK.height,
			SCENE_FORM_MARK.width,
			SCENE_FORM_MARK.depth,
			SCENE_OBJECT_MARK.move,
			SCENE_OBJECT_MARK.turn
		]);
		expect(descriptors.map((descriptor) => descriptor.role)).toEqual([
			'disclose',
			'edit',
			'edit',
			'edit',
			'edit',
			'edit'
		]);
		expect(descriptors.map((descriptor) => descriptor.kind)).toEqual([
			'point',
			'ray',
			'ray',
			'ray',
			'point',
			'ring'
		]);
		expect(descriptors[4]).toMatchObject({
			label: 'Move',
			fact: 'position',
			verb: 'Position',
			planner: 'place-on-floor'
		});
		expect(descriptors[0]).toMatchObject({
			label: 'Scale',
			reveals: [SCENE_FORM_MARK.height, SCENE_FORM_MARK.width, SCENE_FORM_MARK.depth]
		});
		// A form refuses a uniform scale, so its chip only discloses.
		expect(descriptors[0]).not.toHaveProperty('drags');
		for (const descriptor of descriptors.slice(1, 4)) {
			expect(descriptor).toMatchObject({
				role: 'edit',
				planner: 'set-form-size',
				disclosedBy: SCENE_OBJECT_MARK.scalePoint
			});
		}
		expect(descriptors[5]).toMatchObject({
			label: 'Turn',
			fact: 'yaw',
			verb: 'Yaw',
			planner: 'set-yaw'
		});
	});

	it('uses the one measurement for contact, footprint, anchors, axes, extents and tags', () => {
		const entity = squareForm();
		const measurement = formSizeMeasurement(entity);
		expect(measurement.bounds).not.toBeNull();
		const bounds = measurement.bounds!;
		expect(measurement.handles.map((handle) => handle.axis)).toEqual([0, 1, 2]);
		expect(measurement.contactMinY).toBeCloseTo(bounds.min[1], 9);
		expect(measurement.footprint.width).toBeCloseTo(bounds.max[0] - bounds.min[0], 9);
		expect(measurement.footprint.depth).toBeCloseTo(bounds.max[2] - bounds.min[2], 9);

		const descriptors = descriptorsFor(entity);
		const move = descriptors[4]!;
		expect(move.anchor[0]).toBeCloseTo(entity.position[0], 9);
		expect(move.anchor[1]).toBeCloseTo(entity.position[1] + measurement.contactMinY, 9);
		expect(move.anchor[2]).toBeCloseTo(entity.position[2], 9);
		expect(move.extent).toBeCloseTo(Math.max(0.2, measurement.footprint.width / 2), 9);
		expect(move.value).toBe('Δx 0.00 · Δz 0.00 m');

		const turn = descriptors[5]!;
		expect(turn.extent).toBeCloseTo(
			Math.max(0.2, Math.max(measurement.footprint.width, measurement.footprint.depth) / 2),
			9
		);

		const scale = descriptors[0]!;
		expectVec(scale.anchor, formWorldPoint(entity, bounds.max));

		const rays = [
			{ axis: 1 as const, id: SCENE_FORM_MARK.height, label: 'Height', note: ' · base stays' },
			{ axis: 0 as const, id: SCENE_FORM_MARK.width, label: 'Width', note: '' },
			{ axis: 2 as const, id: SCENE_FORM_MARK.depth, label: 'Depth', note: '' }
		];
		for (let index = 0; index < rays.length; index += 1) {
			const ray = rays[index]!;
			const descriptor = descriptors[1 + index]!;
			const handle = measurement.handles.find((entry) => entry.axis === ray.axis)!;
			expect(descriptor.id).toBe(ray.id);
			expect(descriptor.label).toBe(ray.label);
			if (ray.axis === 1) {
				// Review pass 2 §6: Height is the stem's top knob at the chip's corner.
				expectVec(descriptor.anchor, formWorldPoint(entity, bounds.max));
				expectVec(descriptor.stem!, formWorldPoint(entity, [bounds.max[0], bounds.min[1], bounds.max[2]]));
				expect(descriptor.draw).toMatchObject({ glyph: 'top-knob' });
			} else {
				expectVec(descriptor.anchor, formWorldPoint(entity, handle.local));
			}
			expectVec(descriptor.axis, formWorldAxis(entity, ray.axis));
			expect(descriptor.extent).toBeCloseTo(
				Math.max(0.2, Math.abs(handle.local[ray.axis])),
				9
			);
			expect(descriptor.value).toBe(`Δ 0.00 m → ${handle.dimension.toFixed(2)} m`);
			expect(descriptor).toMatchObject({ fact: `scale[${ray.axis}]` });
		}
	});

	it('follows a rotated form without re-deriving the measurement', () => {
		const entity = squareForm({ rotation: [0, Math.PI / 2, 0] });
		const measurement = formSizeMeasurement(entity);
		const descriptors = descriptorsFor(entity);
		const width = descriptors[2]!;
		expectVec(width.axis, formWorldAxis(entity, 0));
		expect(Math.abs(width.axis![0])).toBeLessThan(1e-9);
		expect(Math.abs(width.axis![2])).toBeCloseTo(1, 9);

		const move = descriptors[4]!;
		expect(move.axis![0]).toBeCloseTo(Math.cos(Math.PI / 2), 9);
		expect(move.axis![2]).toBeCloseTo(-Math.sin(Math.PI / 2), 9);
		expectVec(descriptors[0]!.anchor, formWorldPoint(entity, measurement.bounds!.max));
	});

	it('shows a live refusal and pose on its own mark only', () => {
		const entity = squareForm();
		const live: SceneObjectMarkLive = {
			markId: SCENE_OBJECT_MARK.turn,
			position: [3, 0, 4],
			yaw: 0.4,
			scale: 1,
			refusal: 'The turn is refused.'
		};
		const descriptors = descriptorsFor(entity, live);
		expect(descriptors[4]!.refusal).toBeNull();
		expect(descriptors[5]!.refusal).toBe('The turn is refused.');
		expect(descriptors[5]!.value).toBe(`Δθ +${((0.4 * 180) / Math.PI).toFixed(1)}°`);
		for (const ray of descriptors.slice(1, 4)) expect(ray.refusal).toBeNull();
		expect(descriptors[4]!.anchor[0]).toBeCloseTo(3, 9);
		expect(descriptors[4]!.anchor[2]).toBeCloseTo(4, 9);
	});

	it('keeps the Card planner vocabulary and the three-axis disclosure', () => {
		const descriptors = descriptorsFor(squareForm());
		const planners = descriptors.flatMap((descriptor) =>
			descriptor.role === 'edit' ? [descriptor.planner] : []
		);
		expect(new Set(planners)).toEqual(
			new Set(['place-on-floor', 'set-yaw', 'set-form-size'])
		);
		expect(isSceneObjectEditMarkId(SCENE_OBJECT_MARK.scalePoint)).toBe(false);
		for (const id of [
			SCENE_OBJECT_MARK.move,
			SCENE_OBJECT_MARK.turn,
			SCENE_FORM_MARK.height,
			SCENE_FORM_MARK.width,
			SCENE_FORM_MARK.depth
		]) {
			expect(isSceneObjectEditMarkId(id)).toBe(true);
		}
		expect(descriptorsFor(squareForm(), null, { measurement: { ...formSizeMeasurement(squareForm()), bounds: null } })).toEqual([]);
	});

	it('adds the lift knob on the Height stem in 3D only, where a support lies beneath', () => {
		const entity = squareForm();
		const lift = { lift: 0, supportY: 0 };
		const in3d = descriptorsFor(entity, null, { reading: '3d', lift });
		const knob = in3d.find((descriptor) => descriptor.id === SCENE_OBJECT_MARK.lift);
		expect(knob).toMatchObject({
			kind: 'ray',
			role: 'edit',
			draw: { glyph: 'lift-knob' },
			fact: 'lift',
			planner: 'set-lift',
			disclosedBy: SCENE_OBJECT_MARK.scalePoint,
			axis: [0, 1, 0],
			screen: { offset: [26, 0] }
		});
		const height = in3d.find((descriptor) => descriptor.id === SCENE_FORM_MARK.height)!;
		// One stem: the bottom knob sits at the Height knob's stem foot.
		expectVec(knob!.anchor as Vec3, height.stem as Vec3);
		expect(in3d.find((descriptor) => descriptor.id === SCENE_OBJECT_MARK.scalePoint)).toMatchObject({
			reveals: expect.arrayContaining([SCENE_OBJECT_MARK.lift])
		});
		expect(in3d.at(-1)?.id).toBe(SCENE_OBJECT_MARK.turn);
		expect(isSceneObjectEditMarkId(SCENE_OBJECT_MARK.lift)).toBe(true);
		const ids = (options: Parameters<typeof descriptorsFor>[2]) =>
			descriptorsFor(entity, null, options).map((descriptor) => descriptor.id);
		expect(ids({ reading: 'plan', lift })).not.toContain(SCENE_OBJECT_MARK.lift);
		expect(ids({ reading: '3d', lift: null })).not.toContain(SCENE_OBJECT_MARK.lift);
	});

	it('carries the Plan screen fallback on Height only', () => {
		const screenHeight = { offset: [0, -48], axis: [0, -1] } as const;
		const descriptors = descriptorsFor(squareForm(), null, { screenHeight });
		const height = descriptors.find((descriptor) => descriptor.id === SCENE_FORM_MARK.height);
		expect(height?.screen).toEqual(screenHeight);
		for (const descriptor of descriptors) {
			if (descriptor.id !== SCENE_FORM_MARK.height) {
				expect(descriptor.screen).toBeUndefined();
			}
		}
		// Without the Plan fallback, Height keeps only its top knob's side offset.
		for (const descriptor of descriptorsFor(squareForm())) {
			expect(descriptor.screen).toEqual(
				descriptor.id === SCENE_FORM_MARK.height ? { offset: [26, 0] } : undefined
			);
		}
	});

	it('keeps Move and the Width ray separately pressable across readings', () => {
		// Move and Width share their world origin and axis for upright forms. The
		// 30 px Move track would therefore swallow the Width ray unless Move is
		// offset; a fixed offset would collide again at a quarter turn, so it follows
		// the projected Move axis and always lies opposite the Depth ray.
		// Plan's screen mapping: right +X, up −Z (screen y grows with +Z), as in the
		// Plan reading's endpoint contract.
		const project = (point: Vec3): readonly [number, number] => [
			640 + point[0] * 100,
			360 + point[2] * 100
		];
		for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI / 4]) {
			const entity = squareForm({ rotation: [0, yaw, 0] });
			const measurement = formSizeMeasurement(entity);
			const screenMove = formMoveScreenOffset({
				entity,
				measurement,
				project,
				gapPx: 24
			});
			if (yaw === 0) expect(screenMove.offset[1]).toBeCloseTo(-24, 6);
			const descriptors = descriptorsFor(entity);
			const move = descriptors.find((descriptor) => descriptor.id === SCENE_OBJECT_MARK.move)!;
			const width = descriptors.find((descriptor) => descriptor.id === SCENE_FORM_MARK.width)!;
			expect(move.screen).toBeUndefined();
			expect(move.anchor).toEqual([entity.position[0], entity.position[1] + measurement.contactMinY, entity.position[2]]);
			expect(width.screen).toBeUndefined();

			const marks = projectStageHandles({
				adapterId: 'scene',
				descriptors,
				openDisclosures: new Set([SCENE_OBJECT_MARK.scalePoint]),
				hoveredId: null,
				activeId: null,
				project,
				offset: [0, 0]
			});
			const moveMark = marks.find((mark) => mark.id === SCENE_OBJECT_MARK.move)!;
			const widthMark = marks.find((mark) => mark.id === SCENE_FORM_MARK.width)!;
			const depthMark = marks.find((mark) => mark.id === SCENE_FORM_MARK.depth)!;
			expect(widthMark.tip).not.toBeNull();
			expect(moveMark.cross).toBe(true);
			expect(depthMark.tip).not.toBeNull();
			expect(
				hitStageMark(marks, { css: widthMark.tip!, coarse: true })?.id
			).toBe(SCENE_FORM_MARK.width);
			expect(
				hitStageMark(marks, { css: moveMark.anchor, coarse: true })?.id
			).toBe(SCENE_OBJECT_MARK.move);
			expect(
				hitStageMark(marks, { css: depthMark.tip!, coarse: true })?.id
			).toBe(SCENE_FORM_MARK.depth);
		}
	});
});
