import type { ViewportEvaluation } from '@portfolio/camera-core';
/**
 * R217.S29 — reactive fake homes for the Stage path overlay (tests only).
 *
 * The overlay reads its selected occurrence and connection through the controller and
 * cancels a press when either changes. Those are live reads, so the fake exposes them as
 * Svelte state and the setters below re-derive the overlay exactly as an Undo or a new
 * accepted path would. Every write is a spy: the test can count one command per gesture.
 */
import { vi } from 'vitest';
import type { Experience, ExperienceGuide, ExperienceStop } from '@portfolio/project-model/units';
import type { Vec3 } from '@portfolio/camera-core';
import type { ExperienceController } from '$lib/authoring/experience/experience-controller.svelte';
import type { ExperienceHomes } from '$lib/authoring/experience/experience-homes';
import type {
	ExperiencePathOccurrence,
	ExperiencePathRead
} from '$lib/authoring/experience/experience-paths';

export const PATH_OCCURRENCE: ExperiencePathOccurrence = {
	kind: 'step',
	stopId: 'stop-1',
	toViewId: 'view-two'
};

export const PATH_SAMPLES: readonly Vec3[] = [
	[-2, 1, 0],
	[-1, 1, 0],
	[0, 1, 0],
	[1, 1, 0],
	[2, 1, 0]
];

export const PATH_ANCHOR = { id: 'anchor-1', position: [0, 1, 0] as Vec3 };

const STOP: ExperienceStop = {
	id: 'stop-1',
	presentationId: 'piano',
	views: [{ viewId: 'view-one' }, { viewId: 'view-two', transition: 'travel' }],
	continuation: { kind: 'end' }
};

const GUIDE: ExperienceGuide = {
	id: 'guide-1',
	label: 'Main',
	stopIds: ['stop-1'],
	entryStopId: 'stop-1'
};

const EXPERIENCE: Experience = {
	id: 'experience-1',
	label: 'Walk',
	welcome: null,
	entryGuideId: 'guide-1',
	presentations: [
		{
			id: 'piano',
			label: 'Piano',
			viewIds: ['view-one', 'view-two'],
			explorable: true,
			defaultViewId: 'view-one',
			subject: null,
			text: null
		}
	],
	stops: [STOP],
	guides: [GUIDE],
	gates: [],
	detours: []
};

export function pathRead(overrides: Partial<ExperiencePathRead> = {}): ExperiencePathRead {
	return {
		occurrence: PATH_OCCURRENCE,
		fromViewId: 'view-one',
		toViewId: 'view-two',
		transition: 'travel',
		state: 'ready',
		connectionId: 'connection-1',
		direction: 'forward',
		authoredSeconds: null,
		seconds: 4.2,
		lengthMeters: 5,
		anchorCount: 1,
		anchors: [PATH_ANCHOR],
		sharedUses: [],
		samples: [...PATH_SAMPLES],
		wall: null,
		...overrides
	};
}

export function createPathsHomes(initial: ExperiencePathRead) {
	let guideOpen = $state(true);
	let selectedPath = $state<ExperiencePathRead | null>(initial);
	let selectedAnchorId = $state<string | null>(PATH_ANCHOR.id);
	const addPathAnchor = vi.fn(async () => true);
	const movePathAnchor = vi.fn(async () => true);
	const selectAnchor = vi.fn((anchorId: string | null) => {
		selectedAnchorId = anchorId;
	});
	const controller = {
		current: EXPERIENCE,
		contextGuide: GUIDE,
		guideStops: [STOP],
		cameraViews: [],
		get selectedPath() {
			return selectedPath;
		},
		get selectedAnchorId() {
			return selectedAnchorId;
		},
		pathFor: () => selectedPath,
		previewPathDrag: (_anchorId: string | null, point: Vec3) => [PATH_SAMPLES[0]!, point, PATH_SAMPLES.at(-1)!],
		addPathAnchor,
		movePathAnchor,
		selectAnchor
	};
	const homes = {
		controller: () => controller as unknown as ExperienceController,
		guideOpen: () => guideOpen
	} as unknown as ExperienceHomes;
	return {
		homes,
		addPathAnchor,
		movePathAnchor,
		selectAnchor,
		createEvaluation(initial: ViewportEvaluation) {
			let evaluation = $state.raw(initial);
			return {
				read: () => evaluation,
				redraw: () => {
					evaluation = {
						...evaluation,
						token: { ...evaluation.token, evaluationGeneration: evaluation.token.evaluationGeneration + 1 }
					};
				}
			};
		},
		setGuideOpen(open: boolean): void {
			guideOpen = open;
		},
		setSelectedPath(next: ExperiencePathRead | null): void {
			selectedPath = next;
			selectedAnchorId = null;
		}
	};
}
