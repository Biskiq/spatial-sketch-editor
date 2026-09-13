<script lang="ts">
	// one project hierarchy over both documents, mounted in Plan and 3D.
	//
	// Rooms come from the layout (document order, via the pure model); clusters
	// and entities nest under their explicit roomId. Camera Flow embeds the
	// existing CameraFlowPanel (P1.9: row expansion is a flat neighbor list —
	// connection detail lives in Connections / Inspector / Timeline).
	// Selection is domain-driven: picks call the
	// source APIs the viewport calls, S3's hooks own cross-domain exclusivity,
	// and the highlight reads `ActiveEditorSelection.active`.
	import { onMount } from 'svelte';
	import { EllipsisVertical, Eye, EyeOff, ListFilter, Plus, Scan, Search, Trash2 } from 'lucide-svelte';
	import { getAsset } from '$lib/content/assets';
	import { isSceneModelEntity, type SceneEntity } from '$lib/content/scene';
	import { formatPlacementLabel } from './editor-outliner';
	import { layoutPreviewDocument, type LayoutPreviewState } from './layout/layout-preview-state.svelte';
	import { deleteLayoutObject, deleteLayoutOpening, deleteLayoutRoom, deleteWallFirstWall, removeWallFirstRoom, updateLayoutRoomFields, wallFirstRoomExclusiveBoundaryWallIds } from './layout/layout-preview-state.svelte';
	import type { EditorContextMenuStore } from './context-menu/context-menu-state.svelte';
	import { isEditableTarget } from './context-menu/editable-target';
	import { resolveSelectionBeforeMenu } from './context-menu/selection-before-menu';
	import {
		buildPlanLayoutContextMenuItems,
		buildArrangeContextMenuItems
	} from './context-menu/plan-menu-items';
	import { layoutMutationRunnerFor, runLayoutMutation } from './layout/layout-mutation-runner';
	import {
		selectLayoutInteriorAnchor,
		selectLayoutObject,
		selectLayoutOpening,
		selectLayoutRoom,
		selectLayoutWall,
		selectLayoutPhysicalWall,
		selectLayoutWallOpening,
		selectLayoutJunction,
		setArrangeOwner,
		setLayoutDraftTool,
		type LayoutInteractionState
	} from './layout/layout-interaction';
	import type { EditorStore } from './editor-store.svelte';
	import CameraFlowPanel from './CameraFlowPanel.svelte';
	import type { EditorActiveSelectionStore } from './app/active-editor-selection.svelte';
	import {
		buildUnifiedProjectTreeModel,
		filterUnifiedProjectTreeModel,
		isUnifiedTreeRowInteractive,
		isUnifiedTreeRowSelected,
		layoutSelectionAncestorRoomId,
		layoutSelectionRevealTarget,
		type LayoutTreeRevealTarget,
		type UnifiedTreeDiscovery,
		type UnifiedTreeRow,
		type UnifiedTreeRoom
	} from './unified-project-tree-model';
	import type { EditorDomain } from './app/editor-view-state.svelte';
	import type { EditorViewMode } from './app/editor-view-mode';

	let {
		store,
		layoutPreview,
		layoutInteraction,
		activeSelection,
		domain,
		view,
		onAddRoom = undefined,
		contextMenu = null
	}: {
		store: EditorStore;
		layoutPreview: LayoutPreviewState;
		layoutInteraction: LayoutInteractionState;
		activeSelection: EditorActiveSelectionStore;
		domain: EditorDomain;
		view: EditorViewMode;
		/** S10.1 — start the room-drafting flow from the Rooms header (+). */
		onAddRoom?: () => void;
		/** P3.4 — shared context-menu slot; absent keeps the tree frozen. */
		contextMenu?: EditorContextMenuStore | null;
	} = $props();

	const model = $derived(
		buildUnifiedProjectTreeModel({
			layout: layoutPreview.project.layout,
			scene: store.document,
			guidedTourNodeIds: store.guidedTourNodeIds
		})
	);
	const wallFirstLayout = $derived('formatVersion' in layoutPreviewDocument(layoutPreview));
	const active = $derived(activeSelection.active);
	// Camera discovery slots (reducer's discoveryConnectionId/discoveryDirection)
	// — only consulted by the matcher for direction rows, which the embedded
	// panel renders. Passed through for contract completeness.
	const discovery = $derived<UnifiedTreeDiscovery>({
		connectionId: store.activeCameraConnectionId,
		direction: store.activeCameraDirection
	});
	const sceneEntitiesById = $derived(new Map(store.document.entities.map((entity) => [entity.id, entity])));
	const clusteredPlacementIds = $derived(
		new Set((store.document.clusters ?? []).flatMap((cluster) => cluster.memberIds))
	);
	// Destructive Scene row actions remain 3D-only in P2.2. Row selection uses
	// the mode-aware predicate below: Layout owns Layout mode, Scene owns Staging.
	const sceneInteractive = $derived(domain === 'scene' && view === '3d');
	const cameraInteractive = $derived(domain === 'camera');
	// S10.1 — hierarchy filter: narrows the Rooms tree by a case-insensitive
	// substring over row labels/ids. Ancestors of matches survive so matched
	// rows stay reachable; the Camera Flow panel is left untouched.
	let filterQuery = $state('');
	const filterActive = $derived(filterQuery.trim() !== '');
	// P23.6b — clustered Scene members are excluded from `sceneContent.entities`
	// (no double render), so the filter resolves their display labels from the
	// scene document via this pure lookup — a search for a member's visible
	// name must find it inside its cluster.
	const visibleModel = $derived(
		filterUnifiedProjectTreeModel(model, filterQuery, (entityId) =>
			sceneEntitiesById.get(entityId)?.name
		)
	);

	let roomsOpen = $state(true);
	let cameraTourOpen = $state(false);
	// P23.6b — canonical root disclosures. `architectureOpen` expands the
	// Architecture group; `topologyOpen` gates the Junction browser behind the
	// `Topology…` disclosure (D4 — no resting Junction clutter). Both are
	// transient UI state, never project state.
	let architectureOpen = $state(false);
	// D1 — the Walls subgroup under Architecture (Topology… is its sibling).
	let wallsOpen = $state(false);
	let topologyOpen = $state(false);
	let layoutObjectsOpen = $state(false);
	let sceneContentOpen = $state(false);
	// P23.6b — filter-safe reveal state (§Canvas ↔ tree reveal). When the
	// reveal target's row is excluded by the active filter, the query is kept
	// (never auto-cleared) and the row offers an explicit Reveal/Clear affordance.
	let hiddenRevealTarget = $state<LayoutTreeRevealTarget | null>(null);
	let openMenuFor = $state<string | null>(null);
	let treeElement = $state<HTMLElement>();

	onMount(() => {
		const closeMenu = (event: PointerEvent) => {
			if (treeElement?.contains(event.target as Node)) return;
			openMenuFor = null;
		};
		window.addEventListener('pointerdown', closeMenu);
		return () => window.removeEventListener('pointerdown', closeMenu);
	});

	// Camera Tour branch surfacing (preserved behavior): as a collapsible branch it
	// could get buried. One-shot expansions on the *transition* into the camera
	// domain (G5 — both Camera views) and into a camera pick — not a continuous
	// derived, so a user's explicit collapse stays authoritative.
	$effect(() => {
		if (domain === 'camera') cameraTourOpen = true;
	});
	$effect(() => {
		if (active.domain === 'camera') cameraTourOpen = true;
	});
	// While filtering, reveal the Rooms root so matches aren't hidden behind a
	// user-collapsed root (the effect re-runs as the query changes; a manual
	// collapse during an active filter stays authoritative until then).
	$effect(() => {
		if (filterActive) roomsOpen = true;
	});

	// P23.6b — canonical reveal: expand the ancestors of the active canonical
	// selection and scroll its resting row into view. Runs alongside the legacy
	// `layoutSelectionAncestorRoomId` pick-expand below (they own disjoint
	// selection kinds). Junction reveals open the Architecture root without
	// exploding the Topology inventory (D4 — see applyRevealTarget). The target
	// is cleared on every run so
	// a stale target never pin-flags a row after the selection changes.
	$effect(() => {
		const selection = activeSelection.active;
		if (selection.domain !== 'layout') {
			hiddenRevealTarget = null;
			return;
		}
		const target = layoutSelectionRevealTarget(
			selection.selection,
			layoutPreview.project.layout
		);
		if (!target) {
			hiddenRevealTarget = null;
			return;
		}
		const rowHidden = revealTargetHidden(target);
		hiddenRevealTarget = rowHidden ? target : null;
		if (rowHidden) return; // filter owns the row; user reveals explicitly
		applyRevealTarget(target);
	});

	// Expansion seeding: `treeExpandedRoomIds` defaults to ['paris'] — a Chopin
	// room that never exists in a boot-empty editor project. Trim the slot to live
	// layout room ids on model build (write only when it differs) so the first
	// drafted room starts collapsed and toggles stay in sync with the registry.
	// P23.6 — wall-first Rooms live in `wallFirstRooms`, not `rooms`: trimming
	// to legacy ids alone evicts every canonical Room id, which ping-pongs
	// against the pick-expand effect below (append → trim → append) until
	// `effect_update_depth_exceeded` freezes the page on the first wall-first
	// Room birth.
	$effect(() => {
		const liveRoomIds = new Set([
			...model.rooms.map((room) => room.roomId),
			...model.wallFirstRooms.map((room) => room.roomId)
		]);
		const current = store.treeExpandedRoomIds;
		if (current.some((id) => !liveRoomIds.has(id))) {
			store.treeExpandedRoomIds = current.filter((id) => liveRoomIds.has(id));
		}
	});

	// Pick-expand: reveal the active selection's row by expanding its ancestor
	// chain. Viewport picks of walls/openings/objects (layout) and
	// entities/clusters (scene) don't route through the tree's own select*
	// helpers (which already expand), so the tree must expand for **every**
	// active layout/scene selection — not just rooms — or the picked row stays
	// hidden inside a collapsed room/cluster ancestor. Camera ancestors are the
	// embedded panel's own effects (expandNode / expandActiveCameraDirection).
	$effect(() => {
		const selection = activeSelection.active;
		if (selection.domain === 'layout') {
			const roomId = layoutSelectionAncestorRoomId(
				selection.selection,
				layoutPreview.project.layout
			);
			if (roomId) {
				// The Rooms root is user-collapsible; reveal it too, or the
				// picked row stays hidden inside the collapsed root.
				roomsOpen = true;
				store.ensureRoomTreeExpanded(roomId);
			}
			return;
		}
		if (selection.domain === 'scene') {
		// P23.6b — gate on the DOCUMENT FORMAT (direct projection of the
		// layout), never on projection emptiness: an empty legacy document
		// has no rooms either, and the plan promises format-gated legacy
		// behavior. Wall-first documents render Scene rows under the
		// document-level Scene Content root (no Room nesting), so reveal
		// opens that root and the containing cluster. Legacy keeps its
		// Room-nested reveal.
		if (wallFirstLayout) {
			sceneContentOpen = true;
			const workspace = selection.selection;
			if (workspace.kind === 'cluster') {
				store.ensureClusterTreeExpanded(workspace.clusterId);
			} else if (workspace.kind === 'placement' && workspace.ids.length > 0) {
				const containingCluster = (store.document.clusters ?? []).find((cluster) =>
					cluster.memberIds.some((memberId) => workspace.ids.includes(memberId))
				);
				if (containingCluster) store.ensureClusterTreeExpanded(containingCluster.id);
			}
			return;
		}
		roomsOpen = true;
		const workspace = selection.selection;
		if (workspace.kind === 'cluster') {
			store.ensureRoomTreeExpanded(workspace.roomId);
			store.ensureClusterTreeExpanded(workspace.clusterId);
		} else if (workspace.kind === 'placement' && workspace.ids.length > 0) {
			store.ensureRoomTreeExpanded(workspace.roomId);
			// Viewport placement selections carry `clusterId: null`, so
			// membership must be resolved from the document clusters —
			// otherwise a picked member stays hidden inside its collapsed
			// cluster ancestor.
			const containingCluster = (store.document.clusters ?? []).find((cluster) =>
				cluster.memberIds.some((memberId) => workspace.ids.includes(memberId))
			);
			if (containingCluster) store.ensureClusterTreeExpanded(containingCluster.id);
		}
	}
	});

	function rowSelected(row: UnifiedTreeRow): boolean {
		// Room-only *latent* context derives to `domain: 'none'`, so the pure
		// matcher cannot see it — OR the same read the relic scene tree uses.
		return (
			isUnifiedTreeRowSelected(active, discovery, row) ||
			(row.kind === 'room' && active.domain === 'none' && store.selectedRoomId === row.roomId)
		);
	}

	// ── P23.6b — reveal plumbing ─────────────────────────────────────────

	/** Is the reveal target's row excluded by the active filter (or absent)? */
	function revealTargetHidden(target: LayoutTreeRevealTarget): boolean {
		if (!filterActive) return false;
		switch (target.group) {
			case 'rooms':
				return !visibleModel.wallFirstRooms.some((room) => room.roomId === target.roomId) &&
					!visibleModel.rooms.some((room) => room.roomId === target.roomId);
			case 'architecture':
				return 'openingId' in target
					? !visibleModel.architecture.walls.some((wall) =>
							wall.wallId === target.wallId &&
							wall.openings.some((opening) => opening.openingId === target.openingId)
						)
					: !visibleModel.architecture.walls.some((wall) => wall.wallId === target.wallId);
			case 'layoutObjects':
				return !visibleModel.layoutObjects.some((object) => object.objectId === target.objectId);
			case 'topology':
				return !visibleModel.architecture.junctions.some(
					(junction) => junction.junctionId === target.junctionId
				);
			default:
				return false;
		}
	}

	// P23.6b — which Architecture Wall rows have their hosted Openings expanded
	// (transient, never persisted; a selection reveal also expands its host).
	let openWallIds = $state<string[]>([]);
	function toggleWallRow(wallId: string) {
		openWallIds = openWallIds.includes(wallId)
			? openWallIds.filter((id) => id !== wallId)
			: [...openWallIds, wallId];
	}

	/**
	 * The exact DOM anchor for a reveal target — canonical keys, unique per
	 * row (P23.6b review: an Opening row must scroll to the Opening, not its
	 * host Wall; a Room row must have its own `rooms:` anchor).
	 */
	function revealAnchor(target: LayoutTreeRevealTarget): string {
		switch (target.group) {
			case 'rooms':
				return `rooms:${target.roomId}`;
			case 'architecture':
				return 'openingId' in target
					? `architecture:${target.wallId}:${target.openingId}`
					: `architecture:${target.wallId}`;
			case 'topology':
				return `topology:${target.junctionId}`;
			case 'layoutObjects':
				return `layoutObjects:${target.objectId}`;
			default:
				return 'scene';
		}
	}

	/** Expand the target's ancestors and scroll its row into view (no filter). */
	function applyRevealTarget(target: LayoutTreeRevealTarget): void {
		if ('openingId' in target) {
			topologyOpen = false;
			// The Opening's host Wall row must be expanded for the child row
			// to exist in the DOM before the scroll.
			if (!openWallIds.includes(target.wallId)) {
				openWallIds = [...openWallIds, target.wallId];
			}
		}
		switch (target.group) {
			case 'rooms':
				roomsOpen = true;
				store.ensureRoomTreeExpanded(target.roomId);
				break;
			case 'architecture':
				architectureOpen = true;
				wallsOpen = true;
				break;
		case 'topology':
			// P23.6b D4 — a Junction selection must NOT explode the disclosed
			// Topology inventory (dense projects hold 50–100 junctions) and
			// must not drag the Walls list open with it. Opening the
			// Architecture root is enough for orientation; the user expands
			// Topology… (or uses search / Wall endpoint links) themselves.
			architectureOpen = true;
			break;
			case 'layoutObjects':
				layoutObjectsOpen = true;
				break;
			case 'scene':
				sceneContentOpen = true;
				break;
			default:
				break;
		}
		queueMicrotask(() => {
			treeElement
				?.querySelector(`[data-reveal-id="${revealAnchor(target)}"]`)
				?.scrollIntoView({ block: 'nearest' });
		});
	}

	/** Explicit user action: clear the filter so the hidden row can reveal. */
	function revealHiddenSelection() {
		const target = hiddenRevealTarget;
		filterQuery = '';
		hiddenRevealTarget = null;
		if (target) applyRevealTarget(target);
	}

	function roomOpen(room: UnifiedTreeRoom): boolean {
		return store.treeExpandedRoomIds.includes(room.roomId);
	}

	function roomRowInteractive(row: UnifiedTreeRow): boolean {
		return isUnifiedTreeRowInteractive(row, domain, view, layoutInteraction.planViewMode);
	}

	function selectRoom(room: UnifiedTreeRoom) {
		selectLayoutRoom(layoutInteraction, room.roomId);
	}

	function selectWall(room: UnifiedTreeRoom, segmentId: string) {
		selectLayoutWall(layoutInteraction, room.roomId, segmentId);
	}

	function selectOpening(room: UnifiedTreeRoom, segmentId: string, openingId: string) {
		selectLayoutOpening(layoutInteraction, room.roomId, segmentId, openingId);
	}

	function selectAnchor(room: UnifiedTreeRoom, segmentId: string, anchorId: string) {
		selectLayoutInteriorAnchor(layoutInteraction, room.roomId, segmentId, anchorId);
	}

	function selectObject(objectId: string) {
		selectLayoutObject(layoutInteraction, objectId);
		// P10 — a hierarchy pick in Arrange switches the active owner too.
		if (layoutInteraction.planViewMode === 'staging') setArrangeOwner(layoutInteraction, 'layout-object');
	}

	// P23.6b — canonical wall-first row routing: every pick activates the
	// existing canonical selection slot through the existing select helpers.
	function selectPhysicalWall(wallId: string) {
		selectLayoutPhysicalWall(layoutInteraction, wallId);
	}

	function selectHostedOpening(wallId: string, openingId: string) {
		selectLayoutWallOpening(layoutInteraction, wallId, openingId);
	}

	function selectJunctionRow(junctionId: string) {
		selectLayoutJunction(layoutInteraction, junctionId);
	}

	/**
	 * P23.6b — the boundary relation on the row itself: walls are document-
	 * global (D2, never grouped under rooms), so the room names a wall bounds
	 * are shown as a relation to make the derived labels distinguishable.
	 */
	function wallBoundedRoomNames(wallId: string): string[] {
		return model.wallFirstRooms
			.filter((room) => room.wallIds.includes(wallId))
			.map((room) => room.name);
	}

	/**
	 * P23.6b Room context-menu guard — wall-first Room rows are interactive
	 * but carry NO legacy Room commands: `updateLayoutRoomFields` resolves the
	 * Room through `layout.floors` and `deleteLayoutRoom` rejects wall-first
	 * documents outright, and no canonical Room metadata/delete operation
	 * exists (P23.6 verified). So the row binds no oncontextmenu at all —
	 * a menu with zero commands is worse than the native menu (P3.4 rows
	 * without an approved action set keep native behavior).
	 */

	function selectEntity(entity: SceneEntity, event?: MouseEvent) {
		// P10 — cross-owner hierarchy picks in Arrange replace the active
		// selection (plan §Selection): when the pre-click active target is a
		// layout object in Plan, a shift-click must not accumulate into the
		// remembered Scene slot. Same-owner additive selection is untouched.
		const switchingFromLayout =
			layoutInteraction.planViewMode === 'staging' &&
			view === 'plan' &&
			active.domain === 'layout';
		if (layoutInteraction.planViewMode === 'staging') setArrangeOwner(layoutInteraction, 'scene');
		store.selectionActions.selectPlacementFromTree(entity.id, {
			additive: !switchingFromLayout && (event?.shiftKey ?? false),
			focus: switchingFromLayout ? true : !(event?.shiftKey ?? false)
		});
	}

	function selectCluster(clusterId: string) {
		if (layoutInteraction.planViewMode === 'staging') setArrangeOwner(layoutInteraction, 'scene');
		store.selectionActions.selectClusterFromTree(clusterId);
	}

	function entityLabel(entity: SceneEntity) {
		return entity.name.trim() || formatPlacementLabel(entity.id);
	}

	function entityMeta(entity: SceneEntity) {
		if (isSceneModelEntity(entity)) {
			return formatPlacementLabel(getAsset(entity.assetId).category);
		}
		if (entity.kind === 'primitive') return formatPlacementLabel(entity.primitive);
		return formatPlacementLabel(entity.light);
	}

	// S10.1 — per-row visibility + kebab actions. Visibility is a session-only
	// viewport override; Frame/Delete reuse the existing store/layout mutators.
	function toggleMenu(key: string) {
		openMenuFor = openMenuFor === key ? null : key;
	}

	function frameRoom(roomId: string) {
		store.focusRoom(roomId);
	}

	function frameEntity(entityId: string) {
		store.focusPlacement(entityId);
	}

	function deleteEntity(entityId: string) {
		store.deletePlacements([entityId]);
	}

	// one layout mutation = one undo entry: begin → mutate → commit/cancel.
	function runLayoutMutationGuarded<T>(mutate: () => T, didSucceed: (result: T) => boolean) {
		return runLayoutMutation(layoutMutationRunnerFor(store, layoutPreview), mutate, didSucceed);
	}

	function deleteRoom(roomId: string) {
		const outcome = runLayoutMutationGuarded(
			() => deleteLayoutRoom(layoutPreview, roomId, store.document),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(outcome.result.success ? 'Deleted room' : outcome.result.message);
	}

	function deleteObject(objectId: string) {
		const outcome = runLayoutMutationGuarded(
			() => deleteLayoutObject(layoutPreview, objectId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(outcome.result.success ? 'Deleted layout object' : outcome.result.message);
	}

	function deleteOpening(roomId: string, openingId: string) {
		const outcome = runLayoutMutationGuarded(
			() => deleteLayoutOpening(layoutPreview, roomId, openingId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(outcome.result.success ? 'Deleted opening' : outcome.result.message);
	}

	/**
	 * P23.6c — canonical Wall delete from the Architecture row. The SAME
	 * planner-backed adapter the viewport Delete/Backspace path calls (one
	 * history entry); success clears the canonical selection to `none`.
	 */
	function deleteWall(wallId: string) {
		const outcome = runLayoutMutationGuarded(
			() => deleteWallFirstWall(layoutPreview, wallId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (outcome.result.success) layoutInteraction.selection = { kind: 'none' };
		store.setStatusMessage(outcome.result.success ? 'Deleted wall' : outcome.result.message);
	}

	/**
	 * P23.6d — canonical wall-first Room removal from the Architecture tree.
	 * The SAME planner-backed adapter the Inspector calls (one history entry).
	 * The Wall choice defaults to the first Room-exclusive boundary Wall in
	 * boundary order — no geometry guessing; the Inspector exposes the full
	 * wall list for an explicit pick. Success clears the canonical selection to
	 * `none` (the Room retires).
	 */
	function removeRoomFromTree(roomId: string) {
		const wallId = wallFirstRoomExclusiveBoundaryWallIds(layoutPreview, roomId)[0];
		if (!wallId) {
			store.setStatusMessage('Remove room needs a boundary Wall this room owns alone');
			return;
		}
		const outcome = runLayoutMutationGuarded(
			() => removeWallFirstRoom(layoutPreview, roomId, wallId),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		if (outcome.result.success) layoutInteraction.selection = { kind: 'none' };
		store.setStatusMessage(outcome.result.success ? 'Removed room' : outcome.result.message);
	}

	/**
	 * P23.6d — wall-first Room row context menu. It obeys the SAME
	 * row-authority contract as activation (`isUnifiedTreeRowInteractive`): an
	 * inert row (Camera domain, Plan Arrange) opens no menu, so it can never
	 * expose — let alone execute — canonical Room removal. It exposes only
	 * commands a wall-first Room can honor (`Remove room…`, and only when a
	 * Room-exclusive boundary Wall exists); never the legacy rename/delete.
	 * With no eligible command it keeps native behavior (no empty menu).
	 */
	function onWallFirstRoomRowContextMenu(event: MouseEvent, roomId: string): void {
		if (!contextMenu) return;
		if (!roomRowInteractive({ kind: 'room', roomId })) return;
		selectLayoutRoom(layoutInteraction, roomId);
		const eligible = wallFirstRoomExclusiveBoundaryWallIds(layoutPreview, roomId).length > 0;
		const items = buildPlanLayoutContextMenuItems({
			target: { kind: 'room', roomId },
			mutationBlockedReason: treeMutationBlocked(),
			actions: {
				...(eligible ? { removeRoom: (targetRoomId: string) => removeRoomFromTree(targetRoomId) } : {}),
				deleteOpening,
				deleteObject
			}
		});
		if (items.length === 0) return;
		openTreeContextMenu(event, items);
	}

	function onWallRowContextMenu(event: MouseEvent, wallId: string): void {
		if (!contextMenu) return;
		const row = { kind: 'physicalWall', wallId } satisfies UnifiedTreeRow;
		// P23.6c review fix — the context menu obeys the SAME row-authority
		// contract as activation (`isUnifiedTreeRowInteractive`): an
		// inert/read-only physicalWall row (Camera domain, Scene Plan Arrange)
		// gets neither selection nor a canonical Delete command. Only an
		// authority surface that can activate the row may open its menu, so
		// the menu can never bypass the gate and execute Delete.
		if (!roomRowInteractive(row)) return;
		selectPhysicalWall(wallId);
		openTreeContextMenu(
			event,
			buildPlanLayoutContextMenuItems({
				target: { kind: 'wall', wallId },
				mutationBlockedReason: treeMutationBlocked(),
				actions: {
					deleteOpening,
					deleteObject,
					deleteWall
				}
			})
		);
	}

	function toggleEntityHidden(entityId: string) {
		store.toggleEntityVisibility(entityId);
	}

	// ── P3.4 — Outliner context-menu adapter ─────────────────────────────
	// Right-click exposes the SAME actions the kebab already dispatches
	// (existing commands only), with selection-before-menu mirroring a row
	// click. Rows without an approved v1 action set keep native behavior.

	function openTreeContextMenu(event: MouseEvent, items: ReturnType<typeof buildPlanLayoutContextMenuItems>): void {
		if (!contextMenu || isEditableTarget(event.target)) return;
		event.preventDefault();
		contextMenu.open({
			surfaceId: 'outliner',
			x: event.clientX,
			y: event.clientY,
			items
		});
	}

	const treeMutationBlocked = () =>
		store.isDocumentMutationBlocked ? 'Preview is active' : null;

	function renameRoomViaPrompt(roomId: string, currentName: string): void {
		const next = window.prompt('Room name', currentName)?.trim();
		if (!next || next === currentName) return;
		const outcome = runLayoutMutationGuarded(
			() => updateLayoutRoomFields(layoutPreview, roomId, { name: next }),
			(result) => result.success
		);
		if (outcome.kind === 'skipped') {
			store.setStatusMessage('Finish the current layout interaction first');
			return;
		}
		store.setStatusMessage(outcome.result.success ? 'Renamed room' : outcome.result.message);
	}

	function roomContextMenuActions(currentName: string): Parameters<
		typeof buildPlanLayoutContextMenuItems
	>[0]['actions'] {
		return {
			renameRoom: (roomId) => renameRoomViaPrompt(roomId, currentName),
			deleteRoom,
			deleteOpening,
			deleteObject
		};
	}

	function onRoomRowContextMenu(event: MouseEvent, room: UnifiedTreeRoom): void {
		if (!contextMenu) return;
		if (roomRowInteractive({ kind: 'room', roomId: room.roomId })) selectRoom(room);
		openTreeContextMenu(
			event,
			buildPlanLayoutContextMenuItems({
				target: { kind: 'room', roomId: room.roomId },
				mutationBlockedReason: treeMutationBlocked(),
				actions: roomContextMenuActions(room.name)
			})
		);
	}

	function onOpeningRowContextMenu(
		event: MouseEvent,
		roomId: string,
		segmentId: string,
		openingId: string
	): void {
		if (!contextMenu) return;
		const row = { kind: 'opening', roomId, segmentId, openingId } satisfies UnifiedTreeRow;
		if (roomRowInteractive(row)) selectLayoutOpening(layoutInteraction, roomId, segmentId, openingId);
		openTreeContextMenu(
			event,
			buildPlanLayoutContextMenuItems({
				target: { kind: 'opening', roomId, openingId },
				mutationBlockedReason: treeMutationBlocked(),
				actions: roomContextMenuActions('')
			})
		);
	}

	function onObjectRowContextMenu(event: MouseEvent, objectId: string): void {
		if (!contextMenu) return;
		const row = { kind: 'object', objectId } satisfies UnifiedTreeRow;
		if (roomRowInteractive(row)) selectObject(objectId);
		openTreeContextMenu(
			event,
			buildPlanLayoutContextMenuItems({
				target: { kind: 'object', objectId },
				mutationBlockedReason: treeMutationBlocked(),
				actions: roomContextMenuActions('')
			})
		);
	}

	function onEntityRowContextMenu(entity: SceneEntity, event: MouseEvent): void {
		if (!contextMenu) return;
		const selected = store.selectedPlacementIds.includes(entity.id);
		if (
			resolveSelectionBeforeMenu({
				targetSelected: selected,
				selectionSize: store.selectedPlacementIds.length
			}) === 'select-target'
		) {
			selectEntity(entity);
		}
		openTreeContextMenu(
			event,
			buildArrangeContextMenuItems({
				target: { owner: 'scene', entityId: entity.id },
				sceneTargetHidden: store.isEntityHidden(entity.id),
				mutationBlockedReason: treeMutationBlocked(),
				duplicateBlockedReason:
					store.selectedPlacementIds.length === 0 ? 'Nothing selected' : null,
				actions: {
					deleteLayoutObject: () => {},
					duplicateScene: () => store.duplicateSelection(),
					focusScene: (entityId) => frameEntity(entityId),
					toggleSceneVisibility: (entityId) => toggleEntityHidden(entityId),
					deleteScene: () =>
						store.deletePlacements([...store.selectedPlacementIds])
				}
			})
		);
	}

</script>

<section bind:this={treeElement} class="unified-tree" aria-label="Project hierarchy">
	<div class="tree-filter" role="search">
		<span class="tree-filter__icon"><Search size={14} aria-hidden="true" /></span>
		<input
			type="text"
			class="tree-filter__input"
			placeholder="Filter hierarchy"
			aria-label="Filter hierarchy"
			spellcheck="false"
			bind:value={filterQuery}
		/>
		<button
			type="button"
			class="tree-filter__action"
			class:active={filterActive}
			aria-pressed={filterActive}
			aria-label="Clear hierarchy filter"
			title="Clear filter"
			onclick={() => (filterQuery = '')}
		><ListFilter size={14} aria-hidden="true" /></button>
	</div>

	{#if hiddenRevealTarget}
		<!-- P23.6b — the selected row is excluded by the active filter: keep the
			query (never auto-clear) and offer an explicit reveal. -->
		<div class="tree-reveal-hint" role="status">
			<span>Selection hidden by filter</span>
			<button type="button" onclick={revealHiddenSelection}>Reveal</button>
			<button type="button" onclick={() => (filterQuery = '')}>Clear filter</button>
		</div>
	{/if}

	<div class="tree-root">
		<div class="tree-root__header">
			<button
				type="button"
				class="tree-root__row"
				aria-expanded={roomsOpen}
				onclick={() => (roomsOpen = !roomsOpen)}
			>
				<span class="chevron" class:open={roomsOpen}>›</span>
				<span class="tree-row__label tree-root__label">Rooms</span>
				<span class="tree-row__meta">{model.rooms.length + model.wallFirstRooms.length}</span>
			</button>
			{#if onAddRoom}
				<button
					type="button"
					class="tree-root__add"
					aria-label="Add room"
					title="Add a room"
					onclick={onAddRoom}
				><Plus size={14} aria-hidden="true" /></button>
			{/if}
		</div>
		{#if roomsOpen}
			{#if model.rooms.length + model.wallFirstRooms.length === 0}
				<p class="empty">{wallFirstLayout ? 'Draw a wall or room in Plan to begin' : 'Draw a room in Plan to begin'}</p>
			{:else if visibleModel.rooms.length + visibleModel.wallFirstRooms.length === 0}
				<p class="empty">No rows match “{filterQuery.trim()}”</p>
			{:else}
				<ul role="tree" aria-label="Rooms">
					<!-- P23.3 canonical wall-first Rooms. Read-only until the canonical
					     tree rows are cut over, and never given a fabricated segment id:
					     their boundary Walls are document-global (`wallId`). A document is
					     one format, so only one of these two lists is ever populated. -->
					{#each visibleModel.wallFirstRooms as room (room.roomId)}
						{@const wallFirstRoomRow = { kind: 'room', roomId: room.roomId } satisfies UnifiedTreeRow}
						<li role="treeitem" aria-selected={rowSelected(wallFirstRoomRow)}>
							<div class="room-line">
								<span class="tree-row__chevron-spacer" aria-hidden="true"></span>
								<button
									type="button"
									class="tree-row room-row"
									class:tree-row--selected={rowSelected(wallFirstRoomRow)}
									aria-disabled={!roomRowInteractive(wallFirstRoomRow)}
									data-reveal-id={`rooms:${room.roomId}`}
									title={`Canonical Room · ${room.wallIds.length} walls · ${room.openingIds.length} openings`}
									onclick={roomRowInteractive(wallFirstRoomRow) ? () => selectRoom({ roomId: room.roomId, name: room.name, walls: [], openings: [], objects: [], clusters: [], entities: [] }) : undefined}
									oncontextmenu={contextMenu ? (event) => onWallFirstRoomRowContextMenu(event, room.roomId) : undefined}
								>
									<span class="tree-row__label" title={room.name}>{room.name}</span>
									<span class="tree-row__meta">{room.wallIds.length} walls</span>
								</button>
							</div>
						</li>
					{/each}
					{#each visibleModel.rooms as room (room.roomId)}
						{@const open = roomOpen(room)}
						{@const roomRow = { kind: 'room', roomId: room.roomId } satisfies UnifiedTreeRow}
						<li role="treeitem" aria-expanded={open} aria-selected={rowSelected(roomRow)}>
						<div class="room-line">
							<button
								type="button"
								class="tree-row__chevron"
								aria-label={`${open ? 'Collapse' : 'Expand'} ${room.name}`}
								aria-expanded={open}
								onclick={() => store.toggleRoomTreeExpansion(room.roomId)}
							>
								<span class="chevron" class:open={open}>›</span>
							</button>
							<button
								type="button"
								class="tree-row room-row"
								class:tree-row--selected={rowSelected(roomRow)}
								aria-disabled={!roomRowInteractive(roomRow)}
								onclick={roomRowInteractive(roomRow) ? () => selectRoom(room) : undefined}
								oncontextmenu={contextMenu ? (event) => onRoomRowContextMenu(event, room) : undefined}
							>
								<span class="tree-row__label" title={room.name}>{room.name}</span>
								<span class="tree-row__meta" title={room.roomId}>{formatPlacementLabel(room.roomId)}</span>
							</button>
							{#if sceneInteractive}
								<div class="row-actions">
									<button
										type="button"
										class="kebab"
										aria-label={`Actions for ${room.name}`}
										aria-expanded={openMenuFor === `room:${room.roomId}`}
										onclick={() => toggleMenu(`room:${room.roomId}`)}
									><EllipsisVertical size={14} aria-hidden="true" /></button>
									{#if openMenuFor === `room:${room.roomId}`}
										<div class="row-menu" role="menu">
											<button type="button" role="menuitem" onclick={() => frameRoom(room.roomId)}><Scan size={13} aria-hidden="true" /> Frame</button>
											<button type="button" role="menuitem" class="danger" onclick={() => deleteRoom(room.roomId)}><Trash2 size={13} aria-hidden="true" /> Delete</button>
										</div>
									{/if}
								</div>
							{/if}
						</div>
							{#if open}
								<ul class="room-children" role="group" aria-label={`${room.name} contents`}>
									{#if room.walls.length > 0 || room.openings.length > 0 || room.objects.length > 0}
										<li class="group-header" role="presentation">
											<span>Architecture</span>
										</li>
									{/if}
									{#each room.walls as wall (wall.segmentId)}
										{@const wallRow = {
											kind: 'wall',
											roomId: room.roomId,
											segmentId: wall.segmentId
										} satisfies UnifiedTreeRow}
										<li role="treeitem" aria-selected={rowSelected(wallRow)}>
											<button
												type="button"
												class="tree-row wall-row"
												class:tree-row--selected={rowSelected(wallRow)}
												aria-disabled={!roomRowInteractive(wallRow)}
												onclick={roomRowInteractive(wallRow)
													? () => selectWall(room, wall.segmentId)
													: undefined}
											>
												<span class="tree-row__label" title={wall.segmentId}>Wall · {formatPlacementLabel(wall.segmentId)}</span>
												{#if wall.anchors.length > 0}
													<span class="tree-row__meta">{wall.anchors.length}</span>
												{/if}
											</button>
											{#if wall.anchors.length > 0}
												<ul class="wall-children" role="group" aria-label={`${wall.segmentId} bend anchors`}>
													{#each wall.anchors as anchor (anchor.anchorId)}
														{@const anchorRow = {
															kind: 'interiorAnchor',
															roomId: anchor.roomId,
															segmentId: anchor.segmentId,
															anchorId: anchor.anchorId
														} satisfies UnifiedTreeRow}
														<li role="treeitem" aria-selected={rowSelected(anchorRow)}>
															<button
																type="button"
																class="tree-row anchor-row"
																class:tree-row--selected={rowSelected(anchorRow)}
																aria-disabled={!roomRowInteractive(anchorRow)}
																onclick={roomRowInteractive(anchorRow)
																	? () => selectAnchor(room, wall.segmentId, anchor.anchorId)
																	: undefined}
															>
																<span class="tree-row__label" title={anchor.anchorId}>Bend anchor · {formatPlacementLabel(anchor.anchorId)}</span>
															</button>
														</li>
													{/each}
												</ul>
											{/if}
										</li>
									{/each}
									{#each room.openings as opening (opening.openingId)}
										{@const openingRow = {
											kind: 'opening',
											roomId: opening.roomId,
											segmentId: opening.segmentId,
											openingId: opening.openingId
										} satisfies UnifiedTreeRow}
									<li role="treeitem" aria-selected={rowSelected(openingRow)}>
										<button
											type="button"
											class="tree-row opening-row"
											class:tree-row--selected={rowSelected(openingRow)}
											aria-disabled={!roomRowInteractive(openingRow)}
											onclick={roomRowInteractive(openingRow)
												? () => selectOpening(room, opening.segmentId, opening.openingId)
												: undefined}
											oncontextmenu={contextMenu
												? (event) =>
													onOpeningRowContextMenu(
														event,
														opening.roomId,
														opening.segmentId,
														opening.openingId
													)
												: undefined}
										>
											<span class="tree-row__label">{opening.kind === 'door' ? 'Door' : 'Window'}</span>
											<span class="tree-row__meta" title={opening.openingId}>{formatPlacementLabel(opening.openingId)}</span>
										</button>
										{#if sceneInteractive}
											<div class="row-actions">
												<button
													type="button"
													class="kebab"
													aria-label={`Actions for ${opening.kind === 'door' ? 'door' : 'window'}`}
													aria-expanded={openMenuFor === `opening:${opening.openingId}`}
													onclick={() => toggleMenu(`opening:${opening.openingId}`)}
												><EllipsisVertical size={14} aria-hidden="true" /></button>
												{#if openMenuFor === `opening:${opening.openingId}`}
													<div class="row-menu" role="menu">
														<button type="button" role="menuitem" class="danger" onclick={() => deleteOpening(room.roomId, opening.openingId)}><Trash2 size={13} aria-hidden="true" /> Delete</button>
													</div>
												{/if}
											</div>
										{/if}
									</li>
									{/each}
									{#each room.objects as object (object.objectId)}
										{@const objectRow = { kind: 'object', objectId: object.objectId } satisfies UnifiedTreeRow}
									<li role="treeitem" aria-selected={rowSelected(objectRow)}>
										<button
											type="button"
											class="tree-row object-row"
											class:tree-row--selected={rowSelected(objectRow)}
											aria-disabled={!roomRowInteractive(objectRow)}
											onclick={roomRowInteractive(objectRow)
												? () => selectObject(object.objectId)
												: undefined}
											oncontextmenu={contextMenu
												? (event) => onObjectRowContextMenu(event, object.objectId)
												: undefined}
										>
											<span class="tree-row__label" title={object.objectId}>{formatPlacementLabel(object.kind)} · {formatPlacementLabel(object.objectId)}</span>
										</button>
										{#if sceneInteractive}
											<div class="row-actions">
												<button
													type="button"
													class="kebab"
													aria-label={`Actions for ${formatPlacementLabel(object.objectId)}`}
													aria-expanded={openMenuFor === `object:${object.objectId}`}
													onclick={() => toggleMenu(`object:${object.objectId}`)}
												><EllipsisVertical size={14} aria-hidden="true" /></button>
												{#if openMenuFor === `object:${object.objectId}`}
													<div class="row-menu" role="menu">
														<button type="button" role="menuitem" class="danger" onclick={() => deleteObject(object.objectId)}><Trash2 size={13} aria-hidden="true" /> Delete</button>
													</div>
												{/if}
											</div>
										{/if}
									</li>
									{/each}
									{#if room.clusters.length > 0 || room.entities.length > 0}
										<li class="group-header" role="presentation">
											<span>Scene</span>
										</li>
									{/if}
									{#each room.clusters as cluster (cluster.clusterId)}
										{@const clusterOpen = store.treeExpandedClusterIds.includes(cluster.clusterId)}
										{@const clusterRow = { kind: 'cluster', clusterId: cluster.clusterId } satisfies UnifiedTreeRow}
										<li
											role="treeitem"
											aria-expanded={clusterOpen}
											aria-selected={rowSelected(clusterRow)}
										>
											<div class="cluster-line">
												<button
													type="button"
													class="tree-row__chevron"
													aria-label={`${clusterOpen ? 'Collapse' : 'Expand'} ${cluster.name}`}
													aria-expanded={clusterOpen}
													onclick={() => store.toggleClusterTreeExpansion(cluster.clusterId)}
												>
													<span class="chevron" class:open={clusterOpen}>›</span>
												</button>
												<button
													type="button"
													class="tree-row cluster-row"
													class:tree-row--selected={rowSelected(clusterRow)}
													aria-disabled={!roomRowInteractive(clusterRow)}
													onclick={roomRowInteractive(clusterRow)
														? () => selectCluster(cluster.clusterId)
														: undefined}
												>
													<span class="cluster-title">
														<span class="folder-icon" aria-hidden="true"></span>
														<span class="tree-row__label" title={cluster.name}>{cluster.name}</span>
													</span>
													<span class="tree-row__meta">{cluster.memberIds.length}</span>
												</button>
											</div>
											{#if clusterOpen}
												<ul class="cluster-members" role="group" aria-label={`${cluster.name} members`}>
													{#each cluster.memberIds as memberId (memberId)}
														{@const entity = sceneEntitiesById.get(memberId)}
														{@const memberRow = { kind: 'entity', entityId: memberId } satisfies UnifiedTreeRow}
													{#if entity}
														<li role="treeitem" aria-selected={rowSelected(memberRow)}>
																	<div class="member-line">
																		<button
																			type="button"
																			class="tree-row object-row"
																			class:tree-row--selected={rowSelected(memberRow)}
																			aria-disabled={!roomRowInteractive(memberRow)}
																			onclick={roomRowInteractive(memberRow)
																				? (event) => selectEntity(entity, event)
																				: undefined}
																		>
																			<span class="tree-row__label" title={entityLabel(entity)}>{entityLabel(entity)}</span>
																			<span class="tree-row__meta" title={entityMeta(entity)}>{entityMeta(entity)}</span>
																		</button>
																		<button
																			class="mini-action"
																			type="button"
																			aria-label={`Remove ${entityLabel(entity)} from ${cluster.name}`}
																			disabled={!sceneInteractive}
																			onclick={() => store.removeMemberFromCluster(cluster.clusterId, memberId)}
																		>−</button>
														{#if sceneInteractive}
															<div class="row-actions">
																				<button
																					type="button"
																					class="eye"
																					aria-pressed={!store.isEntityHidden(entity.id)}
																					aria-label={`${store.isEntityHidden(entity.id) ? 'Show' : 'Hide'} ${entityLabel(entity)}`}
																					title={store.isEntityHidden(entity.id) ? 'Show in viewport' : 'Hide in viewport'}
																					onclick={() => toggleEntityHidden(entity.id)}
																				>{#if store.isEntityHidden(entity.id)}<EyeOff size={14} aria-hidden="true" />{:else}<Eye size={14} aria-hidden="true" />{/if}</button>
																				<button
																					type="button"
																					class="kebab"
																					aria-label={`Actions for ${entityLabel(entity)}`}
																					aria-expanded={openMenuFor === `entity:${entity.id}`}
																					onclick={() => toggleMenu(`entity:${entity.id}`)}
																				><EllipsisVertical size={14} aria-hidden="true" /></button>
																				{#if openMenuFor === `entity:${entity.id}`}
																					<div class="row-menu" role="menu">
																						<button type="button" role="menuitem" onclick={() => frameEntity(entity.id)}><Scan size={13} aria-hidden="true" /> Frame</button>
																						<button type="button" role="menuitem" class="danger" onclick={() => deleteEntity(entity.id)}><Trash2 size={13} aria-hidden="true" /> Delete</button>
																					</div>
																				{/if}
																			</div>
																		{/if}
																	</div>
																</li>

														{/if}
													{/each}
												</ul>
											{/if}
										</li>
									{/each}
									{#each room.entities as entry (entry.entityId)}
										{@const entity = sceneEntitiesById.get(entry.entityId)}
										{@const entityRow = { kind: 'entity', entityId: entry.entityId } satisfies UnifiedTreeRow}
										{#if entity && !clusteredPlacementIds.has(entry.entityId)}
										<li role="treeitem" aria-selected={rowSelected(entityRow)}>
											<div class="member-line">
												<button
													type="button"
													class="tree-row object-row"
													class:tree-row--selected={rowSelected(entityRow)}
													aria-disabled={!roomRowInteractive(entityRow)}
													onclick={roomRowInteractive(entityRow)
														? (event) => selectEntity(entity, event)
														: undefined}
													oncontextmenu={contextMenu
														? (event) => onEntityRowContextMenu(entity, event)
														: undefined}
												>
													<span class="tree-row__label" title={entityLabel(entity)}>{entityLabel(entity)}</span>
													<span class="tree-row__meta" title={entityMeta(entity)}>{entityMeta(entity)}</span>
												</button>
												{#if sceneInteractive && isSceneModelEntity(entity) && store.selectedCluster?.roomId === room.roomId}
													<button
														class="mini-action"
														type="button"
														aria-label={`Add ${entityLabel(entity)} to selected cluster`}
														onclick={() => store.addMemberToCluster(store.selectedClusterId!, entry.entityId)}
													>+</button>
												{/if}
										{#if sceneInteractive}
											<div class="row-actions">
														<button
															type="button"
															class="eye"
															aria-pressed={!store.isEntityHidden(entity.id)}
															aria-label={`${store.isEntityHidden(entity.id) ? 'Show' : 'Hide'} ${entityLabel(entity)}`}
															title={store.isEntityHidden(entity.id) ? 'Show in viewport' : 'Hide in viewport'}
															onclick={() => toggleEntityHidden(entity.id)}
														>{#if store.isEntityHidden(entity.id)}<EyeOff size={14} aria-hidden="true" />{:else}<Eye size={14} aria-hidden="true" />{/if}</button>
														<button
															type="button"
															class="kebab"
															aria-label={`Actions for ${entityLabel(entity)}`}
															aria-expanded={openMenuFor === `entity:${entity.id}`}
															onclick={() => toggleMenu(`entity:${entity.id}`)}
														><EllipsisVertical size={14} aria-hidden="true" /></button>
														{#if openMenuFor === `entity:${entity.id}`}
															<div class="row-menu" role="menu">
																<button type="button" role="menuitem" onclick={() => frameEntity(entity.id)}><Scan size={13} aria-hidden="true" /> Frame</button>
																<button type="button" role="menuitem" class="danger" onclick={() => deleteEntity(entity.id)}><Trash2 size={13} aria-hidden="true" /> Delete</button>
															</div>
														{/if}
													</div>
												{/if}
											</div>
										</li>
										{/if}
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>

	<!-- P23.6b — canonical document-level roots. Populated for wall-first
			documents only (format-gated); the component renders no empty groups,
			so legacy documents keep exactly their Room-nested projection. -->
	{#if model.architecture.walls.length > 0}
		<div class="tree-root">
			<button
				type="button"
				class="tree-root__row"
				aria-expanded={architectureOpen}
				onclick={() => (architectureOpen = !architectureOpen)}
			>
				<span class="chevron" class:open={architectureOpen}>›</span>
				<span class="tree-row__label tree-root__label">Architecture</span>
				<span class="tree-row__meta">{model.architecture.walls.length}</span>
			</button>
			{#if architectureOpen}
				<!-- D1 — Architecture → Walls → Wall → Opening. The Walls
					subgroup keeps the wall list from being structural clutter
					directly under the root; Topology… stays its sibling. -->
				<button
					type="button"
					class="tree-row topology-toggle"
					aria-expanded={wallsOpen}
					onclick={() => (wallsOpen = !wallsOpen)}
				>
					<span class="chevron" class:open={wallsOpen}>›</span>
					<span class="tree-row__label">Walls</span>
					<span class="tree-row__meta">{model.architecture.walls.length}</span>
				</button>
				{#if wallsOpen}
				<ul role="tree" aria-label="Architecture walls">
					{#each visibleModel.architecture.walls as wall (wall.wallId)}
						{@const wallRow = { kind: 'physicalWall', wallId: wall.wallId } satisfies UnifiedTreeRow}
						{@const wallOpen = wall.openings.length > 0 && (openWallIds.includes(wall.wallId) || wall.openings.some((opening) => activeSelection.active.domain === 'layout' && activeSelection.active.selection.kind === 'wallOpening' && activeSelection.active.selection.wallId === wall.wallId && activeSelection.active.selection.openingId === opening.openingId))}
						<li role="treeitem" aria-expanded={wall.openings.length > 0} aria-selected={rowSelected(wallRow)}>
							<div class="room-line">
								<button
									type="button"
									class="tree-row__chevron"
									class:invisible={wall.openings.length === 0}
									aria-label={`${wallOpen ? 'Collapse' : 'Expand'} ${wall.wallId} openings`}
									aria-expanded={wallOpen}
									disabled={wall.openings.length === 0}
									onclick={() => toggleWallRow(wall.wallId)}
								>
									<span class="chevron" class:open={wallOpen}>›</span>
								</button>
								<button
									type="button"
									class="tree-row wall-row"
									class:tree-row--selected={rowSelected(wallRow)}
									aria-disabled={!roomRowInteractive(wallRow)}
									data-reveal-id={`architecture:${wall.wallId}`}
									onclick={roomRowInteractive(wallRow) ? () => selectPhysicalWall(wall.wallId) : undefined}
									oncontextmenu={contextMenu ? (event) => onWallRowContextMenu(event, wall.wallId) : undefined}
								>
								<span class="tree-row__label" title={`${wall.wallId} · ${wall.role} · ${wall.height.toFixed(2)} m${wallBoundedRoomNames(wall.wallId).length > 0 ? ` — bounds ${wallBoundedRoomNames(wall.wallId).join(', ')}` : ' — bounds no room'}`}>Wall · {formatPlacementLabel(wall.wallId)}</span>
								{#if wallBoundedRoomNames(wall.wallId).length > 0}
									<span class="tree-row__meta" title={`Bounds ${wallBoundedRoomNames(wall.wallId).join(', ')} · ${wall.role} · ${wall.height.toFixed(2)} m`}>{wallBoundedRoomNames(wall.wallId).join(', ')}</span>
								{:else}
									<span class="tree-row__meta" title={`${wall.role} · ${wall.height.toFixed(2)} m`}>{wall.role} · {wall.height.toFixed(2)} m</span>
								{/if}
								</button>
							</div>
							{#if wallOpen}
								<ul class="wall-children" role="group" aria-label={`${wall.wallId} openings`}>
									{#each wall.openings as opening (opening.openingId)}
										{@const openingRow = { kind: 'wallOpening', wallId: wall.wallId, openingId: opening.openingId } satisfies UnifiedTreeRow}
										<li role="treeitem" aria-selected={rowSelected(openingRow)}>
											<button
												type="button"
												class="tree-row opening-row"
												class:tree-row--selected={rowSelected(openingRow)}
												aria-disabled={!roomRowInteractive(openingRow)}
												data-reveal-id={`architecture:${wall.wallId}:${opening.openingId}`}
												onclick={roomRowInteractive(openingRow) ? () => selectHostedOpening(wall.wallId, opening.openingId) : undefined}
											>
												<span class="tree-row__label">{opening.kind === 'door' ? 'Door' : 'Window'}</span>
												<span class="tree-row__meta" title={opening.openingId}>{formatPlacementLabel(opening.openingId)}</span>
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ul>
				{/if}
				<!-- D4 — Junctions stay behind the Topology disclosure; the
					disclosed surface is canonical-selection navigation (the old
					Architecture · exact inventory re-homed), never a second model. -->
				<button
					type="button"
					class="tree-row topology-toggle"
					aria-expanded={topologyOpen}
					onclick={() => (topologyOpen = !topologyOpen)}
				>
					<span class="chevron" class:open={topologyOpen}>›</span>
					<span class="tree-row__label">Topology…</span>
					<span class="tree-row__meta">{model.architecture.junctions.length}</span>
				</button>
				{#if topologyOpen}
					<ul class="wall-children" role="tree" aria-label="Junction topology">
						{#each visibleModel.architecture.junctions as junction (junction.junctionId)}
							{@const junctionRow = { kind: 'junction', junctionId: junction.junctionId } satisfies UnifiedTreeRow}
							<li role="treeitem" aria-selected={rowSelected(junctionRow)}>
								<button
									type="button"
									class="tree-row junction-row"
									class:tree-row--selected={rowSelected(junctionRow)}
									aria-disabled={!roomRowInteractive(junctionRow)}
									data-reveal-id={`topology:${junction.junctionId}`}
									onclick={roomRowInteractive(junctionRow) ? () => selectJunctionRow(junction.junctionId) : undefined}
								>
									<span class="tree-row__label">Junction · {formatPlacementLabel(junction.junctionId)}</span>
									<span class="tree-row__meta">{junction.point[0].toFixed(2)}, {junction.point[1].toFixed(2)}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	{/if}

	{#if model.layoutObjects.length > 0}
		<div class="tree-root">
			<button
				type="button"
				class="tree-root__row"
				aria-expanded={layoutObjectsOpen}
				onclick={() => (layoutObjectsOpen = !layoutObjectsOpen)}
			>
				<span class="chevron" class:open={layoutObjectsOpen}>›</span>
				<span class="tree-row__label tree-root__label">Layout Objects</span>
				<span class="tree-row__meta">{model.layoutObjects.length}</span>
			</button>
			{#if layoutObjectsOpen}
				<ul role="tree" aria-label="Layout objects">
					{#each visibleModel.layoutObjects as object (object.objectId)}
						{@const objectRow = { kind: 'object', objectId: object.objectId } satisfies UnifiedTreeRow}
						<li role="treeitem" aria-selected={rowSelected(objectRow)}>
							<div class="member-line">
								<button
									type="button"
									class="tree-row object-row"
									class:tree-row--selected={rowSelected(objectRow)}
									aria-disabled={!roomRowInteractive(objectRow)}
									data-reveal-id={`layoutObjects:${object.objectId}`}
									onclick={roomRowInteractive(objectRow) ? () => selectObject(object.objectId) : undefined}
								>
									<span class="tree-row__label" title={object.objectId}>{formatPlacementLabel(object.kind)} · {formatPlacementLabel(object.objectId)}</span>
								</button>
								{#if sceneInteractive}
									<div class="row-actions">
										<button
											type="button"
											class="kebab"
											aria-label={`Actions for ${formatPlacementLabel(object.objectId)}`}
											aria-expanded={openMenuFor === `object:${object.objectId}`}
											onclick={() => toggleMenu(`object:${object.objectId}`)}
										><EllipsisVertical size={14} aria-hidden="true" /></button>
										{#if openMenuFor === `object:${object.objectId}`}
											<div class="row-menu" role="menu">
												<button type="button" role="menuitem" class="danger" onclick={() => deleteObject(object.objectId)}><Trash2 size={13} aria-hidden="true" /> Delete</button>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	{#if model.sceneContent.clusters.length > 0 || model.sceneContent.entities.length > 0}
		<div class="tree-root">
			<button
				type="button"
				class="tree-root__row"
				aria-expanded={sceneContentOpen}
				onclick={() => (sceneContentOpen = !sceneContentOpen)}
			>
				<span class="chevron" class:open={sceneContentOpen}>›</span>
				<span class="tree-row__label tree-root__label">Scene Content</span>
				<span class="tree-row__meta">{model.sceneContent.clusters.length + model.sceneContent.entities.length}</span>
			</button>
			{#if sceneContentOpen}
				<ul role="tree" aria-label="Scene content">
					{#each visibleModel.sceneContent.clusters as cluster (cluster.clusterId)}
						{@const clusterRow = { kind: 'cluster', clusterId: cluster.clusterId } satisfies UnifiedTreeRow}
						{@const clusterOpen = store.treeExpandedClusterIds.includes(cluster.clusterId)}
						<li role="treeitem" aria-expanded={clusterOpen} aria-selected={rowSelected(clusterRow)}>
							<div class="cluster-line">
								<button
									type="button"
									class="tree-row__chevron"
									aria-label={`${clusterOpen ? 'Collapse' : 'Expand'} ${cluster.name}`}
									aria-expanded={clusterOpen}
									onclick={() => store.toggleClusterTreeExpansion(cluster.clusterId)}
								>
									<span class="chevron" class:open={clusterOpen}>›</span>
								</button>
								<button
									type="button"
									class="tree-row cluster-row"
									class:tree-row--selected={rowSelected(clusterRow)}
									aria-disabled={!roomRowInteractive(clusterRow)}
									onclick={roomRowInteractive(clusterRow) ? () => selectCluster(cluster.clusterId) : undefined}
								>
									<span class="cluster-title">
										<span class="folder-icon" aria-hidden="true"></span>
										<span class="tree-row__label" title={cluster.name}>{cluster.name}</span>
									</span>
									<span class="tree-row__meta">{cluster.memberIds.length}</span>
								</button>
							</div>
							{#if clusterOpen}
								<ul class="cluster-members" role="group" aria-label={`${cluster.name} members`}>
									{#each cluster.memberIds as memberId (memberId)}
										{@const entity = sceneEntitiesById.get(memberId)}
										{@const memberRow = { kind: 'entity', entityId: memberId } satisfies UnifiedTreeRow}
										{#if entity}
											<li role="treeitem" aria-selected={rowSelected(memberRow)}>
												<div class="member-line">
													<button
														type="button"
														class="tree-row object-row"
														class:tree-row--selected={rowSelected(memberRow)}
														aria-disabled={!roomRowInteractive(memberRow)}
														onclick={roomRowInteractive(memberRow) ? (event) => selectEntity(entity, event) : undefined}
													>
														<span class="tree-row__label" title={entityLabel(entity)}>{entityLabel(entity)}</span>
														<span class="tree-row__meta" title={entityMeta(entity)}>{entityMeta(entity)}</span>
													</button>
												</div>
											</li>
										{/if}
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
					{#each visibleModel.sceneContent.entities as entry (entry.entityId)}
						{@const entity = sceneEntitiesById.get(entry.entityId)}
						{@const entityRow = { kind: 'entity', entityId: entry.entityId } satisfies UnifiedTreeRow}
						{#if entity}
							<li role="treeitem" aria-selected={rowSelected(entityRow)}>
								<div class="member-line">
									<button
										type="button"
										class="tree-row object-row"
										class:tree-row--selected={rowSelected(entityRow)}
										aria-disabled={!roomRowInteractive(entityRow)}
										data-reveal-id={`scene:${entry.entityId}`}
										onclick={roomRowInteractive(entityRow) ? (event) => selectEntity(entity, event) : undefined}
									>
										<span class="tree-row__label" title={entityLabel(entity)}>{entityLabel(entity)}</span>
										<span class="tree-row__meta" title={entityMeta(entity)}>{entityMeta(entity)}</span>
									</button>
								</div>
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<div class="tree-root">
		<button
			type="button"
			class="tree-root__row"
			aria-expanded={cameraTourOpen}
			onclick={() => (cameraTourOpen = !cameraTourOpen)}
		>
			<span class="chevron" class:open={cameraTourOpen}>›</span>
			<span class="tree-row__label tree-root__label">Camera Flow</span>
			<span class="tree-row__meta">{store.document.navigationNodes.length}</span>
		</button>
		{#if cameraTourOpen}
			{#if store.document.navigationNodes.length === 0}
				<p class="empty">No cameras</p>
			{:else}
				<CameraFlowPanel {store} interactive={cameraInteractive} />
			{/if}
		{/if}
	</div>
</section>

<style>
	.unified-tree { display: flex; min-width: 0; flex-direction: column; gap: 0.6rem; }

	/* S10.1 — hierarchy filter/search bar. */
	.tree-filter {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.35rem;
		padding: 0.22rem 0.3rem;
		border: 1px solid var(--editor-border-subtle);
		border-radius: 0.34rem;
		background: var(--editor-bg-panel-raised);
	}
	.tree-filter:focus-within { border-color: var(--editor-accent-border); box-shadow: inset 0 0 0 1px var(--editor-accent-pressed); }
	.tree-filter__icon { display: inline-flex; flex: 0 0 auto; align-items: center; color: var(--editor-text-muted); }
	.tree-filter__input {
		flex: 1 1 auto;
		min-width: 0;
		padding: 0.3rem 0;
		border: 0;
		background: transparent;
		color: var(--editor-text-primary);
		font: inherit;
		font-size: 0.73rem;
	}
	.tree-filter__input::placeholder { color: var(--editor-text-disabled); }
	.tree-filter__input:focus { outline: none; }
	.tree-filter__action {
		display: inline-flex;
		flex: 0 0 auto;
		width: 1.6rem;
		height: 1.6rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 0.24rem;
		background: transparent;
		color: var(--editor-text-muted);
		cursor: pointer;
	}
	.tree-filter__action:hover { border-color: var(--editor-border-normal); background: var(--editor-bg-control); color: var(--editor-text-primary); }
	.tree-filter__action.active { border-color: var(--editor-accent-border); background: var(--editor-bg-selected); color: var(--editor-text-primary); }

	.tree-root { display: flex; min-width: 0; flex-direction: column; gap: 0.25rem; }
	.tree-root__header { display: flex; min-width: 0; align-items: center; gap: 0.2rem; }
	.tree-root__header .tree-root__row { flex: 1 1 auto; }
	.tree-root__add {
		display: inline-flex;
		width: 1.9rem;
		min-height: 2.125rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 0.28rem;
		background: transparent;
		color: var(--editor-text-muted);
		cursor: pointer;
	}
	.tree-root__add:hover { border-color: var(--editor-accent-border); background: var(--editor-bg-selected); color: var(--editor-text-primary); }
	.tree-root__row {
		display: flex;
		width: 100%;
		min-width: 0;
		min-height: 2.125rem;
		box-sizing: border-box;
		align-items: center;
		gap: 0.45rem;
		padding: 0.28rem 0.45rem;
		border: 1px solid transparent;
		border-radius: 0.28rem;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.tree-root__row:hover { border-color: var(--editor-border-normal); background: var(--editor-bg-control); }
	.tree-root__label { font-size: 0.8rem; font-weight: 650; letter-spacing: 0.02em; }
	.chevron { display: block; font-size: 1rem; line-height: 1; transform: rotate(0); transition: transform 120ms ease; }
	.chevron.open { transform: rotate(90deg); }
	ul { min-width: 0; margin: 0; padding: 0; list-style: none; }
	ul[role='tree'], .room-children, .cluster-members, .wall-children { display: flex; min-width: 0; flex-direction: column; gap: 0.12rem; }
	.room-line, .cluster-line { display: grid; min-width: 0; grid-template-columns: 1.7rem minmax(0, 1fr) auto; gap: 0.1rem; }
	.tree-row { display: flex; width: 100%; min-width: 0; min-height: 2rem; box-sizing: border-box; align-items: center; gap: 0.45rem; padding: 0.28rem 0.45rem; border: 1px solid transparent; border-radius: 0.28rem; background: transparent; color: inherit; font: inherit; text-align: left; }
	button.tree-row { cursor: pointer; }
	button.tree-row:hover:not([aria-disabled='true']) { border-color: var(--editor-border-normal); background: var(--editor-bg-control); }
	button.tree-row[aria-disabled='true'] { opacity: 0.6; }
	.tree-row--selected { border-color: var(--editor-accent-border); background: var(--editor-bg-selected); box-shadow: inset 0 0 0 1px var(--editor-accent-pressed); color: var(--editor-text-primary); }
	.tree-row--selected[aria-disabled='true'] { opacity: 1; }
	.tree-row__chevron { display: grid; width: 1.7rem; min-height: 2rem; place-items: center; padding: 0; border: 1px solid transparent; border-radius: 0.28rem; background: transparent; color: var(--editor-accent); cursor: pointer; }
	.tree-row__chevron:hover { border-color: var(--editor-border-normal); background: var(--editor-bg-control); }
	/* P23.3 — reserves the expand/collapse gutter on read-only canonical room
	   rows so they align with the legacy rows instead of shifting left. */
	.tree-row__chevron-spacer { display: block; width: 1.7rem; min-height: 2rem; flex: 0 0 auto; }
	.tree-row__label { min-width: 0; overflow: hidden; font-size: 0.74rem; font-weight: 570; text-overflow: ellipsis; white-space: nowrap; }
	.tree-row__meta { min-width: 0; margin-left: auto; overflow: hidden; color: var(--editor-text-muted); font-size: 0.62rem; text-overflow: ellipsis; white-space: nowrap; }
	.tree-row--selected .tree-row__meta { color: var(--editor-text-primary); }
	.room-row { min-height: 2.125rem; }
	.room-children { margin: 0.12rem 0 0.2rem 0.85rem; padding-left: 0.65rem; border-left: 1px solid var(--editor-border-subtle); }
	.group-header { padding: 0.3rem 0.45rem 0.1rem; color: var(--editor-text-muted); font-size: 0.62rem; font-weight: 650; letter-spacing: 0.05em; text-transform: uppercase; }
	/* P23.6b — filter-safe reveal affordance + Topology disclosure. */
	.tree-reveal-hint {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.45rem;
		border: 1px solid var(--editor-accent-border);
		border-radius: 0.34rem;
		background: var(--editor-bg-panel-raised);
		color: var(--editor-text-secondary);
		font-size: 0.68rem;
	}
	.tree-reveal-hint button {
		padding: 0.15rem 0.45rem;
		border: 1px solid var(--editor-border-normal);
		border-radius: 0.24rem;
		background: transparent;
		color: var(--editor-text-primary);
		font: inherit;
		font-size: 0.66rem;
		cursor: pointer;
	}
	.tree-reveal-hint button:hover { border-color: var(--editor-accent-border); background: var(--editor-bg-selected); }
	.topology-toggle { min-height: 1.8rem; margin: 0.1rem 0 0 0.85rem; }
	.invisible { visibility: hidden; }
	.wall-children, .cluster-members { margin-left: 0.85rem; padding-left: 0.62rem; border-left: 1px solid var(--editor-border-normal); }
	.cluster-row { justify-content: space-between; }
	.cluster-title { display: flex; min-width: 0; align-items: center; gap: 0.4rem; }
	.folder-icon { position: relative; display: inline-block; width: 0.78rem; height: 0.54rem; flex: 0 0 auto; margin-top: 0.08rem; border-radius: 0.1rem; background: var(--editor-accent); }
	.folder-icon::before { content: ''; position: absolute; left: 0.07rem; top: -0.15rem; width: 0.32rem; height: 0.18rem; border-radius: 0.08rem 0.08rem 0 0; background: var(--editor-accent); }
	.member-line { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr) auto auto; align-items: stretch; gap: 0.2rem; }
	.mini-action { width: 1.8rem; min-height: 2rem; padding: 0; border: 1px solid var(--editor-border-normal); border-radius: 0.28rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-primary); cursor: pointer; }
	.mini-action:hover:not(:disabled) { border-color: var(--editor-accent-border); background: var(--editor-bg-selected); }
	.mini-action:disabled { opacity: 0.35; cursor: default; }
	.empty { color: var(--editor-text-muted); font-size: 0.7rem; padding: 0.3rem 0.45rem 0.4rem; }

	/* S10.1 — per-row visibility + kebab actions. */
	.row-actions { position: relative; display: flex; align-items: center; gap: 0.12rem; }
	.eye,
	.kebab {
		display: inline-flex;
		width: 1.45rem;
		min-height: 1.7rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 0.24rem;
		background: transparent;
		color: var(--editor-text-muted);
		cursor: pointer;
	}
	.eye:hover,
	.kebab:hover,
	.kebab[aria-expanded='true'] { border-color: var(--editor-border-normal); background: var(--editor-bg-control); color: var(--editor-text-primary); }
	.eye[aria-pressed='false'] { color: var(--editor-text-disabled); }
	.row-menu {
		position: absolute;
		top: calc(100% + 0.2rem);
		right: 0;
		z-index: 30;
		display: flex;
		min-width: 8rem;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.3rem;
		border: 1px solid color-mix(in srgb, var(--editor-border-normal) 88%, transparent);
		border-radius: 0.34rem;
		background: var(--editor-bg-panel-raised);
		box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 42%);
	}
	.row-menu button {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.34rem 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.26rem;
		background: transparent;
		color: var(--editor-text-secondary);
		font: inherit;
		font-size: 0.68rem;
		text-align: left;
		cursor: pointer;
	}
	.row-menu button:hover { border-color: var(--editor-border-normal); background: var(--editor-bg-control); color: var(--editor-text-primary); }
	.row-menu button.danger { color: var(--editor-danger-fg); }
	.row-menu button.danger:hover { border-color: var(--editor-danger-border); background: var(--editor-danger-soft); color: var(--editor-danger-fg); }
</style>
