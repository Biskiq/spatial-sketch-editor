/**
 * The group-copy session's contract.
 *
 * A pointer is the Stage's own hit plus its floor support; a candidate is the
 * composed copy the ghost shows and acceptance installs; a port is one seam the
 * adapter owns (source read, acceptance, lease, selection, notification and the
 * Plan outline only the adapter may project).
 */
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneEntity, Vec3 } from '@portfolio/project-model/scene';
import type {
	GroupTemplate,
	NormalizedPlacementDefinition,
	SceneGroupCopyOrigin,
	SceneSupportChoice,
} from '@portfolio/project-model/scene-planning';
import type {
	CameraFreeSceneDocument,
	LayoutUnitPayload,
	ProjectEnvelope,
} from '@portfolio/project-model/units';
import type {
	GestureAcquisition,
	StageAdapterContext,
	StageCandidatePreview,
	StageGhostMesh,
	StageOverlayContribution,
} from '$lib/authoring/stage/stage-adapter-host';
import type { ArmedGroupCopy } from './group-copy-arm';
import type { SceneWriteOutcome } from './placement';

/**
 * The pointer's own placement facts.
 *
 * `point` is the ray's surface point (or its datum point when the ray reached no
 * drawn body). `wallNormal` is the wall face normal the pointer hit, and is the
 * only wall authority the session reads. `support` is the visible Place support
 * the pointer resolved: already snapped to the Stage grid and pinned with the
 * witness the planner will commit. The `support` origin stands on its X/Z and
 * elevation; the `overhead` origin keeps its any-hit X/Z and reads only the
 * choice, so the floor beneath the pointer stays the one the creator saw.
 */
export type GroupCopyPointer = {
	readonly point: Vec3;
	readonly wallNormal: Vec3 | null;
	readonly support: {
		readonly x: number;
		readonly z: number;
		readonly elevation: number;
		readonly choice: SceneSupportChoice;
	} | null;
};

/** Everything one preview reads from the accepted source. */
export type GroupCopyPlacementSource = {
	readonly projectId: string;
	/** The accepted source content id the support generation is derived from. */
	readonly sourceContentId: string;
	readonly layout: LayoutUnitPayload;
	readonly scene: CameraFreeSceneDocument;
	/** The accepted envelope whose resources and lock the D8a grant rule reads. */
	readonly envelope: ProjectEnvelope;
	readonly definitions: readonly NormalizedPlacementDefinition[];
};

/** The composed copy the ghost shows and acceptance installs. */
export type GroupCopyCandidate = {
	readonly template: GroupTemplate;
	readonly name: string;
	readonly origin: SceneGroupCopyOrigin;
	readonly yaw: number;
	/** The template origin in world space: the mount datum or the floor point. */
	readonly anchor: Vec3;
	/** The approved mount line, e.g. `Hangs from Soffit · 2.40 m`. */
	readonly mount: string;
	readonly entityIds: readonly string[];
	readonly clusterId: string;
	readonly contacts: readonly (number | null)[];
	/** The accepted revision and source generation this preview was built from. */
	readonly preparedFor: {
		readonly revisionId: string;
		readonly sourceContentId: string;
	};
	/** The composed member records, in cluster member order. */
	readonly members: readonly SceneEntity[];
};

export type GroupCopyOutcome =
	| { readonly kind: 'candidate'; readonly candidate: GroupCopyCandidate }
	| { readonly kind: 'committed'; readonly clusterId: string }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string }
	| { readonly kind: 'failed'; readonly code: 'accept-failed'; readonly message: string }
	| { readonly kind: 'idle' };

export type GroupCopyPlacementSession = {
	/** Resolve and hold one template; `null` disarms. No intent, no history. */
	arm(copy: ArmedGroupCopy | null): GroupCopyOutcome;
	armed(): ArmedGroupCopy | null;
	/** Acquire the one lease and derive the first candidate at the pointer. */
	begin(
		copy: ArmedGroupCopy,
		pointer: GroupCopyPointer | null,
		evaluationId: string,
		snappedStep?: number | null,
	): GroupCopyOutcome;
	/** Derive the candidate the ghost shows; a new pointer move clears a refusal. */
	preview(pointer: GroupCopyPointer | null, snappedStep?: number | null): GroupCopyOutcome;
	/** Submit the shown candidate as exactly one `place-group-copy`. */
	commit(): Promise<GroupCopyOutcome>;
	/** Escape: release the lease and disarm without writing. */
	cancel(): void;
	/** A pointer interruption: withdraw the proposal, keep the tool armed. */
	abort(): void;
	candidate(): GroupCopyCandidate | null;
	refusal(): { readonly code: string; readonly message: string } | null;
	proposalLive(): boolean;
	ghosts(): readonly StageGhostMesh[];
	previews(context: StageAdapterContext): readonly StageCandidatePreview[];
	overlays(context: StageAdapterContext): readonly StageOverlayContribution[];
	/** The binding is going away: release, forget and disarm. */
	reset(): void;
};

export type GroupCopyPlacementPorts = {
	readonly read: () => GroupCopyPlacementSource;
	readonly accept: (intent: AuthoringIntent) => Promise<SceneWriteOutcome>;
	readonly acceptedRevisionId: () => string;
	readonly acquireGesture: (request: {
		readonly owner: string;
		readonly evaluationId: string;
		readonly policy: 'cancel-on-reading-change';
	}) => GestureAcquisition;
	readonly selectGroup: (clusterId: string) => void;
	readonly notify: () => void;
	readonly mint?: () => string;
	/**
	 * One member's Plan outline. The adapter injects it because the candidate
	 * presenter is an owner only the adapter may import.
	 */
	readonly outline?: (
		context: StageAdapterContext,
		member: SceneEntity,
		role: StageCandidatePreview['role'],
	) => StageCandidatePreview | null;
};
