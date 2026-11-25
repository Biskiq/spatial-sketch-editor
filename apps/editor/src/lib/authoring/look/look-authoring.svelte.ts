/**
 * The Look authoring seam.
 *
 * The spatial route constructs this module once. It owns the World's Sky, its
 * resolve-time Treatment, the curated Look catalogue and palette adoption, and
 * publishes the three Look strata: the Card stratum, the Stage mark layer and
 * the Library shelf. The Library shelf holds the light entries; the Card stratum
 * and the mark layer are deliberately empty, so no control is drawn before it
 * works.
 *
 * A Look is never stored. It is the exact `(sky, treatment)` pair a World
 * matches, so applying one writes the Sky (keeping the World's noon heading) and
 * the Treatment, and seeds a palette only when the World has none. Adopting the
 * palette is a separate, previewed write.
 *
 * Previous is a session-scoped A/B: a Look apply captures the accepted
 * environment immediately before it, and Previous restores that environment and
 * captures the one it leaves. Any other environment write clears it, and a
 * project-epoch change makes it unreadable.
 *
 * This module owns no route, selection, source or Camera state. Every write
 * still goes through the route's one acceptance host.
 */
import { SCENE_LOOK_STARTS, SCENE_SKY_DEFAULT, sceneLookOf, skyIsEdited, type SceneEnvironment, type SceneEnvironmentChoice, type SceneLookId, type SceneLookStart, type SceneSky, type SceneTreatment } from '@portfolio/project-model/units';
import { SCENE_ENVIRONMENT_SET_KIND, SCENE_LOOK_APPLY_KIND, SCENE_LOOK_RESTORE_KIND, SCENE_SKY_UPDATE_KIND, SCENE_TREATMENT_SET_KIND } from '@portfolio/project-model/units/planning';
import type { SceneSkyUpdatePayload } from '@portfolio/project-model/units/planning';
import {
	planPaletteAdoption,
	type PaletteAdoptionPlan
} from '@portfolio/project-model/scene-planning';
import type { AcceptedRevision } from '@portfolio/project-model/references';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import { SCENE_PALETTE_ADOPT } from '@portfolio/project-model/scene-planning';
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

/** One environment captured for Previous, tied to the project epoch it came from. */
type CapturedEnvironment = {
	readonly sky: SceneSky | null;
	readonly treatment: SceneTreatment | undefined;
	readonly sessionKey: string;
};

/** What a write does to Previous once it is accepted. */
type PreviousBehaviour = 'keep' | 'clear' | 'capture';

/** The scene data adoption reads: the accepted Scene document. */
export type LookScene = Parameters<typeof planPaletteAdoption>[0];

export type LookAuthoringHost = {
	/** The World's admitted Sky; `null` is Paper, until one is saved. */
	readonly sky: () => SceneSky | null;
	/** The accepted Scene document: environment, palette and every Finish. */
	readonly scene: () => LookScene | null;
	/** The route's one adapter-services slot; null before the Stage is admitted. */
	readonly services: () => StageAdapterServices | null;
	/** The route's one notice line. */
	readonly onNotice: (message: string) => void;
	readonly windowHeading?: () => number | null;
	/** The project epoch Previous is scoped to; a change makes a capture unreadable. */
	readonly sessionKey?: () => string;
};

export type LookPanelTab = 'sky' | 'looks';

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
	let panelTab = $state<LookPanelTab>('sky');
	let previous = $state.raw<CapturedEnvironment | null>(null);
	/** The plan frozen when Adopt opened; null while the preview is closed. */
	let adoption = $state.raw<PaletteAdoptionPlan | null>(null);

	const scene = $derived(host.scene());
	const environment = $derived(scene?.environment);
	const sky = $derived(host.sky());
	const shownSky = $derived(previewSky ?? sky ?? SCENE_SKY_DEFAULT);
	const stageSky = $derived(studioWhileEditing ? null : previewSky ?? sky);
	const busy = $derived(environmentWrite !== null && environmentWrite === host.services());
	const revision = () => host.services()?.stage.snapshot().acceptedRevision;
	const sessionKey = $derived(host.sessionKey?.() ?? '');
	const previousEnvironment = $derived(
		previous !== null && previous.sessionKey === sessionKey ? previous : null
	);
	const treatment = $derived(environment?.treatment);
	const activeLook = $derived(sceneLookOf(environment));
	const adoptionPlan = $derived(scene === null ? null : planPaletteAdoption(scene));
	const canAdopt = $derived(
		adoptionPlan !== null && adoptionPlan.slots > 0 && adoptionPlan.rows.length > 0
	);

	function capture(): CapturedEnvironment {
		return {
			sky: environment?.sky ?? null,
			treatment: environment?.treatment,
			sessionKey
		};
	}

	async function write(
		kind: string,
		payload: AuthoringIntent['payload'],
		expectedRevision = revision(),
		previousBehaviour: PreviousBehaviour = 'keep'
	): Promise<boolean> {
		const services = host.services();
		if (services === null || expectedRevision === undefined || environmentWrite === services) return false;
		const before = capture();
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
			if (host.services() !== services) return false;
			if (outcome.kind === 'refused') {
				if (outcome.code !== 'no-change') host.onNotice(outcome.message);
				return false;
			}
			if (previousBehaviour === 'capture') previous = before;
			else if (previousBehaviour === 'clear') previous = null;
			return true;
		} finally {
			if (environmentWrite === services) environmentWrite = null;
		}
	}

	function updateSky(patch: SceneSkyUpdatePayload, expectedRevision?: AcceptedRevision): Promise<boolean> {
		return write(SCENE_SKY_UPDATE_KIND, patch, expectedRevision, 'clear');
	}
	const gesture = createSkyGesture({
		sky: () => sky ?? SCENE_SKY_DEFAULT,
		revision,
		busy: () => busy,
		preview: (value) => { previewSky = value; },
		update: async (patch, expected) => { await updateSky(patch, expected); }
	});

	function setEnvironment(preset: SceneEnvironmentChoice): Promise<boolean> {
		gesture.cancel();
		return write(SCENE_ENVIRONMENT_SET_KIND, { preset }, revision(), 'clear');
	}

	function aimThroughWindows(): void {
		const heading = host.windowHeading?.() ?? null;
		if (heading === null) host.onNotice('No outside windows to aim through');
		else void updateSky({ heading });
	}

	/** Apply one curated Look: its Sky at the World's heading, its Treatment, and a seed palette. */
	async function applyLook(id: SceneLookId): Promise<void> {
		gesture.cancel();
		await write(SCENE_LOOK_APPLY_KIND, { look: id }, revision(), 'capture');
	}

	/** Natural, Flat colour or Clay. The Sky and every Finish assignment stay put. */
	async function setTreatment(next: 'natural' | SceneTreatment): Promise<void> {
		gesture.cancel();
		await write(SCENE_TREATMENT_SET_KIND, { treatment: next }, revision(), 'clear');
	}

	/** Put back the environment captured by the last Look apply; a true A/B. */
	async function restorePrevious(): Promise<void> {
		const captured = previousEnvironment;
		if (captured === null) return;
		gesture.cancel();
		await write(
			SCENE_LOOK_RESTORE_KIND,
			{
				sky: captured.sky,
				...(captured.treatment === undefined ? {} : { treatment: captured.treatment })
			},
			revision(),
			'capture'
		);
	}

	/** Open the adoption preview on the accepted plan. Writes nothing. */
	function beginAdoption(): void {
		if (!canAdopt) return;
		adoption = adoptionPlan;
	}

	function cancelAdoption(): void {
		adoption = null;
	}

	/** Adopt the previewed mapping in one write; stale plans are refused by the writer. */
	async function adoptPalette(): Promise<void> {
		const plan = adoption;
		if (plan === null) return;
		const accepted = await write(
			SCENE_PALETTE_ADOPT,
			{
				mapping: plan.rows.map((row) => ({
					color: row.color,
					slotId: row.slotId,
					slotColor: row.slotColor
				}))
			},
			revision(),
			'keep'
		);
		if (accepted) adoption = null;
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
		get scene() {
			return scene;
		},
		get environment(): SceneEnvironment | undefined {
			return environment;
		},
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
			if (!open) {
				gesture.cancel();
				cancelAdoption();
			}
		},
		get panelTab() {
			return panelTab;
		},
		setPanelTab(tab: LookPanelTab) {
			panelTab = tab;
		},
		gesture,
		resetSky: () => { void setEnvironment(shownSky.preset); },
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
		get looks(): readonly SceneLookStart[] {
			return SCENE_LOOK_STARTS;
		},
		get activeLook(): SceneLookStart | null {
			return activeLook;
		},
		get treatment(): SceneTreatment | undefined {
			return treatment;
		},
		get previousEnvironment(): CapturedEnvironment | null {
			return previousEnvironment;
		},
		get palette() {
			return scene?.palette ?? [];
		},
		get adoptionPlan(): PaletteAdoptionPlan | null {
			return adoptionPlan;
		},
		get adoptionPreview(): PaletteAdoptionPlan | null {
			return adoption;
		},
		get canAdopt() {
			return canAdopt;
		},
		setEnvironment,
		applyLook,
		setTreatment,
		restorePrevious,
		beginAdoption,
		cancelAdoption,
		adoptPalette,
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
