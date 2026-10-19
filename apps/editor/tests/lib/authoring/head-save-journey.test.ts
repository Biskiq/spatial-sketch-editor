// @vitest-environment jsdom
/**
 * T2.P01.S04 final gate — the Save creator journey through the mounted Head.
 *
 * The plan requires the persistence row proven as a creator experiences it, not
 * only as the state machine's own unit tests describe it:
 *
 * 1. **dirty versus saved by full captured source** — an accepted edit is what
 *    makes the project dirty, and the mounted Head says so;
 * 2. **an in-flight older Save never marks newer edits saved** — the
 *    acknowledgement describes its capture, so an edit made while it was in
 *    flight stays unsaved;
 * 3. **a conflict preserves local work until Reload** — the Head offers the
 *    remote copy as an explicit replacement, installs nothing itself, and the
 *    local source is unchanged until the host guard runs.
 *
 * This mounts the real `EditorHead` over T3.P01.S02's state machine, the real
 * F.4 acceptance host and the production Scene adapter. Only the transport and
 * the remote read port are doubles; no host, Save state or protocol is stubbed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import {
	createEmptyWallFirstProject,
	type ProjectDocument,
	type SceneEntity,
	type Vec3
} from '@portfolio/project-model';
import type { SaveAcknowledgement, SaveRequest } from '@portfolio/project-model/save';
import { planWallChain } from '@portfolio/layout-core';

import { sceneSurfaceFor } from '$lib/authoring/adapters/scene/placement';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageFacade, type StageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { admitSource } from '$lib/authoring/stage/source-admission';
import {
	createHeadSave,
	createSaveState,
	type HeadSave,
	type ReloadOffer,
	type SaveState,
	type SaveTransportResult
} from '$lib/authoring/save';
import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';

const PROJECT_ID = 'project-head-journey';
const ENTITY_ID = 'entity-head-journey-box';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const SAVED_TOKEN = 'saved-base:00000000-0000-4000-8000-000000000001';
const NEXT_TOKEN = 'saved-base:00000000-0000-4000-8000-000000000002';

function boxEntity(position: Vec3 = [2, 0.5, 2]): SceneEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id: ENTITY_ID,
		name: 'Journey block',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0]
	};
}

function project(position: Vec3 = [2, 0.5, 2]): ProjectDocument {
	const base = createEmptyWallFirstProject({ id: PROJECT_ID, name: 'Head journey' });
	const planned = planWallChain({
		baseline: base.layout,
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		role: 'boundary'
	});
	if (planned.kind !== 'success') throw new Error('the wall fixture was refused');
	return { ...base, layout: planned.document, scene: { ...base.scene, entities: [boxEntity(position)] } };
}

async function eventually(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('the head journey did not settle');
}

type PendingSave = {
	readonly request: SaveRequest;
	readonly resolve: (result: SaveTransportResult) => void;
};

type Mounted = {
	readonly facade: StageFacade;
	readonly host: ReturnType<typeof createStageAcceptanceHost>;
	readonly state: SaveState;
	readonly head: HeadSave;
	readonly pending: PendingSave[];
	readonly target: HTMLElement;
};

const cleanups: Array<() => void> = [];

afterEach(() => {
	while (cleanups.length > 0) cleanups.pop()!();
	document.body.innerHTML = '';
});

function acknowledgementOf(request: SaveRequest, token: string): SaveAcknowledgement {
	return {
		projectId: request.capture.projectId,
		name: 'Head journey',
		version: 1,
		updatedAt: '2026-10-19T00:00:00.000Z',
		savedBaseToken: token,
		savedRevision: request.capture.acceptedRevision,
		sourceContentId: request.capture.sourceContentId
	};
}

async function mountHead(
	onReloadRemote: (offer: ReloadOffer) => void = () => {}
): Promise<Mounted> {
	const document_ = project();
	const admitted = await admitSource(document_, {
		sessionEpoch: 'session-head-journey',
		acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-boot' }
	});
	if (admitted.kind !== 'admitted') throw new Error('the head journey fixture was not admitted');
	const stageSession = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
	stageSession.replace(admitted.snapshot);
	const facade = createStageFacade({ snapshot: admitted.snapshot, session: stageSession });
	const evaluated = facade.camera.evaluate(RECT, 1);
	if (evaluated.kind !== 'evaluated') throw new Error('the head journey fixture did not evaluate');
	facade.acquireInspection('exclusive');
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: admitted.snapshot.sessionEpoch,
		baseline: {
			revision: admitted.snapshot.acceptedRevision,
			source: document_,
			canonicalJson: admitted.snapshot.canonicalJson,
			sourceContentId: admitted.snapshot.sourceContentId
		},
		planners: []
	});
	mountStageAdapter(facade, host, createAdapter);

	const pending: PendingSave[] = [];
	const state = createSaveState({
		coordinator: host.coordinator(),
		save: (request) =>
			new Promise<SaveTransportResult>((resolve) => pending.push({ request, resolve })),
		baseline: {
			savedBaseToken: SAVED_TOKEN,
			savedRevision: admitted.snapshot.acceptedRevision,
			savedCanonicalJson: admitted.snapshot.canonicalJson,
			savedSourceContentId: admitted.snapshot.sourceContentId
		},
		loadRemote: async (id) => ({
			projectId: id,
			document: document_,
			savedBaseToken: NEXT_TOKEN,
			savedRevision: { projectId: id, revisionId: 'revision-remote' },
			savedSourceContentId: admitted.snapshot.sourceContentId
		})
	});
	const head = createHeadSave(state);
	// The route's own accepted-install listener: a Save state never polls.
	cleanups.push(host.onChanged(() => head.refresh()));

	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(EditorHead, {
		target,
		props: {
			projectId: PROJECT_ID,
			projectName: 'Head journey',
			lens: 'world' as const,
			onLens: () => {},
			canDownloadSource: true,
			onDownloadSource: () => {},
			historyUnavailableReason: 'Nothing to undo yet.',
			saveUnavailableReason: 'No cloud client.',
			previewUnavailableReason: 'Visitor Preview arrives with T3.',
			reducedMotion: false,
			onToggleReducedMotion: () => {},
			save: head,
			onReloadRemote
		}
	});
	cleanups.push(() => unmount(component));
	await tick();
	return { facade, host, state, head, pending, target };
}

function statusOf(target: HTMLElement): string | null {
	return target.querySelector('[data-head-save]')?.getAttribute('data-save-status') ?? null;
}

function saveButton(target: HTMLElement): HTMLButtonElement {
	const button = target.querySelector('[data-head-save] button');
	if (button === null) throw new Error('the Head mounted no Save control');
	return button as HTMLButtonElement;
}

/** One accepted Resize through the real Compose surface and F.4 host. */
async function resizeTo(mounted: Mounted, scale: number, clockSeconds: number): Promise<void> {
	const evaluated = mounted.facade.camera.evaluate(RECT, clockSeconds);
	if (evaluated.kind !== 'evaluated') throw new Error('the fixture did not re-evaluate');
	const opened = mounted.facade.openContributedTask('scene-compose', 'scene');
	if (opened.kind !== 'opened') throw new Error(`Compose was not opened: ${opened.message}`);
	const evaluation = mounted.facade.evaluation();
	if (evaluation === null) throw new Error('the fixture has no evaluation');
	const surface = sceneSurfaceFor(mounted.facade.snapshot(), evaluation);
	if (surface === null) throw new Error('Compose published no surface');
	surface.session.beginResize(ENTITY_ID);
	expect(surface.session.previewResize(scale).kind).toBe('candidate');
	await expect(surface.session.commitResize()).resolves.toEqual({ kind: 'committed' });
	await eventually(() => {
		const entity = mounted.facade
			.snapshot()
			.domain.scene.entities.find((candidate) => candidate.id === ENTITY_ID);
		return entity?.scale === scale;
	});
	await tick();
}

describe('T2.P01.S04 — Save creator journey through the mounted Head', () => {
	it('reports dirty by full captured source after an accepted edit', async () => {
		const mounted = await mountHead();
		expect(statusOf(mounted.target)).toBe('saved');
		expect(mounted.target.querySelector('[data-unsaved-work]')).toBeNull();

		await resizeTo(mounted, 2, 2);
		expect(statusOf(mounted.target)).toBe('dirty');
		expect(mounted.target.querySelector('[data-unsaved-work]')).not.toBeNull();
		expect(saveButton(mounted.target).textContent?.trim()).toBe('Save changes');
	});

	it('keeps newer edits unsaved when an in-flight older Save is acknowledged', async () => {
		const mounted = await mountHead();
		await resizeTo(mounted, 2, 2);
		const firstJson = mounted.facade.snapshot().canonicalJson;
		expect(statusOf(mounted.target)).toBe('dirty');

		saveButton(mounted.target).click();
		await eventually(() => mounted.pending.length === 1);
		await tick();
		expect(statusOf(mounted.target)).toBe('saving');
		// The Save captured the 2x source; this edit makes the local source newer
		// while that request is still in flight.
		const captured = mounted.pending[0]!.request;
		expect(captured.capture.canonicalJson).toBe(firstJson);
		await resizeTo(mounted, 3, 3);

		mounted.pending[0]!.resolve({
			kind: 'saved',
			acknowledgement: acknowledgementOf(captured, NEXT_TOKEN)
		});
		await eventually(() => statusOf(mounted.target) === 'dirty');
		expect(mounted.state.getSnapshot()).toMatchObject({
			dirty: true,
			savedSourceContentId: captured.capture.sourceContentId
		});
		expect(mounted.facade.snapshot().canonicalJson).not.toBe(captured.capture.canonicalJson);
		expect(mounted.target.querySelector('[data-unsaved-work]')).not.toBeNull();
		expect(saveButton(mounted.target).textContent?.trim()).toBe('Save changes');
	});

	it('holds a conflict as local work until the host reloads the remote copy', async () => {
		const onReloadRemote = vi.fn<(offer: ReloadOffer) => void>();
		const mounted = await mountHead(onReloadRemote);
		await resizeTo(mounted, 2, 2);
		const localJson = mounted.facade.snapshot().canonicalJson;

		saveButton(mounted.target).click();
		await eventually(() => mounted.pending.length === 1);
		mounted.pending[0]!.resolve({ kind: 'conflict' });
		await eventually(() => statusOf(mounted.target) === 'conflict');

		expect(mounted.target.querySelector('[data-unsaved-work]')).not.toBeNull();
		const reload = [...mounted.target.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Reload remote')
		);
		expect(reload).toBeDefined();
		// Nothing has been installed: the conflict is an offer, and the local source
		// (the edit made before the Save) is intact.
		expect(mounted.facade.snapshot().canonicalJson).toBe(localJson);
		expect(mounted.state.getSnapshot().conflict?.localJson).toBe(localJson);

		reload!.click();
		expect(onReloadRemote).toHaveBeenCalledTimes(1);
		const offer = onReloadRemote.mock.calls[0]![0];
		expect(offer.kind).toBe('reload');
		expect(mounted.facade.snapshot().canonicalJson).toBe(localJson);
	});

	it('cancels an open Resize preview when the route replaces the source', async () => {
		const mounted = await mountHead();
		const evaluated = mounted.facade.camera.evaluate(RECT, 2);
		if (evaluated.kind !== 'evaluated') throw new Error('the fixture did not re-evaluate');
		const opened = mounted.facade.openContributedTask('scene-compose', 'scene');
		expect(opened.kind).toBe('opened');
		const evaluation = mounted.facade.evaluation()!;
		const surface = sceneSurfaceFor(mounted.facade.snapshot(), evaluation);
		if (surface === null) throw new Error('Compose published no surface');
		surface.session.beginResize(ENTITY_ID);
		expect(surface.session.previewResize(2).kind).toBe('candidate');
		const before = mounted.facade.snapshot().canonicalJson;

		// The route's own replacement path: admit the new source, then swap the
		// session under the open proposal before the new facade is installed.
		const admitted = await admitSource(project([4, 0.5, 4]), {
			sessionEpoch: 'session-head-journey-replacement',
			acceptedRevision: { projectId: PROJECT_ID, revisionId: 'revision-replaced' }
		});
		if (admitted.kind !== 'admitted') throw new Error('the replacement was not admitted');
		mounted.facade.session.replace(admitted.snapshot);

		// The replacement closed the task and released its gesture, and nothing was
		// committed: the accepted source is still the pre-replacement bytes and the
		// history never advanced past its baseline.
		expect(mounted.facade.session.task()).toBeNull();
		expect(mounted.facade.snapshot().canonicalJson).toBe(before);
		expect(mounted.host.history()).toMatchObject({ depth: 1, position: 0 });
		// The replaced session now owns the new source; presenting its surface cannot
		// revive the proposal the previous lifetime opened.
		expect(mounted.facade.session.current()).toBe(admitted.snapshot);
		// The proposal's lease went with the lifetime it was opened in; presenting
		// Compose again would be a new surface with no candidate.
		expect(mounted.facade.session.gesture()).toBeNull();
	});
});
