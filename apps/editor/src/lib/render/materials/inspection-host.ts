/**
 * The inspection host (E7): one per editor, on the editor's own renderer.
 *
 * It owns no authority. A subject resolves through `inspection-subject`, its
 * material comes from the Canvas's store, its lights from the Canvas's realizer
 * and its pixels from the one inspection draw. The host owns only the schedule:
 *
 * - **One interactive inspection.** A new request replaces the old one at once;
 *   the replaced request publishes nothing further. An unchanged settled request
 *   re-emits its state, so a settled host makes zero draws.
 * - **One render lane.** Interactive work runs before queued thumbnails; each
 *   draw holds its leases only until its readback.
 * - **Generations.** `attach`/`detach` follow the CanvasHost's observed renderer.
 *   Losing it cancels work and drops GPU caches; the last live request and the
 *   queued thumbnails resume on the next attach.
 * - **Sources.** A complete set is leased together. When an image fails, each
 *   view is leased alone so its siblings still read; Retry reloads only failed
 *   images. One draft scope serves every edit over the same source set.
 * - **Thumbnails.** Studio, lit and untreated at any requested size and geometry.
 *   Only a complete `ready` result is cached, under its catalogue or project
 *   scope. Drafts and World readings never enter that cache.
 */
import { Color, Mesh, Scene, type BufferGeometry } from 'three';
import type { BoundInputs, FieldProvenance } from '@portfolio/project-model/materials';
import type { RendererBackend } from '$lib/render/renderer-backend';
import {
	acquireFinishViews,
	type FinishViewGeneration,
	type FinishViewIssue,
	type FinishViewLease,
	type FinishViewSource
} from '$lib/render/resources/finish-views';
import { createFinishChannelMaterial } from '$lib/render/resources/finish-sampling';
import type { LightStore } from '$lib/render/resources/light-store';
import type { MaterialStore } from '$lib/render/resources/material-store';
import type {
	FinishMapRole,
	StandardMaterialDescriptor
} from '$lib/render/resources/material-descriptor';
import type { ProjectTextureScope } from '$lib/render/resources/project-texture-scope';
import { releaseFinishTexture, type TextureLoadScope } from '$lib/render/resources/texture-store';
import { createInspectionGeometry, type InspectionGeometryKind } from './inspection-geometry';
import {
	createInspectionLighting,
	type InspectionLighting,
	type InspectionRig
} from './inspection-lighting';
import {
	INSPECTION_THUMBNAIL_BACKGROUND,
	INSPECTION_THUMBNAIL_EXPOSURE,
	INSPECTION_THUMBNAIL_SIZE,
	createInspectionCamera,
	createInspectionObserver,
	encodeInspectionPng,
	inspectionChannels,
	inspectionThumbnailKey,
	renderInspectionFrame,
	type InspectionChannelState,
	type InspectionFrame,
	type InspectionRenderer
} from './inspection';
import {
	createDraftTextureScope,
	inspectionSubjectIdentity,
	resolveInspectionSubject,
	type InspectionDraft,
	type InspectionSubject,
	type ResolvedInspectionSubject
} from './inspection-subject';
import { readInspectionTexel, type InspectionTexelChannel } from './inspection-texel';
import {
	createWorldInspectionLighting,
	worldLightSampleKey,
	type WorldInspectionLighting,
	type WorldLightSample
} from './inspection-world';

/** A bound on one readback, not a display rule: any size up to it is served. */
export const INSPECTION_MAX_SIZE = 2048;
const THUMBNAIL_QUEUE_LIMIT = 128;
const THUMBNAIL_CACHE_BYTES = 32 * 1024 * 1024;

export type InspectionDisplay = 'lit' | 'unlit-color' | { readonly solo: FinishMapRole };
export type InspectionLightingMode = InspectionRig | { readonly world: WorldLightSample };

export type InspectionRequest = {
	readonly subject: InspectionSubject;
	readonly geometry: InspectionGeometryKind;
	readonly lighting: InspectionLightingMode;
	readonly display: InspectionDisplay;
	readonly sizePx: readonly [width: number, height: number];
};

export type InspectionIssue = {
	readonly code: string;
	readonly role?: FinishMapRole;
	readonly action?: string;
	readonly message?: string;
};

export type InspectionChannelReading = Omit<InspectionChannelState, 'state'> & {
	/** `not-sampled`: bound, but the World's Treatment draws a constant instead. */
	readonly state: InspectionChannelState['state'] | 'not-sampled';
	/** Where the effective binding, or its absence, came from. */
	readonly provenance: FieldProvenance;
	/** The factor or constant that stands when nothing is sampled. */
	readonly constant: string | number | readonly number[];
};

type Drawn = {
	readonly frame: InspectionFrame;
	readonly channels: readonly InspectionChannelReading[];
	readonly recipeKey: string;
};

export type InspectionState =
	| { readonly status: 'pending' }
	| ({ readonly status: 'ready' } & Drawn)
	| ({ readonly status: 'partial'; readonly issues: readonly InspectionIssue[] } & Drawn)
	/** Carries no frame: the consumer clears the previous one. */
	| { readonly status: 'refused'; readonly issues: readonly InspectionIssue[] };

export type InspectionThumbnailRequest = {
	readonly subject: InspectionSubject;
	readonly geometry?: InspectionGeometryKind;
	readonly width?: number;
	readonly height?: number;
};

export type InspectionThumbnail =
	| {
			readonly status: 'ready';
			readonly key: string;
			readonly recipeKey: string;
			readonly frame: InspectionFrame;
			readonly png: Uint8Array;
	  }
	| { readonly status: 'refused'; readonly issues: readonly InspectionIssue[] };

export type InspectionTexel =
	| {
			readonly status: 'ready' | 'partial';
			readonly channels: readonly InspectionTexelChannel[];
			readonly issues: readonly InspectionIssue[];
	  }
	| { readonly status: 'refused'; readonly issues: readonly InspectionIssue[] };

export type InspectionHostStats = {
	readonly attached: boolean;
	/** Completed inspection draws, monotone. */
	readonly draws: number;
	/** View, material and World-light leases held by running work. */
	readonly leases: number;
	readonly queued: number;
	readonly cached: number;
	readonly draftScopes: number;
};

export type InspectionHost = {
	/** Follow `CanvasHost`'s ready renderer; the record's fields are copied. */
	attach(state: {
		readonly renderer: InspectionRenderer;
		readonly backend: RendererBackend;
		readonly viewGeneration: FinishViewGeneration;
	}): void;
	detach(): void;
	observe(request: InspectionRequest, onState: (state: InspectionState) => void): () => void;
	/** Reload the live request's failed images and redraw it (an image Retry). */
	retry(): void;
	thumbnail(request: InspectionThumbnailRequest, signal?: AbortSignal): Promise<InspectionThumbnail>;
	texel(
		request: {
			readonly subject: InspectionSubject;
			readonly geometry: InspectionGeometryKind;
			readonly uv: readonly [number, number];
		},
		signal?: AbortSignal
	): Promise<InspectionTexel>;
	stats(): InspectionHostStats;
	dispose(): void;
};

type Session = {
	readonly renderer: InspectionRenderer;
	readonly backend: RendererBackend;
	readonly viewGeneration: FinishViewGeneration;
	readonly controller: AbortController;
	readonly geometries: Map<InspectionGeometryKind, BufferGeometry>;
	readonly rigs: Map<InspectionRig, InspectionLighting>;
};

type Live = {
	readonly request: InspectionRequest;
	readonly key: string;
	readonly onState: (state: InspectionState) => void;
	/** Failed images are reloaded until this request next settles. */
	retry: boolean;
};

type AcquiredViews = {
	readonly views: FinishViewLease['views'];
	readonly issues: readonly InspectionIssue[];
	readonly lost: boolean;
	readonly held: boolean;
	release(): void;
};

type Waiter = { readonly settle: (result: InspectionThumbnail) => void };

type ThumbnailJob = {
	readonly id: string;
	/** Null for a subject that can never populate the reusable cache. */
	readonly cacheKey: string | null;
	readonly key: string;
	readonly recipeKey: string;
	/** The owner and look a failed image is remembered under; null for a draft. */
	readonly retryKey: string | null;
	readonly request: InspectionRequest;
	readonly waiters: Set<Waiter>;
	readonly controller: AbortController;
};

let hostSerial = 0;

function refused(code: string, action?: string): { status: 'refused'; issues: InspectionIssue[] } {
	return { status: 'refused', issues: [action === undefined ? { code } : { code, action }] };
}

function validSize(size: readonly number[]): boolean {
	return size.every((value) => Number.isInteger(value) && value >= 1 && value <= INSPECTION_MAX_SIZE);
}

/** One signal that follows both; `done` removes its listeners. */
function linkSignals(...signals: readonly AbortSignal[]): { signal: AbortSignal; done(): void } {
	const controller = new AbortController();
	const abort = (): void => controller.abort();
	for (const signal of signals) {
		if (signal.aborted) abort();
		else signal.addEventListener('abort', abort, { once: true });
	}
	return {
		signal: controller.signal,
		done: () => {
			for (const signal of signals) signal.removeEventListener('abort', abort);
		}
	};
}

/** Tolerates a resource whose renderer is already gone. */
function disposeQuietly(resource: { dispose(): void }): void {
	try {
		resource.dispose();
	} catch {
		// The device that owned it took the GPU half with it.
	}
}

function subjectRefusal(subject: InspectionSubject): ReturnType<typeof refused> | null {
	if (subject.kind !== 'finish') return null;
	if (subject.document.materials.some((material) => material.id === subject.finishId)) return null;
	// The Scene adapter would draw its fallback base; inspection must not pass that off as the subject.
	return refused('subject-missing', 'Read the Finish again from the accepted project.');
}

/** Resolver issues, plus a mapped Finish that could not produce a sampling plan. */
function resolutionIssues(resolved: ResolvedInspectionSubject, inputs: BoundInputs): InspectionIssue[] {
	const issues: InspectionIssue[] = [...resolved.issues];
	const mapped = Object.values(inputs.maps).some((binding) => binding !== undefined);
	if (issues.length === 0 && mapped && resolved.untreated.finish === undefined) {
		issues.push({ code: 'sampling-unavailable', action: 'Retry once every bound image is available.' });
	}
	return issues;
}

function channelReadings(
	resolved: ResolvedInspectionSubject,
	inputs: BoundInputs,
	views: FinishViewLease['views'],
	treated: boolean
): InspectionChannelReading[] {
	const surface: StandardMaterialDescriptor = treated ? resolved.lit : resolved.untreated;
	const constants = {
		color: surface.color,
		normal: [0, 0, 1],
		roughness: surface.roughness,
		metalness: surface.metalness,
		occlusion: 1
	} as const;
	return inspectionChannels(resolved.channels, views).map((channel) => {
		let state: InspectionChannelReading['state'] = channel.state;
		if (inputs.maps[channel.role] !== undefined) {
			if (treated) state = 'not-sampled';
			// A bound role whose plan was refused (an absent UV1) is missing, not a constant.
			else if (state === 'constant') state = 'missing-view';
		}
		return {
			...channel,
			state,
			provenance: inputs.provenance.maps[channel.role],
			constant: constants[channel.role]
		};
	});
}

function sourceSetKey(draft: InspectionDraft): string {
	return [...draft.sources.values()]
		.map((source) => `${source.hash}:${source.mime}:${source.length}`)
		.sort()
		.join('|');
}

export function createInspectionHost(options: {
	readonly materials: MaterialStore;
	readonly lights: LightStore;
	readonly thumbnailCacheLimit?: number;
	/** The PNG encoder; the browser's by default. */
	readonly encode?: (frame: InspectionFrame) => Promise<Uint8Array | null>;
}): InspectionHost {
	const { materials, lights } = options;
	const encode = options.encode ?? encodeInspectionPng;
	const cacheLimit = options.thumbnailCacheLimit ?? 128;
	const hostId = `inspection-${(hostSerial += 1)}`;

	let disposed = false;
	let session: Session | null = null;
	let epoch = 0;
	let draws = 0;
	let leases = 0;
	let serial = 0;

	let live: Live | null = null;
	let settled: { readonly key: string; readonly state: InspectionState } | null = null;
	let drawnState: InspectionState | null = null;

	const objectIds = new WeakMap<object, number>();
	/** The live draft's scope, kept across edits that leave its source set alone. */
	let draftScope: { readonly key: string; draft: InspectionDraft; readonly scope: ProjectTextureScope } | null = null;
	/** Scopes of one-shot jobs, so disposal can end their reads. */
	const jobScopes = new Set<ProjectTextureScope>();

	const queue: ThumbnailJob[] = [];
	const jobs = new Map<string, ThumbnailJob>();
	const cache = new Map<string, InspectionThumbnail & { status: 'ready' }>();
	let cacheBytes = 0;
	/** Looks whose image failed: their next thumbnail request reloads it. */
	const failedLooks = new Set<string>();

	// The render lane.
	let busy = false;
	const laneWaiters: (() => void)[] = [];
	let pumpScheduled = false;

	function schedulePump(): void {
		if (pumpScheduled || disposed) return;
		pumpScheduled = true;
		setTimeout(() => {
			pumpScheduled = false;
			void pumpThumbnails();
		}, 0);
	}

	function releaseLane(): void {
		const next = laneWaiters.shift();
		if (next !== undefined) {
			next();
			return;
		}
		busy = false;
		schedulePump();
	}

	function enterLane(signal: AbortSignal): Promise<boolean> {
		if (signal.aborted) return Promise.resolve(false);
		if (!busy) {
			busy = true;
			return Promise.resolve(true);
		}
		return new Promise((resolve) => {
			const abort = (): void => {
				laneWaiters.splice(laneWaiters.indexOf(enter), 1);
				resolve(false);
			};
			const enter = (): void => {
				signal.removeEventListener('abort', abort);
				resolve(true);
			};
			laneWaiters.push(enter);
			signal.addEventListener('abort', abort, { once: true });
		});
	}

	function geometryFor(current: Session, kind: InspectionGeometryKind): BufferGeometry {
		let geometry = current.geometries.get(kind);
		if (geometry === undefined) {
			geometry = createInspectionGeometry(kind).geometry;
			current.geometries.set(kind, geometry);
		}
		return geometry;
	}

	function rigFor(current: Session, rig: InspectionRig): InspectionLighting {
		let lighting = current.rigs.get(rig);
		if (lighting === undefined) {
			lighting = createInspectionLighting(rig);
			current.rigs.set(rig, lighting);
		}
		return lighting;
	}

	function retireSession(): void {
		const previous = session;
		if (previous === null) return;
		session = null;
		previous.controller.abort();
		for (const geometry of previous.geometries.values()) disposeQuietly(geometry);
		for (const rig of previous.rigs.values()) disposeQuietly(rig);
	}

	function idOf(object: object): number {
		if (!objectIds.has(object)) objectIds.set(object, (serial += 1));
		return objectIds.get(object)!;
	}

	function pruneDraftScope(keep: InspectionSubject | null): void {
		if (draftScope === null) return;
		if (keep?.kind === 'draft' && sourceSetKey(keep.draft) === draftScope.key) {
			draftScope.draft = keep.draft;
			return;
		}
		draftScope.scope.dispose();
		draftScope = null;
	}

	async function withScope<T>(
		subject: InspectionSubject,
		interactive: boolean,
		run: (scope: TextureLoadScope | null) => Promise<T>
	): Promise<T> {
		if (subject.kind === 'catalogue') return run(null);
		if (subject.kind === 'finish') return run(subject.scope);
		if (interactive) {
			const key = sourceSetKey(subject.draft);
			if (draftScope?.key !== key) {
				draftScope?.scope.dispose();
				const held = { key, draft: subject.draft };
				draftScope = Object.assign(held, {
					scope: createDraftTextureScope(() => held.draft, `${hostId}:draft-${(serial += 1)}`)
				});
			}
			return run(draftScope.scope);
		}
		const scope = createDraftTextureScope(() => subject.draft, `${hostId}:job-${(serial += 1)}`);
		jobScopes.add(scope);
		try {
			return await run(scope);
		} finally {
			jobScopes.delete(scope);
			scope.dispose();
		}
	}

	/**
	 * Lease the views `resolved.channels` names. `null` is cancelled: nothing is
	 * leased and nothing is published.
	 *
	 * The whole set is preflighted together. A failed image falls back to one lease
	 * per view, so each failure is named and its siblings still read. A budget
	 * refusal keeps no partial set; `solo` may then lease its own view.
	 */
	async function acquireViews(
		current: Session,
		resolved: ResolvedInspectionSubject,
		scope: TextureLoadScope | null,
		signal: AbortSignal,
		options: { readonly retry?: boolean; readonly solo?: FinishMapRole | null } = {}
	): Promise<AcquiredViews | null> {
		const held: FinishViewLease[] = [];
		const release = (): void => {
			for (const lease of held.splice(0)) lease.release();
		};
		async function take(sources: readonly FinishViewSource[]): Promise<FinishViewIssue | null> {
			const lease = await acquireFinishViews(sources, scope, signal, current.viewGeneration);
			if (signal.aborted) {
				lease.release();
				return { code: 'cancelled' };
			}
			if (lease.issues.length === 0) {
				held.push(lease);
				return null;
			}
			lease.release();
			return lease.issues[0]!;
		}
		function interrupted(failure: FinishViewIssue | null): boolean {
			return failure?.code === 'cancelled' || failure?.code === 'generation-mismatch';
		}

		const entries = resolved.channels.finish?.entries ?? [];
		const issues: InspectionIssue[] = [];
		let failure = resolved.views.length === 0 ? null : await take(resolved.views);
		if (failure?.code === 'image-load-failed') {
			for (const source of resolved.views) {
				failure = await take([source]);
				if (failure?.code === 'image-load-failed' && options.retry) {
					// Forget this one cached failure; other policies and siblings keep their textures.
					releaseFinishTexture(source.uri, source.role, scope);
					failure = await take([source]);
				}
				if (interrupted(failure) || failure?.code === 'texture-budget') break;
				if (failure === null) continue;
				for (const { role, view } of entries) {
					if (view === source.view) issues.push({ ...failure, role });
				}
			}
		}
		if (failure?.code === 'texture-budget') {
			release();
			issues.push(failure);
			const wanted = entries.find((entry) => entry.role === options.solo)?.view;
			const alone = resolved.views.filter((source) => source.view === wanted);
			if (alone.length > 0) failure = await take(alone);
		}
		if (interrupted(failure)) {
			release();
			return failure!.code === 'cancelled'
				? null
				: { views: {}, issues: [], lost: true, held: false, release };
		}
		const views = Object.assign({}, ...held.map((lease) => lease.views)) as FinishViewLease['views'];
		return { views, issues, lost: false, held: held.length > 0, release };
	}

	async function drawRequest(
		current: Session,
		request: InspectionRequest,
		scope: TextureLoadScope | null,
		signal: AbortSignal,
		retry: boolean
	): Promise<InspectionState | null> {
		const { subject, geometry, display, lighting } = request;
		const [width, height] = request.sizePx;
		if (!validSize(request.sizePx)) return refused('invalid-size');
		const missing = subjectRefusal(subject);
		if (missing !== null) return missing;

		let world: (WorldLightSample & { anchorWorld: NonNullable<WorldLightSample['anchorWorld']> }) | null = null;
		if (typeof lighting !== 'string') {
			const sample = lighting.world;
			const anchor = sample.anchorWorld;
			if (anchor === null) {
				return refused('world-anchor-required', 'Select a surface point or a placed object.');
			}
			let readAt: string | undefined;
			if (subject.kind === 'finish') readAt = subject.revision;
			if (subject.kind === 'draft') readAt = subject.draft.expectedRevision?.revisionId;
			if (readAt !== undefined && readAt !== sample.acceptedRevision) {
				return refused('world-sample-stale', 'Read the World again at the accepted revision.');
			}
			world = { ...sample, anchorWorld: anchor };
		}

		const resolved = resolveInspectionSubject(subject, geometry, world?.treatment);
		const { inputs, recipeKey } = resolved;
		if (inputs === null || recipeKey === null) {
			return resolved.issues.length > 0
				? { status: 'refused', issues: resolved.issues }
				: refused('unresolved-finish');
		}
		const issues = resolutionIssues(resolved, inputs);
		let solo: FinishMapRole | null = null;
		if (display === 'unlit-color') solo = 'color';
		else if (display !== 'lit') solo = display.solo;
		// A treated surface samples nothing, so it needs no image.
		const treated = solo === null && world?.treatment !== undefined;

		let leased: AcquiredViews | null = null;
		let releaseMaterial: (() => void) | null = null;
		let worldLighting: WorldInspectionLighting | null = null;
		const scene = new Scene();
		try {
			let views: FinishViewLease['views'] = {};
			if (!treated) {
				const acquired = await acquireViews(current, resolved, scope, signal, { retry, solo });
				if (acquired === null) return null;
				if (acquired.lost) return { status: 'pending' };
				issues.push(...acquired.issues);
				views = acquired.views;
				if (acquired.held) {
					leased = acquired;
					leases += 1;
				}
			}
			if (solo !== null && inputs.maps[solo] !== undefined) {
				const entry = resolved.channels.finish?.entries.find((candidate) => candidate.role === solo);
				if (entry === undefined || views[entry.view] === undefined) {
					// A bound channel never passes its constant off as the map.
					return {
						status: 'refused',
						issues: issues.length > 0 ? issues : [{ code: 'channel-unavailable', role: solo }]
					};
				}
			}

			let material;
			if (display === 'lit') {
				const { finish, ...plain } = resolved.lit;
				const complete = finish?.entries.every((entry) => views[entry.view] !== undefined) === true;
				// `clip: false`: the Stage's slice never cuts a swatch.
				const lease = complete
					? materials.acquire({ ...resolved.lit, clip: false }, undefined, undefined, views)
					: materials.acquire({ ...plain, clip: false });
				releaseMaterial = () => lease.release();
				material = lease.material;
			} else {
				const channel = createFinishChannelMaterial(resolved.channels, views, display);
				releaseMaterial = () => channel.dispose();
				material = channel;
			}
			leases += 1;

			scene.background = new Color(INSPECTION_THUMBNAIL_BACKGROUND);
			// A channel display is unlit; it realizes no rig and no World light.
			if (display === 'lit') {
				if (world !== null) {
					worldLighting = createWorldInspectionLighting(world, lights);
					leases += 1;
					scene.add(worldLighting.group);
				} else {
					const rig = rigFor(current, lighting as InspectionRig);
					scene.add(rig.group);
					scene.environment = rig.environment(current.renderer);
				}
			}
			scene.add(new Mesh(geometryFor(current, geometry), material));

			const frame = await renderInspectionFrame({
				renderer: current.renderer,
				scene,
				camera: createInspectionCamera(geometry, width / height, current.backend),
				size: Math.max(width, height),
				width,
				height,
				exposure: INSPECTION_THUMBNAIL_EXPOSURE,
				signal
			});
			if (signal.aborted) return null;
			// The background is opaque, so a transparent first pixel is a lost device's empty read.
			if (frame === null || frame.pixels[3] !== 255) return refused('readback-failed', 'Retry the inspection.');
			draws += 1;
			const drawn: Drawn = {
				frame,
				channels: channelReadings(resolved, inputs, views, treated),
				recipeKey
			};
			return issues.length === 0 ? { status: 'ready', ...drawn } : { status: 'partial', issues, ...drawn };
		} catch (error) {
			if (signal.aborted) return null;
			return {
				status: 'refused',
				issues: [{ code: 'inspection-draw-failed', message: error instanceof Error ? error.message : String(error) }]
			};
		} finally {
			scene.clear();
			if (worldLighting !== null) {
				worldLighting.dispose();
				leases -= 1;
			}
			if (releaseMaterial !== null) {
				releaseMaterial();
				leases -= 1;
			}
			// The views go back after the material that samples them.
			if (leased !== null) {
				leased.release();
				leases -= 1;
			}
		}
	}

	function emit(state: InspectionState): void {
		live?.onState(state);
	}

	const observer = createInspectionObserver({
		generation: () => epoch,
		async draw(signal) {
			drawnState = null;
			const current = session;
			const submitted = live;
			if (current === null || submitted === null) return null;
			const linked = linkSignals(signal, current.controller.signal);
			try {
				if (!(await enterLane(linked.signal))) return null;
				try {
					if (linked.signal.aborted) return null;
					const state = await withScope(submitted.request.subject, true, (scope) =>
						drawRequest(current, submitted.request, scope, linked.signal, submitted.retry)
					);
					if (state === null || linked.signal.aborted) return null;
					drawnState = state;
					return 'frame' in state ? state.frame : null;
				} finally {
					releaseLane();
				}
			} finally {
				linked.done();
				schedulePump();
			}
		},
		onResult(result) {
			if (result.status === 'cancelled' || result.status === 'generation-lost') return;
			if (live === null || session === null) return;
			const state = drawnState ?? refused('inspection-draw-failed');
			drawnState = null;
			settled = state.status === 'pending' ? null : { key: live.key, state };
			if (settled !== null) live.retry = false;
			emit(state);
		}
	});

	function requestKey(request: InspectionRequest): string {
		const { subject, lighting } = request;
		let owner = '';
		if (subject.kind === 'finish') owner = subject.scope.scopeId;
		if (subject.kind === 'draft') owner = String(idOf(subject.draft));
		return JSON.stringify([
			owner,
			inspectionSubjectIdentity(subject),
			request.geometry,
			typeof lighting === 'string' ? lighting : worldLightSampleKey(lighting.world),
			request.display,
			request.sizePx
		]);
	}

	function finishJob(job: ThumbnailJob, result: InspectionThumbnail): void {
		if (jobs.get(job.id) === job) jobs.delete(job.id);
		for (const waiter of [...job.waiters]) waiter.settle(result);
	}

	function remember(key: string, result: InspectionThumbnail & { status: 'ready' }): void {
		const bytesOf = (entry: typeof result): number => entry.frame.pixels.byteLength + entry.png.byteLength;
		const previous = cache.get(key);
		if (previous !== undefined) cacheBytes -= bytesOf(previous);
		cache.delete(key);
		cache.set(key, result);
		cacheBytes += bytesOf(result);
		for (const [oldest, entry] of cache) {
			if (cache.size <= cacheLimit && cacheBytes <= THUMBNAIL_CACHE_BYTES) break;
			cache.delete(oldest);
			cacheBytes -= bytesOf(entry);
		}
	}

	async function pumpThumbnails(): Promise<void> {
		const current = session;
		if (disposed || current === null || busy || observer.active) return;
		const job = queue.shift();
		if (job === undefined) return;
		busy = true;
		const linked = linkSignals(job.controller.signal, current.controller.signal);
		const retry = job.retryKey !== null && failedLooks.has(job.retryKey);
		try {
			const state = await withScope(job.request.subject, false, (scope) =>
				drawRequest(current, job.request, scope, linked.signal, retry)
			);
			if (job.controller.signal.aborted) return;
			if (linked.signal.aborted) {
				// Its generation went away; it keeps its place for the next one.
				queue.unshift(job);
				return;
			}
			if (state === null) return finishJob(job, refused('cancelled'));
			if (state.status === 'pending') return finishJob(job, refused('generation-mismatch'));
			if (state.status !== 'ready') {
				if (job.retryKey !== null && state.issues.some((issue) => issue.code === 'image-load-failed')) {
					failedLooks.add(job.retryKey);
				}
				return finishJob(job, { status: 'refused', issues: state.issues });
			}
			if (job.retryKey !== null) failedLooks.delete(job.retryKey);
			const png = await encode(state.frame);
			if (job.controller.signal.aborted) return;
			if (png === null) return finishJob(job, refused('png-encoder-unavailable'));
			if (state.recipeKey !== job.recipeKey) return finishJob(job, refused('subject-changed'));
			const result = {
				status: 'ready',
				key: job.key,
				recipeKey: job.recipeKey,
				frame: state.frame,
				png
			} as const;
			if (job.cacheKey !== null) remember(job.cacheKey, result);
			finishJob(job, result);
		} catch (error) {
			finishJob(job, {
				status: 'refused',
				issues: [{ code: 'thumbnail-failed', message: error instanceof Error ? error.message : String(error) }]
			});
		} finally {
			linked.done();
			releaseLane();
		}
	}

	return {
		attach(state) {
			if (disposed) return;
			retireSession();
			epoch += 1;
			session = {
				renderer: state.renderer,
				backend: state.backend,
				viewGeneration: { owner: state.viewGeneration.owner, generation: state.viewGeneration.generation },
				controller: new AbortController(),
				geometries: new Map(),
				rigs: new Map()
			};
			settled = null;
			if (live !== null) {
				emit({ status: 'pending' });
				observer.request();
			}
			schedulePump();
		},

		detach() {
			if (disposed || session === null) return;
			epoch += 1;
			observer.cancel();
			retireSession();
			settled = null;
			emit({ status: 'pending' });
		},

		observe(request, onState) {
			if (disposed) {
				onState(refused('host-disposed'));
				return () => {};
			}
			// A draft prepared again is a new chance for an image that failed.
			const retry =
				request.subject.kind === 'draft' && draftScope !== null && draftScope.draft !== request.subject.draft;
			const next: Live = { request, key: requestKey(request), onState, retry };
			live = next;
			pruneDraftScope(request.subject);
			if (settled?.key === next.key) {
				observer.cancel();
				onState(settled.state);
			} else {
				settled = null;
				onState({ status: 'pending' });
				// `onState` may itself have replaced or disposed this request.
				if (live === next && session !== null) observer.request();
			}
			return () => {
				if (live !== next) return;
				live = null;
				observer.cancel();
				if (request.subject.kind === 'draft') settled = null;
				// An edit unsubscribes before it observes again; only a real end frees the bytes.
				queueMicrotask(() => {
					if (live === null) pruneDraftScope(null);
				});
				schedulePump();
			};
		},

		retry() {
			if (disposed || live === null) return;
			live.retry = true;
			settled = null;
			emit({ status: 'pending' });
			if (session !== null) observer.request();
		},

		async thumbnail(input, signal) {
			if (disposed) return refused('host-disposed');
			if (signal?.aborted) return refused('cancelled');
			const geometry = input.geometry ?? 'sphere';
			const width = input.width ?? INSPECTION_THUMBNAIL_SIZE;
			const height = input.height ?? input.width ?? INSPECTION_THUMBNAIL_SIZE;
			if (!validSize([width, height])) return refused('invalid-size');
			const missing = subjectRefusal(input.subject);
			if (missing !== null) return missing;
			const resolved = resolveInspectionSubject(input.subject, geometry);
			const { inputs, recipeKey } = resolved;
			if (inputs === null || recipeKey === null) {
				return resolved.issues.length > 0
					? { status: 'refused', issues: resolved.issues }
					: refused('unresolved-finish');
			}
			// Only a complete look is a thumbnail; a partial one keeps the colour swatch.
			const issues = resolutionIssues(resolved, inputs);
			if (issues.length > 0) return { status: 'refused', issues };

			const key = inspectionThumbnailKey({ recipeKey, geometry, width, height });
			let cacheKey: string | null = null;
			let retryKey: string | null = null;
			let jobId: string | null = null;
			if (input.subject.kind === 'catalogue') {
				cacheKey = `catalogue|${key}`;
				retryKey = `catalogue|${recipeKey}`;
				jobId = cacheKey;
			}
			if (input.subject.kind === 'finish') {
				const { scope } = input.subject;
				cacheKey = `scope:${scope.scopeId}|${key}`;
				retryKey = `scope:${scope.scopeId}|${recipeKey}`;
				// A remount reuses the id on a new scope; a job reads through one scope object.
				jobId = `${idOf(scope)}|${cacheKey}`;
			}
			if (cacheKey !== null) {
				const cached = cache.get(cacheKey);
				if (cached !== undefined) {
					cache.delete(cacheKey);
					cache.set(cacheKey, cached);
					return cached;
				}
			}

			let job = jobId === null ? undefined : jobs.get(jobId);
			if (job === undefined) {
				if (queue.length >= THUMBNAIL_QUEUE_LIMIT) return refused('thumbnail-queue-full');
				const id = jobId ?? `draft:${(serial += 1)}`;
				job = {
					id,
					cacheKey,
					key,
					recipeKey,
					retryKey,
					request: { subject: input.subject, geometry, lighting: 'studio', display: 'lit', sizePx: [width, height] },
					waiters: new Set(),
					controller: new AbortController()
				};
				jobs.set(id, job);
				queue.push(job);
			}
			const joined = job;
			return new Promise<InspectionThumbnail>((resolve) => {
				const waiter: Waiter = {
					settle(result) {
						joined.waiters.delete(waiter);
						signal?.removeEventListener('abort', abandon);
						resolve(result);
					}
				};
				function abandon(): void {
					waiter.settle(refused('cancelled'));
					if (joined.waiters.size > 0) return;
					joined.controller.abort();
					if (jobs.get(joined.id) === joined) jobs.delete(joined.id);
					const index = queue.indexOf(joined);
					if (index >= 0) queue.splice(index, 1);
				}
				joined.waiters.add(waiter);
				signal?.addEventListener('abort', abandon, { once: true });
				schedulePump();
			});
		},

		async texel(input, signal) {
			const current = session;
			if (disposed || current === null) return refused('renderer-unavailable');
			if (!input.uv.every(Number.isFinite)) return refused('invalid-uv');
			const missing = subjectRefusal(input.subject);
			if (missing !== null) return missing;
			const resolved = resolveInspectionSubject(input.subject, input.geometry);
			const { inputs } = resolved;
			if (inputs === null) {
				return resolved.issues.length > 0
					? { status: 'refused', issues: resolved.issues }
					: refused('unresolved-finish');
			}
			const linked = linkSignals(...(signal === undefined ? [] : [signal]), current.controller.signal);
			try {
				if (!(await enterLane(linked.signal))) return refused('cancelled');
				try {
					return await withScope(input.subject, false, async (scope): Promise<InspectionTexel> => {
						const issues = resolutionIssues(resolved, inputs);
						const acquired = await acquireViews(current, resolved, scope, linked.signal);
						if (acquired === null) return refused('cancelled');
						if (acquired.lost) return refused('generation-mismatch');
						issues.push(...acquired.issues);
						if (acquired.held) leases += 1;
						try {
							const channels = await readInspectionTexel({
								renderer: current.renderer,
								descriptor: resolved.channels,
								inputs,
								views: acquired.views,
								uv: input.uv,
								signal: linked.signal
							});
							if (channels === null || linked.signal.aborted) return refused('cancelled');
							return { status: issues.length === 0 ? 'ready' : 'partial', channels, issues };
						} finally {
							acquired.release();
							if (acquired.held) leases -= 1;
						}
					});
				} catch {
					return refused('readback-failed');
				} finally {
					releaseLane();
				}
			} finally {
				linked.done();
			}
		},

		stats() {
			return {
				attached: session !== null,
				draws,
				leases,
				queued: queue.length,
				cached: cache.size,
				draftScopes: (draftScope === null ? 0 : 1) + jobScopes.size
			};
		},

		dispose() {
			if (disposed) return;
			disposed = true;
			live = null;
			settled = null;
			observer.dispose();
			retireSession();
			queue.length = 0;
			for (const job of [...jobs.values()]) {
				job.controller.abort();
				finishJob(job, refused('cancelled'));
			}
			pruneDraftScope(null);
			for (const scope of jobScopes) scope.dispose();
			jobScopes.clear();
			cache.clear();
			cacheBytes = 0;
			failedLooks.clear();
		}
	};
}
