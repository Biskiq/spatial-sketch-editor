/**
 * R217.S26 — planner contracts for structure and removal.
 *
 * Each operation goes through the one F.4 acceptance port: one accepted entry, one Undo
 * that restores ids and fields, strict refusals that install nothing. Removal follows E4:
 * nothing is replaced silently, and Camera truth is removed only when no other
 * Presentation lists it. The installed result always re-admits (Save and reload keep it,
 * and nothing is orphaned).
 */
import { describe, expect, it } from 'vitest';

import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	experienceUpdateIntent,
	guideCreateIntent,
	guideOrderIntent,
	guideUpdateIntent,
	presentationUpdateIntent,
	removeIntent,
	viewRemoveIntent,
	viewRenameIntent
} from '$lib/authoring/experience/commands';
import {
	EXPERIENCE_GUIDE_REMOVE_KIND,
	EXPERIENCE_GUIDE_UPDATE_KIND,
	EXPERIENCE_PRESENTATION_REMOVE_KIND,
	EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND,
	EXPERIENCE_STOP_REMOVE_KIND,
	EXPERIENCE_UPDATE_KIND,
	computeEnvelopeSourceContentId,
	createUnitAcceptanceProfile,
	planStopRemoval,
	serializeProjectEnvelope,
	validateProjectEnvelope,
	type Experience,
	type ExperienceUnitPayload,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { buildXFixture } from './__fixtures__/x-fixtures';
import { EXPERIENCE, experienceEnvelope } from './fixtures';

async function boot(source: ProjectEnvelope) {
	const profile = createUnitAcceptanceProfile({ compound: true, sessionEpoch: 'session-s26' });
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: profile.adapter,
		sessionEpoch: 'session-s26',
		baseline: {
			revision: source.acceptedRevision,
			source,
			canonicalJson: serializeProjectEnvelope(source),
			sourceContentId: await computeEnvelopeSourceContentId(source)
		},
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`,
		preparation: { registry: profile.registry, prepare: profile.prepare }
	});
	const now = () => coordinator.acceptedSnapshot().domain.source;
	return {
		coordinator,
		now,
		experience: (): Experience => now().units.experience.data.experiences[0]!,
		revision: () => coordinator.acceptedRevision(),
		depth: () => coordinator.history().depth
	};
}

async function salon() {
	const fixture = await buildXFixture('x-salon');
	return { ...fixture, ...(await boot(fixture.project)) };
}

/** Save and reload: the installed source re-admits with no unresolved reference. */
function reloads(project: ProjectEnvelope): void {
	const validation = validateProjectEnvelope(JSON.parse(serializeProjectEnvelope(project)));
	expect(validation.success).toBe(true);
	if (!validation.success) return;
	expect(validation.diagnostics.filter((entry) => entry.code.startsWith('unresolved'))).toEqual([]);
}

function refusedWith(outcome: { kind: string }, reason: string): void {
	expect(outcome).toMatchObject({ kind: 'rejected', code: 'planner-rejected', reason });
}

describe('experience-update', () => {
	it('renames the Experience in one entry and Undo restores it', async () => {
		const s = await salon();
		const depth = s.depth();
		const outcome = await s.coordinator.accept(
			experienceUpdateIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-rename' }, experienceId: 'x-experience', label: 'Evening salon' })
		);
		expect(outcome.kind).toBe('accepted');
		expect(outcome.kind === 'accepted' && outcome.undoResult).toMatchObject({ kind: 'undoable' });
		expect(s.experience().label).toBe('Evening salon');
		expect(s.depth()).toBe(depth + 1);
		await s.coordinator.undo();
		expect(s.experience().label).toBe('Salon evening');
	});

	it('chooses the Opening Guide and refuses a Guide the Experience does not carry, an empty name and an empty payload', async () => {
		const s = await salon();
		await s.coordinator.accept(
			guideCreateIntent({
				envelope: s.now(), revision: s.revision(), ids: { operation: 'op-g2', guide: 'short', stop: 'short-1' }, experienceId: 'x-experience',
				presentationId: 'x-window', label: 'Short tour', entryViewId: null, holdSeconds: null, continuation: null
			})
		);
		// E5: a later Guide is not the Opening Guide until chosen.
		expect(s.experience().entryGuideId).toBe('x-salon-guide');
		const chosen = await s.coordinator.accept(
			experienceUpdateIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-open' }, experienceId: 'x-experience', entryGuideId: 'short' })
		);
		expect(chosen.kind).toBe('accepted');
		expect(s.experience().entryGuideId).toBe('short');
		const depth = s.depth();
		refusedWith(
			await s.coordinator.accept(
				experienceUpdateIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-x' }, experienceId: 'x-experience', entryGuideId: 'nope' })
			),
			'missing-target'
		);
		refusedWith(
			await s.coordinator.accept(
				experienceUpdateIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-y' }, experienceId: 'x-experience', label: '   ' })
			),
			'invalid-payload'
		);
		refusedWith(
			await s.coordinator.accept(
				experienceUpdateIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-z' }, experienceId: 'x-experience' })
			),
			'invalid-payload'
		);
		expect(s.depth()).toBe(depth);
	});
});

describe('experience-guide-update', () => {
	it('renames a Guide and moves its start without touching its order (E6)', async () => {
		const s = await salon();
		const stops = s.ids.stopIds;
		const renamed = await s.coordinator.accept(
			guideUpdateIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-g' }, experienceId: 'x-experience', guideId: 'x-salon-guide', label: 'Evening tour' })
		);
		expect(renamed.kind).toBe('accepted');
		const started = await s.coordinator.accept(
			guideUpdateIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-s' }, experienceId: 'x-experience', guideId: 'x-salon-guide', entryStopId: stops[2]! })
		);
		expect(started.kind).toBe('accepted');
		expect(s.experience().guides[0]).toMatchObject({ label: 'Evening tour', entryStopId: stops[2], stopIds: stops });
		// Reordering never moves the start: drag Stop 3 to the end.
		const reordered = [...stops.filter((id) => id !== stops[2]), stops[2]!];
		await s.coordinator.accept(
			guideOrderIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-o' }, experienceId: 'x-experience', guideId: 'x-salon-guide', stopIds: reordered })
		);
		expect(s.experience().guides[0]!.entryStopId).toBe(stops[2]);
	});

	it('refuses a start Stop the Guide does not order', async () => {
		const s = await salon();
		const intent = guideUpdateIntent({
			envelope: s.now(), revision: s.revision(), ids: { operation: 'op-bad' }, experienceId: 'x-experience', guideId: 'x-salon-guide', entryStopId: 'stop-elsewhere'
		});
		expect(intent.kind).toBe(EXPERIENCE_GUIDE_UPDATE_KIND);
		refusedWith(await s.coordinator.accept(intent), 'invalid-payload');
	});
});

describe('View order and View rename', () => {
	it('reorders a Presentation’s Views as a permutation and never changes the Default', async () => {
		const s = await salon();
		const before = s.experience().presentations.find((entry) => entry.id === 'x-piano')!;
		const outcome = await s.coordinator.accept(
			presentationUpdateIntent({
				envelope: s.now(), revision: s.revision(), ids: { operation: 'op-v' }, experienceId: 'x-experience', presentationId: 'x-piano',
				views: [{ viewId: ...before.viewIds }].reverse()
			})
		);
		expect(outcome.kind).toBe('accepted');
		const after = s.experience().presentations.find((entry) => entry.id === 'x-piano')!;
		expect(after.viewIds).toEqual([...before.viewIds].reverse());
		expect(after.defaultViewId).toBe(before.defaultViewId);
	});

	it('refuses an order that inserts, drops or repeats a View, and an order beside a capture', async () => {
		const s = await salon();
		const depth = s.depth();
		for (const viewIds of [['x-piano-view-1'], ['x-piano-view-1', 'x-piano-view-1'], ['x-piano-view-1', 'x-window-view-1']]) {
			refusedWith(
				await s.coordinator.accept(
					presentationUpdateIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: `op-${viewIds.join()}` }, experienceId: 'x-experience', presentationId: 'x-piano', viewIds })
				),
				'invalid-order'
			);
		}
		refusedWith(
			await s.coordinator.accept(
				presentationUpdateIntent({
					envelope: s.now(), revision: s.revision(), ids: { operation: 'op-both', view: 'v-new' }, experienceId: 'x-experience', presentationId: 'x-piano',
					views: [{ viewId: 'x-piano-view-2' }, { viewId: 'x-piano-view-1' }], view: { label: 'New', eye: [1, 1.65, 1], target: [2, 1.25, 2], fov: 54 }
				})
			),
			'invalid-payload'
		);
		expect(s.depth()).toBe(depth);
	});

	it('renames a View through camera-view-update with its pose unchanged', async () => {
		const s = await salon();
		const view = s.now().units.camera.data.views.find((entry) => entry.id === s.ids.sharedViewId)!;
		const outcome = await s.coordinator.accept(
			viewRenameIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-vr' }, view, label: 'Doorway, far' })
		);
		expect(outcome.kind).toBe('accepted');
		expect(s.now().units.camera.data.views.find((entry) => entry.id === view.id)).toEqual({ ...view, label: 'Doorway, far' });
	});
});

describe('experience-stop-remove (E4)', () => {
	it('removes a Stop from the Guide in one entry; Undo restores it with its id and fields', async () => {
		const s = await salon();
		const target = s.ids.stopIds[1]!;
		const before = s.experience();
		const intent = removeIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-rm' }, experienceId: 'x-experience', subject: 'stop', id: target });
		expect(intent.kind).toBe(EXPERIENCE_STOP_REMOVE_KIND);
		expect((await s.coordinator.accept(intent)).kind).toBe('accepted');
		expect(s.experience().stops.some((stop) => stop.id === target)).toBe(false);
		expect(s.experience().guides[0]!.stopIds).toEqual(s.ids.stopIds.filter((id) => id !== target));
		// The Presentation stays.
		expect(s.experience().presentations.map((entry) => entry.id)).toEqual(before.presentations.map((entry) => entry.id));
		reloads(s.now());
		await s.coordinator.undo();
		expect(s.experience()).toEqual(before);
		await s.coordinator.redo();
		expect(s.experience().stops.some((stop) => stop.id === target)).toBe(false);
	});

	it('falls a continuation that targeted the removed Stop back to the Guide order, keeping its Cut/Travel', async () => {
		const s = await salon();
		const [first, , , , fifth] = s.ids.stopIds;
		const plan = planStopRemoval(s.experience(), fifth!);
		expect(plan.kind === 'planned' && plan.consequences).toContainEqual({ kind: 'continuation-fallback', stopId: first, removedStopId: fifth });
		await s.coordinator.accept(removeIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-rm5' }, experienceId: 'x-experience', subject: 'stop', id: fifth! }));
		expect(s.experience().stops.find((stop) => stop.id === first)!.continuation).toEqual({ kind: 'sequence-next', transition: 'cut' });
	});

	it('moves the start to the following Stop, or the preceding one when the start was last', async () => {
		const s = await salon();
		const stops = s.ids.stopIds;
		await s.coordinator.accept(removeIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-first' }, experienceId: 'x-experience', subject: 'stop', id: stops[0]! }));
		expect(s.experience().guides[0]!.entryStopId).toBe(stops[1]);
		await s.coordinator.accept(
			guideUpdateIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-last' }, experienceId: 'x-experience', guideId: 'x-salon-guide', entryStopId: stops[5]! })
		);
		await s.coordinator.accept(removeIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-rm-last' }, experienceId: 'x-experience', subject: 'stop', id: stops[5]! }));
		expect(s.experience().guides[0]!.entryStopId).toBe(stops[4]);
	});

	it('refuses the only Stop of a Guide and a Stop a Detour uses, installing nothing', async () => {
		const single = await boot(
			await experienceEnvelope({
				experience: {
					...EXPERIENCE,
					experiences: [{ ...EXPERIENCE.experiences[0]!, guides: [{ id: 'guide-1', label: 'Main', stopIds: ['stop-1'], entryStopId: 'stop-1', pacing: 'automatic' as const }] }]
				}
			})
		);
		refusedWith(
			await single.coordinator.accept(removeIntent({ envelope: single.now(), revision: single.revision(), ids: { operation: 'op-only' }, experienceId: 'experience-1', subject: 'stop', id: 'stop-1' })),
			'guide-keeps-a-stop'
		);
		const detoured = await boot(
			await experienceEnvelope({
				experience: {
					...EXPERIENCE,
					experiences: [{ ...EXPERIENCE.experiences[0]!, detours: [{ id: 'detour-1', fromStopId: 'stop-1', toStopId: 'stop-2', returnToStopId: 'stop-1' }] }]
				}
			})
		);
		refusedWith(
			await detoured.coordinator.accept(removeIntent({ envelope: detoured.now(), revision: detoured.revision(), ids: { operation: 'op-det' }, experienceId: 'experience-1', subject: 'stop', id: 'stop-2' })),
			'detour-uses-stop'
		);
		expect(single.depth()).toBe(1);
		expect(detoured.depth()).toBe(1);
	});
});

/** presentation-1 lists [view-1, view-2] (Default view-2), presentation-2 lists [view-2]; stop-1 enters at view-1. */
const SHARED: ExperienceUnitPayload = {
	...EXPERIENCE,
	experiences: [
		{
			...EXPERIENCE.experiences[0]!,
			presentations: [
				{ ...EXPERIENCE.experiences[0]!.presentations[0]!, views: [{ viewId: 'view-1' }, { viewId: 'view-2' }]},
				EXPERIENCE.experiences[0]!.presentations[1]!
			],
			stops: [{ ...EXPERIENCE.experiences[0]!.stops[0]!, entryViewId: null, staySeconds: 5, invitation: null }, EXPERIENCE.experiences[0]!.stops[1]!]
		}
	]
};

describe('experience-presentation-view-remove (E4)', () => {
	it('deletes an unshared View with its connections; its Stop enters at the Default', async () => {
		const s = await boot(await experienceEnvelope({ experience: SHARED }));
		const intent = viewRemoveIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-v1' }, experienceId: 'experience-1', presentationId: 'presentation-1', viewId: 'view-1'});
		expect(intent.kind).toBe(EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND);
		expect((await s.coordinator.accept(intent)).kind).toBe('accepted');
		const camera = s.now().units.camera.data;
		expect(camera.views.map((view) => view.id)).toEqual(['view-2']);
		expect(camera.views[0]!.connectedViewIds).toEqual([]);
		expect(camera.connections).toEqual([]);
		expect(s.experience().stops[0]!.views).toEqual([{ viewId: 'view-2' }]);
		reloads(s.now());
		await s.coordinator.undo();
		expect(s.now().units.camera.data.connections.map((connection) => connection.id)).toEqual(['connection-1']);
	});

	it('needs a new Default chosen to remove the Default, and keeps a View another Presentation lists', async () => {
		const s = await boot(await experienceEnvelope({ experience: SHARED }));
		refusedWith(
			await s.coordinator.accept(
				viewRemoveIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-nodef' }, experienceId: 'experience-1', presentationId: 'presentation-1', viewId: 'view-2'})
			),
			'default-needed'
		);
		const outcome = await s.coordinator.accept(
			viewRemoveIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-def' }, experienceId: 'experience-1', presentationId: 'presentation-1', viewId: 'view-2'})
		);
		expect(outcome.kind).toBe('accepted');
		expect(s.experience().presentations[0]).toMatchObject({ views: [{ viewId: 'view-1' }]});
		// Still used by presentation-2: the Camera View survives.
		expect(s.now().units.camera.data.views.map((view) => view.id)).toEqual(['view-1', 'view-2']);
	});

	it('refuses the last View, a new Default when the Default stays, and a Default outside the Presentation', async () => {
		const s = await boot(await experienceEnvelope({ experience: SHARED }));
		refusedWith(
			await s.coordinator.accept(
				viewRemoveIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-last' }, experienceId: 'experience-1', presentationId: 'presentation-2', viewId: 'view-2'})
			),
			'presentation-keeps-a-view'
		);
		refusedWith(
			await s.coordinator.accept(
				viewRemoveIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-extra' }, experienceId: 'experience-1', presentationId: 'presentation-1', viewId: 'view-1'})
			),
			'invalid-default'
		);
		expect(s.depth()).toBe(1);
	});
});

describe('experience-presentation-remove (E4)', () => {
	it('removes its Stops and unshared Views and keeps a shared View', async () => {
		const s = await salon();
		const intent = removeIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-door' }, experienceId: 'x-experience', subject: 'presentation', id: 'x-door' });
		expect(intent.kind).toBe(EXPERIENCE_PRESENTATION_REMOVE_KIND);
		expect((await s.coordinator.accept(intent)).kind).toBe('accepted');
		expect(s.experience().presentations.map((entry) => entry.id)).toEqual(['x-piano', 'x-window', 'x-corner', 'x-wall']);
		expect(s.experience().stops.some((stop) => stop.presentationId === 'x-door')).toBe(false);
		const views = s.now().units.camera.data.views.map((view) => view.id);
		expect(views).not.toContain('x-door-view-1');
		expect(views).toContain(s.ids.sharedViewId);
		reloads(s.now());
	});

	it('removes a Presentation with two Stops, and refuses one that would leave a Guide empty', async () => {
		const s = await salon();
		expect((await s.coordinator.accept(removeIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-piano' }, experienceId: 'x-experience', subject: 'presentation', id: 'x-piano' }))).kind).toBe('accepted');
		expect(s.experience().guides[0]!.stopIds).toHaveLength(4);
		reloads(s.now());
		const one = await boot(
			await experienceEnvelope({
				experience: {
					...EXPERIENCE,
					experiences: [{ ...EXPERIENCE.experiences[0]!, gates: [{ id: 'gate-1', presentationId: 'presentation-2' }], guides: [{ id: 'guide-1', label: 'Main', stopIds: ['stop-1'], entryStopId: 'stop-1', pacing: 'automatic' as const }] }]
				}
			})
		);
		refusedWith(
			await one.coordinator.accept(removeIntent({ envelope: one.now(), revision: one.revision(), ids: { operation: 'op-empty' }, experienceId: 'experience-1', subject: 'presentation', id: 'presentation-1' })),
			'guide-keeps-a-stop'
		);
		// Its Gates go with it.
		expect((await one.coordinator.accept(removeIntent({ envelope: one.now(), revision: one.revision(), ids: { operation: 'op-gate' }, experienceId: 'experience-1', subject: 'presentation', id: 'presentation-2' }))).kind).toBe('accepted');
		expect(one.experience().gates).toEqual([]);
	});
});

describe('experience-guide-remove (E4)', () => {
	it('passes the Opening Guide to the next one, then leaves no Guide', async () => {
		const s = await salon();
		await s.coordinator.accept(
			guideCreateIntent({
				envelope: s.now(), revision: s.revision(), ids: { operation: 'op-g2', guide: 'short', stop: 'short-1' }, experienceId: 'x-experience',
				presentationId: 'x-window', label: 'Short tour', entryViewId: null, holdSeconds: null, continuation: null
			})
		);
		const intent = removeIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-rg' }, experienceId: 'x-experience', subject: 'guide', id: 'x-salon-guide' });
		expect(intent.kind).toBe(EXPERIENCE_GUIDE_REMOVE_KIND);
		expect((await s.coordinator.accept(intent)).kind).toBe('accepted');
		expect(s.experience().entryGuideId).toBe('short');
		expect(s.experience().stops.map((stop) => stop.id)).toEqual(['short-1']);
		await s.coordinator.accept(removeIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-rg2' }, experienceId: 'x-experience', subject: 'guide', id: 'short' }));
		expect(s.experience()).toMatchObject({ welcome: null, entryGuideId: null, guides: [], stops: [] });
		// Presentations are never removed with a Guide.
		expect(s.experience().presentations).toHaveLength(5);
		reloads(s.now());
	});

	it('keeps the Stops another Guide also orders', async () => {
		const s = await boot(
			await experienceEnvelope({
				experience: {
					...EXPERIENCE,
					experiences: [
						{
							...EXPERIENCE.experiences[0]!,
							guides: [
								{ id: 'guide-1', label: 'Main', stopIds: ['stop-1', 'stop-2'], entryStopId: 'stop-1', pacing: 'automatic' as const },
								{ id: 'guide-2', label: 'Second', stopIds: ['stop-2'], entryStopId: 'stop-2', pacing: 'automatic' as const }
							]
						}
					]
				}
			})
		);
		await s.coordinator.accept(removeIntent({ envelope: s.now(), revision: s.revision(), ids: { operation: 'op-g1' }, experienceId: 'experience-1', subject: 'guide', id: 'guide-1' }));
		expect(s.experience().stops.map((stop) => stop.id)).toEqual(['stop-2']);
		expect(s.experience().entryGuideId).toBe('guide-2');
	});
});

describe('kinds', () => {
	it('names every S26 operation with its own kind', () => {
		expect([EXPERIENCE_UPDATE_KIND, EXPERIENCE_GUIDE_UPDATE_KIND, EXPERIENCE_STOP_REMOVE_KIND, EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND, EXPERIENCE_PRESENTATION_REMOVE_KIND, EXPERIENCE_GUIDE_REMOVE_KIND]).toEqual([
			'experience-update',
			'experience-guide-update',
			'experience-stop-remove',
			'experience-presentation-view-remove',
			'experience-presentation-remove',
			'experience-guide-remove'
		]);
	});
});
