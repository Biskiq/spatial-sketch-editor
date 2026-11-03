/**
 * The Card's identity and facts for an Experience subject (R217.S25).
 *
 * A Presentation and a Stop show through the shared Card. The model names each one and
 * states the facts the Card lists in More, and every fact a writer edits carries that
 * writer's field id, so the Card never repeats a value the writer already shows.
 */
import { describe, expect, it } from 'vitest';
import type { ExperiencePresentation, ExperienceStop } from '@portfolio/project-model/units';
import {
	PRESENTATION_WRITER_FIELDS,
	STOP_WRITER_FIELDS,
	presentationCardModel,
	presentationSourceId,
	stopCardModel,
	stopSourceId
} from '$lib/authoring/experience/experience-card-model';

const PRESENTATION: ExperiencePresentation = {
	id: 'presentation-1',
	label: 'Entry hall',
	viewIds: ['view-1', 'view-2'],
	defaultViewId: 'view-2',
	subject: null,
	text: null
};

const VIEWS = [
	{ id: 'view-1', label: 'View 1' },
	{ id: 'view-2', label: 'View 2' }
];

describe('presentationCardModel', () => {
	it('names the Presentation with its own kind word and a stable subject identity', () => {
		const model = presentationCardModel({ presentation: PRESENTATION, views: VIEWS, stopCount: 1 });
		expect(model.identity).toEqual({
			sourceId: presentationSourceId('presentation-1'),
			label: 'Entry hall',
			kind: 'Presentation',
			status: 'Default View set'
		});
		expect(model.identity.sourceId).toBe('experience:presentation:presentation-1');
	});

	it('lists the Views, the Default View and the Stops that visit it as More facts', () => {
		const model = presentationCardModel({ presentation: PRESENTATION, views: VIEWS, stopCount: 2 });
		expect(model.facts.map((fact) => [fact.label, fact.value])).toEqual([
			['Views', '2'],
			['Default View', 'View 2'],
			['Subject', 'Environment or region'],
			['Used in', '2 Stops']
		]);
	});

	it('keeps the Default View fact keyed to the writer that edits it, so the Card does not repeat it', () => {
		const model = presentationCardModel({ presentation: PRESENTATION, views: VIEWS, stopCount: 0 });
		const defaultFact = model.facts.find((fact) => fact.label === 'Default View');
		expect(defaultFact?.fieldId).toBe('default-view');
		expect(PRESENTATION_WRITER_FIELDS).toContain(defaultFact?.fieldId);
	});

	it('states an unset Default View and an unused Presentation as honest states', () => {
		const unset = presentationCardModel({
			presentation: { ...PRESENTATION, defaultViewId: null },
			views: VIEWS,
			stopCount: 0
		});
		expect(unset.identity.status).toBe('No Default View');
		expect(unset.facts.find((fact) => fact.label === 'Default View')?.value).toBe('Unset: cannot be entered');
		expect(unset.facts.find((fact) => fact.label === 'Used in')?.value).toBe('No Stop yet');
	});

	it('keeps a Default View that names a missing View distinct from an unset one', () => {
		const model = presentationCardModel({
			presentation: { ...PRESENTATION, defaultViewId: 'view-gone' },
			views: VIEWS,
			stopCount: 0
		});
		// The reference is set but its View is absent: the Card says so, rather than calling it unset.
		expect(model.identity.status).toBe('No Default View');
		expect(model.facts.find((fact) => fact.label === 'Default View')?.value).toBe('Missing View: cannot be entered');
	});
});

const STOP: ExperienceStop = { id: 'stop-1', presentationId: 'presentation-1' };

describe('stopCardModel', () => {
	it('names a placed Stop by its position in the Guide and the Presentation it visits', () => {
		const model = stopCardModel({
			stop: STOP,
			position: 2,
			guideLength: 3,
			presentationLabel: 'Entry hall',
			guideLabel: 'Tour'
		});
		expect(model.identity).toEqual({
			sourceId: stopSourceId('stop-1'),
			label: '2. Entry hall',
			kind: 'Stop',
			status: 'Tour'
		});
		expect(model.facts.map((fact) => [fact.label, fact.value])).toEqual([
			['Presentation', 'Entry hall'],
			['Position', '2 of 3'],
			['Guide', 'Tour']
		]);
	});

	it('names a Stop the open Guide does not list by what it visits, with no invented position', () => {
		const model = stopCardModel({
			stop: STOP,
			position: 0,
			guideLength: 3,
			presentationLabel: 'Entry hall',
			guideLabel: null
		});
		expect(model.identity.label).toBe('Entry hall');
		expect(model.facts.map((fact) => fact.label)).toEqual(['Presentation']);
	});

	it('leaves the Stop fields to its writer, so none of them is repeated as a fact', () => {
		const model = stopCardModel({
			stop: STOP,
			position: 1,
			guideLength: 1,
			presentationLabel: 'Entry hall',
			guideLabel: 'Tour'
		});
		for (const fact of model.facts) expect(STOP_WRITER_FIELDS).not.toContain(fact.fieldId);
	});
});
