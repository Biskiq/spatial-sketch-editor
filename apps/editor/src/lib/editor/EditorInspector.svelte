<script lang="ts">
	import {
		Box,
		Boxes,
		BrickWall,
		Camera,
		DoorOpen,
		ExternalLink,
		GitMerge,
		Info,
		Lightbulb,
		Square
	} from 'lucide-svelte';
	import { resolveAssetFallback } from '$lib/content/assets';
	import { isSceneLightEntity, isSceneModelEntity, isScenePrimitiveEntity } from '$lib/content/scene';
	import type { Asset } from '$lib/types/assets';
	import { tick } from 'svelte';
	import type { EditorWorkspace } from './editor-types';
	import EditorCameraInspector from './camera/EditorCameraInspector.svelte';
	import CameraPlanInspector from './app/CameraPlanInspector.svelte';
	import type { EditorViewState } from './app/editor-view-state.svelte';
	import { resolveInspectorDomain, resolveInspectorExposure } from './app/inspector-target';
	import EditorLightInspector from './EditorLightInspector.svelte';
	import EditorMaterialInspector from './EditorMaterialInspector.svelte';
	import EditorPlacementInspector from './EditorPlacementInspector.svelte';
	import EditorPrimitiveInspector from './EditorPrimitiveInspector.svelte';
	import EditorTransformInspector from './EditorTransformInspector.svelte';
	import EditorNumberField from './fields/EditorNumberField.svelte';
	import { degreesToRadians, radiansToDegrees, type PlacementTransform } from './editor-transform';
	import {
		centerWallFirstOpening,
		duplicateWallFirstRoom,
		deleteLayoutObject,
		deleteLayoutOpening,
		deleteLayoutRoom,
		deleteWallFirstOpening,
		deleteWallFirstWall,
		dissolveWallFirstJunction,
		layoutRoomSceneReferenceSummary,
		layoutRoomSceneReferenceTotal,
		listLayoutRoomSceneReferences,
		removeWallFirstRoom,
		repeatWallFirstObject,
		repeatWallFirstOpening,
		updateWallFirstOpening,
		updateWallFirstRoomMetadata,
		updateWallFirstWallMetadata,
		updateWallFirstOpeningMetadata,
		wallFirstJunctionDissolveRefusal,
		wallFirstRoomExclusiveBoundaryWallIds,
		updateLayoutObjectFields,
		layoutPreviewDocument,
		updateLayoutOpeningFields,
		updateLayoutRoomFields,
		previewLayoutRoomUnit,
		updateWallFirstJunction,
		updateWallFirstWallAngle,
		updateWallFirstWallLength,
		updateWallFirstWallHeight,
		updateWallFirstWallThickness,
		deleteWallFirstWallCurveKnot,
		insertWallFirstWallCurveKnot,
		updateWallFirstWallCurve,
		updateWallFirstWallCurveKnot,
		updateWallFirstWallLine,
		updateWallFirstRectangle,
		commitWallRoleChange,
		subdivideWallFirstWall,
		type LayoutOpeningMutationResult,
		type LayoutPreviewState,
		type LayoutRoomFieldPatch
	} from './layout/layout-preview-state.svelte';
	import {
		wallFirstOffsetFromEndDistance,
		wallFirstOffsetFromStartDistance,
		wallFirstOpeningMetrics
	} from '$lib/layout/layout-wall-openings';
	import { wallFirstAdjacentRooms } from '$lib/layout/layout-portals';
	import { layoutMutationRunnerFor, runLayoutMutation } from './layout/layout-mutation-runner';
	import { formatDegrees, formatMeters, parseExactNumber } from './layout/layout-exact-input';
	import {
		selectLayoutJunction,
		selectLayoutObject,
		selectLayoutPhysicalWall,
		selectLayoutRoom,
		selectLayoutWallOpening,
		selectedLayoutRoomId,
		setLayoutDraftTool,
		toggleLayoutAccordion,
		isLayoutPresetTool,
		type LayoutInteractionState,
		type LayoutPresetTool,
		type LayoutPrimitiveTool
	} from './layout/layout-interaction';
	import { roomBounds, roomEdgeLength } from './layout/layout-editing';
	import {
		wallFirstRoomMoveEligibility,
		type WallFirstRoomMoveEligibility
	} from './layout/layout-preview-state.svelte';
	import {
		type EditorStore
	} from './editor-store.svelte';
	import type { EditorActiveSelectionStore } from './app/active-editor-selection.svelte';
	import type { EditorViewMode } from './app/editor-view-mode';
import { buildPlanSceneFootprintProjection } from './layout/plan-scene-footprint';
import { resolveEditorPlacementScale } from './scale-vector';
import {
	resolveRectangle,
	LAYOUT_PLAN_GRID_STEP,
	alignReferenceKey,
	planLayoutObjectAlign,
	type AlignAction,
	type AlignAxis,
	type AlignReference
} from '$lib/layout/layout-wall-first-precision';
import type { LayoutDocumentWallFirst, LayoutJunction, LayoutWall, LayoutWallFirstRoom } from '$lib/layout/layout-wall-first-types';
// P23.12 D5 — the Inspector asks the shared display-identity layer how an
// entity reads; it never queries the ledger itself and never formats a raw
// canonical ID into user-facing copy.
import {
	junctionIdentity,
	junctionIdentityText,
	openingIdentity,
	openingIdentityText,
	roomIdentity,
	roomIdentityText,
	wallIdentity,
	wallIdentityText
} from './identity/layout-identity-view';
import { formatPlacementLabel } from './editor-outliner';
import type { WallFirstDuplicateMutationResult } from './layout/layout-preview-state.svelte';

/** Gap between an opening and its duplicate (meters) — clear, canonical spacing. */
const WALL_OPENING_DUPLICATE_GAP_M = 0.2;

	let {
		store,
		layoutPreview,
		layoutInteraction,
		activeSelection,
		selectedAsset,
		clusterNameInput = $bindable(),
		inspectorElement = $bindable<HTMLElement | null>(null),
		collapsed = false,
		viewMode = '3d',
		viewState = null
	}: {
		store: EditorStore;
		layoutPreview: LayoutPreviewState;
		layoutInteraction: LayoutInteractionState;
		/** optional domain-driven panel switch. When provided and a
		 *  domain is active, the panel follows `active.domain` (a scene/camera
		 *  selection survives Plan ↔ 3D and must keep its panel); otherwise it
		 *  falls back to `store.currentWorkspace` — the relic passes nothing
		 *  and is byte-for-byte unchanged. */
		activeSelection?: EditorActiveSelectionStore;
		selectedAsset?: Asset;
		clusterNameInput?: HTMLInputElement;
		/** P21.6 Slice C — shell focus mode binds the root to restore
		 * keyboard focus when this panel collapses under it. */
		inspectorElement?: HTMLElement | null;
		/** P21.6 Slice C — collapsed panels clip + go inert (CSS grid only). */
		collapsed?: boolean;
		/** Authoritative shell view mode. the editor passes the top-level Plan | 3D
		 *  switch so the domain-driven panel can keep a preserved scene/camera
		 *  selection visible yet read-only in Plan (Plan is layout CAD only —
		 *  no non-layout mutation path). Legacy mounts omit it and stay fully
		 *  interactive. */
		viewMode?: EditorViewMode;
		/** P1.8 — the shell view state, so the Camera Plan inspector can
		 *  switch to 3D when previewing a camera. Omitted by the relic. */
		viewState?: EditorViewState | null;
	} = $props();

	/** P23.14 §13 — the property-first selection header's resolved presentation. */
	type SelectionHeader = {
		/** The kind cue: any icon component the panel already ships (Lucide). */
		icon: typeof BrickWall;
		primary: string;
		secondary: string | null;
		kind: string;
	};

	let clusterNameDraft = $state('');
	const selectedObject = $derived(store.selectedObject);
	const selectedCameraNode = $derived(store.selectedNavigationNode);
	const selectedNavigation = $derived(store.navigationSelection);
	const singleSelectedEntity = $derived(
		store.selectedPlacementIds.length === 1 &&
			!store.selectedClusterId &&
			store.selectedObject
			? store.selectedObject
			: undefined
	);
	const singleEditableObject = $derived(
		singleSelectedEntity && isSceneModelEntity(singleSelectedEntity)
			? singleSelectedEntity
			: undefined
	);
	const singlePrimitive = $derived(
		singleSelectedEntity && isScenePrimitiveEntity(singleSelectedEntity)
			? singleSelectedEntity
			: undefined
	);
	const singleLight = $derived(
		singleSelectedEntity && isSceneLightEntity(singleSelectedEntity)
			? singleSelectedEntity
			: undefined
	);
	// Phase 5.2 — one selected model/primitive overrides generic Assets
	// inspection so viewport drops and entity edits surface the Material
	// inspector even while the Assets tab stays open.
	const singleMaterialEntity = $derived(
		singleSelectedEntity &&
			(isSceneModelEntity(singleSelectedEntity) || isScenePrimitiveEntity(singleSelectedEntity))
			? singleSelectedEntity
			: undefined
	);
	// P23.14 §2.5/§13 — the Inspector has ONE exposed target: the workspace owns
	// what the panel may present, and the canonical selection is remembered
	// across a domain switch but only EXPOSED while it belongs to the current
	// workspace. Both the selection header and the body branch below read this
	// one resolution (plus the slot exposure beside it), so they cannot describe
	// different things (F2) and a Scene workspace cannot mount the Camera editor
	// at all (F1). The relic passes no `viewState`, so it keeps its legacy
	// ungated behavior exactly as before.
	const workspace = $derived<EditorWorkspace>(store.currentWorkspace);
	const scopedExposure = $derived(viewState !== null);
	const exposure = $derived(resolveInspectorExposure(workspace));
	const scenePlanStaging = $derived(
		viewMode === 'plan' &&
		viewState?.domain === 'scene' &&
		layoutInteraction.planViewMode === 'staging'
	);
	// P10 — Arrange (staging) is owner-aware: an active Layout-object target
	// shows the layout owner's panel; otherwise the Scene owner's Arrange panel.
	const domain = $derived<EditorWorkspace>(
		resolveInspectorDomain({
			workspace,
			selectionDomain: activeSelection ? activeSelection.active.domain : 'none',
			staging: scenePlanStaging
		})
	);
	// The raw selection slots the panels and the header read, exposed only where
	// the workspace on screen may present them: a remembered Camera node is not a
	// Scene selection, and a remembered Scene placement is not a Camera one.
	const exposedNavigation = $derived(
		exposure.camera || !scopedExposure ? selectedNavigation : null
	);
	const exposedObject = $derived(exposure.scene || !scopedExposure ? selectedObject : null);
	const exposedCluster = $derived(exposure.scene || !scopedExposure ? store.selectedCluster : null);
	const exposedPlacementIds = $derived(
		exposure.scene || !scopedExposure ? store.selectedPlacementIds : []
	);
	// Arrange's read-only gates apply only in the active Scene Plan view;
	// a persisted staging mode must not disable fields after switching to 3D.
	const arrangeMode = $derived(scenePlanStaging);
	// P21.2 — Scene Plan Layout primer: reference card while selection is zero.
	const isScenePlanLayout = $derived(
		viewMode === 'plan' &&
		viewState?.domain === 'scene' &&
		layoutInteraction.planViewMode === 'layout'
	);
	const showLayoutPrimer = $derived(
		isScenePlanLayout && layoutInteraction.selection.kind === 'none'
	);
	// Plan authority is workspace-specific (P1.5): Camera → Plan mounts the
	// live Camera Plan inspector (timing + X/Z authoring); Scene → Plan stays
	// the layout-CAD read-only gate — a preserved scene/camera selection keeps
	// its panel but every non-layout mutation control is inert.
	const isCameraPlan = $derived(viewMode === 'plan' && domain === 'camera');
	const readOnly = $derived(viewMode !== '3d' && !isCameraPlan);
	const readOnlyNonLayout = $derived(readOnly && domain !== 'layout');
	const showAssetInspector = $derived(
		domain === 'scene' &&
			store.leftPanel === 'assets' &&
			!singleMaterialEntity
	);
	const selectionContainsClusteredPlacement = $derived(
		store.selectedPlacementIds.some((id) => store.clusteredPlacementIds.has(id))
	);
	const canGroupSelection = $derived(
		store.selectedPlacementIds.length >= 2 &&
			!store.selectedClusterId &&
			!selectionContainsClusteredPlacement
	);
	const hasPlacementSelection = $derived(
		Boolean(exposedCluster) || exposedPlacementIds.length > 0
	);
	const stagingEligibleIds = $derived.by(() => {
		void store.placementScaleVectorVersion;
		return new Set(
			buildPlanSceneFootprintProjection(store.document, store.rooms, {
				getEffectiveScale: (entity) =>
					resolveEditorPlacementScale(entity.scale, store.getPlacementScaleVector(entity.id))
			}).footprints.map((footprint) => footprint.entityId)
		);
	});
	const stagingIneligibleCount = $derived(
		store.selectedPlacementIds.filter((id) => !stagingEligibleIds.has(id)).length
	);
	const stagingTransformAvailable = $derived(
		scenePlanStaging &&
		store.selectedClusterId === null &&
		store.selectedPlacementIds.length > 0 &&
		stagingIneligibleCount === 0
	);
	const stagingSingleTransform = $derived(
		stagingTransformAvailable && store.selectedPlacementIds.length === 1
			? store.selectedTransform
			: undefined
	);
	const canDuplicateSelection = $derived(store.selectedPlacementIds.length > 0);
	const layoutDocument = $derived(layoutPreviewDocument(layoutPreview));
	const wallFirstLayout = $derived('formatVersion' in layoutDocument ? layoutDocument : null);

	/** P23.12 — optional-name edit: an emptied field maps to `null` (clear). */
	function updateSelectedWallName(event: Event) {
		const wall = selectedWallFirstWall;
		if (!wall) return;
		const input = event.currentTarget as HTMLInputElement;
		const previous = wall.name ?? '';
		const raw = input.value;
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstWallMetadata(layoutPreview, wall.id, { name: raw === '' ? null : raw }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			input.value = previous;
			return;
		}
		const result = outcome.result;
		if (!result.success) {
			input.value = previous;
			store.setStatusMessage(result.message);
		}
	}

	/** P23.12 — optional-name edit for the selected Opening, same mapping. */
	function updateSelectedOpeningName(event: Event) {
		const opening = selectedWallFirstOpening;
		if (!opening) return;
		const input = event.currentTarget as HTMLInputElement;
		const previous = opening.name ?? '';
		const raw = input.value;
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstOpeningMetadata(layoutPreview, opening.id, { name: raw === '' ? null : raw }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			input.value = previous;
			return;
		}
		const result = outcome.result;
		if (!result.success) {
			input.value = previous;
			store.setStatusMessage(result.message);
		}
	}
	const isWallFirstLayout = $derived(wallFirstLayout !== null);
	const layoutRooms = $derived('floors' in layoutDocument ? layoutDocument.floors.flatMap((floor) => floor.rooms) : []);
	// P23.6b — room-name lookup that works for BOTH formats: a wall-first
	// LayoutObject's explicit `roomId` is an Associated Room relation and must
	// resolve its display name from the current-format Room collection, not
	// degrade to "Unassigned".
	const associatedRoomName = $derived.by(() => {
		const roomId = selectedLayoutObject?.roomId;
		if (!roomId) return null;
		return (
			layoutRooms.find((room) => room.id === roomId)?.name ??
			wallFirstLayout?.rooms.find((room) => room.id === roomId)?.name ??
			null
		);
	});
	// P23.6b — the Inspector-local `precisionTarget` selected-entity authority
	// is RETIRED: `layoutInteraction.selection` is the single "which entity is
	// selected" source. `precisionFixedEndpoint`, `precisionRectangleAnchor`
	// and `precisionRectangleWidthWall` survive as **ephemeral operation
	// parameters** (D8) — they never select an entity and never edit a
	// document; the `$effect` below re-keys them off the canonical selection.
	let precisionFixedEndpoint = $state<'start' | 'end'>('start');
	let precisionRectangleAnchor = $state<string | null>(null);
	let precisionRectangleWidthWall = $state<string | null>(null);
	// P23.6b — canonical wall-first panels read the one canonical selection.
	// (Alias + rectangle deriveds live below, next to the `selectedWallFirst*`
	// definitions, so the TDZ is respected.)
	// P23.6b — aliases over the canonical selection-derived targets (declared
	// after the `selectedWallFirst*` definitions below); the old Inspector-local
	// `precisionTarget` state is retired.
	const selectedLayoutRoom = $derived(
		selectedLayoutRoomId(layoutInteraction)
			? layoutRooms.find((room) => room.id === selectedLayoutRoomId(layoutInteraction))
			: undefined
	);
	const selectedLayoutOpeningSelection = $derived(
		layoutInteraction.selection.kind === 'opening' ? layoutInteraction.selection : null
	);
	const selectedLayoutWallSelection = $derived(
		layoutInteraction.selection.kind === 'wall' ||
			layoutInteraction.selection.kind === 'opening' ||
			layoutInteraction.selection.kind === 'interiorAnchor'
			? layoutInteraction.selection
			: null
	);
	const selectedLayoutOpening = $derived(
		selectedLayoutOpeningSelection && selectedLayoutRoom
			? selectedLayoutRoom.openings.find((opening) => opening.id === selectedLayoutOpeningSelection.openingId)
			: undefined
	);
	// P23.3 — canonical wall-first Opening Inspector target (document-global
	// `wallId` + `openingId`; Room-side context is derived, never stored).
	const selectedWallFirstOpeningSelection = $derived(
		layoutInteraction.selection.kind === 'wallOpening' ? layoutInteraction.selection : null
	);	const selectedWallFirstOpening = $derived(
		selectedWallFirstOpeningSelection && wallFirstLayout
			? (wallFirstLayout.openings.find(
					(opening) => opening.id === selectedWallFirstOpeningSelection.openingId
				) ?? null)
			: null
	);
	const selectedWallFirstOpeningMetrics = $derived(
		selectedWallFirstOpening && wallFirstLayout
			? (wallFirstOpeningMetrics(wallFirstLayout, selectedWallFirstOpening.id) ?? null)
			: null
	);
	const selectedWallFirstHostingWall = $derived(
		selectedWallFirstOpening && wallFirstLayout
			? (wallFirstLayout.walls.find((wall) => wall.id === selectedWallFirstOpening.wallId) ?? null)
			: null
	);
	/** Portal candidates come only from accepted Wall-side topology. */
	const selectedWallFirstOpeningAdjacentRooms = $derived(
		selectedWallFirstOpening && wallFirstLayout
			? wallFirstAdjacentRooms(wallFirstLayout, selectedWallFirstOpening.wallId)
			: []
	);
	const selectedWallFirstOpeningAdjacentRoomNames = $derived(
		selectedWallFirstOpeningAdjacentRooms.map(
			(roomId) => wallFirstLayout?.rooms.find((room) => room.id === roomId)?.name ?? roomId
		)
	);
	// P23.6 — canonical wall-first Wall Inspector target: the Plan selection
	// drives exact Length/Angle/Thickness editing plus the
	// Defines-room-boundary role control (same operations as Architecture ·
	// exact, one history entry each).
	const selectedWallFirstWallSelection = $derived(
		layoutInteraction.selection.kind === 'physicalWall' ? layoutInteraction.selection : null
	);
	const selectedWallFirstWall = $derived(
		selectedWallFirstWallSelection && wallFirstLayout
			? (wallFirstLayout.walls.find((wall) => wall.id === selectedWallFirstWallSelection.wallId) ?? null)
			: null
	);
	const selectedWallFirstWallEndpoints = $derived(
		selectedWallFirstWall && wallFirstLayout
			? precisionWallEndpoints(wallFirstLayout, selectedWallFirstWall)
			: null
	);
	// P23.11 — the selected Wall's own curve. Straight Walls expose no bend
	// points, so the panel shows the one Convert action instead.
	const selectedWallFirstWallKnots = $derived(
		selectedWallFirstWall?.centerline.kind === 'cubic-chain'
			? selectedWallFirstWall.centerline.knots
			: []
	);
	// P23.6 — canonical wall-first Room Inspector target. Read-only identity
	// presentation (no wall-first Room metadata operation exists yet);
	// boundary/dimension truth stays in the compiled Plan model.
	const selectedWallFirstRoomSelection = $derived(
		layoutInteraction.selection.kind === 'room' ? layoutInteraction.selection : null
	);
	const selectedWallFirstRoom = $derived(
		selectedWallFirstRoomSelection && wallFirstLayout
			? (wallFirstLayout.rooms.find((room) => room.id === selectedWallFirstRoomSelection.roomId) ?? null)
			: null
	);

	// P23.12 — the compact references of the selected entities, read from the
	// document's identity ledger. `null` when the document carries no ledger.
	const selectedWallReference = $derived(
		wallFirstLayout && selectedWallFirstWall
			? wallIdentity(wallFirstLayout, selectedWallFirstWall.id).reference
			: null
	);
	const selectedOpeningReference = $derived(
		wallFirstLayout && selectedWallFirstOpening
			? openingIdentity(wallFirstLayout, selectedWallFirstOpening.id).reference
			: null
	);
	const selectedRoomReference = $derived(
		wallFirstLayout && selectedWallFirstRoom
			? roomIdentity(wallFirstLayout, selectedWallFirstRoom.id).reference
			: null
	);
	// P23.6 — canonical wall-first Junction Inspector target (coordinate
	// readout + exact X/Z editing through the same guarded mutation path).
	const selectedWallFirstJunctionSelection = $derived(
		layoutInteraction.selection.kind === 'junction' ? layoutInteraction.selection : null
	);
	const selectedWallFirstJunction = $derived(
		selectedWallFirstJunctionSelection && wallFirstLayout
			? (wallFirstLayout.junctions.find(
					(junction) => junction.id === selectedWallFirstJunctionSelection.junctionId
				) ?? null)
			: null
	);
	const selectedJunctionReference = $derived(
		wallFirstLayout && selectedWallFirstJunction
			? junctionIdentity(wallFirstLayout, selectedWallFirstJunction.id).reference
			: null
	);
	// P23.12 D2/D5/D6 — copy that names an entity inside a sentence is composed by
	// the shared display-identity layer (`*IdentityText`), never here: the tier
	// order (authored name → compact reference → raw-ID display label) and its
	// fallback live in exactly one module. The full canonical ID stays in
	// Technical details, which is where diagnosis belongs.
	/**
	 * P23.12 D6 — a bend point reads by its ordinal in the selected Wall's own
	 * chain. Its canonical knot ID (`{wallId}:knot:{n}`) embeds the raw Wall ID,
	 * so it stays in the chain data and out of user copy.
	 *
	 * A status message that reports on a mutation MUST read the chain BEFORE it
	 * runs (via `bendPointLabelAt` with the pre-mutation index and count):
	 * afterwards the removed knot has no ordinal to find, and the remaining count
	 * is one lower than the chain the user actually acted on.
	 */
	function bendPointLabel(knotId: string): string {
		const index = selectedWallFirstWallKnots.findIndex((knot) => knot.id === knotId);
		return index >= 0 ? bendPointLabelAt(index) : 'Bend point';
	}
	function bendPointLabelAt(index: number): string {
		return `Bend point ${index + 1}`;
	}
	/**
	 * A diagnostic's affected source, named by identity rather than by raw ID.
	 * With no ledger entry for either family the third tier applies — the raw-ID
	 * display label, never the bare canonical ID; the row keeps the raw ID in its
	 * `title` instead.
	 */
	function diagnosticTargetIdentityText(targetId: string): string {
		const layout = layoutDocument;
		const wall = wallIdentity(layout, targetId);
		if (wall.name !== null || wall.reference !== null) return wallIdentityText(layout, targetId);
		const junction = junctionIdentity(layout, targetId);
		if (junction.reference !== null) return junctionIdentityText(layout, targetId);
		return formatPlacementLabel(targetId);
	}
	// Technical details (D6): collapsed by default, state kept across selection
	// changes, exposing the full canonical ID with a copy control. All four
	// selection targets are declared above by here.
	let technicalDetailsOpen = $state(false);
	// P23.14 §13 — the Scene selection's own raw-ID disclosure. A separate
	// state from the Layout one: switching domains must not carry a Layout
	// disclosure state onto a Scene entity (or the reverse).
	let sceneTechnicalDetailsOpen = $state(false);
	function copyTechnicalId(): void {
		void navigator.clipboard?.writeText(technicalDetailsId);
	}
	function copyTechnicalReference(): void {
		if (technicalDetailsReference) void navigator.clipboard?.writeText(technicalDetailsReference);
	}
	const technicalDetailsId = $derived(
		selectedWallFirstWall?.id ??
			selectedWallFirstJunction?.id ??
			selectedWallFirstOpening?.id ??
			selectedWallFirstRoom?.id ??
			''
	);
	// P23.12 D6 — every entity kind exposes the same technical identity block:
	// the full canonical ID plus the compact reference, both copyable. Reference
	// may be absent (no ledger yet), so its copy control is conditional.
	const technicalDetailsReference = $derived(
		selectedWallFirstWall
			? selectedWallReference
			: selectedWallFirstJunction
				? selectedJunctionReference
				: selectedWallFirstOpening
					? selectedOpeningReference
					: selectedWallFirstRoom
						? selectedRoomReference
						: null
	);
	// P23.6b — aliases over the canonical targets above: the retired
	// `precisionTarget` machinery keeps its helper names, now bound to the one
	// canonical selection instead of an Inspector-local state.
	const selectedPrecisionJunction = $derived(selectedWallFirstJunction);
	const selectedPrecisionWall = $derived(selectedWallFirstWall);
	const selectedPrecisionRoom = $derived(selectedWallFirstRoom);
	// P23.6d — Room removal eligibility: `Remove room` deletes the Room's whole
	// boundary, so it needs at least one boundary Wall the Room owns alone. A
	// shared Wall is one physical Wall a neighbour still needs and is kept.
	// Exclusivity comes from the canonical boundary references, never geometry.
	const selectedWallFirstRoomExclusiveWalls = $derived(
		selectedWallFirstRoom
			? wallFirstRoomExclusiveBoundaryWallIds(layoutPreview, selectedWallFirstRoom.id)
			: []
	);
	const selectedPrecisionWallEndpoints = $derived(selectedWallFirstWallEndpoints);
	// P23.6b — Wall-panel relations: hosted Openings (document order) and the
	// Rooms whose boundary references this Wall (D2: relation, not ownership).
	const selectedWallFirstHostedOpenings = $derived(
		selectedWallFirstWall && wallFirstLayout
			? wallFirstLayout.openings.filter((opening) => opening.wallId === selectedWallFirstWall.id)
			: []
	);
	const selectedWallFirstBoundedRooms = $derived(
		selectedWallFirstWall && wallFirstLayout
			? wallFirstLayout.rooms
					.filter((room) => room.boundary.some((ref) => ref.wallId === selectedWallFirstWall.id))
					.map((room) => room.name)
			: []
	);
	const selectedPrecisionRectangle = $derived(
		selectedWallFirstRoom && wallFirstLayout
			? precisionRectangleMetrics(wallFirstLayout, selectedWallFirstRoom)
			: null
	);
	const precisionRectangleWidthWallOptions = $derived.by(() => {
		if (!wallFirstLayout || !selectedWallFirstRoom) return [];
		const resolved = resolveRectangle(
			wallFirstLayout,
			selectedWallFirstRoom.id,
			precisionRectangleAnchor ? { anchorJunctionId: precisionRectangleAnchor } : {}
		);
		if ('rejection' in resolved) return [];
		return [resolved.widthWallId, resolved.depthWallId];
	});
	// P23.6b — Room-panel derived facts (priority order: identity → editable
	// properties → behavior → relations → advanced). Area/perimeter derive
	// from the Room's compiled floor polygon; the derived ceiling is
	// presented read-only (P23.6I: no authored Room ceiling exists — authoring
	// one is a separate slice). Move eligibility consumes P23.6a's adapter
	// verbatim; B never re-derives isolation policy and the gesture stays A's.
	const selectedWallFirstRoomFacts = $derived.by(() => {
		const room = selectedWallFirstRoom;
		if (!room) return null;
		const compiled = layoutPreview.geometry.rooms.find((candidate) => candidate.roomId === room.id);
		const polygon = compiled?.floorPolygon ?? [];
		let area = 0;
		let perimeter = 0;
		for (let index = 0; index < polygon.length; index += 1) {
			const [ax, az] = polygon[index]!;
			const [bx, bz] = polygon[(index + 1) % polygon.length]!;
			area += ax * bz - bx * az;
			perimeter += Math.hypot(bx - ax, bz - az);
		}
		area = Math.abs(area) / 2;
		const boundaryWallIds = [
			...new Set(room.boundary.map((ref) => ref.wallId).filter((wallId) => wallFirstLayout?.walls.some((wall) => wall.id === wallId)))
		];
		const eligibility: WallFirstRoomMoveEligibility = wallFirstLayout
			? wallFirstRoomMoveEligibility(layoutPreview, room.id)
			: { movable: false, rejection: { code: 'unknown_room', message: 'No wall-first layout', targetIds: [room.id] }, hint: 'Room move requires a wall-first layout' };
		return { area, perimeter, ceilingElevation: compiled?.ceilingElevation ?? null, boundaryWallIds, eligibility };
	});
	/**
	 * P23.12 D6 — the Room's boundary members read as identity, the same tier
	 * order every other surface uses; the canonical Wall IDs stay in each Wall's
	 * own Technical details block.
	 */
	const selectedWallFirstRoomBoundaryLabel = $derived(
		selectedWallFirstRoomFacts && selectedWallFirstRoomFacts.boundaryWallIds.length > 0
			? selectedWallFirstRoomFacts.boundaryWallIds
					.map((wallId) => wallIdentityText(layoutDocument, wallId))
					.join(', ')
			: 'none'
	);
	const selectedLayoutSegment = $derived(
		selectedLayoutWallSelection && selectedLayoutRoom
			? selectedLayoutRoom.boundary.segments.find((segment) => segment.id === selectedLayoutWallSelection.segmentId)
			: undefined
	);
	const selectedLayoutBounds = $derived(selectedLayoutRoom ? roomBounds(selectedLayoutRoom) : null);
	const selectedLayoutFloor = $derived(
		selectedLayoutRoom
			? layoutPreview.project.layout.floors.find((floor) =>
					floor.rooms.some((room) => room.id === selectedLayoutRoom.id)
				)
			: undefined
	);
	const selectedLayoutObjectId = $derived(
		layoutInteraction.selection.kind === 'object' ? layoutInteraction.selection.objectId : null
	);
	const selectedLayoutObject = $derived(
		selectedLayoutObjectId
			? layoutPreview.project.layout.objects.find((object) => object.id === selectedLayoutObjectId)
			: undefined
	);

	// P23.6b — operation parameters re-key off the canonical selection (D8):
	// they are reset whenever the selected canonical entity changes identity
	// (or the rectangle parameters stop being valid for it), and never select
	// an entity themselves. Selection validity is `reconcileLayoutSelection`'s
	// job, so no target-liveness effect is needed anymore.
	$effect(() => {
		const room = selectedWallFirstRoom;
		void selectedWallFirstJunction?.id;
		void selectedWallFirstWall?.id;
		if (!room || !wallFirstLayout) return;
		const rectangle = precisionRectangleMetrics(wallFirstLayout, room);
		const invalidAnchor = Boolean(precisionRectangleAnchor && (!rectangle || !rectangle.cornerIds.includes(precisionRectangleAnchor)));
		const invalidWidthWall = Boolean(precisionRectangleWidthWall && (!rectangle || rectangle.widthWallId !== precisionRectangleWidthWall));
		if (invalidAnchor || invalidWidthWall) {
			precisionRectangleAnchor = null;
			precisionRectangleWidthWall = null;
		}
	});

	$effect(() => {
		clusterNameDraft = store.selectedCluster?.name ?? '';
	});

	// P23.4 — reset explicit repeat defaults when the selection changes. The
	// opening spacing defaults to width + gap; the room delta defaults to a
	// non-overlapping east placement (room AABB width + 1 m) so the Duplicate
	// button does not defeat itself on rooms wider than 1 m. Both auto-sync
	// while pristine (keyed on id + measured width, so widening the selected
	// record refreshes the default); a manual edit owns the field until the
	// next record is selected.
	$effect(() => {
		const opening = selectedWallFirstOpening;
		if (!opening) return;
		const key = `${opening.id}|${opening.width.toFixed(3)}`;
		if (key === lastDuplicateOpeningKey) return;
		const idChanged = lastDuplicateOpeningKey?.split('|')[0] !== opening.id;
		lastDuplicateOpeningKey = key;
		if (idChanged) {
			openingRepeatTouched = false;
			openingRepeatCount = 3;
		}
		if (!openingRepeatTouched) {
			openingRepeatSpacing = opening.width + WALL_OPENING_DUPLICATE_GAP_M;
		}
	});
	$effect(() => {
		const room = selectedPrecisionRoom;
		const layout = wallFirstLayout;
		if (!room || !layout) return;
		let minX = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		try {
			const pointsById = new Map(layout.junctions.map((junction) => [junction.id, junction.point]));
			const wallsById = new Map(layout.walls.map((wall) => [wall.id, wall]));
			for (const ref of room.boundary) {
				const wall = wallsById.get(ref.wallId);
				if (!wall) continue;
				for (const junctionId of [wall.startJunctionId, wall.endJunctionId]) {
					const point = pointsById.get(junctionId);
					if (!point) continue;
					if (point[0] < minX) minX = point[0];
					if (point[0] > maxX) maxX = point[0];
				}
			}
		} catch {
			minX = Number.POSITIVE_INFINITY;
			maxX = Number.NEGATIVE_INFINITY;
		}
		const width = Number.isFinite(minX) && Number.isFinite(maxX) ? maxX - minX : Number.NaN;
		const key = `${room.id}|${Number.isFinite(width) ? width.toFixed(3) : 'nan'}`;
		if (key === lastDuplicateRoomKey) return;
		const idChanged = lastDuplicateRoomKey?.split('|')[0] !== room.id;
		lastDuplicateRoomKey = key;
		if (idChanged) {
			roomDuplicateTouched = false;
			roomDuplicateDeltaZ = 0;
		}
		if (!roomDuplicateTouched) {
			roomDuplicateDeltaX = Number.isFinite(width) ? width + 1 : 10;
		}
	});

	function saveClusterName() {
		const cluster = store.selectedCluster;
		if (!cluster) return;
		const nextName = clusterNameDraft.trim();
		if (!nextName) {
			store.setStatusMessage('Cluster name cannot be empty');
			clusterNameInput?.focus();
			return;
		}
		if (nextName === cluster.name) return;
		if (store.renameCluster(cluster.id, nextName)) {
			clusterNameDraft = nextName;
			store.setStatusMessage(`Renamed cluster to ${nextName}`);
		}
	}

	function ungroupSelection() {
		const cluster = store.selectedCluster;
		if (!cluster || !store.ungroupCluster(cluster.id)) return;
		store.removeClusterTreeExpansion(cluster.id);
		store.setStatusMessage(`Ungrouped ${cluster.name}`);
	}

	async function groupSelection() {
		const clusterId = store.createCluster();
		if (!clusterId) return;
		const cluster = store.selectedCluster;
		if (cluster?.roomId !== undefined) store.ensureRoomTreeExpanded(cluster.roomId);
		store.ensureClusterTreeExpanded(clusterId);
		store.focusSelection();
		await tick();
		if (store.selectedClusterId !== clusterId) return;
		clusterNameInput?.focus();
		clusterNameInput?.select();
	}

	function onClusterNameKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		const cluster = store.selectedCluster;
		if (!cluster) return;
		event.preventDefault();
		event.stopPropagation();
		clusterNameDraft = cluster.name;
		clusterNameInput?.select();
	}

	function armOpeningTool(kind: 'door' | 'window') {
		if (isWallFirstLayout) {
			store.setStatusMessage('Opening placement is unavailable for wall-first layouts; use Architecture · exact.');
			return;
		}
		setLayoutDraftTool(layoutInteraction, kind);
	}

	// one layout mutation = one undo entry: begin → mutate → commit/cancel.
	function runLayoutMutationGuarded<T>(mutate: () => T, didSucceed: (result: T) => boolean) {
		return runLayoutMutation(layoutMutationRunnerFor(store, layoutPreview), mutate, didSucceed);
	}

	function updateOpeningField(field: 'offset' | 'width' | 'height' | 'sillHeight', event: Event) {
		const selection = layoutInteraction.selection;
		if (selection.kind !== 'opening' || !selectedLayoutOpening) return;
		const input = event.currentTarget as HTMLInputElement;
		const value = Number(input.value);
		if (!Number.isFinite(value)) {
			store.setStatusMessage('Opening value must be a finite number');
			input.value = String(selectedLayoutOpening[field]);
			return;
		}
		const outcome = runLayoutMutationGuarded(
			() => updateLayoutOpeningFields(layoutPreview, selection.roomId, selection.openingId, { [field]: value }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			input.value = String(selectedLayoutOpening[field]);
			return;
		}
		const result = outcome.result;
		if (!result.success) {
			store.setStatusMessage(`Opening rejected: ${result.message}`);
			input.value = String(selectedLayoutOpening[field]);
			return;
		}
		store.setStatusMessage(`Updated opening ${field}`);
	}

	/**
	 * P23.3 — one canonical Opening edit through the shared history runner:
	 * validate once → commit once, invalid/no-op → no history entry.
	 */
	function commitWallOpeningEdit(
		mutate: () => LayoutOpeningMutationResult,
		successMessage: string
	): boolean {
		const outcome = runLayoutMutationGuarded(mutate, (result) => result.success);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return false;
		}
		if (!outcome.result.success) {
			store.setStatusMessage(`Opening rejected: ${outcome.result.message}`);
			return false;
		}
		store.setStatusMessage(successMessage);
		return true;
	}

	function updateWallFirstOpeningField(
		field: 'offset' | 'width' | 'height' | 'sillHeight',
		event: Event
	) {
		const opening = selectedWallFirstOpening;
		if (!opening) return;
		const input = event.currentTarget as HTMLInputElement;
		const value = Number(input.value);
		if (!Number.isFinite(value)) {
			store.setStatusMessage('Opening value must be a finite number');
			input.value = String(opening[field]);
			return;
		}
		if (!commitWallOpeningEdit(
			() => updateWallFirstOpening(layoutPreview, opening.id, { [field]: value }),
			`Updated opening ${field}`
		)) {
			input.value = String(opening[field]);
		}
	}

	function updateWallFirstOpeningProfile(event: Event) {
		const opening = selectedWallFirstOpening;
		if (!opening) return;
		const profile = (event.currentTarget as HTMLSelectElement)
			.value as typeof opening.profile;
		commitWallOpeningEdit(
			() => updateWallFirstOpening(layoutPreview, opening.id, { profile }),
			'Updated opening profile'
		);
	}

	/**
	 * `door → window` clears the portal relation explicitly (never silently);
	 * `window → door` invents no relation.
	 */
	function updateWallFirstOpeningKind(event: Event) {
		const opening = selectedWallFirstOpening;
		if (!opening) return;
		const kind = (event.currentTarget as HTMLSelectElement).value as 'door' | 'window';
		const patch =
			kind === 'window' ? { kind, connectsRoomIds: null } : { kind };
		commitWallOpeningEdit(
			() => updateWallFirstOpening(layoutPreview, opening.id, patch),
			`Updated opening type to ${kind}`
		);
	}

	function centerSelectedWallFirstOpening() {
		const opening = selectedWallFirstOpening;
		if (!opening) return;
		commitWallOpeningEdit(
			() => centerWallFirstOpening(layoutPreview, opening.id),
			'Centered opening on wall'
		);
	}

	function updateWallFirstOpeningDistanceFromStart(event: Event) {
		const opening = selectedWallFirstOpening;
		const input = event.currentTarget as HTMLInputElement;
		const value = Number(input.value);
		if (!opening || !Number.isFinite(value)) return;
		commitWallOpeningEdit(
			() =>
				updateWallFirstOpening(layoutPreview, opening.id, {
					offset: wallFirstOffsetFromStartDistance(value)
				}),
			'Updated opening position'
		);
	}

	function updateWallFirstOpeningDistanceFromEnd(event: Event) {
		const opening = selectedWallFirstOpening;
		const metrics = selectedWallFirstOpeningMetrics;
		const input = event.currentTarget as HTMLInputElement;
		const value = Number(input.value);
		if (!opening || !metrics || !Number.isFinite(value)) return;
		commitWallOpeningEdit(
			() =>
				updateWallFirstOpening(layoutPreview, opening.id, {
					offset: wallFirstOffsetFromEndDistance(metrics, value)
				}),
			'Updated opening position'
		);
	}

	function updateWallFirstOpeningRelation(event: Event) {
		const opening = selectedWallFirstOpening;
		if (!opening) return;
		const value = (event.currentTarget as HTMLSelectElement).value;
		if (value === '') {
			commitWallOpeningEdit(
				() => updateWallFirstOpening(layoutPreview, opening.id, { connectsRoomIds: null }),
				'Cleared opening portal relation'
			);
			return;
		}
		const [first, second] = value.split('|');
		if (!first || !second) return;
		commitWallOpeningEdit(
			() =>
				updateWallFirstOpening(layoutPreview, opening.id, {
					connectsRoomIds: [first, second]
				}),
			'Updated opening portal relation'
		);
	}

	function removeSelectedWallFirstOpening() {
		const opening = selectedWallFirstOpening;
		if (!opening) return;
		if (commitWallOpeningEdit(
			() => deleteWallFirstOpening(layoutPreview, opening.id),
			'Deleted opening'
		)) {
			// No canonical wall selection target yet (cutover deferred) → clear.
			layoutInteraction.selection = { kind: 'none' };
		}
	}

	// -----------------------------------------------------------------------
	// P23.4 — duplicate and linear repeat (one command → one history entry;
	// a rejected batch restores the prior selection and writes no history).
	// -----------------------------------------------------------------------

	/** Shared runner: one guarded layout mutation with a status surface. */
	function commitDuplicateEdit(
		mutate: () => WallFirstDuplicateMutationResult,
		successMessage: (result: Extract<WallFirstDuplicateMutationResult, { success: true }>) => string
	): Extract<WallFirstDuplicateMutationResult, { success: true }> | null {
		const outcome = runLayoutMutationGuarded(mutate, (result) => result.success);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return null;
		}
		if (!outcome.result.success) {
			store.setStatusMessage(`Duplicate rejected: ${outcome.result.message}`);
			return null;
		}
		store.setStatusMessage(successMessage(outcome.result));
		return outcome.result;
	}

	/** Duplicate the selected layout object (one copy at the explicit X/Z delta). */
	function duplicateSelectedLayoutObject() {
		const object = selectedLayoutObject;
		if (!object || object.kind === 'profile') return;
		const committed = commitDuplicateEdit(
			() => repeatWallFirstObject(layoutPreview, {
				objectId: object.id,
				count: 1,
				delta: [objectRepeatDeltaX, objectRepeatDeltaZ]
			}),
			(result) => `Duplicated object · ${result.createdObjectIds[0] ?? ''}`
		);
		// Select the first new copy; a failed batch restores prior selection.
		if (committed?.createdObjectIds[0]) {
			selectLayoutObject(layoutInteraction, committed.createdObjectIds[0]);
		}
	}

	/** Linear repeat of the selected layout object (explicit count × delta). */
	function repeatSelectedLayoutObject() {
		const object = selectedLayoutObject;
		if (!object || object.kind === 'profile') return;
		commitDuplicateEdit(
			() => repeatWallFirstObject(layoutPreview, {
				objectId: object.id,
				count: objectRepeatCount,
				delta: [objectRepeatDeltaX, objectRepeatDeltaZ]
			}),
			(result) => `Repeated object × ${result.createdObjectIds.length}`
		);
	}

	/** Duplicate the selected canonical Opening (one copy beside the source). */
	function duplicateSelectedWallOpening() {
		const opening = selectedWallFirstOpening;
		if (!opening) return;
		const committed = commitDuplicateEdit(
			() => repeatWallFirstOpening(layoutPreview, {
				openingId: opening.id,
				count: 1,
				spacing: opening.width + WALL_OPENING_DUPLICATE_GAP_M
			}),
			(result) => `Duplicated opening · ${result.createdOpeningIds[0] ?? ''}`
		);
		// Select the first new copy through the canonical wallOpening
		// authority; a failed batch keeps the prior selection.
		if (committed?.createdOpeningIds[0]) {
			selectLayoutWallOpening(layoutInteraction, opening.wallId, committed.createdOpeningIds[0]);
		}
	}

	/** Linear repeat of the selected canonical Opening (explicit count × spacing). */
	function repeatSelectedWallOpening() {
		const opening = selectedWallFirstOpening;
		if (!opening) return;
		commitDuplicateEdit(
			() => repeatWallFirstOpening(layoutPreview, {
				openingId: opening.id,
				count: openingRepeatCount,
				spacing: openingRepeatSpacing
			}),
			(result) => `Repeated opening × ${result.createdOpeningIds.length}`
		);
	}

	/** Duplicate the selected isolated Room (explicit creator-supplied X/Z delta). */
	function duplicateSelectedPrecisionRoom() {
		const room = selectedPrecisionRoom;
		if (!room) return;
		const committed = commitDuplicateEdit(
			() => duplicateWallFirstRoom(layoutPreview, {
				roomId: room.id,
				delta: [roomDuplicateDeltaX, roomDuplicateDeltaZ]
			}),
			(result) => `Duplicated room · ${result.createdRoomId ?? ''}`
		);
		if (!committed) return;
		// A failed operation restores prior selection; success selects the
		// new Room through the ONE canonical selection authority (the retired
		// `precisionTarget` seed is gone).
		if (committed.createdRoomId) {
			if (selectedWallFirstRoom?.id !== committed.createdRoomId) {
				precisionRectangleAnchor = null;
				precisionRectangleWidthWall = null;
			}
			selectLayoutRoom(layoutInteraction, committed.createdRoomId);
		}
	}

	function updateOpeningProfile(event: Event) {
		const selection = layoutInteraction.selection;
		if (selection.kind !== 'opening' || !selectedLayoutOpening) return;
		const profile = (event.currentTarget as HTMLSelectElement).value as typeof selectedLayoutOpening.profile;
		const outcome = runLayoutMutationGuarded(
			() => updateLayoutOpeningFields(layoutPreview, selection.roomId, selection.openingId, { profile }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) store.setStatusMessage(`Opening rejected: ${outcome.result.message}`);
	}

	function removeSelectedOpening() {
		const selection = layoutInteraction.selection;
		if (selection.kind !== 'opening') return;
		const outcome = runLayoutMutationGuarded(
			() => deleteLayoutOpening(layoutPreview, selection.roomId, selection.openingId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) {
			store.setStatusMessage(`Opening delete failed: ${outcome.result.message}`);
			return;
		}
		layoutInteraction.selection = { kind: 'wall', roomId: selection.roomId, segmentId: selection.segmentId };
		store.setStatusMessage('Deleted opening');
	}

	function updateRoomName(event: Event) {
		if (!selectedLayoutRoom) return;
		const input = event.currentTarget as HTMLInputElement;
		const roomId = selectedLayoutRoom.id;
		const outcome = runLayoutMutationGuarded(
			() => updateLayoutRoomFields(layoutPreview, roomId, { name: input.value }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			input.value = selectedLayoutRoom.name;
			return;
		}
		const committed = layoutPreview.project.layout.floors
			.flatMap((floor) => floor.rooms)
			.find((room) => room.id === roomId);
		input.value = committed?.name ?? selectedLayoutRoom.name;
		store.setStatusMessage(outcome.result.success ? 'Updated room name' : `Room rejected: ${outcome.result.message}`);
	}

	function rotateSelectedRoom(event: Event) {
		if (!selectedLayoutRoom) return;
		const input = event.currentTarget as HTMLInputElement;
		const degrees = Number(input.value);
		input.value = '0';
		if (!Number.isFinite(degrees)) {
			store.setStatusMessage('Rotation must be finite');
			return;
		}
		if (Math.abs(degrees) <= 1e-9) return;
		const outcome = runLayoutMutationGuarded(
			() => previewLayoutRoomUnit(layoutPreview, selectedLayoutRoom.id, {
				translation: [0, 0],
				yaw: (degrees * Math.PI) / 180
			}),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) {
			store.setStatusMessage(`Room rotation rejected: ${outcome.result.message}`);
			return;
		}
		store.setStatusMessage(`Rotated room by ${degrees}°`);
	}

	function updateRoomNumber(field: keyof LayoutRoomFieldPatch, event: Event) {
		if (!selectedLayoutRoom || !selectedLayoutFloor) return;
		const input = event.currentTarget as HTMLInputElement;
		const value = Number(input.value);
		const previous = field === 'floorHeight' ? selectedLayoutFloor.height : selectedLayoutRoom[field];
		if (!Number.isFinite(value)) {
			input.value = String(previous);
			store.setStatusMessage('Layout value must be finite');
			return;
		}
		const outcome = runLayoutMutationGuarded(
			() => updateLayoutRoomFields(layoutPreview, selectedLayoutRoom.id, { [field]: value }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			input.value = String(previous);
			return;
		}
		if (!outcome.result.success) input.value = String(previous);
		store.setStatusMessage(outcome.result.success ? `Updated ${field}` : `Room rejected: ${outcome.result.message}`);
	}

	// P10 — editable Plan X/Z/yaw for layout objects (plan §Inspector and
	// hierarchy), routed through the existing Layout mutation pipeline in one
	// `layout` transaction. Rejected values stay rejected: the field re-syncs
	// from the model prop on the next render.
	function updateObjectVector(field: 'position' | 'rotation', index: 0 | 1 | 2, value: number): void {
		if (!selectedLayoutObject || selectedLayoutObject.kind === 'profile') return;
		if (!Number.isFinite(value)) {
			store.setStatusMessage('Layout value must be finite');
			return;
		}
		const vector = [...selectedLayoutObject[field]] as [number, number, number];
		vector[index] = value;
		const outcome = runLayoutMutationGuarded(
			() => updateLayoutObjectFields(layoutPreview, selectedLayoutObject.id, { [field]: vector }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(outcome.result.success ? `Updated object ${field}` : `Object rejected: ${outcome.result.message}`);
	}

	function updateObjectPosition(index: 0 | 2, value: number): void {
		updateObjectVector('position', index, value);
	}

	// P23.2 — bounded alignment: one selected Layout object → one explicit
	// reference through the pure planner + the existing one-transaction
	// mutation runner. Reference picking never touches canonical selection and
	// a no-op adds no history (the planner rejects before any mutation).
	type AlignReferenceOption = AlignReference & { label: string };

	const alignObjectOptions = $derived.by<AlignReferenceOption[]>(() => {
		if (!selectedLayoutObject || selectedLayoutObject.kind === 'profile') return [];
		return layoutPreview.project.layout.objects
			.filter((object) => object.id !== selectedLayoutObject.id && object.kind !== 'profile')
			// D6 — the option states the display label, not the raw content ID; the
			// picked `id` stays the raw reference key the planner consumes.
			.map((object) => ({ kind: 'object' as const, id: object.id, label: `${object.kind} · ${formatPlacementLabel(object.id)}` }));
	});

	const alignRoomOptions = $derived.by<AlignReferenceOption[]>(() => {
		if (!selectedLayoutObject?.roomId) return [];
		return [{ kind: 'room' as const, id: selectedLayoutObject.roomId, label: `Room bounds · ${formatPlacementLabel(selectedLayoutObject.roomId)}` }];
	});

	const alignWallOptions = $derived.by<AlignReferenceOption[]>(() => {
		if (!selectedLayoutObject?.roomId) return [];
		const room = layoutRooms.find((candidate) => candidate.id === selectedLayoutObject.roomId);
		if (!room) return [];
		return room.boundary.segments.map((segment) => ({
			kind: 'wall' as const,
			id: segment.id,
			label: `Wall · ${formatPlacementLabel(segment.id)}`
		}));
	});

	const alignReferenceOptions = $derived(
		[...alignObjectOptions, ...alignRoomOptions, ...alignWallOptions]
	);

	let alignReferenceId = $state('');

	// P23.4 — explicit creator-supplied duplicate/repeat inputs (plan input
	// contract: object X/Z delta + count, opening count + spacing, room X/Z
	// delta). Defaults reset per selection (see effects below); the domain
	// still validates every value and rejects the whole batch on any invalid
	// copy.
	let objectRepeatCount = $state(3);
	let objectRepeatDeltaX = $state(1);
	let objectRepeatDeltaZ = $state(0);
	let openingRepeatCount = $state(3);
	let openingRepeatSpacing = $state(1.1);
	let roomDuplicateDeltaX = $state(10);
	let roomDuplicateDeltaZ = $state(0);
	let lastDuplicateOpeningKey: string | null = null;
	let lastDuplicateRoomKey: string | null = null;
	let openingRepeatTouched = false;
	let roomDuplicateTouched = false;

	const activeAlignReference = $derived.by<AlignReferenceOption | null>(() => {
		if (alignReferenceOptions.length === 0) return null;
		// Match on the collision-safe `kind:id` key — IDs are only unique
		// inside each collection, so an object `foo` and a wall `foo` must
		// not collapse to the first option.
		return (
			alignReferenceOptions.find((option) => alignReferenceKey(option) === alignReferenceId) ??
			alignReferenceOptions[0]!
		);
	});

	function alignSelectedObject(action: AlignAction, axis: AlignAxis = 'x'): void {
		if (!selectedLayoutObject || selectedLayoutObject.kind === 'profile') return;
		const reference = activeAlignReference;
		if (!reference) {
			store.setStatusMessage('No alignment reference available');
			return;
		}
		const plan = planLayoutObjectAlign(
			layoutPreview.geometry,
			selectedLayoutObject.id,
			reference,
			action,
			axis
		);
		if (plan.kind === 'rejected') {
			store.setStatusMessage(
				plan.code === 'no_op' ? 'Already aligned — no change recorded' : `Align rejected: ${plan.message}`
			);
			return;
		}
		const outcome = runLayoutMutationGuarded(
			() => updateLayoutObjectFields(layoutPreview, selectedLayoutObject.id, { position: plan.position }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(outcome.result.success ? 'Aligned object' : `Align rejected: ${outcome.result.message}`);
	}

	function updateObjectYaw(value: number): void {
		updateObjectVector('rotation', 1, degreesToRadians(value));
	}

	function commitStagingTransform(next: PlacementTransform): void {
		const id = store.selectedPlacementId;
		if (!stagingSingleTransform || !id) return;
		if (store.commitPlacementTransform(id, next)) store.setStatusMessage('Updated staged object');
	}

	function updateStagingPosition(index: 0 | 2, value: number): void {
		const transform = stagingSingleTransform;
		if (!transform) return;
		const position = [...transform.position] as typeof transform.position;
		position[index] = value;
		commitStagingTransform({
			...transform,
			position,
			rotation: [...transform.rotation]
		});
	}

	function updateStagingYaw(degrees: number): void {
		const transform = stagingSingleTransform;
		if (!transform) return;
		const rotation = [...transform.rotation] as typeof transform.rotation;
		rotation[1] = degreesToRadians(degrees);
		commitStagingTransform({
			...transform,
			position: [...transform.position],
			rotation
		});
	}

	function deleteStagingSelection(): void {
		if (stagingTransformAvailable) store.deleteSelection();
	}

	function armLayoutPlaceTool(tool: 'door' | 'window' | LayoutPrimitiveTool | LayoutPresetTool) {
		// P23.3 — a wall-first document hosts canonical Openings, so the
		// door/window place tools arm for it and author against a
		// document-global `wallId`; only the legacy room-owned primitives stay
		// unavailable (they have no canonical counterpart yet).
		const preset = isLayoutPresetTool(tool);
		// P23.5 — presets are wall-first-only creation defaults over ordinary
		// LayoutObject kinds (no Room containment, no preset metadata).
		if (preset && !isWallFirstLayout) {
			store.setStatusMessage('Column, Platform and Plinth placement requires a wall-first layout.');
			return;
		}
		if (preset && layoutInteraction.viewMode !== 'plan') {
			store.setStatusMessage('Preset placement is Plan-only');
			return;
		}
		const primitive = tool === 'box' || tool === 'cylinder' || tool === 'sphere';
		if (primitive && isWallFirstLayout) {
			store.setStatusMessage('Legacy primitive placement is unavailable for wall-first layouts; use Architecture · exact.');
			return;
		}
		if (primitive && layoutInteraction.viewMode !== 'plan') {
			store.setStatusMessage('Primitive placement is Plan-only');
			return;
		}
		layoutInteraction.accordions.place = true;
		setLayoutDraftTool(layoutInteraction, tool);
	}

	function selectListedLayoutObject(objectId: string) {
		selectLayoutObject(layoutInteraction, objectId);
		setLayoutDraftTool(layoutInteraction, 'select');
		if (!layoutInteraction.accordions.selection) toggleLayoutAccordion(layoutInteraction, 'selection');
	}

	function updateObjectMetric(
		metric: 'width' | 'depth' | 'height' | 'radius',
		event: Event
	) {
		if (!selectedLayoutObject || selectedLayoutObject.kind === 'profile' || selectedLayoutObject.kind === 'plane') return;
		const input = event.currentTarget as HTMLInputElement;
		const value = Number(input.value);
		if (!Number.isFinite(value) || value <= 0) {
			input.value = String(metric === 'radius' ? selectedLayoutObject.dimensions[0] / 2 : metric === 'width' ? selectedLayoutObject.dimensions[0] : metric === 'depth' ? selectedLayoutObject.dimensions[2] : selectedLayoutObject.dimensions[1]);
			return;
		}
		const dimensions = [...selectedLayoutObject.dimensions] as [number, number, number];
		if (metric === 'width') dimensions[0] = value;
		if (metric === 'depth') dimensions[2] = value;
		if (metric === 'height') dimensions[1] = value;
		if (metric === 'radius') {
			dimensions[0] = value * 2;
			dimensions[2] = value * 2;
		}
		const outcome = runLayoutMutationGuarded(
			() => updateLayoutObjectFields(layoutPreview, selectedLayoutObject.id, { dimensions }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			input.value = String(metric === 'radius' ? selectedLayoutObject.dimensions[0] / 2 : metric === 'width' ? selectedLayoutObject.dimensions[0] : metric === 'depth' ? selectedLayoutObject.dimensions[2] : selectedLayoutObject.dimensions[1]);
			return;
		}
		if (!outcome.result.success) input.value = String(metric === 'radius' ? selectedLayoutObject.dimensions[0] / 2 : metric === 'width' ? selectedLayoutObject.dimensions[0] : metric === 'depth' ? selectedLayoutObject.dimensions[2] : selectedLayoutObject.dimensions[1]);
		store.setStatusMessage(outcome.result.success ? `Updated object ${metric}` : `Object rejected: ${outcome.result.message}`);
	}

	function updateObjectRoom(event: Event) {
		if (!selectedLayoutObject || selectedLayoutObject.kind === 'profile') return;
		const roomId = (event.currentTarget as HTMLSelectElement).value || undefined;
		const outcome = runLayoutMutationGuarded(
			() => updateLayoutObjectFields(layoutPreview, selectedLayoutObject.id, { roomId }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(outcome.result.success ? 'Updated object room' : `Object rejected: ${outcome.result.message}`);
	}

	function removeLayoutObject(objectId: string) {
		const outcome = runLayoutMutationGuarded(
			() => deleteLayoutObject(layoutPreview, objectId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (outcome.result.success && selectedLayoutObjectId === objectId) layoutInteraction.selection = { kind: 'none' };
		store.setStatusMessage(outcome.result.success ? 'Deleted layout object' : `Object delete failed: ${outcome.result.message}`);
	}

	function removeSelectedObject() {
		if (selectedLayoutObject) removeLayoutObject(selectedLayoutObject.id);
	}

	// room deletion is blocked while any scene content (entities,
	// clusters, camera nodes, path anchors, waypoints, view keyframes)
	// references the room. The blocker reads the store's authoritative scene
	// document (the layout preview's `project.scene` is a boot-time copy).
	const roomDeleteReferences = $derived(
		selectedLayoutRoom
			? listLayoutRoomSceneReferences(store.document, selectedLayoutRoom.id)
			: null
	);
	const roomDeleteBlocked = $derived(
		Boolean(roomDeleteReferences && layoutRoomSceneReferenceTotal(roomDeleteReferences) > 0)
	);

	/**
	 * P23.6d — canonical Room metadata edits. The Room survives the edit, so
	 * canonical selection is preserved (the Inspector stay continues: rename →
	 * thickness without the panel disappearing).
	 */
	function updateWallFirstRoomName(event: Event) {
		const room = selectedWallFirstRoom;
		if (!room) return;
		const input = event.currentTarget as HTMLInputElement;
		const previous = room.name;
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstRoomMetadata(layoutPreview, room.id, { name: input.value }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			input.value = previous;
			return;
		}
		if (!outcome.result.success) {
			input.value = previous;
			store.setStatusMessage(`Room rejected: ${outcome.result.message}`);
			return;
		}
		store.setStatusMessage('Updated room name');
	}

	function updateWallFirstRoomThickness(
		field: 'floorThickness' | 'ceilingThickness',
		event: Event
	) {
		const room = selectedWallFirstRoom;
		if (!room) return;
		const input = event.currentTarget as HTMLInputElement;
		const previous = room[field];
		const value = Number(input.value);
		if (!Number.isFinite(value)) {
			input.value = String(previous);
			store.setStatusMessage('Layout value must be finite');
			return;
		}
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstRoomMetadata(layoutPreview, room.id, { [field]: value }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			input.value = String(previous);
			return;
		}
		if (!outcome.result.success) input.value = String(previous);
		store.setStatusMessage(
			outcome.result.success ? `Updated ${field}` : `Room rejected: ${outcome.result.message}`
		);
	}

	/**
	 * P23.6d — canonical Room removal: the Room and its exclusive enclosure
	 * Walls are removed in one atomic operation while shared physical Walls
	 * required by adjacent Rooms survive, so the Room retires through P23.8
	 * reconciliation. Success clears the canonical selection to `none` (the
	 * Room is gone — never a dangling `roomId`, never a nearest survivor).
	 */
	function removeSelectedWallFirstRoom() {
		const room = selectedWallFirstRoom;
		if (!room) return;
		if (selectedWallFirstRoomExclusiveWalls.length === 0) {
			store.setStatusMessage(
				'Every boundary wall is shared with a neighbouring room; delete a shared wall instead'
			);
			return;
		}
		const outcome = runLayoutMutationGuarded(
			() => removeWallFirstRoom(layoutPreview, room.id, store.document),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) {
			store.setStatusMessage(`Room remove failed: ${outcome.result.message}`);
			return;
		}
		layoutInteraction.selection = { kind: 'none' };
		store.setStatusMessage('Removed room');
	}

	function removeSelectedRoom() {
		if (!selectedLayoutRoom) return;
		const outcome = runLayoutMutationGuarded(
			() => deleteLayoutRoom(layoutPreview, selectedLayoutRoom.id, store.document),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) {
			store.setStatusMessage(`Room delete failed: ${outcome.result.message}`);
			return;
		}
		layoutInteraction.selection = { kind: 'none' };
		store.setStatusMessage('Deleted room');
	}

	function precisionNumber(
		event: Event,
		fallback: number,
		format: (value: number) => string = String
	): number | null {
		const input = event.currentTarget as HTMLInputElement;
		const parsed = parseExactNumber(input.value, fallback, format);
		if (!parsed.ok) {
			input.value = parsed.display;
			store.setStatusMessage(
				parsed.reason === 'blank' ? 'Exact value is blank' : 'Exact value must be finite'
			);
			return null;
		}
		return parsed.value;
	}

	/**
	 * P23.6 — exact edits for the Plan-selected canonical Wall. Same guarded
	 * single-transaction path as Architecture · exact; the input restores on
	 * rejection and only rejections message the status bar.
	 */
	function updateSelectedWallLength(event: Event): void {
		const wall = selectedWallFirstWall;
		const endpoints = selectedWallFirstWallEndpoints;
		if (!wall || !endpoints) return;
		const previous = endpoints.length;
		const value = precisionNumber(event, previous, formatMeters);
		if (value === null) return;
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstWallLength(layoutPreview, wall.id, value, precisionFixedEndpoint),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			(event.currentTarget as HTMLInputElement).value = formatMeters(previous);
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) (event.currentTarget as HTMLInputElement).value = formatMeters(previous);
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wallIdentityText(layoutDocument, wall.id)} length` : `Wall rejected: ${outcome.result.message}`);
	}

	function updateSelectedWallAngle(event: Event): void {
		const wall = selectedWallFirstWall;
		const endpoints = selectedWallFirstWallEndpoints;
		if (!wall || !endpoints) return;
		const previous = endpoints.angleDegrees;
		const value = precisionNumber(event, previous, formatDegrees);
		if (value === null) return;
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstWallAngle(layoutPreview, wall.id, degreesToRadians(value), precisionFixedEndpoint),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			(event.currentTarget as HTMLInputElement).value = formatDegrees(previous);
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) (event.currentTarget as HTMLInputElement).value = formatDegrees(previous);
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wallIdentityText(layoutDocument, wall.id)} angle` : `Wall rejected: ${outcome.result.message}`);
	}

	function updateSelectedWallThickness(event: Event): void {
		const wall = selectedWallFirstWall;
		if (!wall) return;
		const previous = wall.thickness;
		const value = precisionNumber(event, previous, formatMeters);
		if (value === null) return;
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstWallThickness(layoutPreview, wall.id, value),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			(event.currentTarget as HTMLInputElement).value = formatMeters(previous);
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) (event.currentTarget as HTMLInputElement).value = formatMeters(previous);
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wallIdentityText(layoutDocument, wall.id)} thickness` : `Wall rejected: ${outcome.result.message}`);
	}

	/**
	 * P23.6H — authoritative physical Wall height. Same pattern as Thickness:
	 * blank input rejects before the planner runs, and the planner (not the
	 * input) owns the Floor envelope and hosted-Opening fit. A rejected or
	 * skipped edit restores the previous value and writes no history.
	 */
	function updateSelectedWallHeight(event: Event): void {
		const wall = selectedWallFirstWall;
		if (!wall) return;
		const previous = wall.height;
		const value = precisionNumber(event, previous, formatMeters);
		if (value === null) return;
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstWallHeight(layoutPreview, wall.id, value),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			(event.currentTarget as HTMLInputElement).value = formatMeters(previous);
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) (event.currentTarget as HTMLInputElement).value = formatMeters(previous);
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wallIdentityText(layoutDocument, wall.id)} height` : `Wall rejected: ${outcome.result.message}`);
	}

	/**
	 * P23.6 — exact subdivision of the selected canonical Wall (identical
	 * planner and guarded transaction as the retired "Architecture · exact"
	 * control; re-homed onto the canonical Wall panel by P23.6b).
	 *
	 * P23.10 — the command addresses canonical Junctions, so it is labelled and
	 * reported with Junction language; the planner is unchanged and shares its
	 * acceptance path with the direct Add-junction gesture.
	 */
	function addSelectedWallJunction(event: Event): void {
		const wall = selectedWallFirstWall;
		const endpoints = selectedWallFirstWallEndpoints;
		if (!wall || !endpoints) return;
		const fallback = endpoints.length / 2;
		const value = precisionNumber(event, fallback);
		if (value === null) return;
		const outcome = runLayoutMutationGuarded(
			() => subdivideWallFirstWall(layoutPreview, wall.id, value),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(outcome.result.success ? `Added junction to Wall ${wallIdentityText(layoutDocument, wall.id)}` : `Add junction rejected: ${outcome.result.message}`);
	}

	/**
	 * P23.6 — Defines room boundary: checked → `boundary` (participates in
	 * Room face extraction), unchecked → `partition` (physical Wall remains,
	 * stops dividing Rooms). Runs the canonical role-change operation
	 * (topology/reconciliation + one history transaction), never a direct
	 * field assignment; the checkbox reverts when the operation rejects.
	 */
	function updateSelectedWallRole(event: Event): void {
		const wall = selectedWallFirstWall;
		if (!wall) return;
		const input = event.currentTarget as HTMLInputElement;
		const role = input.checked ? 'boundary' : 'partition';
		if (wall.role === role) return;
		const outcome = runLayoutMutationGuarded(
			() => commitWallRoleChange(layoutPreview, wall.id, role),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			input.checked = wall.role === 'boundary';
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) input.checked = wall.role === 'boundary';
		store.setStatusMessage(
			outcome.result.success
				? `Wall ${wallIdentityText(layoutDocument, wall.id)} ${role === 'boundary' ? 'defines' : 'no longer defines'} a room boundary`
				: `Wall role rejected: ${outcome.result.message}`
		);
	}

	/**
	 * P23.11 — the selected Wall's own curve, through the same canonical
	 * planners the Plan control gesture calls (one operation = one history
	 * entry). Converting plants one control on the exact chord midpoint, so the
	 * Wall keeps its length, direction and every hosted Opening offset until a
	 * control is actually moved; deleting the last control converts back to a
	 * straight Wall rather than leaving an anchor-less curve.
	 */
	function setSelectedWallCurved(curved: boolean): void {
		const wall = selectedWallFirstWall;
		if (!wall) return;
		const outcome = runLayoutMutationGuarded(
			() =>
				curved
					? updateWallFirstWallCurve(layoutPreview, wall.id)
					: updateWallFirstWallLine(layoutPreview, wall.id),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(
			outcome.result.success
				? curved
					? `Wall ${wallIdentityText(layoutDocument, wall.id)} is now curved`
					: `Wall ${wallIdentityText(layoutDocument, wall.id)} is now straight`
				: `Wall curve rejected: ${outcome.result.message}`
		);
	}

	/**
	 * Add one bend point at the Wall's physical ARC midpoint. The distance is the
	 * only input: the planner resolves it against the canonical chain and inserts
	 * at the exact de Casteljau cut, so the Wall keeps its shape and nothing is
	 * re-derived here.
	 */
	function addSelectedWallCurveKnot(): void {
		const wall = selectedWallFirstWall;
		if (!wall) return;
		const compiled = layoutPreview.geometry.walls.find((candidate) => candidate.wallId === wall.id);
		if (!compiled || !(compiled.length > 0)) {
			store.setStatusMessage('Wall centerline is unavailable');
			return;
		}
		const outcome = runLayoutMutationGuarded(
			() => insertWallFirstWallCurveKnot(layoutPreview, wall.id, compiled.length / 2),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(
			outcome.result.success
				? `Added a bend point to Wall ${wallIdentityText(layoutDocument, wall.id)}`
				: `Add bend point rejected: ${outcome.result.message}`
		);
	}

	function updateSelectedWallCurveKnot(knotId: string, index: 0 | 1, event: Event): void {
		const wall = selectedWallFirstWall;
		const knot = selectedWallFirstWallKnots.find((candidate) => candidate.id === knotId);
		if (!wall || !knot) return;
		const knotIndex = selectedWallFirstWallKnots.indexOf(knot);
		const previous = knot.point[index];
		const value = precisionNumber(event, previous, formatMeters);
		if (value === null) return;
		const point = [...knot.point] as [number, number];
		point[index] = value;
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstWallCurveKnot(layoutPreview, wall.id, knotId, point),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			(event.currentTarget as HTMLInputElement).value = formatMeters(previous);
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) (event.currentTarget as HTMLInputElement).value = formatMeters(previous);
		// Captured before the mutation: the ordinal belongs to the chain the user
		// acted on, not to whatever the planner leaves behind.
		store.setStatusMessage(
			outcome.result.success
				? `Moved ${bendPointLabelAt(knotIndex).toLowerCase()}`
				: `Bend point rejected: ${outcome.result.message}`
		);
	}

	function deleteSelectedWallCurveKnot(knotId: string): void {
		const wall = selectedWallFirstWall;
		if (!wall) return;
		// Both facts the message reports on are read BEFORE the mutation. Reading
		// them afterwards is wrong twice over: the deleted knot is gone from the
		// chain, so its ordinal cannot resolve, and the remaining count is one
		// lower — a Wall with two bend points would announce that it has none
		// left after removing one.
		const knotIndex = selectedWallFirstWallKnots.findIndex((knot) => knot.id === knotId);
		const knotsBefore = selectedWallFirstWallKnots.length;
		const outcome = runLayoutMutationGuarded(
			() => deleteWallFirstWallCurveKnot(layoutPreview, wall.id, knotId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(
			outcome.result.success
				? knotsBefore <= 1
					? `Wall ${wallIdentityText(layoutDocument, wall.id)} has no bend points left`
					: `Removed ${knotIndex >= 0 ? bendPointLabelAt(knotIndex).toLowerCase() : 'bend point'}`
				: `Remove bend point rejected: ${outcome.result.message}`
		);
	}

	/**
	 * P23.6c — canonical Wall delete through the same planner-backed adapter
	 * the viewport Delete/Backspace path calls (one operation = one history
	 * entry). A rejection installs nothing; success clears the canonical
	 * selection to `none` (the fixed post-delete policy — never a
	 * nearest-survivor and never a dangling `wallId`).
	 */
	function deleteSelectedWallFirstWall(): void {
		const wall = selectedWallFirstWall;
		if (!wall) return;
		const outcome = runLayoutMutationGuarded(
			() => deleteWallFirstWall(layoutPreview, wall.id),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (outcome.result.success) layoutInteraction.selection = { kind: 'none' };
		store.setStatusMessage(outcome.result.success ? 'Deleted wall' : `Wall delete failed: ${outcome.result.message}`);
	}

	/**
	 * P23.14 §13 — the Inspector's Junction-dissolve entry point. It calls the
	 * SAME planner-backed adapter the Plan Delete-key path and the Navigator row
	 * call (`dissolveWallFirstJunction`), so the shell finish adds a surface and
	 * never a second dissolve implementation. Post-dissolve selection is the
	 * shared fixed `none` policy; a refusal keeps the document and the status
	 * message honest.
	 */
	function dissolveSelectedJunction(): void {
		const junction = selectedWallFirstJunction;
		if (!junction) return;
		const outcome = runLayoutMutationGuarded(
			() => dissolveWallFirstJunction(layoutPreview, junction.id),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (outcome.result.success) layoutInteraction.selection = { kind: 'none' };
		store.setStatusMessage(
			outcome.result.success
				? 'Dissolved junction'
				: `Junction dissolve failed: ${outcome.result.message}`
		);
	}

	/**
	 * P23.14 §13 — the core planner's own refusal reason for the selected
	 * Junction (`null` when it would accept). Read-only: the query never writes
	 * `lastMutationMessage`, so simply selecting a Junction states the truth
	 * without pretending an action ran.
	 */
	const junctionDissolveRefusal = $derived(
		selectedWallFirstJunction
			? wallFirstJunctionDissolveRefusal(layoutPreview, selectedWallFirstJunction.id)
			: null
	);

	function updateSelectedJunction(index: 0 | 1, event: Event): void {
		const junction = selectedWallFirstJunction;
		if (!junction) return;
		const previous = junction.point[index];
		const value = precisionNumber(event, previous, formatMeters);
		if (value === null) return;
		const point = [...junction.point] as [number, number];
		point[index] = value;
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstJunction(layoutPreview, junction.id, point),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			(event.currentTarget as HTMLInputElement).value = formatMeters(previous);
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) (event.currentTarget as HTMLInputElement).value = formatMeters(previous);
		store.setStatusMessage(outcome.result.success ? `Updated Junction ${junctionIdentityText(layoutDocument, junction.id)}` : `Junction rejected: ${outcome.result.message}`);
	}

	/** P23.6 — focus a diagnostic's affected source on the one selection authority. */
	function selectDiagnosticTarget(targetId: string): void {
		if (!wallFirstLayout) return;
		if (wallFirstLayout.walls.some((wall) => wall.id === targetId)) {
			selectLayoutPhysicalWall(layoutInteraction, targetId);
			return;
		}
		if (wallFirstLayout.junctions.some((junction) => junction.id === targetId)) {
			selectLayoutJunction(layoutInteraction, targetId);
		}
	}

	function updatePrecisionRectangle(metric: 'width' | 'depth', event: Event): void {
		const room = selectedPrecisionRoom;
		const rectangle = selectedPrecisionRectangle;
		if (!room || !rectangle) return;
		const previous = metric === 'width' ? rectangle.width : rectangle.depth;
		const value = precisionNumber(event, previous);
		if (value === null) return;
		const outcome = runLayoutMutationGuarded(
			() => updateWallFirstRectangle(layoutPreview, room.id, metric === 'width' ? value : rectangle.width, metric === 'depth' ? value : rectangle.depth, {
				...(precisionRectangleAnchor ? { anchorJunctionId: precisionRectangleAnchor } : {}),
				...(precisionRectangleWidthWall ? { widthWallId: precisionRectangleWidthWall } : {})
			}),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			(event.currentTarget as HTMLInputElement).value = String(previous);
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (!outcome.result.success) (event.currentTarget as HTMLInputElement).value = String(previous);
		store.setStatusMessage(outcome.result.success ? `Updated Room ${roomIdentityText(layoutDocument, room.id)} ${metric}` : `Rectangle rejected: ${outcome.result.message}`);
	}

	function precisionWallEndpoints(layout: LayoutDocumentWallFirst, wall: LayoutWall): {
		start: LayoutJunction;
		end: LayoutJunction;
		length: number;
		angleDegrees: number;
	} | null {
		const start = layout.junctions.find((junction) => junction.id === wall.startJunctionId);
		const end = layout.junctions.find((junction) => junction.id === wall.endJunctionId);
		if (!start || !end) return null;
		return {
			start,
			end,
			length: Math.hypot(end.point[0] - start.point[0], end.point[1] - start.point[1]),
			angleDegrees: radiansToDegrees(Math.atan2(end.point[1] - start.point[1], end.point[0] - start.point[0]))
		};
	}

	function precisionRectangleMetrics(layout: LayoutDocumentWallFirst, room: LayoutWallFirstRoom): {
		anchorId: string;
		widthWallId: string;
		depthWallId: string;
		widthEndpointId: string;
		depthEndpointId: string;
		cornerIds: string[];
		width: number;
		depth: number;
	} | null {
		const points = new Map(layout.junctions.map((junction) => [junction.id, junction.point]));
		const resolved = resolveRectangle(layout, room.id, {
			...(precisionRectangleAnchor ? { anchorJunctionId: precisionRectangleAnchor } : {}),
			...(precisionRectangleWidthWall ? { widthWallId: precisionRectangleWidthWall } : {})
		});
		if ('rejection' in resolved) return null;
		const anchor = points.get(resolved.anchorJunctionId);
		const widthEndpoint = points.get(resolved.widthEndpointId);
		const depthEndpoint = points.get(resolved.depthEndpointId);
		if (!anchor || !widthEndpoint || !depthEndpoint) return null;
		return {
			anchorId: resolved.anchorJunctionId,
			widthWallId: resolved.widthWallId,
			depthWallId: resolved.depthWallId,
			widthEndpointId: resolved.widthEndpointId,
			depthEndpointId: resolved.depthEndpointId,
			cornerIds: resolved.corners.map((junction) => junction.id),
			width: Math.hypot(widthEndpoint[0] - anchor[0], widthEndpoint[1] - anchor[1]),
			depth: Math.hypot(depthEndpoint[0] - anchor[0], depthEndpoint[1] - anchor[1])
		};
	}

	/**
	 * P23.14 §13 — the property-first selection header: type icon, name or
	 * reference, the secondary reference when a name leads, and the kind stated
	 * separately. It is not a dashboard and not a tutorial: no project summary,
	 * no prose lead, and never a raw canonical ID — those live in Technical
	 * details. `null` means nothing is selected, and the panel keeps its plain
	 * `Inspector` title rather than inventing an entity.
	 *
	 * It resolves from the SAME workspace-scoped target the body branches on
	 * (`domain`), never from the raw selection slots on its own: a selection the
	 * current workspace does not expose is not described here either (F2), and
	 * the header can never name an entity whose editor is not mounted (F1).
	 */
	const selectionHeader = $derived.by((): SelectionHeader | null => {
		const layout = layoutDocument;
		const layoutDomain = domain === 'layout';
		const cameraDomain = domain === 'camera';
		const sceneDomain = domain === 'scene';
		// Narrowed locals: each guard below tests the EXPOSED slot, so the branch
		// reports the same value it was gated by.
		const navigation = cameraDomain ? exposedNavigation : null;
		const cluster = sceneDomain ? exposedCluster : null;
		const placements = sceneDomain ? exposedPlacementIds : [];
		const object = sceneDomain ? exposedObject : null;
		if (layoutDomain && selectedWallFirstWall) {
			const identity = wallIdentity(layout, selectedWallFirstWall.id);
			return {
				icon: BrickWall,
				primary: selectedWallFirstWall.name ?? selectedWallReference ?? `Wall ${formatPlacementLabel(selectedWallFirstWall.id)}`,
				secondary: selectedWallFirstWall.name ? selectedWallReference : null,
				kind:
					identity.name !== null && identity.reference === null
						? 'Wall'
						: `Wall · ${selectedWallFirstWall.role === 'boundary' ? 'boundary' : 'partition'}`
			};
		}
		if (layoutDomain && selectedWallFirstJunction) {
			return {
				icon: GitMerge,
				primary: selectedJunctionReference ?? `Junction ${formatPlacementLabel(selectedWallFirstJunction.id)}`,
				secondary: null,
				kind: 'Junction'
			};
		}
		if (layoutDomain && selectedWallFirstOpening) {
			return {
				icon: selectedWallFirstOpening.kind === 'window' ? Square : DoorOpen,
				primary: selectedWallFirstOpening.name ?? selectedOpeningReference ?? formatPlacementLabel(selectedWallFirstOpening.id),
				secondary: selectedWallFirstOpening.name ? selectedOpeningReference : null,
				kind: selectedWallFirstOpening.kind === 'window' ? 'Window opening' : 'Door opening'
			};
		}
		if (layoutDomain && selectedWallFirstRoom) {
			return {
				icon: Square,
				primary: selectedWallFirstRoom.name,
				secondary: selectedRoomReference,
				kind: 'Room'
			};
		}
		if (layoutDomain && selectedLayoutObject) {
			return {
				icon: Box,
				primary: `${selectedLayoutObject.kind} object`,
				secondary: formatPlacementLabel(selectedLayoutObject.id),
				kind: 'Layout object'
			};
		}
		if (navigation?.kind === 'node') {
			return {
				icon: Camera,
				primary: formatPlacementLabel(selectedCameraNode?.label ?? selectedCameraNode?.id ?? 'camera'),
				secondary: store.cameraSelection?.handle ?? null,
				kind: 'Camera node'
			};
		}
		if (navigation?.kind === 'connection') {
			return {
				icon: GitMerge,
				primary: formatPlacementLabel(navigation.connectionId),
				secondary: null,
				kind: 'Camera connection'
			};
		}
		if (navigation?.kind === 'anchor') {
			return {
				icon: Camera,
				primary: formatPlacementLabel(navigation.anchorId),
				secondary: null,
				kind: 'Camera anchor'
			};
		}
		if (navigation?.kind === 'view-keyframe') {
			return {
				icon: Camera,
				primary: formatPlacementLabel(navigation.keyframeId),
				secondary: null,
				kind: `${navigation.direction} view keyframe`
			};
		}
		if (cluster) {
			return {
				icon: Boxes,
				primary: cluster.name,
				secondary: null,
				kind: `Cluster · ${placements.length} objects`
			};
		}
		if (placements.length > 1) {
			return {
				icon: Boxes,
				primary: `${placements.length} objects`,
				secondary: null,
				kind: 'Multiple selection'
			};
		}
		if (object) {
			return {
				icon: isSceneModelEntity(object) ? Boxes : Box,
				primary: formatPlacementLabel(object.name ?? object.id),
				secondary: null,
				kind: object.kind
			};
		}
		if (showAssetInspector && selectedAsset) {
			return {
				icon: Boxes,
				primary: selectedAsset.name,
				secondary: null,
				kind: 'Asset'
			};
		}
		return null;
	});

</script>

<aside bind:this={inspectorElement} class="panel inspector" class:collapsed aria-label="Inspector" style="grid-area: right;" inert={collapsed}>	<!-- P23.14 §13 — the Inspector opens on the selection, not on prose. The
	     header is one identity line: kind icon, name-or-reference, the secondary
	     reference when a name leads, and the kind stated separately. Raw canonical
	     IDs live behind Technical details below. With nothing selected the panel
	     keeps a plain title instead of a summary or a tutorial lead. -->
	<header class="inspector-header" aria-label="Current selection">
		{#if selectionHeader}
			{@const HeaderIcon = selectionHeader.icon}
			<span class="inspector-header__icon" aria-hidden="true"><HeaderIcon size={15} /></span>
			<span class="inspector-header__text">
				<span class="inspector-header__title">{selectionHeader.primary}</span>
				{#if selectionHeader.secondary}<span class="inspector-header__reference">{selectionHeader.secondary}</span>{/if}
				<span class="inspector-header__kind">{selectionHeader.kind}</span>
			</span>
		{:else}
			<h2>Inspector</h2>
		{/if}
	</header>

	{#if readOnlyNonLayout && !scenePlanStaging}
		<section class="plan-readonly-card" aria-label="Read-only in Plan">
			<div class="plan-readonly-head">
				<Info size={15} aria-hidden="true" />
				<h2>Read-only in Plan</h2>
			</div>
			<p>Camera selections survive the Plan ⇄ 3D switch, but Plan is layout-only. Switch to 3D to edit scenes and cameras.</p>
			<button
				type="button"
				class="plan-readonly-more"
				onclick={() => store.setStatusMessage('Switch to 3D to author scenes and cameras — Plan is layout-only.')}
			>Learn more <ExternalLink size={12} aria-hidden="true" /></button>
		</section>
	{/if}

	{#if domain === 'layout'}
		<section class="layout-inspector" aria-label="Layout preview details">
			{#if showLayoutPrimer && !isWallFirstLayout}
				<div class="layout-primer" aria-label="Layout primer">
					<strong>Layout primer</strong>
					<p>Rect Room — drag to draw a rectangular room · Poly Room — click points, close to finish.</p>
					<p>Door / Window — click a wall to place a supported opening.</p>
					<p>Grid {layoutInteraction.planView.gridEnabled ? 'on' : 'off'} · Snap {LAYOUT_PLAN_GRID_STEP}m {layoutInteraction.planView.snapEnabled ? 'on' : 'off'} · Units metric (m).</p>
					<p class="layout-primer-tip">Tip: walls stay room-derived; drag mid-span to bend existing walls.</p>
				</div>
			{/if}
			<!-- P23.14 §13 — the document-wide summary block (Project / Source /
				Status / Rooms / Objects / Issues) is gone. The Inspector is
				property-first: it is not a project dashboard, and those counts have
				owners (the Navigator, the Status rail, the Project menu). One fact,
				one surface. -->
			{#if layoutPreview.importError}<p class="layout-opening-warning" role="alert">Import failed: {layoutPreview.importError}</p>{/if}
			{#if layoutInteraction.selection.kind === 'none'}
				<p class="layout-empty">Select a Wall, Junction, Opening or Room on Plan — or reach the same entity from the Hierarchy.</p>
			{/if}

			{#if isScenePlanLayout}
			<div class="layout-accordion">
				<button type="button" class="accordion-trigger" aria-expanded={layoutInteraction.accordions.place} onclick={() => toggleLayoutAccordion(layoutInteraction, 'place')}><strong>Place</strong><span>{layoutInteraction.accordions.place ? '−' : '+'}</span></button>
				{#if layoutInteraction.accordions.place}
					<div class="place-tools" aria-label="Layout place tools">
						<button type="button" disabled={layoutInteraction.viewMode !== 'plan'} onclick={() => armLayoutPlaceTool('door')}>Door</button>
						<button type="button" disabled={layoutInteraction.viewMode !== 'plan'} onclick={() => armLayoutPlaceTool('window')}>Window</button>
						<button type="button" disabled={layoutInteraction.viewMode !== 'plan' || isWallFirstLayout} onclick={() => armLayoutPlaceTool('box')}>Box</button>
						<button type="button" disabled={layoutInteraction.viewMode !== 'plan' || isWallFirstLayout} onclick={() => armLayoutPlaceTool('cylinder')}>Cylinder</button>
						<button type="button" disabled={layoutInteraction.viewMode !== 'plan' || isWallFirstLayout} onclick={() => armLayoutPlaceTool('sphere')}>Sphere</button>
						<button type="button" disabled={layoutInteraction.viewMode !== 'plan' || !isWallFirstLayout} title={isWallFirstLayout ? 'Places one ordinary Column object (cylinder creation default)' : 'Preset placement requires a wall-first layout'} onclick={() => armLayoutPlaceTool('preset-column')}>Column</button>
						<button type="button" disabled={layoutInteraction.viewMode !== 'plan' || !isWallFirstLayout} title={isWallFirstLayout ? 'Places one ordinary Platform object (box creation default)' : 'Preset placement requires a wall-first layout'} onclick={() => armLayoutPlaceTool('preset-platform')}>Platform</button>
						<button type="button" disabled={layoutInteraction.viewMode !== 'plan' || !isWallFirstLayout} title={isWallFirstLayout ? 'Places one ordinary Plinth object (box creation default)' : 'Preset placement requires a wall-first layout'} onclick={() => armLayoutPlaceTool('preset-plinth')}>Plinth</button>
					</div>
				{/if}
			</div>
			{/if}

			<div class="layout-accordion">
				<button type="button" class="accordion-trigger" aria-expanded={layoutInteraction.accordions.objects} onclick={() => toggleLayoutAccordion(layoutInteraction, 'objects')}><strong>Objects</strong><span>{layoutInteraction.accordions.objects ? '−' : '+'}</span></button>
				{#if layoutInteraction.accordions.objects}
					<div class="layout-object-list" aria-label="Layout objects">
						{#if layoutPreview.project.layout.objects.length === 0}<span class="layout-empty">No layout objects.</span>{/if}
						{#each layoutPreview.project.layout.objects as object (object.id)}
							<div class="layout-object-row" class:selected={selectedLayoutObjectId === object.id}>
								<button type="button" class="object-row-select" onclick={() => selectListedLayoutObject(object.id)}><strong>{object.kind}</strong><span>{object.id}</span></button>
								<button type="button" class="object-row-delete" disabled={object.kind === 'profile'} aria-label={`Delete ${object.id}`} onclick={() => removeLayoutObject(object.id)}>Delete</button>
							</div>
						{/each}
					</div>
				{/if}
				</div>

				<!-- P23.6b — the document-wide Junction/Wall/Room inventory (the old
					"Architecture · exact" accordion) is gone: it was the Inspector's
					competing inventory and made the panel busy. Document navigation
					lives in the Hierarchy's Architecture / Topology… groups; the
					Inspector presents exactly the one selected entity below. The
					issue-driven Topology diagnostics accordion stays. -->
				{#if isWallFirstLayout && wallFirstLayout}
				{#if layoutPreview.issues.length > 0}
				<div class="layout-accordion" aria-label="Wall-first topology diagnostics">
					<div class="accordion-trigger"><strong>Topology diagnostics</strong><span>{layoutPreview.issues.length}</span></div>
					<div class="layout-selection-content">
						<p class="layout-inspector-note">Committed geometry the compiler flagged. Select a source to inspect it on Plan; nothing here auto-repairs.</p>
						<div class="layout-object-list" aria-label="Topology diagnostics">
							{#each layoutPreview.issues as issue (issue.code + (issue.targetId ?? ''))}
								{#if issue.targetId && wallFirstLayout && (wallFirstLayout.walls.some((wall) => wall.id === issue.targetId) || wallFirstLayout.junctions.some((junction) => junction.id === issue.targetId))}
									<button type="button" class="object-row-select" title={issue.targetId} onclick={() => selectDiagnosticTarget(issue.targetId!)}><strong>{issue.code}</strong><span>{diagnosticTargetIdentityText(issue.targetId)} · {issue.message}</span></button>
								{:else}
									<span class="layout-empty" title={issue.targetId ?? undefined}>{issue.code}{issue.targetId ? ` · ${diagnosticTargetIdentityText(issue.targetId)}` : ''} · {issue.message}</span>
								{/if}
							{/each}
						</div>
					</div>
				</div>
				{/if}
				{/if}

				<div class="layout-accordion">
				<button type="button" class="accordion-trigger" aria-expanded={layoutInteraction.accordions.selection} onclick={() => toggleLayoutAccordion(layoutInteraction, 'selection')}><strong>Selection</strong><span>{layoutInteraction.accordions.selection ? '−' : '+'}</span></button>
				{#if layoutInteraction.accordions.selection}
				<div class="layout-selection-content">
			{#if selectedLayoutObject}
				<div class="layout-selected-room" aria-label="Selected layout object">
					<strong>{selectedLayoutObject.kind} object</strong>
					<span>{selectedLayoutObject.id}</span>
				{#if selectedLayoutObject.kind === 'profile'}
					<span>Imported profile placeholder · read-only</span>
				{/if}
				{#if selectedLayoutObject.kind !== 'profile'}
					<fieldset class="staging-transform-fields">
						<legend>Plan transform</legend>
						<div class="staging-field-grid">
							<EditorNumberField
								label="X"
								value={selectedLayoutObject.position[0]}
								step={layoutInteraction.planView.snapEnabled ? LAYOUT_PLAN_GRID_STEP : 0.01}
								oncommit={(value) => updateObjectPosition(0, value)}
							/>
							<EditorNumberField
								label="Z"
								value={selectedLayoutObject.position[2]}
								step={layoutInteraction.planView.snapEnabled ? LAYOUT_PLAN_GRID_STEP : 0.01}
								oncommit={(value) => updateObjectPosition(2, value)}
							/>
							<EditorNumberField
								label="Yaw (°)"
								value={radiansToDegrees(selectedLayoutObject.rotation[1])}
								step={15}
								fractionDigits={2}
								oncommit={updateObjectYaw}
							/>
						</div>
					</fieldset>
					{#if alignReferenceOptions.length > 0}
						<fieldset class="staging-transform-fields layout-align-fields">
							<legend>Align</legend>
							<label>Reference<select bind:value={alignReferenceId}>
								{#each alignReferenceOptions as option (alignReferenceKey(option))}
									<option value={alignReferenceKey(option)}>{option.label}</option>
								{/each}
							</select></label>
							<div class="layout-align-actions">
								<button type="button" onclick={() => alignSelectedObject('min', 'x')}>X min</button>
								<button type="button" onclick={() => alignSelectedObject('center', 'x')}>X center</button>
								<button type="button" onclick={() => alignSelectedObject('max', 'x')}>X max</button>
								<button type="button" onclick={() => alignSelectedObject('min', 'z')}>Z min</button>
								<button type="button" onclick={() => alignSelectedObject('center', 'z')}>Z center</button>
								<button type="button" onclick={() => alignSelectedObject('max', 'z')}>Z max</button>
								{#if activeAlignReference?.kind === 'wall'}
									<button type="button" onclick={() => alignSelectedObject('center-on-wall')}>Center on wall</button>
								{/if}
							</div>
						</fieldset>
					{/if}
				{/if}
				{#if selectedLayoutObject.kind === 'profile'}
					<span>Position: {selectedLayoutObject.position.join(', ')} · rotation: {selectedLayoutObject.rotation.join(', ')}</span>
					<span>Dimensions: {selectedLayoutObject.dimensions.join(' × ')}</span>
				{:else if selectedLayoutObject.kind === 'plane'}
					<span>Dimensions: {selectedLayoutObject.dimensions.join(' × ')}</span>
				{:else if selectedLayoutObject.kind === 'box'}
						<label>Width (m)<input type="number" min="0.001" step="0.05" value={selectedLayoutObject.dimensions[0]} disabled={arrangeMode} onchange={(event) => updateObjectMetric('width', event)} /></label>
						<label>Depth (m)<input type="number" min="0.001" step="0.05" value={selectedLayoutObject.dimensions[2]} disabled={arrangeMode} onchange={(event) => updateObjectMetric('depth', event)} /></label>
						<label>Height (m)<input type="number" min="0.001" step="0.05" value={selectedLayoutObject.dimensions[1]} disabled={arrangeMode} onchange={(event) => updateObjectMetric('height', event)} /></label>
					{:else}
						<label>Radius (m)<input type="number" min="0.001" step="0.05" value={selectedLayoutObject.dimensions[0] / 2} disabled={arrangeMode} onchange={(event) => updateObjectMetric('radius', event)} /></label>
						<label>Height (m)<input type="number" min="0.001" step="0.05" value={selectedLayoutObject.dimensions[1]} disabled={arrangeMode} onchange={(event) => updateObjectMetric('height', event)} /></label>
					{/if}
					<div class="object-room-meta"><span>Associated Room</span><strong>{associatedRoomName ?? 'Unassigned'} · {selectedLayoutObject.roomId ?? 'none'}</strong></div>
					{#if layoutPreview.lastMutationMessage}<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>{/if}
					{#if isWallFirstLayout}
						<fieldset class="staging-transform-fields">
							<legend>Duplicate / repeat</legend>
							<label>Copies (1–50)<input type="number" min="1" max="50" step="1" value={objectRepeatCount} onchange={(event) => objectRepeatCount = Number((event.currentTarget as HTMLInputElement).value)} /></label>
							<label>Δ X (m)<input type="number" step="0.1" value={objectRepeatDeltaX} onchange={(event) => objectRepeatDeltaX = Number((event.currentTarget as HTMLInputElement).value)} /></label>
							<label>Δ Z (m)<input type="number" step="0.1" value={objectRepeatDeltaZ} onchange={(event) => objectRepeatDeltaZ = Number((event.currentTarget as HTMLInputElement).value)} /></label>
						</fieldset>
						<div class="layout-opening-actions">
							<button type="button" disabled={selectedLayoutObject.kind === 'profile'} onclick={duplicateSelectedLayoutObject}>Duplicate</button>
							<button type="button" disabled={selectedLayoutObject.kind === 'profile'} onclick={repeatSelectedLayoutObject}>Repeat ×{objectRepeatCount}</button>
						</div>
					{/if}
					<button type="button" class="layout-danger" disabled={selectedLayoutObject.kind === 'profile'} onclick={removeSelectedObject}>Delete object</button>
				</div>
			{:else if selectedWallFirstWall && selectedWallFirstWallEndpoints}
				<div class="layout-selected-room" aria-label="Selected wall-first wall">
					<!-- P23.12 — one header pattern: name (or reference) primary, the
						other secondary, kind stated separately, Technical details below. -->
					<strong>{selectedWallFirstWall.name ?? selectedWallReference ?? `Wall ${formatPlacementLabel(selectedWallFirstWall.id)}`}</strong>
					{#if selectedWallFirstWall.name && selectedWallReference}<span>{selectedWallReference}</span>{/if}
					<span>{selectedWallFirstWall.role === 'boundary' ? 'Defines a room boundary' : 'Partition — does not divide rooms'}</span>
					<span>
						{junctionIdentityText(layoutDocument, selectedWallFirstWallEndpoints.start.id)} → {junctionIdentityText(layoutDocument, selectedWallFirstWallEndpoints.end.id)}
						· {selectedWallFirstWallEndpoints.length.toFixed(2)} m
					</span>
					<!-- P23.12 S3/S6 — optional authored name through the one planner;
						an emptied field maps to `null` (clear), a rejection reverts. -->
					<label>Name (optional)<input type="text" value={selectedWallFirstWall.name ?? ''} onchange={updateSelectedWallName} /></label>
					<label>Fixed endpoint<select value={precisionFixedEndpoint} onchange={(event) => precisionFixedEndpoint = (event.currentTarget as HTMLSelectElement).value as 'start' | 'end'}><option value="start">Start</option><option value="end">End</option></select></label>
					<label>Length (m)<input type="number" step="any" value={formatMeters(selectedWallFirstWallEndpoints.length)} onchange={updateSelectedWallLength} /></label>
					<label>Angle (°)<input type="number" step="any" value={formatDegrees(selectedWallFirstWallEndpoints.angleDegrees)} onchange={updateSelectedWallAngle} /></label>
					<label>Thickness (m)<input type="number" step="any" value={formatMeters(selectedWallFirstWall.thickness)} onchange={updateSelectedWallThickness} /></label>
					<label>Height (m)<input type="number" step="any" value={formatMeters(selectedWallFirstWall.height)} onchange={updateSelectedWallHeight} /></label>
					<label>Add junction at distance from start (m)<input type="number" step="any" value={formatMeters(selectedWallFirstWallEndpoints.length / 2)} onchange={addSelectedWallJunction} /></label>
					<label><input type="checkbox" checked={selectedWallFirstWall.role === 'boundary'} onchange={updateSelectedWallRole} /> Defines room boundary</label>
					<!-- P23.11 — the Wall's own curve. The toggle is the one Convert
						action (straight ⇄ cubic chain); a curved Wall lists its bend points
						as exact X/Z edits plus removal, and removing the last bend point
						leaves a knot-less chain — still a curve, and still exactly the
						shape it had. Going straight is the toggle, never a side effect. -->
					<label><input type="checkbox" checked={selectedWallFirstWall.centerline.kind === 'cubic-chain'} onchange={(event) => setSelectedWallCurved((event.currentTarget as HTMLInputElement).checked)} /> Curved wall</label>
					{#if selectedWallFirstWallKnots.length > 0}
						<div class="object-room-meta"><span>Bend points</span><strong>{selectedWallFirstWallKnots.length}</strong></div>
						{#each selectedWallFirstWallKnots as anchor (anchor.id)}
							<label>{bendPointLabel(anchor.id)} X (m)<input type="number" step="any" value={formatMeters(anchor.point[0])} onchange={(event) => updateSelectedWallCurveKnot(anchor.id, 0, event)} /></label>
							<label>{bendPointLabel(anchor.id)} Z (m)<input type="number" step="any" value={formatMeters(anchor.point[1])} onchange={(event) => updateSelectedWallCurveKnot(anchor.id, 1, event)} /></label>
							<div class="layout-opening-actions">
								<button type="button" onclick={() => deleteSelectedWallCurveKnot(anchor.id)}>Remove bend point</button>
							</div>
						{/each}
					{/if}
					<!-- P23.11 fix 4 — Add is NOT gated on an existing bend point. A
						knot-less cubic chain (what removing the last bend point leaves) and
						a straight Wall both accept one through the same canonical insertion
						planner, so curve authoring never disappears from view. Going
						straight stays the explicit toggle above, never a side effect. -->
					<div class="layout-opening-actions">
						<button type="button" onclick={addSelectedWallCurveKnot}>Add bend point at midpoint</button>
					</div>
					<!-- D2/D3 — boundary participation is a relation, never ownership;
						hosted Openings select through the canonical wallOpening slot. -->
					{#if selectedWallFirstHostedOpenings.length > 0}
						<div class="object-room-meta"><span>Hosted openings</span>
							<span class="relation-links">
								{#each selectedWallFirstHostedOpenings as hostedOpening (hostedOpening.id)}
									<button type="button" class="object-row-select" onclick={() => selectLayoutWallOpening(layoutInteraction, selectedWallFirstWall!.id, hostedOpening.id)}>{hostedOpening.kind} · {openingIdentityText(layoutDocument, hostedOpening.id)}</button>
								{/each}
							</span>
						</div>
					{/if}
					{#if selectedWallFirstBoundedRooms.length > 0}
						<div class="object-room-meta"><span>Bounded rooms</span><strong>{selectedWallFirstBoundedRooms.join(', ')}</strong></div>
					{/if}
					<div class="object-room-meta"><span>Endpoints</span>
						<span class="relation-links">
							<button type="button" class="object-row-select" onclick={() => selectLayoutJunction(layoutInteraction, selectedWallFirstWallEndpoints!.start.id)}>{junctionIdentityText(layoutDocument, selectedWallFirstWallEndpoints.start.id)}</button>
							<button type="button" class="object-row-select" onclick={() => selectLayoutJunction(layoutInteraction, selectedWallFirstWallEndpoints!.end.id)}>{junctionIdentityText(layoutDocument, selectedWallFirstWallEndpoints.end.id)}</button>
						</span>
					</div>
					<!-- D6 — Technical details: collapsed by default, keyboard- and
						touch-reachable, state preserved across selection changes. -->
					<details class="technical-details" bind:open={technicalDetailsOpen}>
						<summary>Technical details</summary>
						<span class="technical-id">{selectedWallFirstWall.id}</span>
						<button type="button" onclick={copyTechnicalId}>Copy ID</button>
						{#if selectedWallReference}<button type="button" onclick={copyTechnicalReference}>Copy reference</button>{/if}
					</details>
					<!-- P23.14 §13 — consequential actions come last: Delete wall follows
						Geometry, the authored Name, Relationships and Technical details. -->
					<div class="layout-opening-actions">
						<button type="button" class="layout-danger" onclick={deleteSelectedWallFirstWall}>Delete wall</button>
					</div>
					{#if layoutPreview.lastMutationMessage}<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>{/if}
				</div>
			{:else if selectedWallFirstJunction}
				<div class="layout-selected-room" aria-label="Selected wall-first junction">
					<strong>{selectedJunctionReference ?? `Junction ${formatPlacementLabel(selectedWallFirstJunction.id)}`}</strong>
					<span>Connected Wall geometry follows this Junction.</span>
					<label>X (m)<input type="number" step="any" value={formatMeters(selectedWallFirstJunction.point[0])} onchange={(event) => updateSelectedJunction(0, event)} /></label>
					<label>Z (m)<input type="number" step="any" value={formatMeters(selectedWallFirstJunction.point[1])} onchange={(event) => updateSelectedJunction(1, event)} /></label>
					<!-- D6 — the same disclosure the Wall branch offers, so identity
						debugging does not depend on which entity kind is selected. -->
					<details class="technical-details" bind:open={technicalDetailsOpen}>
						<summary>Technical details</summary>
						<span class="technical-id">{selectedWallFirstJunction.id}</span>
						<button type="button" onclick={copyTechnicalId}>Copy ID</button>
						{#if selectedJunctionReference}<button type="button" onclick={copyTechnicalReference}>Copy reference</button>{/if}
					</details>
					<!-- P23.14 §13 — the Junction-dissolve entry point: destructive
						last, and reason-coded. Eligibility is the core planner's, stated
						before the click instead of silently doing nothing. -->
					<div class="layout-opening-actions">
						<button
							type="button"
							class="layout-danger"
							disabled={junctionDissolveRefusal !== null}
							title={junctionDissolveRefusal ?? 'Join the two incident walls into one'}
							onclick={dissolveSelectedJunction}
						>Dissolve junction…</button>
					</div>
					{#if junctionDissolveRefusal}<p class="layout-inspector-note" role="status">{junctionDissolveRefusal}</p>{/if}
					{#if layoutPreview.lastMutationMessage}<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>{/if}
				</div>
			{:else if selectedWallFirstOpening && selectedWallFirstOpeningMetrics}
				<div class="layout-selected-room" aria-label="Selected wall-first opening">
					<!-- P23.12 — same header pattern as Wall: name leads, reference
						secondary; the kind stays a separate statement. -->
					<strong>{selectedWallFirstOpening.name ?? selectedOpeningReference ?? formatPlacementLabel(selectedWallFirstOpening.id)}</strong>
					{#if selectedWallFirstOpening.name && selectedOpeningReference}<span class="identity-reference">{selectedOpeningReference}</span>{/if}
					<span>{selectedWallFirstOpening.kind} opening</span>
					<label>Name (optional)<input type="text" value={selectedWallFirstOpening.name ?? ''} onchange={updateSelectedOpeningName} placeholder="Unnamed — reference is the label" /></label>
					<span>
						Wall: {wallIdentityText(layoutDocument, selectedWallFirstOpening.wallId)} · {selectedWallFirstOpeningMetrics.wallLength.toFixed(2)} m{#if selectedWallFirstHostingWall}
							· {selectedWallFirstHostingWall.role}{/if}
					</span>
					<label>Offset from wall start (m)<input type="number" min="0" step="0.05" value={selectedWallFirstOpening.offset.toFixed(2)} onchange={(event) => updateWallFirstOpeningField('offset', event)} /></label>
					<label>Distance from start (m)<input type="number" min="0" step="0.05" value={selectedWallFirstOpeningMetrics.clearanceFromStart.toFixed(2)} onchange={updateWallFirstOpeningDistanceFromStart} /></label>
					<label>Distance from end (m)<input type="number" min="0" step="0.05" value={selectedWallFirstOpeningMetrics.clearanceFromEnd.toFixed(2)} onchange={updateWallFirstOpeningDistanceFromEnd} /></label>
					<label>Width (m)<input type="number" min="0.05" step="0.05" value={selectedWallFirstOpening.width.toFixed(2)} onchange={(event) => updateWallFirstOpeningField('width', event)} /></label>
					<label>Height (m)<input type="number" min="0.05" step="0.05" value={selectedWallFirstOpening.height.toFixed(2)} onchange={(event) => updateWallFirstOpeningField('height', event)} /></label>
					<label>Sill height (m)<input type="number" min="0" step="0.05" value={selectedWallFirstOpening.sillHeight.toFixed(2)} onchange={(event) => updateWallFirstOpeningField('sillHeight', event)} /></label>
					<label>Profile<select value={selectedWallFirstOpening.profile} onchange={updateWallFirstOpeningProfile}>
						<option value="rectangular">Rectangular</option>
						<option value="rounded">Rounded arch</option>
						<option value="pointed">Pointed arch</option>
					</select></label>
					<label>Type<select value={selectedWallFirstOpening.kind} onchange={updateWallFirstOpeningKind}>
						<option value="door">Door</option>
						<option value="window">Window</option>
					</select></label>
					{#if selectedWallFirstOpening.kind === 'door'}
						<label>Portal relation<select
							value={selectedWallFirstOpening.connectsRoomIds
								? [...selectedWallFirstOpening.connectsRoomIds].sort().join('|')
								: ''}
							onchange={updateWallFirstOpeningRelation}
						>
							<option value="">None (exterior / partition door)</option>
							{#if selectedWallFirstOpeningAdjacentRooms.length === 2}
								<option value={[...selectedWallFirstOpeningAdjacentRooms].sort().join('|')}>
									{selectedWallFirstOpeningAdjacentRoomNames.join(' ↔ ')}
								</option>
							{/if}
						</select></label>
						<span>Adjacent rooms: {selectedWallFirstOpeningAdjacentRoomNames.length > 0 ? selectedWallFirstOpeningAdjacentRoomNames.join(', ') : 'none'}</span>
					{/if}
					{#if layoutPreview.lastMutationMessage}
						<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>
					{/if}
					<div class="layout-opening-actions">
						<button type="button" onclick={centerSelectedWallFirstOpening}>Center on wall</button>
						<button type="button" onclick={duplicateSelectedWallOpening}>Duplicate</button>
					</div>
					<fieldset class="staging-transform-fields">
						<legend>Linear repeat</legend>
						<label>Copies (1–50)<input type="number" min="1" max="50" step="1" value={openingRepeatCount} onchange={(event) => openingRepeatCount = Number((event.currentTarget as HTMLInputElement).value)} /></label>
						<label>Spacing (m)<input type="number" step="0.05" value={openingRepeatSpacing} onchange={(event) => { openingRepeatTouched = true; openingRepeatSpacing = Number((event.currentTarget as HTMLInputElement).value); }} /></label>
					</fieldset>
					<div class="layout-opening-actions">
						<button type="button" onclick={repeatSelectedWallOpening}>Repeat ×{openingRepeatCount}</button>
					</div>
					<!-- D6 — every entity kind exposes the same technical identity block. -->
					<details class="technical-details" bind:open={technicalDetailsOpen}>
						<summary>Technical details</summary>
						<span class="technical-id">{selectedWallFirstOpening.id}</span>
						<button type="button" onclick={copyTechnicalId}>Copy ID</button>
						{#if selectedOpeningReference}<button type="button" onclick={copyTechnicalReference}>Copy reference</button>{/if}
					</details>
					<!-- P23.14 §13 — consequential actions come last. -->
					<div class="layout-opening-actions">
						<button type="button" class="layout-danger" onclick={removeSelectedWallFirstOpening}>Delete opening</button>
					</div>
				</div>
			{:else if selectedLayoutOpening && selectedLayoutSegment && selectedLayoutRoom}
				<div class="layout-selected-room" aria-label="Selected layout opening">
					<strong>{selectedLayoutOpening.kind} opening</strong>
					<span>{selectedLayoutRoom.name} · {selectedLayoutRoom.id}</span>
					<span>Wall: {selectedLayoutSegment.id} · {roomEdgeLength(selectedLayoutRoom, selectedLayoutRoom.boundary.segments.indexOf(selectedLayoutSegment)).toFixed(2)} m</span>
					<label>Offset from wall start (m)<input type="number" min="0" step="0.05" value={selectedLayoutOpening.offset.toFixed(2)} onchange={(event) => updateOpeningField('offset', event)} /></label>
					<label>Width (m)<input type="number" min="0.05" step="0.05" value={selectedLayoutOpening.width.toFixed(2)} onchange={(event) => updateOpeningField('width', event)} /></label>
					<label>Height (m)<input type="number" min="0.05" step="0.05" value={selectedLayoutOpening.height.toFixed(2)} onchange={(event) => updateOpeningField('height', event)} /></label>
					<label>Sill height (m)<input type="number" min="0" step="0.05" value={selectedLayoutOpening.sillHeight.toFixed(2)} onchange={(event) => updateOpeningField('sillHeight', event)} /></label>
					<label>Profile<select value={selectedLayoutOpening.profile} onchange={updateOpeningProfile}>
						<option value="rectangular">Rectangular</option>
						<option value="rounded">Rounded arch</option>
						<option value="pointed">Pointed arch</option>
					</select></label>
					{#if layoutPreview.lastMutationMessage}
						<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>
					{/if}
					<button type="button" class="layout-danger" onclick={removeSelectedOpening}>Delete opening</button>
				</div>
			{:else if selectedLayoutSegment && selectedLayoutRoom && (layoutInteraction.selection.kind === 'wall' || layoutInteraction.selection.kind === 'interiorAnchor')}
				<div class="layout-selected-room" aria-label="Selected layout wall">
					<strong>Wall selected</strong>
					<span>{selectedLayoutRoom.name} · {selectedLayoutRoom.id}</span>
					<span>{selectedLayoutSegment.id}</span>
					<span>Length: {roomEdgeLength(selectedLayoutRoom, selectedLayoutRoom.boundary.segments.indexOf(selectedLayoutSegment)).toFixed(2)} m</span>
					{#if layoutInteraction.selection.kind === 'interiorAnchor'}
						<span>Bend anchor: {layoutInteraction.selection.anchorId}</span>
					{/if}
					<label>Wall thickness (m)<input type="number" min="0.001" step="0.01" value={selectedLayoutRoom.wallThickness} onchange={(event) => updateRoomNumber('wallThickness', event)} /></label>
					<label>Floor thickness (m)<input type="number" min="0.001" step="0.01" value={selectedLayoutRoom.floorThickness} onchange={(event) => updateRoomNumber('floorThickness', event)} /></label>
					<label>Rotate by (°)<input type="number" step="15" value="0" onchange={rotateSelectedRoom} /></label>
					<label>Ceiling thickness (m)<input type="number" min="0.001" step="0.01" value={selectedLayoutRoom.ceilingThickness} onchange={(event) => updateRoomNumber('ceilingThickness', event)} /></label>
					{#if selectedLayoutFloor}<label>Floor height (m)<input type="number" min="0.001" step="0.05" value={selectedLayoutFloor.height} onchange={(event) => updateRoomNumber('floorHeight', event)} /></label>{/if}
					<div class="layout-opening-actions">
						<button type="button" disabled={isWallFirstLayout} onclick={() => armOpeningTool('door')}>Door</button>
						<button type="button" disabled={isWallFirstLayout} onclick={() => armOpeningTool('window')}>Window</button>
					</div>
				</div>
			{:else if selectedWallFirstRoom && selectedWallFirstRoomFacts}
				<div class="layout-selected-room" aria-label="Selected wall-first room">
					<!-- P23.12 — the Room's authored name stays primary and its edit
						field stays the one rename authority; the reference is secondary. -->
					<strong>{selectedWallFirstRoom.name}</strong>
					{#if selectedRoomReference}<span class="identity-reference">{selectedRoomReference}</span>{/if}
					<!-- P23.6d — authoritative canonical Room metadata (name and the
						two surface thicknesses) through `planRoomMetadataUpdate`;
						the Room survives the edit, so selection is preserved. -->
					<label>Name<input type="text" value={selectedWallFirstRoom.name} onchange={updateWallFirstRoomName} /></label>
					<label>Floor thickness (m)<input type="number" min="0.001" step="0.01" value={selectedWallFirstRoom.floorThickness} onchange={(event) => updateWallFirstRoomThickness('floorThickness', event)} /></label>
					<label>Ceiling thickness (m)<input type="number" min="0.001" step="0.01" value={selectedWallFirstRoom.ceilingThickness} onchange={(event) => updateWallFirstRoomThickness('ceilingThickness', event)} /></label>
					<!-- D9 — derived metrics, read-only (P23.6b). -->
					{#if Number.isFinite(selectedWallFirstRoomFacts.area) && selectedWallFirstRoomFacts.area > 0}
					<span>Area {selectedWallFirstRoomFacts.area.toFixed(2)} m² · perimeter {selectedWallFirstRoomFacts.perimeter.toFixed(2)} m</span>
					{/if}
					{#if selectedWallFirstRoomFacts.ceilingElevation !== null}
					<span>Derived ceiling {selectedWallFirstRoomFacts.ceilingElevation.toFixed(2)} m</span>
					{/if}
					<!-- P23.6a — move eligibility state + the identical rejection
						hint A returns; the move gesture itself stays A's (viewport).
						No invented absolute Room X/Z, no Room rotation. -->
					<span class="room-move-state">
						{selectedWallFirstRoomFacts.eligibility.movable
							? 'Movable as a whole unit (drag in Plan)'
							: `Not movable as a unit — ${selectedWallFirstRoomFacts.eligibility.hint}`}
					</span>
					<!-- Capability re-homing: the exact rectangle Width/Depth editor
						(and its anchor / width-Wall operation parameters + Duplicate)
						moves here from the retired "Architecture · exact" accordion —
						reachable exactly while this canonical Room is selected. -->
					{#if selectedWallFirstRoomFacts.eligibility && selectedPrecisionRectangle}
						<fieldset class="staging-transform-fields">
							<legend>Exact dimensions</legend>
							<span>Four boundary Walls · shared-boundary edits reject when ambiguous.</span>
							<!-- D6 — the option VALUE stays the canonical ID the planner consumes;
								only the option TEXT is presentation. -->
							<label>Anchor Junction<select value={precisionRectangleAnchor ?? selectedPrecisionRectangle.anchorId} onchange={(event) => precisionRectangleAnchor = (event.currentTarget as HTMLSelectElement).value || null}>{#each selectedPrecisionRectangle.cornerIds as id}<option value={id}>{junctionIdentityText(layoutDocument, id)}</option>{/each}</select></label>
							<label>Width Wall<select value={precisionRectangleWidthWall ?? selectedPrecisionRectangle.widthWallId} onchange={(event) => precisionRectangleWidthWall = (event.currentTarget as HTMLSelectElement).value || null}>{#each precisionRectangleWidthWallOptions as wallId}<option value={wallId}>{wallIdentityText(layoutDocument, wallId)}</option>{/each}</select></label>
							<label>Width (m)<input type="number" min="0.001" step="0.01" value={selectedPrecisionRectangle.width} onchange={(event) => updatePrecisionRectangle('width', event)} /></label>
							<label>Depth (m)<input type="number" min="0.001" step="0.01" value={selectedPrecisionRectangle.depth} onchange={(event) => updatePrecisionRectangle('depth', event)} /></label>
						</fieldset>
						<fieldset class="staging-transform-fields">
							<legend>Duplicate</legend>
							<label>Δ X (m)<input type="number" step="0.1" value={roomDuplicateDeltaX} onchange={(event) => { roomDuplicateTouched = true; roomDuplicateDeltaX = Number((event.currentTarget as HTMLInputElement).value); }} /></label>
							<label>Δ Z (m)<input type="number" step="0.1" value={roomDuplicateDeltaZ} onchange={(event) => { roomDuplicateTouched = true; roomDuplicateDeltaZ = Number((event.currentTarget as HTMLInputElement).value); }} /></label>
							<button type="button" onclick={duplicateSelectedPrecisionRoom}>Duplicate room</button>
						</fieldset>
					{/if}
					<span>Boundary walls: {selectedWallFirstRoomBoundaryLabel}</span>
					<!-- P23.6d — Room removal is a named, deliberate command that deletes
						the Room's WHOLE boundary (its exclusive boundary Walls) in one atomic
						operation, so no open shell of leftover Walls survives. Walls shared
						with a neighbour are kept (the neighbour still needs them). No
						Room-exclusive Wall → disabled with a reason (never a bare splice). -->
					<fieldset class="staging-transform-fields">
						<legend>Remove room</legend>
						{#if selectedWallFirstRoomExclusiveWalls.length > 0}
							<span>Deletes this Room and its {selectedWallFirstRoomExclusiveWalls.length} own boundary {selectedWallFirstRoomExclusiveWalls.length === 1 ? 'wall' : 'walls'} in one step.</span>
							<button type="button" class="layout-danger" onclick={removeSelectedWallFirstRoom}>Remove room</button>
						{:else}
							<span>Not removable — every boundary wall is shared with a neighbouring room. Delete a shared wall explicitly, or reshape the Room.</span>
							<button type="button" class="layout-danger" disabled title="No Room-exclusive boundary wall">Remove room</button>
						{/if}
					</fieldset>
					<!-- D6 — every entity kind exposes the same technical identity block. -->
					<details class="technical-details" bind:open={technicalDetailsOpen}>
						<summary>Technical details</summary>
						<span class="technical-id">{selectedWallFirstRoom.id}</span>
						<button type="button" onclick={copyTechnicalId}>Copy ID</button>
						{#if selectedRoomReference}<button type="button" onclick={copyTechnicalReference}>Copy reference</button>{/if}
					</details>
					{#if layoutPreview.lastMutationMessage}<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>{/if}
				</div>
			{:else if selectedLayoutRoom && selectedLayoutBounds}
				<div class="layout-selected-room" aria-label="Selected layout room">
					<strong>{selectedLayoutRoom.name}</strong>
					<span>{selectedLayoutRoom.id}</span>
					<span>Bounds: {selectedLayoutBounds.width.toFixed(2)} m × {selectedLayoutBounds.height.toFixed(2)} m</span>
					<span>Edges: {selectedLayoutRoom.boundary.segments.map((_, index) => `${roomEdgeLength(selectedLayoutRoom, index).toFixed(2)} m`).join(' · ')}</span>
					<label>Name<input type="text" value={selectedLayoutRoom.name} onchange={updateRoomName} /></label>
					<label>Wall thickness (m)<input type="number" min="0.001" step="0.01" value={selectedLayoutRoom.wallThickness} onchange={(event) => updateRoomNumber('wallThickness', event)} /></label>
					<label>Floor thickness (m)<input type="number" min="0.001" step="0.01" value={selectedLayoutRoom.floorThickness} onchange={(event) => updateRoomNumber('floorThickness', event)} /></label>
					<label>Rotate by (°)<input type="number" step="15" value="0" onchange={rotateSelectedRoom} /></label>
					<label>Ceiling thickness (m)<input type="number" min="0.001" step="0.01" value={selectedLayoutRoom.ceilingThickness} onchange={(event) => updateRoomNumber('ceilingThickness', event)} /></label>
					{#if selectedLayoutFloor}<label>Floor height (m)<input type="number" min="0.001" step="0.05" value={selectedLayoutFloor.height} onchange={(event) => updateRoomNumber('floorHeight', event)} /></label>{/if}
					{#if layoutPreview.lastMutationMessage}<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>{/if}
					{#if roomDeleteReferences && roomDeleteBlocked}
						<p class="layout-opening-warning" role="alert">Delete blocked — referenced by {layoutRoomSceneReferenceSummary(roomDeleteReferences)}</p>
					{/if}
					<button
						type="button"
						class="layout-danger"
						disabled={roomDeleteBlocked || store.isDocumentMutationBlocked || store.isEditorInteractionActive}
						title={roomDeleteBlocked && roomDeleteReferences
							? `Delete blocked: referenced by ${layoutRoomSceneReferenceSummary(roomDeleteReferences)}`
							: undefined}
						onclick={removeSelectedRoom}
					>Delete room</button>
				</div>
			{/if}
				</div>
				{/if}
			</div>
			{#if layoutPreview.issues.length > 0}
				<div class="layout-issues" role="alert">
					<strong>Geometry warnings</strong>
					<ul>
						{#each layoutPreview.issues as issue (`${issue.path}:${issue.code}`)}
							<li><code title={issue.targetId ?? undefined}>{issue.targetId ? diagnosticTargetIdentityText(issue.targetId) : issue.path}</code> — {issue.message}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	{:else if scenePlanStaging}
		<section class="staging-selection" aria-label="Arrange selection">
			<div class="section-heading">
				<h2>Arrange selection</h2>
				<span class="staging-badge">{stagingTransformAvailable ? 'Plan transform' : 'Read-only'}</span>
			</div>
			{#if hasPlacementSelection}
				{#if store.selectedCluster}
					<p><strong>{store.selectedCluster.name}</strong></p>
					<p>{store.selectedPlacementIds.length} objects · {store.selectedCluster.id}</p>
				{:else if store.selectedPlacementIds.length > 1}
					<p><strong>{store.selectedPlacementIds.length} objects selected</strong></p>
					<p>{store.selectedPlacementIds.join(' · ')}</p>
				{:else if selectedObject}
					<p><strong>{selectedObject.name}</strong></p>
					<p>{selectedObject.kind} · {selectedObject.id}</p>
				{/if}
				{#if stagingIneligibleCount > 0}
					<p class="staging-warning" role="status">
						{stagingIneligibleCount === store.selectedPlacementIds.length
							? 'Not editable in Plan. Edit position in 3D.'
							: 'Some selected items are not editable in Plan.'}
					</p>
				{:else}
					{#if stagingSingleTransform}
						<fieldset class="staging-transform-fields">
							<legend>Room-local Plan transform</legend>
							<div class="staging-field-grid">
								<EditorNumberField
									label="X"
									value={stagingSingleTransform.position[0]}
									step={layoutInteraction.planView.snapEnabled ? LAYOUT_PLAN_GRID_STEP : 0.01}
									oncommit={(value) => updateStagingPosition(0, value)}
								/>
								<EditorNumberField
									label="Z"
									value={stagingSingleTransform.position[2]}
									step={layoutInteraction.planView.snapEnabled ? LAYOUT_PLAN_GRID_STEP : 0.01}
									oncommit={(value) => updateStagingPosition(2, value)}
								/>
								<EditorNumberField
									label="Yaw (°)"
									value={radiansToDegrees(stagingSingleTransform.rotation[1])}
									step={15}
									fractionDigits={2}
									oncommit={updateStagingYaw}
								/>
							</div>
						</fieldset>
					{:else}
						<p class="staging-status">Drag selected footprints together or use the primary rotation handle.</p>
					{/if}
					<button type="button" class="layout-danger" onclick={deleteStagingSelection}>Delete selected</button>
				{/if}
				<button type="button" class="deselect" onclick={() => store.selectionActions.deselect()}>Clear selection</button>
			{:else}
				<p>Select a Scene footprint in Plan or choose an item in the hierarchy.</p>
			{/if}
		</section>
	{:else if showAssetInspector}
		{#if selectedAsset}
			<section class="asset-details" aria-label="Asset details">
				<div>
					<h2>{selectedAsset.name}</h2>
					<p class="id">{selectedAsset.id}</p>
				</div>
				<dl>
					<div><dt>Category</dt><dd>{selectedAsset.category}</dd></div>
					<div><dt>Status</dt><dd>{selectedAsset.status}</dd></div>
					<div><dt>Placement</dt><dd>{selectedAsset.placementSurface}</dd></div>
					<div><dt>Fallback</dt><dd>{resolveAssetFallback(selectedAsset)}</dd></div>
					<div><dt>File</dt><dd>{selectedAsset.productionFile ?? 'Fallback only'}</dd></div>
					<div><dt>Creator</dt><dd>{selectedAsset.creator ?? 'Not recorded'}</dd></div>
					<div><dt>Licence</dt><dd>{selectedAsset.license}</dd></div>
				</dl>
				{#if selectedAsset.placementSurface === 'floor'}
					<button
						type="button"
						class="place"
						class:active={store.pendingPlacementAssetId === selectedAsset.id}
						disabled={readOnly}
						onclick={() => store.beginAssetPlacement(selectedAsset.id)}
					>
						{store.pendingPlacementAssetId === selectedAsset.id
							? 'Placing…'
							: store.isRelic
								? 'Place in Paris'
								: 'Place in room'}
					</button>
				{:else}
					<p class="unsupported">
						{selectedAsset.placementSurface === 'surface'
							? 'Placement on tables or pedestals is not available in Phase 5.'
							: `${selectedAsset.placementSurface[0]?.toUpperCase()}${selectedAsset.placementSurface.slice(1)} placement is not available in Phase 5.`}
					</p>
				{/if}
			</section>
		{:else}
			<section class="empty-selection" aria-label="No asset selection">
				<p>Choose a model, or open Assets → Shapes to place a primitive.</p>
			</section>
		{/if}
	{:else if exposedNavigation}
		{#if isCameraPlan}
			<CameraPlanInspector {store} {viewState} />
		{:else if !readOnlyNonLayout}
			<EditorCameraInspector {store} />
		{/if}
	{:else if hasPlacementSelection}
		{#if !readOnlyNonLayout}
		<section class="grouping" aria-label="Group selection">
			<div class="section-heading">
				<h2>Group selection</h2>
				{#if store.selectedCluster}<span class="grouped-badge">Grouped</span>{/if}
			</div>

			{#if store.selectedCluster}
				<p class="group-summary">
					<strong>{store.selectedCluster.name}</strong>
					<span>{store.selectedCluster.memberIds.length} objects in this cluster</span>
				</p>
				{#key store.selectedCluster.id}
					<form class="rename-form" onsubmit={(event) => { event.preventDefault(); saveClusterName(); }}>
						<label class="rename">
							<span>Cluster name</span>
							<input bind:this={clusterNameInput} bind:value={clusterNameDraft} aria-label="Cluster name" onkeydown={onClusterNameKeyDown} />
						</label>
						<div class="group-actions">
							<button type="submit" class="primary-action" disabled={!clusterNameDraft.trim() || clusterNameDraft.trim() === store.selectedCluster.name}>Save name</button>
							<button type="button" class="danger-action" onclick={ungroupSelection}>Ungroup</button>
						</div>
					</form>
				{/key}
			{:else}
				<p class="group-hint" id="group-selection-hint">
					{#if selectionContainsClusteredPlacement}
						Selected objects must be ungrouped before creating another cluster.
					{:else if store.selectedPlacementIds.length === 1}
						Select one more object to create a cluster.
					{:else}
						Ready to create a folder-style cluster from this selection.
					{/if}
				</p>
				<button type="button" class="group-button" disabled={!canGroupSelection} aria-describedby="group-selection-hint" onclick={() => void groupSelection()}>
					{store.selectedPlacementIds.length >= 2 ? `Group ${store.selectedPlacementIds.length} objects` : 'Group selection'}
				</button>
			{/if}
		</section>

		{#if !store.selectedCluster && store.selectedPlacementIds.length > 1}
			<section class="selection" aria-label="Multiple selection">
				<p>{store.selectedPlacementIds.length} objects selected. Numeric transforms are available for a single object.</p>
				<button type="button" class="deselect" onclick={() => store.selectionActions.deselect()}>Clear selection</button>
			</section>
		{:else if singleEditableObject}
			<section class="selection" aria-label="Selection">
				<dl>
					<div><dt>Asset</dt><dd class="id">{singleEditableObject.assetId}</dd></div>
				</dl>
				<!-- P23.14 §13 — the raw Scene IDs (entity id, owning Room id) are
					diagnosis, so they live behind Technical details instead of the
					normal identity surface. -->
				<details class="technical-details" bind:open={sceneTechnicalDetailsOpen}>
					<summary>Technical details</summary>
					<span class="technical-id">{singleEditableObject.id}</span>
					{#if singleEditableObject.roomId}<span class="technical-id">Room {singleEditableObject.roomId}</span>{/if}
				</details>
				<button type="button" class="deselect" onclick={() => store.selectionActions.deselect()}>Deselect object</button>
			</section>
			{#key singleEditableObject.id}
				<EditorTransformInspector {store} />
				<EditorMaterialInspector {store} />
			{/key}
		{:else if singlePrimitive}
			<section class="selection" aria-label="Selection">
				<button type="button" class="deselect" onclick={() => store.selectionActions.deselect()}>Deselect object</button>
			</section>
			{#key singlePrimitive.id}
				<EditorPrimitiveInspector {store} />
				<EditorMaterialInspector {store} />
				<EditorTransformInspector {store} />
			{/key}
		{:else if singleLight}
			<section class="selection" aria-label="Selection">
				<button type="button" class="deselect" onclick={() => store.selectionActions.deselect()}>Deselect object</button>
			</section>
			{#key singleLight.id}
				<EditorLightInspector {store} />
				<EditorTransformInspector {store} />
			{/key}
		{:else if singleSelectedEntity}
			<section class="selection" aria-label="Selection">
				<details class="technical-details" bind:open={sceneTechnicalDetailsOpen}>
					<summary>Technical details</summary>
					<span class="technical-id">{singleSelectedEntity.id}</span>
					{#if singleSelectedEntity.roomId}<span class="technical-id">Room {singleSelectedEntity.roomId}</span>{/if}
				</details>
				<button type="button" class="deselect" onclick={() => store.selectionActions.deselect()}>Deselect object</button>
			</section>
			{#key singleSelectedEntity.id}<EditorTransformInspector {store} />{/key}
		{/if}

		<section class="placement-actions" aria-label="Placement actions">
			<h2>Placement actions</h2>
			<div>
				<button type="button" disabled={!canDuplicateSelection} onclick={() => store.duplicateSelection()}>Duplicate{store.selectedPlacementIds.length > 1 ? ` ${store.selectedPlacementIds.length}` : ''}</button>
				<button type="button" class="delete" onclick={() => store.deleteSelection()}>Delete{store.selectedPlacementIds.length > 1 ? ` ${store.selectedPlacementIds.length}` : ''}</button>
			</div>
			<p>Cmd/Ctrl+D duplicates · Delete removes · Undo restores</p>
		</section>

		<EditorPlacementInspector {store} />
		{/if}
	{:else}
		<section class="empty-selection" aria-label="Editor help">
			<h2>No selection</h2>
			<p>Choose a room, object, cluster, camera node, path, or asset to inspect its settings.</p>
			{#if store.statusMessage}<p class="status" role="status">{store.statusMessage}</p>{/if}
		</section>
	{/if}

	{#if readOnly}
		<p class="plan-footer-note">
			<span class="plan-footer-note__icon"><Lightbulb size={13} aria-hidden="true" /></span>
			Plan edits affect geometry and layout only. Open in 3D to place scenes and cameras.
		</p>
	{/if}

</aside>

<style>
	.panel { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 1.1rem; overflow: auto; background: var(--editor-bg-panel); }
	/* P21.6 Slice C — collapsed panels clip to the zero-width grid track
	   (the track carries the collapse; this only clips contents). Combined
	   with `inert`; zero-width alone never removes keyboard focus. */
	.panel.collapsed { overflow: hidden; visibility: hidden; min-width: 0; }
	.inspector { border-left: 1px solid var(--editor-border-subtle); }
	/* Atlas `.section h3` — the engraved 10 px tier, +0.04em. */
	header h2, section h2 { margin: 0; font: var(--editor-type-engraved); letter-spacing: 0.04em; text-transform: uppercase; color: var(--editor-text-muted); }
	/* P23.14 §13 — property-first selection header: kind icon, name-or-reference,
	   the secondary reference when a name leads, and the kind stated separately.
	   No summary block and no prose lead: the panel opens on the selection. */
	.inspector-header { display: flex; min-width: 0; align-items: flex-start; gap: 0.4rem; }
	.inspector-header__icon { display: inline-flex; flex: 0 0 auto; margin-top: 0.1rem; color: var(--editor-text-muted); }
	.inspector-header__text { display: flex; min-width: 0; flex-direction: column; gap: 0.12rem; }
	.inspector-header__title {
		overflow: hidden;
		color: var(--editor-text-primary);
		/* Atlas `.selection-head h2` — 15 px/600 panel-heading tier. */
		font: var(--editor-type-heading);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.inspector-header__reference {
		color: var(--editor-text-muted);
		font: var(--editor-type-ref);
		letter-spacing: 0.01em;
		white-space: nowrap;
	}
	.inspector-header__kind {
		color: var(--editor-text-muted);
		font-size: var(--editor-font-size-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	section { display: flex; flex-direction: column; gap: 0.55rem; }
	.id { font-family: var(--editor-font); font-size: 0.75rem; overflow-wrap: anywhere; }
	.layout-inspector { display: flex; flex-direction: column; gap: 0.8rem; }
	.layout-inspector-note { margin: 0; color: var(--editor-text-secondary); font-size: 0.7rem; line-height: 1.45; }
	.layout-primer { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.6rem 0.65rem; border: 1px solid var(--editor-border-subtle); border-radius: 0.4rem; background: var(--editor-bg-panel-raised); }
	.layout-primer strong { font-size: 0.74rem; font-weight: 650; letter-spacing: 0.02em; color: var(--editor-text-primary); }
	.layout-primer p { margin: 0; color: var(--editor-text-secondary); font-size: 0.7rem; line-height: 1.45; }
	.layout-primer-tip { color: var(--editor-text-muted); }
	.layout-accordion { display: flex; flex-direction: column; gap: 0.45rem; padding: 0.55rem; border: 1px solid var(--editor-border-subtle); border-radius: 0.4rem; background: var(--editor-bg-panel-raised); }
	.accordion-trigger { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0.2rem 0; border: 0; background: transparent; color: var(--editor-text-primary); font: inherit; font-size: 0.75rem; cursor: pointer; }
	.accordion-trigger span { color: var(--editor-accent); font-size: 1rem; }
	.place-tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.35rem; }
	.place-tools button { padding: 0.4rem 0.3rem; border: 1px solid var(--editor-border-normal); border-radius: 0.3rem; background: var(--editor-bg-control); color: var(--editor-text-primary); font: inherit; font-size: 0.68rem; cursor: pointer; }
	.place-tools button:disabled { opacity: 0.4; cursor: default; }
	.layout-object-list { display: flex; flex-direction: column; gap: 0.3rem; }
	.layout-empty { color: var(--editor-text-muted); font-size: 0.68rem; }
	.layout-object-row { display: flex; align-items: stretch; gap: 0.3rem; }
	.layout-object-row.selected { outline: 1px solid var(--editor-accent); border-radius: 0.3rem; }
	.object-row-select { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 0.12rem; padding: 0.38rem; border: 1px solid var(--editor-border-normal); border-radius: 0.3rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-primary); text-align: left; cursor: pointer; }
	.object-row-select span { overflow-wrap: anywhere; color: var(--editor-text-secondary); font: 0.62rem var(--editor-font); }
	.object-row-delete { padding: 0.3rem; border: 1px solid var(--editor-danger-border); border-radius: 0.3rem; background: var(--editor-danger-soft); color: var(--editor-danger-fg); font: inherit; font-size: 0.64rem; cursor: pointer; }
	.object-row-delete:disabled { opacity: 0.4; cursor: default; }
	.layout-selection-content { display: flex; flex-direction: column; gap: 0.5rem; }
	.layout-selected-room { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.6rem; border: 1px solid var(--editor-accent-border); border-radius: 0.35rem; background: var(--editor-bg-selected); color: var(--editor-text-primary); font-size: 0.7rem; }
	.layout-selected-room span { color: var(--editor-text-secondary); font-size: 0.66rem; overflow-wrap: anywhere; }
	.layout-selected-room label { display: flex; flex-direction: column; gap: 0.25rem; color: var(--editor-text-secondary); font-size: 12px; font-weight: 400; }
	.layout-align-fields .layout-align-actions { display: flex; flex-wrap: wrap; gap: 0.25rem; }
	.layout-align-fields .layout-align-actions button { padding: 0.2rem 0.45rem; border: 1px solid var(--editor-border-normal); border-radius: 0.25rem; background: var(--editor-bg-control); color: var(--editor-text-primary); font: inherit; font-size: 0.65rem; cursor: pointer; }
	.layout-align-fields .layout-align-actions button:hover { background: var(--editor-bg-control-hover, var(--editor-bg-panel-raised)); }
	.layout-selected-room input, .layout-selected-room select { box-sizing: border-box; width: 100%; padding: 0.34rem; border: 1px solid var(--editor-border-normal); border-radius: 0.28rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-primary); font: 500 12.5px var(--editor-font); font-variant-numeric: tabular-nums; }
	.layout-selected-room input:focus, .layout-selected-room select:focus { outline: 1px solid var(--editor-accent); border-color: var(--editor-accent); }
	.layout-selected-room input:disabled, .layout-selected-room select:disabled, .layout-danger:disabled { opacity: 0.48; cursor: default; }
	.layout-opening-actions { display: flex; gap: 0.35rem; }
	.layout-opening-actions button, .layout-danger { padding: 0.4rem 0.5rem; border: 1px solid var(--editor-accent-border); border-radius: 0.28rem; background: var(--editor-bg-selected); color: var(--editor-text-primary); font: inherit; font-size: 0.68rem; cursor: pointer; }
	.layout-danger { border-color: var(--editor-danger-border); background: var(--editor-danger-soft); color: var(--editor-danger-fg); }
	.layout-opening-warning { margin: 0; color: var(--editor-danger-fg); font-size: 0.66rem; }
	.layout-issues { max-height: 12rem; overflow: auto; padding: 0.55rem; border: 1px solid var(--editor-danger-border); border-radius: 0.35rem; background: var(--editor-danger-soft); color: var(--editor-danger-fg); font-size: 0.68rem; line-height: 1.4; }
	.layout-issues ul { display: flex; flex-direction: column; gap: 0.35rem; margin: 0.4rem 0 0; padding-left: 1rem; }
	.layout-issues code { color: var(--editor-text-primary); font-size: 0.63rem; }
	.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
	.asset-details { padding: 0.75rem; border: 1px solid var(--editor-border-subtle); border-radius: 0.4rem; background: var(--editor-bg-panel-raised); }
	.asset-details > div > .id { margin: 0.2rem 0 0; color: var(--editor-text-muted); font-size: 0.66rem; }
	.asset-details dl, .selection dl { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
	.asset-details dl div { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr); gap: 0.4rem; }
	.asset-details dt, .selection dt { color: var(--editor-text-secondary); font-size: 12px; font-weight: 400; }
	.asset-details dd { min-width: 0; margin: 0; color: var(--editor-text-primary); font-size: 12.5px; font-weight: 500; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
	.place { padding: 0.48rem 0.6rem; border: 1px solid var(--editor-accent-border); border-radius: 0.32rem; background: var(--editor-bg-control); color: var(--editor-text-primary); font: inherit; font-size: 0.73rem; cursor: pointer; }
	.place.active { background: var(--editor-bg-selected); box-shadow: inset 0 0 0 1px var(--editor-accent); }
	.unsupported, .empty-selection p { margin: 0; color: var(--editor-text-secondary); font-size: 0.72rem; line-height: 1.4; }
	/* S10.1 — Plan read-only info card + footer note (concept-sketch copy). */
	.plan-readonly-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--editor-accent-border);
		border-radius: 0.45rem;
		background: var(--editor-bg-panel-raised);
	}
	.plan-readonly-head { display: flex; align-items: center; gap: 0.45rem; color: var(--editor-accent-hover); }
	.plan-readonly-head h2 { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--editor-text-muted); }
	.plan-readonly-card p { margin: 0; color: var(--editor-text-secondary); font-size: 0.72rem; line-height: 1.4; }
	.plan-readonly-more {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		align-self: flex-start;
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--editor-border-strong);
		border-radius: 0.3rem;
		background: transparent;
		color: var(--editor-text-secondary);
		font: inherit;
		font-size: 0.68rem;
		cursor: pointer;
	}
	.plan-readonly-more:hover { border-color: var(--editor-accent-border); color: var(--editor-text-primary); }
	.staging-selection { display: flex; flex-direction: column; gap: 0.65rem; }
	.staging-selection p { margin: 0; color: var(--editor-text-muted); font-size: 0.72rem; line-height: 1.4; overflow-wrap: anywhere; }
	.staging-selection p strong { color: var(--editor-text-primary); font-size: 0.82rem; }
	.staging-badge { border: 1px solid var(--editor-border-strong); border-radius: 999px; padding: 0.12rem 0.38rem; color: var(--editor-text-secondary); font-size: 0.6rem; }
	.staging-selection .staging-warning { color: var(--editor-danger-fg); }
	.staging-selection .staging-status { color: var(--editor-text-secondary); }
	.staging-transform-fields { margin: 0; border: 1px solid var(--editor-border-subtle); border-radius: 0.35rem; padding: 0.55rem; }
	.staging-transform-fields legend { padding: 0 0.3rem; color: var(--editor-text-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
	.staging-field-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; }
	.plan-footer-note {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		margin: 0;
		padding-top: 0.7rem;
		border-top: 1px solid var(--editor-border-subtle);
		color: var(--editor-text-muted);
		font-size: 0.68rem;
		line-height: 1.4;
	}
	.plan-footer-note__icon { display: inline-flex; flex: 0 0 auto; margin-top: 0.05rem; color: var(--editor-accent); }
	.deselect { padding: 0.38rem 0.5rem; border: 1px solid var(--editor-border-normal); border-radius: 0.32rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-primary); font: inherit; font-size: 0.72rem; cursor: pointer; }
	.selection dl div { display: flex; flex-direction: column; gap: 0.1rem; }
	.selection dd { margin: 0; color: var(--editor-text-primary); font-size: 12.5px; font-weight: 500; font-variant-numeric: tabular-nums; }
	.selection p { margin: 0; color: var(--editor-text-secondary); font-size: 0.75rem; line-height: 1.4; }
	.grouping { padding: 0.85rem; border: 1px solid var(--editor-border-subtle); border-radius: 0.45rem; background: var(--editor-bg-panel-raised); }
	.grouped-badge { padding: 0.18rem 0.42rem; border: 1px solid var(--editor-accent-border); border-radius: 999px; background: var(--editor-bg-selected); color: var(--editor-text-primary); font-size: 0.65rem; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; }
	.group-summary { display: flex; flex-direction: column; gap: 0.12rem; margin: 0; }
	.group-summary strong { font-size: 0.82rem; }
	.group-summary span, .group-hint { color: var(--editor-text-secondary); font-size: 0.72rem; line-height: 1.4; }
	.group-hint { margin: 0; }
	.rename-form { display: flex; flex-direction: column; gap: 0.55rem; }
	.rename { display: flex; flex-direction: column; gap: 0.3rem; color: var(--editor-text-secondary); font-size: 0.75rem; }
	.rename input { padding: 0.4rem; border: 1px solid var(--editor-border-normal); border-radius: 0.3rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-primary); font: 500 12.5px var(--editor-font); }
	.rename input:focus { outline: 1px solid var(--editor-accent); border-color: var(--editor-accent); }
	.group-actions { display: flex; gap: 0.4rem; }
	.group-button, .primary-action, .danger-action { padding: 0.46rem 0.58rem; border: 1px solid var(--editor-border-normal); border-radius: 0.32rem; background: var(--editor-bg-control); color: var(--editor-text-primary); font: inherit; font-size: 0.73rem; cursor: pointer; }
	.group-button { align-self: flex-start; }
	.primary-action { border-color: var(--editor-accent-border); }
	.danger-action { background: var(--editor-danger-soft); color: var(--editor-danger-fg); }
	.group-button:disabled, .primary-action:disabled { opacity: 0.4; cursor: default; }
	.placement-actions { padding: 0.75rem; border: 1px solid var(--editor-border-subtle); border-radius: 0.45rem; background: var(--editor-bg-panel-raised); }
	.placement-actions div { display: flex; gap: 0.4rem; }
	.placement-actions button { flex: 1; padding: 0.44rem; border: 1px solid var(--editor-border-normal); border-radius: 0.32rem; background: var(--editor-bg-control); color: var(--editor-text-primary); font: inherit; font-size: 0.72rem; cursor: pointer; }
	.placement-actions button.delete { border-color: var(--editor-danger-border); background: var(--editor-danger-soft); color: var(--editor-danger-fg); }
	.placement-actions p { margin: 0; color: var(--editor-text-muted); font-size: 0.67rem; line-height: 1.4; }
	.deselect { align-self: flex-start; }

	@media (max-width: 62rem) {
		.panel { min-height: 0; max-height: 34rem; border-top: 1px solid var(--editor-border-subtle); }
		.inspector { border-left: 1px solid var(--editor-border-subtle); }
	}
	@media (max-width: 44rem) {
		.panel { max-height: 30rem; border-left: 0; }
	}
</style>
