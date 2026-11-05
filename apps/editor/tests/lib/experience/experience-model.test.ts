/**
 * The Experience homes' reading model (R217.S25): pure readings of the accepted
 * Experience, with no controller and no DOM.
 */
import { describe, expect, it } from 'vitest';

import type {
	CameraView,
	Experience,
	ExperiencePresentation,
	ExperienceStop
} from '@portfolio/project-model/units';
import {
	guideStopsOf,
	lensMillimetres,
	presentationsAboutEntity,
	reachSummary,
	resolveContinuation,
	stopEntryViewId,
	stopExitViewId,
	stopsGuiding,
	viewFactsOf
} from '$lib/authoring/experience/experience-model';

const VIEWS: CameraView[] = ['a', 'b', 'c', 'd'].map((id, index) => ({
	id: `view-${id}`,
	label: `View ${id}`,
	eye: [index, 1.6, 0],
	target: [index, 1.4, -2],
	fov: 54,
	connectedViewIds: []
}));

const subjectOf = (entityId: string, domain = 'scene', kind = 'entity') =>
	({
		version: 1,
		domain,
		revision: { kind: 'exact', contentRevision: 'r' },
		subject: { kind, id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	}) as unknown as ExperiencePresentation['subject'];

const PRESENTATIONS: ExperiencePresentation[] = [
	{ id: 'p-1', label: 'One', views: [{ viewId: 'view-a' }, { viewId: 'view-b' }], explorable: true, subject: subjectOf('piano'), text: null },
	{ id: 'p-2', label: 'Two', views: [{ viewId: 'view-c' }], explorable: true, subject: null, text: null },
	{ id: 'p-3', label: 'Three', views: [{ viewId: 'view-d' }], explorable: true, subject: null, text: null }
];

function experience(stops: ExperienceStop[], stopIds = stops.map((stop) => stop.id)): Experience {
	return {
		id: 'e-1',
		label: 'Walk',
		welcome: null,
		entryGuideId: 'g-1',
		presentations: PRESENTATIONS,
		stops,
		guides: [{ id: 'g-1', label: 'Main', stopIds, entryStopId: stopIds[0]!, pacing: 'automatic' }],
		detours: []
	};
}

const guideOf = (value: Experience) => value.guides[0]!;

describe('lensMillimetres', () => {
	it('is the 35 mm equivalent of the vertical field, rounded', () => {
		expect(lensMillimetres(54)).toBe(24);
		expect(lensMillimetres(90)).toBe(12);
		expect(lensMillimetres(27)).toBe(50);
	});

	it('is 0 for a field that has no lens', () => {
		expect(lensMillimetres(0)).toBe(0);
		expect(lensMillimetres(Number.NaN)).toBe(0);
	});
});

describe('viewFactsOf', () => {
	const value = experience([]);

	it('reads lens, eye height and whether the View is its Presentation Default', () => {
		expect(viewFactsOf(value, VIEWS, 'view-a')).toEqual({
			id: 'view-a',
			label: 'View a',
			presentationId: 'p-1',
			fovDegrees: 54,
			lensMillimetres: 24,
			eyeHeightMetres: 1.6,
			isDefault: true
		});
		expect(viewFactsOf(value, VIEWS, 'view-b')?.isDefault).toBe(false);
	});

	it('is null for a View the Experience or the Camera does not carry', () => {
		expect(viewFactsOf(value, VIEWS, 'missing')).toBeNull();
		expect(viewFactsOf(value, [], 'view-a')).toBeNull();
	});
});

describe('Stops guiding a View', () => {
	const stops: ExperienceStop[] = [
		{ id: 's-1', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1' },
		{ id: 's-2', entryViewId: 'view-b', staySeconds: 5, invitation: null, presentationId: 'p-1' },
		{ id: 's-3', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1' }
	];
	const value = experience(stops);

	it('enters at its own View, else the Default, and leaves from the same View', () => {
		expect(stopEntryViewId(value, stops[0]!)).toBe('view-a');
		expect(stopEntryViewId(value, stops[1]!)).toBe('view-b');
		expect(stopExitViewId(value, stops[1]!)).toBe('view-b');
	});

	it('lists the Guide Stops that enter at a View, with their Stop position', () => {
		expect(stopsGuiding(value, guideOf(value), 'view-a')).toEqual([
			{ stopId: 's-1', position: 1 },
			{ stopId: 's-3', position: 3 }
		]);
		expect(stopsGuiding(value, guideOf(value), 'view-b')).toEqual([{ stopId: 's-2', position: 2 }]);
		expect(stopsGuiding(value, guideOf(value), 'view-c')).toEqual([]);
		expect(stopsGuiding(value, null, 'view-a')).toEqual([]);
	});

	it('skips Guide ids the Experience does not carry', () => {
		const orphan = experience(stops, ['s-1', 'gone']);
		expect(guideStopsOf(orphan, guideOf(orphan)).map((stop) => stop.id)).toEqual(['s-1']);
		expect(guideStopsOf(orphan, null)).toEqual([]);
	});
});

describe('presentationsAboutEntity', () => {
	const value = experience([]);

	it('finds Presentations about a Scene entity through presentation.subject', () => {
		expect(presentationsAboutEntity(value, 'piano').map((entry) => entry.id)).toEqual(['p-1']);
		expect(presentationsAboutEntity(value, 'sofa')).toEqual([]);
	});

	it('ignores a subject that is not a Scene entity', () => {
		const other = {
			...value,
			presentations: [
				{ ...PRESENTATIONS[0]!, subject: subjectOf('piano', 'scene', 'material') },
				{ ...PRESENTATIONS[1]!, subject: subjectOf('piano', 'camera', 'entity') }
			]
		};
		expect(presentationsAboutEntity(other, 'piano')).toEqual([]);
	});
});

describe('reachSummary', () => {
	it('counts the Views no Stop enters at as only free', () => {
		const value = experience([
			{ id: 's-1', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1' },
			{ id: 's-2', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-2' }
		]);
		// Views: a, b (p-1), c (p-2), d (p-3, no Default). Stops enter at a and c.
		expect(reachSummary(value, guideOf(value))).toEqual({ presentations: 3, views: 4, freePresentations: 3, freeViews: 4, hiddenViews: 0, viewsOnlyFree: 2 });
	});

	it('counts every View as free without an active Guide', () => {
		const value = experience([{ id: 's-1', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1' }]);
		expect(reachSummary(value, null)).toEqual({ presentations: 3, views: 4, freePresentations: 3, freeViews: 4, hiddenViews: 0, viewsOnlyFree: 4 });
	});

	it('counts a View once however many Stops enter there', () => {
		const value = experience([
			{ id: 's-1', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1' },
			{ id: 's-2', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1' }
		]);
		expect(reachSummary(value, guideOf(value)).viewsOnlyFree).toBe(3);
	});
});

describe('resolveContinuation', () => {
	const stops: ExperienceStop[] = [
		{ id: 's-1', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1', continuation: { kind: 'sequence-next', transition: 'travel' } },
		{ id: 's-2', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-2', continuation: { kind: 'stop', stopId: 's-4' } },
		{ id: 's-3', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1', continuation: { kind: 'stop', stopId: 's-4', transition: 'travel' } },
		{ id: 's-4', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-2', continuation: { kind: 'end' } },
		{ id: 's-5', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1', continuation: { kind: 'sequence-next' } },
		{ id: 's-6', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-2' },
		{ id: 's-7', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1', continuation: { kind: 'stop', stopId: 's-1' } }
	];
	const value = experience(stops, ['s-1', 's-2', 's-3', 's-4', 's-5', 's-6']);
	const guide = guideOf(value);
	const resolve = (stopId: string) => resolveContinuation(value, guide, stopId);

	it('resolves the sequence to the adjacent Stop, with its transition', () => {
		expect(resolve('s-1')).toEqual({
			kind: 'adjacent',
			stopId: 's-2',
			position: 2,
			transition: 'travel',
			explicit: false
		});
		expect(resolve('s-5')).toEqual({ kind: 'adjacent', stopId: 's-6', position: 6, transition: 'cut', explicit: false });
	});

	it('resolves a chosen Stop that is not the neighbour as a jump', () => {
		expect(resolve('s-2')).toEqual({ kind: 'jump', stopId: 's-4', position: 4, transition: 'cut', explicit: true });
	});

	it('resolves a chosen Stop that IS the neighbour as adjacent, and keeps it explicit', () => {
		expect(resolve('s-3')).toEqual({
			kind: 'adjacent',
			stopId: 's-4',
			position: 4,
			transition: 'travel',
			explicit: true
		});
	});

	it('resolves an explicit End and a sequence-next on the last Stop to End', () => {
		expect(resolve('s-4')).toEqual({ kind: 'end', explicit: true });
		expect(resolve('s-6')).toEqual({ kind: 'end', explicit: false });
	});

	it('reads an unauthored continuation as the sequence with a Cut', () => {
		const bare = experience([
			{ id: 's-1', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-1' },
			{ id: 's-2', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'p-2' }
		]);
		expect(resolveContinuation(bare, guideOf(bare), 's-1')).toEqual({
			kind: 'adjacent',
			stopId: 's-2',
			position: 2,
			transition: 'cut',
			explicit: false
		});
	});

	it('resolves a target outside the Guide as a jump with no position', () => {
		expect(resolveContinuation(value, guide, 's-7')).toEqual({
			kind: 'jump',
			stopId: 's-1',
			position: 1,
			transition: 'cut',
			explicit: true
		});
		const away = experience(stops, ['s-1', 's-2', 's-3']);
		expect(resolveContinuation(away, guideOf(away), 's-3')).toEqual({
			kind: 'jump',
			stopId: 's-4',
			position: null,
			transition: 'travel',
			explicit: true
		});
	});

	it('is null for a Stop the Experience does not carry, and ends with no Guide', () => {
		expect(resolve('missing')).toBeNull();
		expect(resolveContinuation(value, null, 's-1')).toEqual({ kind: 'end', explicit: false });
	});
});
