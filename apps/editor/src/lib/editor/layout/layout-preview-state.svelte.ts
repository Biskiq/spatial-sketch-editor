
import { createEmptySceneDocument, createEmptyWorldLocalSceneDocument, type SceneDocument } from '$lib/content/scene';
import type { Project } from '$lib/project/project-types';
import {
	createEmptyLayoutDocument,
	createEmptyWallFirstLayoutDocument,
	decodeLayoutJsonCompatible,
	decodeLayoutValueCompatible,
	serializeWallFirstLayoutDocument,
	serializeLayoutDocument,
	validateLayoutDocument
} from '$lib/layout/layout-codec';
import {
	buildLayoutPreviewModel,
	projectLayoutPreviewModel,
	type LayoutPreviewModel,
	type LayoutPreviewModelResult
} from './layout-mesh-factory';
import type { LayoutBounds3 as LayoutPreviewBounds } from '$lib/layout/layout-geometry-types';
import type {
	DraftSegment,
	LayoutDocument,
	LayoutObject,
	LayoutOpening,
	LayoutRoom,
	LayoutVec2
} from '$lib/layout/layout-types';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
import {
	layoutAuthoredCanonicalJson,
	layoutIdentityCursor,
	promoteLayoutIdentity,
	repairLayoutIdentityCursor,
	withLayoutIdentity
} from '$lib/layout/layout-identity';
import {
	planExactJunctionMove,
	planDeleteLayoutObject,
	planCommitLayoutObjectPreset,
	planExactLayoutObjectTransform,
	planExactRectangleDimensions,
	planExactWallAngle,
	planExactWallLength,
	planExactWallHeight,
	planExactWallThickness,
	planRigidWallMove,
	planWallSubdivision,
	planConvertWallToCurve,
	planConvertWallToLine,
	planBendWallCurveKnot,
	planDeleteWallCurveKnot,
	planInsertWallCurveKnot,
	planMoveWallCurveKnot,
	p2311Measure,
	type FixedWallEndpoint,
	type LayoutArchitecturalPresetId,
	type WallBendIntent,
	type LayoutObjectTransformPatch,
	type PrecisionOperation,
	type PrecisionPlan,
	type PrecisionRejection,
	type WallFirstAcceptanceCompile
} from '$lib/layout/layout-wall-first-precision';
import {
	planDeleteWall,
	planDissolveJunction,
	planRemoveRoom,
	planRoomMetadataUpdate,
	planWallMetadataUpdate,
	planOpeningMetadataUpdate,
	planWallRoleChange,
	roomExclusiveBoundaryWallIds,
	type LayoutWallRole as WallRoleChangeRole,
	type OptionalNamePatch,
	type RoomMetadataPatch
} from '$lib/layout/layout-wall-topology-ops';
import type { NodingIdAllocator } from '$lib/layout/layout-wall-noding';
import { planWallChain, planWallSegment, type LayoutWallRole as ChainWallRole } from '$lib/layout/layout-wall-chain';
import { deleteInteriorAnchorOnSegment, insertInteriorAnchorOnSegment, pointInRoom, replaceRoomPoints, updateInteriorAnchorOnSegment } from './layout-editing';
import {
	appendRoomOpening,
	createDefaultOpening,
	findRoomOpening,
	nextOpeningId,
	removeRoomOpening,
	replaceRoomOpening,
	type LayoutOpeningKind,
	type LayoutOpeningPatch,
	type WallFirstOpeningCreateIntent
} from './layout-opening-editing';
import {
	planCenterWallFirstOpening,
	planCreateWallFirstOpening,
	planDeleteWallFirstOpening,
	planMoveWallFirstOpening,
	planUpdateWallFirstOpening,
	wallFirstOpeningMetrics,
	type WallFirstOpeningMetrics,
	type WallOpeningOperation,
	type WallOpeningPatch,
	type WallOpeningPlan
} from '$lib/layout/layout-wall-openings';
import {
	planDuplicateIsolatedRoom,
	planRepeatLayoutObject,
	planRepeatWallOpening,
	type DuplicateOperation,
	type DuplicatePlan,
	type RoomDuplicateIntent,
	type LayoutObjectRepeatIntent,
	type WallOpeningRepeatIntent
} from '$lib/layout/layout-duplicate';
import {
	resolveIsolatedRoomGroupSubgraph,
	type IsolatedRoomGroupSubgraph,
	type RoomIsolationRejection
} from '$lib/layout/layout-room-isolation';
import { planWallFirstRoomMove, type RoomMoveRejectionCode } from '$lib/layout/layout-room-move';
import { hasBlockingLayoutIssues, validateLayoutDocumentGeometry, validateLineRoom, type LayoutGeometryIssue } from '$lib/layout/layout-geometry-validation';
import { deleteLayoutRoom as deleteRoomFromDocument } from './layout-room-editing';
import {
	createLayoutObject,
	defaultLayoutObjectDimensions,
	deleteLayoutObject as deleteObjectFromDocument,
	isKnownLayoutRoomId,
	nextLayoutObjectId,
	patchLayoutObject,
	primitiveObjectGeometry,
	type AuthoredLayoutObjectKind,
	type LayoutObjectPatch
} from './layout-object-editing';
import type { Vec3 } from '$lib/types/scene';
import type { CompiledLayoutGeometry } from '$lib/layout/layout-geometry-types';
import { buildRoomWallMesh, buildStandaloneWallMesh, type IndexedWallMesh } from '$lib/layout/wall-mesh-builder';
import { buildLayout3dTriangleIndex, type Layout3dPickIndex } from './layout-3d-picking';
import { transformLayoutRoomUnit, type LayoutRoomUnitTransform } from './layout-room-transform';
import { deriveLayoutRoomFrame } from '$lib/layout/layout-room-frame';
// type-only (erased at runtime; the candidate module imports
// `derivePreviewBundle` from here as its only value dependency).
import type { LayoutGizmoCandidateBundle } from '../gizmo/layout-gizmo-candidate';

export type LayoutPreviewSource = 'chopin-fixture' | 'empty' | 'draft' | 'imported';
export type LayoutBaselineKind = 'blank' | 'imported';
export type LayoutSessionStatus = 'blank' | 'dirty' | 'imported';
export type EditorLayoutDocument = LayoutDocument | LayoutDocumentWallFirst;

export type LayoutPreviewState = {
	source: LayoutPreviewSource;
	project: Project;
	model: LayoutPreviewModel;
	geometry: CompiledLayoutGeometry;
	/**
	 * Derived cache: one prebuilt `IndexedWallMesh` per compiled room, keyed by
	 * `roomId`. A `Map` (not a plain object) so valid IDs like `constructor`
	 * cannot collide with prototype keys. Rebuilds with `geometry` on every
	 * mutation and is *not* part of the undo snapshot. The scene renders only
	 * these prebuilt meshes — it never builds geometry inline.
	 */
	wallMeshesByRoom: ReadonlyMap<string, IndexedWallMesh>;
	/**
	 * Derived cache: one prebuilt render-only `IndexedWallMesh` per canonical
	 * physical Wall, keyed by `wallId` (P23.9). Render-only for interaction;
	 * canonical wall-first 3D picking is post-P23. These meshes are never entered
	 * into `layout3dPickIndexByRoom` (no fake `roomId` ownership for picking).
	 * Same lifecycle as `wallMeshesByRoom`, never in the undo snapshot.
	 */
	wallMeshesByWall: ReadonlyMap<string, IndexedWallMesh>;
	/**
	 * triangle reverse index per compiled room, built once per mesh
	 * generation beside `wallMeshesByRoom` (same lifecycle, never in the undo
	 * snapshot). S6's 3D selection coordinator resolves raycast hit triangles
	 * through it instead of re-walking `pickRanges` per hit.
	 */
	layout3dPickIndexByRoom: ReadonlyMap<string, Layout3dPickIndex>;
	issues: LayoutGeometryIssue[];
	bounds: LayoutPreviewBounds | null;
	previewVersion: number;
	reframeVersion: number;
	showCeilings: boolean;
	lastMutationMessage: string | null;
	statusMessage: string | null;
	importError: string | null;
	baselineLayoutJson: string;
	baselineKind: LayoutBaselineKind;
	/**
	 * P23.12 — the session **allocation high-water mark** for compact references.
	 *
	 * Allocation bookkeeping, not authored content: it is *not* part of
	 * `LayoutPreviewSnapshot`, so Undo/Redo cannot rewind it, and it is excluded
	 * from every change comparison (dirty state, snapshot-matches-live, history
	 * `matches`, the project fingerprint). It only ever moves forward, at the
	 * seams where a live state becomes the document of record, which is why a
	 * reference retired by a delete or an Undo branch can never be handed to a
	 * different entity.
	 */
	identityHighWater: number;
};

export type LayoutDraftCommitResult =
	| { success: true; roomId: string }
	| { success: false; message: string };

export type LayoutRoomEditResult =
	| { success: true }
	| { success: false; message: string };

export type LayoutInteriorAnchorMutationResult =
	| { success: true; anchorId: string }
	| { success: false; message: string };

export type LayoutOpeningMutationResult =
	| { success: true; openingId: string }
	| { success: false; message: string };

export type LayoutObjectMutationResult =
	| { success: true; objectId: string }
	| { success: false; message: string };

export type WallFirstPrecisionMutationResult =
	| { success: true; operation: PrecisionOperation }
	| {
			success: true;
			/** P23.3 canonical Opening operation (create/update/delete). */
			operation: WallOpeningOperation;
			/** The authored Opening the operation produced or removed. */
			openingId: string;
	  }
	| {
			success: true;
			operation: 'wall-chain-commit';
			/** Wall IDs created by the committed chain. */
			wallIds: string[];
			/** Room IDs born from the chain's reconciliation (boundary chains). */
			roomIds: string[];
	  }
	| {
			success: true;
			operation: 'wall-segment-commit';
			/** Authored-segment Wall IDs (candidate lineage/fragments, not host fragments). */
			wallIds: string[];
			/** All new Wall records the transaction caused (authored + host fragments). */
			allWallIds: string[];
			/** Room IDs born from the segment's reconciliation (boundary segments). */
			roomIds: string[];
			/** Canonical resolved start Junction of the committed candidate. */
			startJunctionId: string;
			/** Canonical resolved end Junction (next continuation start). */
			endJunctionId: string;
			/**
			 * P23.6I — the height this segment actually authored, read back from the
			 * committed document. The continuous-run caller stores it as transient run
			 * state and passes it to every later segment of the same run. Absent only
			 * when the commit authored no Wall (nothing to continue at that height).
			 */
			wallHeight?: number;
	  }
	| {
			success: false;
			message: string;
			/**
			 * P23.10 — the canonical planner's own rejection code when the failure
			 * came from `PrecisionPlan` (never from applying or installing it), so a
			 * gesture can tell a real rejection from a no-op release without parsing
			 * the message.
			 */
			code?: PrecisionRejection['code'];
	  };

/** P23.4 duplicate/repeat results carry the created IDs for selection. */
/** P23.6a Room-unit move result through the one document-install point. */
export type WallFirstRoomMoveMutationResult =
	| { success: true; operation: 'room-move' }
	| { success: false; message: string };

/**
 * P23.6a — the editor-facing move result. `movedRoomIds` is the connected Room
 * group that actually travelled (the dragged Room is always a member), so the
 * status line can report the unit honestly.
 *
 * `code` is the planner's own machine code when the rejection came from the
 * canonical plan, so a caller can tell a real rejection from a gesture that
 * asked for nothing (`no_op` — a press/release that never moved the pointer).
 * It is absent when the failure came from applying or installing a plan.
 */
export type LayoutRoomMoveResult =
	| { success: true; movedRoomIds: readonly string[] }
	| { success: false; message: string; code?: RoomMoveRejectionCode };

/**
 * P23.6a — should this wall-first Room expose a whole-unit move gesture, and
 * which Rooms travel with it? `movable: false` carries the shared isolation
 * policy's own rejection so the viewport can explain *why* without duplicating
 * policy in the component.
 */
export type WallFirstRoomMoveEligibility =
	| { movable: true; subgraph: IsolatedRoomGroupSubgraph }
	| { movable: false; rejection: RoomIsolationRejection; hint: string };

/**
 * User-facing phrasing for a non-movable Room. The rejection itself stays the
 * P23.4-faithful diagnostic (shared with duplicate); the hint adds the
 * actionable move guidance the Plan status line shows.
 */
function roomMoveStatusHint(rejection: RoomIsolationRejection): string {
	return rejection.code === 'room_not_isolated'
		? `${rejection.message}. Move its Walls individually.`
		: rejection.message;
}

export type WallFirstDuplicateMutationResult =
	| {
			success: true;
			operation: DuplicateOperation;
			createdObjectIds: readonly string[];
			createdOpeningIds: readonly string[];
			/** Set only by Room duplicate. */
			createdRoomId?: string;
			/** Set only by Room duplicate: canonical selection continuation. */
			createdWallIds?: readonly string[];
	  }
	| { success: false; message: string };

export type LayoutRoomFieldPatch = Partial<
	Pick<LayoutRoom, 'name' | 'wallThickness' | 'floorThickness' | 'ceilingThickness'>
> & { floorHeight?: number };

export function createLayoutPreviewState(
	layout: LayoutDocument,
	scene: SceneDocument
): LayoutPreviewState {
	return createState('chopin-fixture', layout, scene, 0);
}

/**
 * boot a blank layout surface (`baselineKind: 'blank'`, empty layout +
 * empty scene) for the boot-into-empty editor. The Chopin-fixture factory
 * (`createLayoutPreviewState(project, scene)`) remains the frozen relic's
 * boot source — the relic shell passes the Chopin project layout + scene
 * document explicitly (P7.3).
 */
export function createEmptyLayoutPreviewState(): LayoutPreviewState {
	return createState('empty', createEmptyLayoutDocument(), createEmptySceneDocument(), 0);
}

/**
 * Boot a blank WALL-FIRST layout surface — the editor's new-project state.
 *
 * P23.3 reachability: the canonical Junction/Wall/Room/Opening authoring path
 * (including the wall-first Opening flow) only applies to a wall-first Layout
 * document, so importing a wall-first Layout JSON used to be the only way to
 * reach it. Booting the canonical pair closes that gap. The Scene is
 * world-local because `validateProject` rejects a wall-first Layout carrying
 * the recognized legacy Scene, and the composer pairs this layout with the
 * scene store document for Save.
 *
 * `createEmptyLayoutPreviewState` keeps returning the legacy blank document:
 * it is the fixture for the legacy Room/opening mutator surfaces and their
 * existing coverage, not the new-project boot.
 */
export function createEmptyWallFirstLayoutPreviewState(): LayoutPreviewState {
	return createState(
		'empty',
		wallFirstEmptyLayout(),
		createEmptyWorldLocalSceneDocument(),
		0
	);
}

/** Canonical empty wall-first document through the legacy `Project` seam. */
function wallFirstEmptyLayout(): Project['layout'] {
	return createEmptyWallFirstLayoutDocument() as unknown as Project['layout'];
}

export function layoutPreviewSourceLabel(source: LayoutPreviewSource): string {
	switch (source) {
		case 'chopin-fixture':
			return 'Chopin fixture';
		case 'empty':
			return 'Empty layout';
		case 'draft':
			return 'Draft layout';
		case 'imported':
			return 'Imported layout';
	}
}

/** Derived — do not store on `$state` objects (getters break Svelte 5 proxies). */
export function layoutPreviewIsDirty(state: LayoutPreviewState): boolean {
	return authoredLayoutJson(state.project.layout) !== state.baselineLayoutJson;
}

export function layoutPreviewSessionStatus(state: LayoutPreviewState): LayoutSessionStatus {
	return layoutPreviewIsDirty(state) ? 'dirty' : state.baselineKind;
}

export function layoutPreviewStatusLabel(state: LayoutPreviewState): string {
	const status = layoutPreviewSessionStatus(state);
	return status === 'dirty' ? 'Unsaved' : status === 'blank' ? 'Blank' : 'Imported';
}

export function layoutPreviewDocument(state: LayoutPreviewState): EditorLayoutDocument {
	return state.project.layout as unknown as EditorLayoutDocument;
}

function isWallFirstLayoutDocument(layout: EditorLayoutDocument): layout is LayoutDocumentWallFirst {
	return 'formatVersion' in layout;
}

function wallFirstLegacyEditMessage(state?: LayoutPreviewState): string {
	const message = 'Legacy room, opening, and primitive tools are unavailable for wall-first layouts; use Architecture · exact.';
	if (state) {
		state.lastMutationMessage = message;
		state.statusMessage = message;
	}
	return message;
}

function canonicalLayoutJson(layout: EditorLayoutDocument): string {
	return isWallFirstLayoutDocument(layout)
		? serializeWallFirstLayoutDocument(layout)
		: serializeLayoutDocument(layout);
}

/**
 * P23.12 — the **authored** canonical JSON: the canonical form with
 * `identity.cursor` omitted.
 *
 * The cursor is allocation bookkeeping, so it must never take part in a change
 * comparison: a cursor that moved (or was rewound by Undo) would otherwise
 * report the document as unsaved or create a phantom history entry. The
 * reference ledger itself is authored and stays in the comparison, as does every
 * Wall/Opening name.
 */
function authoredLayoutJson(layout: EditorLayoutDocument): string {
	return isWallFirstLayoutDocument(layout)
		? layoutAuthoredCanonicalJson(layout)
		: serializeLayoutDocument(layout);
}

export function layoutPreviewAuthoredJson(state: LayoutPreviewState): string {
	return authoredLayoutJson(state.project.layout);
}

/**
 * P23.12 — the authored form of an **arbitrary** layout (used by the Save
 * success callback to baseline the snapshot that was sent, never the live
 * document, so an edit made during the request stays dirty).
 */
export function layoutAuthoredJsonOf(layout: EditorLayoutDocument): string {
	return authoredLayoutJson(layout);
}

/**
 * Full canonical JSON, **including** the allocation cursor — the Save/export
 * payload form. Promotion runs before any caller serializes this, so a saved or
 * exported payload can never sit below the session mark.
 */
export function layoutPreviewCanonicalJson(state: LayoutPreviewState): string {
	return canonicalLayoutJson(state.project.layout);
}

/**
 * The allocation base for a provisional derivation of `layout`, latched as
 * `max(document cursor, session high-water)`.
 *
 * Reading the document cursor **alone** is what would break the never-reassigned
 * guarantee: after `create A → undo` the document cursor is legitimately rewound
 * while the mark is not, and a fresh allocation would hand A's retired reference
 * to a different entity.
 */
export function layoutPreviewIdentityBase(
	state: LayoutPreviewState,
	layout: EditorLayoutDocument
): number {
	const cursor = isWallFirstLayoutDocument(layout) ? layoutIdentityCursor(layout) : 0;
	return Math.max(cursor, state.identityHighWater);
}

/**
 * The allocation base for a wholesale replacement: the incoming document's own
 * cursor (the caller repairs it upward first when a live token sits at or
 * above it). Legacy documents resolve at 0.
 */
export function replacementIdentityBase(layout: EditorLayoutDocument): number {
	return isWallFirstLayoutDocument(layout) ? layoutIdentityCursor(layout) : 0;
}

/**
 * Normalize an incoming replacement document (cloud Load / resumed save):
 * repair a stale cursor upward against the payload's own ledger so the
 * document can be resolved and installed ledger-complete.
 */
export function normalizeIncomingLayout(layout: EditorLayoutDocument): EditorLayoutDocument {
	return isWallFirstLayoutDocument(layout)
		? (repairLayoutIdentityCursor(layout) as unknown as EditorLayoutDocument)
		: layout;
}

/**
 * **Provisional** identity resolution for a candidate document: mint into the
 * copy only, never advancing anything in `state`.
 *
 * Called by every derivation, so a pointermove candidate renders honest
 * references; a candidate that is rolled back consumed nothing, and the tokens it
 * displayed are exactly the tokens a later commit keeps.
 */
function withProvisionalLayoutIdentity(
	layout: EditorLayoutDocument,
	identityBase: number
): EditorLayoutDocument {
	if (!isWallFirstLayoutDocument(layout)) return layout;
	return withLayoutIdentity(layout, { base: identityBase });
}

/**
 * **Durable** promotion at a seam where the live state becomes the document of
 * record (a transaction commit, a Save/export payload).
 *
 * Writes the `identity` block only: geometry, issues and bounds are already
 * compiled from this document and `identity` is not an input to the compiler, so
 * nothing is recompiled and the installed bundle stays valid. The mark never
 * moves backwards, including when there is nothing to mint, which is what keeps a
 * serialized cursor at or above the mark.
 */
export function promoteLayoutPreviewIdentity(state: LayoutPreviewState): void {
	const layout = state.project.layout as unknown as EditorLayoutDocument;
	if (!isWallFirstLayoutDocument(layout)) return;
	const base = layoutPreviewIdentityBase(state, layout);
	const promoted = promoteLayoutIdentity(layout, { base });
	if (promoted.document !== layout) {
		state.project = { ...state.project, layout: promoted.document as unknown as Project['layout'] };
	}
	state.identityHighWater = Math.max(state.identityHighWater, promoted.cursor);
}

/**
 * P23.9 segment-first — does an incoming history snapshot carry the
 * already-live layout? `HistoryController.commitLayout()` re-installs the
 * just-committed snapshot through `host.replace()` on every successful
 * transaction, so an unconditional clear would destroy the continuous run
 * after each segment (reseeding `runStart` from the current leg and losing
 * `wallChainLastDirection`, which breaks `DA→A` closure). Only a genuinely
 * different layout — Undo/Redo/cancel/external replacement — terminates the
 * run. Same JSON comparison as the history `matches` predicate so the two
 * decisions can never diverge.
 */
export function layoutPreviewSnapshotMatchesLive(
	state: LayoutPreviewState,
	snapshot: LayoutPreviewSnapshot
): boolean {
	try {
		return (
			authoredLayoutJson(state.project.layout as unknown as EditorLayoutDocument) ===
			authoredLayoutJson(snapshot.project.layout as unknown as EditorLayoutDocument)
		);
	} catch {
		return false;
	}
}

/**
 * Preflight the procedural wall meshes for every compiled room plus every
 * canonical physical Wall. Rooms with empty wall detail are wall-first
 * canonical rooms (their Walls render via `wallMeshesByWall`); they build
 * no room mesh and yield no issue — a compiled legacy room always carries
 * walls, so legacy `room_no_walls` behavior is preserved. Failed builds
 * yield structured issues (no mesh) that the editor surfaces in
 * `layoutPreview.issues`; the scene renders only meshes that built.
 */
function buildWallMeshesByRoom(geometry: CompiledLayoutGeometry): {
	wallMeshesByRoom: ReadonlyMap<string, IndexedWallMesh>;
	wallMeshesByWall: ReadonlyMap<string, IndexedWallMesh>;
	layout3dPickIndexByRoom: ReadonlyMap<string, Layout3dPickIndex>;
	issues: LayoutGeometryIssue[];
} {
	const wallMeshesByRoom = new Map<string, IndexedWallMesh>();
	const wallMeshesByWall = new Map<string, IndexedWallMesh>();
	const layout3dPickIndexByRoom = new Map<string, Layout3dPickIndex>();
	const issues: LayoutGeometryIssue[] = [];
	const canonicalMode = geometry.walls.length > 0;
	for (const room of geometry.rooms) {
		if (room.walls.length === 0) {
			if (!canonicalMode) {
				const result = buildRoomWallMesh(room);
				issues.push(...result.issues);
			}
			continue;
		}
		const result = buildRoomWallMesh(room);
		if (result.mesh) {
			wallMeshesByRoom.set(room.roomId, result.mesh);
			// Built once per mesh generation (). A partition violation throws
			// here — fail-closed, mirroring the builder's own reject-with-issues.
			layout3dPickIndexByRoom.set(room.roomId, buildLayout3dTriangleIndex(result.mesh));
		}
		issues.push(...result.issues);
	}
	// P23.6H — the canonical Wall's own authoritative height supplies the mesh
	// vertical extent; no Floor-derived ceiling is passed (or derivable) here.
	const floorElevationById = new Map(geometry.floors.map((floor) => [floor.floorId, floor.elevation] as const));
	for (const wall of geometry.walls) {
		const floorElevation = floorElevationById.get(wall.floorId) ?? 0;
		const result = buildStandaloneWallMesh(wall, floorElevation);
		if (result.mesh) wallMeshesByWall.set(wall.wallId, result.mesh);
		issues.push(...result.issues);
	}
	return { wallMeshesByRoom, wallMeshesByWall, layout3dPickIndexByRoom, issues };
}

/**
 * Derived cache: one prebuilt `IndexedWallMesh` per compiled room plus one per
 * canonical physical Wall, and the 3D pick index built beside them.
 *
 * Every field is a **pure function of one compiled geometry** — no document, no
 * history, no selection. A direct-edit gesture installs the *same* frozen
 * baseline geometry on every pointermove (restore) while it derives one fresh
 * candidate geometry per accepted move, so without this the baseline's meshes
 * were rebuilt from scratch dozens of times for a document that never changed.
 *
 * Keyed by geometry **object identity**: a compile always produces a new
 * geometry, so an entry can never be read for a different document, and the
 * entry is released with the geometry that owns it (never a stale cache across
 * document replacement — a replaced document is a different object). Nothing
 * here is ever a semantic authority: the document and its validation stay the
 * only source of truth, and undo/history never see it.
 */
const derivedWallMeshes = new WeakMap<
	CompiledLayoutGeometry,
	{
		wallMeshesByRoom: ReadonlyMap<string, IndexedWallMesh>;
		wallMeshesByWall: ReadonlyMap<string, IndexedWallMesh>;
		layout3dPickIndexByRoom: ReadonlyMap<string, Layout3dPickIndex>;
		issues: readonly LayoutGeometryIssue[];
	}
>();

/**
 * Build the wall-mesh / pick-index caches for a compiled geometry, or reuse the
 * one already derived for that exact geometry object.
 *
 * The caller always receives **fresh `Map` instances** wrapping the cached
 * meshes, so installing a restored baseline still invalidates the reactive
 * consumers exactly as a rebuild did — the meshes (the expensive part) are
 * reused, the container never is.
 */
function resolveWallMeshes(geometry: CompiledLayoutGeometry): {
	wallMeshesByRoom: ReadonlyMap<string, IndexedWallMesh>;
	wallMeshesByWall: ReadonlyMap<string, IndexedWallMesh>;
	layout3dPickIndexByRoom: ReadonlyMap<string, Layout3dPickIndex>;
	issues: readonly LayoutGeometryIssue[];
} {
	const cached = derivedWallMeshes.get(geometry);
	if (cached) return cached;
	const built = p2311Measure('mesh-prebuild', () => buildWallMeshesByRoom(geometry));
	derivedWallMeshes.set(geometry, built);
	return built;
}

/** Install the derived wall-mesh caches for one geometry onto the live state. */
function installWallMeshes(state: LayoutPreviewState, geometry: CompiledLayoutGeometry): void {
	const meshes = resolveWallMeshes(geometry);
	state.wallMeshesByRoom = new Map(meshes.wallMeshesByRoom);
	state.wallMeshesByWall = new Map(meshes.wallMeshesByWall);
	state.layout3dPickIndexByRoom = new Map(meshes.layout3dPickIndexByRoom);
}

/**
 * Apply a fresh compile result to the state and rebuild the derived wall-mesh
 * cache, merging any mesh issues into `state.issues`.
 */
function applyCompiledLayout(state: LayoutPreviewState, result: LayoutPreviewModelResult): void {
	installWallMeshes(state, result.geometry);
	const meshIssues = resolveWallMeshes(result.geometry).issues;
	const issues = meshIssues.length > 0 ? [...result.issues, ...meshIssues] : result.issues;
	state.model = result.model;
	state.geometry = result.geometry;
	state.issues = issues;
	state.bounds = result.bounds;
}

/**
 * The accepted planner compile a preview install may reuse: the geometry that
 * acceptance already produced for `documentJson`. It is a *result*, never an
 * authority — `reusesAcceptedCompile` re-proves the document below before a
 * single byte of it is installed.
 */
export type PreviewCompileReuse = {
	documentJson: string;
	geometry: CompiledLayoutGeometry;
	issues: readonly LayoutGeometryIssue[];
};

/**
 * Compile the decoded layout for install, or reuse the accepted planner's own
 * compile when the document it was accepted for is provably the one about to be
 * installed.
 *
 * The preview compiles the **re-parsed** document (`createPreviewProject`
 * decodes it), so reuse is sound only if that re-parse preserved the document
 * acceptance proved. One canonical serialization answers exactly that: the
 * codec's canonical JSON covers every field the compiler reads, so equal
 * canonical JSON means the same compile input and therefore the same geometry,
 * issues and bounds. Anything else falls back to the ordinary compile — one
 * canonical `compileLayoutGeometry()` authority, one accepted document, same
 * issue ordering, same Plan/3D/museum geometry.
 */
function resolvePreviewCompile(
	layout: EditorLayoutDocument,
	reuse: PreviewCompileReuse | undefined
): LayoutPreviewModelResult {
	if (reuse && reusesAcceptedCompile(layout, reuse)) {
		return p2311Measure('preview-compile-reused', () => ({
			model: projectLayoutPreviewModel(reuse.geometry),
			geometry: reuse.geometry,
			issues: [...reuse.issues],
			bounds: reuse.geometry.bounds
		}));
	}
	return p2311Measure('preview-compile', () => buildLayoutPreviewModel(layout));
}

function reusesAcceptedCompile(layout: EditorLayoutDocument, reuse: PreviewCompileReuse): boolean {
	// Only wall-first documents can carry a planner compile.
	if (!isWallFirstLayoutDocument(layout)) return false;
	return serializeWallFirstLayoutDocument(layout) === reuse.documentJson;
}

/**
 * Fully derive the preview bundle for a candidate layout: validated project +
 * compiled model + geometry + wall-mesh preflight. Throws on any failure so
 * callers commit the result atomically — a caught error must leave the
 * committed `LayoutPreviewState` untouched (no stale model/geometry paired
 * with a new project).
 */
export function derivePreviewBundle(
	projectId: string,
	projectName: string,
	layout: EditorLayoutDocument,
	scene: Project['scene'],
	reuse?: PreviewCompileReuse,
	/**
	 * P23.12 — the operation's latched allocation base (`max(document cursor,
	 * session high-water)`). Omitted means "do not resolve references here":
	 * pure readers such as the 3D preview coordinator must not pay for minting,
	 * and a caller that installs always passes it (see
	 * `deriveInstallBundle`).
	 */
	identityBase?: number
): {
	project: Project;
	model: LayoutPreviewModel;
	geometry: CompiledLayoutGeometry;
	wallMeshesByRoom: ReadonlyMap<string, IndexedWallMesh>;
	wallMeshesByWall: ReadonlyMap<string, IndexedWallMesh>;
	layout3dPickIndexByRoom: ReadonlyMap<string, Layout3dPickIndex>;
	issues: LayoutGeometryIssue[];
	bounds: LayoutPreviewBounds | null;
} {
	const project = createPreviewProject({ id: projectId, name: projectName, layout, scene });
	// The compile runs **before** identity resolution on purpose: the accepted
	// planner's compile is reused when its canonical JSON still matches
	// (`reusesAcceptedCompile`), and the accepted document has no identity block.
	// Minting first would miss that fast path on every install and silently
	// recompile on the pointermove path.
	const result = resolvePreviewCompile(project.layout, reuse);
	const resolvedLayout =
		identityBase === undefined
			? project.layout
			: withProvisionalLayoutIdentity(project.layout, identityBase);
	// `identity` is not an input to the compiler, so reusing the compiled model,
	// geometry and bounds for the identity-resolved document is exact.
	const installedProject =
		resolvedLayout === project.layout
			? project
			: { ...project, layout: resolvedLayout as unknown as Project['layout'] };
	const meshes = resolveWallMeshes(result.geometry);
	return {
		project: installedProject,
		model: result.model,
		geometry: result.geometry,
		wallMeshesByRoom: new Map(meshes.wallMeshesByRoom),
		wallMeshesByWall: new Map(meshes.wallMeshesByWall),
		layout3dPickIndexByRoom: new Map(meshes.layout3dPickIndexByRoom),
		issues: meshes.issues.length > 0 ? [...result.issues, ...meshes.issues] : result.issues,
		bounds: result.bounds
	};
}

/**
 * Derive the bundle this state would install for `layout` — the ordinary
 * derivation plus **provisional** reference resolution for this state's latched
 * allocation base (P23.12).
 */
function deriveInstallBundle(
	state: LayoutPreviewState,
	layout: EditorLayoutDocument,
	projectName: string = state.project.name,
	reuse?: PreviewCompileReuse,
	/**
	 * P23.12 — a **wholesale replacement** (import / load / resumed save) passes
	 * `replacement: true`: the incoming document is a different document of
	 * record, so its allocation base is its own repaired cursor — never the
	 * previous document's high-water mark, which would leak this session's
	 * retired allocations into the replacement and make two imports of the
	 * same ledger-less payload resolve differently.
	 */
	replacement = false
): ReturnType<typeof derivePreviewBundle> {
	const identityBase = replacement
		? replacementIdentityBase(layout)
		: layoutPreviewIdentityBase(state, layout);
	return derivePreviewBundle(
		state.project.id,
		projectName,
		layout,
		state.project.scene,
		reuse,
		identityBase
	);
}

/** Install a derived bundle in one shot; never partially mutates committed state. */
function commitPreviewBundle(state: LayoutPreviewState, bundle: ReturnType<typeof derivePreviewBundle>): void {
	state.project = bundle.project;
	state.model = bundle.model;
	state.geometry = bundle.geometry;
	state.wallMeshesByRoom = bundle.wallMeshesByRoom;
	state.wallMeshesByWall = bundle.wallMeshesByWall;
	state.layout3dPickIndexByRoom = bundle.layout3dPickIndexByRoom;
	state.issues = bundle.issues;
	state.bounds = bundle.bounds;
}

/** Install a fully preflighted remote layout without re-deriving it. */
export function installLayoutPreviewBundle(
	state: LayoutPreviewState,
	bundle: ReturnType<typeof derivePreviewBundle>
): void {
	state.source = 'imported';
	commitPreviewBundle(state, bundle);
	state.previewVersion += 1;
	state.reframeVersion += 1;
	state.lastMutationMessage = null;
	state.statusMessage = null;
	state.importError = null;
	// P23.12 — a wholesale replacement (import/load/reset/resumed save) re-seeds
	// the allocation mark from the payload, exactly as it adopts the payload's
	// canonical IDs and Rooms. This is the documented scope boundary of the
	// never-reassigned guarantee; the assertion in the caller is that the payload
	// really is a different document.
	state.identityHighWater = layoutIdentityCursor(
		bundle.project.layout as unknown as LayoutDocumentWallFirst
	);
}

/**
 * Save baseline only; unlike import/reset this preserves selection and history.
 *
 * P23.12 — the default baseline is the **authored** canonical JSON (cursor
 * omitted), and callers that pass an explicit string must pass the same form
 * (`layoutPreviewAuthoredJson`), so a cursor that moved during Save cannot make
 * the session read dirty immediately afterwards.
 */
export function markLayoutPreviewSaved(
	state: LayoutPreviewState,
	authoredJson = layoutPreviewAuthoredJson(state)
): void {
	state.baselineLayoutJson = authoredJson;
	state.baselineKind = 'imported';
}

/**
 * install the layout adapter's last-valid candidate in one shot
 * (the same field set `commitPreviewBundle` writes, plus the session
 * bookkeeping the Plan mutators bump). The candidate was already derived
 * through `derivePreviewBundle`, so this never re-validates and never throws.
 */
export function commitLayoutCandidate(
	state: LayoutPreviewState,
	bundle: LayoutGizmoCandidateBundle
): void {
	state.project = bundle.project;
	state.model = bundle.model;
	state.geometry = bundle.geometry;
	state.wallMeshesByRoom = bundle.wallMeshesByRoom;
	state.wallMeshesByWall = bundle.wallMeshesByWall ?? new Map();
	state.layout3dPickIndexByRoom = bundle.layout3dPickIndexByRoom;
	state.issues = bundle.issues;
	state.bounds = bundle.bounds;
	state.previewVersion += 1;
	state.lastMutationMessage = null;
	state.statusMessage = null;
	state.importError = null;
	// P23.12 — the candidate bundle was never installed during the drag, so this
	// is the first time its provisional references reach live state. Nothing is
	// minted here (only promotion mints durably) and the mark never moves back.
	state.identityHighWater = Math.max(
		state.identityHighWater,
		layoutIdentityCursor(bundle.project.layout as unknown as LayoutDocumentWallFirst)
	);
}

/** Report a failed layout import without changing the committed preview or baseline. */
export function setLayoutPreviewImportError(state: LayoutPreviewState, message: string): void {
	state.importError = message;
	state.statusMessage = `Import failed: ${message}`;
}

export function loadChopinLayoutPreview(
	state: LayoutPreviewState,
	layout: LayoutDocument
): boolean {
	replaceState(
		state,
		createState('chopin-fixture', layout, state.project.scene, state.previewVersion)
	);
	return true;
}

export function resetLayoutPreview(state: LayoutPreviewState): boolean {
	// Reset is a LAYOUT-only command: it must not wipe the scene, and it must
	// not change the document's format under the user (a wall-first Layout
	// carrying the legacy Scene is rejected by `validateProject`, so a blind
	// reset would leave the project unsaveable). Empty the layout in the
	// format family the document already has.
	const emptyLayout = isWallFirstLayoutDocument(layoutPreviewDocument(state))
		? wallFirstEmptyLayout()
		: createEmptyLayoutDocument();
	replaceState(
		state,
		createState('empty', emptyLayout, state.project.scene, state.previewVersion)
	);
	return true;
}

export function refreshLayoutPreview(state: LayoutPreviewState): boolean {
	applyCompiledLayout(state, buildLayoutPreviewModel(state.project.layout));
	state.previewVersion += 1;
	state.lastMutationMessage = null;
	state.statusMessage = null;
	state.importError = null;
	return true;
}

export function toggleLayoutCeilings(state: LayoutPreviewState): void {
	state.showCeilings = !state.showCeilings;
}

export function importLayoutPreviewJson(state: LayoutPreviewState, json: string): boolean {
	const parsed = decodeLayoutJsonCompatible(json);
	if (parsed.kind === 'unrecognized') {
		setLayoutPreviewImportError(state, parsed.issues[0]?.message ?? 'Invalid layout document');
		return false;
	}
	try {
		// P23.12 — a document replacement re-seeds the allocation mark from the
		// payload's cursor, and a stale/short payload cursor is repaired upward
		// before anything is minted.
		const incoming =
			parsed.kind === 'wall-first'
				? (repairLayoutIdentityCursor(parsed.document) as unknown as EditorLayoutDocument)
				: (parsed.document as unknown as EditorLayoutDocument);
		// P23.12 — a replacement derives from its own repaired cursor, never the
		// previous document's mark (two imports of the same ledger-less payload
		// must resolve identically), and the mark is then re-seeded from the
		// installed document.
		const bundle = deriveInstallBundle(state, incoming, state.project.name, undefined, true);
		state.source = 'imported';
		p2311Measure('preview-install', () => commitPreviewBundle(state, bundle));
		state.previewVersion += 1;
		state.reframeVersion += 1;
		// The baseline is the **installed, normalized** document, never the raw
		// payload: otherwise identity resolution would make the session read dirty
		// immediately after a successful import.
		state.baselineLayoutJson = authoredLayoutJson(bundle.project.layout);
		state.identityHighWater = replacementIdentityBase(bundle.project.layout as unknown as EditorLayoutDocument);
		state.baselineKind = 'imported';
		state.lastMutationMessage = null;
		state.statusMessage = 'Imported layout JSON';
		state.importError = null;
		return true;
	} catch (error) {
		setLayoutPreviewImportError(state, error instanceof Error ? error.message : 'Could not import layout');
		return false;
	}
}	export function updateLayoutRoomFields(
		state: LayoutPreviewState,
		roomId: string,
		patch: LayoutRoomFieldPatch
	): LayoutRoomEditResult {
		const layout = cloneLayout(state.project.layout);
		const floor = layout.floors.find((candidate) => candidate.rooms.some((room) => room.id === roomId));
		const room = floor?.rooms.find((candidate) => candidate.id === roomId);
		if (!floor || !room) return failRoomEdit(state, 'Room no longer exists');
		if (patch.name !== undefined && patch.name.trim().length === 0) {
			return failRoomEdit(state, 'Room name cannot be empty');
		}
		const nextRoom: LayoutRoom = {
			...room,
			...(patch.name === undefined ? {} : { name: patch.name.trim() }),
			...(patch.wallThickness === undefined ? {} : { wallThickness: patch.wallThickness }),
			...(patch.floorThickness === undefined ? {} : { floorThickness: patch.floorThickness }),
			...(patch.ceilingThickness === undefined ? {} : { ceilingThickness: patch.ceilingThickness })
		};
		floor.rooms = floor.rooms.map((candidate) => (candidate.id === roomId ? nextRoom : candidate));
		if (patch.floorHeight !== undefined) floor.height = patch.floorHeight;
		const applied = applyLayoutMutation(state, layout as Project['layout']);
		return applied.success ? { success: true } : applied;
	}

/** Per-kind counts of scene content referencing a layout room. */
export type LayoutRoomSceneReferences = {
	entities: number;
	clusters: number;
	navigationNodes: number;
	pathAnchors: number;
	waypoints: number;
	viewKeyframes: number;
};

/**
 * Count every `project.scene` reference to a layout room. Mirrors the
 * `unknown_room` cross-validation surface of `validateProjectSceneRooms` so
 * the reject-when-referenced policy and the project codec agree on what
 * counts as a reference.
 */
export function listLayoutRoomSceneReferences(
	scene: SceneDocument,
	roomId: string
): LayoutRoomSceneReferences {
	let entities = 0;
	let clusters = 0;
	let navigationNodes = 0;
	let pathAnchors = 0;
	let waypoints = 0;
	let viewKeyframes = 0;
	for (const entity of scene.entities) {
		if (entity.roomId === roomId) entities += 1;
	}
	for (const cluster of scene.clusters ?? []) {
		if (cluster.roomId === roomId) clusters += 1;
	}
	for (const node of scene.navigationNodes) {
		if (node.roomId === roomId) navigationNodes += 1;
	}
	for (const connection of scene.connections) {
		for (const anchor of connection.positionPath.anchors) {
			if (anchor.roomId === roomId) pathAnchors += 1;
		}
		for (const waypoint of connection.targetWaypoints ?? []) {
			if (waypoint.roomId === roomId) waypoints += 1;
		}
		for (const direction of ['forward', 'reverse'] as const) {
			for (const keyframe of connection.viewTracks?.[direction] ?? []) {
				if (keyframe.roomId === roomId) viewKeyframes += 1;
			}
		}
	}
	return { entities, clusters, navigationNodes, pathAnchors, waypoints, viewKeyframes };
}

export function layoutRoomSceneReferenceTotal(refs: LayoutRoomSceneReferences): number {
	return (
		refs.entities +
		refs.clusters +
		refs.navigationNodes +
		refs.pathAnchors +
		refs.waypoints +
		refs.viewKeyframes
	);
}

/** "3 entities · 1 camera node" — the blocker summary shown to the user. */
export function layoutRoomSceneReferenceSummary(refs: LayoutRoomSceneReferences): string {
	const parts: string[] = [];
	if (refs.entities > 0) parts.push(`${refs.entities} entit${refs.entities === 1 ? 'y' : 'ies'}`);
	if (refs.clusters > 0) parts.push(`${refs.clusters} cluster${refs.clusters === 1 ? '' : 's'}`);
	if (refs.navigationNodes > 0) parts.push(`${refs.navigationNodes} camera node${refs.navigationNodes === 1 ? '' : 's'}`);
	if (refs.pathAnchors > 0) parts.push(`${refs.pathAnchors} path anchor${refs.pathAnchors === 1 ? '' : 's'}`);
	if (refs.waypoints > 0) parts.push(`${refs.waypoints} waypoint${refs.waypoints === 1 ? '' : 's'}`);
	if (refs.viewKeyframes > 0) parts.push(`${refs.viewKeyframes} view keyframe${refs.viewKeyframes === 1 ? '' : 's'}`);
	return parts.join(' · ');
}

/**
 * delete a layout room (reject-when-referenced policy).
 *
 * The caller passes the authoritative scene document (the editor store's
 * document, which owns scene authoring in the editor shell) — NOT
 * `state.project.scene`, a boot-time copy that never syncs with scene edits.
 * The delete is blocked while any scene content references the room; a
 * successful delete cascades layout-internal content only (room + owned
 * objects + portal refs) and rides the standard `applyLayoutMutation` gate
 * (strict codec + geometry + wall-mesh preflight).
 */
export function deleteLayoutRoom(
	state: LayoutPreviewState,
	roomId: string,
	scene: SceneDocument
): LayoutRoomEditResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failRoomEdit(state, wallFirstLegacyEditMessage());
	}
	const refs = listLayoutRoomSceneReferences(scene, roomId);
	if (layoutRoomSceneReferenceTotal(refs) > 0) {
		return failRoomEdit(
			state,
			`Room is referenced by scene content (${layoutRoomSceneReferenceSummary(refs)}); move or delete it first`
		);
	}
	const layout = deleteRoomFromDocument(cloneLayout(state.project.layout), roomId);
	if (!layout) return failRoomEdit(state, 'Room no longer exists');
	const applied = applyLayoutMutation(state, layout);
	return applied.success ? { success: true } : applied;
}

export function commitLayoutPrimitive(
	state: LayoutPreviewState,
	kind: Exclude<AuthoredLayoutObjectKind, 'plane'>,
	start: LayoutVec2,
	current: LayoutVec2,
	roomId: string | undefined,
	snapEnabled = false
): LayoutObjectMutationResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failObjectMutation(state, wallFirstLegacyEditMessage());
	}
	const floor = state.project.layout.floors[0];
	if (!floor || !roomId) return failObjectMutation(state, 'Choose a first-floor room');
	const geometry = primitiveObjectGeometry(kind, start, current, floor.elevation, snapEnabled);
	if (!geometry) return failObjectMutation(state, 'Primitive gesture must have a non-zero size');
	const room = floor.rooms.find((candidate) => candidate.id === roomId);
	const center: LayoutVec2 = [geometry.position[0], geometry.position[2]];
	if (!room || !pointInRoom(center, room)) {
		return failObjectMutation(state, 'Choose a first-floor room');
	}
	const layout = cloneLayout(state.project.layout);
	const object = createLayoutObject({
		id: nextLayoutObjectId(layout.objects),
		kind,
		position: geometry.position,
		dimensions: geometry.dimensions,
		roomId
	});
	layout.objects = [...layout.objects, object];
	const applied = applyLayoutMutation(state, layout);
	return applied.success ? { success: true, objectId: object.id } : applied;
}

export function commitLayoutObject(
	state: LayoutPreviewState,
	kind: AuthoredLayoutObjectKind,
	position: Vec3,
	roomId?: string
): LayoutObjectMutationResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failObjectMutation(state, wallFirstLegacyEditMessage());
	}
	if (!position.every(Number.isFinite)) return failObjectMutation(state, 'Object position must be finite');
	if (!isKnownLayoutRoomId(state.project.layout, roomId)) {
		return failObjectMutation(state, `Unknown roomId '${roomId}'`);
	}
	const layout = cloneLayout(state.project.layout);
	const object = createLayoutObject({
		id: nextLayoutObjectId(layout.objects),
		kind,
		position,
		dimensions: defaultLayoutObjectDimensions(kind),
		...(roomId ? { roomId } : {})
	});
	layout.objects = [...layout.objects, object];
	const applied = applyLayoutMutation(state, layout);
	return applied.success ? { success: true, objectId: object.id } : applied;
}

/**
 * P23.5 — commit one architectural preset as ONE ordinary document-level
 * LayoutObject through the canonical wall-first planner. The preset is a
 * creation default only: no preset kind, no preset metadata, no Room
 * containment requirement; the stored transform is project/world-local and
 * the object edits through the exact same P23.1 object controls afterwards.
 * Rejection installs nothing (no history).
 */
export function commitLayoutObjectPreset(
	state: LayoutPreviewState,
	presetId: LayoutArchitecturalPresetId,
	point: LayoutVec2
): LayoutObjectMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	const floorElevation = layout.floor.elevation;
	const plan = planCommitLayoutObjectPreset(layout, presetId, point, floorElevation);
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	// Fail closed: a success without the birthed object ID must never select
	// an empty target — the planner always supplies it today, so a missing ID
	// is a wiring bug, not a committable result.
	const objectId = plan.createdObjectId;
	if (!objectId) {
		state.lastMutationMessage = 'Preset create returned no object ID';
		return { success: false, message: 'Preset create returned no object ID' };
	}
	try {
		const bundle = deriveInstallBundle(state, plan.document);
		state.source = 'draft';
		p2311Measure('preview-install', () => commitPreviewBundle(state, bundle));
		state.previewVersion += 1;
		state.lastMutationMessage = null;
		state.statusMessage = null;
		state.importError = null;
		return { success: true, objectId };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not commit preset object';
		state.lastMutationMessage = message;
		return { success: false, message };
	}
}

export function updateLayoutObjectFields(
	state: LayoutPreviewState,
	objectId: string,
	patch: LayoutObjectPatch
): LayoutObjectMutationResult {
	const current = state.project.layout.objects.find((object) => object.id === objectId);
	if (!current) return failObjectMutation(state, 'Object no longer exists');
	if (current.kind === 'profile') return failObjectMutation(state, 'Profile objects are read-only');
	const currentLayout = layoutPreviewDocument(state);
	if (isWallFirstLayoutDocument(currentLayout)) {
		const result = planExactLayoutObjectTransform(currentLayout, objectId, patch);
		const applied = applyWallFirstPrecisionPlan(state, result);
		return applied.success ? { success: true, objectId } : applied;
	}
	if ('roomId' in patch && !isKnownLayoutRoomId(state.project.layout, patch.roomId)) {
		return failObjectMutation(state, `Unknown roomId '${patch.roomId}'`);
	}
	const layout = patchLayoutObject(cloneLayout(state.project.layout), objectId, patch);
	if (!layout) return failObjectMutation(state, 'Object no longer exists');
	const applied = applyLayoutMutation(state, layout);
	return applied.success ? { success: true, objectId } : applied;
}

/**
 * Apply one already-planned wall-first document through the preview bundle
 * atomically (single install point for P23.1 precision and P23.3 opening
 * plans — one document path, one preview/geometry rebuild).
 */
function applyWallFirstDocumentPlan(
	state: LayoutPreviewState,
	document: LayoutDocumentWallFirst,
	operation: PrecisionOperation | WallOpeningOperation,
	openingId?: string,
	acceptance?: WallFirstAcceptanceCompile
): WallFirstPrecisionMutationResult;
function applyWallFirstDocumentPlan(
	state: LayoutPreviewState,
	document: LayoutDocumentWallFirst,
	operation: 'room-move',
	openingId?: string,
	acceptance?: WallFirstAcceptanceCompile
): WallFirstRoomMoveMutationResult;
function applyWallFirstDocumentPlan(
	state: LayoutPreviewState,
	document: LayoutDocumentWallFirst,
	operation: PrecisionOperation | WallOpeningOperation | 'room-move',
	openingId?: string,
	acceptance?: WallFirstAcceptanceCompile
): WallFirstPrecisionMutationResult | WallFirstRoomMoveMutationResult {
	try {
		// `acceptance` is the compile this cycle already ran to accept the same
		// document; the install consumes it instead of compiling it again.
		const bundle = deriveInstallBundle(state, document, state.project.name, acceptance);
		state.source = 'draft';
		p2311Measure('preview-install', () => commitPreviewBundle(state, bundle));
		state.previewVersion += 1;
		state.lastMutationMessage = null;
		state.statusMessage = null;
		state.importError = null;
		if (operation === 'room-move') return { success: true, operation: 'room-move' };
		return openingId === undefined
			? { success: true, operation: operation as PrecisionOperation }
			: { success: true, operation: operation as WallOpeningOperation, openingId };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not apply layout operation';
		state.lastMutationMessage = message;
		return { success: false, message };
	}
}

/** Apply a P23.1 wall-first plan through the preview bundle atomically. */
function applyWallFirstPrecisionPlan(
	state: LayoutPreviewState,
	plan: PrecisionPlan
): WallFirstPrecisionMutationResult {
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message, code: plan.rejection.code };
	}
	return applyWallFirstDocumentPlan(state, plan.document, plan.operation, undefined, plan.acceptance);
}

/** Apply a P23.3 canonical Opening plan (create/update/move/center/delete). */
function applyWallFirstOpeningPlan(
	state: LayoutPreviewState,
	plan: WallOpeningPlan
): LayoutOpeningMutationResult {
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	const openingId = plan.changedOpeningIds[0] ?? '';
	const applied = applyWallFirstDocumentPlan(state, plan.document, plan.operation, openingId);
	return applied.success
		? { success: true, openingId }
		: { success: false, message: applied.message };
}

/**
 * P23.9 — commit a sketched wall/partition chain as one Layout history entry.
 * The planner (P23.8 engine) resolves junction reuse, T/X noding and Room
 * reconciliation; a rejected chain leaves the document and history untouched.
 * Kept for the bounded compound convenience tools (Rectangle/Polygon).
 */
export function commitWallChain(
	state: LayoutPreviewState,
	points: readonly LayoutVec2[],
	role: ChainWallRole,
	options: { close: boolean }
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	const plan = planWallChain({ baseline: layout, points, role, close: options.close });
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	try {
		const bundle = deriveInstallBundle(state, plan.document);
		state.source = 'draft';
		commitPreviewBundle(state, bundle);
		state.previewVersion += 1;
		state.lastMutationMessage = null;
		state.statusMessage = null;
		state.importError = null;
		return { success: true, operation: 'wall-chain-commit', wallIds: plan.createdWallIds, roomIds: plan.lineage.map((record) => record.roomId) };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not commit wall chain';
		state.lastMutationMessage = message;
		return { success: false, message };
	}
}

/**
 * P23.9 segment-first — commit one straight Wall segment as one Layout
 * history entry. Returns the canonical resolved Junctions for continuation
 * (never derived from `createdWallIds`). Rejection mutates nothing.
 *
 * P23.6I — `height` is the **continuation** height for a run already in
 * progress: the editor's transient per-run value, passed explicitly so a turn
 * that lands on a Junction with other incident heights keeps the run's height
 * instead of re-resolving one. Omit it for the first segment of a run, where the
 * canonical `planWallSegment` birth rule (`resolveWallBirthHeight`) derives the
 * height from document topology — the editor never owns that decision.
 */
export function commitWallSegment(
	state: LayoutPreviewState,
	start: LayoutVec2,
	end: LayoutVec2,
	role: ChainWallRole,
	height?: number,
	endpointHostWallId?: string
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	const plan = planWallSegment({
		baseline: layout,
		start,
		end,
		role,
		...(height !== undefined ? { height } : {}),
		...(endpointHostWallId !== undefined ? { endpointHostWallId } : {})
	});
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	try {
		const bundle = deriveInstallBundle(state, plan.document);
		state.source = 'draft';
		commitPreviewBundle(state, bundle);
		state.previewVersion += 1;
		state.lastMutationMessage = null;
		state.statusMessage = null;
		state.importError = null;
		// The planner is the height authority: read the committed authored Wall's own
		// value back out of the committed document rather than re-deriving it.
		const authoredWallId = plan.authoredWallIds[0];
		const wallHeight =
			authoredWallId === undefined
				? undefined
				: plan.document.walls.find((wall) => wall.id === authoredWallId)?.height;
		return {
			success: true,
			operation: 'wall-segment-commit',
			wallIds: [...plan.authoredWallIds],
			allWallIds: [...plan.createdWallIds],
			roomIds: plan.lineage.map((record) => record.roomId),
			startJunctionId: plan.startJunctionId,
			endJunctionId: plan.endJunctionId,
			...(wallHeight !== undefined ? { wallHeight } : {})
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not commit wall segment';
		state.lastMutationMessage = message;
		return { success: false, message };
	}
}

export function updateWallFirstJunction(
	state: LayoutPreviewState,
	junctionId: string,
	point: LayoutVec2
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planExactJunctionMove(layout, junctionId, point));
}

/**
 * P23.10 — commit one rigid Wall translation as one Layout history
 * entry. Thin adapter over the shared core planner: the same planner the
 * numeric Junction/Wall commands use, so the direct gesture and the Inspector
 * can never reach acceptance by different routes. Rejection installs nothing.
 */
export function updateWallFirstWallMove(
	state: LayoutPreviewState,
	wallId: string,
	delta: LayoutVec2
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planRigidWallMove(layout, wallId, delta));
}

/**
 * P23.11 — commit one canonical Wall curve operation as one Layout history
 * entry. Thin adapters over the core planners, so the direct control gesture
 * and the Inspector can never reach acceptance by different routes. A rejection
 * installs nothing and leaves the document and history untouched; the Wall keeps
 * its identity, its Junctions and every hosted Opening throughout.
 */
export function updateWallFirstWallCurve(
	state: LayoutPreviewState,
	wallId: string
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planConvertWallToCurve(layout, wallId));
}

export function updateWallFirstWallLine(
	state: LayoutPreviewState,
	wallId: string
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planConvertWallToLine(layout, wallId));
}

/**
 * Insert one bend point at a physical arc distance. `point` is optional: a
 * caller that has one (a context action at a Wall position) supplies it, and the
 * adapter projects it to the canonical arc distance; a caller that has only a
 * distance (the Inspector's Add Bend Point) passes the distance directly.
 */
export function insertWallFirstWallCurveKnot(
	state: LayoutPreviewState,
	wallId: string,
	distance: number
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planInsertWallCurveKnot(layout, wallId, distance));
}

export function updateWallFirstWallCurveKnot(
	state: LayoutPreviewState,
	wallId: string,
	knotId: string,
	point: LayoutVec2
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planMoveWallCurveKnot(layout, wallId, knotId, point));
}

export function deleteWallFirstWallCurveKnot(
	state: LayoutPreviewState,
	wallId: string,
	knotId: string
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planDeleteWallCurveKnot(layout, wallId, knotId));
}

/**
 * P23.11 — one Bend command drag: insert the grabbed position as a bend point
 * and place it, as ONE candidate and ONE history entry. Thin adapter over the
 * composite core planner, so the Bend gesture and the visible action surfaces
 * can never reach acceptance by different routes.
 */
export function updateWallFirstWallBend(
	state: LayoutPreviewState,
	wallId: string,
	intent: WallBendIntent
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planBendWallCurveKnot(layout, wallId, intent));
}

export function updateWallFirstWallLength(
	state: LayoutPreviewState,
	wallId: string,
	length: number,
	fixed: FixedWallEndpoint
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planExactWallLength(layout, wallId, length, fixed));
}

export function updateWallFirstWallAngle(
	state: LayoutPreviewState,
	wallId: string,
	angle: number,
	fixed: FixedWallEndpoint
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planExactWallAngle(layout, wallId, angle, fixed));
}

export function updateWallFirstWallThickness(
	state: LayoutPreviewState,
	wallId: string,
	thickness: number
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planExactWallThickness(layout, wallId, thickness));
}

/**
 * P23.6H — commit one canonical Wall height edit as one Layout history entry.
 * The planner owns the Floor envelope and host-Wall Opening fit; a rejection
 * leaves the document, the Opening and history untouched. UI code never assigns
 * `wall.height` directly.
 */
export function updateWallFirstWallHeight(
	state: LayoutPreviewState,
	wallId: string,
	height: number
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planExactWallHeight(layout, wallId, height));
}

/**
 * P23.6 — commit one canonical Wall role change as one Layout history entry.
 * The planner runs face extraction + P23.8 correspondence reconciliation +
 * the final gates; a rejection leaves the document and history untouched.
 */
export function commitWallRoleChange(
	state: LayoutPreviewState,
	wallId: string,
	role: WallRoleChangeRole
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	const plan = planWallRoleChange(layout, wallId, role);
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	return applyWallFirstDocumentPlan(state, plan.document, 'wall-role');
}

export function subdivideWallFirstWall(
	state: LayoutPreviewState,
	wallId: string,
	splitDistance: number
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planWallSubdivision(layout, wallId, splitDistance, createLayoutNodingAllocator()));
}

export function updateWallFirstRectangle(
	state: LayoutPreviewState,
	roomId: string,
	width: number,
	depth: number,
	options: { anchorJunctionId?: string; widthWallId?: string } = {}
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planExactRectangleDimensions(layout, roomId, width, depth, options));
}

export function updateWallFirstObjectTransform(
	state: LayoutPreviewState,
	objectId: string,
	patch: LayoutObjectTransformPatch
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	return applyWallFirstPrecisionPlan(state, planExactLayoutObjectTransform(layout, objectId, patch));
}

function wallFirstLayoutOrError(state: LayoutPreviewState): LayoutDocumentWallFirst | null {
	const layout = layoutPreviewDocument(state);
	if (isWallFirstLayoutDocument(layout)) return layout;
	state.lastMutationMessage = 'This precise operation requires a wall-first layout';
	return null;
}

function createLayoutNodingAllocator(): NodingIdAllocator {
	return {
		nextWallId(document, seed) {
			const taken = new Set(document.walls.map((wall) => wall.id));
			return nextAvailableId(taken, `${seed}:wall`);
		},
		nextJunctionId(document, seed) {
			const taken = new Set(document.junctions.map((junction) => junction.id));
			return nextAvailableId(taken, `${seed}:junction`);
		}
	};
}

function nextAvailableId(taken: ReadonlySet<string>, seed: string): string {
	if (!taken.has(seed)) return seed;
	let index = 2;
	while (taken.has(`${seed}.${index}`)) index += 1;
	return `${seed}.${index}`;
}

export function deleteLayoutObject(
	state: LayoutPreviewState,
	objectId: string
): LayoutObjectMutationResult {
	const current = state.project.layout.objects.find((object) => object.id === objectId);
	if (!current) return failObjectMutation(state, 'Object no longer exists');
	if (current.kind === 'profile') return failObjectMutation(state, 'Profile objects are read-only');
	const currentLayout = layoutPreviewDocument(state);
	if (isWallFirstLayoutDocument(currentLayout)) {
		const applied = applyWallFirstPrecisionPlan(state, planDeleteLayoutObject(currentLayout, objectId));
		return applied.success ? { success: true, objectId } : applied;
	}
	const layout = deleteObjectFromDocument(cloneLayout(state.project.layout), objectId);
	if (!layout) return failObjectMutation(state, 'Object no longer exists');
	const applied = applyLayoutMutation(state, layout);
	return applied.success ? { success: true, objectId } : applied;
}

/**
 * P23.3 canonical Opening create on a wall-first document. One authored
 * Opening record hosted by `wallId`, document-global ID, whole-hosting-Wall
 * validation inside the planner. Rejection installs nothing.
 */
export function createWallFirstOpening(
	state: LayoutPreviewState,
	intent: WallFirstOpeningCreateIntent
): LayoutOpeningMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	const plan = planCreateWallFirstOpening(layout, {
		wallId: intent.wallId,
		kind: intent.kind,
		offset: intent.offset,
		width: intent.width,
		height: intent.height,
		sillHeight: intent.sillHeight
	});
	return applyWallFirstOpeningPlan(state, plan);
}

/** P23.3 canonical Opening exact-field update (host Wall never changes). */
export function updateWallFirstOpening(
	state: LayoutPreviewState,
	openingId: string,
	patch: WallOpeningPatch
): LayoutOpeningMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	return applyWallFirstOpeningPlan(
		state,
		planUpdateWallFirstOpening(layout, openingId, patch)
	);
}

/**
 * P23.3 canonical Opening drag/move commit: one raw candidate offset,
 * validated against the whole hosting-Wall set. Out-of-fit rejects — the
 * clamped snap result must never reach this call.
 */
export function moveWallFirstOpening(
	state: LayoutPreviewState,
	openingId: string,
	offset: number
): LayoutOpeningMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	return applyWallFirstOpeningPlan(
		state,
		planMoveWallFirstOpening(layout, openingId, offset)
	);
}

/** P23.3 Center on Wall (exact meter offset). */
export function centerWallFirstOpening(
	state: LayoutPreviewState,
	openingId: string
): LayoutOpeningMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	return applyWallFirstOpeningPlan(
		state,
		planCenterWallFirstOpening(layout, openingId)
	);
}

/** P23.3 canonical Opening delete (the single physical record). */
export function deleteWallFirstOpening(
	state: LayoutPreviewState,
	openingId: string
): LayoutOpeningMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	return applyWallFirstOpeningPlan(
		state,
		planDeleteWallFirstOpening(layout, openingId)
	);
}

/**
 * P23.6c — canonical Wall delete (one history entry at the caller). The
 * planner runs the full topology path: hosted Openings go away atomically,
 * unreferenced endpoint Junctions are pruned reference-only, affected Rooms
 * reconcile through the P23.8 machinery, portal relations remap/clear per the
 * existing contract, and the final canonical gates run before anything
 * installs. A rejection leaves the document and history untouched. Post-delete
 * selection is the callers' fixed policy (canonical selection becomes
 * `none`) — this adapter owns document state only.
 */
export function deleteWallFirstWall(
	state: LayoutPreviewState,
	wallId: string
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	const plan = planDeleteWall(layout, wallId);
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	return applyWallFirstDocumentPlan(state, plan.document, 'wall-delete');
}

/**
 * P23 Junction dissolve — delete a degree-2 Junction by joining its two
 * incident Walls into one canonical Wall (the exact inverse of Wall
 * subdivision; one history entry at the caller). The planner merges the pair
 * into the deterministic survivor, rebases hosted Openings, reconciles Rooms
 * through the P23.8 machinery with a no-birth/no-retire assert, and runs the
 * shared canonical gates before anything installs. A rejection leaves the
 * document and history untouched. Post-dissolve selection is the callers'
 * fixed policy (canonical selection becomes `none`) — this adapter owns
 * document state only.
 */
export function dissolveWallFirstJunction(
	state: LayoutPreviewState,
	junctionId: string
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	const plan = planDissolveJunction(layout, junctionId);
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	return applyWallFirstDocumentPlan(state, plan.document, 'junction-dissolve');
}

/**
 * P23.14 §13 — the planner's own refusal reason for dissolving a Junction, or
 * `null` when the operation would be accepted.
 *
 * Read-only: the eligibility authority stays `planDissolveJunction` in the core
 * planner, so the three shell entry points (Inspector action, Navigator row,
 * Plan context menu) can state *why* a dissolve is unavailable without a second
 * eligibility implementation and without mutating the document to find out.
 * Unlike `wallFirstLayoutOrError` this never writes `lastMutationMessage` — a
 * query must not install a status message. `pre-install` targets (no applied
 * document) return the caller-facing reason instead.
 */
export function wallFirstJunctionDissolveRefusal(
	state: LayoutPreviewState,
	junctionId: string
): string | null {
	const layout = layoutPreviewDocument(state);
	if (!isWallFirstLayoutDocument(layout)) return 'This operation requires a wall-first layout';
	const plan = planDissolveJunction(layout, junctionId);
	return plan.kind === 'rejected' ? plan.rejection.message : null;
}

/**
 * P23.6d — canonical wall-first Room metadata update (name, floor/ceiling
 * thickness) through the one planner. Metadata is not topology, so no face
 * extraction runs; the candidate still passes the canonical validation +
 * compile gate. One plan = one history entry at the caller. Rejections write
 * nothing. Selection is preserved by the caller (the Room survives the edit).
 */
export function updateWallFirstRoomMetadata(
	state: LayoutPreviewState,
	roomId: string,
	patch: RoomMetadataPatch
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	const plan = planRoomMetadataUpdate(layout, roomId, patch);
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	return applyWallFirstDocumentPlan(state, plan.document, 'room-metadata');
}

/**
 * P23.12 — canonical wall-first Wall metadata update (optional name) through
 * the one planner. A sibling of `updateWallFirstRoomMetadata`: the Wall
 * survives the edit, so its reference and topology are untouched, and one
 * accepted plan is one history entry at the caller. The Inspector maps an
 * emptied text field to `null` (never `''`), so a clear removes the property.
 */
export function updateWallFirstWallMetadata(
	state: LayoutPreviewState,
	wallId: string,
	patch: OptionalNamePatch
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	const plan = planWallMetadataUpdate(layout, wallId, patch);
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	return applyWallFirstDocumentPlan(state, plan.document, 'wall-metadata');
}

/**
 * P23.12 — canonical wall-first Opening metadata update (optional name)
 * through the one planner. Same contract as `updateWallFirstWallMetadata`.
 */
export function updateWallFirstOpeningMetadata(
	state: LayoutPreviewState,
	openingId: string,
	patch: OptionalNamePatch
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	const plan = planOpeningMetadataUpdate(layout, openingId, patch);
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	return applyWallFirstDocumentPlan(state, plan.document, 'opening-metadata');
}

/**
 * P23.6d — canonical Room removal: `planRemoveRoom` removes the Room and its
 * exclusive enclosure Walls while preserving shared physical Walls required by
 * adjacent Rooms (the shared Wall-removal pipeline), so the Room retires
 * through normal P23.8 reconciliation and demolition stays one authority. One
 * plan = one history entry; a rejection writes nothing. Post-removal selection
 * is the callers' fixed policy (canonical selection becomes `none` — the Room
 * is gone).
 *
 * P23.6d review blocker — Scene-reference safety without breaking the
 * LayoutDocument/SceneDocument ownership separation: topology reconciliation
 * can retire more than the directly selected Room (a collateral retirement),
 * so the legacy reject-when-referenced policy cannot just check `roomId`.
 * The canonical Layout plan is produced FIRST and installed only after the
 * plan's `retiredRoomIds` are checked against the authoritative scene
 * document the caller passes (same ownership pattern as the legacy
 * `deleteLayoutRoom`): every retiring Room — selected or collateral — must be
 * Scene-reference-free. A blocked removal is atomic: the already-planned
 * candidate is never installed, zero history is written, the document and
 * selection are untouched, and the message names the blocking Room and its
 * references. The planner itself never sees the Scene; no Scene references
 * are cleared and no second reference policy is created.
 */
export function removeWallFirstRoom(
	state: LayoutPreviewState,
	roomId: string,
	authoritativeScene: SceneDocument
): WallFirstPrecisionMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	const plan = planRemoveRoom(layout, roomId);
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	for (const retiringRoomId of plan.retiredRoomIds) {
		const refs = listLayoutRoomSceneReferences(authoritativeScene, retiringRoomId);
		if (layoutRoomSceneReferenceTotal(refs) > 0) {
			const message =
				`Room '${retiringRoomId}' is referenced by scene content (${layoutRoomSceneReferenceSummary(refs)}); move or delete it first`;
			state.lastMutationMessage = message;
			return { success: false, message };
		}
	}
	return applyWallFirstDocumentPlan(state, plan.document, 'room-remove');
}

/**
 * P23.6d — the selected Room's exclusive boundary Walls (the walls a Room
 * removal may open). Read-only surface query for the Inspector wall list and
 * the hierarchy menu; `[]` when the document is not wall-first.
 */
export function wallFirstRoomExclusiveBoundaryWallIds(
	state: LayoutPreviewState,
	roomId: string
): string[] {
	const layout = layoutPreviewDocument(state);
	if (!isWallFirstLayoutDocument(layout)) return [];
	return roomExclusiveBoundaryWallIds(layout, roomId);
}

/**
 * P23.6d — would removing this wall-first Room retire any Room the scene
 * references? Read-only preview of the canonical plan's `retiredRoomIds`
 * (selected Room plus collateral retirement) against the authoritative scene
 * document the caller passes — the SAME `listLayoutRoomSceneReferences`
 * policy the executor enforces, so surfaces can disable/explain the Remove
 * action without running the mutation. `[]` when the document is not
 * wall-first or the plan would reject.
 */
export function wallFirstRoomSceneBlockedRoomIds(
	state: LayoutPreviewState,
	roomId: string,
	authoritativeScene: SceneDocument
): string[] {
	const layout = layoutPreviewDocument(state);
	if (!isWallFirstLayoutDocument(layout)) return [];
	const plan = planRemoveRoom(layout, roomId);
	if (plan.kind === 'rejected') return [];
	return plan.retiredRoomIds.filter(
		(retiringRoomId) =>
			layoutRoomSceneReferenceTotal(listLayoutRoomSceneReferences(authoritativeScene, retiringRoomId)) > 0
	);
}

/**
 * Apply one P23.4 duplicate/repeat plan through the preview bundle atomically.
 * A rejection installs nothing (invalid/no-op → no history).
 */
function applyWallFirstDuplicatePlan(
	state: LayoutPreviewState,
	plan: DuplicatePlan
): WallFirstDuplicateMutationResult {
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return { success: false, message: plan.rejection.message };
	}
	try {
		const bundle = deriveInstallBundle(state, plan.document);
		state.source = 'draft';
		commitPreviewBundle(state, bundle);
		state.previewVersion += 1;
		state.lastMutationMessage = null;
		state.statusMessage = null;
		state.importError = null;
		return {
			success: true,
			operation: plan.operation,
			createdObjectIds: plan.createdObjectIds,
			createdOpeningIds: plan.createdOpeningIds,
			...(plan.createdRoomId !== undefined ? { createdRoomId: plan.createdRoomId } : {}),
			...(plan.createdWallIds.length > 0 ? { createdWallIds: plan.createdWallIds } : {})
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not apply duplicate operation';
		state.lastMutationMessage = message;
		return { success: false, message };
	}
}

/**
 * P23.4 — repeat one supported document-level Layout object (`count` copies
 * at exact `index × delta` positions from the original source).
 */
export function repeatWallFirstObject(
	state: LayoutPreviewState,
	intent: LayoutObjectRepeatIntent
): WallFirstDuplicateMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	return applyWallFirstDuplicatePlan(state, planRepeatLayoutObject(layout, intent));
}

/**
 * P23.4 — repeat one Wall-hosted Opening along its canonical Wall (`count`
 * copies at `source.offset + i × spacing`); the whole final opening set on
 * the Wall validates as one batch.
 */
export function repeatWallFirstOpening(
	state: LayoutPreviewState,
	intent: WallOpeningRepeatIntent
): WallFirstDuplicateMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	return applyWallFirstDuplicatePlan(state, planRepeatWallOpening(layout, intent));
}

/**
 * P23.4 — duplicate one isolated Room (bounded Junction/Wall/Opening subgraph
 * + associated Layout objects, translated by one exact X/Z delta).
 */
export function duplicateWallFirstRoom(
	state: LayoutPreviewState,
	intent: RoomDuplicateIntent
): WallFirstDuplicateMutationResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		return { success: false, message: state.lastMutationMessage ?? 'Wall-first layout is not active' };
	}
	return applyWallFirstDuplicatePlan(state, planDuplicateIsolatedRoom(layout, intent));
}

/**
 * P23.6a — eligibility for the whole-Room move gesture on a wall-first Room.
 * A thin, read-only wrapper over the shared isolation policy so the viewport
 * can hint *why* a Room is not movable without duplicating that policy in the
 * component. Legacy or unknown Rooms are not movable through this path.
 */
export function wallFirstRoomMoveEligibility(
	state: LayoutPreviewState,
	roomId: string
): WallFirstRoomMoveEligibility {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) {
		const rejection: RoomIsolationRejection = {
			code: 'unknown_room',
			message: state.lastMutationMessage ?? 'Wall-first layout is not active',
			targetIds: [roomId]
		};
		return { movable: false, rejection, hint: roomMoveStatusHint(rejection) };
	}
	const resolved = resolveIsolatedRoomGroupSubgraph(layout, roomId);
	return resolved.kind === 'success'
		? { movable: true, subgraph: resolved.subgraph }
		: { movable: false, rejection: resolved.rejection, hint: roomMoveStatusHint(resolved.rejection) };
}

/**
 * P23.6a — preview (and thereby commit) one rigid X/Z Room-unit move on a
 * wall-first document. Legacy documents stay on `previewLayoutRoomUnit`; the
 * wall-first planner's candidate is installed through the one existing
 * document-install point, so a preview is one bundle and one compile. A
 * rejection writes nothing (no document, no history) and reports its reason.
 */
export function previewWallFirstRoomMove(
	state: LayoutPreviewState,
	roomId: string,
	delta: LayoutVec2
): LayoutRoomMoveResult {
	const layout = wallFirstLayoutOrError(state);
	if (!layout) return failRoomMove(state, state.lastMutationMessage ?? 'Wall-first layout is not active');
	const plan = planWallFirstRoomMove(layout, roomId, delta);
	if (plan.kind === 'rejected') {
		state.lastMutationMessage = plan.rejection.message;
		return {
			success: false,
			message: plan.rejection.message,
			code: plan.rejection.code
		};
	}
	const applied = applyWallFirstDocumentPlan(state, plan.document, plan.operation);
	return applied.success
		? { success: true, movedRoomIds: plan.movedRoomIds }
		: failRoomMove(state, applied.message);
}

function failRoomMove(state: LayoutPreviewState, message: string): LayoutRoomMoveResult {
	state.lastMutationMessage = message;
	return { success: false, message };
}

/**
 * P23.3 numeric read model for the Inspector: canonical Wall length, opening
 * offset/width, both end clearances and the Center-on-Wall offset.
 */
export function wallFirstOpeningMetricsFor(
	state: LayoutPreviewState,
	openingId: string
): WallFirstOpeningMetrics | undefined {
	const layout = layoutPreviewDocument(state);
	if (!isWallFirstLayoutDocument(layout)) return undefined;
	return wallFirstOpeningMetrics(layout, openingId);
}

export function commitLayoutOpening(
	state: LayoutPreviewState,
	roomId: string,
	segmentId: string,
	kind: LayoutOpeningKind,
	clickOffset: number,
	snapEnabled = true
): LayoutOpeningMutationResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failOpeningMutation(state, wallFirstLegacyEditMessage());
	}
	const layout = cloneLayout(state.project.layout);
	const floor = layout.floors.find((candidate) => candidate.rooms.some((room) => room.id === roomId));
	const room = floor?.rooms.find((candidate) => candidate.id === roomId);
	const segment = room?.boundary.segments.find((candidate) => candidate.id === segmentId);
	if (!floor || !room || !segment) {
		return failOpeningMutation(state, 'Wall no longer exists');
	}
	const opening: LayoutOpening = createDefaultOpening({
		id: nextOpeningId(room, kind),
		segment,
		kind,
		clickOffset,
		snapEnabled
	});
	const nextRoom = appendRoomOpening(room, opening);
	const issues = validateLineRoom(nextRoom, floor);
	if (hasBlockingLayoutIssues(issues)) return failOpeningMutation(state, issues[0]!.message);
	floor.rooms = floor.rooms.map((candidate) => (candidate.id === roomId ? nextRoom : candidate));
	return applyLayoutMutation(state, layout, opening.id);
}

export function updateLayoutOpeningFields(
	state: LayoutPreviewState,
	roomId: string,
	openingId: string,
	patch: LayoutOpeningPatch
): LayoutOpeningMutationResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failOpeningMutation(state, wallFirstLegacyEditMessage());
	}
	const layout = cloneLayout(state.project.layout);
	const floor = layout.floors.find((candidate) => candidate.rooms.some((room) => room.id === roomId));
	const room = floor?.rooms.find((candidate) => candidate.id === roomId);
	const opening = room ? findRoomOpening(room, openingId) : undefined;
	if (!floor || !room || !opening) return failOpeningMutation(state, 'Opening no longer exists');
	const nextOpening = { ...opening, ...patch };
	const nextRoom = replaceRoomOpening(room, nextOpening);
	const issues = validateLineRoom(nextRoom, floor);
	if (hasBlockingLayoutIssues(issues)) return failOpeningMutation(state, issues[0]!.message);
	floor.rooms = floor.rooms.map((candidate) => (candidate.id === roomId ? nextRoom : candidate));
	return applyLayoutMutation(state, layout, openingId);
}

export function deleteLayoutOpening(
	state: LayoutPreviewState,
	roomId: string,
	openingId: string
): LayoutOpeningMutationResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failOpeningMutation(state, wallFirstLegacyEditMessage());
	}
	const layout = cloneLayout(state.project.layout);
	const floor = layout.floors.find((candidate) => candidate.rooms.some((room) => room.id === roomId));
	const room = floor?.rooms.find((candidate) => candidate.id === roomId);
	if (!floor || !room || !findRoomOpening(room, openingId)) return failOpeningMutation(state, 'Opening no longer exists');
	const nextRoom = removeRoomOpening(room, openingId);
	floor.rooms = floor.rooms.map((candidate) => (candidate.id === roomId ? nextRoom : candidate));
	return applyLayoutMutation(state, layout, openingId);
}

export function insertLayoutWallInteriorAnchor(
	state: LayoutPreviewState,
	roomId: string,
	segmentId: string,
	point: LayoutVec2
): LayoutInteriorAnchorMutationResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failInteriorAnchorMutation(state, wallFirstLegacyEditMessage());
	}
	const layout = cloneLayout(state.project.layout);
	const floor = layout.floors.find((candidate) => candidate.rooms.some((room) => room.id === roomId));
	const room = floor?.rooms.find((candidate) => candidate.id === roomId);
	const segment = room?.boundary.segments.find((candidate) => candidate.id === segmentId);
	if (!floor || !room || !segment) return failInteriorAnchorMutation(state, 'Wall no longer exists');
	const existingIds = new Set(
		segment.kind === 'auto-bezier' ? segment.interiorAnchors.map((anchor) => anchor.id) : []
	);
	const nextSegment = insertInteriorAnchorOnSegment(segment, point);
	const inserted = nextSegment.interiorAnchors.find((anchor) => !existingIds.has(anchor.id));
	if (!inserted) return failInteriorAnchorMutation(state, 'Could not insert wall anchor');
	const nextRoom: LayoutRoom = {
		...room,
		boundary: {
			...room.boundary,
			segments: room.boundary.segments.map((candidate) => (candidate.id === segmentId ? nextSegment : candidate))
		}
	};
	const issues = validateLineRoom(nextRoom, floor);
	if (hasBlockingLayoutIssues(issues)) return failInteriorAnchorMutation(state, issues[0]!.message);
	floor.rooms = floor.rooms.map((candidate) => (candidate.id === roomId ? nextRoom : candidate));
	const applied = applyLayoutMutation(state, layout);
	if (!applied.success) return failInteriorAnchorMutation(state, applied.message);
	return { success: true, anchorId: inserted.id };
}

export function updateLayoutWallInteriorAnchor(
	state: LayoutPreviewState,
	roomId: string,
	segmentId: string,
	anchorId: string,
	point: LayoutVec2
): LayoutRoomEditResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failRoomEdit(state, wallFirstLegacyEditMessage());
	}
	const layout = cloneLayout(state.project.layout);
	const floor = layout.floors.find((candidate) => candidate.rooms.some((room) => room.id === roomId));
	const room = floor?.rooms.find((candidate) => candidate.id === roomId);
	const segment = room?.boundary.segments.find((candidate) => candidate.id === segmentId);
	if (!floor || !room || !segment || segment.kind !== 'auto-bezier') {
		return failRoomEdit(state, 'Curved wall no longer exists');
	}
	if (!segment.interiorAnchors.some((anchor) => anchor.id === anchorId)) {
		return failRoomEdit(state, 'Interior anchor no longer exists');
	}
	const nextSegment = updateInteriorAnchorOnSegment(segment, anchorId, point);
	const nextRoom: LayoutRoom = {
		...room,
		boundary: {
			...room.boundary,
			segments: room.boundary.segments.map((candidate) => (candidate.id === segmentId ? nextSegment : candidate))
		}
	};
	const issues = validateLineRoom(nextRoom, floor);
	if (hasBlockingLayoutIssues(issues)) return failRoomEdit(state, issues[0]!.message);
	floor.rooms = floor.rooms.map((candidate) => (candidate.id === roomId ? nextRoom : candidate));
	const applied = applyLayoutMutation(state, layout);
	if (!applied.success) return failRoomEdit(state, applied.message);
	return { success: true };
}

export function deleteLayoutWallInteriorAnchor(
	state: LayoutPreviewState,
	roomId: string,
	segmentId: string,
	anchorId: string
): LayoutRoomEditResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failRoomEdit(state, wallFirstLegacyEditMessage());
	}
	const layout = cloneLayout(state.project.layout);
	const floor = layout.floors.find((candidate) => candidate.rooms.some((room) => room.id === roomId));
	const room = floor?.rooms.find((candidate) => candidate.id === roomId);
	const segment = room?.boundary.segments.find((candidate) => candidate.id === segmentId);
	if (!floor || !room || !segment || segment.kind !== 'auto-bezier') {
		return failRoomEdit(state, 'Curved wall no longer exists');
	}
	if (!segment.interiorAnchors.some((anchor) => anchor.id === anchorId)) {
		return failRoomEdit(state, 'Interior anchor no longer exists');
	}
	const nextSegment = deleteInteriorAnchorOnSegment(segment, anchorId);
	const nextRoom: LayoutRoom = {
		...room,
		boundary: {
			...room.boundary,
			segments: room.boundary.segments.map((candidate) => (candidate.id === segmentId ? nextSegment : candidate))
		}
	};
	const issues = validateLineRoom(nextRoom, floor);
	if (hasBlockingLayoutIssues(issues)) return failRoomEdit(state, issues[0]!.message);
	floor.rooms = floor.rooms.map((candidate) => (candidate.id === roomId ? nextRoom : candidate));
	const applied = applyLayoutMutation(state, layout);
	if (!applied.success) return failRoomEdit(state, applied.message);
	return { success: true };
}

export function commitLayoutPathRoom(
	state: LayoutPreviewState,
	segments: readonly DraftSegment[]
): LayoutDraftCommitResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return { success: false, message: wallFirstLegacyEditMessage(state) };
	}
	if (segments.length < 3) return { success: false, message: 'A room needs at least three segments' };
	const layout = cloneLayout(state.project.layout);
	const floor = layout.floors[0] ?? { id: 'floor-ground', name: 'Ground Floor', elevation: 0, height: 3, rooms: [] };
	if (!layout.floors[0]) layout.floors = [floor];
	const roomId = nextRoomId(floor.rooms);
	const boundary = { closed: true as const, segments: segments.map((segment) => cloneJson(segment)) };
	const room: LayoutRoom = {
		id: roomId,
		name: `Draft Room ${floor.rooms.length + 1}`,
		frame: deriveLayoutRoomFrame({ boundary }),
		boundary,
		wallThickness: 0.16,
		floorThickness: 0.1,
		ceilingThickness: 0.1,
		openings: []
	};
	const geometryIssues = validateLineRoom(room, floor);
	if (hasBlockingLayoutIssues(geometryIssues)) return { success: false, message: geometryIssues[0]!.message };
	floor.rooms = [...floor.rooms, room];
	try {
		const bundle = deriveInstallBundle(state, layout, 'Draft Layout Preview');
		state.source = 'draft';
		commitPreviewBundle(state, bundle);
		state.previewVersion += 1;
		state.lastMutationMessage = null;
		state.statusMessage = null;
		state.importError = null;
		return { success: true, roomId };
	} catch (error) {
		return { success: false, message: error instanceof Error ? error.message : 'Could not commit room draft' };
	}
}

export function previewLayoutRoomUnit(
	state: LayoutPreviewState,
	roomId: string,
	transform: LayoutRoomUnitTransform
): LayoutRoomEditResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failRoomEdit(state, wallFirstLegacyEditMessage());
	}
	const result = transformLayoutRoomUnit(state.project.layout, roomId, transform);
	if (!result.success) return failRoomEdit(state, result.message);
	const applied = applyLayoutMutation(state, result.document);
	return applied.success ? { success: true } : failRoomEdit(state, applied.message);
}

export function commitLayoutRoomEdit(
	state: LayoutPreviewState,
	roomId: string,
	points: readonly LayoutVec2[]
): LayoutRoomEditResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return failRoomEdit(state, wallFirstLegacyEditMessage());
	}
	const layout = cloneLayout(state.project.layout);
	const floor = layout.floors.find((candidate) => candidate.rooms.some((room) => room.id === roomId));
	const room = floor?.rooms.find((candidate) => candidate.id === roomId);
	if (!floor || !room) return failRoomEdit(state, 'Room no longer exists');
	if (points.length !== room.boundary.segments.length || points.some((point) => point.some((value) => !Number.isFinite(value)))) {
		return failRoomEdit(state, 'Room edit contains invalid coordinates');
	}
	const nextRoom = replaceRoomPoints(room, points);
	const issues = validateLineRoom(nextRoom, floor);
	if (hasBlockingLayoutIssues(issues)) return failRoomEdit(state, issues[0]!.message);
	floor.rooms = floor.rooms.map((candidate) => (candidate.id === roomId ? nextRoom : candidate));
	try {
		applyLayoutMutation(state, layout);
		return { success: true };
	} catch (error) {
		return failRoomEdit(state, error instanceof Error ? error.message : 'Could not edit room');
	}
}

export function commitLayoutDraftRoom(
	state: LayoutPreviewState,
	points: readonly LayoutVec2[]
): LayoutDraftCommitResult {
	if (isWallFirstLayoutDocument(layoutPreviewDocument(state))) {
		return { success: false, message: wallFirstLegacyEditMessage(state) };
	}
	if (points.length < 3) {
		return { success: false, message: 'A room needs at least three points' };
	}
	if (points.some((point) => point.some((value) => !Number.isFinite(value)))) {
		return { success: false, message: 'Room points must be finite coordinates' };
	}

	const layout = cloneLayout(state.project.layout);
	const floor = layout.floors[0] ?? {
		id: 'floor-ground',
		name: 'Ground Floor',
		elevation: 0,
		height: 3,
		rooms: []
	};
	if (!layout.floors[0]) layout.floors = [floor];

	const roomId = nextRoomId(floor.rooms);
	const room: LayoutRoom = {
		id: roomId,
		name: `Draft Room ${floor.rooms.length + 1}`,
		frame: deriveLayoutRoomFrame({
			boundary: {
				closed: true,
				segments: points.map((start, index) => ({
					id: `${roomId}:wall:${index}`,
					kind: 'line' as const,
					start: [...start] as LayoutVec2,
					end: [...points[(index + 1) % points.length]!] as LayoutVec2
				}))
			}
		}),
		boundary: {
			closed: true,
			segments: points.map((start, index) => ({
				id: `${roomId}:wall:${index}`,
				kind: 'line' as const,
				start: [...start] as LayoutVec2,
				end: [...points[(index + 1) % points.length]!] as LayoutVec2
			}))
		},
		wallThickness: 0.16,
		floorThickness: 0.1,
		ceilingThickness: 0.1,
		openings: []
	};
	const geometryIssues = validateLineRoom(room, floor);
	if (hasBlockingLayoutIssues(geometryIssues)) {
		state.lastMutationMessage = `Room draft rejected: ${geometryIssues[0]!.message}`;
		return {
			success: false,
			message: `Room draft rejected: ${geometryIssues[0]!.message}`
		};
	}
	floor.rooms = [...floor.rooms, room];

	try {
		const bundle = deriveInstallBundle(state, layout, 'Draft Layout Preview');
		state.source = 'draft';
		commitPreviewBundle(state, bundle);
		state.previewVersion += 1;
		state.lastMutationMessage = null;
		state.statusMessage = null;
		state.importError = null;
		return { success: true, roomId };
	} catch (error) {
		state.lastMutationMessage = error instanceof Error ? error.message : 'Could not commit room draft';
		return {
			success: false,
			message: state.lastMutationMessage
		};
	}
}

/** Editor layout sessions may temporarily diverge from scene room references. */
function createPreviewProject(input: {
	id: string;
	name: string;
	layout: unknown;
	scene: Project['scene'];
}): Project {
	const decoded = decodeLayoutValueCompatible(input.layout);
	if (decoded.kind === 'unrecognized') {
		const first = decoded.issues[0]!;
		throw new Error(`${first.path} (${first.code}): ${first.message}`);
	}
	return {
		id: input.id,
		name: input.name,
		layout: decoded.document as Project['layout'],
		scene: input.scene
	};
}

function createState(
	source: LayoutPreviewSource,
	layout: Project['layout'],
	scene: Project['scene'],
	previousVersion: number
): LayoutPreviewState {
	// P23.12 — the boot/load path is a wholesale document install, so references
	// are resolved here and the session mark starts from the installed document.
	const identityBase = isWallFirstLayoutDocument(layout as unknown as EditorLayoutDocument)
		? layoutIdentityCursor(layout as unknown as LayoutDocumentWallFirst)
		: 0;
	const bundle = derivePreviewBundle(
		'project:layout-preview',
		source === 'chopin-fixture' ? 'Chopin Layout Preview' : 'Empty Layout Preview',
		layout,
		scene,
		undefined,
		identityBase
	);
	const baselineLayoutJson = authoredLayoutJson(bundle.project.layout);
	const baselineKind: LayoutBaselineKind = source === 'empty' ? 'blank' : 'imported';
	return {
		source,
		project: bundle.project,
		model: bundle.model,
		geometry: bundle.geometry,
		wallMeshesByRoom: bundle.wallMeshesByRoom,
		wallMeshesByWall: bundle.wallMeshesByWall,
		layout3dPickIndexByRoom: bundle.layout3dPickIndexByRoom,
		issues: bundle.issues,
		bounds: bundle.bounds,
		previewVersion: previousVersion + 1,
		reframeVersion: 0,
		showCeilings: false,
		lastMutationMessage: null,
		statusMessage: null,
		importError: null,
		baselineLayoutJson,
		baselineKind,
		identityHighWater: layoutIdentityCursor(
			bundle.project.layout as unknown as LayoutDocumentWallFirst
		)
	};
}

function cloneLayout(layout: Project['layout']): Project['layout'] {
	return cloneJson(layout);
}

/** Deep-clone plain data; safe for Svelte `$state` proxies (unlike `structuredClone`). */
function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function nextRoomId(rooms: readonly LayoutRoom[]): string {
	const ids = new Set(rooms.map((room) => room.id));
	let index = rooms.length + 1;
	while (ids.has(`layout-room-${index}`)) index += 1;
	return `layout-room-${index}`;
}

function applyLayoutMutation(
	state: LayoutPreviewState,
	layout: Project['layout'],
	openingId?: string
): LayoutOpeningMutationResult {
	try {
		const decoded = decodeLayoutValueCompatible(layout);
		if (decoded.kind === 'unrecognized') return failOpeningMutation(state, decoded.issues[0]?.message ?? 'Invalid layout document');
		if (decoded.kind === 'wall-first') {
			const bundle = deriveInstallBundle(state, decoded.document, 'Draft Layout Preview');
			state.source = 'draft';
			commitPreviewBundle(state, bundle);
			state.previewVersion += 1;
			state.lastMutationMessage = null;
			state.statusMessage = null;
			state.importError = null;
			return { success: true, openingId: openingId ?? '' };
		}
		const structural = validateLayoutDocument(decoded.document);
		if (!structural.success) return failOpeningMutation(state, structural.issues[0]!.message);
		const geometryIssues = validateLayoutDocumentGeometry(structural.document);
		if (hasBlockingLayoutIssues(geometryIssues)) {
			return failOpeningMutation(state, geometryIssues[0]!.message);
		}
		const bundle = deriveInstallBundle(state, structural.document, 'Draft Layout Preview');
		state.source = 'draft';
		commitPreviewBundle(state, bundle);
		state.previewVersion += 1;
		state.lastMutationMessage = null;
		state.statusMessage = null;
		state.importError = null;
		return { success: true, openingId: openingId ?? '' };
	} catch (error) {
		return failOpeningMutation(state, error instanceof Error ? error.message : 'Could not update layout');
	}
}

function failOpeningMutation(
	state: LayoutPreviewState,
	message: string
): LayoutOpeningMutationResult {
	state.lastMutationMessage = message;
	return { success: false, message };
}

function failRoomEdit(state: LayoutPreviewState, message: string): LayoutRoomEditResult {
	state.lastMutationMessage = message;
	return { success: false, message };
}

function failInteriorAnchorMutation(
	state: LayoutPreviewState,
	message: string
): LayoutInteriorAnchorMutationResult {
	state.lastMutationMessage = message;
	return { success: false, message };
}

function failObjectMutation(state: LayoutPreviewState, message: string): LayoutObjectMutationResult {
	state.lastMutationMessage = message;
	state.statusMessage = message;
	return { success: false, message };
}

function replaceState(target: LayoutPreviewState, next: LayoutPreviewState): void {
	target.source = next.source;
	target.project = next.project;
	target.model = next.model;
	target.geometry = next.geometry;
	target.wallMeshesByRoom = next.wallMeshesByRoom;
	target.wallMeshesByWall = next.wallMeshesByWall;
	target.layout3dPickIndexByRoom = next.layout3dPickIndexByRoom;
	target.issues = next.issues;
	target.bounds = next.bounds;
	target.previewVersion = next.previewVersion;
	target.reframeVersion += 1;
	// Keep layout-local ceiling inspection preference across reload/reset.
	target.lastMutationMessage = null;
	target.statusMessage = null;
	target.importError = null;
	target.baselineLayoutJson = next.baselineLayoutJson;
	target.baselineKind = next.baselineKind;
	// A document replacement re-seeds the allocation mark from the new document.
	target.identityHighWater = next.identityHighWater;
}

export type LayoutPreviewSnapshot = {
	source: LayoutPreviewState['source'];
	project: LayoutPreviewState['project'];
	/**
	 * The captured preview model — the frozen record of what was on screen. It is
	 * **not** what a restore installs: the model is a pure projection of
	 * `geometry` (see `projectLayoutPreviewModel`), so `restore` re-projects it
	 * from `geometry` instead of deep-cloning this copy. Both describe the same
	 * state, which is what the capture/restore round-trip tests pin.
	 */
	model: LayoutPreviewState['model'];
	geometry: LayoutPreviewState['geometry'];
	issues: LayoutPreviewState['issues'];
	bounds: LayoutPreviewState['bounds'];
	lastMutationMessage: string | null;
	statusMessage: string | null;
	importError: string | null;
};

export function captureLayoutPreviewSnapshot(state: LayoutPreviewState): LayoutPreviewSnapshot {
	return {
		source: state.source,
		project: cloneJson(state.project),
		model: cloneJson(state.model),
		geometry: state.geometry,
		issues: cloneJson(state.issues),
		lastMutationMessage: state.lastMutationMessage,
		statusMessage: state.statusMessage,
		importError: state.importError,
		bounds: state.bounds
			? {
					min: [state.bounds.min[0], state.bounds.min[1], state.bounds.min[2]],
					max: [state.bounds.max[0], state.bounds.max[1], state.bounds.max[2]]
				}
			: null
	};
}

export function restoreLayoutPreviewSnapshot(state: LayoutPreviewState, snapshot: LayoutPreviewSnapshot): void {
	p2311Measure('baseline-restore', () => restoreLayoutPreviewSnapshotUnmeasured(state, snapshot));
}

function restoreLayoutPreviewSnapshotUnmeasured(state: LayoutPreviewState, snapshot: LayoutPreviewSnapshot): void {
	// The remaining cost of a restore is the **reactive write path itself**: on a
	// `$state` preview graph this block measures ~7 ms p50 at 50 Walls (1.3 ms at
	// 3 Rooms / 12 Walls), while the identical restore against a plain graph
	// costs 0.07 ms. `state.geometry` is the whole of it — re-assigning a geometry
	// the reactive graph has already read is what the proxy pays for, and it is
	// reactive bookkeeping, not Bend work. Nothing here changes it: the writes are
	// the restore's contract (see the `baseline-restore` investigation).
	p2311Measure('restore-reactive-write', () => {
		state.source = snapshot.source;
		state.project = p2311Measure('restore-project-clone', () => cloneJson(snapshot.project));
		// The preview model is a pure projection of the compiled geometry (the same
		// one a fresh install performs), so restoring re-projects it instead of
		// deep-cloning the captured copy — identical content, none of the JSON cost.
		state.model = p2311Measure('restore-model-project', () => projectLayoutPreviewModel(snapshot.geometry));
		state.geometry = snapshot.geometry;
		// The snapshot's `issues` already includes mesh issues from capture time,
		// and undo restores the same geometry, so re-deriving would duplicate them.
		state.issues = p2311Measure('restore-issues-clone', () => cloneJson(snapshot.issues));
	});
	// The wall-mesh + pick-index caches are derived and never part of the undo
	// snapshot: undo restores the document and the caches are re-derived from
	// geometry — reusing the ones already derived for this exact geometry object.
	p2311Measure('restore-mesh-install', () => installWallMeshes(state, snapshot.geometry));
	p2311Measure('restore-bookkeeping', () => {
		state.bounds = snapshot.bounds
			? {
					min: [snapshot.bounds.min[0], snapshot.bounds.min[1], snapshot.bounds.min[2]],
					max: [snapshot.bounds.max[0], snapshot.bounds.max[1], snapshot.bounds.max[2]]
				}
			: null;
		state.previewVersion += 1;
		state.lastMutationMessage = snapshot.lastMutationMessage;
		state.statusMessage = snapshot.statusMessage;
		state.importError = snapshot.importError;
	});
}
