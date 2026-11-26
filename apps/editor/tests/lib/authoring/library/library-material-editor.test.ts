// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import LibraryMaterialEditor from '$lib/authoring/library/LibraryMaterialEditor.svelte';
import type { MaterialId } from '$lib/types/materials';
import { mountWithProps, settle } from '../../../kit/dom';
import { buildFinishEditorFields } from '$lib/authoring/look/finish-editor.svelte';
import { materialTreatmentFacts } from '$lib/content/material-presentation';
import { getMaterial, materialById } from '$lib/content/materials';

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const unmount of cleanups.splice(0)) unmount();
});

const editorFacts = materialTreatmentFacts((id: MaterialId) => (materialById.has(id) ? getMaterial(id).label : id));

describe('Material Editor draft actions', () => {
	function editor(status: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
		const callbacks = {
			onCommit: vi.fn(),
			onResetAll: vi.fn(),
			onApplyDraft: vi.fn(async () => true),
			onPaintDraft: vi.fn(),
			onCancelDraft: vi.fn(),
			onCompare: vi.fn()
		};
		const source = { base: { catalogue: 'wood-oak-veneer' as const } };
		const fields = buildFinishEditorFields({
			source,
			recipes: new Map(),
			palette: [],
			entityKind: null,
			facts: editorFacts,
			materialLabel: 'Oak Veneer',
			curated: false
		});
		const { target: host, unmount } = mountWithProps(LibraryMaterialEditor, {
			mode: 'draft',
			name: 'Lobby oak',
			baseLabel: getMaterial('wood-oak-veneer').label,
			finishKey: 'project:lobby',
			tileSource: null,
			originalSource: null,
			fields,
			source,
			recipes: new Map(),
			palette: [],
			facts: editorFacts,
			draftStatus: { canApply: true, changed: false, targetLabel: 'Chair', reason: null, canPaint: true, paintReason: null, ...status },
			previewing: false,
			...extra,
			...callbacks
		});
		cleanups.push(unmount);
		const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
		return { host, q, ...callbacks };
	}

	it('focuses close, exposes active controls, applies once and keeps Save unavailable', async () => {
		const fx = editor();
		expect(document.activeElement).toBe(fx.q('[data-material-editor-close]'));
		expect(fx.q('[data-material-editor-target]')?.textContent).toMatch(/Chair/);
		expect(fx.q<HTMLButtonElement>('[data-material-editor-save]')?.disabled).toBe(true);
		fx.q<HTMLButtonElement>('[data-material-editor-colour-mode="stained"]')?.click();
		expect(fx.onCommit).toHaveBeenCalledWith('colour', expect.any(Array));
		fx.q<HTMLButtonElement>('[data-material-editor-apply]')?.click();
		await settle();
		expect(fx.onApplyDraft).toHaveBeenCalledTimes(1);
		fx.q<HTMLButtonElement>('[data-material-editor-paint]')?.click();
		expect(fx.onPaintDraft).toHaveBeenCalledTimes(1);
	});

	it('Compare toggles when both original and live sources are available, and disables otherwise', () => {
		const original = { kind: 'catalogue', id: 'wood-oak-veneer' } as const;
		const drafted = { kind: 'catalogue', id: 'metal-brushed-steel' } as const;
		const fx = editor({ changed: true }, { tileSource: drafted, originalSource: original });
		const compare = fx.q<HTMLButtonElement>('[data-material-editor-compare]');
		expect(compare?.disabled).toBe(false);
		compare?.click();
		expect(fx.onCompare).toHaveBeenCalledWith(true);

		const noOrig = editor({ changed: true }, { tileSource: drafted, originalSource: null });
		expect(noOrig.q<HTMLButtonElement>('[data-material-editor-compare]')?.disabled).toBe(true);
	});

	it('shows a refusal in place, disables Apply, and cancels on Escape', () => {
		const fx = editor({ canApply: false, reason: 'Pick a surface.', canPaint: false });
		expect(fx.q<HTMLButtonElement>('[data-material-editor-apply]')?.disabled).toBe(true);
		expect(fx.q<HTMLButtonElement>('[data-material-editor-paint]')?.disabled).toBe(true);
		expect(fx.q('[data-material-editor-reason]')?.textContent).toMatch(/Pick a surface/);
		fx.q('[data-material-editor]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(fx.onCancelDraft).toHaveBeenCalledTimes(1);
	});
});
