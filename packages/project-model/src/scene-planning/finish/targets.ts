/** Target facts, model images and surface references for Finish registration. */

import { resolveLayoutSurface, surfaceKey } from '@portfolio/layout-core/plan';
import { type PlannerRequest } from '../../f4/types';
import { shippedImage } from '../../materials/catalogue';
import { type TargetDraw, type TargetFacts } from '../../materials/types';
import { type SceneSurfaceFinish, type SceneSurfaceRef, type SceneTextureAsset } from '../../scene';
import { type Result } from './context';
import { FINISH_PATCH_FIELDS, type FinishPatchEdit, type FinishPatchField } from './patch';
import { TARGET_SUBJECT_MAX_LENGTH, readIndexPair, readMetrePair } from './payload';
import { refuse } from './shared';
import {
	finishTextureResource,
	finishTextureUri,
	sameFinishTexturePin,
	type FinishTexturePin,
} from '../texture-resource';
import { ShapeReader } from '../../strict-shape';
import { type ProjectEnvelope, type TypedResource } from '../../units/types';

export function readTargetFacts(
	reader: ShapeReader,
	raw: unknown,
	path: string,
): TargetFacts[] | null {
	if (!Array.isArray(raw)) {
		reader.problem(path, 'invalid-value', `${path} must be an array of target facts`);
		return null;
	}
	const facts: TargetFacts[] = [];
	const subjects = new Set<string>();
	for (const [index, item] of raw.entries()) {
		const at = `${path}[${index}]`;
		const record = reader.object(item, at, ['subject', 'geometryRevision', 'metricBasis', 'draws']);
		if (record === null) return null;
		const subject = reader.string(record.subject, `${at}.subject`);
		const geometryRevision = reader.string(record.geometryRevision, `${at}.geometryRevision`);
		if (subject === null || geometryRevision === null) return null;
		if (subject.length === 0 || subject.length > TARGET_SUBJECT_MAX_LENGTH) {
			reader.problem(
				`${at}.subject`,
				'invalid-value',
				`${at}.subject must be 1-${TARGET_SUBJECT_MAX_LENGTH} characters`,
			);
			return null;
		}
		if (subjects.has(subject)) {
			reader.problem(at, 'duplicate-id', `${path} must not repeat a target subject`);
			return null;
		}
		subjects.add(subject);
		let metricBasis: TargetFacts['metricBasis'];
		if (record.metricBasis !== undefined) {
			const basis = reader.object(record.metricBasis, `${at}.metricBasis`, [
				'uvMeters',
				'surfaceMeters',
			]);
			if (basis === null) return null;
			const uvMeters = readMetrePair(reader, basis.uvMeters, `${at}.metricBasis.uvMeters`);
			const surfaceMeters = readMetrePair(
				reader,
				basis.surfaceMeters,
				`${at}.metricBasis.surfaceMeters`,
			);
			if (uvMeters === null || surfaceMeters === null) return null;
			metricBasis = { uvMeters, surfaceMeters };
		}
		if (!Array.isArray(record.draws)) {
			reader.problem(`${at}.draws`, 'invalid-value', `${at}.draws must be an array`);
			return null;
		}
		const draws: TargetDraw[] = [];
		const drawKeys = new Set<string>();
		for (const [drawIndex, draw] of record.draws.entries()) {
			const drawPath = `${at}.draws[${drawIndex}]`;
			const drawRecord = reader.object(draw, drawPath, [
				'drawKey',
				'uvSets',
				'normalFrameSets',
				'invalidGeometry',
			]);
			if (drawRecord === null) return null;
			const drawKey = reader.string(drawRecord.drawKey, `${drawPath}.drawKey`);
			if (drawKey === null) return null;
			if (drawKeys.has(drawKey)) {
				reader.problem(drawPath, 'duplicate-id', `${at}.draws must not repeat a draw key`);
				return null;
			}
			drawKeys.add(drawKey);
			const uvSets = readIndexPair(reader, drawRecord.uvSets, `${drawPath}.uvSets`);
			const normalFrameSets = readIndexPair(
				reader,
				drawRecord.normalFrameSets,
				`${drawPath}.normalFrameSets`,
			);
			if (uvSets === null || normalFrameSets === null) return null;
			if (drawRecord.invalidGeometry !== undefined && drawRecord.invalidGeometry !== true) {
				reader.problem(
					`${drawPath}.invalidGeometry`,
					'invalid-value',
					`${drawPath}.invalidGeometry may only be true`,
				);
				return null;
			}
			draws.push({
				drawKey,
				uvSets: uvSets.filter((set) => set === 0 || set === 1),
				normalFrameSets: normalFrameSets.filter((set) => set === 0 || set === 1),
				...(drawRecord.invalidGeometry === true ? { invalidGeometry: true as const } : {}),
			});
		}
		facts.push({
			subject,
			geometryRevision,
			...(metricBasis === undefined ? {} : { metricBasis }),
			draws,
		});
	}
	return facts;
}

export type RegisterImageInput = {
	readonly hash: string;
	readonly source: { readonly textureId: string } | { readonly shipped: string };
	readonly texture?: {
		readonly name: string;
		readonly pin: { readonly hash: string; readonly mime: string; readonly size: number };
	};
};

export function readRegisterImages(
	reader: ShapeReader,
	raw: unknown,
	path: string,
): RegisterImageInput[] | null {
	if (!Array.isArray(raw)) {
		reader.problem(path, 'invalid-value', `${path} must be an array of image bindings`);
		return null;
	}
	const images: RegisterImageInput[] = [];
	for (const [index, item] of raw.entries()) {
		const at = `${path}[${index}]`;
		const record = reader.object(item, at, ['hash', 'source', 'texture']);
		if (record === null) return null;
		const hash = reader.string(record.hash, `${at}.hash`);
		if (hash === null || !/^sha256-[0-9a-f]{64}$/.test(hash)) {
			if (hash !== null)
				reader.problem(`${at}.hash`, 'invalid-value', `${at}.hash must be a sha256 identity`);
			return null;
		}
		const sourceRecord = reader.object(record.source, `${at}.source`, ['textureId', 'shipped']);
		if (sourceRecord === null) return null;
		const hasTexture = 'textureId' in sourceRecord;
		const hasShipped = 'shipped' in sourceRecord;
		if (hasTexture === hasShipped) {
			reader.problem(
				`${at}.source`,
				'invalid-local-image',
				`${at}.source must name exactly one textureId or shipped image`,
			);
			return null;
		}
		let source: RegisterImageInput['source'];
		if (hasTexture) {
			const textureId = reader.opaqueId(sourceRecord.textureId, `${at}.source.textureId`);
			if (textureId === null) return null;
			source = { textureId };
		} else {
			const shipped = reader.string(sourceRecord.shipped, `${at}.source.shipped`);
			if (shipped === null || shipped.length === 0) return null;
			source = { shipped };
		}
		let texture: RegisterImageInput['texture'];
		if (record.texture !== undefined) {
			if (!hasTexture) {
				reader.problem(`${at}.texture`, 'invalid-value', `${at}.texture needs a textureId source`);
				return null;
			}
			const textureRecord = reader.object(record.texture, `${at}.texture`, ['name', 'pin']);
			if (textureRecord === null) return null;
			const name = reader.string(textureRecord.name, `${at}.texture.name`);
			const pinRecord = reader.object(textureRecord.pin, `${at}.texture.pin`, [
				'hash',
				'mime',
				'size',
			]);
			if (name === null || pinRecord === null) return null;
			const pinHash = reader.string(pinRecord.hash, `${at}.texture.pin.hash`);
			const pinMime = reader.string(pinRecord.mime, `${at}.texture.pin.mime`);
			const pinSize = reader.number(pinRecord.size, `${at}.texture.pin.size`);
			if (pinHash === null || pinMime === null || pinSize === null) return null;
			texture = { name, pin: { hash: pinHash, mime: pinMime, size: pinSize } };
		}
		images.push({ hash, source, ...(texture === undefined ? {} : { texture }) });
	}
	return images;
}

/**
 * Stage one material image binding against the Scene texture records and the
 * typed resources. A `texture` entry installs its record and pin (when `allowAdd`);
 * without one, the record and pin must already agree. Mutates the arrays; returns
 * a refusal or `null`.
 */
export function stageMaterialImage(
	image: RegisterImageInput,
	textures: SceneTextureAsset[],
	resources: TypedResource[],
	addedTextureResources: TypedResource[],
	allowAdd: boolean,
): { readonly message: string; readonly code: string } | null {
	if ('shipped' in image.source) {
		const shipped = shippedImage(image.source.shipped);
		if (shipped === undefined || shipped.hash !== image.hash) {
			return {
				message: 'A shipped material image is not in the frozen catalogue at that digest.',
				code: 'image-static-unknown',
			};
		}
		return null;
	}
	const assetId = image.source.textureId;
	const existingTexture = textures.find((texture) => texture.id === assetId);
	const existingResource = resources.find(
		(resource) => resource.kind === 'texture' && resource.id === assetId,
	);
	if (image.texture === undefined) {
		if (existingTexture === undefined || existingTexture.uri !== finishTextureUri(assetId)) {
			return {
				message: `Material image "${assetId}" has no agreeing Scene texture record. Import the image first.`,
				code: 'texture-mismatch',
			};
		}
		if (existingResource === undefined || existingResource.pin?.hash !== image.hash) {
			return {
				message: `Material image "${assetId}" is not pinned at that digest. Import the image first.`,
				code: 'texture-mismatch',
			};
		}
		return null;
	}
	const pin = {
		hash: image.texture.pin.hash,
		mime: image.texture.pin.mime,
		size: image.texture.pin.size,
		locator: finishTextureUri(assetId),
	} satisfies FinishTexturePin;
	const textureResource = finishTextureResource({ assetId, pin });
	if (textureResource === null) {
		return {
			message: `Material image "${assetId}" is not an admissible project image.`,
			code: 'texture-mismatch',
		};
	}
	if (image.hash !== pin.hash) {
		return {
			message: `Material image "${assetId}" is bound to a different digest than its pin.`,
			code: 'image-pin-conflict',
		};
	}
	if (existingTexture === undefined && allowAdd) {
		textures.push({ id: assetId, name: image.texture.name, uri: finishTextureUri(assetId) });
	} else if (existingTexture !== undefined && existingTexture.uri !== finishTextureUri(assetId)) {
		return {
			message: `Material image "${assetId}" is already recorded at another URI.`,
			code: 'texture-mismatch',
		};
	}
	if (existingResource === undefined && allowAdd) {
		resources.push(textureResource);
		addedTextureResources.push(textureResource);
	} else if (
		existingResource !== undefined &&
		(existingResource.kind !== 'texture' ||
			!sameFinishTexturePin(existingResource.pin, textureResource.pin))
	) {
		return {
			message: `Material image "${assetId}" is already pinned to other bytes.`,
			code: 'image-pin-conflict',
		};
	}
	return null;
}

/** Optional recipe derivation carried by the two assign commands. */
export type FinishAssignDerive = {
	readonly edits: readonly FinishPatchEdit[];
	readonly identity: 'reuse' | 'fresh';
};

/** Read a typed Finish patch. Values are judged after application by the strict reader. */
export function readPatchEdits(
	reader: ShapeReader,
	raw: unknown,
	path: string,
	allowEmpty = false,
): FinishPatchEdit[] | null {
	if (!Array.isArray(raw) || (!allowEmpty && raw.length === 0)) {
		reader.problem(
			path,
			'invalid-value',
			allowEmpty
				? `${path} must be a list of field edits`
				: `${path} must be a non-empty list of field edits`,
		);
		return null;
	}
	const edits: FinishPatchEdit[] = [];
	for (const [index, item] of raw.entries()) {
		const at = `${path}[${index}]`;
		const record = reader.object(item, at, ['field', 'op', 'value']);
		if (record === null) return null;
		const field = reader.tag(
			record.field,
			`${at}.field`,
			FINISH_PATCH_FIELDS,
		) as FinishPatchField | null;
		const op = reader.tag(record.op, `${at}.op`, ['set', 'disable', 'reset']);
		if (field === null || op === null) return null;
		if (op === 'set') {
			if (!('value' in record)) {
				reader.problem(`${at}.value`, 'missing-field', `${at}.value is required to set a field`);
				return null;
			}
			edits.push({ field, op, value: record.value });
			continue;
		}
		if ('value' in record) {
			reader.problem(`${at}.value`, 'invalid-value', `${at}.value is only read by "set"`);
			return null;
		}
		if (op === 'disable') {
			if (!field.startsWith('maps.')) {
				reader.problem(`${at}.op`, 'invalid-value', `${at}: only a map can be disabled`);
				return null;
			}
			edits.push({ field: field as `maps.${import('../../materials/types').MapRole}`, op });
			continue;
		}
		edits.push({ field, op: 'reset' });
	}
	return edits;
}

/** Read an optional assign `derive` clause. */
export function readAssignDerive(
	reader: ShapeReader,
	raw: unknown,
	path: string,
): FinishAssignDerive | null {
	if (raw === undefined) return null;
	const record = reader.object(raw, path, ['edits', 'identity']);
	if (record === null) return null;
	const identity = reader.tag(record.identity, `${path}.identity`, ['reuse', 'fresh']) as
		| 'reuse'
		| 'fresh'
		| null;
	const edits = readPatchEdits(reader, record.edits, `${path}.edits`, true);
	if (identity === null || edits === null) return null;
	return { edits, identity };
}

/** Read a list of Finish user keys (`entity:<id>` / `surface:<key>`). */
export function readUserKeys(reader: ShapeReader, raw: unknown, path: string): string[] | null {
	if (!Array.isArray(raw)) {
		reader.problem(path, 'invalid-value', `${path} must be a list of Finish user keys`);
		return null;
	}
	const keys: string[] = [];
	for (const [index, entry] of raw.entries()) {
		if (typeof entry !== 'string' || !/^(entity|surface):.+$/.test(entry)) {
			reader.problem(
				`${path}[${index}]`,
				'invalid-value',
				`${path}[${index}] must be a Finish user key`,
			);
			return null;
		}
		if (keys.includes(entry)) {
			reader.problem(`${path}[${index}]`, 'duplicate-id', `${path} must not repeat a user`);
			return null;
		}
		keys.push(entry);
	}
	return keys;
}

export function readSurfaceRefs(
	reader: ShapeReader,
	raw: unknown,
	path: string,
): SceneSurfaceRef[] | null {
	if (!Array.isArray(raw) || raw.length === 0) {
		reader.problem(
			path,
			'invalid-value',
			`${path} must be a non-empty array of surface references`,
		);
		return null;
	}
	const refs: SceneSurfaceRef[] = [];
	const seen = new Set<string>();
	for (const [index, item] of raw.entries()) {
		const at = `${path}[${index}]`;
		if (typeof item !== 'object' || item === null || Array.isArray(item)) {
			reader.problem(at, 'invalid_type', `${at} must be a tagged Layout surface reference`);
			continue;
		}
		const kind = (item as Record<string, unknown>).kind;
		if (
			kind !== 'wall-side' &&
			kind !== 'room-floor' &&
			kind !== 'room-lid' &&
			kind !== 'region-face'
		) {
			reader.problem(
				`${at}.kind`,
				'unknown_surface_kind',
				`${at}.kind is not admitted by Scene 12`,
			);
			continue;
		}
		const record = reader.object(
			item,
			at,
			kind === 'wall-side'
				? ['kind', 'wallId', 'side']
				: kind === 'region-face'
					? ['kind', 'regionId', 'face']
					: ['kind', 'roomId'],
		);
		if (record === null) continue;
		let ref: SceneSurfaceRef | null = null;
		if (kind === 'wall-side') {
			const wallId = reader.opaqueId(record.wallId, `${at}.wallId`);
			const side = reader.tag(record.side, `${at}.side`, ['left', 'right']);
			if (wallId !== null && side !== null) ref = { kind, wallId, side: side as 'left' | 'right' };
		} else if (kind === 'region-face') {
			const regionId = reader.opaqueId(record.regionId, `${at}.regionId`);
			const rawFace = record.face;
			const face = rawFace === 'top' || rawFace === 'underside' ? rawFace : null;
			if (face === null) {
				reader.problem(
					`${at}.face`,
					'unknown_surface_face',
					`${at}.face must be 'top' or 'underside'; a region edge has no Finish`,
				);
			}
			if (regionId !== null && face !== null) ref = { kind, regionId, face };
		} else {
			const roomId = reader.opaqueId(record.roomId, `${at}.roomId`);
			if (roomId !== null) ref = { kind, roomId };
		}
		if (ref === null) continue;
		const key = surfaceKey(ref);
		if (seen.has(key)) {
			reader.problem(at, 'duplicate-surface', `${path} must not repeat a surface`);
			continue;
		}
		seen.add(key);
		refs.push(ref);
	}
	return reader.issues.length > 0 ? null : refs;
}

/** The qualified F.1 target a Scene-owned surface assignment must address. */
export function surfaceTargetComponent(surface: SceneSurfaceRef): {
	kind: 'wall' | 'room' | 'region';
	id: string;
	componentId: string;
} {
	switch (surface.kind) {
		case 'wall-side':
			return { kind: 'wall', id: surface.wallId, componentId: `side:${surface.side}` };
		case 'room-floor':
			return { kind: 'room', id: surface.roomId, componentId: 'floor' };
		case 'room-lid':
			return { kind: 'room', id: surface.roomId, componentId: 'lid' };
		case 'region-face':
			return { kind: 'region', id: surface.regionId, componentId: surface.face };
	}
}

/** The refusal for a surface target that is not the exact qualified reference, or a surface that is gone. */
export function surfaceTargetProblem(
	target: PlannerRequest<ProjectEnvelope>['intent']['targets'][number],
	surface: SceneSurfaceRef,
	layoutUnit: ProjectEnvelope['units']['layout'],
): Result | null {
	const layout = layoutUnit.data;
	const expected = surfaceTargetComponent(surface);
	if (
		target.domain !== 'layout' ||
		target.subject.kind !== expected.kind ||
		target.subject.id !== expected.id ||
		target.componentId !== expected.componentId ||
		target.capabilityId !== null ||
		target.instancePath.length !== 0 ||
		target.revision.kind !== 'exact' ||
		target.revision.contentRevision !== layoutUnit.header.contentRevision ||
		target.location.kind !== 'layout-location' ||
		target.location.levelId !== layout.floor.id ||
		target.location.structureInstancePath.length !== 0
	) {
		return refuse('Paint needs an exact qualified reference to each surface.', 'invalid-target');
	}
	if (resolveLayoutSurface(layout, surface) !== 'present') {
		return refuse('That surface changed. Try again.', 'surface_not_present');
	}
	return null;
}

/** Surface Finish assignments in their canonical key order. */
export function sortedSurfaceFinishes(
	assignments: ReadonlyMap<string, SceneSurfaceFinish>,
): SceneSurfaceFinish[] {
	return [...assignments.values()].sort((left, right) => {
		const leftKey = surfaceKey(left.surface);
		const rightKey = surfaceKey(right.surface);
		return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
	});
}

export function sameSequence(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Whether caller-supplied facts are exactly the host analysis. Registration
 * treats the payload as an echo for diagnostics, never as evidence: a set, a
 * draw or a metric basis the host did not derive is a refusal.
 */
export function sameTargetFacts(left: TargetFacts, right: TargetFacts): boolean {
	if (left.subject !== right.subject || left.geometryRevision !== right.geometryRevision)
		return false;
	if (JSON.stringify(left.metricBasis ?? null) !== JSON.stringify(right.metricBasis ?? null))
		return false;
	if (left.draws.length !== right.draws.length) return false;
	const byKey = new Map(right.draws.map((draw) => [draw.drawKey, draw]));
	for (const draw of left.draws) {
		const other = byKey.get(draw.drawKey);
		if (other === undefined) return false;
		if ((draw.invalidGeometry === true) !== (other.invalidGeometry === true)) return false;
		if (!sameSequence([...draw.uvSets].sort().map(String), [...other.uvSets].sort().map(String)))
			return false;
		if (
			!sameSequence(
				[...draw.normalFrameSets].sort().map(String),
				[...other.normalFrameSets].sort().map(String),
			)
		) {
			return false;
		}
	}
	return true;
}
