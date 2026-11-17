/**
 * T2.S4b — the *+ From image* upload state machine.
 *
 * The upload is outside the Scene and outside Undo: these tests pin the phases
 * the Library tile and Card show, that Cancel writes nothing, and that Try again
 * retries the same file (the importer re-lists, so a completed upload is reused).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/authoring/artwork/project-artwork', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/authoring/artwork/project-artwork')>();
	return { ...actual, importProjectImage: vi.fn() };
});

import { importProjectImage, type ImportedProjectImage } from '$lib/authoring/artwork/project-artwork';
import { createFinishImageFlow, type FinishImageApply } from '$lib/authoring/look/finish-image.svelte';
import type { ProjectApi } from '$lib/platform/project-persistence';

const IMAGE: ImportedProjectImage = {
	assetId: '00000000-0000-4000-8000-0000000000aa',
	name: 'Brick wall.png',
	pixelWidth: 1024,
	pixelHeight: 128,
	mime: 'image/png',
	byteSize: 2048,
	sha256: `sha256-${'a'.repeat(64)}`
};
const FILE = new File([new Uint8Array([1])], 'Brick wall.png', { type: 'image/png' });

function harness(overrides: { canEdit?: boolean; isSaved?: boolean; api?: boolean } = {}) {
	const apply = vi.fn<FinishImageApply>(async () => ({ kind: 'accepted' as const }));
	const onNotice = vi.fn();
	const flow = createFinishImageFlow({
		api: () => (overrides.api === false ? null : ({} as ProjectApi)),
		projectId: () => (overrides.api === false ? null : 'project'),
		canEdit: () => overrides.canEdit ?? true,
		isSaved: () => overrides.isSaved ?? true,
		onNotice
	});
	return { flow, apply, onNotice };
}

beforeEach(() => {
	vi.mocked(importProjectImage).mockReset();
});

describe('Finish image flow', () => {
	it('runs checking → uploading → done and hands the Scene write the warning and label', async () => {
		vi.mocked(importProjectImage).mockImplementation(async (_api, _project, _file, _signal, _policy, hooks) => {
			hooks?.onPhase?.('uploading');
			return IMAGE;
		});
		const { flow, apply } = harness();
		await flow.begin(FILE, apply);
		expect(flow.state).toMatchObject({
			phase: 'done',
			fileName: 'Brick wall.png',
			message: null,
			warning: 'Low resolution (1024 × 128 px): it may look blurry or visibly tiled.'
		});
		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith(IMAGE, expect.stringContaining('Low resolution'), 'Brick wall');
	});

	it('refuses a wrong type and an unsaved project before any bytes leave the browser', async () => {
		const { flow, apply } = harness();
		await flow.begin(new File([], 'notes.txt', { type: 'text/plain' }), apply);
		expect(flow.state).toMatchObject({ phase: 'refused', fileName: 'notes.txt' });
		expect(importProjectImage).not.toHaveBeenCalled();

		const unsaved = harness({ isSaved: false });
		await unsaved.flow.begin(FILE, unsaved.apply);
		expect(unsaved.flow.state).toMatchObject({ phase: 'refused', fileName: 'Brick wall.png' });
		expect(importProjectImage).not.toHaveBeenCalled();
		expect(apply).not.toHaveBeenCalled();
	});

	it('Cancel aborts and writes no Scene state', async () => {
		let finish!: (image: ImportedProjectImage) => void;
		vi.mocked(importProjectImage).mockReturnValue(new Promise((resolve) => (finish = resolve)));
		const { flow, apply } = harness();
		const running = flow.begin(FILE, apply);
		await Promise.resolve();
		expect(flow.busy).toBe(true);
		flow.cancel();
		finish(IMAGE);
		await running;
		expect(flow.state.phase).toBe('idle');
		expect(apply).not.toHaveBeenCalled();
	});

	it('keeps the file on failure and retries it after a lost response', async () => {
		vi.mocked(importProjectImage).mockRejectedValueOnce(new Error('The connection dropped.'));
		const { flow, apply } = harness();
		await flow.begin(FILE, apply);
		expect(flow.state).toMatchObject({
			phase: 'failed',
			fileName: 'Brick wall.png',
			message: 'The connection dropped.'
		});
		expect(flow.canRetry).toBe(true);

		vi.mocked(importProjectImage).mockResolvedValueOnce(IMAGE);
		await flow.retry();
		expect(flow.state.phase).toBe('done');
		expect(apply).toHaveBeenCalledTimes(1);
		expect(vi.mocked(importProjectImage)).toHaveBeenCalledTimes(2);
		expect(vi.mocked(importProjectImage).mock.calls[1]![2]).toBe(FILE);
	});

	it('surfaces a Scene refusal as a retryable failure without discarding the asset', async () => {
		vi.mocked(importProjectImage).mockResolvedValue(IMAGE);
		const apply = vi.fn<FinishImageApply>(async () => ({
			kind: 'refused' as const,
			message: 'That Finish is now used by 2 objects.'
		}));
		const { flow } = harness();
		await flow.begin(FILE, apply);
		expect(flow.state).toMatchObject({
			phase: 'failed',
			message: 'That Finish is now used by 2 objects.',
			warning: expect.stringContaining('Low resolution')
		});
		expect(flow.canRetry).toBe(true);

		// Retrying reuses the same bytes rather than choosing a new file.
		await flow.retry();
		expect(apply).toHaveBeenCalledTimes(2);
		expect(vi.mocked(importProjectImage).mock.calls[1]![2]).toBe(FILE);
	});

	it('does not cancel a Scene write that has already started', async () => {
		vi.mocked(importProjectImage).mockResolvedValue(IMAGE);
		let finish!: (outcome: { kind: 'accepted' }) => void;
		const apply = vi.fn<FinishImageApply>(() => new Promise((resolve) => (finish = resolve)));
		const { flow } = harness();
		const running = flow.begin(FILE, apply);
		await vi.waitFor(() => expect(flow.state.phase).toBe('saving'));
		flow.cancel();
		expect(flow.state.phase).toBe('saving');
		finish({ kind: 'accepted' });
		await running;
		expect(flow.state.phase).toBe('done');
	});

	it('a no-op apply returns the tile to idle', async () => {
		vi.mocked(importProjectImage).mockResolvedValue(IMAGE);
		const { flow } = harness();
		await flow.begin(FILE, async () => ({ kind: 'no-op' }));
		expect(flow.state.phase).toBe('idle');
	});
});
