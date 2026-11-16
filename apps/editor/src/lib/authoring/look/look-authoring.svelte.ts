/**
 * The Look authoring seam.
 *
 * The spatial route constructs this module once. It owns the two look wirings
 * that exist today — the World's saved Sky preset and the Library's material
 * pick — and publishes the three Look strata: the Card stratum, the Stage mark
 * layer and the Library shelf. The Library shelf holds the light entries; the
 * Card stratum and the mark layer are deliberately empty, so no control is drawn
 * before it works.
 *
 * This module owns no route, selection, source or Camera state. Every write
 * still goes through the route's one acceptance host.
 */
import {
	SCENE_ENVIRONMENT_SET_KIND,
	SCENE_SKY_UPDATE_KIND,
	SCENE_SKY_DEFAULT,
	skyIsEdited,
	type SceneSkyUpdatePayload,
	type SceneEnvironmentChoice,
	type SceneSky
} from '@portfolio/project-model/units';
import type { AcceptedRevision, AuthoringIntent } from '@portfolio/project-model';
import { createSkyGesture } from './sky-gesture.svelte';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import type {
	StageCardActionRecord,
	StageCardFact,
	StageCardSubject,
	StageCardWriterRecord
} from '../stage/stage-facade';
import type { StageMarkView } from '../stage/stage-handles';
import { armLight, type ArmedLightKind } from './light-tool.svelte';

/** The exact Library feedback the material shelf has always given. */
export const LOOK_MATERIAL_PICK_NOTICE =
	'Paint is planned for T5; the material stays in the Library without changing the World.';

/**
 * The Card's look stratum: the facts, the one field writer and the actions a
 * Look feature contributes. Currently empty.
 */
export type LookCardStratum = {
	readonly facts: readonly StageCardFact[];
	readonly writer: StageCardWriterRecord | null;
	readonly actions: readonly StageCardActionRecord[];
};

/** One entry on the Look shelf. No entry exists until its capability does. */
export type LookLibraryEntry = {
	readonly id: string;
	readonly label: string;
	readonly summary?: string;
};

/** The Library shelf later Finishes, Lights and Looks fill. Empty in P0. */
export type LookLibraryShelf = {
	readonly label: string;
	readonly entries: readonly LookLibraryEntry[];
};

const EMPTY_CARD_STRATUM: LookCardStratum = { facts: [], writer: null, actions: [] };
const EMPTY_STAGE_MARKS: readonly StageMarkView[] = [];
/** The two physical light kinds (Directional is retired; the Sky owns the Sun). S7's recipes are not shelf entries. */
const LIGHT_SHELF: LookLibraryShelf = {
	label: 'Lights',
	entries: [
		{ id: 'light:point', label: 'Point', summary: 'A light with no direction or beam.' },
		{ id: 'light:spot', label: 'Spot', summary: 'A cone aimed at a surface.' }
	]
};

export type LookAuthoringHost = {
	/** The World's admitted Sky; `null` is Paper, until one is saved. */
	readonly sky: () => SceneSky | null;
	/** The route's one adapter-services slot; null before the Stage is admitted. */
	readonly services: () => StageAdapterServices | null;
	/** The route's one notice line. */
	readonly onNotice: (message: string) => void;
	readonly windowHeading?: () => number | null;
};

export function createLookAuthoring(host: LookAuthoringHost) {
	const preferenceKey = 'biskiq:edit-on-paper';
	function readStudioPreference(): boolean {
		try { return localStorage.getItem(preferenceKey) === 'true'; }
		catch { return false; }
	}
	let studioWhileEditing = $state(readStudioPreference());
	let environmentWrite = $state.raw<StageAdapterServices | null>(null);
	let previewSky = $state.raw<SceneSky | null>(null);
	let panelOpen = $state(false);

	const sky = $derived(host.sky());
	const shownSky = $derived(previewSky ?? sky ?? SCENE_SKY_DEFAULT);
	const stageSky = $derived(studioWhileEditing ? null : previewSky ?? sky);
	const busy = $derived(environmentWrite !== null && environmentWrite === host.services());
	const revision = () => host.services()?.stage.snapshot().acceptedRevision;

	async function write(kind: string, payload: AuthoringIntent['payload'], expectedRevision = revision()): Promise<void> {
		const services = host.services();
		if (services === null || expectedRevision === undefined || environmentWrite === services) return;
		environmentWrite = services;
		try {
			const outcome = await services.authoring.accept({
				version: 1,
				kind,
				operationId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
				expectedRevision,
				targets: [],
				payload,
				allocatedIds: [],
				capturedInputs: []
			});
			if (host.services() === services && outcome.kind === 'refused' && outcome.code !== 'no-change') {
				host.onNotice(outcome.message);
			}
		} finally {
			if (environmentWrite === services) environmentWrite = null;
		}
	}

	function updateSky(patch: SceneSkyUpdatePayload, expectedRevision?: AcceptedRevision): Promise<void> {
		return write(SCENE_SKY_UPDATE_KIND, patch, expectedRevision);
	}
	const gesture = createSkyGesture({
		sky: () => sky ?? SCENE_SKY_DEFAULT,
		revision,
		busy: () => busy,
		preview: (value) => { previewSky = value; },
		update: updateSky
	});

	function setEnvironment(preset: SceneEnvironmentChoice): Promise<void> {
		gesture.cancel();
		return write(SCENE_ENVIRONMENT_SET_KIND, { preset });
	}

	function aimThroughWindows(): void {
		const heading = host.windowHeading?.() ?? null;
		if (heading === null) host.onNotice('No outside windows to aim through');
		else void updateSky({ heading });
	}

	/**
	 * The material shelf's pick. It still writes nothing: Paint is a later
	 * capability and the item stays in the Library with the same explanation.
	 */
	function pickMaterial(materialId: string): void {
		void materialId;
		host.onNotice(LOOK_MATERIAL_PICK_NOTICE);
	}

	/** The Card's look stratum for the selected subject. Empty in P0. */
	function cardStratum(subject: StageCardSubject | null): LookCardStratum {
		void subject;
		return EMPTY_CARD_STRATUM;
	}

	/**
	 * A Look shelf pick. Point and Spot arm the one light task. No source is
	 * written until the one acceptance host says so.
	 */
	function pickLibraryEntry(entryId: string): void {
		if (!entryId.startsWith('light:')) return;
		const kind = entryId.slice('light:'.length) as ArmedLightKind;
		if (kind !== 'point' && kind !== 'spot') return;
		const services = host.services();
		if (services === null) {
			host.onNotice('The Stage is still opening; try the light again in a moment.');
			return;
		}
		armLight(services.stage.snapshot().acceptedRevision.projectId, kind);
		const opened = services.stage.openContributedTask('light-place', 'light');
		if (opened.kind === 'refused') host.onNotice(opened.message);
	}

	return {
		get sky() {
			return sky;
		},
		get stageSky() {
			return stageSky;
		},
		get studioWhileEditing() { return studioWhileEditing; },
		get previewSky() { return previewSky; },
		get shownSky() { return shownSky; },
		get edited() { return shownSky.preset !== 'studio' && skyIsEdited(shownSky); },
		get panelOpen() { return panelOpen; },
		setPanelOpen(open: boolean) {
			panelOpen = open;
			if (!open) gesture.cancel();
		},
		gesture,
		resetSky: () => setEnvironment(shownSky.preset),
		updateSky,
		aimThroughWindows,
		get busy() {
			return busy;
		},
		get cardStratum() {
			return cardStratum;
		},
		/** The Stage's Look mark layer. Currently empty. */
		get stageMarks(): readonly StageMarkView[] {
			return EMPTY_STAGE_MARKS;
		},
		/** The Library's Look shelf: the light entries. */
		get libraryShelf(): LookLibraryShelf {
			return LIGHT_SHELF;
		},
		setEnvironment,
		setStudioWhileEditing(value: boolean) {
			studioWhileEditing = value;
			try { localStorage.setItem(preferenceKey, String(value)); }
			catch { /* The session preference still works with storage disabled. */ }
		},
		pickMaterial,
		pickLibraryEntry
	};
}

export type LookAuthoring = ReturnType<typeof createLookAuthoring>;
