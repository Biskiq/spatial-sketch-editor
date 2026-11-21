/**
 * The mounted route's approved asset leases.
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
	createProjectTextureScope,
	type ProjectTexturePin,
	type ProjectTextureResolution,
	type ProjectTextureScope,
	type TextureDimensions
} from '$lib/render/resources/project-texture-scope';
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
	readonly projectId: string;
	readonly resolveArtwork: (image: ArtworkImage, signal: AbortSignal) => Promise<ArtworkBytes>;
	/** Authenticated project texture bytes for a Finish image (S4b). */
	readonly resolveTexture?: (assetId: string, signal: AbortSignal) => Promise<ProjectTextureResolution>;
	/**
	 * Observe one approved derivative's exact bytes so the route can derive the
	 * target analysis Finish registration reads. It runs before the URLs install;
	 * a failure never blocks the model's own rendering.
	 */
	readonly analyzeModel?: (assetId: string, digest: string, bytes: Uint8Array) => Promise<void> | void;
	readonly notice: StageAssetLeaseNotice;
	/** Deterministic test seams; production uses the existing modules. */
	readonly resolveModels?: typeof resolveApprovedModels;
	readonly createScope?: typeof createArtworkScope;
	readonly createTextureScope?: typeof createProjectTextureScope;
};

export type StageAssetLeases = ReturnType<typeof createStageAssetLeases>;

export function createStageAssetLeases(input: StageAssetLeaseInput) {
	const resolveModels = input.resolveModels ?? resolveApprovedModels;
	const artworkScope = (input.createScope ?? createArtworkScope)(input.resolveArtwork);
	/** Pins from the accepted Scene's `texture` resources; never from a client hint. */
	let texturePins = new Map<string, ProjectTexturePin>();
	let texturePinsSignature = '';
	let textureFailures = $state.raw<ReadonlyMap<string, string>>(new Map());
	let textureRevision = $state(0);
	/** Bumped after a decode so a Card reading dimensions/a preview re-renders. */
	let textureAssetsRevision = $state(0);
	let textureDisposed = false;
	const textureScope: ProjectTextureScope = (input.createTextureScope ?? createProjectTextureScope)({
		scopeId: `project:${input.projectId}`,
		load: (assetId, signal) =>
			input.resolveTexture === undefined
				? Promise.reject(new Error('Finish image storage is unavailable.'))
				: input.resolveTexture(assetId, signal),
		pins: () => texturePins,
		onFailure: (uri, message) => {
			if (textureFailures.has(uri) && textureFailures.get(uri) === message) return;
			const next = new Map(textureFailures);
			next.set(uri, message);
			textureFailures = next;
		},
		onSuccess: (uri) => {
			textureAssetsRevision += 1;
			if (!textureFailures.has(uri)) return;
			const next = new Map(textureFailures);
			next.delete(uri);
			textureFailures = next;
		}
	});

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
		// Texture pins are derived the same way release derives them, from the
		// accepted Scene's resource records. A changed pin set replaces the map the
		// loader checks; unrelated accepts keep it.
		const scene = envelope.units.scene?.data;
		if (scene !== undefined) {
			// Only textures a material actually binds are worth fetching. Removed or
			// replaced Finish images leave their records behind by design (§8.1);
			// eagerly loading the whole history would cost a decode and preview per
			// orphan on every route open.
			const usedTextureIds = new Set<string>();
			for (const material of scene.materials) {
				// The route controller may not execute a package barrel (X1/X2); the
				// canonical enumerator is `finishTextureBindings`, and this is its
				// five-role walk over the same accepted Finish value.
				for (const role of ['color', 'normal', 'roughness', 'occlusion', 'metalness'] as const) {
					const image = material.overrides?.maps?.[role]?.image;
					if (image !== undefined && image !== null && 'textureId' in image) {
						usedTextureIds.add(image.textureId);
					}
				}
			}
			// A resource-backed Finish can draw images inherited from its definition
			// without naming them in an override. Those local mappings are still the
			// faces' bytes, so lease the definition's exact texture records too.
			const materialBases = new Set(
				scene.materials.flatMap((material) => ('material' in material.base ? [material.base.material] : []))
			);
			for (const resource of envelope.units.resources.data.resources) {
				if (resource.kind !== 'material' || resource.material === undefined) continue;
				if (!materialBases.has(resource.id)) continue;
				for (const image of resource.material.images) {
					if ('textureId' in image.source) usedTextureIds.add(image.source.textureId);
				}
			}
			const pinsByUri = new Map<string, ProjectTexturePin>();
			for (const texture of scene.textures) {
				if (!usedTextureIds.has(texture.id)) continue;
				if (!texture.uri.startsWith('/project-assets/')) continue;
				const resource = envelope.units.resources.data.resources.find(
					(candidate) => candidate.kind === 'texture' && candidate.id === texture.id
				);
				if (resource === undefined || resource.pin === null || resource.unresolved !== null) continue;
				pinsByUri.set(texture.uri, {
					hash: resource.pin.hash,
					mime: resource.pin.mime,
					size: resource.pin.size
				});
			}
			const textureSignature = [...pinsByUri]
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([uri, pin]) => `${uri}@${pin.hash}`)
				.join('|');
			if (textureSignature !== texturePinsSignature) {
				texturePinsSignature = textureSignature;
				const byAsset = new Map<string, ProjectTexturePin>();
				for (const [uri, pin] of pinsByUri) byAsset.set(uri.slice('/project-assets/'.length), pin);
				texturePins = byAsset;
				void textureScope.prepare([...pinsByUri.keys()]);
			}
		}
		const pins = approvedModelPins(envelope);
		// An edit that does not change the approved pins keeps the URLs it already
		// has: revoking and re-downloading every derivative on each accepted command
		// would flash the fallback box and re-fetch immutable bytes.
		const signature = pins.map((pin) => `${pin.assetId}@${pin.hash}`).join('|');
		if (signature === installedModelSignature) {
			// A pending request for other pins must not publish over the restored
			// installed map. Invalidating its generation makes its eventual completion
			// stale, so that attempt disposes only the leases it acquired.
			if (inFlight !== null && inFlight.signature !== signature) {
				modelGeneration += 1;
				inFlight = null;
			}
			return;
		}
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
						signal,
						...(input.analyzeModel === undefined
							? {}
							: {
								onBytes: ({ assetId, hash, bytes }) =>
									input.analyzeModel!(assetId, hash, bytes)
							})
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
	/**
	 * One targeted texture Retry: drop that source failure, reload the URI and ask
	 * the Stage to re-bind the items whose textures never arrived.
	 */
	function retryTexture(uri: string): void {
		if (textureDisposed) return;
		textureScope.retry(uri);
		if (textureFailures.has(uri)) {
			const next = new Map(textureFailures);
			next.delete(uri);
			textureFailures = next;
		}
		textureRevision += 1;
	}

	function disposeTextures(): void {
		if (textureDisposed) return;
		textureDisposed = true;
		textureScope.dispose();
	}

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
		disposeTextures();
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
		get textureScope(): ProjectTextureScope {
			return textureScope;
		},
		get textureRevision(): number {
			return textureRevision;
		},
		get textureFailures(): ReadonlyMap<string, string> {
			return textureFailures;
		},
		textureDimensions(assetId: string): TextureDimensions | null {
			void textureAssetsRevision;
			return textureScope.dimensionsOf(assetId);
		},
		textureAspect(assetId: string): number | null {
			void textureAssetsRevision;
			return textureScope.aspectOf(assetId);
		},
		texturePreviewUri(assetId: string): string | null {
			void textureAssetsRevision;
			return textureScope.previewUriOf(assetId);
		},
		textureFailed(uri: string): boolean {
			return textureFailures.has(uri);
		},
		retryTexture,
		resolve,
		disposeArtwork,
		dispose
	};
}
