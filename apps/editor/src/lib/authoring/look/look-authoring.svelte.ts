/**
 * T2 P0 — the Look authoring seam.
 *
 * The spatial route constructs this module once. It owns the two look wirings
 * that exist today — the World's saved Sky preset and the Library's material
 * pick — and publishes the three strata later T2 slices fill: the Card stratum,
 * the Stage mark layer and the Library shelf. Those strata are deliberately
 * empty here: P0 adds no Sky, Light, Artwork or Finish capability and draws no
 * control before it works.
 *
 * This module owns no route, selection, source or Camera state. Every write
 * still goes through the route's one acceptance host.
 */
import {
	SCENE_ENVIRONMENT_SET_KIND,
	type SceneEnvironmentPreset
} from '@portfolio/project-model/units';
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
 * later Finish, Light or Artwork slice contributes. Empty in P0.
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
/** T2.S3: the three physical light kinds. S7's recipes are not shelf entries. */
const LIGHT_SHELF: LookLibraryShelf = {
	label: 'Lights',
	entries: [
		{ id: 'light:point', label: 'Point', summary: 'A light with no direction or beam.' },
		{ id: 'light:spot', label: 'Spot', summary: 'A cone aimed at a surface.' },
		{ id: 'light:directional', label: 'Directional', summary: 'Parallel light, like the sun.' }
	]
};

export type LookAuthoringHost = {
	/** The World's admitted environment preset; `paper` until one is saved. */
	readonly environment: () => SceneEnvironmentPreset;
	/** The route's one adapter-services slot; null before the Stage is admitted. */
	readonly services: () => StageAdapterServices | null;
	/** The route's one notice line. */
	readonly onNotice: (message: string) => void;
};

export function createLookAuthoring(host: LookAuthoringHost) {
	let editOnPaper = $state(false);
	let environmentWrite = $state.raw<StageAdapterServices | null>(null);

	const environment = $derived(host.environment());
	/** The environment the Stage and visitor preview actually render. */
	const stageEnvironment = $derived(editOnPaper ? 'paper' : environment);
	const busy = $derived(environmentWrite !== null && environmentWrite === host.services());

	async function setEnvironment(preset: SceneEnvironmentPreset): Promise<void> {
		const services = host.services();
		if (services === null || environmentWrite === services || preset === environment) return;
		environmentWrite = services;
		try {
			const outcome = await services.authoring.accept({
				version: 1,
				kind: SCENE_ENVIRONMENT_SET_KIND,
				operationId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
				expectedRevision: services.stage.snapshot().acceptedRevision,
				targets: [],
				payload: { preset },
				allocatedIds: [],
				capturedInputs: []
			});
			if (host.services() === services && outcome.kind === 'refused') host.onNotice(outcome.message);
		} finally {
			if (environmentWrite === services) environmentWrite = null;
		}
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
	 * A Look shelf pick. The three light kinds arm the one light task; no source is
	 * written until the Stage press is accepted, and S7's recipes stay absent.
	 */
	function pickLibraryEntry(entryId: string): void {
		if (!entryId.startsWith('light:')) return;
		const kind = entryId.slice('light:'.length) as ArmedLightKind;
		if (kind !== 'point' && kind !== 'spot' && kind !== 'directional') return;
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
		get environment() {
			return environment;
		},
		get stageEnvironment() {
			return stageEnvironment;
		},
		get editOnPaper() {
			return editOnPaper;
		},
		get busy() {
			return busy;
		},
		get cardStratum() {
			return cardStratum;
		},
		/** The Stage's Look mark layer. Empty in P0. */
		get stageMarks(): readonly StageMarkView[] {
			return EMPTY_STAGE_MARKS;
		},
		/** The Library's Look shelf. Lights are the first populated slice. */
		get libraryShelf(): LookLibraryShelf {
			return LIGHT_SHELF;
		},
		setEnvironment,
		setEditOnPaper(value: boolean) {
			editOnPaper = value;
		},
		pickMaterial,
		pickLibraryEntry
	};
}
