/**
 * What an inspection draws: one Finish resolved for one reference geometry.
 *
 * The inspection subject is an accepted Finish (curated catalogue base or a project
 * Finish at an accepted revision) or a provisional draft that has not been
 * accepted. Every subject goes through the **same** Scene look adapter the
 * product draws with (`sceneFinishFor`), against the reference geometry's own
 * metric facts, so an inspection can never disagree with the Stage about which
 * plan, views or constants a Finish produces.
 *
 * - A catalogue subject resolves through the shipped index.
 * - An accepted project Finish resolves through the accepted Scene's runtime
 *  material index (D's projection of the resources unit).
 * - A draft resolves through a **synthetic** look source: its recipe is the one
 *  definition, and each verified source digest becomes a scope-private
 *  `/project-assets/draft-…` texture that only the draft's own memory scope
 *  can load. The draft never enters a project document.
 *
 * Treatment is decided by the lighting, not by the subject: reference modes
 * draw Natural (untreated), Current World draws the World's Treatment. Unlit
 * colour and solo channels always use the untreated plan.
 */
import type {
	BoundInputs,
	Finish,
	MapRole,
	MaterialIssue,
	Recipe,
} from '@portfolio/project-model/materials';
import type { SceneTreatment } from '@portfolio/project-model/scene';
import type { MaterialId } from '$lib/types/materials';
import type {
	FinishSamplingPlanEntry,
	StandardMaterialDescriptor,
} from '$lib/render/resources/material-descriptor';
import type { FinishViewSource } from '$lib/render/resources/finish-views';
import type { TextureLoadScope } from '$lib/render/resources/texture-store';
import {
	createProjectTextureScope,
	type ProjectTextureScope,
} from '$lib/render/resources/project-texture-scope';
import {
	sceneFinishFor,
	type LookSource,
	type ResolveTarget,
	type SceneFinishGeometry,
	type SceneFinishLook,
} from './scene-finish';
import { inspectionGeometryFacts, type InspectionGeometryKind } from './inspection-geometry';

/** A scoped reader for one verified digest; `PreparedFinishDraft` sources satisfy it. */
export type InspectionDraftSource = {
	readonly hash: string;
	readonly mime: string;
	readonly length: number;
	read(signal?: AbortSignal): Promise<Uint8Array>;
};

/**
 * A provisional draft, structurally `PreparedFinishDraft`. The render layer
 * takes the shape, never the authoring module, so the visitor closure cannot
 * reach material authoring through inspection.
 */
export type InspectionDraft = {
	readonly name: string;
	readonly recipe: Recipe;
	readonly recipeHash: string;
	readonly sources: ReadonlyMap<string, InspectionDraftSource>;
	/** The accepted revision it was prepared at; a World sample must match it. */
	readonly expectedRevision?: { readonly revisionId: string };
};

export type InspectionSubject =
	| { readonly kind: 'catalogue'; readonly id: MaterialId }
	| {
			readonly kind: 'finish';
			/** The accepted Scene the Finish lives in (with its runtime material index). */
			readonly document: LookSource;
			readonly finishId: string;
			/** The accepted revision the reference was read at; part of the identity. */
			readonly revision: string;
			/** The project's verified texture scope; also the private cache namespace. */
			readonly scope: TextureLoadScope;
	  }
	| { readonly kind: 'draft'; readonly draft: InspectionDraft };

export type ResolvedInspectionSubject = {
	/** The descriptor the requested lighting draws (treated only in World mode). */
	readonly lit: StandardMaterialDescriptor;
	/** The untreated descriptor unlit colour and solo channels read. */
	readonly untreated: StandardMaterialDescriptor;
	/**
	 * What channel readings sample: the untreated plan, or, when the whole plan
	 * cannot bind (one role needs an absent UV set), each role that binds alone.
	 */
	readonly channels: StandardMaterialDescriptor;
	/** Every view `channels` names (a treated plan names a subset or none). */
	readonly views: readonly FinishViewSource[];
	/** The effective untreated inputs, or null when the Finish cannot resolve. */
	readonly inputs: BoundInputs | null;
	readonly issues: readonly MaterialIssue[];
	/** Stable, scope-free identity of the effective untreated look; null if unresolved. */
	readonly recipeKey: string | null;
	/** Whether the subject can ever populate a reusable thumbnail cache. */
	readonly reusable: boolean;
	/** The identity the subject was resolved for, for coalescing and staleness. */
	readonly identity: string;
};

const DRAFT_TEXTURE_PREFIX = 'draft-';

/** The scope-private asset id a draft source loads under. */
export function draftAssetId(hash: string): string {
	return `${DRAFT_TEXTURE_PREFIX}${hash.replace(/[^a-zA-Z0-9-]/g, '')}`;
}

/** The synthetic, document-free look source for one draft. */
export function draftLookSource(draft: InspectionDraft): LookSource {
	const images = [...draft.sources.keys()]
		.sort()
		.map((hash) => ({ hash, source: { textureId: draftAssetId(hash) } }));
	return {
		materials: [
			{ id: 'inspection-draft', name: draft.name, base: { material: draft.recipeHash } },
		] as unknown as LookSource['materials'],
		textures: images.map((image) => ({
			id: image.source.textureId,
			name: image.source.textureId,
			uri: `/project-assets/${image.source.textureId}`,
		})),
		palette: undefined,
		environment: undefined,
		materialIndex: {
			definitions: new Map([[draft.recipeHash, draft.recipe]]),
			definitionImages: new Map([[draft.recipeHash, images]]),
			images,
		},
	} as LookSource;
}

/**
 * The draft's verified memory scope.
 *
 * `current` may move to a later draft over the same source set, so a factor or
 * UV edit keeps the verified bytes and reads through the live draft.
 *
 * Only this scope can load a draft's synthetic `/project-assets/draft-…`
 * URIs. Each load re-reads the draft source and re-verifies digest, MIME and
 * length through the project scope's own checks before decode, so a tampered
 * or released source is a refusal, never pixels. Disposal releases every
 * decoded texture and Finish view the scope loaded.
 */
export function createDraftTextureScope(
	current: () => InspectionDraft,
	scopeId: string,
): ProjectTextureScope {
	const initial = [...current().sources.values()];
	const pins = new Map(
		initial.map((source) => [
			draftAssetId(source.hash),
			{ hash: source.hash, mime: source.mime, size: source.length },
		]),
	);
	const hashes = new Map(initial.map((source) => [draftAssetId(source.hash), source.hash]));
	return createProjectTextureScope({
		scopeId,
		pins: () => pins,
		load: async (assetId, signal) => {
			const hash = hashes.get(assetId);
			const source = hash === undefined ? undefined : current().sources.get(hash);
			if (source === undefined) throw new Error('This draft has no such image.');
			return { bytes: await source.read(signal), mime: source.mime };
		},
	});
}

function withTreatment(document: LookSource, treatment: SceneTreatment | undefined): LookSource {
	const current = document.environment;
	if (current?.treatment === treatment) return document;
	const next = { ...(current ?? {}) } as Record<string, unknown>;
	if (treatment === undefined) delete next.treatment;
	else next.treatment = treatment;
	return {
		...document,
		environment: Object.keys(next).length === 0 ? undefined : next,
	} as LookSource;
}

const EMPTY_DOCUMENT: LookSource = {
	materials: [],
	textures: [],
	palette: undefined,
	environment: undefined,
} as unknown as LookSource;

function sourceOf(subject: InspectionSubject): {
	document: LookSource;
	target: { materialInstanceId: string | null; fallbackCatalogueId: MaterialId };
} {
	switch (subject.kind) {
		case 'catalogue':
			return {
				document: EMPTY_DOCUMENT,
				target: { materialInstanceId: null, fallbackCatalogueId: subject.id },
			};
		case 'finish':
			return {
				document: subject.document,
				target: {
					materialInstanceId: subject.finishId,
					fallbackCatalogueId: 'plaster-painted' as MaterialId,
				},
			};
		case 'draft':
			return {
				document: draftLookSource(subject.draft),
				target: {
					materialInstanceId: 'inspection-draft',
					fallbackCatalogueId: 'plaster-painted' as MaterialId,
				},
			};
	}
}

/** The subject's identity: what makes two requests the same subject. */
export function inspectionSubjectIdentity(subject: InspectionSubject): string {
	switch (subject.kind) {
		case 'catalogue':
			return `catalogue:${subject.id}`;
		case 'finish':
			return `finish:${subject.finishId}@${subject.revision}`;
		case 'draft':
			return `draft:${subject.draft.recipeHash}`;
	}
}

function canonical(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, entry]) => entry !== undefined)
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
	return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
}

/**
 * The scope-free identity of the effective untreated look.
 *
 * It names the resolved factors (palette followers are already literals in
 * `BoundInputs`), mapping and, per role, the image **digest** plus its channel
 * reading. It deliberately omits provenance, display names and local source
 * ids: two projects holding the same bytes and values share one key, and a
 * renamed Finish keeps its derivative.
 */
export function inspectionRecipeKey(inputs: BoundInputs): string {
	const maps: Record<string, unknown> = {};
	for (const role of ['color', 'normal', 'roughness', 'metalness', 'occlusion'] as const) {
		const binding = inputs.maps[role] as
			| (BoundInputs['maps'][typeof role] & {
					convention?: string;
					component?: string;
					invert?: boolean;
			  })
			| undefined;
		if (binding === undefined) continue;
		maps[role] = {
			hash: binding.image?.hash ?? null,
			mapping: binding.mapping,
			convention: binding.convention,
			component: binding.component,
			invert: binding.invert,
		};
	}
	return canonical({
		profile: inputs.profile,
		color: inputs.color,
		roughness: inputs.roughness,
		metalness: inputs.metalness,
		occlusionStrength: inputs.occlusionStrength,
		normalScale: inputs.normalScale,
		mapping: inputs.mapping,
		maps,
	});
}

/**
 * The channel plan. Binding is all-or-nothing for a surface, but not for a
 * reading: a refused plan is re-resolved one role at a time through the same
 * adapter, with the other bound roles disabled.
 */
function channelPlan(
	document: LookSource,
	target: ResolveTarget,
	metric: SceneFinishGeometry,
	look: SceneFinishLook,
): { channels: StandardMaterialDescriptor; views: readonly FinishViewSource[] } {
	const whole = { channels: look.material, views: look.textures?.views ?? [] };
	const { inputs } = look;
	if (inputs === null || look.material.finish !== undefined) return whole;
	const roles = (Object.keys(inputs.maps) as MapRole[]).filter(
		(role) => inputs.maps[role] !== undefined,
	);
	if (roles.length < 2) return whole;

	const id = target.materialInstanceId ?? 'inspection-channels';
	const instance: Finish = (document.materials.find((material) => material.id === id) as
		| Finish
		| undefined) ?? {
		id,
		name: id,
		base: { catalogue: target.fallbackCatalogueId },
	};
	const entries: FinishSamplingPlanEntry[] = [];
	const views = new Map<string, FinishViewSource>();
	for (const role of roles) {
		const maps: Record<string, unknown> = { ...instance.overrides?.maps };
		for (const other of roles) if (other !== role) maps[other] = null;
		const alone = sceneFinishFor(
			{
				...document,
				materials: [
					{ ...instance, overrides: { ...instance.overrides, maps } },
				] as unknown as LookSource['materials'],
			},
			{ ...target, materialInstanceId: id },
			metric,
		);
		const entry = alone.material.finish?.entries.find((candidate) => candidate.role === role);
		const view = alone.textures?.views?.find((candidate) => candidate.view === entry?.view);
		if (entry === undefined || view === undefined) continue;
		entries.push(entry);
		if (!views.has(view.view)) views.set(view.view, view);
	}
	if (entries.length === 0) return whole;
	const { occlusionStrength, normalScale } = inputs;
	return {
		channels: {
			...look.material,
			finish: { profile: 'pbr-metallic-roughness/v1', entries, occlusionStrength, normalScale },
		},
		views: [...views.values()],
	};
}

/**
 * Resolve one subject for one reference geometry.
 *
 * `treatment` is the World's Treatment in Current World mode and `undefined`
 * otherwise. A draft's synthetic texture URIs are only loadable through that
 * draft's own memory scope (`createDraftTextureScope`).
 */
export function resolveInspectionSubject(
	subject: InspectionSubject,
	geometry: InspectionGeometryKind,
	treatment?: SceneTreatment,
	/** A sample tile's window: one UV unit is that many metres (`sampleTileMetricFacts`). */
	metricFacts?: {
		readonly uvMeters: readonly [number, number];
		readonly surfaceMeters: readonly [number, number];
	},
): ResolvedInspectionSubject {
	const { document, target } = sourceOf(subject);
	const facts = metricFacts ?? inspectionGeometryFacts(geometry);
	const metric = {
		kind: 'metric' as const,
		uvMeters: [facts.uvMeters[0], facts.uvMeters[1]] as const,
		surfaceMeters: [facts.surfaceMeters[0], facts.surfaceMeters[1]] as const,
	};
	const natural = withTreatment(document, undefined);
	const untreatedLook = sceneFinishFor(natural, target, metric);
	const litLook =
		treatment === undefined
			? untreatedLook
			: sceneFinishFor(withTreatment(document, treatment), target, metric);
	const plan = channelPlan(natural, target, metric, untreatedLook);
	const views: FinishViewSource[] = plan.views.map((view) => ({
		view: view.view,
		uri: view.uri,
		role: view.role,
	}));
	return {
		lit: litLook.material,
		untreated: untreatedLook.material,
		channels: plan.channels,
		views,
		inputs: untreatedLook.inputs,
		issues: untreatedLook.issues,
		recipeKey: untreatedLook.inputs === null ? null : inspectionRecipeKey(untreatedLook.inputs),
		reusable: subject.kind !== 'draft',
		identity: inspectionSubjectIdentity(subject),
	};
}
