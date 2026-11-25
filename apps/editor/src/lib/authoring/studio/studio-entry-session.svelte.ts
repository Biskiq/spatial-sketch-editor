import { untrack } from 'svelte';
import { goto, replaceState } from '$app/navigation';
import { PLACE_COPY_PARAM, studioProjectUrl } from '$lib/platform/studio-entry';
import { requestFormCopyIntake } from '../adapters/scene/library/intake';
import { copyLanded, endFormCopyTransfer, peekFormCopyTransfer, type FormCopyTransfer } from '../adapters/scene/library/transfer';
import type { StudioController } from './studio-controller.svelte';
import type { StudioTransferView } from './studio-view';

/**
 * Studio's URL entry and its cross-project Place copy arrival.
 *
 * Both are one-shot owner effects: the `?studio` posture opens once when the
 * project is on the Stage, and a saved copy arms once. Appendix A row 22 keeps
 * the creation order: retry frame, entry, Place copy, pending arm, creation.
 */
export function createStudioEntrySession(input: {
	readonly controller: () => StudioController | undefined;
	readonly ready: () => boolean;
	readonly projectId: string;
	readonly intent: string;
	readonly entry: { readonly studio: boolean; readonly objectId: string | null; readonly copyId: string | null };
	readonly placeCopyItem: string | null;
	readonly renderRootsRevision: () => number;
	readonly dockReady: () => boolean;
	readonly armObjects: () => void;
	readonly armPending: () => boolean;
	readonly taskOpen: () => boolean;
	readonly activeWorldTool: () => string | null;
	readonly libraryOpen: () => boolean;
	readonly selectedEntityId: () => string | null;
	readonly entities: () => readonly { readonly id: string }[];
	readonly navigate: (href: string) => void;
	readonly attachArm: () => void;
}) {
	let opened = false;
	let placeCopyArmed = false;
	/**
	 * The way back from a cross-project Place copy, while one is pending. Read once:
	 * it belongs to this arrival, and a different project's visit never inherits it.
	 */
	let transfer = $state<FormCopyTransfer | null>(
		input.placeCopyItem !== null &&
			peekFormCopyTransfer()?.itemId === input.placeCopyItem &&
			peekFormCopyTransfer()?.sourceProjectId !== input.projectId
			? peekFormCopyTransfer()
			: null
	);

	function runStudioEntry(id: string): void {
		const studio = input.controller();
		if (studio === undefined) return;
		if (id === 'edit') {
			const selectedId = input.selectedEntityId();
			if (selectedId !== null) void studio.enterFromWorld(selectedId, 'edit-in-studio');
		} else if (id === 'back-to-world') studio.backToWorld();
		else if (id === 'back-to-projects') studio.backToProjects();
		else if (id === 'open-in-world') studio.openInWorld();
		else if (id === 'new-object-here') studio.newObjectHere();
		else if (id === 'choose-object') studio.openChooser();
		else if (id === 'context-world') studio.setContext('world');
		else if (id === 'context-mat') studio.setContext('mat');
		else if (id === 'new-object-project') input.navigate('/studio');
	}

	/** The intended copy landed: its exact minted entity id is in the accepted source. */
	function settleTransfer(): void {
		if (transfer === null) return;
		if (!copyLanded(transfer, input.entities())) return;
		transfer = null;
		endFormCopyTransfer();
	}

	function returnToObject(): void {
		if (transfer === null) return;
		const back = transfer;
		void goto(studioProjectUrl(back.sourceProjectId, { load: true, object: back.objectId })).then(() => {
			endFormCopyTransfer();
		});
	}

	function dismiss(): void {
		transfer = null;
		endFormCopyTransfer();
	}

	/** One-shot: a reload must not re-arm a copy the creator already placed or dismissed. */
	function dismissTransferParam(): void {
		const url = new URL(window.location.href);
		if (!url.searchParams.has(PLACE_COPY_PARAM)) return;
		url.searchParams.delete(PLACE_COPY_PARAM);
		replaceState(`${url.pathname}${url.search}`, {});
	}

	function attachEntry(): void {
		// A frame that waited for the scoped body to mount is retried as bodies change.
		$effect(() => {
			void input.renderRootsRevision();
			const studio = input.controller();
			untrack(() => studio?.retryFrame());
		});
		// Open the posture named by the address once, when the project is on the Stage.
		$effect(() => {
			if (!input.entry.studio || opened) return;
			if (!input.ready()) return;
			opened = true;
			// Open editable copy: only a freshly minted project takes it, at the datum, through
			// the Place instrument's ordinary typed Place.
			if (input.entry.copyId !== null && input.intent === 'create') {
				requestFormCopyIntake(input.projectId, { itemId: input.entry.copyId, mode: 'datum' });
			}
			untrack(() => input.controller()?.openFromEntry({ objectId: input.entry.objectId, minted: input.intent === 'create' }));
		});
		// Place copy in World: arm the saved copy once the project is on the Stage; the creator
		// then clicks where it goes, through the same Place session as My Objects.
		$effect(() => {
			if (input.placeCopyItem === null || placeCopyArmed || input.entry.studio) return;
			if (!input.ready()) return;
			if (!input.dockReady()) return;
			placeCopyArmed = true;
			requestFormCopyIntake(input.projectId, { itemId: input.placeCopyItem, mode: 'arm', entityId: transfer?.entityId });
			untrack(() => input.armObjects());
			dismissTransferParam();
		});
		input.attachArm();
		// A creation gesture that ends with no new form returns the creator to the scoped root.
		$effect(() => {
			const studio = input.controller();
			if (!studio?.creating || input.armPending()) return;
			if (input.taskOpen() || input.libraryOpen()) return;
			if (input.activeWorldTool() === 'objects') return;
			untrack(() => studio.cancelCreation());
		});
	}

	const transferProps = $derived.by((): StudioTransferView | null => {
		if (transfer === null) return null;
		return {
			name: transfer.objectName,
			armed: input.taskOpen() || input.activeWorldTool() === 'objects' || input.libraryOpen(),
			onReturn: returnToObject,
			onDismiss: dismiss
		};
	});

	attachEntry();
	return {
		runStudioEntry,
		settleTransfer,
		returnToObject,
		dismiss,
		attachEntry,
		leaveStudio(): boolean {
			const studio = input.controller();
			return studio !== undefined && studio.active && studio.backToWorld();
		},
		get transfer() { return transferProps; },
		get transferState() { return transfer; }
	};
}
