/**
 * T5.P01.S04 — the `form` library payload and its detached Scene insertion.
 *
 * These are the claims the editor, API and planner share:
 *
 * 1. **One canonical identity.** The strict reader and the canonical writer
 *    agree byte for byte, and the content id is the SHA-256 of exactly those
 *    bytes. Unknown keys, another format number and an unevaluable body refuse.
 * 2. **Source verbatim.** Saving a form copies its outline controls, keys,
 *    per-axis scale and `nextKey`; insertion writes that source unchanged.
 * 3. **Detached copies.** A copy allocates a new entity id, carries no library
 *    reference, and leaves both the payload and any other copy untouched.
 * 4. **Truthful contact.** A captured contact that disagrees with the saved
 *    source's own evaluation refuses before a candidate exists.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

import {
	canonicalFormLibraryBytes,
	canonicalFormLibraryPayload,
	formLibraryContentId,
	formLibraryPayloadFromEntity,
	readFormLibraryBytes,
	readFormLibraryPayload,
	FORM_LIBRARY_MAX_CANONICAL_BYTES,
	type FormLibraryPayload
} from '@portfolio/project-model/library';
import { formMeshDigest } from '@portfolio/geometry-core';
import {
	createEmptyWallFirstLayoutDocument,
	mintLayoutIdCapture,
	planWallChain
} from '@portfolio/layout-core';
import {
	evaluateSceneForm,
	planPlaceFormCopy,
	type SceneOperationContext
} from '@portfolio/project-model/scene-planning';
import type { SceneFormEntity, SceneFormSource } from '@portfolio/project-model';
import { SCENE_UNIT_FORMAT_VERSION } from '@portfolio/project-model/units';

const FORM: SceneFormSource = {
	generator: {
		kind: 'extrude',
		plane: 'plan',
		outline: [
			{ key: 4, u: 0, v: 0, smooth: false },
			{ key: 9, u: 2.25, v: 0, smooth: true },
			{ key: 11, u: 2.25, v: 1.5, smooth: false },
			{ key: 12, u: 0, v: 1.5, smooth: true }
		],
		extent: 0.75
	},
	scale: [1, 1.7, 0.8],
	nextKey: 13
};

function payload(overrides: Partial<FormLibraryPayload> = {}): FormLibraryPayload {
	return canonicalFormLibraryPayload({
		formatVersion: 1,
		kind: 'form',
		name: 'Saved plinth',
		form: FORM,
		materialId: 'wood-walnut',
		castShadow: true,
		receiveShadow: false,
		...overrides
	});
}

function source(id = 'form-source'): SceneFormEntity {
	return {
		kind: 'form',
		id,
		name: 'Saved plinth',
		position: [1, 0, 2],
		rotation: [0, 0.3, 0],
		form: FORM,
		materialId: 'wood-walnut',
		castShadow: true,
		receiveShadow: false
	};
}

function supportedLayout() {
	const empty = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline: {
			...empty,
			floor: { ...empty.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
		},
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		capture: mintLayoutIdCapture(),
		levelId: 'floor-1'
	});
	if (planned.kind !== 'success') throw new Error('the library support fixture was refused');
	return planned.document;
}

function context(): SceneOperationContext {
	return {
		layout: supportedLayout(),
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [],
			materials: [],
			entities: []
		},
		sourceContentId: 'sha256-0000000000000000000000000000000000000000000000000000000000000000'
	};
}

describe('form library payload', () => {
	it('writes one canonical payload and derives the content id from exactly those bytes', async () => {
		const item = payload();
		const canonical = canonicalFormLibraryPayload({
			...item,
			name: '  Saved plinth  ',
			form: {
				...item.form,
				generator: { ...item.form.generator, outline: [...item.form.generator.outline].reverse() }
			}
		});
		expect(canonical.name).toBe('Saved plinth');
		// Canonical writing fixes key order but never renumbers authored keys.
		expect(canonical.form.nextKey).toBe(13);
		expect(canonical.form.scale).toEqual([1, 1.7, 0.8]);
		const bytes = canonicalFormLibraryBytes(item);
		expect(new TextDecoder().decode(bytes)).toBe(JSON.stringify(item));
		expect(await formLibraryContentId(item)).toBe(
			`sha256-${createHash('sha256').update(bytes).digest('hex')}`
		);
	});

	it('copies an accepted form entity source exactly, including smooth anchors and scale', () => {
		const item = formLibraryPayloadFromEntity(source());
		expect(item.form).toEqual(FORM);
		expect(item.name).toBe('Saved plinth');
		expect(item.materialId).toBe('wood-walnut');
		expect(item.castShadow).toBe(true);
		expect(item.receiveShadow).toBe(false);
	});

	it('refuses unknown keys, other formats and an unevaluable body by name', () => {
		const unknown = readFormLibraryPayload({ ...payload(), extra: true });
		expect(unknown.success).toBe(false);
		if (!unknown.success) expect(unknown.issues.map((issue) => issue.code)).toContain('unknown_property');

		const other = readFormLibraryPayload({ ...payload(), formatVersion: 2 });
		expect(other.success).toBe(false);
		if (!other.success) expect(other.issues.map((issue) => issue.code)).toContain('unsupported_format_version');

		const malformed = readFormLibraryPayload({
			...payload(),
			form: {
				...FORM,
				generator: {
					...FORM.generator,
					outline: FORM.generator.outline.slice(0, 2)
				}
			}
		});
		expect(malformed.success).toBe(false);

		// A material the catalogue does not know must refuse at Save, not later
		// when its copy enters a project.
		const material = readFormLibraryPayload({ ...payload(), materialId: 'unobtainium' });
		expect(material.success).toBe(false);
		if (!material.success) expect(material.issues.map((issue) => issue.code)).toContain('unknown_material');
	});

	it('verifies received bytes against the pinned content id before parsing', async () => {
		const item = payload();
		const bytes = canonicalFormLibraryBytes(item);
		const good = await readFormLibraryBytes(bytes, { contentId: await formLibraryContentId(item) });
		expect(good.success).toBe(true);
		if (good.success) expect(good.payload).toEqual(item);

		const wrongId = await readFormLibraryBytes(bytes, { contentId: `sha256-${'0'.repeat(64)}` });
		expect(wrongId.success).toBe(false);
		if (!wrongId.success) expect(wrongId.issues[0]?.code).toBe('content_id_mismatch');

		// Equivalent JSON with different whitespace hashes differently and is not
		// the canonical bytes the content id covers; it must never be admitted.
		const pretty = new TextEncoder().encode(
			JSON.stringify(JSON.parse(new TextDecoder().decode(bytes)), null, 2)
		);
		const prettyId = `sha256-${createHash('sha256').update(pretty).digest('hex')}`;
		const nonCanonical = await readFormLibraryBytes(pretty, { contentId: prettyId });
		expect(nonCanonical.success).toBe(false);
		if (!nonCanonical.success) expect(nonCanonical.issues[0]?.code).toBe('non_canonical_payload');

		const tooLarge = await readFormLibraryBytes(
			new Uint8Array(FORM_LIBRARY_MAX_CANONICAL_BYTES + 1)
		);
		expect(tooLarge.success).toBe(false);
		if (!tooLarge.success) expect(tooLarge.issues[0]?.code).toBe('payload_too_large');
	});
});

describe('place-form-copy', () => {
	it('plans one detached copy whose source and digested body equal the saved form', () => {
		const item = payload();
		const before = JSON.stringify(item);
		const result = planPlaceFormCopy({
			context: context(),
			entityId: 'copy-1',
			item,
			worldXZ: [2.5, 3.5],
			yaw: 0.4,
			contactMinY: 0
		});
		expect(result.kind).toBe('candidate');
		if (result.kind !== 'candidate') return;
		expect(result.correspondence).toEqual([{ relation: 'created', entityId: 'copy-1' }]);
		const copy = result.scene.entities[0];
		expect(copy?.kind).toBe('form');
		if (copy?.kind !== 'form') return;
		expect(copy.id).toBe('copy-1');
		expect(copy.form).toEqual(item.form);
		expect(copy.rotation).toEqual([0, 0.4, 0]);
		expect(copy.position).toEqual([2.5, 0, 3.5]);
		expect(copy.materialId).toBe(item.materialId);
		expect(formMeshDigest(evaluateSceneForm(copy.form))).toBe(
			formMeshDigest(evaluateSceneForm(item.form))
		);
		// Neither the payload nor the copy shares mutable source with the other.
		expect(JSON.stringify(item)).toBe(before);
		expect(copy.form).not.toBe(item.form);
		expect(copy.form.generator.outline).not.toBe(item.form.generator.outline);
	});

	it('plans two insertions as two independent entities, never one rewritten copy', () => {
		const item = payload();
		const first = planPlaceFormCopy({
			context: context(),
			entityId: 'copy-1',
			item,
			worldXZ: [2.5, 3.5],
			yaw: 0,
			contactMinY: 0
		});
		const second = planPlaceFormCopy({
			context: context(),
			entityId: 'copy-2',
			item,
			worldXZ: [4, 2],
			yaw: 0,
			contactMinY: 0
		});
		expect(first.kind).toBe('candidate');
		expect(second.kind).toBe('candidate');
		if (first.kind !== 'candidate' || second.kind !== 'candidate') return;
		const firstCopy = first.scene.entities[0];
		const secondCopy = second.scene.entities[0];
		expect(firstCopy?.id).toBe('copy-1');
		expect(secondCopy?.id).toBe('copy-2');
		if (firstCopy?.kind !== 'form' || secondCopy?.kind !== 'form') return;
		expect(firstCopy.form).toEqual(item.form);
		expect(secondCopy.form).toEqual(item.form);
		expect(firstCopy.form).not.toBe(secondCopy.form);
		expect(firstCopy.form.generator.outline).not.toBe(secondCopy.form.generator.outline);
	});

	it('refuses a captured contact that disagrees with the saved source', () => {
		const result = planPlaceFormCopy({
			context: context(),
			entityId: 'copy-1',
			item: payload(),
			worldXZ: [2.5, 3.5],
			yaw: 0,
			contactMinY: 0.5
		});
		expect(result.kind).toBe('rejected');
		if (result.kind === 'rejected') {
			expect(result.diagnostics.some((entry) => entry.message === 'contactMinY')).toBe(true);
		}
	});

	it('refuses an already-used allocated id and a malformed payload', () => {
		const withCopy = context();
		const used = planPlaceFormCopy({
			context: {
				...withCopy,
				scene: {
					...withCopy.scene,
					entities: [source('copy-1')]
				}
			},
			entityId: 'copy-1',
			item: payload(),
			worldXZ: [2.5, 3.5],
			yaw: 0,
			contactMinY: 0
		});
		expect(used.kind).toBe('rejected');
		if (used.kind === 'rejected') {
			expect(used.diagnostics.some((entry) => entry.message === 'duplicate-entity-id')).toBe(true);
		}

		const malformed = planPlaceFormCopy({
			context: context(),
			entityId: 'copy-2',
			item: { ...payload(), form: { ...FORM, generator: { ...FORM.generator, extent: 0 } } },
			worldXZ: [2.5, 3.5],
			yaw: 0,
			contactMinY: 0
		});
		expect(malformed.kind).toBe('rejected');
	});
});
