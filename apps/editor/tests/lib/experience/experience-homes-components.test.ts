// @vitest-environment jsdom
/**
 * R217.S25 — the Experience homes' components, mounted against a fake controller and fake homes.
 *
 * No Stage and no route. The fake controller answers from the Experience's own reading functions
 * (`experience-model.ts`), and every write is a spy. A probe puts the fake homes in context the way
 * the route does. Each block names one design decision from the S25 harvest: connectors name the
 * resolved destination (D11), Cut and Travel have one home (D6), a Stop's other Views are dimmed
 * with an Include action (S27), the Default View has one mutation home (D12), and the timeline
 * shows Stop order with no time (D9).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount, type Component } from 'svelte';

import ExperienceDock from '$lib/authoring/experience/ExperienceDock.svelte';
import ExperienceMarks from '$lib/authoring/experience/ExperienceMarks.svelte';
import ExperienceGuide from '$lib/authoring/experience/ExperienceGuide.svelte';
import ExperiencePresentationWriter from '$lib/authoring/experience/ExperiencePresentationWriter.svelte';
import ExperienceStopWriter from '$lib/authoring/experience/ExperienceStopWriter.svelte';
import ExperienceTransitionWriter from '$lib/authoring/experience/ExperienceTransitionWriter.svelte';
import ExperienceViewWriter from '$lib/authoring/experience/ExperienceViewWriter.svelte';
import ExperienceGuideWriter from '$lib/authoring/experience/ExperienceGuideWriter.svelte';
import type { ExperienceController } from '$lib/authoring/experience/experience-controller.svelte';
import type { ExperienceHomes } from '$lib/authoring/experience/experience-homes';
import {
	guideStopsOf,
	lensMillimetres,
	reachSummary,
	resolveContinuation,
	stopsGuiding,
	type ExperienceSubject,
	type ExperienceViewFacts
} from '$lib/authoring/experience/experience-model';
import { EYE_HEIGHT_STEPS, LENS_STEPS } from '$lib/authoring/experience/look-through';
import type {
	CameraView,
	Experience,
	ExperienceGuide as GuideRecord,
	ExperiencePresentation,
	ExperienceStop
} from '@portfolio/project-model/units';
import { createViewportCameraState, evaluateViewport } from '@portfolio/camera-core';

import ExperienceHomesProbe from './fixtures/ExperienceHomesProbe.svelte';

// ---- The fixture Experience: five Stops over three Presentations ----

const VIEW_LABELS: Record<string, string> = {
	'piano-wide': 'Wide',
	'piano-keys': 'Keys',
	'gallery-hall': 'Hall',
	'garden-gate': 'Gate',
	'garden-bench': 'Bench'
};

/**
 * Stop 1 cuts to Stop 2 (sequence). Stop 2 travels to Stop 3 and has a Travel gap. Stop 3
 * jumps to Stop 5 over Stop 4. Stop 4 follows the sequence. Stop 5 ends the tour.
 */
const PRESENTATIONS: readonly ExperiencePresentation[] = [
	{ id: 'piano', label: 'Piano', viewIds: ['piano-wide', 'piano-keys'], explorable: true, defaultViewId: 'piano-wide', subject: null, text: null },
	{ id: 'gallery', label: 'Gallery', viewIds: ['gallery-hall'], explorable: true, defaultViewId: 'gallery-hall', subject: null, text: null },
	{ id: 'garden', label: 'Garden', viewIds: ['garden-gate', 'garden-bench'], explorable: true, defaultViewId: 'garden-gate', subject: null, text: null }
];

const STOPS: readonly ExperienceStop[] = [
	{ id: 'stop-1', presentationId: 'piano', views: [{ viewId: 'piano-wide', holdSeconds: 0.5 }], continuation: { kind: 'sequence-next', transition: 'cut' } },
	{ id: 'stop-2', views: [{ viewId: 'gallery-hall' }], presentationId: 'gallery', continuation: { kind: 'sequence-next', transition: 'travel' } },
	{ id: 'stop-3', views: [{ viewId: 'garden-gate' }], presentationId: 'garden', continuation: { kind: 'stop', stopId: 'stop-5', transition: 'cut' } },
	{ id: 'stop-4', views: [{ viewId: 'piano-wide' }], presentationId: 'piano', continuation: { kind: 'sequence-next' } },
	{ id: 'stop-5', views: [{ viewId: 'gallery-hall' }], presentationId: 'gallery', continuation: { kind: 'end' } }
];

const GUIDE: GuideRecord = {
	id: 'guide-1',
	label: 'Main',
	stopIds: ['stop-1', 'stop-2', 'stop-3', 'stop-4', 'stop-5'],
	entryStopId: 'stop-1'
};

const EXPERIENCE: Experience = {
	id: 'experience-1',
	label: 'Walk',
	welcome: null,
	entryGuideId: 'guide-1',
	presentations: PRESENTATIONS,
	stops: STOPS,
	guides: [GUIDE],
	gates: [],
	detours: []
};

const GAPS = new Map<string, readonly string[]>([['stop-2', ['Gallery has no Camera path to Garden.']]]);

const CAMERA_VIEWS: readonly CameraView[] = [
	{ id: 'piano-wide', label: 'Wide', eye: [-1, 2, 4], target: [0, 1, 0], fov: 54, connectedViewIds: [] },
	{ id: 'piano-keys', label: 'Keys', eye: [1, 2, 4], target: [0, 1, 0], fov: 54, connectedViewIds: [] }
];

const VIEWS_OF = new Map(
	PRESENTATIONS.map((presentation) => [
		presentation.id,
		presentation.viewIds.map((id) => ({ id, label: VIEW_LABELS[id] ?? id }))
	] as const)
);

function facts(id: string, presentationId: string, fovDegrees: number, isDefault: boolean): ExperienceViewFacts {
	return {
		id,
		label: VIEW_LABELS[id] ?? id,
		presentationId,
		fovDegrees,
		lensMillimetres: lensMillimetres(fovDegrees),
		eyeHeightMetres: 1.6,
		isDefault
	};
}

const VIEW_FACTS: Record<string, ExperienceViewFacts> = {
	'piano-wide': facts('piano-wide', 'piano', 54, true),
	'piano-keys': facts('piano-keys', 'piano', 35, false),
	'gallery-hall': facts('gallery-hall', 'gallery', 54, true)
};

// ---- Fakes: a controller shaped like the contract, with spies on every write ----

type ControllerOptions = {
	guided?: boolean;
	busy?: boolean;
	subject?: ExperienceSubject | null;
	selectedStopId?: string;
	guidedViews?: ExperienceStop['views'];
	selectedViewId?: string;
	selectedPresentationId?: string;
};

function fakeController(options: ControllerOptions = {}) {
	const guide = options.guided === false ? null : GUIDE;
	const stops = guideStopsOf(EXPERIENCE, guide);
	const stop = STOPS.find((stop) => stop.id === options.selectedStopId) ?? null;
	const selectedStop = stop === null || options.guidedViews === undefined ? stop : { ...stop, views: options.guidedViews };
	const selectedPresentation =
		PRESENTATIONS.find((presentation) => presentation.id === options.selectedPresentationId ||
			(options.selectedViewId !== undefined && presentation.viewIds.includes(options.selectedViewId))) ?? null;
	const selectedView = options.selectedViewId === undefined ? null : (VIEW_FACTS[options.selectedViewId] ?? null);
	return {
		current: EXPERIENCE,
		currentGuide: guide,
		contextGuide: guide,
		cameraViews: CAMERA_VIEWS,
		guides: guide === null ? [] : [guide],
		guideStops: stops,
		subject: options.subject ?? null,
		selectedPresentation,
		selectedView,
		selectedStop,
		travelGaps: selectedStop === null ? [] : (GAPS.get(selectedStop.id) ?? []),
		travelGapsByStop: GAPS,
		stopUsage: new Map<string, readonly string[]>(),
		viewsOf: VIEWS_OF,
		filteredPresentations: PRESENTATIONS,
		message: '',
		busy: options.busy ?? false,
		query: '',
		presentationLabel: (presentationId: string) =>
			PRESENTATIONS.find((presentation) => presentation.id === presentationId)?.label ?? '',
		select: vi.fn<(subject: ExperienceSubject | null) => void>(),
		openExperience: vi.fn(),
		openGuide: vi.fn(),
		viewFacts: vi.fn(() => null),
		resolveContinuation: (stopId: string) => resolveContinuation(EXPERIENCE, guide, stopId),
		viewStops: (viewId: string) => stopsGuiding(EXPERIENCE, guide, viewId),
		presentationsAbout: vi.fn(() => []),
		reach: () => reachSummary(EXPERIENCE, guide),
		createExperience: vi.fn(async () => undefined),
		capture: vi.fn(async () => true),
		presentThis: vi.fn(async () => true),
		addStop: vi.fn(async (_presentationId: string, _options?: unknown) => true),
		moveStopTo: vi.fn(async () => true),
		moveStop: vi.fn(async () => true),
		includeView: vi.fn(async (_stopId: string, _viewId: string) => true),
		leaveOutView: vi.fn(async (_stopId: string, _viewId: string) => true),
		moveGuidedViewTo: vi.fn(async (_stopId: string, _viewId: string, _index: number) => true),
		moveGuidedView: vi.fn(async (_stopId: string, _viewId: string, _direction: number) => true),
		setExplorable: vi.fn(async (_presentationId: string, _explorable: boolean) => true),
		setWelcome: vi.fn(async (_body: string) => true),
		setViewHold: vi.fn(async (_stopId: string, _viewId: string, _holdSeconds: number | null) => true),
		setContinuation: vi.fn(async (_stopId: string, _target: unknown) => true),
		setTransition: vi.fn(async (_stopId: string, _transition: 'cut' | 'travel') => true),
		renamePresentation: vi.fn(async () => ({ kind: 'accepted' as const })),
		updatePresentationText: vi.fn(async () => true),
		setDefaultView: vi.fn(async (_presentationId: string, _viewId: string) => undefined),
		renameExperience: vi.fn(async () => ({ kind: 'accepted' as const })),
		renameGuide: vi.fn(async () => ({ kind: 'accepted' as const })),
		renameView: vi.fn(async () => ({ kind: 'accepted' as const })),
		makeOpeningGuide: vi.fn(async (_guideId: string) => true),
		setGuideStart: vi.fn(async (_stopId: string) => true),
		addToGuide: vi.fn(async () => true),
		createGuide: vi.fn(async (_presentationId: string, _label: string) => true),
		alsoIn: (viewId: string, presentationId: string) =>
			PRESENTATIONS.filter((presentation) => presentation.id !== presentationId && presentation.viewIds.includes(viewId)),
		moveViewTo: vi.fn(async () => true),
		moveView: vi.fn(async (_presentationId: string, _viewId: string, _direction: -1 | 1) => true),
		removalPreview: vi.fn(() => ({ kind: 'refused' as const, reason: 'not in this fake' })),
		remove: vi.fn(async () => true),
		backTarget: null,
		back: vi.fn(() => false),
		subjectName: vi.fn(() => '')
	};
}

type FakeController = ReturnType<typeof fakeController>;

type ThroughOptions = {
	readonly viewId?: string;
	readonly fovYDegrees?: number;
	readonly eyeHeightMetres?: number;
	readonly moved?: boolean;
};

function fakeHomes(controller: FakeController | null, guideOpen = false, through: ThroughOptions = {}) {
	return {
		controller: () => controller as unknown as ExperienceController | null,
		guideOpen: () => guideOpen,
		setGuideOpen: vi.fn<(open: boolean) => void>(),
		select: vi.fn<(subject: ExperienceSubject | null) => void>(),
		guideNamePrompt: (): string | null => null,
		requestGuideName: vi.fn<(presentationId: string | null) => void>(),
		sceneSubject: () => null,
		openInWorld: vi.fn(),
		lookThroughViewId: () => through.viewId ?? null,
		lookThroughMoved: () => through.moved ?? false,
		lookThroughFraming: () =>
			through.viewId === undefined
				? null
				: {
						fovYDegrees: through.fovYDegrees ?? 54,
						eyeHeightMetres: through.eyeHeightMetres ?? 1.6
					},
		lookThroughLens: vi.fn(() => false),
		lookThroughEyeHeight: vi.fn(() => false),
		lookThrough: vi.fn(),
		exitLookThrough: vi.fn(),
		updateLookThrough: vi.fn(async () => {}),
		captureProvisional: vi.fn(async () => {}),
		presentThis: vi.fn(async () => {})
	} satisfies ExperienceHomes;
}

type FakeHomes = ReturnType<typeof fakeHomes>;

// ---- Mounting: each home sits beneath the probe, which provides the homes ----

const live: { component: Record<string, unknown>; target: HTMLElement }[] = [];

afterEach(() => {
	for (const { component, target } of live.splice(0)) {
		void unmount(component);
		target.remove();
	}
});

function appendTarget(): HTMLElement {
	const target = document.createElement('div');
	document.body.append(target);
	return target;
}

function mountHome(home: Component<any>, homeProps: Record<string, unknown>, homes: FakeHomes): HTMLElement {
	const target = appendTarget();
	const component = mount(ExperienceHomesProbe, {
		target,
		props: { homes: homes as unknown as ExperienceHomes, home, homeProps }
	});
	live.push({ component, target });
	return target;
}

function mountPlain(component: Component<any>, props: Record<string, unknown>): HTMLElement {
	const target = appendTarget();
	live.push({ component: mount(component, { target, props }), target });
	return target;
}

async function settle(): Promise<void> {
	await tick();
	await tick();
}

// ---- Reading the DOM ----

function nameOf(element: Element): string {
	return element.getAttribute('aria-label') ?? (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function buttonNamed(root: ParentNode, name: string | RegExp): HTMLButtonElement {
	const found = [...root.querySelectorAll<HTMLButtonElement>('button')].filter((button) =>
		typeof name === 'string' ? nameOf(button) === name : name.test(nameOf(button))
	);
	expect(found, `one button named ${String(name)}`).toHaveLength(1);
	return found[0]!;
}

/** The reason a control points at through aria-describedby, as its visible text. */
function reasonOf(element: Element): string {
	const id = element.getAttribute('aria-describedby') ?? '';
	return document.getElementById(id)?.textContent?.trim() ?? '';
}

/** The connector chip that follows a Stop's card in the Guide's row. */
function chipAfter(root: ParentNode, stopId: string): HTMLButtonElement {
	const card = root.querySelector<HTMLElement>(`.stop-card[data-stop-id="${stopId}"]`);
	const chip = card?.nextElementSibling?.querySelector<HTMLButtonElement>('.chip');
	if (!chip) throw new Error(`no connector after ${stopId}`);
	return chip;
}

function typeInto(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

// ---- The Guide instrument ----

describe('R217.S25 — the Guide connectors name the resolved destination (D11)', () => {
	it('draws an adjacent continuation as a Cut or Travel chip between its two cards', async () => {
		const homes = fakeHomes(fakeController());
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, homes);
		await settle();

		const cut = chipAfter(target, 'stop-1');
		expect(cut.textContent?.trim()).toBe('cut');
		expect(cut.classList.contains('cut')).toBe(true);
		expect(cut.getAttribute('aria-label')).toBe('Stop 1 continues to Stop 2 by Cut');
		expect(cut.parentElement?.classList.contains('adjacent')).toBe(true);
		expect(cut.classList.contains('gap')).toBe(false);

		const travel = chipAfter(target, 'stop-4');
		expect(travel.textContent?.trim()).toBe('cut');
		expect(travel.parentElement?.classList.contains('adjacent')).toBe(true);
	});

	it('shows a jump as the destination Stop number and never as an adjacent connector', async () => {
		const homes = fakeHomes(fakeController());
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, homes);
		await settle();

		const jump = chipAfter(target, 'stop-3');
		expect(jump.textContent?.trim()).toBe('→ 5');
		expect(jump.classList.contains('jump')).toBe(true);
		expect(jump.getAttribute('aria-label')).toBe('Stop 3 continues to Stop 5 by Cut');
		expect(jump.parentElement?.classList.contains('adjacent')).toBe(false);
	});

	it('ends the row with End after the card that holds the last Stop', async () => {
		const homes = fakeHomes(fakeController());
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, homes);
		await settle();

		const end = chipAfter(target, 'stop-5');
		expect(end.textContent?.trim()).toBe('End');
		const row = target.querySelector('.row');
		expect(row?.lastElementChild).toBe(end.parentElement);
		expect(end.parentElement?.previousElementSibling?.getAttribute('data-stop-id')).toBe('stop-5');
	});

	it('marks a Travel with a gap as needing attention', async () => {
		const homes = fakeHomes(fakeController());
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, homes);
		await settle();

		const travel = chipAfter(target, 'stop-2');
		expect(travel.textContent?.trim()).toBe('travel');
		expect(travel.classList.contains('travel')).toBe(true);
		expect(travel.classList.contains('gap')).toBe(true);
		expect(travel.getAttribute('aria-label')).toContain('Travel has no Camera connection yet');
	});

	it('selects the transition when a chip is pressed and the Stop when its card is pressed', async () => {
		const homes = fakeHomes(fakeController());
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, homes);
		await settle();

		chipAfter(target, 'stop-1').click();
		expect(homes.select).toHaveBeenLastCalledWith({ kind: 'transition', stopId: 'stop-1' });

		target.querySelector<HTMLButtonElement>('.stop-card[data-stop-id="stop-3"]')!.click();
		expect(homes.select).toHaveBeenLastCalledWith({ kind: 'stop', stopId: 'stop-3' });
	});

	it('shows each Stop hold on its bar segment and disables Play with its reason and no time readout', async () => {
		const homes = fakeHomes(fakeController());
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, homes);
		await settle();

		const segments = [...target.querySelectorAll('.scrub .bar .seg')];
		expect(segments).toHaveLength(5);
		expect(segments[0]!.querySelector('.seg-hold')?.textContent).toBe('0.5s');
		for (const unset of segments.slice(1)) expect(unset.textContent?.trim()).toBe('');

		const play = buttonNamed(target, 'Play');
		expect(play.disabled).toBe(true);
		expect(play.title).toBe('Comes with Camera playback');
		expect(reasonOf(play)).toBe('Comes with Camera playback');

		const scrub = target.querySelector('.scrub')!;
		expect(scrub.textContent).not.toMatch(/\/|\d+:\d{2}/);
	});
});

describe('R217.S25 — the Guide adds a Stop from a Presentation', () => {
	it('keeps + Stop disabled until the new Guide is named, then adds the chosen Presentation with that name', async () => {
		const controller = fakeController({ guided: false });
		const homes = fakeHomes(controller);
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, homes);
		await settle();

		const add = buttonNamed(target, 'Stop');
		expect(add.disabled).toBe(true);
		expect(reasonOf(add)).toBe('Name the Guide first');

		typeInto(target.querySelector<HTMLInputElement>('input[aria-label="Guide name"]')!, 'Walk');
		await settle();
		expect(buttonNamed(target, 'Stop').disabled).toBe(false);

		buttonNamed(target, 'Stop').click();
		await settle();
		const gallery = [...target.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
			(item) => item.querySelector('.menu-label')?.textContent === 'Gallery'
		);
		expect(gallery).toBeDefined();
		gallery!.click();
		await settle();

		expect(controller.addStop).toHaveBeenCalledWith('gallery', { firstGuideLabel: 'Walk' });
	});
});

// ---- The Stop writer ----

describe('R217.S25 — the Stop writer shows the entry View, the other Views and where Next goes', () => {
	it('shows the entry View with the word Entry and its hold', async () => {
		const controller = fakeController({ selectedStopId: 'stop-1' });
		const target = mountHome(ExperienceStopWriter, {}, fakeHomes(controller));
		await settle();

		const entries = target.querySelectorAll('ol.shots > li.shot');
		expect(entries).toHaveLength(1);
		const entry = entries[0]!;
		expect(entry.querySelector('.tag')?.textContent).toBe('Entry');
		expect(entry.querySelector('.name-btn')?.textContent).toContain('Wide');
		expect(entry.querySelector('.stepper .value')?.textContent).toBe('0.5s');
	});

	it('dims the other Views of the Presentation with a working Include and guards the last guided View', async () => {
		const controller = fakeController({ selectedStopId: 'stop-1' });
		const target = mountHome(ExperienceStopWriter, {}, fakeHomes(controller));
		await settle();

		const others = target.querySelectorAll('.shot.is-out');
		expect(others).toHaveLength(1);
		expect(others[0]!.textContent).toContain('Keys');
		const include = others[0]!.querySelector<HTMLButtonElement>('button.include')!;
		expect(include.disabled).toBe(false);
		include.click();
		expect(controller.includeView).toHaveBeenCalledWith('stop-1', 'piano-keys');
		const leave = buttonNamed(target, 'Leave out Wide');
		expect(leave.disabled).toBe(true);
		expect(leave.title).toBe('A Stop shows at least one View');
	});

	it('sets the first hold to one second when the hold is unset and the Stop has none', async () => {
		const controller = fakeController({ selectedStopId: 'stop-2' });
		const homes = fakeHomes(controller);
		const target = mountHome(ExperienceStopWriter, {}, homes);
		await settle();

		expect(target.querySelector('.stepper .value')?.textContent).toBe('—');
		expect(buttonNamed(target, 'Shorter hold').disabled).toBe(true);
		expect(buttonNamed(target, 'Longer hold').disabled).toBe(false);

		buttonNamed(target, 'Longer hold').click();
		await settle();
		expect(controller.setViewHold).toHaveBeenCalledWith('stop-2', 'gallery-hall', 1);
	});

	it('offers no Cut or Travel control: the transition is reached through its own card', async () => {
		const controller = fakeController({ selectedStopId: 'stop-2' });
		const homes = fakeHomes(controller);
		const target = mountHome(ExperienceStopWriter, {}, homes);
		await settle();

		const choices = [...target.querySelectorAll('button, [role="menuitemradio"]')].map(nameOf);
		expect(choices).not.toContain('Cut');
		expect(choices).not.toContain('Travel');

		const nextChip = target.querySelector<HTMLButtonElement>('.after-next .stop-link')!;
		nextChip.click();
		await settle();
		const nextLabels = [...target.querySelectorAll('[role="menuitemradio"]')].map(nameOf);
		expect(nextLabels).toEqual(['Next in the Guide', 'Stop 1 · Piano', 'Stop 3 · Garden', 'Stop 4 · Piano', 'Stop 5 · Gallery', 'End']);

		const transition = target.querySelector<HTMLButtonElement>('.link-row')!;
		expect(nameOf(transition)).toBe('Travel · transition');
		transition.click();
		expect(homes.select).toHaveBeenLastCalledWith({ kind: 'transition', stopId: 'stop-2' });
	});

	it('names the next Stop in the continuation chip, and End on the last Stop', async () => {
		const first = mountHome(ExperienceStopWriter, {}, fakeHomes(fakeController({ selectedStopId: 'stop-1' })));
		await settle();
		const firstLink = first.querySelector('.after-next .stop-link')!;
		expect(firstLink.querySelector('.num')?.textContent?.trim()).toBe('2');
		expect(firstLink.querySelector('.stop-link-name')?.textContent?.trim()).toBe('Gallery');

		const last = mountHome(ExperienceStopWriter, {}, fakeHomes(fakeController({ selectedStopId: 'stop-5' })));
		await settle();
		expect(last.querySelector('.after-next .stop-link')?.textContent?.trim()).toBe('End');
		expect(last.querySelector('.link-row')).toBeNull();
		expect(last.textContent).toContain('The tour ends here');
	});
});

// ---- The Transition writer ----

describe('R217.S25 — the Transition writer is the one home of Cut and Travel (D6)', () => {
	it('chooses Cut and Travel through setTransition for the Stop the transition leaves', async () => {
		const controller = fakeController({ selectedStopId: 'stop-2' });
		const target = mountHome(ExperienceTransitionWriter, {}, fakeHomes(controller));
		await settle();

		const [cut, travel] = [...target.querySelectorAll<HTMLButtonElement>('.seg button')];
		expect(travel!.getAttribute('aria-pressed')).toBe('true');
		expect(cut!.getAttribute('aria-pressed')).toBe('false');

		cut!.click();
		await settle();
		expect(controller.setTransition).toHaveBeenLastCalledWith('stop-2', 'cut');

		const first = fakeController({ selectedStopId: 'stop-1' });
		const other = mountHome(ExperienceTransitionWriter, {}, fakeHomes(first));
		await settle();
		const [, travelOfFirst] = [...other.querySelectorAll<HTMLButtonElement>('.seg button')];
		travelOfFirst!.click();
		await settle();
		expect(first.setTransition).toHaveBeenLastCalledWith('stop-1', 'travel');
	});

	it('names the Travel gap in the author\'s words, with no ids, and the Camera placeholders as disabled', async () => {
		const target = mountHome(ExperienceTransitionWriter, {}, fakeHomes(fakeController({ selectedStopId: 'stop-2' })));
		await settle();

		const alert = target.querySelector('[role="alert"]')?.textContent ?? '';
		expect(alert).toContain('Travel needs a Camera connection from “Hall” to “Gate”');
		expect(alert).not.toContain('Gallery has no Camera path to Garden.');
		const ends = [...target.querySelectorAll('.ends .end small')].map((small) => small.textContent?.trim());
		expect(ends).toEqual(['leaves from', 'arrives at']);
		expect(target.querySelector('.ends .end:last-child .num')?.textContent).toBe('3');
		const path = target.querySelector('[aria-disabled="true"]')!;
		expect(path.textContent).toContain('Comes with path editing');
		expect(buttonNamed(target, /^Preview this move/).disabled).toBe(true);
	});

	it('disables Cut and Travel at the End with the reason The tour ends here', async () => {
		const controller = fakeController({ selectedStopId: 'stop-5' });
		const target = mountHome(ExperienceTransitionWriter, {}, fakeHomes(controller));
		await settle();

		const segments = [...target.querySelectorAll<HTMLButtonElement>('.seg button')];
		expect(segments).toHaveLength(2);
		for (const segment of segments) {
			expect(segment.disabled).toBe(true);
			expect(segment.textContent).toContain('The tour ends here');
		}
		expect(target.textContent).toContain('End of tour');
	});
});

// ---- The View writer ----

describe('R217.S25 — the View writer holds the only Default mutation (D12)', () => {
	it('makes a View the Default through setDefaultView', async () => {
		const controller = fakeController({ selectedViewId: 'piano-keys' });
		const target = mountHome(ExperienceViewWriter, {}, fakeHomes(controller));
		await settle();

		buttonNamed(target, 'Make default').click();
		await settle();
		expect(controller.setDefaultView).toHaveBeenCalledWith('piano', 'piano-keys');
	});

	it('disables Make default while a change is saving', async () => {
		const target = mountHome(ExperienceViewWriter, {}, fakeHomes(fakeController({ selectedViewId: 'piano-keys', busy: true })));
		await settle();

		const makeDefault = buttonNamed(target, 'Make default');
		expect(makeDefault.disabled).toBe(true);
		expect(reasonOf(makeDefault)).toBe('Wait for the current change');
	});

	it('opens Look through on this View and shows the Default as information', async () => {
		const homes = fakeHomes(fakeController({ selectedViewId: 'piano-wide' }));
		const target = mountHome(ExperienceViewWriter, {}, homes);
		await settle();

		const lookThrough = buttonNamed(target, 'Look through');
		expect(lookThrough.disabled).toBe(false);
		lookThrough.click();
		expect(homes.lookThrough).toHaveBeenCalledWith('piano-wide');
		expect(target.querySelector('.default-note')?.textContent).toContain('Default View');
		expect(target.querySelectorAll('.cfoot button').length).toBe(1);
	});

	it('applies Lens and Eye height live while looking through, without writing authored framing', async () => {
		const close = LENS_STEPS[2]!;
		const seated = EYE_HEIGHT_STEPS[0]!;
		const controller = fakeController({ selectedViewId: 'piano-wide' });
		const homes = fakeHomes(controller, false, {
			viewId: 'piano-wide',
			fovYDegrees: close.fovYDegrees,
			eyeHeightMetres: seated.metres,
			moved: true
		});
		const target = mountHome(ExperienceViewWriter, {}, homes);
		await settle();

		expect(target.textContent).toContain('Close');
		expect(target.textContent).toContain('Seated');
		buttonNamed(target, 'Close').click();
		await settle();
		expect(homes.lookThroughLens).toHaveBeenCalledWith(close.fovYDegrees);
		buttonNamed(target, 'Seated').click();
		await settle();
		expect(homes.lookThroughEyeHeight).toHaveBeenCalledWith(seated.metres);
	});

	it('lists the Stops that enter at this View, or says it is not on the tour', async () => {
		const onTour = mountHome(ExperienceViewWriter, {}, fakeHomes(fakeController({ selectedViewId: 'piano-wide' })));
		await settle();
		expect(onTour.querySelector('.entries')?.textContent).toContain('Stop 1 · entry');

		const offTour = mountHome(ExperienceViewWriter, {}, fakeHomes(fakeController({ selectedViewId: 'piano-keys' })));
		await settle();
		expect(offTour.querySelector('[aria-label="Where visitors see it"]')?.textContent).toContain('Not in any Stop');
	});
});

// ---- The Presentation writer ----

describe('R217.S25 — the Presentation writer has no Default control and no Save or Capture (D12)', () => {
	it('shows the Views as tiles that select a View, with the Default as information only', async () => {
		const controller = fakeController({ selectedPresentationId: 'piano' });
		const homes = fakeHomes(controller);
		const target = mountHome(ExperiencePresentationWriter, {}, homes);
		await settle();

		const tiles = [...target.querySelectorAll<HTMLButtonElement>('[data-view-tile]')];
		expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual([
			'Wide, Default View, on the tour',
			'Keys, not on the tour'
		]);
		expect(tiles[0]!.querySelector('.badge-def')?.textContent).toBe('◆ Default');
		expect(tiles[1]!.querySelector('.badge-def')).toBeNull();

		tiles[1]!.click();
		expect(homes.select).toHaveBeenLastCalledWith({ kind: 'view', viewId: 'piano-keys', presentationId: 'piano' });

		tiles[1]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
		expect(homes.lookThrough).toHaveBeenCalledWith('piano-keys');
	});

	it('offers no Default, Save or Capture control', async () => {
		const target = mountHome(ExperiencePresentationWriter, {}, fakeHomes(fakeController({ selectedPresentationId: 'piano' })));
		await settle();

		const controls = [...target.querySelectorAll<HTMLButtonElement>('button')].filter(
			(button) => !button.hasAttribute('data-view-tile')
		);
		for (const control of controls) {
			expect(nameOf(control)).not.toMatch(/default|save|capture|make/i);
		}
		expect(target.querySelector('.reach-row')?.textContent).toContain('On the tour at');
		expect(target.querySelectorAll('.reach-row .chip').length).toBe(2);
		expect(controls.map(nameOf)).toContain('Add to Guide');
	});
});

// ---- The Stage’s Experience View marks ----

describe('R217.S28 — View marks open Look through', () => {
	it('selects a marker on one click and opens Look through on a double-click', async () => {
		const homes = fakeHomes(fakeController({ selectedPresentationId: 'piano' }));
		const state = createViewportCameraState({
			outputId: 'marks',
			sessionEpoch: 'marks',
			sourceRevision: 'marks',
			pose: { target: [0, 1, 0], azimuthRadians: 0, elevationRadians: Math.PI / 2, targetPlaneHeightMeters: 12 },
			sceneRadiusMeters: 50,
			reading: 'plan'
		});
		const evaluated = evaluateViewport(state, { left: 0, top: 0, width: 1280, height: 800, devicePixelRatio: 1 }, 0, 1);
		if (evaluated.kind !== 'evaluated') throw new Error(evaluated.reason);
		const target = mountHome(ExperienceMarks, { evaluation: evaluated.evaluation, onLookThrough: homes.lookThrough }, homes);
		await settle();

		const mark = target.querySelector<SVGGElement>('[data-view-mark]');
		if (mark === null) throw new Error('no View mark rendered');
		const viewId = mark.getAttribute('data-view-mark')!;
		const hit = mark.querySelector<SVGCircleElement>('.hit')!;
		hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(homes.select).toHaveBeenCalledWith({ kind: 'view', viewId, presentationId: 'piano' });
		hit.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
		expect(homes.lookThrough).toHaveBeenCalledWith(viewId);
	});
});

// ---- The lower-edge dock ----

describe('R217.S25 — the Experience dock (Path is the one disabled key)', () => {
	it('arms Place a View as a Stage tool and calls its handler', async () => {
		const onPlaceView = vi.fn();
		const target = mountPlain(ExperienceDock, { onCapture: vi.fn(), onToggleGuide: vi.fn(), onPlaceView });
		await settle();

		const place = target.querySelector<HTMLButtonElement>('[data-dock-tool="place-view"]')!;
		expect(place.disabled).toBe(false);
		expect(place.title).toBe('Place a View where the camera stands');
		expect(place.getAttribute('aria-describedby')).toBeNull();
		place.click();
		expect(onPlaceView).toHaveBeenCalledTimes(1);
	});

	it('shows Path only while the Guide is open, and disables it with its reason', async () => {
		const closed = mountPlain(ExperienceDock, { onCapture: vi.fn(), onToggleGuide: vi.fn(), guideOpen: false });
		await settle();
		expect(closed.querySelector('[data-dock-tool="path"]')).toBeNull();

		const open = mountPlain(ExperienceDock, { onCapture: vi.fn(), onToggleGuide: vi.fn(), guideOpen: true });
		await settle();
		const path = open.querySelector<HTMLButtonElement>('[data-dock-tool="path"]')!;
		expect(path.disabled).toBe(true);
		expect(path.title).toBe('Comes with path editing');
		expect(reasonOf(path)).toBe('Comes with path editing');
	});

	it('passes Capture and Guide presses to their handlers', async () => {
		const onCapture = vi.fn();
		const onToggleGuide = vi.fn();
		const target = mountPlain(ExperienceDock, { onCapture, onToggleGuide });
		await settle();

		target.querySelector<HTMLButtonElement>('[data-dock-tool="capture"]')!.click();
		target.querySelector<HTMLButtonElement>('[data-dock-tool="guide"]')!.click();
		expect(onCapture).toHaveBeenCalledTimes(1);
		expect(onToggleGuide).toHaveBeenCalledTimes(1);
	});
});

// ---- R217.S26: structure in the homes ----

describe('R217.S26 — the Guide shows where the tour starts (E6)', () => {
	it('tags only the start Stop with Start, and says so to assistive technology', async () => {
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, fakeHomes(fakeController()));
		await settle();
		const tagged = [...target.querySelectorAll('.stop-card')].filter((card) => card.querySelector('[data-start-tag]') !== null);
		expect(tagged.map((card) => card.getAttribute('data-stop-id'))).toEqual(['stop-1']);
		expect(tagged[0]!.getAttribute('aria-label')).toContain('the tour starts here');
	});
});

describe('R217.S26 — the Guide Card sets the Opening Guide (E5)', () => {
	it('shows *opens* on the Opening Guide and offers Make this the opening Guide on another', async () => {
		const opening = fakeController({ subject: { kind: 'guide', guideId: 'guide-1' } });
		const first = mountHome(ExperienceGuideWriter, {}, fakeHomes(opening));
		await settle();
		expect(first.querySelector('[data-opening-guide]')?.textContent).toBe('opens');
		expect(first.querySelector('[data-make-opening]')).toBeNull();

		const other = fakeController({ subject: { kind: 'guide', guideId: 'guide-1' } });
		(other as { current: Experience }).current = { ...EXPERIENCE, entryGuideId: 'guide-elsewhere' };
		const second = mountHome(ExperienceGuideWriter, {}, fakeHomes(other));
		await settle();
		const make = second.querySelector<HTMLButtonElement>('[data-make-opening]')!;
		expect(make.textContent?.trim()).toBe('Make this the opening Guide');
		make.click();
		expect(other.makeOpeningGuide).toHaveBeenCalledWith('guide-1');
	});
});

describe('R217.S26 — the View Card says where else a shared View is used', () => {
	it('lists *Also in* with a link to each other Presentation', async () => {
		const controller = fakeController({ selectedViewId: 'piano-keys', subject: { kind: 'view', viewId: 'piano-keys', presentationId: 'piano' } });
		(controller as { alsoIn: (viewId: string, presentationId: string) => readonly ExperiencePresentation[] }).alsoIn = () => [PRESENTATIONS[2]!];
		const homes = fakeHomes(controller);
		const target = mountHome(ExperienceViewWriter, {}, homes);
		await settle();
		const line = target.querySelector('[data-view-also-in]')!;
		expect(line.textContent?.replace(/\s+/g, ' ').trim()).toBe('Also in Garden');
		buttonNamed(line, 'Garden').click();
		expect(homes.select).toHaveBeenLastCalledWith({ kind: 'presentation', presentationId: 'garden' });
	});

	it('shows no *Also in* for a View only one Presentation lists', async () => {
		const target = mountHome(ExperienceViewWriter, {}, fakeHomes(fakeController({ selectedViewId: 'piano-keys' })));
		await settle();
		expect(target.querySelector('[data-view-also-in]')).toBeNull();
	});
});

describe('R217.S26 — View order in the Presentation Card', () => {
	function denseController() {
		const controller = fakeController({ selectedPresentationId: 'piano' });
		const views = Array.from({ length: 13 }, (_, index) => ({ id: `piano-${index}`, label: index === 0 ? 'Keys' : `Angle ${index}` }));
		(controller as { viewsOf: Map<string, readonly { id: string; label: string }[]> }).viewsOf = new Map([['piano', views]]);
		return controller;
	}

	it('moves a focused tile with Alt ←/→ and claims the key from Back', async () => {
		const controller = fakeController({ selectedPresentationId: 'piano' });
		const target = mountHome(ExperiencePresentationWriter, {}, fakeHomes(controller));
		await settle();
		const tile = target.querySelector<HTMLButtonElement>('[data-view-tile="piano-wide"]')!;
		expect(tile.draggable).toBe(true);
		const event = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true });
		tile.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		expect(controller.moveView).toHaveBeenCalledWith('piano', 'piano-wide', 1);
	});

	it('refuses to reorder while the filter is on and says how to reorder', async () => {
		const controller = denseController();
		const target = mountHome(ExperiencePresentationWriter, {}, fakeHomes(controller));
		await settle();
		expect(target.querySelector('[data-reorder-refused]')).toBeNull();
		const filter = target.querySelector<HTMLInputElement>('input[aria-label="Filter Views"]')!;
		filter.value = 'angle';
		filter.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		expect(target.querySelector('[data-reorder-refused]')?.textContent).toBe('12 shown · clear the filter to reorder');
		const tile = target.querySelector<HTMLButtonElement>('[data-view-tile="piano-1"]')!;
		expect(tile.draggable).toBe(false);
		tile.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true }));
		expect(controller.moveView).not.toHaveBeenCalled();
	});
});

describe('R217.S26 — New Guide… asks the name inline beside existing Guides (E5)', () => {
	it('creates a new Guide through createGuide, not the first-Guide path', async () => {
		const controller = fakeController({ selectedPresentationId: 'gallery' });
		const homes = { ...fakeHomes(controller), guideNamePrompt: () => 'gallery' };
		const target = mountHome(ExperiencePresentationWriter, {}, homes);
		await settle();
		const input = target.querySelector<HTMLInputElement>('input[aria-label="Guide name"]')!;
		const create = buttonNamed(target, 'Create Guide');
		expect(create.disabled).toBe(true);
		expect(reasonOf(create)).toBe('A name is needed');
		input.value = 'Short tour';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		create.click();
		await settle();
		expect(controller.createGuide).toHaveBeenCalledWith('gallery', 'Short tour');
		expect(controller.addStop).not.toHaveBeenCalled();
	});
});

describe('R217.S27 guided shots and reach', () => {
	it('shows the entry independently of the Default, with per-View holds and Alt reorder', async () => {
		const controller = fakeController({
			selectedStopId: 'stop-1',
			guidedViews: [{ viewId: 'piano-keys' }, { viewId: 'piano-wide' }]
		});
		const target = mountHome(ExperienceStopWriter, {}, fakeHomes(controller));
		await settle();
		const shots = [...target.querySelectorAll('[data-guided-view]')];
		expect(shots.map((shot) => shot.querySelector('.shot-n')?.textContent)).toEqual(['1', '2']);
		expect(shots.map((shot) => shot.querySelector('.value')?.textContent?.trim())).toEqual(['3s', '—']);
		expect(shots[0]?.querySelector('.tag')?.textContent).toBe('Entry');
		expect(shots[1]?.querySelector('[aria-label="Default View"]')).not.toBeNull();

		const reorder = new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true });
		shots[1]!.querySelector('.name-btn')!.dispatchEvent(reorder);
		expect(reorder.defaultPrevented).toBe(true);
		expect(controller.moveGuidedView).toHaveBeenCalledWith('stop-1', 'piano-wide', -1);

		const transfer = { setData: vi.fn(), effectAllowed: '' };
		const start = new Event('dragstart', { bubbles: true, cancelable: true });
		Object.defineProperty(start, 'dataTransfer', { value: transfer });
		shots[1]!.querySelector('.grip')!.dispatchEvent(start);
		shots[0]!.dispatchEvent(new MouseEvent('dragover', { clientY: 0, bubbles: true, cancelable: true }));
		await settle();
		expect(shots[0]?.classList.contains('drop-before')).toBe(true);
		shots[0]!.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
		expect(controller.moveGuidedViewTo).toHaveBeenCalledWith('stop-1', 'piano-wide', 0);

		buttonNamed(target, 'Leave out Keys').click();
		expect(controller.leaveOutView).toHaveBeenCalledWith('stop-1', 'piano-keys');
	});

	it('switches free exploration off through the Presentation edit', async () => {
		const controller = fakeController({ selectedPresentationId: 'piano' });
		const target = mountHome(ExperiencePresentationWriter, {}, fakeHomes(controller));
		await settle();
		const toggle = target.querySelector<HTMLButtonElement>('[role="switch"]')!;
		expect(toggle.getAttribute('aria-checked')).toBe('true');
		expect(target.querySelector('#explorable-description')?.textContent).toContain('All 2 Views; opens at the Default');
		toggle.click();
		expect(controller.setExplorable).toHaveBeenCalledWith('piano', false);
	});
});
