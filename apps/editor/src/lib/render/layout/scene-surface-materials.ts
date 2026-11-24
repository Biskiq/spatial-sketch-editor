import type { MaterialStore, MaterialTextureMaps } from '$lib/render/resources/material-store';
import type { TextureLoadScope } from '$lib/render/resources/texture-store';
import {
	acquireEffectiveVariant,
	effectiveTextureVariantKey,
	loadEffectiveTextures,
	releaseEffectiveVariant
} from '$lib/render/resources/texture-store';
import type { MaterialTextureSlotKey, StandardMaterialDescriptor } from '$lib/render/resources/material-descriptor';
import { surfaceKey } from '@portfolio/layout-core';
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
import type { Material } from 'three';
import type { SceneSurfaceLook, SceneSurfaceLookResolver, SceneSurfaceRef } from './surface-look';

type SurfaceLook = SceneSurfaceLook & {
	loaded: boolean;
	views: FinishViewLease | null;
	controller: AbortController | null;
	readonly targets: Set<string>;
	lastOutcome: { readonly state: FinishTargetOutcomeState; readonly issues: readonly FinishViewIssue[] } | null;
};
type Variant = {
	readonly seed: string;
	readonly rx: number;
	readonly ry: number;
	readonly rotation: number;
	readonly offset: readonly [number, number];
	readonly scope: TextureLoadScope | null;
	readonly maps: MaterialTextureMaps;
};

/** Lease Scene-resolved floor/lid looks through the Canvas material store. */
export function createSceneSurfaceMaterials(input: {
	readonly store: MaterialStore;
	readonly scope: TextureLoadScope | null;
	readonly onMaterialChange: () => void;
	readonly resolveSurfaceLook?: SceneSurfaceLookResolver;
	/** The owning Canvas's generation; a replacement refuses only its own loads. */
	readonly viewGeneration?: () => FinishViewGeneration | null;
	/** Optional Stage-only sink for sampled Finish view outcomes. */
	readonly onFinishOutcome?: FinishOutcomeSink;
}): { materialFor(surface: SceneSurfaceRef): Material | null; materialKeys(): readonly string[]; reloadTextures(): void; dispose(): void } {
	const leases = new Map<string, ReturnType<MaterialStore['acquire']>>();
	const variants = new Map<string, Variant>();
	const looks = new Map<string, SurfaceLook>();
	let disposed = false;

	function emitOutcome(look: SurfaceLook, state: FinishTargetOutcomeState, issues: readonly FinishViewIssue[]): void {
		look.lastOutcome = { state, issues };
		if (input.onFinishOutcome === undefined || look.finishKey === undefined) return;
		for (const targetKey of look.targets) {
			input.onFinishOutcome({ targetKey, finishKey: look.finishKey, state, issues });
		}
	}

	function lookFor(surface: SceneSurfaceRef): SurfaceLook | null {
		const resolved = input.resolveSurfaceLook?.(surface) ?? null;
		if (resolved === null) return null;
		const key = JSON.stringify([resolved.material, resolved.textures, resolved.finishKey ?? null]);
		const targetKey = `surface:${surfaceKey(surface)}`;
		const existing = looks.get(key);
		if (existing !== undefined) {
			if (!existing.targets.has(targetKey)) {
				existing.targets.add(targetKey);
				if (existing.lastOutcome !== null && existing.finishKey !== undefined) {
					input.onFinishOutcome?.({
						targetKey,
						finishKey: existing.finishKey,
						state: existing.lastOutcome.state,
						issues: existing.lastOutcome.issues
					});
				}
			}
			return existing;
		}
		const sampled = resolved.material.kind === 'standard' && resolved.material.finish !== undefined;
		const look: SurfaceLook = {
			...resolved,
			loaded: sampled ? false : resolved.textures === null,
			views: null,
			controller: null,
			targets: new Set([targetKey]),
			lastOutcome: null
		};
		looks.set(key, look);
		loadLook(look);
		return look;
	}

	function loadLook(look: SurfaceLook): void {
		if (look.material.kind === 'standard' && look.material.finish !== undefined) {
			const sources = look.textures?.views ?? [];
			const controller = new AbortController();
			look.controller = controller;
			emitOutcome(look, 'pending', []);
			void acquireFinishViews(
				sources,
				input.scope,
				controller.signal,
				input.viewGeneration?.() ?? undefined
			)
				.then((lease) => {
					if (look.controller === controller) look.controller = null;
					if (disposed || controller.signal.aborted) {
						lease.release();
						return;
					}
					const named = new Set(sources.map((source) => source.view));
					const complete = lease.issues.length === 0 && Object.keys(lease.views).length === named.size;
					emitOutcome(look, classifyFinishViewIssues(lease.issues, complete), lease.issues);
					if (!complete) {
						lease.release();
						return;
					}
					look.views = lease;
					look.loaded = true;
					input.onMaterialChange();
				})
				.catch(() => undefined);
		} else if (look.textures !== null) {
			void loadEffectiveTextures(look.textures, input.scope).then((result) => {
				if (disposed || result.status === 'failed' || result.status === 'fallback') return;
				look.loaded = true;
				input.onMaterialChange();
			});
		}
	}

	function descriptorFor(look: SurfaceLook): {
		descriptor: typeof look.material;
		maps?: MaterialTextureMaps;
		views?: Readonly<Record<string, import('three').Texture>>;
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
		const key = effectiveTextureVariantKey(
			texture.variantSeed, texture.repeat[0], texture.repeat[1], texture.rotation, input.scope, texture.offset
		);
		let variant = variants.get(key);
		if (variant === undefined) {
			const maps = acquireEffectiveVariant(
				texture, texture.repeat[0], texture.repeat[1], texture.rotation, input.scope, texture.offset
			) as MaterialTextureMaps;
			variant = {
				seed: texture.variantSeed, rx: texture.repeat[0], ry: texture.repeat[1],
				rotation: texture.rotation, offset: texture.offset, scope: input.scope, maps
			};
			variants.set(key, variant);
		}
		const textures: Partial<Record<MaterialTextureSlotKey, string>> = {};
		for (const slot of Object.keys(variant.maps) as MaterialTextureSlotKey[]) textures[slot] = key;
		return Object.keys(textures).length === 0
			? { descriptor: look.material }
			: { descriptor: { ...look.material, textures }, maps: variant.maps };
	}

	return {
		materialFor(surface) {
			const look = lookFor(surface);
			if (look === null) return null;
			const resolved = descriptorFor(look);
			const key = `${JSON.stringify(resolved.descriptor)}|${look.views?.key ?? ''}`;
			let lease = leases.get(key);
			if (lease === undefined) {
				lease = input.store.acquire(resolved.descriptor, resolved.maps, undefined, resolved.views);
				leases.set(key, lease);
			}
			return lease.material;
		},
		materialKeys() {
			return [...leases.values()].map((lease) => lease.key);
		},
		reloadTextures() {
			if (disposed) return;
			// An unfinished Finish acquisition follows a Retry by itself.
			for (const look of looks.values()) {
				if (!look.loaded && look.controller === null) loadLook(look);
			}
		},
		dispose() {
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
