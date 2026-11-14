/**
 * R217.S26 §4 — the x-fixtures: x-empty, x-salon, x-long and x-dense.
 *
 * One test and browser seeding helper for S26–S30. The world (a Layout room through
 * its admitted planner, one Scene object as authored data, as the S17 fixture writes
 * its entities) is fixed; every Experience fact is built by submitting the **real**
 * Experience commands through the unit acceptance profile, so the fixtures are what the
 * editor itself would have authored. They are not Conservatory's generators and add no
 * product UI. `tests/e2e/x-fixtures-seed.ts` saves one through the API for the owner's
 * journeys.
 *
 * One fact is a direct edit: x-salon's shared View. Listing an existing View in a second
 * Presentation is a format fact with no authoring operation (no S26 planner adds one), so
 * the fixture writes it after the planners have run and admits the result again.
 *
 * x-paths (Camera connections) arrives with R217.S29, and x-salon's three-View Stop with
 * R217.S27; neither exists before its slice's format and planners.
 */
import {
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain
} from '@portfolio/layout-core';
import type { AuthoringIntent, ScenePrimitiveEntity } from '@portfolio/project-model';
import {
	computeEnvelopeSourceContentId,
	createUnitAcceptanceProfile,
	serializeProjectEnvelope,
	validateProjectEnvelope,
	type	ExperienceTransitionKind,
	type ExperiencePresentationView,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';	import {
	cameraConnectionCreateIntent,
	cameraConnectionUpdateIntent,
	captureBindIntent,
	capturedViewPose,
	createExperienceIntent,
	guideCreateIntent,
	presentationUpdateIntent,
	stopCreateIntent,
	stopUpdateIntent
} from '$lib/authoring/experience/commands';
import { createUnitProject } from '../../authoring/__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../../layout/__fixtures__/layout-id-capture';

export type XFixtureName = 'x-empty' | 'x-salon' | 'x-long' | 'x-dense' | 'x-paths';
export const X_FIXTURE_NAMES: readonly XFixtureName[] = ['x-empty', 'x-salon', 'x-long', 'x-dense', 'x-paths'];

/** The stable identities a journey or test addresses. */
export type XFixture = {
	readonly name: XFixtureName;
	readonly project: ProjectEnvelope;
	readonly ids: {
		readonly sceneObjectId: string;
		readonly experienceId: string | null;
		readonly guideId: string | null;
		/** Presentations in authored order. */
		readonly presentationIds: readonly string[];
		/** The Guide's Stops in order. */
		readonly stopIds: readonly string[];
		/** x-salon: the View two Presentations list. */
		readonly sharedViewId: string | null;
	};
};

const SCENE_OBJECT_ID = 'x-pleyel-piano';
const EXPERIENCE_ID = 'x-experience';

/** A 6 × 4 m room and one Scene object (the x-empty world). */
function world(): { layout: ReturnType<typeof createEmptyWallFirstLayoutDocument>; piano: ScenePrimitiveEntity } {
	const base = createEmptyWallFirstLayoutDocument();
	const room = planWallChain({
		baseline: base,
		points: [[0, 0], [6, 0], [6, 4], [0, 4]],
		close: true,
		height: 3,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (room.kind !== 'success') throw new Error('x-fixtures: the 6 × 4 room was refused');
	// x-paths' wall/door variant: a real compiled Opening in the front Wall. The
	// fixture keeps the same one-room world for every name; a path can therefore
	// be read against a doorway without a second world builder.
	const opening = planCreateWallFirstOpening(
		room.document,
		{ wallId: room.document.walls[0]!.id, kind: 'door', offset: 2.4, width: 1.2, height: 2.1 },
		freshCapture(),
		base.floor.id
	);
	if (opening.kind !== 'success') throw new Error('x-fixtures: the doorway was refused');
	const piano: ScenePrimitiveEntity = {
		kind: 'primitive',
		primitive: 'box',
		id: SCENE_OBJECT_ID,
		name: 'Pleyel piano',
		dimensions: { width: 1.5, height: 1, depth: 0.6 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position: [3, 0.5, 2],
		rotation: [0, 0, 0]
	};
	return { layout: opening.document, piano };
}

/** The real acceptance path: one profile, one coordinator, each intent one accepted entry. */
async function authoring(projectId: string, name: string) {
	const { layout, piano } = world();
	const source = await createUnitProject({
		id: projectId,
		name,
		layout,
		scene: { formatVersion: 7, textures: [], materials: [], entities: [piano] }
	});
	const profile = createUnitAcceptanceProfile({ compound: true, sessionEpoch: 'x-fixtures' });
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: profile.adapter,
		sessionEpoch: 'x-fixtures',
		baseline: {
			revision: source.acceptedRevision,
			source,
			canonicalJson: serializeProjectEnvelope(source),
			sourceContentId: await computeEnvelopeSourceContentId(source)
		},
		mintRevisionId: (ordinal) => `x-revision-${ordinal + 1}`,
		preparation: { registry: profile.registry, prepare: profile.prepare }
	});
	let operation = 0;
	const op = (label: string) => `x-op-${(operation += 1)}-${label}`;
	const now = () => coordinator.acceptedSnapshot().domain.source;
	const revision = () => coordinator.acceptedRevision();
	async function accept(intent: AuthoringIntent): Promise<void> {
		const outcome = await coordinator.accept(intent);
		if (outcome.kind !== 'accepted') {
			throw new Error(`x-fixtures: ${intent.kind} was not accepted (${JSON.stringify(outcome)})`);
		}
	}
	return { source, now, revision, accept, op };
}

type Authoring = Awaited<ReturnType<typeof authoring>>;

/** A standing pose in the room, looking at a point: eye at the Camera default 1.65 m. */
function pose(label: string, eye: [number, number], target: [number, number]) {
	return capturedViewPose({ label, eye: [eye[0], 1.65, eye[1]], target: [target[0], 1.25, target[1]], fov: 54 });
}

async function createExperience(a: Authoring, label: string): Promise<void> {
	await a.accept(createExperienceIntent({ revision: a.revision(), ids: { operation: a.op('experience'), experience: EXPERIENCE_ID }, label }));
}

/** One captured Presentation (and its first View), optionally about the Scene object. */
async function present(a: Authoring, id: string, label: string, view: ReturnType<typeof pose>, about = false): Promise<void> {
	await a.accept(
		captureBindIntent({
			envelope: a.now(),
			revision: a.revision(),
			ids: { operation: a.op('present'), view: `${id}-view-1`, presentation: id },
			experienceId: EXPERIENCE_ID,
			view,
			presentationLabel: label,
			subjectEntityId: about ? SCENE_OBJECT_ID : null,
			text: null,
			guideId: null,
			afterStopId: null
		})
	);
}

/** Another captured View into a Presentation, keeping its Default. */
async function captureInto(a: Authoring, presentationId: string, viewId: string, view: ReturnType<typeof pose>): Promise<void> {
	const presentation = a.now().units.experience.data.experiences[0]!.presentations.find((entry) => entry.id === presentationId)!;
	await a.accept(
		presentationUpdateIntent({
			envelope: a.now(),
			revision: a.revision(),
			ids: { operation: a.op('capture'), view: viewId },
			experienceId: EXPERIENCE_ID,
			presentationId,
			view
		})
	);
}

/** A Guide whose Stops visit the given Presentations in order (the first Stop creates it). */
async function guide(a: Authoring, guideId: string, label: string, presentationIds: readonly string[]): Promise<string[]> {
	const stopIds = presentationIds.map((_, index) => `${guideId}-stop-${index + 1}`);
	await a.accept(
		guideCreateIntent({
			envelope: a.now(),
			revision: a.revision(),
			ids: { operation: a.op('guide'), guide: guideId, stop: stopIds[0]! },
			experienceId: EXPERIENCE_ID,
			presentationId: presentationIds[0]!,
			label,
			entryViewId: null,
			transition: 'cut'
		})
	);
	for (let index = 1; index < presentationIds.length; index += 1) {
		await a.accept(
			stopCreateIntent({
				envelope: a.now(),
				revision: a.revision(),
				ids: { operation: a.op('stop'), stop: stopIds[index]! },
				experienceId: EXPERIENCE_ID,
				presentationId: presentationIds[index]!,
				guideId,
				afterStopId: stopIds[index - 1]!,
				entryViewId: null,
					transition: 'cut'
			})
		);
	}
	return stopIds;
}

async function updateStop(
	a: Authoring,
	stopId: string,
	fields: {
		readonly entryViewId?: string | null;
		readonly staySeconds?: number;
		readonly invitation?: { readonly prompt: string | null } | null;
		readonly transition?: ExperienceTransitionKind | null;
		readonly connections?: readonly string[];
	}
): Promise<void> {
	const { connections, ...stopFields } = fields;
	await a.accept(
		stopUpdateIntent({ envelope: a.now(), revision: a.revision(), ids: { operation: a.op('stop-update'), connections: connections ?? Array.from({ length: 8 }, () => a.op('connection')) }, experienceId: EXPERIENCE_ID, stopId, ...stopFields })
	);
}

/** Rewrite one Presentation's ordered Views and steps in one accepted change. */
async function presentationViews(
	a: Authoring,
	presentationId: string,
	edit: (views: readonly ExperiencePresentationView[]) => readonly ExperiencePresentationView[],
	connections: readonly string[] = Array.from({ length: 8 }, () => a.op('connection'))
): Promise<void> {
	const presentation = a.now().units.experience.data.experiences[0]!.presentations.find((entry) => entry.id === presentationId)!;
	const views = edit(presentation.views);
	await a.accept(
		presentationUpdateIntent({ envelope: a.now(), revision: a.revision(), ids: { operation: a.op('views'), connections: [...connections] }, experienceId: EXPERIENCE_ID, presentationId, views })
	);
}

/** The salon's five Presentations: one about the Scene object, three with two Views. */
const SALON = [
	{ id: 'x-piano', label: 'Pleyel piano', about: true, views: [pose('Piano, keyboard', [3, 3.4], [3, 2]), pose('Piano, profile', [5, 2], [3, 2])] },
	{ id: 'x-window', label: 'North window', about: false, views: [pose('Window', [3, 1.5], [3, 0])] },
	{ id: 'x-door', label: 'Doorway', about: false, views: [pose('Doorway, inside', [1, 2], [0, 2]), pose('Doorway, across', [5, 2], [0, 2])] },
	{ id: 'x-corner', label: 'Reading corner', about: false, views: [pose('Corner', [4, 1], [5.8, 3.8])] },
	{ id: 'x-wall', label: 'East wall', about: false, views: [pose('East wall', [2, 2], [6, 2]), pose('East wall, close', [4.5, 2], [6, 2])] }
] as const;

async function salonPresentations(a: Authoring): Promise<string[]> {
	for (const entry of SALON) {
		await present(a, entry.id, entry.label, entry.views[0], entry.about);
		for (let index = 1; index < entry.views.length; index += 1) {
			await captureInto(a, entry.id, `${entry.id}-view-${index + 1}`, entry.views[index]!);
		}
	}
	return SALON.map((entry) => entry.id);
}

/** x-salon's shared View: the East wall also lists the Doorway's across View (see the header). */
async function shareView(project: ProjectEnvelope): Promise<ProjectEnvelope> {
	const shared = 'x-door-view-2';
	const experiences = project.units.experience.data.experiences.map((experience) => ({
		...experience,
		presentations: experience.presentations.map((presentation) =>
			presentation.id === 'x-wall' ? { ...presentation, views: [...presentation.views, { viewId: shared, transition: 'cut' as const }] } : presentation
		)
	}));
	return admitted({
		...project,
		units: { ...project.units, experience: { ...project.units.experience, data: { ...project.units.experience.data, experiences } } }
	});
}

/** Re-derive unit revisions and prove the result is an admitted envelope. */
async function admitted(project: ProjectEnvelope): Promise<ProjectEnvelope> {
	const rebuilt = await createUnitProject({
		id: project.id,
		name: project.name,
		acceptedRevision: project.acceptedRevision,
		layout: project.units.layout.data,
		scene: project.units.scene.data,
		camera: project.units.camera.data,
		experience: project.units.experience.data,
		resources: project.units.resources.data
	});
	const validation = validateProjectEnvelope(JSON.parse(serializeProjectEnvelope(rebuilt)));
	if (!validation.success) throw new Error(`x-fixtures: the fixture is not admitted (${JSON.stringify(validation.issues)})`);
	return rebuilt;
}

export async function buildXFixture(name: XFixtureName, projectId: string = `project-${name}`): Promise<XFixture> {
	const a = await authoring(projectId, `R217 ${name}`);
	if (name === 'x-empty') {
		return {
			name,
			project: await admitted(a.now()),
			ids: { sceneObjectId: SCENE_OBJECT_ID, experienceId: null, guideId: null, presentationIds: [], stopIds: [], sharedViewId: null }
		};
	}
	await createExperience(a, name === 'x-dense' ? 'Dense collection' : 'Salon evening');
	if (name === 'x-dense') {
		// One 50-View Presentation and 39 more: 40 Presentations in all.
		await present(a, 'x-dense-gallery', 'Long gallery', pose('Gallery 1', [0.5, 0.5], [5.5, 3.5]));
		for (let index = 2; index <= 50; index += 1) {
			const step = (index - 1) / 49;
			await captureInto(a, 'x-dense-gallery', `x-dense-gallery-view-${index}`, pose(`Gallery ${index}`, [0.5 + 5 * step, 0.5 + 3 * step], [3, 2]));
		}
		const presentationIds = ['x-dense-gallery'];
		for (let index = 2; index <= 40; index += 1) {
			const id = `x-dense-${index}`;
			const angle = (index / 40) * Math.PI * 2;
			await present(a, id, `Presentation ${index}`, pose(`View of ${index}`, [3 + 1.5 * Math.cos(angle), 2 + 1.2 * Math.sin(angle)], [3, 2]));
			presentationIds.push(id);
		}
		return {
			name,
			project: await admitted(a.now()),
			ids: { sceneObjectId: SCENE_OBJECT_ID, experienceId: EXPERIENCE_ID, guideId: null, presentationIds, stopIds: [], sharedViewId: null }
		};
	}
	const presentationIds = await salonPresentations(a);
	if (name === 'x-long') {
		const order = Array.from({ length: 30 }, (_, index) => presentationIds[index % presentationIds.length]!);
		const stopIds = await guide(a, 'x-long-guide', 'Long tour', order);
		return {
			name,
			project: await shareView(a.now()),
			ids: { sceneObjectId: SCENE_OBJECT_ID, experienceId: EXPERIENCE_ID, guideId: 'x-long-guide', presentationIds, stopIds, sharedViewId: 'x-door-view-2' }
		};
	}
	// x-salon: six Stops in one linear order with a revisit (Stop 4 revisits the piano)
	// and a hold-less Stop (Stop 2).
	const [piano, window, door, corner, wall] = presentationIds as [string, string, string, string, string];
	const stopIds = await guide(a, 'x-salon-guide', 'Salon tour', [piano, window, door, piano, corner, wall]);
	for (const [index, stopId] of stopIds.entries()) {
		if (index === 1) continue;
		await updateStop(a, stopId, { staySeconds: 4 });
	}
	// Stop 2 starts with one View and has two more to include in the owner journey.
	await captureInto(a, window, 'x-window-view-2', pose('Window, from the door', [1.5, 1.5], [3, 0]));
	await captureInto(a, window, 'x-window-view-3', pose('Window, from the wall', [4.5, 1.5], [3, 0]));
	await captureInto(a, piano, 'x-piano-view-3', pose('Piano, lid', [2, 1.5], [3, 2]));
	// Stop 2 invites exploring its three Views; Stop 4 revisits the piano and enters at its profile.
	await updateStop(a, stopIds[1]!, { invitation: { prompt: null } });
	await updateStop(a, stopIds[3]!, { entryViewId: 'x-piano-view-2', staySeconds: 10 });
	if (name === 'x-paths') {
		// Stops 1 and 4 both enter (and so leave) at the piano's profile View and
		// Travel to Stop 5 (the corner): one direct Camera path shared by two Guided
		// uses. The piano Presentation's own explore step travels between its Views.
		// The window Presentation ends in the walled explore step: outside the front
		// Wall, through the authored doorway when its one interior point is moved
		// into the Opening.
		await captureInto(a, window, 'x-window-path-outside', pose('Outside the wall', [1, -1], [3, 2]));
		await captureInto(a, window, 'x-window-path-inside', pose('Inside the wall', [1, 1], [3, 2]));
		await presentationViews(a, window, (views) => {
			const outside = views.find((entry) => entry.viewId === 'x-window-path-outside')!;
			const inside = views.find((entry) => entry.viewId === 'x-window-path-inside')!;
			const rest = views.filter((entry) => entry !== outside && entry !== inside);
			return [...rest, { viewId: outside.viewId, transition: 'travel' }, { viewId: inside.viewId }];
		}, ['x-path-door']);
		// Stop 1 enters the piano's profile and follows the Guide order by Cut; only the
		// revisit at Stop 4 leaves by Travel, so one authored pair owns the path.
		await updateStop(a, stopIds[0]!, { entryViewId: 'x-piano-view-2' });
		await updateStop(a, stopIds[3]!, {
			entryViewId: 'x-piano-view-2',
			transition: 'travel',
			connections: ['x-path-shared']
		});
		const view = (id: string) => a.now().units.camera.data.views.find((entry) => entry.id === id)!;
		// The piano's own explore step from its keyboard to its profile travels.
		await presentationViews(a, piano, (views) =>
			views.map((entry) => (entry.viewId === 'x-piano-view-1' ? { viewId: entry.viewId, transition: 'travel' } : entry)),
			['x-path-step']
		);
		// The walled pair is its own connected component: the shared/step pair and
		// the wall/door pair stay independent Camera paths, with no bridge edge.
		await a.accept(
			cameraConnectionUpdateIntent({
				envelope: a.now(),
				revision: a.revision(),
				ids: { operation: a.op('path-door-anchor') },
				connectionId: 'x-path-door',
				anchors: [{ id: 'x-path-door-point', position: [1, 1.5, 0] }]
			})
		);
	}
	return {
		name,
		project: await shareView(a.now()),
		ids: { sceneObjectId: SCENE_OBJECT_ID, experienceId: EXPERIENCE_ID, guideId: 'x-salon-guide', presentationIds, stopIds, sharedViewId: 'x-door-view-2' }
	};
}
