import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveApprovedModels, type ApprovedModelSources } from '$lib/authoring/scene/model-bytes';

const HASH_A = `sha256-${'a'.repeat(64)}`;
const HASH_B = `sha256-${'b'.repeat(64)}`;

/** A minimal envelope whose model resources carry approved pins. */
function envelopeWith(pins: readonly { assetId: string; hash: string }[]): ProjectEnvelope {
	return {
		units: {
			resources: {
				data: {
					resources: pins.map(({ assetId, hash }) => ({
						id: assetId,
						kind: 'model',
						pin: { hash },
						unresolved: null,
						model: { source: 'creator' }
					}))
				}
			}
		}
	} as unknown as ProjectEnvelope;
}

function fakeClient() {
	return {
		loadContent: vi.fn(async (_projectId: string, hash: string) => new Uint8Array([hash.length, 1, 2, 3]))
	};
}

describe('approved model bytes: one object URL per hash, shared across live resolutions', () => {
	const held: ApprovedModelSources[] = [];
	let created: string[] = [];
	let revoked: string[] = [];

	afterEach(() => {
		for (const sources of held.splice(0)) sources.dispose();
		vi.restoreAllMocks();
		created = [];
		revoked = [];
	});

	function spyObjectUrls(): void {
		let sequence = 0;
		vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
			const url = `blob:model-bytes-test/${++sequence}`;
			created.push(url);
			return url;
		});
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
			revoked.push(url);
		});
	}

	it('overlapping resolutions over one hash fetch it once and share one URL', async () => {
		spyObjectUrls();
		const client = fakeClient();
		const first = await resolveApprovedModels({
			envelope: envelopeWith([{ assetId: 'a', hash: HASH_A }]),
			projectId: 'project-1',
			apiOrigin: '',
			client
		});
		held.push(first);
		const second = await resolveApprovedModels({
			envelope: envelopeWith([
				{ assetId: 'a', hash: HASH_A },
				{ assetId: 'b', hash: HASH_A }
			]),
			projectId: 'project-1',
			apiOrigin: '',
			client
		});
		held.push(second);

		expect(client.loadContent).toHaveBeenCalledTimes(1);
		expect(created).toHaveLength(1);
		expect(second.urls.get('a')).toBe(first.urls.get('a'));
		expect(second.urls.get('b')).toBe(first.urls.get('a'));
	});

	it('disposing the first resolution leaves the second resolution URL valid', async () => {
		spyObjectUrls();
		const client = fakeClient();
		const first = await resolveApprovedModels({
			envelope: envelopeWith([{ assetId: 'a', hash: HASH_A }]),
			projectId: 'project-1',
			apiOrigin: '',
			client
		});
		const second = await resolveApprovedModels({
			envelope: envelopeWith([
				{ assetId: 'a', hash: HASH_A },
				{ assetId: 'b', hash: HASH_A }
			]),
			projectId: 'project-1',
			apiOrigin: '',
			client
		});
		held.push(second);
		const shared = second.urls.get('a')!;

		first.dispose();
		expect(revoked).toEqual([]);

		second.dispose();
		expect(revoked).toEqual([shared]);
	});

	it('a replaced hash fetches only the new derivative and releases the old one on dispose', async () => {
		spyObjectUrls();
		const client = fakeClient();
		const before = await resolveApprovedModels({
			envelope: envelopeWith([{ assetId: 'a', hash: HASH_A }]),
			projectId: 'project-1',
			apiOrigin: '',
			client
		});
		const after = await resolveApprovedModels({
			envelope: envelopeWith([{ assetId: 'a', hash: HASH_B }]),
			projectId: 'project-1',
			apiOrigin: '',
			client
		});
		held.push(after);
		const previousUrl = before.urls.get('a')!;

		expect(client.loadContent).toHaveBeenCalledTimes(2);
		expect(after.urls.get('a')).not.toBe(previousUrl);

		before.dispose();
		expect(revoked).toEqual([previousUrl]);
	});
});
