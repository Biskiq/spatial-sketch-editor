/**
 * T2.P02.S02 — the creator-import contract.
 *
 * One GLB, or one glTF plus its local buffers/maps, becomes one immutable
 * approved revision plus the placement the creator confirmed. This module owns
 * the shapes that cross the worker boundary and the session boundary; nothing
 * here is authored project data. Source files, progress and the report stay in
 * procedure/session state and are never written into a unit.
 *
 * The recipe identity is part of the resource record
 * (`ModelResourceDetail.recipe`), so a derivative is never inferred from the
 * current code: it names exactly the recipe that produced it.
 */

/** The one admitted recipe. A second version is a new record, not an option. */
export const CREATOR_IMPORT_RECIPE = Object.freeze({ id: 'creator-import@1', version: 1 });

/** Owner-accepted batch E bounds, repeated here for the pre-upload check. */
export const CREATOR_IMPORT_SOURCE_MAX_BYTES = 50 * 1024 * 1024;
export const CREATOR_IMPORT_DERIVATIVE_MAX_BYTES = 25 * 1024 * 1024;

/** The texture cap the recipe applies; reductions are reported, never silent. */
export const CREATOR_IMPORT_TEXTURE_MAX_PX = 2048;

export type CreatorImportPivot = 'bottom-centre' | 'bounds-centre';

export type CreatorImportFile = {
	/** The relative path exactly as the glTF declares it (or the GLB's file name). */
	readonly path: string;
	readonly bytes: Uint8Array;
};

export type CreatorImportSourceFile = {
	readonly path: string;
	readonly size: number;
	/** `sha256-<hex>` over the exact bytes. */
	readonly hash: string;
};

/** One source node, recorded before any transform runs. */
export type CreatorImportNodeRecord = {
	readonly index: number;
	readonly name: string;
	readonly mesh: boolean;
	readonly empty: boolean;
};

/** The observed content of one source, before any admission decision. */
export type CreatorImportObserved = {
	readonly nodes: number;
	readonly emptyNodes: number;
	readonly meshes: number;
	readonly primitives: number;
	readonly triangles: number;
	readonly materials: number;
	readonly textures: number;
	readonly animationNames: readonly string[];
	readonly variantNames: readonly string[];
	readonly extensionsUsed: readonly string[];
	readonly extensionsRequired: readonly string[];
	/** World-space bounds in source units, before the metric conversion. */
	readonly bounds: {
		readonly min: readonly [number, number, number];
		readonly max: readonly [number, number, number];
	};
};

export type CreatorImportTextureReduction = {
	readonly name: string;
	readonly from: readonly [number, number];
	readonly to: readonly [number, number];
};

/**
 * The confirmed placement, in derivative-local metres.
 *
 * The derivative is normalized by the recipe: its node hierarchy is preserved
 * unchanged except for one appended pivot root, and the confirmed pivot sits at
 * local origin. `contactMinY` is therefore the lowest point of the derivative
 * relative to that origin, and `footprint` is the occupied X/Z extent.
 */
export type CreatorImportPlacement = {
	readonly metresPerSourceUnit: number;
	readonly pivot: CreatorImportPivot;
	readonly pivotLocal: readonly [number, number, number];
	readonly footprint: { readonly width: number; readonly depth: number };
	readonly contactMinY: number;
	readonly height: number;
};

/**
 * The ingest report the creator reviews and the server's report digest covers.
 *
 * `observed` and `admitted` are deliberately separate: a part, clip or variant
 * the source contains is *observed*, never admitted by `creator-import@1`.
 */
export type CreatorImportReport = {
	readonly schema: 1;
	readonly recipe: { readonly id: string; readonly version: number };
	readonly source: {
		readonly files: readonly CreatorImportSourceFile[];
		readonly size: number;
		readonly fileCount: number;
	};
	readonly observed: CreatorImportObserved;
	/** The preserved source hierarchy, in document order. */
	readonly nodeMap: readonly CreatorImportNodeRecord[];
	readonly admitted: {
		readonly kind: 'whole-object';
		readonly parts: 'observed-not-admitted';
		readonly animations: 'observed-not-admitted';
		readonly variants: 'observed-not-admitted';
	};
	readonly textures: {
		readonly encoded: 'webp';
		readonly capPx: number;
		readonly reductions: readonly CreatorImportTextureReduction[];
	};
	readonly geometry: {
		readonly encoded: 'meshopt';
		readonly triangles: number;
	};
	readonly placement: CreatorImportPlacement;
	readonly derivative: { readonly size: number };
	readonly warnings: readonly string[];
};

export type CreatorImportRefusalCode =
	| 'wrong-file-count'
	| 'unsupported-format'
	| 'unsupported-media-type'
	| 'source-too-large'
	| 'missing-local-file'
	| 'external-dependency'
	| 'unsupported-required-extension'
	| 'malformed-source'
	| 'empty-model'
	| 'invalid-parameters'
	| 'derivative-too-large'
	| 'encode-failed'
	| 'cancelled';

export type CreatorImportRefusal = {
	readonly kind: 'refused';
	readonly code: CreatorImportRefusalCode;
	readonly message: string;
	readonly issues: readonly string[];
};

export type CreatorImportPrepared = {
	readonly kind: 'prepared';
	readonly report: CreatorImportReport;
	/** Digest over the canonical report body; the approval carries this exact value. */
	readonly reportDigest: string;
	readonly derivative: CreatorImportFile;
	readonly source: readonly CreatorImportSourceFile[];
};

export type CreatorImportOutcome = CreatorImportPrepared | CreatorImportRefusal;

export type CreatorImportParameters = {
	/** Metres per source unit; finite and greater than zero. Never inferred. */
	readonly metresPerSourceUnit: number;
	readonly pivot: CreatorImportPivot;
};

export type CreatorImportProgress = {
	readonly stage: 'validating' | 'reading' | 'geometry' | 'textures' | 'writing';
	readonly detail: string;
};

export type CreatorImportRequest = {
	readonly files: readonly CreatorImportFile[];
	readonly parameters: CreatorImportParameters;
};

export type CreatorImportWorkerRequest =
	| { readonly kind: 'ingest'; readonly id: string; readonly request: CreatorImportRequest }
	| { readonly kind: 'cancel'; readonly id: string };

export type CreatorImportWorkerResponse =
	| {
			readonly kind: 'progress';
			readonly id: string;
			readonly progress: CreatorImportProgress;
	  }
	| { readonly kind: 'outcome'; readonly id: string; readonly outcome: CreatorImportOutcome }
	| { readonly kind: 'failed'; readonly id: string; readonly message: string };

/** A staged upload target, minted from the declaration the API accepted. */
export type CreatorImportStagedFile = {
	readonly fileId: string;
	readonly role: 'source' | 'derivative';
	readonly path: string;
	readonly size: number;
	readonly hash: string;
};

export type CreatorImportStaging = {
	readonly importId: string;
	readonly files: readonly CreatorImportStagedFile[];
};

/** The approved revision the API returned; the pin set the first placement pins. */
export type CreatorImportApproved = {
	readonly revisionId: string;
	readonly contentHash: string;
	readonly derivative: { readonly hash: string; readonly mime: string; readonly size: number; readonly locator: string };
	readonly source: { readonly manifestHash: string; readonly size: number; readonly fileCount: number };
	readonly recipe: { readonly id: string; readonly version: number };
	readonly reportDigest: string;
	readonly placement: {
		readonly metresPerSourceUnit: number;
		readonly pivot: readonly [number, number, number];
		readonly footprint: { readonly width: number; readonly depth: number };
		readonly contactMinY: number;
		readonly placement: 'floor';
	};
};
