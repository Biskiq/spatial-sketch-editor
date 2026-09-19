/**
 * P3.4 — Scene Plan menu models.
 *
 * Layout mode resolves through `resolvePlanHit` (room / opening / object);
 * Arrange mode routes through the P10 owner-aware `resolveArrangeHit`
 * target — layout-object targets use the existing Layout commands, scene
 * targets use the existing Scene commands. NO second hit resolver and no
 * new mutators: deletes go through the same guarded layout runner /
 * placement-cluster paths the kebab and Inspector already call.
 *
 * One gesture = one document = at most one correctly tagged history entry;
 * room ownership is never inferred from coordinates here.
 */
import type { ContextMenuItem } from './context-menu-state.svelte';
import { buildSceneEntityContextMenuItems } from './scene-menu-items';

export type PlanLayoutTarget =
	| { kind: 'room'; roomId: string }
	| { kind: 'opening'; roomId: string; openingId: string }
	/**
	 * P23.6c — canonical wall-first Wall target (document-global `wallId`).
	 *
	 * P23.10 — `splitDistance` is the clicked span's already-resolved physical
	 * distance (meters) from the canonical start Junction. It is present only
	 * for viewport targets that carry a projection: a P23.6e hierarchy Wall row
	 * has no spatial coordinate, so it passes nothing and never sees the
	 * Add-junction command (no invented coordinate, no second hit resolver).
	 */
	| { kind: 'wall'; wallId: string; splitDistance?: number }
	/**
	 * P23.14 §13 — canonical wall-first Junction target. The Junction-dissolve
	 * entry point the shell finish owns: it reuses the SAME planner-backed
	 * `dissolveWallFirstJunction` adapter the Delete-key path calls, so the menu
	 * never grows a second dissolve implementation.
	 */
	| { kind: 'junction'; junctionId: string }
	| { kind: 'object'; objectId: string };

export type PlanLayoutMenuActions = {
	/**
	 * Legacy-Room rename only: it routes into `updateLayoutRoomFields`, which
	 * resolves the Room through `layout.floors`. Optional so a caller can
	 * omit it entirely — P23.6b requires a wall-first Room menu to expose NO
	 * rename command (never a no-op dummy). P23.6d keeps that policy: its
	 * canonical `planRoomMetadataUpdate` rename is an Inspector field, not a
	 * menu command, so the hierarchy/viewport menus still pass no `renameRoom`
	 * for wall-first Rooms.
	 */
	renameRoom?(roomId: string): void;
	/**
	 * Legacy-Room delete only: it routes into `deleteLayoutRoom`, which
	 * REJECTS wall-first documents. Optional so a caller can omit it —
	 * P23.6b requires a wall-first Room menu to expose NO delete command
	 * either (never a no-op dummy). A room target with neither action
	 * resolves to an empty item list; callers should skip opening a menu
	 * for those rows entirely (native behavior) rather than show one.
	 */
	deleteRoom?(roomId: string): void;
	/**
	 * P23.6d — canonical wall-first Room removal (the guard-railed
	 * `planRemoveRoom` adapter). Optional and omit-don't-dummy: a caller that
	 * cannot honor it (or a Room with no Room-exclusive boundary Wall) passes
	 * nothing and gets no item at all.
	 */
	removeRoom?(roomId: string): void;
	deleteOpening(roomId: string, openingId: string): void;
	/**
	 * P23.6c — canonical Wall delete (the planner-backed adapter). Optional so
	 * a caller that cannot honor it gets no item at all (never a no-op dummy),
	 * mirroring the `renameRoom`/`deleteRoom` policy.
	 */
	deleteWall?(wallId: string): void;
	/**
	 * P23.10 — canonical Wall subdivision (the planner-backed
	 * `subdivideWallFirstWall` adapter). Exposed only when BOTH this action and
	 * a finite `splitDistance` exist: without a resolved coordinate there is no
	 * honest "here". Same omit-don't-dummy policy as the other optional
	 * commands.
	 */
	addJunction?(wallId: string, splitDistance: number): void;
	/**
	 * P23.11 — canonical bend-point insertion (the same planner-backed adapter
	 * the Bend-command gesture calls). Exposed only when BOTH this action and a
	 * finite resolved distance exist, so the item always means a real "here".
	 * This is the no-keyboard authoring path: the command is discoverable
	 * without a dedicated tool and without a second curve-editing code path.
	 */
	addBendPoint?(wallId: string, bendDistance: number): void;
	/**
	 * P23.14 §13 — the Junction-dissolve command (the planner-backed
	 * `dissolveWallFirstJunction` adapter). Optional like every other command:
	 * a caller that cannot honor it omits it and gets no item.
	 */
	dissolveJunction?(junctionId: string): void;
	deleteObject(objectId: string): void;
};

export function buildPlanLayoutContextMenuItems(input: {
	target: PlanLayoutTarget;
	mutationBlockedReason: string | null;
	/**
	 * P23.14 §13 — the core planner's own refusal reason for a Junction target,
	 * resolved by the caller through `wallFirstJunctionDissolveRefusal`. The
	 * menu states it; it never re-derives eligibility.
	 */
	dissolveBlockedReason?: string | null;
	actions: PlanLayoutMenuActions;
}): ContextMenuItem[] {
	const { target } = input;
	const deleteDisabled = input.mutationBlockedReason;
	if (target.kind === 'room') {
		const items: ContextMenuItem[] = [];
		// P23.6b — omit the command entirely when the caller cannot honor it:
		// a wall-first Room menu must not expose Rename at all, so the tree
		// passes no `renameRoom` instead of a dead callback.
		if (input.actions.renameRoom) {
			items.push({
				id: 'rename-room',
				label: 'Rename…',
				disabledReason: input.mutationBlockedReason,
				run: () => input.actions.renameRoom!(target.roomId)
			});
		}
		// Same policy for delete: `deleteLayoutRoom` rejects wall-first
		// documents, so a caller with no `deleteRoom` action gets no item
		// (never a no-op dummy).
		if (input.actions.deleteRoom) {
			items.push({
				id: 'delete-room',
				label: 'Delete room',
				danger: true,
				separatorBefore: items.length > 0,
				disabledReason: deleteDisabled,
				run: () => input.actions.deleteRoom!(target.roomId)
			});
		}
		// P23.6d — canonical wall-first Room removal. Same omit-don't-dummy
		// policy as rename/delete: a wall-first Room row passes this only when a
		// Room-exclusive boundary Wall is available to open the enclosure.
		if (input.actions.removeRoom) {
			items.push({
				id: 'remove-room',
				label: 'Remove room…',
				danger: true,
				separatorBefore: items.length > 0,
				disabledReason: deleteDisabled,
				run: () => input.actions.removeRoom!(target.roomId)
			});
		}
		return items;
	}
	if (target.kind === 'opening') {
		return [
			{
				id: 'delete-opening',
				label: 'Delete opening',
				danger: true,
				disabledReason: deleteDisabled,
				run: () => input.actions.deleteOpening(target.roomId, target.openingId)
			}
		];
	}
	// P23.14 §13 — the Junction-dissolve entry point. Destructive actions come
	// last in every other branch; a Junction target has exactly this one, and its
	// refusal reason comes from the planner (never from a second eligibility
	// check here). No action, no item — the omit-don't-dummy policy.
	if (target.kind === 'junction') {
		if (!input.actions.dissolveJunction) return [];
		return [
			{
				id: 'dissolve-junction',
				label: 'Dissolve junction…',
				danger: true,
				disabledReason: input.mutationBlockedReason ?? input.dissolveBlockedReason ?? null,
				run: () => input.actions.dissolveJunction!(target.junctionId)
			}
		];
	}
	// P23.6c — wall targets expose the canonical Wall delete; callers without
	// the action get no item (same omit-don't-dummy policy as Rooms).
	if (target.kind === 'wall') {
		const items: ContextMenuItem[] = [];
		// P23.10 — the additive, non-destructive command comes first, and only a
		// caller that resolved a coordinate from the hit projection can offer it.
		const splitDistance = target.splitDistance;
		if (input.actions.addJunction && typeof splitDistance === 'number' && Number.isFinite(splitDistance)) {
			items.push({
				id: 'add-junction',
				label: 'Add junction here',
				disabledReason: deleteDisabled,
				run: () => input.actions.addJunction!(target.wallId, splitDistance)
			});
		}
		// P23.11 — the Bend command's discoverable twin. Same resolved distance
		// authority as **Add junction here**, same omit-don't-dummy policy, and
		// the same canonical chain-algebra planner the ⌘-drag gesture reaches.
		if (input.actions.addBendPoint && typeof splitDistance === 'number' && Number.isFinite(splitDistance)) {
			items.push({
				id: 'add-bend-point',
				label: 'Add bend point here',
				disabledReason: deleteDisabled,
				run: () => input.actions.addBendPoint!(target.wallId, splitDistance)
			});
		}
		if (input.actions.deleteWall) {
			items.push({
				id: 'delete-wall',
				label: 'Delete wall',
				danger: true,
				separatorBefore: items.length > 0,
				disabledReason: deleteDisabled,
				run: () => input.actions.deleteWall!(target.wallId)
			});
		}
		return items;
	}
	return [
		{
			id: 'delete-object',
			label: 'Delete object',
			danger: true,
			disabledReason: deleteDisabled,
			run: () => input.actions.deleteObject(target.objectId)
		}
	];
}

export type ArrangeOwnerTarget =
	| { owner: 'layout-object'; objectId: string }
	| { owner: 'scene'; entityId: string };

/**
 * Owner-routed Arrange items. The caller has ALREADY applied
 * selection-before-menu through the same functions the left-click path uses;
 * these closures only invoke existing commands.
 */
export function buildArrangeContextMenuItems(input: {
	target: ArrangeOwnerTarget;
	/** Session-only hidden state for scene-entity targets. */
	sceneTargetHidden?: boolean;
	mutationBlockedReason: string | null;
	/** Arrange-mode Scene authority gate (mirrors canDeleteSceneSelection). */
	sceneAuthorityBlockedReason?: string | null;
	duplicateBlockedReason?: string | null;
	actions: {
		deleteLayoutObject(objectId: string): void;
		duplicateScene(): void;
		focusScene(entityId: string): void;
		toggleSceneVisibility(entityId: string): void;
		deleteScene(): void;
	};
}): ContextMenuItem[] {
	const target = input.target;
	if (target.owner === 'layout-object') {
		return [
			{
				id: 'delete-layout-object',
				label: 'Delete object',
				danger: true,
				disabledReason: input.mutationBlockedReason,
				run: () => input.actions.deleteLayoutObject(target.objectId)
			}
		];
	}
	return buildSceneEntityContextMenuItems({
		targetHidden: input.sceneTargetHidden ?? false,
		mutationBlockedReason: input.sceneAuthorityBlockedReason ?? input.mutationBlockedReason,
		duplicateBlockedReason: input.duplicateBlockedReason,
		actions: {
			duplicate: input.actions.duplicateScene,
			focus: () => input.actions.focusScene(target.entityId),
			toggleVisibility: () => input.actions.toggleSceneVisibility(target.entityId),
			deleteSelection: input.actions.deleteScene
		}
	});
}
