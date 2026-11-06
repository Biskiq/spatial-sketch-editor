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
import ExperienceExperienceWriter from '$lib/authoring/experience/ExperienceExperienceWriter.svelte';
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
	ExperiencePathOccurrence,
	ExperiencePathRead
} from '$lib/authoring/experience/experience-paths';
import type {
	CameraView,
	Experience,
	ExperienceGuide as GuideRecord,
	ExperiencePresentation,
	ExperienceStop
} from '@portfolio/project-model/units';
import { createViewportCameraState, evaluateViewport } from '@portfolio/camera-core';

import ExperienceHomesProbe from './fixtures/ExperienceHomesProbe.svelte';
import { createExperiencePlayback } from '$lib/authoring/experience/playback.svelte';

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
	{ id: 'piano', label: 'Piano', views: [{ viewId: 'piano-wide' }, { viewId: 'piano-keys' }], explorable: true, subject: null, text: null },
	{ id: 'gallery', label: 'Gallery', views: [{ viewId: 'gallery-hall' }], explorable: true, subject: null, text: null },
	{ id: 'garden', label: 'Garden', views: [{ viewId: 'garden-gate' }, { viewId: 'garden-bench' }], explorable: true, subject: null, text: null }
];

const STOPS: readonly ExperienceStop[] = [
	{ id: 'stop-1', presentationId: 'piano', entryViewId: null, staySeconds: 5, invitation: null, transition: 'cut' },
	{ id: 'stop-2', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'gallery', transition: 'travel' },
	{ id: 'stop-3', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'garden', transition: 'cut' },
	{ id: 'stop-4', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'piano', transition: 'cut' },
	{ id: 'stop-5', entryViewId: null, staySeconds: 5, invitation: null, presentationId: 'gallery', transition: 'cut' }
];

const GUIDE: GuideRecord = {
	id: 'guide-1',
	label: 'Main',
	stopIds: ['stop-1', 'stop-2', 'stop-3', 'stop-4', 'stop-5'],
	pacing: 'automatic' as const
};

const EXPERIENCE: Experience = {
	id: 'experience-1',
	label: 'Walk',
	welcome: null,
	entryGuideId: 'guide-1',
	presentations: PRESENTATIONS,
	stops: STOPS,
	guides: [GUIDE],
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
		presentation.views.map(({ viewId: id }) => ({ id, label: VIEW_LABELS[id] ?? id }))
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
	selectedViewId?: string;
	selectedPresentationId?: string;
	selectedPath?: ExperiencePathRead | null;
	pathOccurrence?: ExperiencePathOccurrence | null;
};

function fakeController(options: ControllerOptions = {}) {
	const guide = options.guided === false ? null : GUIDE;
	const stops = guideStopsOf(EXPERIENCE, guide);
	const stop = STOPS.find((stop) => stop.id === options.selectedStopId) ?? null;
	const selectedStop = stop;
	const selectedPresentation =
		PRESENTATIONS.find((presentation) => presentation.id === options.selectedPresentationId ||
			(options.selectedViewId !== undefined && presentation.views.some((view) => view.viewId === options.selectedViewId))) ?? null;
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
		pathOccurrence: options.pathOccurrence ?? null,
		selectedPath: options.selectedPath ?? null,
		selectedAnchorId: null,
		pathFor: vi.fn(() => options.selectedPath ?? null),
		selectPath: vi.fn(),
		selectAnchor: vi.fn(),
		createPath: vi.fn(async () => true),
		addPathAnchor: vi.fn(async () => true),
		movePathAnchor: vi.fn(async () => true),
		removePathAnchor: vi.fn(async () => true),
		straightenPath: vi.fn(async () => true),
		setPathDuration: vi.fn(async () => true),
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
		setGuidePacing: vi.fn(async (_guideId: string, _pacing: 'automatic' | 'manual') => true),
		setStopEntry: vi.fn(async (_stopId: string, _viewId: string | null) => true),
		setStopStay: vi.fn(async (_stopId: string, _seconds: number) => true),
		setStopInvitation: vi.fn(async (_stopId: string, _invitation: { readonly prompt: string | null } | null) => true),
		setPresentationStep: vi.fn(async (_presentationId: string, _toIndex: number, _kind: 'cut' | 'travel', _throughIndex?: number) => true),
		movePresentationView: vi.fn(async (_presentationId: string, _viewId: string, _index: number) => true),
		setExplorable: vi.fn(async (_presentationId: string, _explorable: boolean) => true),
		setWelcome: vi.fn(async (_body: string) => true),
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
			PRESENTATIONS.filter((presentation) => presentation.id !== presentationId && presentation.views.some((view) => view.viewId === viewId)),
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

function fakeHomes(
	controller: FakeController | null,
	guideOpen = false,
	through: ThroughOptions = {},
	transport: { readonly seconds?: number | null; readonly guideId?: string | null } = {}
) {
	return {
		controller: () => controller as unknown as ExperienceController | null,
		guideOpen: () => guideOpen,
		setGuideOpen: vi.fn<(open: boolean) => void>(),
		select: vi.fn<(subject: ExperienceSubject | null) => void>(),
		sceneSubject: () => null,
		openInWorld: vi.fn(),
		pickStageSubject: vi.fn(() => true),
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
		presentThis: vi.fn(async () => {}),
		playback: () => null,
		previewMode: vi.fn<(mode: 'guided' | 'free', guideId: string | null) => void>(),
		guideSeconds: () => transport.seconds ?? null,
		guideForStop: () => transport.guideId ?? null,
		playGuide: vi.fn()
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
	// The Guide reads the Stage-owned playback host as a prop; this harness has no
	// Stage, so mount it with an idle host (its controls stay honestly disabled).
	const withHost = home === ExperienceGuide
		? { playback: createExperiencePlayback(() => null), ...homeProps }
		: homeProps;
	const component = mount(ExperienceHomesProbe, {
		target,
		props: { homes: homes as unknown as ExperienceHomes, home, homeProps: withHost }
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
		// An adjacent link is drawn as its glyph; its name is the accessible label.
		expect(cut.querySelector('svg.glyph')).not.toBeNull();
		expect(cut.classList.contains('cut')).toBe(true);
		expect(cut.getAttribute('aria-label')).toBe('Stop 1 continues to Stop 2 by Cut');
		expect(cut.parentElement?.classList.contains('adjacent')).toBe(true);
		expect(cut.classList.contains('gap')).toBe(false);

		const travel = chipAfter(target, 'stop-4');
		expect(travel.querySelector('svg.glyph')).not.toBeNull();
		expect(travel.parentElement?.classList.contains('adjacent')).toBe(true);
	});

	it('draws every step as an adjacent connector, never a jump chip', async () => {
		const homes = fakeHomes(fakeController());
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, homes);
		await settle();

		const next = chipAfter(target, 'stop-3');
		expect(next.textContent?.trim()).toBe('');
		expect(next.classList.contains('jump')).toBe(false);
		expect(next.getAttribute('aria-label')).toBe('Stop 3 continues to Stop 4 by Cut');
		expect(next.parentElement?.classList.contains('adjacent')).toBe(true);
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
		expect(travel.textContent?.trim()).toBe('⚠');
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

	it('renders the time timeline and disables Play when no lowered Guide can play', async () => {
		const homes = fakeHomes(fakeController());
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, homes);
		await settle();

		// S30 supersedes the ordinal bar: the track is time-scaled, so a fake
		// controller without a lowered program has no timed segments to draw.
		expect(target.querySelector('.track-hit') !== null).toBe(true);
		expect(target.querySelector('.scrub')).toBeNull();
		expect(target.querySelector('[data-playback-total]')?.textContent ?? '').toMatch(/\d+:\d{2}\s*\/\s*\d+:\d{2}/);

		const play = buttonNamed(target, 'Play');
		expect(play.disabled).toBe(true);
		expect(play.title).toBe('There is no Guide to play');
		expect(reasonOf(play)).toBe('There is no Guide to play');
	});
});

describe('R217.S25 — the Guide adds a Stop from a Presentation', () => {
	it('renames in place from the Guide actions menu and keeps Escape as a cancel', async () => {
		const controller = fakeController();
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, fakeHomes(controller));
		await settle();

		buttonNamed(target, 'Guide actions').click();
		await settle();
		const rename = [...target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
			(item) => item.textContent?.trim() === 'Rename'
		)!;
		rename.click();
		await settle();
		const input = target.querySelector<HTMLInputElement>('input[aria-label="Guide name"]')!;
		expect(input.value).toBe('Main');

		input.value = 'Walkthrough';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await settle();
		expect(controller.renameGuide).toHaveBeenCalledWith('guide-1', 'Walkthrough');

		buttonNamed(target, 'Guide actions').click();
		await settle();
		[...target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
			.find((item) => item.textContent?.trim() === 'Rename')!
			.click();
		await settle();
		const again = target.querySelector<HTMLInputElement>('input[aria-label="Guide name"]')!;
		again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();
		expect(controller.renameGuide).toHaveBeenCalledTimes(1);
		expect(target.querySelector('input[aria-label="Guide name"]')).toBeNull();
	});

	it('edits pacing from the strip popover and closes it on choice', async () => {
		const controller = fakeController();
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, fakeHomes(controller));
		await settle();

		const pill = target.querySelector<HTMLButtonElement>('[data-pacing-label]')!;
		expect(pill.getAttribute('aria-expanded')).toBe('false');
		pill.click();
		await settle();
		const manual = [...target.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')].find((item) =>
			item.textContent?.includes('Manual')
		)!;
		manual.click();
		await settle();
		expect(controller.setGuidePacing).toHaveBeenCalledWith('guide-1', 'manual');
		expect(target.querySelector('[aria-label="Pacing"]')).toBeNull();
	});

	it('adds the chosen Presentation as the first Stop with no naming prompt (D-9)', async () => {
		const controller = fakeController({ guided: false });
		const homes = fakeHomes(controller);
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, homes);
		await settle();

		expect(target.querySelector('input[aria-label="Guide name"]')).toBeNull();
		const add = buttonNamed(target, 'Stop');
		expect(add.disabled).toBe(false);
		add.click();
		await settle();
		const gallery = [...target.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
			(item) => item.querySelector('.menu-label')?.textContent === 'Gallery'
		);
		expect(gallery).toBeDefined();
		gallery!.click();
		await settle();

		expect(controller.addStop).toHaveBeenCalledWith('gallery', { entryViewId: null });
	});
});

// ---- The Stop writer ----


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
		expect(ends).toEqual(['Leaves', 'Arrives']);
		expect(target.querySelector('.ends .end:last-child .num')?.textContent).toBe('3');
		expect(target.textContent).toContain('Add a Camera path');
		expect(buttonNamed(target, /^Add Camera path$/).disabled).toBe(false);
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

	it('offers no Cut or Travel switch when both Stops enter the same View (D-7)', async () => {
		const same = {
			...EXPERIENCE,
			stops: STOPS.map((stop) =>
				stop.id === 'stop-2'
					? { ...stop, transition: 'cut' as const }
					: stop.id === 'stop-3'
						? { ...stop, presentationId: 'gallery', entryViewId: 'gallery-hall' }
						: stop
			)
		};
		const controller = fakeController({ selectedStopId: 'stop-2' });
		Object.assign(controller, {
			current: same,
			guideStops: guideStopsOf(same, GUIDE),
			resolveContinuation: (stopId: string) => resolveContinuation(same, GUIDE, stopId)
		});
		const target = mountHome(ExperienceTransitionWriter, {}, fakeHomes(controller));
		await settle();

		expect(target.querySelector('.seg')).toBeNull();
		expect(target.textContent).toContain('Both Stops show Hall');
		expect(target.textContent).not.toContain('Travel');
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

});

// ---- The Presentation writer ----


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

describe('R217.S25 — the Experience dock', () => {
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

	it('keeps path editing on the Stage while the Guide is open', async () => {
		const dock = mountPlain(ExperienceDock, { onCapture: vi.fn(), onToggleGuide: vi.fn(), guideOpen: true });
		await settle();
		expect(dock.querySelector('[data-dock-tool="path"]')).toBeNull();
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

describe('R217.S26 / G17 — the strip has no Start tag or duplicated time', () => {
	it('leaves Stop 1 unmarked and keeps the card free of its own time', async () => {
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, fakeHomes(fakeController()));
		await settle();
		expect(target.querySelector('[data-start-tag]')).toBeNull();
		expect(target.querySelector('[data-stop-time]')).toBeNull();
		const first = target.querySelector('.stop-card[data-stop-id="stop-1"]')!;
		expect(first.getAttribute('aria-label')).not.toContain('starts here');
		expect(first.querySelector('.stop-time')).toBeNull();
	});
});

describe('R217.S33/R36 — the Experience Card owns welcome and Opens with', () => {
	it('edits welcome text and hides Opens with while one Guide exists', async () => {
		const controller = fakeController({ subject: { kind: 'experience' } });
		const target = mountHome(ExperienceExperienceWriter, {}, fakeHomes(controller));
		await settle();
		expect(target.querySelector('[data-opens-with]')).toBeNull();
		const welcome = target.querySelector<HTMLTextAreaElement>('textarea')!;
		expect(welcome.maxLength).toBe(600);
		welcome.value = 'Welcome to the gallery.';
		welcome.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		welcome.dispatchEvent(new FocusEvent('blur'));
		await vi.waitFor(() => expect(controller.setWelcome).toHaveBeenCalledWith('Welcome to the gallery.'));
	});

	it('offers Opens with only when two Guides exist, and sets the opening one', async () => {
		const controller = fakeController({ subject: { kind: 'experience' } });
		(controller as { guides: GuideRecord[] }).guides = [GUIDE, { ...GUIDE, id: 'guide-2', label: 'Evening', stopIds: [] }];
		const target = mountHome(ExperienceExperienceWriter, {}, fakeHomes(controller));
		await settle();
		const options = [...target.querySelectorAll<HTMLElement>('[data-opening-guide-option]')];
		expect(options.map((option) => option.dataset.openingGuideOption)).toEqual(['guide-1', 'guide-2']);
		expect(options[0]!.getAttribute('aria-checked')).toBe('true');
		options[1]!.click();
		expect(controller.makeOpeningGuide).toHaveBeenCalledWith('guide-2');
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


describe('R217.S36 / G23 — a View dropped on the strip becomes a Stop entering it', () => {
	it('passes the dragged View as the first Stop\u2019s entry', async () => {
		const controller = fakeController({ guided: false });
		const target = mountHome(ExperienceGuide, { onClose: () => {} }, fakeHomes(controller));
		await settle();
		const empty = target.querySelector<HTMLElement>('.empty')!;
		const data = {
			types: ['application/x-biskiq-presentation-view'],
			getData: (type: string) =>
				type === 'application/x-biskiq-presentation-view'
					? JSON.stringify({ viewId: 'piano-keys', presentationId: 'piano' })
					: ''
		};
		for (const type of ['dragover', 'drop']) {
			const event = new Event(type, { bubbles: true, cancelable: true });
			Object.defineProperty(event, 'dataTransfer', { value: data });
			empty.dispatchEvent(event);
		}
		await settle();
		expect(controller.addStop).toHaveBeenCalledWith('piano', { entryViewId: 'piano-keys' });
	});
});

describe('R217.S36 — Add to Guide creates the first Tour with no prompt (D-9)', () => {
	it('adds the Presentation as a Stop; the controller names the first Guide Tour', async () => {
		const controller = fakeController({ selectedPresentationId: 'gallery' });
		const target = mountHome(ExperiencePresentationWriter, {}, fakeHomes(controller));
		await settle();
		expect(target.querySelector('input[aria-label="Guide name"]')).toBeNull();
		buttonNamed(target, 'Add to Guide').click();
		await settle();
		expect(controller.addStop).toHaveBeenCalledWith('gallery');
	});
});

describe('R217.S37 — link a Presentation from the Stage', () => {
	it('arms one Stage pick from About instead of a select', async () => {
		const controller = fakeController({ selectedPresentationId: 'piano', subject: { kind: 'presentation', presentationId: 'piano' } });
		const homes = fakeHomes(controller);
		const target = mountHome(ExperiencePresentationWriter, {}, homes);
		await settle();
		expect(target.querySelector('select[aria-label="Stage object"]')).toBeNull();
		buttonNamed(target, 'Pick on the Stage').click();
		expect(homes.pickStageSubject).toHaveBeenCalledWith('piano');
	});
});



describe('Sheet §32 — the Stop Card holds only this visit', () => {
	it('edits Enter at, Stay and Invite to explore, and links its Connections to their Transition Cards', async () => {
		const controller = fakeController({ selectedStopId: 'stop-2', subject: { kind: 'stop', stopId: 'stop-2' } });
		const homes = fakeHomes(controller);
		const target = mountHome(ExperienceStopWriter, {}, homes);
		await settle();

		const entries = [...target.querySelectorAll<HTMLButtonElement>('[role="radio"][data-entry-view]')];
		expect(entries.map((entry) => entry.getAttribute('aria-checked'))).toEqual(['true']);
		expect(entries[0]!.textContent).toContain('Default');
		expect(target.querySelector('[data-stay="seconds"]')?.textContent).toBe('5 s');
		buttonNamed(target, 'Longer stay').click();
		expect(controller.setStopStay).toHaveBeenCalledWith('stop-2', 6);
		const invite = target.querySelector<HTMLButtonElement>('button[role="switch"]')!;
		expect(invite.getAttribute('aria-checked')).toBe('false');
		invite.click();
		expect(controller.setStopInvitation).toHaveBeenCalledWith('stop-2', { prompt: null });
		expect(target.textContent).toContain('Visitors can always press Explore');

		// No Arrive switch, time stepper or After this Stop editor (§32).
		expect(target.textContent).not.toContain('After this Stop');
		expect(target.querySelector('.step-kind')).toBeNull();
		const incoming = target.querySelector<HTMLButtonElement>('[data-connection="in"]')!;
		expect(incoming.textContent).toContain('Cut');
		incoming.click();
		expect(homes.select).toHaveBeenCalledWith({ kind: 'transition', stopId: 'stop-1' });
		const outgoing = target.querySelector<HTMLButtonElement>('[data-connection="out"]')!;
		expect(outgoing.textContent).toContain('Travel');
		outgoing.click();
		expect(homes.select).toHaveBeenCalledWith({ kind: 'transition', stopId: 'stop-2' });
	});

	it('picks another entry View, and reads Until Next in Manual with a link to the Guide Card', async () => {
		const controller = fakeController({ selectedStopId: 'stop-1' });
		(controller as { contextGuide: unknown }).contextGuide = { ...GUIDE, pacing: 'manual' };
		const homes = fakeHomes(controller);
		const target = mountHome(ExperienceStopWriter, {}, homes);
		await settle();
		target.querySelector<HTMLButtonElement>('[data-entry-view="piano-keys"]')!.click();
		expect(controller.setStopEntry).toHaveBeenCalledWith('stop-1', 'piano-keys');
		const untilNext = target.querySelector<HTMLButtonElement>('[data-stay="until-next"]')!;
		expect(untilNext.textContent).toContain('Until Next');
		expect(target.querySelector('[data-stay="seconds"]')).toBeNull();
	});
});

describe('Sheet §32 — the Presentation Card View list is the rail', () => {
	it('numbers the Views, marks View 1 the Default and switches a connection on the spine with one press', async () => {
		const controller = fakeController({ selectedPresentationId: 'piano', subject: { kind: 'presentation', presentationId: 'piano' } });
		const target = mountHome(ExperiencePresentationWriter, {}, fakeHomes(controller));
		await settle();
		const rows = [...target.querySelectorAll('[data-view-rail] li.row')];
		expect(rows).toHaveLength(2);
		expect(rows[0]!.textContent).toContain('Default · opens here');
		expect(rows[0]!.textContent).toContain('1');
		buttonNamed(target, 'Cut: switch to Travel').click();
		expect(controller.setPresentationStep).toHaveBeenCalledWith('piano', 1, 'travel');
		const keys = target.querySelector<HTMLButtonElement>('[data-rail-view="piano-keys"]')!;
		keys.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
		expect(controller.movePresentationView).toHaveBeenCalledWith('piano', 'piano-keys', 0);
		expect(target.textContent).toContain('Listed in Places');
	});

	it('reads each step from the View it leaves, not the View it arrives at (A-1)', async () => {
		const steps: ExperiencePresentation = {
			id: 'steps',
			label: 'Steps',
			views: [{ viewId: 'step-a' }, { viewId: 'step-b', transition: 'travel' }, { viewId: 'step-c' }],
			explorable: true,
			subject: null,
			text: null
		};
		const controller = fakeController({ subject: { kind: 'presentation', presentationId: 'steps' } });
		Object.assign(controller, {
			selectedPresentation: steps,
			viewsOf: new Map([
				['steps', [
					{ id: 'step-a', label: 'A' },
					{ id: 'step-b', label: 'B' },
					{ id: 'step-c', label: 'C' }
				]]
			])
		});
		const target = mountHome(ExperiencePresentationWriter, {}, fakeHomes(controller));
		await settle();

		const chips = [...target.querySelectorAll<HTMLElement>('.chip')];
		expect(chips).toHaveLength(2);
		// The first step leaves step-a (a Cut); the second leaves step-b (the Travel).
		expect(chips[0]!.querySelector('.kind')?.getAttribute('aria-label')).toBe('Cut: switch to Travel');
		expect(chips[1]!.querySelector('.kind')?.getAttribute('aria-label')).toBe('Travel with no path');
	});

	it('folds past 10 Views to the first 8, names what is hidden, and opens to scroll in its own box', async () => {
		const ids = Array.from({ length: 12 }, (_, index) => `many-${index + 1}`);
		const many: ExperiencePresentation = {
			id: 'many',
			label: 'Many',
			views: ids.map((viewId, index) => (index === 0 ? { viewId } : { viewId, transition: index === 10 ? 'travel' : 'cut' })),
			explorable: true,
			subject: null,
			text: null
		};
		const controller = fakeController({ subject: { kind: 'presentation', presentationId: 'many' } });
		Object.assign(controller, {
			selectedPresentation: many,
			viewsOf: new Map([['many', ids.map((id) => ({ id, label: id }))]])
		});
		const target = mountHome(ExperiencePresentationWriter, {}, fakeHomes(controller));
		await settle();
		const rail = target.querySelector('[data-view-rail]')!;
		expect(rail.getAttribute('data-fold')).toBe('folded');
		expect(rail.querySelectorAll('li.row')).toHaveLength(8);
		const more = buttonNamed(target, /Show all 12 Views/);
		expect(more.textContent).toContain('4 more');
		// The hidden Travel has no path in this fake, so it is named as ⚠.
		expect(more.textContent).toContain('⚠ 1');
		more.click();
		await settle();
		expect(rail.getAttribute('data-fold')).toBe('open');
		expect(rail.querySelectorAll('li.row')).toHaveLength(12);
		expect(rail.querySelector('ol.rail')!.classList.contains('scroll')).toBe(true);
		// A Shift-press range sets All Cut or All Travel at once.
		target.querySelector<HTMLButtonElement>('[data-rail-view="many-2"]')!.click();
		target.querySelector<HTMLButtonElement>('[data-rail-view="many-4"]')!.dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
		await settle();
		buttonNamed(target, 'All Travel').click();
		expect(controller.setPresentationStep).toHaveBeenCalledWith('many', 2, 'travel', 3);
	});
});
