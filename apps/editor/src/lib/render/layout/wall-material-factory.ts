import { getMaterial } from '$lib/content/materials';
import { applyTreatment } from '$lib/render/materials/treatment';
import type { WallMeshMaterialFactory } from '$lib/render/wall-geometry-adapter';
import type { MaterialStore, MaterialTextureMaps } from '$lib/render/resources/material-store';
import type { TextureLoadScope } from '$lib/render/resources/texture-store';
import {
	acquireEffectiveVariant,
	effectiveTextureVariantKey,
	loadEffectiveTextures,
	releaseEffectiveVariant
} from '$lib/render/resources/texture-store';
import type { SceneSurfaceLook, SceneSurfaceLookResolver } from './surface-look';
import type {
	MaterialTextureSlotKey,
	MaterialTreatment,
	StandardMaterialDescriptor
} from '$lib/render/resources/material-descriptor';
import { surfaceKey, type LayoutWallSide } from '@portfolio/layout-core';
import type { IndexedWallMesh } from '$lib/layout/wall-mesh-builder';
import {
	acquireFinishViews,
	type FinishViewGeneration,
	type FinishViewIssue,
	type FinishViewLease
} from '$lib/render/resources/finish-views';
import {
	classifyFinishViewIssues,
	type FinishOutcomeSink,
	type FinishTargetOutcomeState
} from '$lib/render/resources/finish-outcome-sink';
import type { Texture } from 'three';

type VariantLease = {
	readonly seed: string;
	readonly rx: number;
	readonly ry: number;
	readonly rotation: number;
	readonly offset: readonly [number, number];
	readonly scope: TextureLoadScope | null;
	readonly maps: MaterialTextureMaps;
};
type SurfaceLook = SceneSurfaceLook & {
	loaded: boolean;
	views: FinishViewLease | null;
	controller: AbortController | null;
	readonly targets: Set<string>;
	lastOutcome: { readonly state: FinishTargetOutcomeState; readonly issues: readonly FinishViewIssue[] } | null;
};

/**
 * The one descriptor-backed Wall material factory used by Stage and visitor.
 * A tagged face resolves its Scene-owned Finish through the shared material
 * resolver; an untagged cap/reveal keeps the Layout default. Wall UVs are in
 * metres, so the resolver is asked for one square metre and its mapping scale
 * becomes repeats-per-metre rather than a second surface-size multiplier.
 */
export function createVisitorWallMaterialFactory(
	store: MaterialStore,
	resolveTint: (roomId: string) => string,
	emissiveIntensity = 0,
	treatment: MaterialTreatment | undefined = undefined,
	options: {
		readonly cutaway?: true;
		readonly scope?: TextureLoadScope | null;
		readonly resolveSurfaceLook?: SceneSurfaceLookResolver;
		readonly onMaterialChange?: () => void;
		/** The owning Canvas's generation; a replacement refuses only its own loads. */
		readonly viewGeneration?: () => FinishViewGeneration | null;
		/** Optional Stage-only sink for sampled Finish view outcomes. */
		readonly onFinishOutcome?: FinishOutcomeSink;
	} = {}
): {
	factory: WallMeshMaterialFactory;
	reloadTextures: () => void;
	dispose: () => void;
} {
	const defaultDefinition = getMaterial('plaster-warm');
	const scope = options.scope ?? null;
	const leases = new Map<string, ReturnType<MaterialStore['acquire']>>();
	const variants = new Map<string, VariantLease>();
	const looks = new Map<string, SurfaceLook>();
	let disposed = false;

	function assignedLook(mesh: IndexedWallMesh, side: LayoutWallSide): SceneSurfaceLook | null {
		const wallId = mesh.wallRanges[0]?.segmentId;
		return wallId === undefined || options.resolveSurfaceLook === undefined
			? null
			: options.resolveSurfaceLook({ kind: 'wall-side', wallId, side });
	}

	function defaultLook(mesh: IndexedWallMesh): SurfaceLook {
		const treated = applyTreatment(treatment, {
			color: resolveTint(mesh.roomId),
			roughness: defaultDefinition.roughness,
			metalness: defaultDefinition.metalness,
			slotUris: {},
			normalScale: null
		});
		return {
			material: {
				kind: 'standard', color: treated.color, roughness: treated.roughness,
				metalness: treated.metalness, emissive: treated.color, emissiveIntensity,
				toneMapped: emissiveIntensity === 0,
				...(options.cutaway === true ? { cutaway: true as const } : {})
			},
			textures: null,
			loaded: true,
			views: null,
			controller: null,
			targets: new Set(),
			lastOutcome: null
		};
	}

	function sceneLook(mesh: IndexedWallMesh, side: LayoutWallSide): SurfaceLook {
		const look = assignedLook(mesh, side);
		if (look === null) return defaultLook(mesh);
		const material: StandardMaterialDescriptor = {
			...look.material,
			...(options.cutaway === true ? { cutaway: true } : {})
		};
		const sampled = material.kind === 'standard' && material.finish !== undefined;
		return {
			material,
			textures: look.textures,
			...(look.finishKey === undefined ? {} : { finishKey: look.finishKey }),
			loaded: sampled ? false : look.textures === null,
			views: null,
			controller: null,
			targets: new Set(),
			lastOutcome: null
		};
	}

	function keyForLook(look: SurfaceLook): string {
		return JSON.stringify([look.material, look.textures, look.finishKey ?? null]);
	}

	function emitOutcome(look: SurfaceLook, state: FinishTargetOutcomeState, issues: readonly FinishViewIssue[]): void {
		look.lastOutcome = { state, issues };
		if (options.onFinishOutcome === undefined || look.finishKey === undefined) return;
		for (const targetKey of look.targets) {
			options.onFinishOutcome({ targetKey, finishKey: look.finishKey, state, issues });
		}
	}

	function ensureLook(mesh: IndexedWallMesh, side: LayoutWallSide): SurfaceLook {
		const candidate = sceneLook(mesh, side);
		const key = keyForLook(candidate);
		const wallId = mesh.wallRanges[0]?.segmentId;
		const targetKey = wallId === undefined ? null : `surface:${surfaceKey({ kind: 'wall-side', wallId, side })}`;
		const existing = looks.get(key);
		if (existing !== undefined) {
			if (targetKey !== null && !existing.targets.has(targetKey)) {
				existing.targets.add(targetKey);
				if (existing.lastOutcome !== null && existing.finishKey !== undefined) {
					options.onFinishOutcome?.({
						targetKey,
						finishKey: existing.finishKey,
						state: existing.lastOutcome.state,
						issues: existing.lastOutcome.issues
					});
				}
			}
			return existing;
		}
		if (targetKey !== null) candidate.targets.add(targetKey);
		looks.set(key, candidate);
		loadLook(candidate);
		return candidate;
	}

	function loadLook(candidate: SurfaceLook): void {
		const sampled = candidate.material.kind === 'standard' && candidate.material.finish !== undefined;
		if (sampled) {
			const controller = new AbortController();
			candidate.controller = controller;
			emitOutcome(candidate, 'pending', []);
			void acquireFinishViews(
				candidate.textures?.views ?? [],
				scope,
				controller.signal,
				options.viewGeneration?.() ?? undefined
			)
				.then((lease) => {
					if (candidate.controller === controller) candidate.controller = null;
					if (disposed || controller.signal.aborted) {
						lease.release();
						return;
					}
					const named = new Set((candidate.textures?.views ?? []).map((source) => source.view));
					const complete = lease.issues.length === 0 && Object.keys(lease.views).length === named.size;
					emitOutcome(candidate, classifyFinishViewIssues(lease.issues, complete), lease.issues);
					if (!complete) {
						lease.release();
						return;
					}
					candidate.views = lease;
					candidate.loaded = true;
					options.onMaterialChange?.();
				})
				.catch(() => undefined);
		} else if (candidate.textures !== null) {
			void loadEffectiveTextures(candidate.textures, scope).then((result) => {
				if (disposed || result.status === 'failed' || result.status === 'fallback') return;
				candidate.loaded = true;
				options.onMaterialChange?.();
			});
		}
	}

	function descriptorFor(look: SurfaceLook): {
		descriptor: StandardMaterialDescriptor;
		maps?: MaterialTextureMaps;
		views?: Readonly<Record<string, Texture>>;
	} {
		const sampled = look.material.kind === 'standard' && look.material.finish !== undefined;
		if (sampled) {
			if (!look.loaded || look.views === null) {
				const { finish: _finish, ...plain } = look.material;
				return { descriptor: plain as StandardMaterialDescriptor };
			}
			return { descriptor: look.material, views: look.views.views };
		}
		const texture = look.textures;
		if (texture === null || !look.loaded) return { descriptor: look.material };
		const variantKey = effectiveTextureVariantKey(texture.variantSeed, texture.repeat[0], texture.repeat[1], texture.rotation, scope, texture.offset);
		let variant = variants.get(variantKey);
		if (variant === undefined) {
			const maps = acquireEffectiveVariant(texture, texture.repeat[0], texture.repeat[1], texture.rotation, scope, texture.offset) as MaterialTextureMaps;
			variant = { seed: texture.variantSeed, rx: texture.repeat[0], ry: texture.repeat[1], rotation: texture.rotation, offset: texture.offset, scope, maps };
			variants.set(variantKey, variant);
		}
		const textures: Partial<Record<MaterialTextureSlotKey, string>> = {};
		for (const slot of Object.keys(variant.maps) as MaterialTextureSlotKey[]) textures[slot] = variantKey;
		return Object.keys(textures).length === 0
			? { descriptor: look.material }
			: { descriptor: { ...look.material, textures }, maps: variant.maps };
	}

	function leaseFor(look: SurfaceLook): ReturnType<MaterialStore['acquire']> {
		const resolved = descriptorFor(look);
		const leaseKey = `${JSON.stringify(resolved.descriptor)}|${look.views?.key ?? ''}`;
		let lease = leases.get(leaseKey);
		if (lease === undefined) {
			lease = store.acquire(resolved.descriptor, resolved.maps, undefined, resolved.views);
			leases.set(leaseKey, lease);
		}
		return lease;
	}

	const factory: WallMeshMaterialFactory = (_surfaceKey, mesh, paintSide) => {
		const look = paintSide === undefined ? defaultLook(mesh) : ensureLook(mesh, paintSide);
		const lease = leaseFor(look);
		return { material: lease.material };
	};

	return {
		factory,
		reloadTextures: () => {
			if (disposed) return;
			// An unfinished Finish acquisition follows a Retry by itself.
			for (const look of looks.values()) {
				if (!look.loaded && look.controller === null) loadLook(look);
			}
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			for (const lease of leases.values()) lease.release();
			for (const variant of variants.values()) {
				releaseEffectiveVariant(variant.seed, variant.rx, variant.ry, variant.rotation, variant.scope, variant.offset);
			}
			for (const look of looks.values()) {
			look.controller?.abort();
			look.views?.release();
		}
			leases.clear();
			variants.clear();
			looks.clear();
		}
	};
}
