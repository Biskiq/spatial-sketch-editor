import { type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { type FrameReference } from '../../references/types';
import { validateFrameReference } from '../../references/validate';
import { type Vec3 } from '../../scene';
import { type SceneSupportChoice } from '../support';
import { type LocalInputFrame } from '../types';
import { ShapeReader } from '../../strict-shape';

export function readNullableNumber(
	reader: ShapeReader,
	raw: unknown,
	path: string
): { readonly present: false } | { readonly present: true; readonly value: number | null } | null {
	if (raw === undefined) return { present: false };
	if (raw === null) return { present: true, value: null };
	const value = reader.number(raw, path);
	return value === null ? null : { present: true, value };
}

export function readPoint(reader: ShapeReader, input: unknown, path: string): LayoutVec2 | null {
	if (!Array.isArray(input) || input.length !== 2) {
		reader.problem(path, 'invalid-point', `${path} must be a two-number world X/Z point`);
		return null;
	}
	const x = reader.number(input[0], `${path}[0]`);
	const z = reader.number(input[1], `${path}[1]`);
	return x === null || z === null ? null : [x, z];
}

export function readFrame(reader: ShapeReader, input: unknown, path: string): LocalInputFrame | null {
	const record = reader.object(input, path, ['origin', 'yaw']);
	if (record === null) return null;
	const origin = reader.vector3(record.origin, `${path}.origin`);
	const yaw = reader.number(record.yaw, `${path}.yaw`);
	if (origin === null || yaw === null) return null;
	return { origin: origin as Vec3, yaw };
}

/**
 * Validate one captured `FrameReference@1` against the conversion that came with
 * it.
 *
 * `project-world` is the identity conversion and needs no owner data, so a
 * non-identity transform behind it refuses (`frame-mismatch`). An `owner-frame`
 * names a frame only its owner can place: resolving it needs that owner's
 * `FrameResolver`, and a pure planner is given none. A structurally valid
 * owner-qualified reference therefore refuses (`unsupported-frame`) instead of
 * accepting a caller-supplied origin and yaw as if the owner had produced them.
 * No frame is invented from a Room, its centroid or its containment.
 */
export function readFrameReference(
	reader: ShapeReader,
	input: unknown,
	path: string,
	frame: LocalInputFrame | null
): { readonly ok: true; readonly value: FrameReference } | { readonly ok: false } {
	const validated = validateFrameReference(input);
	if (!validated.success) {
		for (const issue of validated.issues) {
			reader.problem(`${path}${issue.path.slice(1)}`, issue.code, issue.message);
		}
		return { ok: false };
	}
	if (frame === null) return { ok: false };
	if (validated.value.kind === 'owner-frame') {
		reader.problem(
			path,
			'unsupported-frame',
			`Frame "${validated.value.frameId}" is owner-qualified by "${validated.value.owner}"; its placement is only usable through that owner's frame resolver, and this reader admits none, so the supplied conversion is not verified`
		);
		return { ok: false };
	}
	if (frame.yaw !== 0 || frame.origin.some((value) => value !== 0)) {
		reader.problem(
			path,
			'frame-mismatch',
			'a project-world frame reference must carry the identity conversion (zero origin and yaw)'
		);
		return { ok: false };
	}
	return { ok: true, value: validated.value };
}

export function readSupportChoice(
	reader: ShapeReader,
	input: unknown,
	path: string
): { readonly choice?: SceneSupportChoice } | undefined {
	if (input === undefined) return {};
	const record = reader.object(input, path, ['kind', 'orderKey', 'elevation', 'generationId']);
	if (record === null) return undefined;
	const kind = reader.tag(record.kind, `${path}.kind`, ['order-key', 'elevation']);
	const generationId = reader.opaqueId(record.generationId, `${path}.generationId`);
	if (kind === null || generationId === null) return undefined;
	if (kind === 'order-key') {
		const orderKey = reader.opaqueId(record.orderKey, `${path}.orderKey`);
		if (record.elevation !== undefined) {
			reader.problem(`${path}.elevation`, 'unknown-key', `${path}.elevation belongs to an elevation choice`);
		}
		return orderKey === null ? undefined : { choice: { kind: 'order-key', orderKey, generationId } };
	}
	const elevation = reader.number(record.elevation, `${path}.elevation`);
	if (record.orderKey !== undefined) {
		reader.problem(`${path}.orderKey`, 'unknown-key', `${path}.orderKey belongs to an order-key choice`);
	}
	return elevation === null ? undefined : { choice: { kind: 'elevation', elevation, generationId } };
}
