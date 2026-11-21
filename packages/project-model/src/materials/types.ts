/**
 * `pbr-metallic-roughness/v1` wire vocabulary.
 *
 * This module is the portable grammar for a material **definition** and the
 * sparse **instance overrides** that sit on top of it. It is deliberately
 * runtime-safe: editor, API and visitor all read the same values, and the
 * module has no dependency on Three, Svelte or the editor.
 *
 * A recipe carries portable signal meanings, not Biskiq identities:
 *
 * - `color` is an opaque sRGB `#rrggbb` factor.
 * - map images are content digests (`Maps<Hash>`), never local texture ids, so
 *   the same recipe in two projects with different local ids has one identity.
 * - `mapping` states the coordinate intent of the whole set; a binding may
 *   carry its own mapping instead.
 *
 * The canonical form (see `recipe.ts`) always carries every scalar property and
 * a `maps` object, even when empty. Only those normalized bytes determine the
 * recipe revision.
 */

/** The one admitted material family and evaluator version. */
export const MATERIAL_PROFILE = 'pbr-metallic-roughness/v1' as const;
export type MaterialProfile = typeof MATERIAL_PROFILE;

/** The capability a consumer declares for a material resource. */
export const MATERIAL_CAPABILITY = {
  id: 'pbr-metallic-roughness',
  version: '1'
} as const;

/**
 * The frozen untextured catalogue base. A resource-backed Finish always names a
 * `materialId`, and this base is the neutral one it uses. It is technical: it is
 * excluded from creator-facing catalogue counts.
 */
export const MATERIAL_NEUTRAL_BASE_ID = 'pbr-neutral-v1' as const;
export type MaterialNeutralBaseId = typeof MATERIAL_NEUTRAL_BASE_ID;

/** A lowercase `sha256-<64 hex>` content identity. */
export type Hash = string;

/** One project texture record, or one allowlisted immutable shipped texture. */
export type LocalImage =
	| { readonly textureId: string }
	| { readonly shipped: string };

/** Authored physical tiling: one tile's real size, rotation and shift. */
export type Metric = {
	readonly tileMeters: readonly [number, number];
	/** Radians about the UV centre, normalized to [0, 2π). */
	readonly rotation: number;
	/** Shift in tile fractions, each normalized to [0, 1). */
	readonly offset: readonly [number, number];
};

/**
 * The coordinate intent of a set or one binding.
 *
 * - `target` uses the target's metric basis when it has one and identity UV0
 *   otherwise (a legacy model remap).
 * - `surface` requires a metric basis and refuses without one.
 * - `uv` reads the named native UV set directly with the authored repeat.
 */
export type TargetMapping = { readonly kind: 'target'; readonly metric: Metric };
export type SurfaceMapping = { readonly kind: 'surface'; readonly metric: Metric };
export type UvMapping = {
	readonly kind: 'uv';
	readonly set: 0 | 1;
	readonly repeat: readonly [number, number];
	/** Radians about the UV centre, normalized to [0, 2π). */
	readonly rotation: number;
	/** Shift in tile fractions, each normalized to [0, 1). */
	readonly offset: readonly [number, number];
};
export type Mapping = TargetMapping | SurfaceMapping | UvMapping;

export type Colour<I> = {
	readonly image: I;
	/** Absent follows the set mapping. */
	readonly mapping?: Mapping;
};

export type NormalConvention = '+Y' | '-Y';

export type Normal<I> = {
	readonly image: I;
	readonly convention: NormalConvention;
	/** Absent follows the set mapping. */
	readonly mapping?: Mapping;
};

export const SCALAR_COMPONENTS = ['r', 'g', 'b', 'a'] as const;
export type ScalarComponent = (typeof SCALAR_COMPONENTS)[number];

export type Scalar<I> = {
	readonly image: I;
	readonly component: ScalarComponent;
	readonly invert: boolean;
	/** Absent follows the set mapping. */
	readonly mapping?: Mapping;
};

export const MATERIAL_MAP_ROLES = [
	'color',
	'normal',
	'roughness',
	'metalness',
	'occlusion'
] as const;
export type MapRole = (typeof MATERIAL_MAP_ROLES)[number];

export type Maps<I> = {
	readonly color?: Colour<I>;
	readonly normal?: Normal<I>;
	readonly roughness?: Scalar<I>;
	readonly metalness?: Scalar<I>;
	readonly occlusion?: Scalar<I>;
};

/**
 * One normalized recipe. Every field is present after `readRecipe`; `maps` is
 * an empty object when no map is bound.
 */
export type Recipe = {
	readonly profile: MaterialProfile;
	readonly color: string;
	readonly roughness: number;
	readonly metalness: number;
	readonly occlusionStrength: number;
	readonly normalScale: number;
	readonly mapping: Mapping;
	readonly maps: Maps<Hash>;
};

export type CatalogueBaseRef = { readonly catalogue: string };
export type MaterialBaseRef = { readonly material: Hash };
export type FinishBase = CatalogueBaseRef | MaterialBaseRef;

/** A colour override: a literal or a follower of one palette slot. */
export type FinishColor = string | { readonly slot: string };

/**
 * A sparse instance override. An absent field inherits the complete base value;
 * `null` explicitly disables one map. A present factor equal to its base
 * remains authored, so inspection can report provenance.
 */
export type OverrideMaps = {
	readonly color?: Colour<LocalImage> | null;
	readonly normal?: Normal<LocalImage> | null;
	readonly roughness?: Scalar<LocalImage> | null;
	readonly metalness?: Scalar<LocalImage> | null;
	readonly occlusion?: Scalar<LocalImage> | null;
};

export type FinishOverrides = {
	readonly color?: FinishColor;
	readonly roughness?: number;
	readonly metalness?: number;
	readonly occlusionStrength?: number;
	readonly normalScale?: number;
	readonly mapping?: Mapping;
	readonly maps?: OverrideMaps;
};

/** One named Finish: a catalogue or resource base plus sparse overrides. */
export type Finish = {
	readonly id: string;
	readonly name: string;
	readonly base: FinishBase;
	/** Omitted when empty; an empty override container is never persisted. */
	readonly overrides?: FinishOverrides;
};

export type PaletteSlot = {
	readonly id: string;
	readonly name: string;
	readonly color: string;
};

/** A verified image identity: the content digest plus its local source. */
export type ResolvedImage = {
	readonly hash: Hash;
	readonly source: LocalImage;
};

export type ResolvedColour = {
	/** Null when the digest has no verified local pin. */
	readonly image: ResolvedImage | null;
	readonly mapping: Mapping;
};

export type ResolvedNormal = ResolvedColour & {
	readonly convention: NormalConvention;
};

export type ResolvedScalar = ResolvedColour & {
	readonly component: ScalarComponent;
	readonly invert: boolean;
};

export type ResolvedMaps = {
	readonly color?: ResolvedColour;
	readonly normal?: ResolvedNormal;
	readonly roughness?: ResolvedScalar;
	readonly metalness?: ResolvedScalar;
	readonly occlusion?: ResolvedScalar;
};

/** Where an effective value came from. */
export type ValueSource = 'base' | 'override' | 'disabled';

export type FieldProvenance = {
	readonly source: ValueSource;
	/** Present when the effective colour follows this palette slot. */
	readonly paletteSlot?: string;
};

export type ScalarField =
	| 'color'
	| 'roughness'
	| 'metalness'
	| 'occlusionStrength'
	| 'normalScale';

export type FinishProvenance = {
	readonly color: FieldProvenance;
	readonly roughness: FieldProvenance;
	readonly metalness: FieldProvenance;
	readonly occlusionStrength: FieldProvenance;
	readonly normalScale: FieldProvenance;
	readonly mapping: FieldProvenance;
	readonly maps: Readonly<Record<MapRole, FieldProvenance>>;
};

/**
 * The effective, untreated inputs of one Finish. Treatment is a render-layer
 * concern; these values are what a Treatment starts from and what inspection
 * reports before treatment.
 */
export type BoundInputs = {
	readonly profile: MaterialProfile;
	readonly color: string;
	readonly roughness: number;
	readonly metalness: number;
	readonly occlusionStrength: number;
	readonly normalScale: number;
	readonly mapping: Mapping;
	readonly maps: ResolvedMaps;
	readonly provenance: FinishProvenance;
};

/** The metric UV basis and surface dimensions a `target`/`surface` mapping needs. */
export type TargetMetricBasis = {
	/**
	 * Metres spanned by one native UV unit, u and v. A metre chart is [1, 1]; a
	 * normalized chart spans the rendered surface in each unit.
	 */
	readonly uvMeters: readonly [number, number];
	/** Rendered surface dimensions in metres, for acceptance and tile counts. */
	readonly surfaceMeters: readonly [number, number];
};

/** Availability facts for one draw call or one replaced primitive. */
export type TargetDraw = {
	readonly drawKey: string;
	/** Native UV sets with a finite pair for every referenced vertex. */
	readonly uvSets: readonly (0 | 1)[];
	/** UV sets with at least one nonzero-area, non-singular tangent frame. */
	readonly normalFrameSets: readonly (0 | 1)[];
	/**
	 * The active range had malformed indices/groups/positions. An empty range is
	 * valid and contributes no requirement; malformed geometry is not authorable
	 * and must be repaired rather than treated as an empty draw.
	 */
	readonly invalidGeometry?: true;
};

/**
 * Derived target facts, never authored and never persisted. Enumerating the
 * actual triangles is the geometry adapter's job; qualification is pure.
 */
export type TargetFacts = {
	/** Stable subject identity (entity, surface or mesh use). */
	readonly subject: string;
	/** The geometry or asset revision these facts were derived from. */
	readonly geometryRevision: string;
	readonly metricBasis?: TargetMetricBasis;
	readonly draws: readonly TargetDraw[];
};

/** One selected target whose geometry the host must qualify. */
export type TargetAnalysisRequest = {
	readonly subject: string;
	readonly domain: 'scene' | 'layout';
	/** Present for a Scene entity target; its id is also its subject. */
	readonly entityId?: string;
	/** Present for a Scene-owned Layout surface target. */
	readonly surface?: import('../scene').SceneSurfaceRef;
	/** The revision the host must analyse; another revision is not an answer. */
	readonly expectedGeometryRevision: string;
};

/** Facts derived by the host, keyed by the subject the caller selected. */
export type TargetAnalysis = (
	requests: readonly TargetAnalysisRequest[]
) => readonly TargetFacts[] | null;

/** One role's resolved sampling instruction for a bound draw. */
export type SamplingEntry = {
	readonly role: MapRole;
	readonly image: ResolvedImage;
	readonly uvSet: 0 | 1;
	/**
	 * Where the image's rows start. `legacy` is the repository's established
	 * TextureLoader upload convention and samples row `1−v`; `gltf` is an explicit
	 * glTF UV binding and samples row `v`.
	 */
	readonly origin: 'legacy' | 'gltf';
	readonly basis: 'metric' | 'identity';
	/** Multiplier applied to the target's native UVs, not a surface tile count. */
	readonly repeat: readonly [number, number];
	readonly rotation: number;
	readonly offset: readonly [number, number];
	readonly convention?: NormalConvention;
	readonly component?: ScalarComponent;
	readonly invert?: boolean;
};

/** A Finish bound to one qualified target. */
export type BoundFinish = {
	readonly subject: string;
	readonly geometryRevision: string;
	readonly samples: readonly SamplingEntry[];
	readonly draws: readonly string[];
};

/** The binding target: facts plus the revision the caller expects them at. */
export type BindingTarget = {
	readonly subject: string;
	/** Null means no analysis exists yet: the Finish is authorable but not drawable. */
	readonly facts: TargetFacts | null;
	/** When supplied, facts from another revision are stale and must be requalified. */
	readonly expectedGeometryRevision?: string;
};

export type FinishResolution = {
	/** Null only when the base itself cannot be read. */
	readonly inputs: BoundInputs | null;
	readonly issues: readonly import('./issues').MaterialIssue[];
};

export type FinishBinding = {
	readonly inputs: BoundInputs | null;
	readonly bound: BoundFinish | null;
	readonly issues: readonly import('./issues').MaterialIssue[];
};

/**
 * The runtime-only material index a scene preparation derives from the
 * resources unit. It is never serialized: a definition is reached by its
 * digest, and every digest maps to exactly one verified local image identity.
 */
export type MaterialRuntimeIndex = {
	readonly definitions: ReadonlyMap<Hash, Recipe>;
	/**
	 * Each definition's own image mappings, keyed by the definition digest. A
	 * binding is resolved through its definition, never through a flat hash table
	 * where an unrelated texture with the same bytes could win.
	 */
	readonly definitionImages: ReadonlyMap<Hash, readonly ResolvedImage[]>;
	/** Verified Scene texture pins, used for instance override bindings. */
	readonly images: readonly ResolvedImage[];
};
