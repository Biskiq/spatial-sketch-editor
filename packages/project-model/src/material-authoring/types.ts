/**
 * The authoring vocabulary for manual composition and correctable set import
 * (T2.S8 E5).
 *
 * This module is authoring-only. It is deliberately **not** part of the
 * runtime-safe `@portfolio/project-model/materials` subpath: visitors, release
 * readers and the cold runtime never propose, correct or compose a Finish. The
 * editor and agents import it from `@portfolio/project-model/material-authoring`.
 *
 * Every value here is plain data. A file is named by a session-local `key`; its
 * bytes stay in the host's session-owned storage and never enter a proposal,
 * a draft recipe or a project.
 */
import type {
	Hash,
	MapRole,
	Mapping,
	NormalConvention,
	Recipe,
	ScalarComponent
} from '../materials/types';

/** An image MIME the S8 v1 set path admits. */
export type SetImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

/** Whether one file may serve a role family, and why not. */
export type RoleAdmission =
	| { readonly ok: true; readonly lossy: boolean }
	| { readonly ok: false; readonly reason: string; readonly action: string };

/**
 * The verified facts of one candidate file. The host computes the digest from
 * the exact bytes it keeps and probes the container header for MIME, oriented
 * dimensions and precision before any role is proposed.
 */
export type SetFileFact = {
	/** Session-local identity, unique within one proposal. Never persisted. */
	readonly key: string;
	/** The creator's file name, used only for grouping and display. */
	readonly name: string;
	readonly hash: Hash;
	readonly mime: SetImageMime | null;
	/** Oriented pixel dimensions; `[0, 0]` when the header could not be read. */
	readonly width: number;
	readonly height: number;
	/** Bits per channel when known. v1 admits 8 only. */
	readonly precision: 8 | null;
	/** Colour admission (sRGB colour path, EXIF orientation honoured). */
	readonly colour: RoleAdmission;
	/** Raw admission (normals and scalar components, no transform). */
	readonly raw: RoleAdmission;
};

/** The vocabulary a role alias proposes. */
export type ProposalSource =
	| 'alias'
	| 'gloss'
	| 'packed-orm'
	| 'packed-rma';

/** One proposed binding: which file, which component and what conversion. */
export type RoleChoice = {
	readonly role: MapRole;
	readonly file: string;
	readonly name: string;
	readonly hash: Hash;
	readonly source: ProposalSource;
	readonly component?: ScalarComponent;
	readonly invert?: boolean;
	readonly convention?: NormalConvention;
	/**
	 * A guess the creator must confirm before acceptance. A generic `normal`
	 * suffix cannot say whether its green channel points up or down.
	 */
	readonly acknowledge?: 'normal-convention';
};

export type ProposalConflictCode =
	| 'duplicate-role'
	| 'packed-loose-collision';

/** A blocking disagreement. The proposal never picks a winning file. */
export type ProposalConflict = {
	readonly code: ProposalConflictCode;
	readonly role: MapRole;
	readonly files: readonly string[];
	readonly action: string;
};

export type ProposalWarningCode =
	| 'empty-stem'
	| 'multiple-resolutions'
	| 'dimension-mismatch'
	| 'lossy-data';

export type ProposalWarning = {
	readonly code: ProposalWarningCode;
	readonly role?: MapRole;
	readonly files: readonly string[];
	readonly detail: string;
};

export type UnassignedReason =
	| 'unknown-suffix'
	| 'unsupported-signal'
	| 'unsupported-image-encoding';

export type UnassignedFile = {
	readonly file: string;
	readonly name: string;
	readonly reason: UnassignedReason;
	/** The role the name proposed when the encoding refused it. */
	readonly role?: MapRole;
	readonly detail: string;
	readonly action: string;
};

export type SetCandidate = {
	/** The normalized stem shared by the grouped files; may be empty. */
	readonly stem: string;
	readonly roleChoices: readonly RoleChoice[];
	readonly conflicts: readonly ProposalConflict[];
	readonly unassigned: readonly UnassignedFile[];
	readonly warnings: readonly ProposalWarning[];
};

export type SetProposal = {
	readonly expectedRevision: string;
	readonly candidates: readonly SetCandidate[];
	readonly fileFacts: readonly SetFileFact[];
};

/** One role's explicit binding in a draft. */
export type DraftRoleEdit =
	| { readonly role: 'color'; readonly file: string; readonly mapping?: Mapping }
	| {
			readonly role: 'normal';
			readonly file: string;
			readonly convention: NormalConvention;
			readonly mapping?: Mapping;
	  }
	| {
			readonly role: 'roughness' | 'metalness' | 'occlusion';
			readonly file: string;
			readonly component: ScalarComponent;
			readonly invert: boolean;
			readonly mapping?: Mapping;
	  };

/** The non-map recipe values a draft may set. Omitted values take defaults. */
export type DraftFactors = {
	readonly color?: string;
	readonly roughness?: number;
	readonly metalness?: number;
	readonly occlusionStrength?: number;
	readonly normalScale?: number;
};

/**
 * Manual composition input, and the normal form every set correction lowers to.
 * Manual creation and set correction both produce exactly this value, so both
 * reach the same recipe and the same registration operation.
 */
export type DraftEdits = {
	readonly name: string;
	readonly factors?: DraftFactors;
	readonly mapping?: Mapping;
	readonly roles: Partial<Readonly<Record<MapRole, DraftRoleEdit>>>;
};

/** A creator's corrections to one proposed candidate. */
export type CandidateCorrections = {
	readonly name?: string;
	readonly factors?: DraftFactors;
	readonly mapping?: Mapping;
	/** Replace a role's file, selector or convention. */
	readonly set?: Partial<Readonly<Record<MapRole, DraftRoleEdit>>>;
	/** Leave a role out of the Finish. */
	readonly exclude?: readonly MapRole[];
	/** Confirm a guess the proposal could not make on its own. */
	readonly acknowledge?: readonly MapRole[];
};

export type DraftIssueCode =
	| 'unresolved-role'
	| 'unacknowledged-guess'
	| 'unknown-file'
	| 'unsupported-image-encoding'
	| 'invalid-name'
	| 'invalid-value'
	| 'out-of-range';

export type DraftIssue = {
	readonly code: DraftIssueCode;
	readonly path: string;
	readonly role?: MapRole;
	readonly action: string;
};

/** A composed recipe plus which session file supplies each digest. */
export type ComposedDraft = {
	readonly name: string;
	readonly recipe: Recipe;
	/** Digest → the session file key that holds its verified bytes. */
	readonly files: ReadonlyMap<Hash, string>;
};

export type ComposeResult =
	| { readonly ok: true; readonly draft: ComposedDraft }
	| { readonly ok: false; readonly issues: readonly DraftIssue[] };
