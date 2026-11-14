/**
 * X1 / decomposition contract A — approved asset leases.
 *
 * These are the lease-lifecycle facts the route used to own inline, exercised
 * through the production controller:
 *
 * 1. an accept that leaves the approved pins unchanged performs no acquisition
 *    and keeps the exact installed URL map;
 * 2. a changed pin set acquires its replacement, keeps the old set live until
 *    the new one installs, then releases it exactly once;
 * 3. a completion that lands after a newer request started releases only its
 *    own result and cannot publish over the newer map;
 * 4. replacement/teardown abort an in-flight read and release what it acquired
 *    exactly once;
 * 5. the Stage artwork scope is a route-lifetime lease released once, while the
 *    model-failure notice clears only the words this resolver wrote.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '@portfolio/project-model/units';
import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import { attachUnitStageSource } from '$lib/authoring/stage/unit-stage-source';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import {
	createStageAssetLeases,
	type StageAssetLeaseInput
} from '$lib/authoring/stage/route/stage-asset-leases.svelte';
import type { ApprovedModelSources } from '$lib/authoring/scene/model-bytes';

const HASH_A = 'sha256-a';
const HASH_B = 'sha256-b';

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

function snapshotWith(
	envelope: ProjectEnvelope,
	contentId: string,
	sessionEpoch = 'session-1'
): StageReadSnapshot {
	return attachUnitStageSource(
		{
			acceptedRevision: { projectId: 'project-1', revisionId: `revision-${contentId}` },
			sourceContentId: contentId,
			canonicalJson: '{}',
			sessionEpoch,
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			compileGeneration: `compile-${contentId}`,
			domain: {} as StageReadSnapshot['domain']
		},
		envelope
	);
}

function approvedSources(
	urls: Record<string, string>,
	failures: Record<string, string> = {}
): ApprovedModelSources & { dispose: ReturnType<typeof vi.fn> } {
	return {
		urls: new Map(Object.entries(urls)),
		failures: new Map(Object.entries(failures)),
		dispose: vi.fn()
	};
}

function artworkScope() {
	const dispose = vi.fn();
	const scope = {
		acquire: vi.fn(),
		dispose
	} as unknown as ArtworkScope;
	return { scope, dispose };
}

function controllerWith(
	overrides: Partial<StageAssetLeaseInput> & {
		resolveModels: StageAssetLeaseInput['resolveModels'];
	}
) {
	const session = createStageSession({ sessionEpoch: 'session-1' });
	const artwork = artworkScope();
	let shown = '';
	const controller = createStageAssetLeases({
		session,
		apiOrigin: '',
		resolveArtwork: async () => ({ bytes: new Uint8Array([1]), mime: 'image/png' }),
		notice: {
			read: () => shown,
			write: (message) => {
				shown = message;
			}
		},
		createScope: () => artwork.scope,
		...overrides
	});
	return {
		controller,
		session,
		artwork,
		get shown() {
			return shown;
		},
		setShown(value: string) {
			shown = value;
		}
	};
}

const A = snapshotWith(envelopeWith([{ assetId: 'model-a', hash: HASH_A }]), 'a');
const B = snapshotWith(envelopeWith([{ assetId: 'model-b', hash: HASH_B }]), 'b');
const C = snapshotWith(envelopeWith([{ assetId: 'model-c', hash: 'sha256-c' }]), 'c');
const D = snapshotWith(envelopeWith([{ assetId: 'model-d', hash: 'sha256-d' }]), 'd');

describe('approved asset leases', () => {
	it('retains the exact URL map when an accept leaves the pins unchanged', async () => {
		const first = approvedSources({ 'model-a': 'blob:a' });
		const resolveModels = vi.fn(async () => first) as unknown as StageAssetLeaseInput['resolveModels'];
		const subject = controllerWith({ resolveModels });

		await subject.controller.resolve(A);
		const installed = subject.controller.urls;
		expect(installed).toBe(first.urls);
		expect(resolveModels).toHaveBeenCalledTimes(1);

		await subject.controller.resolve(A);
		expect(resolveModels).toHaveBeenCalledTimes(1);
		expect(subject.controller.urls).toBe(installed);
		expect(first.dispose).not.toHaveBeenCalled();
	});

	it('acquires a changed pin set, keeps the old set live, then releases it once', async () => {
		const first = approvedSources({ 'model-a': 'blob:a' });
		const second = approvedSources({ 'model-b': 'blob:b' });
		let call = 0;
		let releaseSecond: ((value: ApprovedModelSources) => void) | null = null;
		const resolveModels = (() => {
			call += 1;
			if (call === 1) return Promise.resolve(first);
			return new Promise<ApprovedModelSources>((resolve) => { releaseSecond = resolve; });
		}) as unknown as StageAssetLeaseInput['resolveModels'];
		const subject = controllerWith({ resolveModels });

		await subject.controller.resolve(A);
		expect(subject.controller.urls).toBe(first.urls);

		// The replacement is still resolving: the installed set stays live and the
		// fallback never flashes for models that already have URLs.
		const replacement = subject.controller.resolve(B);
		expect(subject.controller.urls).toBe(first.urls);
		expect(first.dispose).not.toHaveBeenCalled();

		releaseSecond!(second);
		await replacement;
		expect(subject.controller.urls).toBe(second.urls);
		expect(first.dispose).toHaveBeenCalledTimes(1);
		expect(second.dispose).not.toHaveBeenCalled();

		subject.controller.dispose();
		expect(second.dispose).toHaveBeenCalledTimes(1);
		expect(subject.artwork.dispose).toHaveBeenCalledTimes(1);
		subject.controller.dispose();
		expect(second.dispose).toHaveBeenCalledTimes(1);
		expect(subject.artwork.dispose).toHaveBeenCalledTimes(1);
	});

	it('releases a stale completion without publishing it over the newer map', async () => {
		const first = approvedSources({ 'model-a': 'blob:a' });
		const second = approvedSources({ 'model-b': 'blob:b' });
		let call = 0;
		let releaseFirst: ((value: ApprovedModelSources) => void) | null = null;
		let releaseSecond: ((value: ApprovedModelSources) => void) | null = null;
		const resolveModels = (() => {
			call += 1;
			return new Promise<ApprovedModelSources>((resolve) => {
				if (call === 1) releaseFirst = resolve;
				else releaseSecond = resolve;
			});
		}) as unknown as StageAssetLeaseInput['resolveModels'];
		const subject = controllerWith({ resolveModels });

		const firstAttempt = subject.controller.resolve(A);
		const secondAttempt = subject.controller.resolve(B);
		releaseSecond!(second);
		await secondAttempt;
		expect(subject.controller.urls).toBe(second.urls);

		releaseFirst!(first);
		await firstAttempt;
		expect(first.dispose).toHaveBeenCalledTimes(1);
		expect(subject.controller.urls).toBe(second.urls);

		// The stale attempt returned the signature to the installed one, so the
		// unchanged new pins are still retained rather than re-fetched.
		await subject.controller.resolve(B);
		expect(call).toBe(2);
	});

	it('starts an installable resolution for a same-pin replacement that cancelled the in-flight one', async () => {
		const samePins = envelopeWith([{ assetId: 'model-a', hash: HASH_A }]);
		const A = snapshotWith(samePins, 'a', 'session-1');
		const B = snapshotWith(samePins, 'b', 'session-2');
		const cancelled = approvedSources({ 'model-a': 'blob:a' });
		const landed = approvedSources({ 'model-a': 'blob:a' });
		let call = 0;
		let releaseLanded: ((value: ApprovedModelSources) => void) | null = null;
		const resolveModels = ((input: { signal?: AbortSignal }) => {
			call += 1;
			if (call === 1) {
				// The first request is cancelled by the replacement. Its non-installable
				// completion must not suppress a resolution for the new epoch.
				return new Promise<ApprovedModelSources>((resolve) => {
					input.signal?.addEventListener('abort', () => resolve(cancelled));
				});
			}
			return new Promise<ApprovedModelSources>((resolve) => {
				releaseLanded = resolve;
			});
		}) as unknown as StageAssetLeaseInput['resolveModels'];
		const subject = controllerWith({ resolveModels });

		const first = subject.controller.resolve(A);
		subject.session.replace(B);
		const second = subject.controller.resolve(B);
		expect(call).toBe(2);

		await first;
		expect(cancelled.dispose).toHaveBeenCalledTimes(1);
		expect(subject.controller.urls.size).toBe(0);

		releaseLanded!(landed);
		await second;
		expect(subject.controller.urls).toBe(landed.urls);
		expect(landed.dispose).not.toHaveBeenCalled();

		// The same-pin map is now installed for the replacement epoch.
		await subject.controller.resolve(B);
		expect(call).toBe(2);
	});

	it('retains the installed map when a restored source invalidates a changed-pin request', async () => {
		const aPins = envelopeWith([{ assetId: 'model-a', hash: HASH_A }]);
		const installed = approvedSources({ 'model-a': 'blob:a' });
		const changed = approvedSources({ 'model-b': 'blob:b' });
		let call = 0;
		let releaseChanged: ((value: ApprovedModelSources) => void) | null = null;
		const resolveModels = (() => {
			call += 1;
			if (call === 1) return Promise.resolve(installed);
			if (call === 2) {
				return new Promise<ApprovedModelSources>((resolve) => {
					releaseChanged = resolve;
				});
			}
			return Promise.reject(new Error('unchanged pins must not refetch'));
		}) as unknown as StageAssetLeaseInput['resolveModels'];
		const subject = controllerWith({ resolveModels });

		await subject.controller.resolve(snapshotWith(aPins, 'a'));
		const installedUrls = subject.controller.urls;
		expect(installedUrls).toBe(installed.urls);

		// B starts while A is installed. Before B lands, the accepted source returns
		// to A: the installed fast path must invalidate B rather than let it publish.
		const pending = subject.controller.resolve(
			snapshotWith(envelopeWith([{ assetId: 'model-b', hash: HASH_B }]), 'b')
		);
		expect(call).toBe(2);
		const restored = snapshotWith(aPins, 'a-restored');
		await subject.controller.resolve(restored);
		expect(subject.controller.urls).toBe(installedUrls);
		expect(installed.dispose).not.toHaveBeenCalled();

		releaseChanged!(changed);
		await pending;
		expect(subject.controller.urls).toBe(installedUrls);
		expect(changed.dispose).toHaveBeenCalledTimes(1);
		expect(installed.dispose).not.toHaveBeenCalled();

		// The restored A source is unchanged: it retains the exact map without a
		// new resolver call.
		await subject.controller.resolve(restored);
		expect(call).toBe(2);
		expect(subject.controller.urls).toBe(installedUrls);
	});

	it('aborts an in-flight read on replacement and releases its own result once', async () => {
		const acquired = approvedSources({ 'model-a': 'blob:a' });
		const resolveModels = ((input: { signal?: AbortSignal }) =>
			new Promise<ApprovedModelSources>((resolve) => {
				input.signal?.addEventListener('abort', () => resolve(acquired));
			})) as unknown as StageAssetLeaseInput['resolveModels'];
		const subject = controllerWith({ resolveModels });

		const attempt = subject.controller.resolve(A);
		subject.session.replace(B);
		await attempt;

		expect(acquired.dispose).toHaveBeenCalledTimes(1);
		expect(subject.controller.urls.size).toBe(0);
	});

	it('releases artwork exactly once and clears only its own failure notice', async () => {
		const failedA = approvedSources({ 'model-a': 'blob:a' }, { 'model-a': 'The approved model is unavailable.' });
		const succeededB = approvedSources({ 'model-b': 'blob:b' });
		const failedC = approvedSources({ 'model-c': 'blob:c' }, { 'model-c': 'The approved model is unavailable.' });
		const succeededD = approvedSources({ 'model-d': 'blob:d' });
		let call = 0;
		const resolveModels = vi.fn(async () => [failedA, succeededB, failedC, succeededD][call++]!) as unknown as StageAssetLeaseInput['resolveModels'];
		const subject = controllerWith({ resolveModels });

		await subject.controller.resolve(A);
		expect(subject.shown).toBe('The approved model is unavailable.');
		expect(subject.controller.failures.get('model-a')).toBe('The approved model is unavailable.');

		// An unrelated notice is not this resolver's to clear.
		subject.setShown('Something else happened.');
		await subject.controller.resolve(B);
		expect(subject.shown).toBe('Something else happened.');

		subject.setShown('The approved model is unavailable.');
		await subject.controller.resolve(C);
		await subject.controller.resolve(D);
		expect(subject.shown).toBe('');
		expect(subject.controller.failures.size).toBe(0);

		subject.controller.disposeArtwork();
		expect(subject.artwork.dispose).toHaveBeenCalledTimes(1);
		subject.controller.dispose();
		expect(subject.artwork.dispose).toHaveBeenCalledTimes(1);
	});
});
