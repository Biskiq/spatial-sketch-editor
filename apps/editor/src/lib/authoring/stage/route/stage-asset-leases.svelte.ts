/**
 * X1 / decomposition contract A — the mounted route's approved asset leases.
 *
 * The route admitted a source; this controller owns the **leases** that make its
 * approved model derivatives and artwork images renderable. It does not read
 * authored content beyond the accepted snapshot's pins, does not install a
 * candidate and does not own a renderer resource store:
 *
 * - model bytes are resolved from the envelope's `model` resource pins through
 *   the existing `model-bytes` resolver, which keeps one object URL per immutable
 *   content hash and revokes it when its last reference goes;
 * - the Stage artwork scope is the existing `artwork-scope` texture lifetime,
 *   created once for the route and borrowed by the Canvas. Visitor/Preview
 *   consumers keep their own scope; they never revoke this one.
 *
 * **Leases retain across unrelated accepts.** An accepted edit that leaves the
 * approved pins unchanged reuses the installed URL map instead of revoking and
 * re-downloading immutable bytes. A changed pin set acquires its replacement
 * while the installed set stays live, then releases the old set once the new one
 * is installed.
 *
 * **A stale completion releases only what it acquired.** Every resolution runs
 * as a session-bound load, so a replacement or teardown aborts it; the monotone
 * ticket rejects a completion that lands after a newer request started. Neither
 * can replace a newer map, and the discarded result is disposed by the attempt
 * that acquired it — exactly once.
 */
import type { ArtworkImage } from '@portfolio/project-model';

import {
	approvedModelPins,
	resolveApprovedModels,
	type ApprovedModelSources
} from '$lib/authoring/scene/model-bytes';
import {
	createArtworkScope,
	type ArtworkBytes,
	type ArtworkScope
} from '$lib/render/artwork/artwork-scope';
import {
	runBoundLoad,
	type ReplacementEpochToken,
	type StageSession
} from '../stage-session';
import { stageEnvelope } from '../unit-stage-source';
import type { StageReadSnapshot } from '../accepted-read';

export type StageAssetLeaseNotice = {
	/** The notice currently shown, so a resolver clears only words it wrote. */
	read(): string;
	write(message: string): void;
};

export type StageAssetLeaseInput = {
	readonly session: StageSession;
	readonly apiOrigin: string;
	readonly resolveArtwork: (image: ArtworkImage, signal: AbortSignal) => Promise<ArtworkBytes>;
	readonly notice: StageAssetLeaseNotice;
	/** Deterministic test seams; production uses the existing modules. */
	readonly resolveModels?: typeof resolveApprovedModels;
	readonly createScope?: typeof createArtworkScope;
};

export type StageAssetLeases = ReturnType<typeof createStageAssetLeases>;

export function createStageAssetLeases(input: StageAssetLeaseInput) {
	const resolveModels = input.resolveModels ?? resolveApprovedModels;
	const artworkScope = (input.createScope ?? createArtworkScope)(input.resolveArtwork);

	let modelUrls = $state.raw<ReadonlyMap<string, string>>(new Map());
	let modelFailures = $state.raw<ReadonlyMap<string, string>>(new Map());
	let modelResolution: ApprovedModelSources | null = null;
	/** Monotone ticket: only the newest resolution may install its URLs. */
	let modelGeneration = 0;
	/** The pin set the installed URLs were resolved for. */
	let installedModelSignature = '';
	/**
	 * The newest request, bound to the session lifetime it started under. A
	 * same-pin request is reused only while that token is still current: a
	 * replacement cancels the read and must not make the new epoch believe an
	 * installable resolution is already in flight.
	 */
	let inFlight: { readonly signature: string; readonly token: ReplacementEpochToken } | null = null;
	/** The model-failure notice this resolver last set, so an unrelated notice survives. */
	let modelNotice: string | null = null;
	let disposed = false;
	let artworkDisposed = false;

	/**
	 * Resolve every approved creator-model derivative for one accepted source.
	 *
	 * The pins come from the envelope's `model` resources, so this is the same
	 * resolution a fresh reopen performs: a stale import-session URL is never
	 * reused, and a source change releases exactly the URLs the previous source
	 * acquired. A failed model stays a failure and the fallback box carries the
	 * approved footprint; it is never drawn as if the bytes had loaded.
	 */
	async function resolve(snapshot: StageReadSnapshot): Promise<void> {
		if (disposed) return;
		const envelope = stageEnvelope(snapshot);
		const pins = approvedModelPins(envelope);
		// An edit that does not change the approved pins keeps the URLs it already
		// has: revoking and re-downloading every derivative on each accepted command
		// would flash the fallback box and re-fetch immutable bytes.
		const signature = pins.map((pin) => `${pin.assetId}@${pin.hash}`).join('|');
		if (signature === installedModelSignature) return;
		// The same pins may also be retained while a request for them is genuinely
		// current. A request cancelled by a project replacement is not current: the
		// new epoch must start its own installable read instead of returning early.
		if (inFlight !== null && inFlight.signature === signature && input.session.isCurrent(inFlight.token)) return;
		const request = { signature, token: input.session.token() };
		inFlight = request;
		const generation = ++modelGeneration;
		// The installed set stays live while the new one resolves. Shared hashes keep
		// their references through the object-URL ref count, so they are neither
		// revoked nor re-fetched; the old set is released only once its replacement
		// is installed.
		const landed: { value: ApprovedModelSources | null } = { value: null };
		let installable = false;
		try {
			// The session's cancellation registry is the one abort authority: a
			// replacement or teardown ends this read, exactly like a project load.
			// `runBoundLoad` discards the value of a cancelled read, so the value is
			// captured here and released below rather than leaked.
			installable =
				(await runBoundLoad(input.session, async (signal) => {
					landed.value = await resolveModels({
						envelope,
						// The admitted snapshot's own identity, as the baseline resolver read
						// it, rather than a second route-level project fact.
						projectId: snapshot.acceptedRevision.projectId,
						apiOrigin: input.apiOrigin,
						signal
					});
					return landed.value;
				})) !== null;
		} catch {
			// A failed resolution installs nothing: the Stage keeps the installed set
			// and the fallback for any model outside it.
		}
		const resolved = landed.value;
		if (!installable || resolved === null || disposed || generation !== modelGeneration) {
			// A stale, cancelled or failed attempt releases only what it acquired.
			// Only the current attempt may clear the in-flight mark: a newer request
			// already owns it.
			resolved?.dispose();
			if (generation === modelGeneration && inFlight === request) inFlight = null;
			return;
		}
		if (inFlight === request) inFlight = null;
		const previous = modelResolution;
		modelResolution = resolved;
		installedModelSignature = signature;
		modelUrls = resolved.urls;
		modelFailures = resolved.failures;
		previous?.dispose();
		// A model whose bytes are unavailable is stated, not dressed as a loaded
		// mesh: the fallback box carries the approved footprint and this note names
		// the reason. A successful resolution clears only a notice it set itself.
		const failure = resolved.failures.size === 0 ? null : [...resolved.failures.values()][0]!;
		if (failure !== null) {
			modelNotice = failure;
			input.notice.write(failure);
		} else {
			if (modelNotice !== null && input.notice.read() === modelNotice) input.notice.write('');
			modelNotice = null;
		}
	}

	/**
	 * Release the Stage artwork scope at the route's existing teardown point.
	 *
	 * The scope is created with the route and disposed before the facade, as the
	 * baseline route did from its effect cleanup. Idempotent: `dispose()` also
	 * releases it, so a teardown path that reaches this twice releases once.
	 */
	function disposeArtwork(): void {
		if (artworkDisposed) return;
		artworkDisposed = true;
		artworkScope.dispose();
	}

	/** Release every lease this controller acquired. Idempotent. */
	function dispose(): void {
		if (disposed) return;
		disposed = true;
		// A late completion is stale from here on: it must release its own result.
		modelGeneration += 1;
		modelResolution?.dispose();
		modelResolution = null;
		modelUrls = new Map();
		modelFailures = new Map();
		inFlight = null;
		installedModelSignature = '';
		modelNotice = null;
		disposeArtwork();
	}

	return {
		get urls(): ReadonlyMap<string, string> {
			return modelUrls;
		},
		get failures(): ReadonlyMap<string, string> {
			return modelFailures;
		},
		get artworkScope(): ArtworkScope {
			return artworkScope;
		},
		resolve,
		disposeArtwork,
		dispose
	};
}
