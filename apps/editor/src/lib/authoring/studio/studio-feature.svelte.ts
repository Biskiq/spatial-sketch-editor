import { createStudioPort } from './studio-port.svelte';
import { createStudioFind } from './studio-find.svelte';
import { createStudioEntrySession } from './studio-entry-session.svelte';
import type { StudioController } from './studio-controller.svelte';
import type { StudioLens, StudioRootView, StudioScopeView } from './studio-view';

/**
 * Studio: the Object Studio session, its Find projection, its URL entry and
 * Place-copy arrival, and the World strips it mounts.
 *
 * Canonical writers: the Studio controller writes the scoped subject and the
 * Camera through the Stage session; the project session owns every source
 * write. This entry holds no state of its own.
 */
export function createStudioFeature(deps: {
	readonly controller: () => StudioController | undefined;
	readonly lens: () => StudioLens;
	readonly previewing: () => boolean;
	readonly ready: () => boolean;
	readonly entities: () => readonly { readonly id: string; readonly name: string; readonly kind: string }[];
	readonly selectedEntityId: () => string | null;
	readonly armObjects: () => void;
	readonly dockReady: () => boolean;
	readonly intent: string;
	readonly entry: { readonly studio: boolean; readonly objectId: string | null; readonly copyId: string | null };
	readonly placeCopyItem: string | null;
	readonly projectId: string;
	readonly renderRootsRevision: () => number;
	readonly taskOpen: () => boolean;
	readonly activeWorldTool: () => string | null;
	readonly libraryOpen: () => boolean;
	readonly navigate: (href: string) => void;
}) {
	const port = createStudioPort({
		controller: deps.controller,
		lens: deps.lens,
		previewing: deps.previewing,
		armObjects: deps.armObjects,
		dockReady: deps.dockReady
	});
	const find = createStudioFind({
		controller: deps.controller,
		revision: () => port.revision,
		lens: deps.lens,
		previewing: deps.previewing,
		selectedEntityId: deps.selectedEntityId,
		entities: deps.entities
	});
	const entry = createStudioEntrySession({
		controller: deps.controller,
		ready: deps.ready,
		intent: deps.intent,
		entry: deps.entry,
		placeCopyItem: deps.placeCopyItem,
		projectId: deps.projectId,
		renderRootsRevision: deps.renderRootsRevision,
		dockReady: deps.dockReady,
		armObjects: deps.armObjects,
		armPending: () => port.armPending,
		taskOpen: deps.taskOpen,
		activeWorldTool: deps.activeWorldTool,
		libraryOpen: deps.libraryOpen,
		selectedEntityId: deps.selectedEntityId,
		entities: deps.entities,
		attachArm: port.attachArm,
		navigate: deps.navigate
	});

	const scope = $derived.by((): StudioScopeView | null => {
		const studio = deps.controller();
		if (studio === undefined || !studio.active || deps.previewing() || deps.lens() !== 'world') return null;
		return {
			phase: studio.phase,
			origin: studio.origin,
			context: studio.context,
			name: studio.rootName,
			rootCount: studio.roots.length,
			onContext: (next) => studio.setContext(next),
			onNewObject: () => studio.newObjectHere(),
			onChoose: () => studio.openChooser(),
			onBackToWorld: () => studio.backToWorld(),
			onBackToProjects: () => studio.backToProjects(),
			onOpenInWorld: () => studio.openInWorld(),
			onPlaceCopy: () => void studio.placeCopyInWorld(),
			placingCopy: studio.placingCopy
		};
	});

	const root = $derived.by((): StudioRootView | null => {
		const studio = deps.controller();
		if (studio === undefined || !studio.active || deps.previewing() || deps.lens() !== 'world') return null;
		return {
			phase: studio.phase,
			roots: studio.roots,
			origin: studio.origin,
			creating: studio.creating,
			onChoose: (id) => studio.chooseRoot(id),
			onOpenChooser: () => studio.openChooser(),
			onNewObject: () => studio.newObjectHere(),
			onBackToWorld: () => studio.backToWorld(),
			onBackToProjects: () => studio.backToProjects(),
			onOpenInWorld: () => studio.openInWorld(),
			onCancelCreation: () => studio.cancelCreation()
		};
	});

	return {
		id: 'studio' as const,
		attachEntry: entry.attachEntry,
		ports: {
			objectStudio: port.objectStudioPort,
			armCreation: port.armCreation,
			bumpRevision: port.bumpRevision,
			revision: () => port.revision,
			runStudioEntry: entry.runStudioEntry,
			settleTransfer: entry.settleTransfer,
			transferName: () => entry.transferState?.objectName ?? null,
			returnToObject: entry.returnToObject,
			leaveStudio: () => entry.leaveStudio()
		},
		regions: {
			get find() { return find.state; },
			get transfer() { return entry.transfer; },
			get scope() { return scope; },
			get root() { return root; }
		}
	};
}
