import { tick } from 'svelte';
import { assets } from '$lib/content/assets';
import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
import type { CameraFreeSceneDocument } from '@portfolio/project-model/units';
import type { ArtworkLibraryEntry } from '@portfolio/project-model/artwork';
import type { LibraryFinishEntry } from './library-catalogue';
import type { StageShellCommands } from '../stage/route/stage-shell-commands';
import type { StageShellState } from '../stage/route/stage-shell-state.svelte';
import type { StageSelectionEntry } from '../stage/semantic-selection';
import type { StageLens } from '../stage/stage-session';
import type { LibraryProps, LibraryView } from './library-view';

export function createLibraryHost(input: {
	readonly shell: StageShellState;
	readonly selection: () => StageSelectionEntry | null;
	readonly finishes: () => {
		libraryBrowse(): LibraryProps['entries'];
		libraryTarget(): NonNullable<LibraryProps['target']> | null;
		readonly librarySwap: LibraryProps['swap'];
		readonly busy: boolean;
		clearLibrarySwap(): void;
		pickMaterialKey(key: string): void;
		applyLibraryFinish(ref: LibraryFinishEntry['ref']): Promise<boolean>;
		applyLibrarySwap(id: Parameters<LibraryProps['onSwap']>[0]): ReturnType<LibraryProps['onSwap']>;
		selectFinishUsers(ref: LibraryFinishEntry['ref']): Promise<boolean>;
		openLibraryDraft(ref: LibraryFinishEntry['ref']): boolean;
		toggleFavouriteMaterial(key: string): void;
	};
	readonly commands: () => Pick<
		StageShellCommands,
		'armWorldTool' | 'toggleWorldLibrary' | 'pickWorldObject' | 'selectTool'
	>;
	readonly scene: () => CameraFreeSceneDocument | null;
	readonly looks: () => LibraryProps['looks'];
	readonly lens: () => StageLens;
	readonly previewing: () => boolean;
	readonly available: () => boolean;
	readonly finishTileSource: (finishId: string) => FinishTileSource | null;
	readonly armArtwork: (entry: ArtworkLibraryEntry) => void;
	readonly importArtwork: (files: File[]) => Promise<unknown>;
	readonly importMaterial: (
		files: readonly File[],
		invoker?: HTMLElement | null,
	) => Promise<unknown>;
	readonly pickLook: NonNullable<LibraryProps['onLook']>;
}) {
	const { shell } = input;
	const libraryEntries = $derived.by(() => {
		void shell.contributionsVersion;
		return input.finishes().libraryBrowse();
	});
	const libraryTarget = $derived.by(() => {
		input.selection();
		void shell.contributionsVersion;
		return input.finishes().libraryTarget();
	});

	function libraryTileSource(entry: LibraryFinishEntry): FinishTileSource | null {
		if (entry.source === 'curated' && entry.curatedId !== null)
			return { kind: 'catalogue', id: entry.curatedId };
		return entry.projectId === null ? null : input.finishTileSource(entry.projectId);
	}
	const libraryObjects = assets
		.filter((asset) => asset.status === 'approved')
		.slice(0, 8)
		.map((asset) => ({ id: asset.id, name: asset.name }));

	/** Where focus lands when the Library closes: the control that opened it. */
	const LIBRARY_INVOKERS = {
		dock: '[data-world-library-key]',
		lights: '[data-world-library-key]',
		paint: '[data-paint-library], [data-paint-library-open]',
		furnish: '[data-furnish-browse]',
		card: '[data-finish-swap]',
	} as const;
	function returnLibraryFocus(from: keyof typeof LIBRARY_INVOKERS): void {
		void tick().then(() => {
			const invoker =
				document.querySelector<HTMLElement>(LIBRARY_INVOKERS[from]) ??
				document.querySelector<HTMLElement>(LIBRARY_INVOKERS.dock);
			invoker?.focus();
		});
	}
	/**
	 * Close the external Library; a Paint pick behind it returns to the tray,
	 * never Select, and a Furnish visit returns to its strip. Focus goes back to
	 * the invoking control unless the close hands the creator to the Stage.
	 */
	function closeLibrary(returnFocus = true): void {
		input.finishes().clearLibrarySwap();
		if (!shell.libraryOpen) return;
		const returnsToPaint = shell.toolBeforeLibrary === 'paint';
		const from = shell.libraryInvocation.from;
		input.commands().toggleWorldLibrary();
		if (returnsToPaint || shell.armedHostTool === 'paint') input.commands().armWorldTool('paint');
		if (returnFocus) returnLibraryFocus(from);
	}
	const props: LibraryProps = {
		get entries() {
			return libraryEntries;
		},
		get intent() {
			return shell.libraryInvocation.intent;
		},
		get target() {
			return libraryTarget;
		},
		get swap() {
			return input.finishes().librarySwap;
		},
		get view() {
			return shell.libraryView;
		},
		get openKind() {
			return shell.libraryInvocation.kind;
		},
		get busy() {
			return input.finishes().busy;
		},
		tileSource: libraryTileSource,
		objects: libraryObjects,
		get artwork() {
			const scene = input.scene();
			return scene === null ? null : (scene.artworkLibrary ?? []);
		},
		get looks() {
			return input.looks();
		},
		get inspection() {
			return shell.libraryInspection;
		},
		onInspection: shell.setLibraryInspection,
		onView: shell.setLibraryView,
		onClose: closeLibrary,
		onPaint(entry, keepOpen) {
			input.finishes().pickMaterialKey(entry.key);
			if (keepOpen) return;
			if (shell.libraryOpen) input.commands().toggleWorldLibrary();
			input.commands().armWorldTool('paint');
		},
		async onReplace(entry, keepOpen) {
			const accepted = await input.finishes().applyLibraryFinish(entry.ref);
			if (!accepted) {
				return {
					ok: false,
					message:
						libraryTarget === null
							? 'Select an object or surface first. Nothing changed.'
							: libraryTarget.finishKey === entry.key
								? `${libraryTarget.label} already wears ${entry.name}.`
								: 'That change could not be made. Nothing changed.',
				};
			}
			if (!keepOpen) closeLibrary();
			return { ok: true };
		},
		async onSwap(materialId, keepOpen) {
			const outcome = await input.finishes().applyLibrarySwap(materialId);
			if (outcome.ok && !keepOpen) closeLibrary();
			return outcome;
		},
		async onSelectUsers(entry) {
			const selected = await input.finishes().selectFinishUsers(entry.ref);
			if (selected) closeLibrary();
			return selected;
		},
		onCustomise(entry) {
			closeLibrary(false);
			if (input.finishes().openLibraryDraft(entry.ref)) input.commands().armWorldTool('paint');
		},
		onToggleFavourite: (key) => input.finishes().toggleFavouriteMaterial(key),
		onObject: (id) => input.commands().pickWorldObject(id),
		onArtwork(entry) {
			closeLibrary();
			input.commands().selectTool();
			input.armArtwork(entry);
		},
		onArtworkImport(files) {
			closeLibrary();
			input.commands().selectTool();
			void input.importArtwork(files);
		},
		onMaterialImport(files, invoker) {
			closeLibrary();
			void input.importMaterial(files, invoker);
		},
		onLook(id) {
			closeLibrary();
			input.pickLook(id);
		},
	};
	const view: LibraryView = {
		get open() {
			return shell.libraryOpen;
		},
		get previewing() {
			return input.previewing();
		},
		get lens() {
			return input.lens();
		},
		get available() {
			return input.available();
		},
		get nonce() {
			return shell.libraryInvocation.nonce;
		},
		props,
	};
	return {
		view,
		ports: {
			open: () => shell.libraryOpen,
			invocation: () => shell.libraryInvocation,
			close: closeLibrary,
			tileSource: libraryTileSource,
		},
		escape: {
			libraryOpen: () => shell.libraryOpen,
			toggleLibrary: () => closeLibrary(),
		},
	};
}
