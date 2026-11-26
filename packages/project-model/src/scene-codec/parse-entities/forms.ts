import type { EvaluatedProfile } from '@portfolio/geometry-core';
import {
	GeometryCoreError,
	PROFILE_LIMITS,
	evaluateProfile,
	extrudeProfile,
} from '@portfolio/geometry-core';
import type {
	SceneFormAnchor,
	SceneFormEntity,
	SceneFormPlane,
	SceneFormSource,
} from '../../scene';
import type { SceneDocumentIssue } from '../types';
import type { JsonRecord } from '../readers';
import {
	addIssue,
	assertAllowedKeys,
	isRecord,
	readOptionalString,
	readRequiredBoolean,
	readRequiredNumber,
	readRequiredString,
	readVec3,
	rejectRoomId,
} from '../readers';
import type { EntityParserOptions } from './contracts';
import { parseEntityTransform } from './entities';

function parseFormAnchor(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
): SceneFormAnchor | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an outline anchor object');
		return undefined;
	}
	assertAllowedKeys(input, ['key', 'u', 'v', 'smooth'], path, issues);
	const key = readRequiredNumber(input, 'key', path, issues);
	if (key !== undefined && (!Number.isSafeInteger(key) || key <= 0)) {
		addIssue(
			issues,
			`${path}.key`,
			'invalid_key',
			'An outline anchor key must be a positive safe integer',
		);
	}
	const u = readRequiredNumber(input, 'u', path, issues);
	const v = readRequiredNumber(input, 'v', path, issues);
	const smooth = readRequiredBoolean(input, 'smooth', path, issues);
	if (key === undefined || u === undefined || v === undefined || smooth === undefined) {
		return undefined;
	}
	return { key, u, v, smooth };
}

export function parseFormSource(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
): SceneFormSource | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a form source object');
		return undefined;
	}
	assertAllowedKeys(input, ['generator', 'scale', 'nextKey'], path, issues);
	const generatorPath = `${path}.generator`;
	if (!isRecord(input.generator)) {
		addIssue(issues, generatorPath, 'invalid_type', 'Expected a form generator object');
		return undefined;
	}
	assertAllowedKeys(input.generator, ['kind', 'plane', 'outline', 'extent'], generatorPath, issues);
	const kind = readRequiredString(input.generator, 'kind', generatorPath, issues);
	if (kind !== undefined && kind !== 'extrude') {
		addIssue(
			issues,
			`${generatorPath}.kind`,
			'unsupported_generator',
			`Unsupported form generator kind: ${kind}`,
		);
	}
	const planeRaw = readRequiredString(input.generator, 'plane', generatorPath, issues);
	const plane: SceneFormPlane | undefined =
		planeRaw === 'plan' || planeRaw === 'elevation' ? planeRaw : undefined;
	if (planeRaw !== undefined && plane === undefined) {
		addIssue(
			issues,
			`${generatorPath}.plane`,
			'unsupported_plane',
			`Unsupported form plane: ${planeRaw}`,
		);
	}
	const outlinePath = `${generatorPath}.outline`;
	let outline: SceneFormAnchor[] | undefined;
	if (!Array.isArray(input.generator.outline)) {
		addIssue(issues, outlinePath, 'invalid_type', 'Expected an array of outline anchors');
	} else {
		const parsed = input.generator.outline.map((anchor, index) =>
			parseFormAnchor(anchor, `${outlinePath}[${index}]`, issues),
		);
		outline = parsed.every((anchor): anchor is SceneFormAnchor => anchor !== undefined)
			? parsed
			: undefined;
	}
	const extent = readRequiredNumber(input.generator, 'extent', generatorPath, issues);
	if (
		extent !== undefined &&
		(extent < PROFILE_LIMITS.minExtentMeters || extent > PROFILE_LIMITS.maxExtentMeters)
	) {
		addIssue(
			issues,
			`${generatorPath}.extent`,
			'invalid_extent',
			`Extent must be within [${PROFILE_LIMITS.minExtentMeters}, ${PROFILE_LIMITS.maxExtentMeters}] m`,
		);
	}
	const scale = readVec3(input.scale, `${path}.scale`, issues);
	if (scale !== undefined) {
		for (const [index, factor] of scale.entries()) {
			if (factor < PROFILE_LIMITS.minScale || factor > PROFILE_LIMITS.maxScale) {
				addIssue(
					issues,
					`${path}.scale[${index}]`,
					'invalid_scale',
					`A form scale factor must be within [${PROFILE_LIMITS.minScale}, ${PROFILE_LIMITS.maxScale}]`,
				);
			}
		}
	}
	const nextKey = readRequiredNumber(input, 'nextKey', path, issues);
	if (nextKey !== undefined && (!Number.isSafeInteger(nextKey) || nextKey <= 0)) {
		addIssue(
			issues,
			`${path}.nextKey`,
			'invalid_next_key',
			'nextKey must be a positive safe integer',
		);
	}
	if (
		kind === 'extrude' &&
		plane !== undefined &&
		outline !== undefined &&
		extent !== undefined &&
		extent >= PROFILE_LIMITS.minExtentMeters &&
		extent <= PROFILE_LIMITS.maxExtentMeters &&
		scale !== undefined &&
		scale.every(
			(factor) => factor >= PROFILE_LIMITS.minScale && factor <= PROFILE_LIMITS.maxScale,
		) &&
		nextKey !== undefined &&
		Number.isSafeInteger(nextKey) &&
		nextKey > 0
	) {
		const issuesBeforeProfile = issues.length;
		let profile: EvaluatedProfile | undefined;
		try {
			// evaluateProfile performs validation itself; retain its typed issues
			// rather than validating and sampling the same outline twice.
			profile = evaluateProfile(outline);
		} catch (error) {
			if (error instanceof GeometryCoreError && error.issues.length > 0) {
				for (const issue of error.issues)
					addIssue(
						issues,
						outlinePath,
						issue.code,
						`${issue.code} at outline anchors ${issue.anchorKeys.join(', ')}`,
					);
			} else
				addIssue(
					issues,
					outlinePath,
					'invalid_form_body',
					error instanceof Error ? error.message : 'The form body cannot evaluate',
				);
		}
		if (outline.some((anchor) => nextKey <= anchor.key)) {
			addIssue(
				issues,
				`${path}.nextKey`,
				'invalid_next_key',
				'nextKey must be greater than every outline anchor key',
			);
		}
		if (issues.length === issuesBeforeProfile && profile !== undefined) {
			// Admission is the first reader: a source the renderer's own evaluator
			// refuses (for example an extent and a scale whose product leaves the
			// scaled-dimension limits) must not load and then draw nothing.
			try {
				extrudeProfile({
					profile,
					extent,
					scale,
					plane,
				});
			} catch (error) {
				addIssue(
					issues,
					outlinePath,
					'invalid_form_body',
					error instanceof GeometryCoreError
						? error.message
						: 'The form body is outside the admitted limits',
				);
			}
		}
		if (issues.length > issuesBeforeProfile) return undefined;
		return {
			generator: { kind: 'extrude', plane, outline, extent },
			scale,
			nextKey,
		};
	}
	return undefined;
}

export function parseFormEntity(
	input: JsonRecord,
	path: string,
	issues: SceneDocumentIssue[],
	options: EntityParserOptions,
): SceneFormEntity | undefined {
	rejectRoomId(input, 'roomId', path, issues);
	assertAllowedKeys(
		input,
		[
			'kind',
			'id',
			'name',
			'roomId',
			'form',
			'materialId',
			'castShadow',
			'receiveShadow',
			'position',
			'rotation',
			'materialInstanceId',
		],
		path,
		issues,
	);
	const id = readRequiredString(input, 'id', path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	const form = parseFormSource(input.form, `${path}.form`, issues);
	const materialIdRaw = readRequiredString(input, 'materialId', path, issues);
	const materialId =
		materialIdRaw && options.isKnownMaterialId(materialIdRaw)
			? (materialIdRaw as SceneFormEntity['materialId'])
			: undefined;
	if (materialIdRaw && !materialId) {
		addIssue(
			issues,
			`${path}.materialId`,
			'unknown_material',
			`Unknown material: ${materialIdRaw}`,
		);
	}
	const castShadow = readRequiredBoolean(input, 'castShadow', path, issues);
	const receiveShadow = readRequiredBoolean(input, 'receiveShadow', path, issues);
	// A form is a renderable entity like any other, so the shared material
	// instance override is admitted exactly when the caller's policy allows it.
	const materialInstanceId = options.allowMaterialInstance
		? readOptionalString(input, 'materialInstanceId', path, issues)
		: undefined;
	const transform = parseEntityTransform(input, path, issues);
	if (
		!id ||
		!name ||
		!form ||
		!materialId ||
		castShadow === undefined ||
		receiveShadow === undefined ||
		!transform ||
		(options.allowMaterialInstance && 'materialInstanceId' in input && !materialInstanceId)
	) {
		return undefined;
	}
	return {
		kind: 'form',
		id,
		name,
		form,
		materialId,
		castShadow,
		receiveShadow,
		position: transform.position,
		rotation: transform.rotation,
		...(materialInstanceId === undefined ? {} : { materialInstanceId }),
	};
}
