import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { LayoutWallSide } from '@portfolio/layout-core/plan';
import type {
	CompiledJunctionBand,
	CompiledLegJoin,
	CurveSample,
	LayoutBounds3,
	LayoutGeometryIssue,
} from '@portfolio/layout-core/geometry';

/**
 * Pure, renderer-neutral indexed wall mesh for one room. Positions/normals are
 * world-space XYZ; `uvs` are raw metric (`u` = arc length in meters, `v` =
 * height above the room floor in meters). `indices` are laid out surface-major
 * so each `materialGroups` entry is one contiguous draw-call range.
 */
export type WallMeshSectionRef = {
	roomId: string;
	segmentId: string;
	sectionIndex: number;
	openingId?: string;
	kind: 'side' | 'lintel';
};

export type WallMeshSurfaceKey = string;

export type IndexedWallMeshGroup = {
	surfaceKey: WallMeshSurfaceKey;
	/** The Wall-side material identity, absent for tops, caps and reveals. */
	paintSide?: LayoutWallSide;
	start: number;
	count: number;
};

/**
 * renderer-neutral pick identity for one emitted wall-buffer surface.
 * `'lintel'` exists on both sides of the wall/opening union, so `kind` is
 * always explicit. Additive metadata; never geometry groups, never serialized.
 */
export type Layout3dWallSurface = 'side' | 'lintel' | 'bridge';
export type Layout3dOpeningSurface = 'jamb' | 'sill' | 'lintel' | 'arch-reveal';

export type Layout3dTriangleRef =
	| {
			kind: 'wall';
			roomId: string;
			segmentId: string;
			surface: Layout3dWallSurface;
			paintSide?: LayoutWallSide;
	  }
	| {
			kind: 'opening';
			roomId: string;
			segmentId: string;
			openingId: string;
			surface: Layout3dOpeningSurface;
			/** Only outward Wall face strips are Paint targets; reveals omit it. */
			paintSide?: LayoutWallSide;
	  };

/** One contiguous index run of one pick owner (triangle-aligned: `count % 3 === 0`). */
export type Layout3dPickRange = Layout3dTriangleRef & { start: number; count: number };

export type IndexedWallMesh = {
	roomId: string;
	positions: Float32Array; // world XYZ
	normals: Float32Array; // world XYZ
	uvs: Float32Array; // [u = arc length, v = height above floor]
	indices: Uint32Array; // surface-major
	materialGroups: IndexedWallMeshGroup[];
	sectionToRange: Array<
		WallMeshSectionRef & {
			surfaceKey: WallMeshSurfaceKey;
			paintSide?: LayoutWallSide;
			start: number;
			count: number;
		}
	>;
	wallRanges: Array<{ segmentId: string; ranges: Array<{ start: number; count: number }> }>;
	/**
	 * complete authored pick identity: a sorted, non-overlapping
	 * partition of the whole index buffer (every triangle has exactly one pick
	 * owner). Covers wall side/lintel/bridge surfaces and opening
	 * jamb/sill/lintel/arch-reveal surfaces — the classes `sectionToRange` /
	 * `wallRanges` cannot identify (reveals and bridges have no owner today).
	 */
	pickRanges: Layout3dPickRange[];
	/**
	 * Optional canonical development attribution: three
	 * values per vertex, in vertex order: station `s`, signed offset `w`
	 * (positive along the canonical left normal) and height `y` above the
	 * floor. Present only when `WallMeshOptions.attribution` is true; the
	 * visitor and the retained representation never request it.
	 */
	attribution?: Float32Array;
	/**
	 * Exact (Float64) twin of `attribution`, for the development proof suite only. The
	 * render/GPU path uses the compact Float32 array; at metre-scale stations
	 * Float32 quantisation is already larger than the development's 1e-9 m
	 * contract, so the geometric proof must read the unrounded values.
	 */
	attributionExact?: Float64Array;
	/** Unquantised source positions paired with `attributionExact`. */
	attributionSourcePositions?: Float64Array;
	bounds: LayoutBounds3;
};

export type WallMeshOptions = {
	weldTolerance?: number;
	miterLimit?: number;
	classifySurface?: (ref: WallMeshSectionRef) => WallMeshSurfaceKey;
	/**
	 * When true, fail the build if any triangle's geometric (winding) normal
	 * disagrees with its stored normal. Development guard: it catches winding
	 * regressions and also surfaces faces whose stored normals are not yet
	 * derived from their geometry (e.g. sloped arch undersides).
	 */
	assertWinding?: boolean;
	/** Emit the optional per-vertex `(s, w, y)` development attribution. */
	attribution?: boolean;
};

export type WallMeshBuildResult = {
	mesh?: IndexedWallMesh;
	issues: LayoutGeometryIssue[];
};

/**
 * Absolute along-distance span a resolved Wall end actually occupies.
 * A branch trimmed against the resolved Junction material starts (or ends) at
 * its `clipDistance`, never at the Junction plane, so no Wall-owned body can
 * occupy the same volume as the Junction material.
 */
export type ResolvedEndClip = {
	start: number;
	end: number;
	/** A free end's Opening reaches open air: there is no material for a jamb to face. */
	freeStart?: boolean;
	freeEnd?: boolean;
};

/**
 * One internal interface resting on this Wall's own offset face. The
 * builder only **omits** the covered face region; it never decides that the
 * interface exists (that is resolved in `layout-core`).
 */
export type ResolvedFaceSuppression = {
	normal: LayoutVec2;
	fromDistance: number;
	toDistance: number;
	bands: readonly CompiledJunctionBand[];
};

/**
 * Already-resolved Junction endpoints passed to the standalone builder.
 * The builder consumes resolved end geometry; it must not decide whether a
 * Junction is a miter, T, X or continuation. A connected endpoint with no
 * resolution fails closed (no square-cap fallback).
 */
export type ResolvedWallEnds = {
	start?: CompiledLegJoin | null;
	end?: CompiledLegJoin | null;
};

export type V3 = [number, number, number];

export type Vertex = {
	p: V3;
	n: V3;
	u: number;
	v: number;
	/** Development attribution attached where the emitter already knows the station. */
	a?: [number, number, number];
};

/**
 * Pick identity attached to a face at build time. `'lintel'` exists on both
 * sides of the wall/opening union, so `kind` is explicit, never inferred from
 * the surface string. Reveal (jamb) and corner-bridge faces are tagged too —
 * the two classes `sectionToRange` / `wallRanges` cannot identify. `roomId` /
 * `segmentId` come from the emitting wall context, so only the variable parts
 * live on the face.
 */
export type FacePick =
	| { kind: 'wall'; surface: Layout3dWallSurface; paintSide?: LayoutWallSide }
	| {
			kind: 'opening';
			openingId: string;
			surface: Layout3dOpeningSurface;
			paintSide?: LayoutWallSide;
	  };

export type Face = { verts: Vertex[]; pick?: FacePick };

export type ClipSample = {
	point: LayoutVec2;
	tangent: LayoutVec2;
	normal: LayoutVec2;
	distance: number;
	corner: 'start' | 'end' | null;
};

/**
 * One side of a wall-junction corner. A miter shares a single apex point with
 * the adjacent wall; a bevel (past the miter limit) keeps the two walls'
 * offset points distinct (`a0` on the previous wall's offset line, `b0` on the
 * current wall's). `fold` marks a 180° junction reversal and fails the build.
 */
export type CornerSide =
	| { kind: 'miter'; apex: LayoutVec2 }
	| { kind: 'bevel'; a0: LayoutVec2; b0: LayoutVec2 }
	| { kind: 'fold'; a0: LayoutVec2; b0: LayoutVec2 };

export type Corner = { front: CornerSide; back: CornerSide };

export type SectionFaces = {
	ref: WallMeshSectionRef;
	surfaceKey: WallMeshSurfaceKey;
	faces: Face[];
};

export type RevealFaces = {
	openingId: string;
	surfaceKey: WallMeshSurfaceKey;
	faces: Face[];
};

/**
 * Beveled-corner bridge: the joint at this wall's START (owner = current/start
 * wall). The emitted index range is referenced by BOTH adjacent walls'
 * `wallRanges`; its surface key comes from a synthetic `WallMeshSectionRef`
 * through the consumer's classifier so bridge faces join the same material
 * group as the walls (never an extra draw call). Synthetic refs stay out of
 * `sectionToRange`.
 */
export type BridgeFaces = {
	neighborSegmentId: string;
	surfaceKey: WallMeshSurfaceKey;
	faces: Face[];
};

export type WallFaces = {
	segmentId: string;
	sections: SectionFaces[];
	reveals: RevealFaces[];
	bridges: BridgeFaces[];
	/** Present when this record can attribute its own vertices. */
	development?: {
		samples: readonly CurveSample[];
		thickness: number;
		floorElevation: number;
	};
};

export const DEFAULT_WELD_TOLERANCE = 1e-4;
export const DEFAULT_MITER_LIMIT = 4;
export const NORMAL_GRID = 1e-3;
export const UV_GRID = 1e-4;
export const WINDING_DEGENERATE_AREA = 1e-12;

/**
 * S3b/D-5 signature for the canonical caller (whole compiled Wall, elevation,
 * resolved ends; default options). Increment when that caller's parameters or
 * the builder's derived-input set changes. Keep this export byte-identical in
 * the editor and standalone museum copies.
 */
export const STANDALONE_WALL_MESH_BUILDER_SIGNATURE =
	'buildStandaloneWallMesh(v3:whole-wall,floor-elevation,resolved-ends,exposed-end-surfaces,attribution)';

/**
 * Build one watertight, surface-major `IndexedWallMesh` for a room. Unsafe
 * inputs (offset overlap, invalid thickness, degenerate walls) produce
 * structured issues and no mesh — the consumer fails closed.
 */
