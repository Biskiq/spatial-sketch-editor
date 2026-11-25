import { readFinish } from '../../materials/read';
import type { SceneBoxDimensions, SceneColor, SceneCylinderDimensions, SceneMaterialInstance, ScenePlaneDimensions, ScenePrimitiveEntity, ScenePrimitiveKind, SceneSphereDimensions, SceneTextureAsset } from '../../scene';
import type { ResolvedSceneValidationOptions } from '../../scene-validation';
import type { SceneDocumentIssue } from '../types';
import type { JsonRecord } from '../readers';
import { LOWER_HEX_COLOR_PATTERN, addIssue, assertAllowedKeys, isRecord, readRequiredNumber, readRequiredString } from '../readers';
import { FINISH_COLOR_SLOT_MAX_LENGTH, PROJECT_ASSET_URI_PATTERN } from './contracts';

export function parseTextureAsset(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
	validation: ResolvedSceneValidationOptions
): SceneTextureAsset | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a texture asset object');
		return undefined;
	}
	assertAllowedKeys(input, ['id', 'name', 'uri'], path, issues);
	const id = readRequiredString(input, 'id', path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	const uri = readRequiredString(input, 'uri', path, issues);
	const safeUri = uri !== undefined && validation.isSafeTextureUri(uri);
	if (uri && !safeUri) {
		addIssue(
			issues,
			`${path}.uri`,
			'unsafe_texture_uri',
			'Texture URI must be a safe root-relative public path'
		);
	}
	// One P20 image has exactly one texture record, so every Finish made from
	// the same image shares it and release pinning keeps one URI handle.
	const assetMatch = uri === undefined ? null : PROJECT_ASSET_URI_PATTERN.exec(uri);
	if (id !== undefined && assetMatch !== null && assetMatch[1] !== id) {
		addIssue(
			issues,
			`${path}.id`,
			'texture_id_mismatch',
			`A project texture's id must equal its asset id: ${assetMatch[1]}`
		);
		return undefined;
	}
	if (!id || !name || !uri || !safeUri) return undefined;
	return { id, name, uri };
}


/**
 * A finish colour: a lowercase `#rrggbb` literal or a `{ slot }` follower. The
 * follower is closed against the palette by the unit validator, which is the
 * only reader that holds the palette.
 */
export function parseSceneColor(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[]
): SceneColor | undefined {
	if (typeof input === 'string') {
		if (!LOWER_HEX_COLOR_PATTERN.test(input)) {
			addIssue(issues, path, 'invalid_color', 'Expected a lowercase #rrggbb color string');
			return undefined;
		}
		return input;
	}
	if (!isRecord(input)) {
		addIssue(
			issues,
			path,
			'invalid_type',
			'Expected a lowercase #rrggbb color string or a palette slot reference'
		);
		return undefined;
	}
	assertAllowedKeys(input, ['slot'], path, issues);
	const slot = readRequiredString(input, 'slot', path, issues);
	if (slot === undefined) return undefined;
	if (slot.length > FINISH_COLOR_SLOT_MAX_LENGTH) {
		addIssue(
			issues,
			`${path}.slot`,
			'invalid_value',
			`A palette slot id is at most ${FINISH_COLOR_SLOT_MAX_LENGTH} characters`
		);
		return undefined;
	}
	return { slot };
}


/**
 * Read one Scene 12 material instance through the portable Finish reader.
 *
 * The Scene codec owns Finish identity and the assignment normal form; the
 * grammar itself is the accepted v1 contract, so a second parser here would be
 * a second authority. A catalogue base must name a known catalogue id; a
 * resource base is a digest and is resolved against the resources unit by
 * envelope closure, not by this record reader.
 */
export function parseMaterialInstance(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
	validation: ResolvedSceneValidationOptions
): SceneMaterialInstance | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a Finish object');
		return undefined;
	}
	const read = readFinish(input);
	if (!read.success) {
		for (const issue of read.issues) {
			addIssue(
				issues,
				issue.path === '$' ? path : `${path}${issue.path.slice(1)}`,
				issue.code,
				issue.action ?? issue.code
			);
		}
		return undefined;
	}
	const finish = read.finish;
	if ('catalogue' in finish.base && !validation.isKnownMaterialId(finish.base.catalogue)) {
		addIssue(
			issues,
			`${path}.base.catalogue`,
			'unknown_material',
			`Unknown material: ${finish.base.catalogue}`
		);
		return undefined;
	}
	return finish;
}

export function readPositiveDimension(
	value: JsonRecord,
	key: string,
	path: string,
	issues: SceneDocumentIssue[]
): number | undefined {
	const number = readRequiredNumber(value, key, path, issues);
	if (number === undefined) return undefined;
	if (!Number.isFinite(number) || number <= 0) {
		addIssue(issues, `${path}.${key}`, 'invalid_dimension', `${key} must be a finite number greater than zero`);
		return undefined;
	}
	return number;
}


export function parsePrimitiveDimensions(
	primitive: ScenePrimitiveKind,
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[]
): ScenePrimitiveEntity['dimensions'] | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a dimensions object');
		return undefined;
	}
	if (primitive === 'box') {
		assertAllowedKeys(input, ['width', 'height', 'depth'], path, issues);
		const width = readPositiveDimension(input, 'width', path, issues);
		const height = readPositiveDimension(input, 'height', path, issues);
		const depth = readPositiveDimension(input, 'depth', path, issues);
		if (width === undefined || height === undefined || depth === undefined) return undefined;
		return { width, height, depth } satisfies SceneBoxDimensions;
	}
	if (primitive === 'plane') {
		assertAllowedKeys(input, ['width', 'height'], path, issues);
		const width = readPositiveDimension(input, 'width', path, issues);
		const height = readPositiveDimension(input, 'height', path, issues);
		if (width === undefined || height === undefined) return undefined;
		return { width, height } satisfies ScenePlaneDimensions;
	}
	if (primitive === 'cylinder') {
		assertAllowedKeys(input, ['radius', 'height'], path, issues);
		const radius = readPositiveDimension(input, 'radius', path, issues);
		const height = readPositiveDimension(input, 'height', path, issues);
		if (radius === undefined || height === undefined) return undefined;
		return { radius, height } satisfies SceneCylinderDimensions;
	}
	assertAllowedKeys(input, ['radius'], path, issues);
	const radius = readPositiveDimension(input, 'radius', path, issues);
	if (radius === undefined) return undefined;
	return { radius } satisfies SceneSphereDimensions;
}
