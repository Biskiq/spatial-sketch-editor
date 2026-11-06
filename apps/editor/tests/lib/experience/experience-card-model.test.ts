/**
 * The shared Card's identity and facts for each Experience subject (R217.S25).
 *
 * Every helper is a pure function over plain values, so each kind is tested with its inputs
 * stated directly: the kind word, the name, the status and the More facts.
 */
import { describe, expect, it } from 'vitest';
import {
	PRESENTATION_WRITER_FIELDS,
	STOP_WRITER_FIELDS,
	guideCardModel,
	guideSourceId,
	presentationCardModel,
	presentationSourceId,
	stopCardModel,
	stopSourceId,
	subjectCardModel,
	subjectSourceId,
	transitionCardModel,
	transitionLabel,
	transitionSourceId,
	viewCardModel,
	viewSourceId
} from '$lib/authoring/experience/experience-card-model';

describe('presentationCardModel', () => {
	const base = {
		presentationId: 'presentation-1',
		label: 'Entry hall',
		hasSubject: false,
		viewCount: 2,
		stopCount: 1,
		hasDefaultView: true
	};

	it('names a Presentation with no subject with the plain kind word and a stable source id', () => {
		const model = presentationCardModel(base);
		expect(model.identity).toEqual({
			sourceId: presentationSourceId('presentation-1'),
			label: 'Entry hall',
			kind: 'Presentation',
			status: 'Default View set'
		});
		expect(model.identity.sourceId).toBe('experience:presentation:presentation-1');
	});

	it('names a Presentation about a Scene subject with the about kind word', () => {
		const model = presentationCardModel({ ...base, hasSubject: true });
		expect(model.identity.kind).toBe('Presentation · about');
	});

	it('lists the View count and the Stops that visit it as More facts', () => {
		const model = presentationCardModel({ ...base, viewCount: 3, stopCount: 2 });
		expect(model.facts.map((fact) => [fact.label, fact.value])).toEqual([
			['Views', '3'],
			['Used in', '2 Stops']
		]);
	});

	it('says a single Stop in the singular and an unused Presentation as no Stop yet', () => {
		expect(presentationCardModel({ ...base, stopCount: 1 }).facts[1]).toEqual({
			label: 'Used in',
			value: '1 Stop'
		});
		expect(presentationCardModel({ ...base, stopCount: 0 }).facts[1]).toEqual({
			label: 'Used in',
			value: 'No Stop yet'
		});
	});

	it('names a Presentation with no Default View as such', () => {
		const model = presentationCardModel({ ...base, hasDefaultView: false });
		expect(model.identity.status).toBe('No Default View');
	});

	it('keeps the writer field lists empty, so no fact names a writer field', () => {
		expect(PRESENTATION_WRITER_FIELDS).toEqual([]);
		for (const fact of presentationCardModel(base).facts) expect(fact.fieldId).toBeUndefined();
	});
});

describe('viewCardModel', () => {
	it('names a View with the View in kind word, its name and the Presentation it belongs to', () => {
		const model = viewCardModel({ viewId: 'view-1', label: 'Door', presentationLabel: 'Entry hall' });
		expect(model.identity).toEqual({
			sourceId: 'experience:view:view-1',
			label: 'Door',
			kind: 'View in',
			status: 'Entry hall'
		});
		expect(viewSourceId('view-1')).toBe('experience:view:view-1');
	});

	it('lists no More facts', () => {
		expect(viewCardModel({ viewId: 'view-1', label: 'Door', presentationLabel: 'Entry hall' }).facts).toEqual([]);
	});
});

describe('stopCardModel', () => {
	it('names a placed Stop by its place in the active Guide and the Presentation it visits', () => {
		const model = stopCardModel({
			stopId: 'stop-1',
			presentationLabel: 'Entry hall',
			position: 2,
			guideLength: 3,
			guideLabel: 'Tour'
		});
		expect(model.identity).toEqual({
			sourceId: stopSourceId('stop-1'),
			label: 'Entry hall',
			kind: 'Stop 2 of 3 · Tour',
			status: 'Tour'
		});
		expect(model.facts).toEqual([]);
		expect(model.identity.sourceId).toBe('experience:stop:stop-1');
	});

	it('names a Stop the active Guide does not list by what it visits, with no invented place', () => {
		const model = stopCardModel({
			stopId: 'stop-1',
			presentationLabel: 'Entry hall',
			position: null,
			guideLength: 3,
			guideLabel: 'Tour'
		});
		expect(model.identity.kind).toBe('Stop · Entry hall');
		expect(model.identity.label).toBe('Entry hall');
		expect(model.identity.status).toBe('Not in this Guide');
	});

	it('keeps the writer field list empty', () => {
		expect(STOP_WRITER_FIELDS).toEqual([]);
	});
});

describe('transitionCardModel', () => {
	it('labels the next Stop in the Guide by its place', () => {
		const model = transitionCardModel({
			stopId: 'stop-2',
			fromPosition: 2,
			guideLabel: 'Tour',
			continuation: { kind: 'adjacent', stopId: 'stop-3', position: 3, transition: 'cut', explicit: false }
		});
		expect(model.identity).toEqual({
			sourceId: transitionSourceId('stop-2'),
			label: 'Stop 2 → Stop 3',
			kind: 'Transition · Tour',
			status: 'Cut'
		});
		expect(model.identity.sourceId).toBe('experience:transition:stop-2');
	});

	it('labels a Travel step as Travel between the two Stops', () => {
		const model = transitionCardModel({
			stopId: 'stop-2',
			fromPosition: 2,
			guideLabel: 'Tour',
			continuation: { kind: 'adjacent', stopId: 'stop-3', position: 3, transition: 'travel', explicit: false }
		});
		expect(model.identity.label).toBe('Stop 2 → Stop 3');
		expect(model.identity.status).toBe('Travel');
	});

	it('labels the last Stop’s continuation as End', () => {
		const model = transitionCardModel({
			stopId: 'stop-2',
			fromPosition: 2,
			guideLabel: 'Tour',
			continuation: { kind: 'end', explicit: false }
		});
		expect(model.identity.label).toBe('Stop 2 → End');
		expect(model.identity.status).toBe('End');
		expect(model.facts).toEqual([]);
	});

	it('gives every continuation label the same arrow line through transitionLabel', () => {
		expect(transitionLabel({ kind: 'adjacent', stopId: 's', position: 4, transition: 'cut', explicit: false }, 3)).toBe(
			'Stop 3 → Stop 4'
		);
		expect(transitionLabel({ kind: 'end', explicit: false }, 1)).toBe('Stop 1 → End');
	});
});

describe('guideCardModel', () => {
	it('names a Guide with the Guide kind word, its label and its Stop count', () => {
		const model = guideCardModel({ guideId: 'guide-1', label: 'Tour', stopCount: 3 });
		expect(model.identity).toEqual({
			sourceId: guideSourceId('guide-1'),
			label: 'Tour',
			kind: 'Guide',
			status: '3 Stops'
		});
		expect(model.identity.sourceId).toBe('experience:guide:guide-1');
		expect(model.facts).toEqual([]);
	});

	it('states an empty Guide as having no Stops yet', () => {
		expect(guideCardModel({ guideId: 'guide-1', label: 'Tour', stopCount: 0 }).identity.status).toBe('No Stops yet');
	});

	it('uses the singular for a single Stop', () => {
		expect(guideCardModel({ guideId: 'guide-1', label: 'Tour', stopCount: 1 }).identity.status).toBe('1 Stop');
	});
});

describe('subjectCardModel', () => {
	it('names a Scene object with the Scene object kind word and its entity label', () => {
		const model = subjectCardModel({ entityId: 'entity-7', label: 'Lamp' });
		expect(model.identity).toEqual({
			sourceId: subjectSourceId('entity-7'),
			label: 'Lamp',
			kind: 'Scene object',
			status: 'In the Scene'
		});
		expect(model.identity.sourceId).toBe('experience:subject:entity-7');
		expect(model.facts).toEqual([]);
	});
});
