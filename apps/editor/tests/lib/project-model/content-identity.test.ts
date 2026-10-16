/**
 * T1.P01.S02 / T1.P01.S03 — the single current-source content identity.
 *
 * `SnapshotIdentity.sourceContentId` is the **content** half of what one supplied
 * snapshot is: `acceptedRevision` is an acceptance event, and the content identity
 * is what `exact {contentRevision}` names. The boot host, local acceptance and the
 * later conditional Save all read it, so the properties the suite pins are the ones
 * that keep them from disagreeing:
 *
 * 1. it is the strict writer's canonical bytes, hashed by the package's one hash
 *    primitive — no second serializer;
 * 2. it is invariant to input key order and whitespace (the permuted payload still
 *    validates, so the invariance is a property of the writer and not of a
 *    shortcut);
 * 3. equal content gives equal identity, different content gives different
 *    identity, and an Undo back to earlier contents restores the earlier identity;
 * 4. acceptance and allocation bookkeeping cannot enter it, because the writer
 *    refuses a document that carries them.
 */
import { describe, expect, it } from 'vitest';
import {
	computeSourceContentId,
	createEmptyWallFirstProject,
	serializeProject,
	sha256Bytes,
	validateProject,
	type ProjectDocument
} from '@portfolio/project-model';

/** Rebuild a JSON value with every object's keys in reverse order. */
function reversedKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(reversedKeys);
	if (typeof value === 'object' && value !== null) {
		const record = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(record).reverse()) out[key] = reversedKeys(record[key]);
		return out;
	}
	return value;
}

function project(): ProjectDocument {
	return createEmptyWallFirstProject({ id: 'project-a', name: 'Studio' });
}

describe('current-source content identity', () => {
	it('is the strict writer canonical bytes through the package hash primitive', async () => {
		const source = project();
		const identity = await computeSourceContentId(source);
		expect(identity).toMatch(/^sha256-[0-9a-f]{64}$/);
		expect(identity).toBe(await sha256Bytes(new TextEncoder().encode(serializeProject(source))));
	});

	it('is invariant to input key order and whitespace', async () => {
		const source = project();
		const canonical = serializeProject(source);
		const permuted = JSON.stringify(reversedKeys(JSON.parse(canonical)), null, 4);
		expect(permuted).not.toBe(canonical);
		// The permuted payload is still the same canonical document, so the invariance
		// is the writer's, not a normalizing shortcut in the identity.
		const parsed = JSON.parse(permuted) as unknown;
		expect(validateProject(parsed).success).toBe(true);
		expect(await computeSourceContentId(parsed)).toBe(await computeSourceContentId(source));
	});

	it('is stable across a serialize/reparse round trip', async () => {
		const source = project();
		const reparsed = JSON.parse(serializeProject(source)) as unknown;
		expect(await computeSourceContentId(reparsed)).toBe(await computeSourceContentId(source));
	});

	it('gives distinct identities to distinct authored contents and restores the earlier one on Undo', async () => {
		const source = project();
		const original = await computeSourceContentId(source);
		const edited: ProjectDocument = { ...source, name: 'Studio (edited)' };
		const editedIdentity = await computeSourceContentId(edited);
		expect(editedIdentity).not.toBe(original);
		// Undo restores the authored contents, so the content identity returns to the
		// earlier value even though the acceptance revision would be fresh.
		expect(await computeSourceContentId({ ...edited, name: 'Studio' })).toBe(original);
	});

	it('cannot absorb acceptance or allocation bookkeeping', async () => {
		const source = project();
		// The strict writer refuses unknown keys, so a document carrying accepted-revision
		// metadata cannot be digested at all: no acceptance token can leak into content.
		await expect(
			computeSourceContentId({ ...source, acceptedRevision: { projectId: 'project-a', revisionId: 'rev-1' } })
		).rejects.toThrow();
		await expect(computeSourceContentId({ ...source, id: 'not a valid id!' })).rejects.toThrow();
		await expect(computeSourceContentId(undefined)).rejects.toThrow();
	});
});
