/**
 * E8/R5 — the Three-free half of model presentation.
 *
 * The Scene model handler (`scene-model-representation`) is statically part of
 * every Stage and visitor graph, while the realization (`model-realization`) pulls
 * SkeletonUtils and is reached only through the lazily loaded model support. The
 * rules the handler needs before that chunk arrives — the look a resolved material
 * becomes, whether a texture load may bind, the caster id and the arrival gate —
 * are plain data and live here, so the handler never imports the realization's
 * values.
 */
import type { StandardMaterialDescriptor } from '../resources/material-descriptor';
import type { TextureLoadScope } from '../resources/texture-store';
import type { TextureVariantSource } from '../resources/texture-variant';

/** The surface look a model's meshes wear, and the texture variant it binds, if any. */
export type ModelLook = {
	readonly material: Omit<StandardMaterialDescriptor, 'kind' | 'textures'>;
	/** The loaded texture source and its cache namespace; null for an untextured look. */
	readonly texture: {
		readonly source: TextureVariantSource;
		readonly repeat: readonly [number, number];
		readonly scope: TextureLoadScope | null;
	} | null;
};

/** The fields of a resolved Scene material a model look reads. */
export type ModelSurfaceSource = TextureVariantSource & {
	readonly color: string;
	readonly roughness: number;
	readonly metalness: number;
};

const CONTROL = { nextId: 0 };

/** A process-unique id for one drawn model, so its caster events name one caster. */
export function nextModelEntityId(): number {
	CONTROL.nextId += 1;
	return CONTROL.nextId;
}

/**
 * Whether a texture load produced maps a look may bind. A failed or absent load keeps
 * the untextured surface, as the GLB's own material did.
 */
export function texturesReady(result: { readonly status: string } | undefined): boolean {
	return result?.status === 'ready' || result?.status === 'partial';
}

/**
 * The look of an approved creator model's effective material, as a surface look.
 * The variant repeat is the unit repeat a model's surfaces always used.
 */
export function modelLookFor(
	effective: ModelSurfaceSource,
	scope: TextureLoadScope | null,
	textured: boolean
): ModelLook {
	return {
		material: { color: effective.color, roughness: effective.roughness, metalness: effective.metalness },
		texture: textured ? { source: effective, repeat: [1, 1], scope } : null
	};
}

/**
 * Stale-arrival rejection. A drawn model begins a token for each load it starts; an
 * arrival may mount only while its token is still the current one. Closing the
 * gate, which the handler does on replacement and teardown, invalidates every
 * outstanding token.
 */
export type ArrivalGate = {
	begin(): number;
	accepts(token: number): boolean;
	close(): void;
};

export function createArrivalGate(): ArrivalGate {
	let current = 0;
	return {
		begin() {
			current += 1;
			return current;
		},
		accepts(token) {
			return token === current;
		},
		close() {
			current += 1;
		}
	};
}
