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
	/** P23.6c — canonical wall-first Wall target (document-global `wallId`). */
	| { kind: 'wall'; wallId: string }
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
	deleteObject(objectId: string): void;
};

export function buildPlanLayoutContextMenuItems(input: {
	target: PlanLayoutTarget;
	mutationBlockedReason: string | null;
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
	// P23.6c — wall targets expose exactly the canonical Wall delete; callers
	// without the action get no items (same omit-don't-dummy policy as Rooms).
	if (target.kind === 'wall') {
		if (!input.actions.deleteWall) return [];
		return [
			{
				id: 'delete-wall',
				label: 'Delete wall',
				danger: true,
				disabledReason: deleteDisabled,
				run: () => input.actions.deleteWall!(target.wallId)
			}
		];
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
