<script lang="ts">
	import { ExternalLink, Info, Lightbulb } from 'lucide-svelte';
	import { resolveAssetFallback } from '$lib/content/assets';
	import { isSceneLightEntity, isSceneModelEntity, isScenePrimitiveEntity } from '$lib/content/scene';
	import type { Asset } from '$lib/types/assets';
	import { tick } from 'svelte';
	import type { EditorWorkspace } from './editor-types';
	import EditorCameraInspector from './camera/EditorCameraInspector.svelte';
	import CameraPlanInspector from './app/CameraPlanInspector.svelte';
	import type { EditorViewState } from './app/editor-view-state.svelte';
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
		layoutPreviewSourceLabel,
		layoutPreviewStatusLabel,
		layoutRoomSceneReferenceSummary,
		layoutRoomSceneReferenceTotal,
		listLayoutRoomSceneReferences,
		repeatWallFirstObject,
		repeatWallFirstOpening,
		updateWallFirstOpening,
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
	// panel domain: the active selection when one is provided and a
	// domain is active (S3 view-switch preservation), else the legacy workspace.
	const scenePlanStaging = $derived(
		viewMode === 'plan' &&
		viewState?.domain === 'scene' &&
		layoutInteraction.planViewMode === 'staging'
	);
	// P10 — Arrange (staging) is owner-aware: an active Layout-object target
	// shows the layout owner's panel; otherwise the Scene owner's Arrange panel.
	const domain = $derived<EditorWorkspace>(
		scenePlanStaging
			? activeSelection && activeSelection.active.domain === 'layout'
				? 'layout'
				: 'scene'
			: activeSelection && activeSelection.active.domain !== 'none'
				? activeSelection.active.domain
				: store.currentWorkspace
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
		Boolean(store.selectedCluster) || store.selectedPlacementIds.length > 0
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
	const isWallFirstLayout = $derived(wallFirstLayout !== null);
	const layoutRooms = $derived('floors' in layoutDocument ? layoutDocument.floors.flatMap((floor) => floor.rooms) : []);
	type PrecisionTarget =
		| { kind: 'junction'; id: string }
		| { kind: 'wall'; id: string }
		| { kind: 'room'; id: string }
		| null;
	let precisionTarget = $state<PrecisionTarget>(null);
	let precisionFixedEndpoint = $state<'start' | 'end'>('start');
	let precisionRectangleAnchor = $state<string | null>(null);
	let precisionRectangleWidthWall = $state<string | null>(null);
	const precisionTargetKind = $derived(precisionTarget?.kind ?? null);
	const precisionTargetId = $derived(precisionTarget?.id ?? null);
	const selectedPrecisionJunction = $derived(
		wallFirstLayout && precisionTargetKind === 'junction' && precisionTargetId
			? wallFirstLayout.junctions.find((junction) => junction.id === precisionTargetId)
			: undefined
	);
	const selectedPrecisionWall = $derived(
		wallFirstLayout && precisionTargetKind === 'wall' && precisionTargetId
			? wallFirstLayout.walls.find((wall) => wall.id === precisionTargetId)
			: undefined
	);
	const selectedPrecisionRoom = $derived(
		wallFirstLayout && precisionTargetKind === 'room' && precisionTargetId
			? wallFirstLayout.rooms.find((room) => room.id === precisionTargetId)
			: undefined
	);
	const selectedPrecisionWallEndpoints = $derived(
		selectedPrecisionWall && wallFirstLayout
			? precisionWallEndpoints(wallFirstLayout, selectedPrecisionWall)
			: null
	);
	const selectedPrecisionRectangle = $derived(
		selectedPrecisionRoom && wallFirstLayout
			? precisionRectangleMetrics(wallFirstLayout, selectedPrecisionRoom)
			: null
	);
	const precisionRectangleWidthWallOptions = $derived.by(() => {
		if (!wallFirstLayout || !selectedPrecisionRoom) return [];
		const resolved = resolveRectangle(
			wallFirstLayout,
			selectedPrecisionRoom.id,
			precisionRectangleAnchor ? { anchorJunctionId: precisionRectangleAnchor } : {}
		);
		if ('rejection' in resolved) return [];
		return [resolved.widthWallId, resolved.depthWallId];
	});
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

	$effect(() => {
		if (!wallFirstLayout) {
			precisionTarget = null;
			return;
		}
		const target = precisionTarget;
		if (!target) return;
		if (target.kind === 'junction' && !wallFirstLayout.junctions.some((junction) => junction.id === target.id)) precisionTarget = null;
		if (target.kind === 'wall' && !wallFirstLayout.walls.some((wall) => wall.id === target.id)) precisionTarget = null;
		if (target.kind === 'room') {
			const room = wallFirstLayout.rooms.find((candidate) => candidate.id === target.id);
			const rectangle = room ? precisionRectangleMetrics(wallFirstLayout, room) : null;
			const invalidAnchor = Boolean(precisionRectangleAnchor && (!rectangle || !rectangle.cornerIds.includes(precisionRectangleAnchor)));
			const invalidWidthWall = Boolean(precisionRectangleWidthWall && (!rectangle || rectangle.widthWallId !== precisionRectangleWidthWall));
			if (!room || invalidAnchor || invalidWidthWall) {
				precisionRectangleAnchor = null;
				precisionRectangleWidthWall = null;
				precisionTarget = null;
			}
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
		// A failed operation restores prior selection; success may select the
		// first new Room through the existing authority.
		if (committed.createdRoomId) {
			precisionTarget = { kind: 'room', id: committed.createdRoomId };
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
			.map((object) => ({ kind: 'object' as const, id: object.id, label: `${object.kind} · ${object.id}` }));
	});

	const alignRoomOptions = $derived.by<AlignReferenceOption[]>(() => {
		if (!selectedLayoutObject?.roomId) return [];
		return [{ kind: 'room' as const, id: selectedLayoutObject.roomId, label: `Room bounds · ${selectedLayoutObject.roomId}` }];
	});

	const alignWallOptions = $derived.by<AlignReferenceOption[]>(() => {
		if (!selectedLayoutObject?.roomId) return [];
		const room = layoutRooms.find((candidate) => candidate.id === selectedLayoutObject.roomId);
		if (!room) return [];
		return room.boundary.segments.map((segment) => ({
			kind: 'wall' as const,
			id: segment.id,
			label: `Wall · ${segment.id}`
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

	function selectPrecisionTarget(target: Exclude<PrecisionTarget, null>): void {
		precisionTarget = target;
		if (target.kind === 'room') {
			precisionRectangleAnchor = null;
			precisionRectangleWidthWall = null;
		}
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

	function updatePrecisionJunction(index: 0 | 1, event: Event): void {
		const junction = selectedPrecisionJunction;
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
		store.setStatusMessage(outcome.result.success ? `Updated Junction ${junction.id}` : `Junction rejected: ${outcome.result.message}`);
	}

	function updatePrecisionWallLength(event: Event): void {
		const wall = selectedPrecisionWall;
		const endpoints = selectedPrecisionWallEndpoints;
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
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wall.id} length` : `Wall rejected: ${outcome.result.message}`);
	}

	function updatePrecisionWallAngle(event: Event): void {
		const wall = selectedPrecisionWall;
		const endpoints = selectedPrecisionWallEndpoints;
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
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wall.id} angle` : `Wall rejected: ${outcome.result.message}`);
	}

	function updatePrecisionWallThickness(event: Event): void {
		const wall = selectedPrecisionWall;
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
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wall.id} thickness` : `Wall rejected: ${outcome.result.message}`);
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
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wall.id} length` : `Wall rejected: ${outcome.result.message}`);
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
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wall.id} angle` : `Wall rejected: ${outcome.result.message}`);
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
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wall.id} thickness` : `Wall rejected: ${outcome.result.message}`);
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
		store.setStatusMessage(outcome.result.success ? `Updated Wall ${wall.id} height` : `Wall rejected: ${outcome.result.message}`);
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
				? `Wall ${wall.id} ${role === 'boundary' ? 'defines' : 'no longer defines'} a room boundary`
				: `Wall role rejected: ${outcome.result.message}`
		);
	}

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
		store.setStatusMessage(outcome.result.success ? `Updated Junction ${junction.id}` : `Junction rejected: ${outcome.result.message}`);
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

	function addPrecisionVertex(event: Event): void {
		const wall = selectedPrecisionWall;
		const endpoints = selectedPrecisionWallEndpoints;
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
		store.setStatusMessage(outcome.result.success ? `Added Vertex to Wall ${wall.id}` : `Vertex rejected: ${outcome.result.message}`);
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
		store.setStatusMessage(outcome.result.success ? `Updated Room ${room.id} ${metric}` : `Rectangle rejected: ${outcome.result.message}`);
	}

	function precisionWallEndpoints(layout: LayoutDocumentWallFirst, wall: LayoutWall): { start: LayoutJunction; end: LayoutJunction; length: number; angleDegrees: number } | null {
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

</script>

<aside bind:this={inspectorElement} class="panel inspector" class:collapsed aria-label="Inspector" style="grid-area: right;" inert={collapsed}>
	<header>
		<h2>Inspector</h2>
		{#if domain === 'layout'}
			<p>Layout Plan editing · preview-only</p>
		{:else if showAssetInspector}
			<p>{selectedAsset ? 'Asset library selection' : 'No asset matches the current filters.'}</p>
		{:else if selectedNavigation?.kind === 'node' && selectedCameraNode}
			<p class="id">{selectedCameraNode.id} · {store.isPendingNavigationNode(selectedCameraNode.id) ? 'pending' : store.cameraSelection?.handle}</p>
		{:else if selectedNavigation?.kind === 'connection'}
			<p class="id">{selectedNavigation.connectionId} · connection</p>
		{:else if selectedNavigation?.kind === 'anchor'}
			<p class="id">{selectedNavigation.anchorId} · anchor</p>
		{:else if selectedNavigation?.kind === 'view-keyframe'}
			<p class="id">{selectedNavigation.keyframeId} · {selectedNavigation.direction} view</p>
		{:else if store.selectedCluster}
			<p>{store.selectedCluster.name} · {store.selectedPlacementIds.length} selected</p>
		{:else if store.selectedPlacementIds.length > 1}
			<p>{store.selectedPlacementIds.length} selected</p>
		{:else if selectedObject}
			<p class="id">{selectedObject.id}</p>
		{:else if store.selectedRoomId}
			<p>{store.selectedRoomId} centered. Select an object or camera to edit it.</p>
		{:else}
			<p>Select a room or place a shape to begin editing.</p>
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
			<dl>
				<div><dt>Project</dt><dd>{layoutPreview.project.name}</dd></div>
				<div><dt>Source</dt><dd>{layoutPreviewSourceLabel(layoutPreview.source)}</dd></div>
				<div><dt>Status</dt><dd>{layoutPreviewStatusLabel(layoutPreview)}</dd></div>
				<div><dt>Rooms</dt><dd>{layoutPreview.model.rooms.length}</dd></div>
				<div><dt>Objects</dt><dd>{layoutPreview.model.objects.length}</dd></div>
				<div><dt>Issues</dt><dd>{layoutPreview.issues.length}</dd></div>
			</dl>
			{#if layoutPreview.importError}<p class="layout-opening-warning" role="alert">Import failed: {layoutPreview.importError}</p>{/if}
			<p class="layout-inspector-note">Openings are geometry-only in this phase. No room adjacency or portal semantics are inferred.</p>
			{#if isWallFirstLayout}<p class="layout-inspector-note">Wall-first layout: use Architecture · exact for Junctions, Walls, Rooms, and existing object transforms. Door and Window place canonical Openings on a Wall; Column, Platform and Plinth place ordinary objects; legacy room and primitive placement is unavailable.</p>{/if}

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

				{#if isWallFirstLayout && wallFirstLayout}
				<div class="layout-accordion" aria-label="Wall-first exact authoring">
					<div class="accordion-trigger"><strong>Architecture · exact</strong><span>m / °</span></div>
					<div class="layout-selection-content">
						<p class="layout-inspector-note">Exact values are document meters and degrees. Snap is bypassed; Apply/Enter creates one layout history entry.</p>
						<div class="layout-object-list" aria-label="Wall-first Junctions">
							<strong>Junctions</strong>
							{#if wallFirstLayout.junctions.length === 0}<span class="layout-empty">No Junctions.</span>{/if}
							{#each wallFirstLayout.junctions as junction (junction.id)}
								<button type="button" class:selected={precisionTarget?.kind === 'junction' && precisionTarget.id === junction.id} class="object-row-select" onclick={() => selectPrecisionTarget({ kind: 'junction', id: junction.id })}><strong>{junction.id}</strong><span>{junction.point[0].toFixed(2)}, {junction.point[1].toFixed(2)}</span></button>
							{/each}
						</div>
						<div class="layout-object-list" aria-label="Wall-first Walls">
							<strong>Walls</strong>
							{#if wallFirstLayout.walls.length === 0}<span class="layout-empty">No Walls.</span>{/if}
							{#each wallFirstLayout.walls as wall (wall.id)}
								<button type="button" class:selected={precisionTarget?.kind === 'wall' && precisionTarget.id === wall.id} class="object-row-select" onclick={() => selectPrecisionTarget({ kind: 'wall', id: wall.id })}><strong>{wall.id}</strong><span>{wall.startJunctionId} → {wall.endJunctionId}</span></button>
							{/each}
						</div>
						<div class="layout-object-list" aria-label="Wall-first Rooms">
							<strong>Rooms</strong>
							{#if wallFirstLayout.rooms.length === 0}<span class="layout-empty">No Rooms.</span>{/if}
							{#each wallFirstLayout.rooms as room (room.id)}
								<button type="button" class:selected={precisionTarget?.kind === 'room' && precisionTarget.id === room.id} class="object-row-select" onclick={() => selectPrecisionTarget({ kind: 'room', id: room.id })}><strong>{room.name}</strong><span>{room.id}</span></button>
							{/each}
						</div>

						{#if selectedPrecisionJunction}
							<div class="layout-selected-room" aria-label="Exact Junction editor">
								<strong>Junction {selectedPrecisionJunction.id}</strong>
								<span>Connected Wall geometry follows this Junction.</span>
								<label>X (m)<input type="number" step="any" value={formatMeters(selectedPrecisionJunction.point[0])} onchange={(event) => updatePrecisionJunction(0, event)} /></label>
								<label>Z (m)<input type="number" step="any" value={formatMeters(selectedPrecisionJunction.point[1])} onchange={(event) => updatePrecisionJunction(1, event)} /></label>
								{#if layoutPreview.lastMutationMessage}<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>{/if}
							</div>
						{:else if selectedPrecisionWall && selectedPrecisionWallEndpoints}
							<div class="layout-selected-room" aria-label="Exact Wall editor">
								<strong>Wall {selectedPrecisionWall.id}</strong>
								<span>Canonical: {selectedPrecisionWallEndpoints.start.id} → {selectedPrecisionWallEndpoints.end.id}</span>
								<span>Start {selectedPrecisionWallEndpoints.start.point[0].toFixed(3)}, {selectedPrecisionWallEndpoints.start.point[1].toFixed(3)} · End {selectedPrecisionWallEndpoints.end.point[0].toFixed(3)}, {selectedPrecisionWallEndpoints.end.point[1].toFixed(3)}</span>
								<label>Fixed endpoint<select value={precisionFixedEndpoint} onchange={(event) => precisionFixedEndpoint = (event.currentTarget as HTMLSelectElement).value as 'start' | 'end'}><option value="start">Start</option><option value="end">End</option></select></label>
								<label>Length (m)<input type="number" step="any" value={formatMeters(selectedPrecisionWallEndpoints.length)} onchange={updatePrecisionWallLength} /></label>
								<label>Angle (°)<input type="number" step="any" value={formatDegrees(selectedPrecisionWallEndpoints.angleDegrees)} onchange={updatePrecisionWallAngle} /></label>
								<label>Thickness (m)<input type="number" step="any" value={formatMeters(selectedPrecisionWall.thickness)} onchange={updatePrecisionWallThickness} /></label>
								<label>Add Vertex at (m)<input type="number" step="any" value={formatMeters(selectedPrecisionWallEndpoints.length / 2)} onchange={addPrecisionVertex} /></label>
								<span>Openings stay on physical Wall meters and are rejected if the edit would make them invalid.</span>
								{#if layoutPreview.lastMutationMessage}<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>{/if}
							</div>
						{:else if selectedPrecisionRoom && selectedPrecisionRectangle}
							<div class="layout-selected-room" aria-label="Exact rectangle editor">
								<strong>Rectangle {selectedPrecisionRoom.name}</strong>
								<span>Four boundary Walls · shared-boundary edits reject when ambiguous.</span>
								<label>Anchor Junction<select value={precisionRectangleAnchor ?? selectedPrecisionRectangle.anchorId} onchange={(event) => precisionRectangleAnchor = (event.currentTarget as HTMLSelectElement).value || null}>{#each selectedPrecisionRectangle.cornerIds as id}<option value={id}>{id}</option>{/each}</select></label>
								<label>Width Wall<select value={precisionRectangleWidthWall ?? selectedPrecisionRectangle.widthWallId} onchange={(event) => precisionRectangleWidthWall = (event.currentTarget as HTMLSelectElement).value || null}>{#each precisionRectangleWidthWallOptions as wallId}<option value={wallId}>{wallId}</option>{/each}</select></label>
								<label>Width (m)<input type="number" min="0.001" step="0.01" value={selectedPrecisionRectangle.width} onchange={(event) => updatePrecisionRectangle('width', event)} /></label>
								<label>Depth (m)<input type="number" min="0.001" step="0.01" value={selectedPrecisionRectangle.depth} onchange={(event) => updatePrecisionRectangle('depth', event)} /></label>
								<label>Duplicate Δ X (m)<input type="number" step="0.1" value={roomDuplicateDeltaX} onchange={(event) => { roomDuplicateTouched = true; roomDuplicateDeltaX = Number((event.currentTarget as HTMLInputElement).value); }} /></label>
								<label>Duplicate Δ Z (m)<input type="number" step="0.1" value={roomDuplicateDeltaZ} onchange={(event) => { roomDuplicateTouched = true; roomDuplicateDeltaZ = Number((event.currentTarget as HTMLInputElement).value); }} /></label>
								<button type="button" onclick={duplicateSelectedPrecisionRoom}>Duplicate room</button>
								{#if layoutPreview.lastMutationMessage}<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>{/if}
							</div>
						{/if}
					</div>
				</div>
				{#if layoutPreview.issues.length > 0}
				<div class="layout-accordion" aria-label="Wall-first topology diagnostics">
					<div class="accordion-trigger"><strong>Topology diagnostics</strong><span>{layoutPreview.issues.length}</span></div>
					<div class="layout-selection-content">
						<p class="layout-inspector-note">Committed geometry the compiler flagged. Select a source to inspect it on Plan; nothing here auto-repairs.</p>
						<div class="layout-object-list" aria-label="Topology diagnostics">
							{#each layoutPreview.issues as issue (issue.code + (issue.targetId ?? ''))}
								{#if issue.targetId && wallFirstLayout && (wallFirstLayout.walls.some((wall) => wall.id === issue.targetId) || wallFirstLayout.junctions.some((junction) => junction.id === issue.targetId))}
									<button type="button" class="object-row-select" onclick={() => selectDiagnosticTarget(issue.targetId!)}><strong>{issue.code}</strong><span>{issue.targetId} · {issue.message}</span></button>
								{:else}
									<span class="layout-empty">{issue.code}{issue.targetId ? ` · ${issue.targetId}` : ''} · {issue.message}</span>
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
					<div class="object-room-meta"><span>Room ownership</span><strong>{layoutRooms.find((room) => room.id === selectedLayoutObject.roomId)?.name ?? 'Unassigned'} · {selectedLayoutObject.roomId ?? 'none'}</strong></div>
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
					<strong>Wall {selectedWallFirstWall.id}</strong>
					<span>{selectedWallFirstWall.role === 'boundary' ? 'Defines a room boundary' : 'Partition — does not divide rooms'}</span>
					<span>{selectedWallFirstWallEndpoints.start.id} → {selectedWallFirstWallEndpoints.end.id} · {selectedWallFirstWallEndpoints.length.toFixed(2)} m</span>
					<label>Fixed endpoint<select value={precisionFixedEndpoint} onchange={(event) => precisionFixedEndpoint = (event.currentTarget as HTMLSelectElement).value as 'start' | 'end'}><option value="start">Start</option><option value="end">End</option></select></label>
					<label>Length (m)<input type="number" step="any" value={formatMeters(selectedWallFirstWallEndpoints.length)} onchange={updateSelectedWallLength} /></label>
					<label>Angle (°)<input type="number" step="any" value={formatDegrees(selectedWallFirstWallEndpoints.angleDegrees)} onchange={updateSelectedWallAngle} /></label>
					<label>Thickness (m)<input type="number" step="any" value={formatMeters(selectedWallFirstWall.thickness)} onchange={updateSelectedWallThickness} /></label>
					<label>Height (m)<input type="number" step="any" value={formatMeters(selectedWallFirstWall.height)} onchange={updateSelectedWallHeight} /></label>
					<label><input type="checkbox" checked={selectedWallFirstWall.role === 'boundary'} onchange={updateSelectedWallRole} /> Defines room boundary</label>
					{#if layoutPreview.lastMutationMessage}<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>{/if}
				</div>
			{:else if selectedWallFirstJunction}
				<div class="layout-selected-room" aria-label="Selected wall-first junction">
					<strong>Junction {selectedWallFirstJunction.id}</strong>
					<span>Connected Wall geometry follows this Junction.</span>
					<label>X (m)<input type="number" step="any" value={formatMeters(selectedWallFirstJunction.point[0])} onchange={(event) => updateSelectedJunction(0, event)} /></label>
					<label>Z (m)<input type="number" step="any" value={formatMeters(selectedWallFirstJunction.point[1])} onchange={(event) => updateSelectedJunction(1, event)} /></label>
					{#if layoutPreview.lastMutationMessage}<p class="layout-opening-warning" role="status">{layoutPreview.lastMutationMessage}</p>{/if}
				</div>
			{:else if selectedWallFirstOpening && selectedWallFirstOpeningMetrics}
				<div class="layout-selected-room" aria-label="Selected wall-first opening">
					<strong>{selectedWallFirstOpening.kind} opening</strong>
					<span>Opening: {selectedWallFirstOpening.id}</span>
					<span>
						Wall: {selectedWallFirstOpening.wallId} · {selectedWallFirstOpeningMetrics.wallLength.toFixed(2)} m{#if selectedWallFirstHostingWall}
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
			{:else if selectedWallFirstRoom}
				<div class="layout-selected-room" aria-label="Selected wall-first room">
					<strong>{selectedWallFirstRoom.name}</strong>
					<span>{selectedWallFirstRoom.id}</span>
					<span>{selectedWallFirstRoom.boundary.length} boundary walls · floor {selectedWallFirstRoom.floorThickness.toFixed(2)} m · ceiling {selectedWallFirstRoom.ceilingThickness.toFixed(2)} m</span>
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
							<li><code>{issue.targetId ?? issue.path}</code> — {issue.message}</li>
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
	{:else if selectedNavigation}
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
					<div><dt>Room</dt><dd>{singleEditableObject.roomId}</dd></div>
					<div><dt>Asset</dt><dd class="id">{singleEditableObject.assetId}</dd></div>
				</dl>
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
				<dl>
					<div><dt>Room</dt><dd>{singleSelectedEntity.roomId}</dd></div>
					<div><dt>Kind</dt><dd>{singleSelectedEntity.kind}</dd></div>
					<div><dt>Name</dt><dd>{singleSelectedEntity.name}</dd></div>
				</dl>
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
	header h2, section h2 { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--editor-text-muted); }
	header p { margin: 0.35rem 0 0; color: var(--editor-text-secondary); font-size: 0.75rem; line-height: 1.4; }
	section { display: flex; flex-direction: column; gap: 0.55rem; }
	.id { font-family: var(--editor-font); font-size: 0.75rem; overflow-wrap: anywhere; }
	.layout-inspector { display: flex; flex-direction: column; gap: 0.8rem; }
	.layout-inspector dl { display: flex; flex-direction: column; gap: 0.45rem; margin: 0; }
	.layout-inspector dl div { display: flex; justify-content: space-between; gap: 0.7rem; }
	.layout-inspector dt { color: var(--editor-text-secondary); font-size: 12px; font-weight: 400; }
	.layout-inspector dd { margin: 0; color: var(--editor-text-primary); font-size: 12.5px; font-weight: 500; font-variant-numeric: tabular-nums; text-align: right; }
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
