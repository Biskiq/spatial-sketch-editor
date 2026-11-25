import { createStudioPort } from './studio-port.svelte';
import { createStudioFind } from './studio-find.svelte';
import { createStudioEntrySession } from './studio-entry-session.svelte';
import { createStudioStrips } from './studio-strips.svelte';
import { createStudioController, type StudioController, type StudioPorts } from './studio-controller.svelte';
import type { StudioLens } from './studio-view';

/**
 * Studio: the Object Studio session, its Find projection, its URL entry and
 * Place-copy arrival, and the World strips it mounts.
 *
 * Canonical writers: the Studio controller writes the scoped subject and the
 * Camera through the Stage session; the project session owns every source
 * write. This entry holds no state of its own.
 */
export function createStudioFeature(deps: {
	readonly ports: StudioPorts;
	readonly lens: () => StudioLens;
	readonly previewing: () => boolean;
	readonly ready: () => boolean;
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
	const controller = createStudioController(deps.ports);
	const port = createStudioPort({
		controller: () => controller,
		lens: deps.lens,
		previewing: deps.previewing,
		armObjects: deps.armObjects,
		dockReady: deps.dockReady
	});
	const find = createStudioFind({
		controller: () => controller,
		revision: () => port.revision,
		lens: deps.lens,
		previewing: deps.previewing,
		selectedEntityId: deps.ports.selectedEntityId,
		entities: deps.ports.entities
	});
	const entry = createStudioEntrySession({
		controller: () => controller,
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
		selectedEntityId: deps.ports.selectedEntityId,
		entities: deps.ports.entities,
		attachArm: port.attachArm,
		navigate: deps.navigate
	});

	const strips = createStudioStrips({
		controller: () => controller,
		previewing: deps.previewing,
		lens: deps.lens
	});

	return {
		id: 'studio' as const,
		get controller(): StudioController {
			return controller;
		},
		lifecycle: {
			resetPresentation: { end: () => controller.end() },
			accepted: {
				reconcile: () => controller.reconcile(),
				'settle-transfer': entry.settleTransfer
			},
			historyInstalled: { reconcile: () => controller.reconcile() },
			leaveLens: {
				'leave-for-lens': (next: 'world' | 'experience') => {
					if (next !== 'world') return controller.leaveForLens();
				}
			}
		},
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
			get scope() { return strips.scope; },
			get root() { return strips.root; }
		}
	};
}
