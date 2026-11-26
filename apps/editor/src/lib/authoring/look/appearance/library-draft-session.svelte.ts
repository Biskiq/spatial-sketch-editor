import { tick, untrack } from 'svelte';
import { getMaterial, materialById } from '$lib/content/materials';
import { materialTreatmentFacts } from '$lib/content/material-presentation';
import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
import type { MaterialId } from '$lib/types/materials';
import type { LibraryFinishEntry } from '../../library/library-catalogue';
import type { StageReadSnapshot } from '../../stage/accepted-read';
import type { StageShellState } from '../../stage/route/stage-shell-state.svelte';
import type { StageSelectionEntry } from '../../stage/semantic-selection';
import type { MaterialEditorProps } from '../appearance-view';
import type { FinishAuthoring } from '../finish-authoring.svelte';

type TextureScope = NonNullable<Extract<FinishTileSource, { kind: 'finish' }>['subject']>['scope'];

export function createLibraryDraftSession(input: {
	readonly snapshot: () => StageReadSnapshot | null;
	readonly textureScope: () => TextureScope;
	readonly finishes: () => FinishAuthoring;
	readonly selection: () => StageSelectionEntry | null;
	readonly shell: StageShellState;
	readonly canShowEditor: () => boolean;
	readonly entries: () => readonly LibraryFinishEntry[];
	readonly tileSource: (entry: LibraryFinishEntry) => FinishTileSource | null;
	readonly armWorldTool: (tool: 'select' | 'paint') => void;
}) {
	const { shell } = input;
	/** One project Finish's picture source: the accepted Scene, read at its content id, through the project's texture scope. */
	function finishTileSource(finishId: string): FinishTileSource | null {
		const snapshot = input.snapshot();
		if (snapshot === null) return null;
		return {
			kind: 'finish',
			subject: {
				kind: 'finish',
				document: snapshot.domain.scene,
				finishId,
				revision: snapshot.sourceContentId,
				scope: input.textureScope(),
			},
		};
	}
	const finishShelf = $derived.by(() => {
		void shell.contributionsVersion;
		return input.finishes().libraryShelf();
	});
	const editorTreatmentFacts = materialTreatmentFacts((id) =>
		materialById.has(id) ? getMaterial(id).label : id,
	);

	function baseSourceOfInstance(instance: {
		readonly base: { readonly catalogue: string } | { readonly material: string };
	}): FinishTileSource | null {
		if ('catalogue' in instance.base) {
			return {
				kind: 'catalogue',
				id: instance.base.catalogue as import('$lib/types/materials').MaterialId,
			};
		}
		const snapshot = input.snapshot();
		if (snapshot === null) return null;
		const scene = snapshot.domain.scene;
		const id = 'material-editor-base-inspection';
		return {
			kind: 'finish',
			subject: {
				kind: 'finish',
				document: {
					...scene,
					materials: [
						...scene.materials.filter((material) => material.id !== id),
						{ id, name: 'Original', base: instance.base },
					],
				},
				finishId: id,
				revision: `${snapshot.sourceContentId}#base:${instance.base.material}`,
				scope: input.textureScope(),
			},
		};
	}

	const finishEditorView = $derived.by(() => {
		void shell.contributionsVersion;
		void input.finishes().card.preview;
		return input.finishes().editor.view();
	});

	/** The draft's own render subject for Compare: the patched Finish in a draft-only document. */
	const libraryDraftRender = $derived.by(
		(): { source: FinishTileSource | null; reason: string | null } => {
			void shell.contributionsVersion;
			const drafted = input.finishes().libraryDraftInstance();
			if (drafted === null) return { source: null, reason: null };
			if (!drafted.ok) return { source: null, reason: drafted.reason };
			if (!drafted.changed) return { source: null, reason: null };
			const snapshot = input.snapshot();
			if (snapshot === null) {
				return { source: null, reason: 'The project is not loaded.' };
			}
			const scene = snapshot.domain.scene;
			const id = 'library-draft-inspection';
			const editsSig = JSON.stringify(input.finishes().libraryDraft?.edits ?? []);
			return {
				reason: null,
				source: {
					kind: 'finish',
					subject: {
						kind: 'finish',
						document: {
							...scene,
							materials: [
								...scene.materials.filter((material) => material.id !== id),
								{ ...drafted.instance, id },
							],
						},
						finishId: id,
						revision: `${snapshot.sourceContentId}#draft:${input.finishes().libraryDraft?.finishKey}:${editsSig}`,
						scope: input.textureScope(),
					},
				},
			};
		},
	);
	const libraryDraftPreview = $derived.by(() => {
		void input.finishes().libraryDraft;
		void shell.contributionsVersion;
		return input.finishes().libraryDraftPreview();
	});
	const libraryDraftStatus = $derived.by(() => {
		input.selection();
		void shell.contributionsVersion;
		return input.finishes().libraryDraftStatus();
	});

	function attachGuards(): void {
		/**
		 * The Customise… draft lives in the Material editor while Paint is armed for
		 * its Stage retarget; putting Paint down discards it. Only Apply writes.
		 */
		$effect(() => {
			if (input.finishes().libraryDraft !== null && shell.armedHostTool !== 'paint')
				input.finishes().cancelLibraryDraft();
		});
		$effect(() => {
			if (!shell.libraryOpen && input.finishes().librarySwap !== null)
				untrack(() => input.finishes().clearLibrarySwap());
		});
	}

	function focusLibrary(): void {
		void tick().then(() =>
			document.querySelector<HTMLElement>('[data-world-library-key]')?.focus(),
		);
	}

	/** Leave the draft editor: discard the draft and hand focus back to the Library key. */
	function endLibraryDraft(): void {
		input.finishes().cancelLibraryDraft();
		input.armWorldTool('select');
		focusLibrary();
	}

	function dismissMaterialEditor(): boolean {
		if (input.finishes().editor.open) {
			input.finishes().editor.close(true);
			return true;
		}
		if (input.finishes().libraryDraft !== null) {
			endLibraryDraft();
			return true;
		}
		return false;
	}

	function editorControls(): Pick<
		MaterialEditorProps,
		| 'facts'
		| 'inspection'
		| 'onInspection'
		| 'display'
		| 'onDisplay'
		| 'lightTurnRadians'
		| 'onTurnLight'
		| 'compare'
		| 'onCompare'
	> {
		const { editor } = input.finishes();
		return {
			facts: editorTreatmentFacts,
			inspection: shell.libraryInspection,
			onInspection: shell.setLibraryInspection,
			display: editor.display,
			onDisplay: editor.setDisplay,
			lightTurnRadians: editor.lightTurnRadians,
			onTurnLight: editor.turnLight,
			compare: editor.compare,
			onCompare: editor.setCompare,
		};
	}

	function readDraft(): MaterialEditorProps | null {
		const finishes = input.finishes();
		const draft = finishes.libraryDraft;
		if (draft === null || !input.canShowEditor()) return null;
		const entry = input.entries().find((entry) => entry.key === draft.finishKey) ?? null;
		const instance = finishes.libraryDraftInstance();
		const fields = finishes.libraryDraftFields();
		const scene = input.snapshot()?.domain.scene;
		if (fields === null || instance === null || !instance.ok || scene === undefined) return null;
		const original = entry === null ? null : input.tileSource(entry);
		return {
			...editorControls(),
			mode: 'draft',
			name: draft.name,
			baseLabel: draft.baseLabel,
			finishKey: draft.finishKey,
			color: entry?.color ?? '#999999',
			imageUri: entry?.imageUri ?? null,
			tileSource: libraryDraftRender.source ?? original,
			originalSource: original,
			fields,
			source: { base: instance.instance.base, overrides: instance.instance.overrides },
			recipes: scene.materialIndex?.definitions ?? new Map(),
			palette: scene.palette ?? [],
			draftStatus: libraryDraftStatus,
			previewing: libraryDraftPreview !== null,
			busy: finishes.busy,
			onCommit: (_field, edits) => finishes.patchLibraryDraft(edits),
			onResetAll: finishes.resetLibraryDraftStep,
			async onApplyDraft() {
				const accepted = await finishes.applyLibraryDraft();
				if (accepted) {
					input.armWorldTool('select');
					focusLibrary();
				}
				return accepted;
			},
			onPaintDraft: finishes.paintLibraryDraft,
			onCancelDraft: endLibraryDraft,
		};
	}

	function readFinish(): MaterialEditorProps | null {
		const finishes = input.finishes();
		if (!finishes.editor.open) return null;
		const view = finishEditorView;
		if (view === null || !input.canShowEditor()) return null;
		const scene = input.snapshot()?.domain.scene;
		if (scene === undefined) return null;
		const live =
			view.curated && 'catalogue' in view.instance.base
				? { kind: 'catalogue' as const, id: view.instance.base.catalogue as MaterialId }
				: finishTileSource(view.instance.id);
		return {
			...editorControls(),
			mode: 'finish',
			name: view.name,
			baseLabel: view.fields.raw.label,
			canRename: view.canRename,
			onRename: (name) => finishes.card.rename(view.target, name),
			finishKey: view.finishKey,
			tileSource: live,
			originalSource: baseSourceOfInstance(view.instance),
			fields: view.fields,
			source: { base: view.instance.base, overrides: view.instance.overrides },
			recipes: scene.materialIndex?.definitions ?? new Map(),
			palette: scene.palette ?? [],
			fieldRefusal: finishes.editor.fieldRefusal,
			usersCount: view.usersCount,
			reach: view.reach,
			place: view.place,
			onToggleReach: finishes.editor.toggleReach,
			align: view.align,
			onAlign() {
				const res = finishes.requestAlign(view.target, view.place);
				if (!res.ok && res.message) finishes.editor.setFieldRefusal('pattern', res.message);
			},
			onMaterialPreview: (edits) => finishes.editor.preview(() => edits),
			onCancelPreview: finishes.editor.cancelPreview,
			onCommit: (field, edits) => finishes.editor.commit(field, () => edits),
			onResetAll: finishes.editor.resetAll,
			onDone: () => finishes.editor.close(true),
		};
	}

	const materialEditor = $derived(
		input.finishes().libraryDraft !== null && input.canShowEditor() ? readDraft() : readFinish(),
	);
	attachGuards();
	return {
		endLibraryDraft,
		dismissMaterialEditor,
		finishTileSource,
		draftPreview: () => libraryDraftPreview,
		get shelf() {
			return finishShelf;
		},
		get materialEditor() {
			return materialEditor;
		},
	};
}
