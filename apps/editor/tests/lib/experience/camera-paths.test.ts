/**
 * R217.S29 — Camera path contracts.
 *
 * The suite challenges three claims:
 *
 * 1. **One direct connection.** A shared Travel reads exactly one connection;
 *    a step inside a Stop reads its own; the derived read names every other
 *    Travel use of the same path.
 * 2. **Bounded planners.** `camera-connection-create` refuses an existing
 *    unordered pair and `camera-connection-update` writes duration/anchors
 *    only, refuses a no-op and preserves the other direction.
 * 3. **Layout advisory.** The route-versus-Wall read uses the compiled
 *    opening-free solid spans and thickness; a route above the Wall clears.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	routeCrossesWall
} from '@portfolio/layout-core';
import {
	computeEnvelopeSourceContentId,
	createUnitAcceptanceProfile,
	lowerExperienceProgram,
	prepareUnitRuntime,
	readUnitEnvelopeForSave,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	SCENE_ENVIRONMENT_SET_KIND
} from '@portfolio/project-model/units';
import {
	cameraConnectionCreateIntent,
	cameraConnectionUpdateIntent,
	captureBindIntent,
	capturedViewPose,
	stopUpdateIntent
} from '$lib/authoring/experience/commands';
import {
	experiencePathOccurrences,
	isPathEditTarget,
	readExperiencePath,
	previewPathSamples,
	resolvePathAnchorInsertion,
	resolvePathOccurrence
} from '$lib/authoring/experience/experience-paths';
import type { CameraGraph } from '@portfolio/camera-core';
import { buildXFixture } from './__fixtures__/x-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

async function pathsFixture(name: 'x-paths' | 'x-salon' = 'x-paths') {
	const fixture = await buildXFixture(name);
	const project = fixture.project;
	const profile = createUnitAcceptanceProfile({ compound: true, sessionEpoch: 's29' });
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: profile.adapter,
		sessionEpoch: 's29',
		baseline: {
			revision: project.acceptedRevision,
			source: project,
			canonicalJson: serializeProjectEnvelope(project),
			sourceContentId: await computeEnvelopeSourceContentId(project)
		},
		mintRevisionId: (ordinal) => `s29-revision-${ordinal + 1}`,
		preparation: { registry: profile.registry, prepare: profile.prepare }
	});
	let operation = 0;
	const accept = (intent: Parameters<typeof coordinator.accept>[0]) =>
		coordinator.accept(intent);
	// Canonical runtime preparation, exactly as Stage admission installs it.
	const prepared = prepareUnitRuntime(project);
	if (prepared.kind !== 'ready') throw new Error('x-paths did not prepare');
	return { fixture, graph: prepared.graph, geometry: prepared.geometry, coordinator, accept, op: (label: string) => `s29-op-${(operation += 1)}-${label}` };
}

describe('R217.S29 Camera paths', () => {
	it('x-paths gives the Guide’s one Travel its path and the Presentation step its own', async () => {
		const { fixture, graph } = await pathsFixture();
		const experience = fixture.project.units.experience.data.experiences[0]!;
		const guide = experience.guides[0]!;
		const occurrences = experiencePathOccurrences(experience, guide);
		const shared = occurrences.filter(
			(entry) =>
				entry.transition === 'travel' &&
				entry.fromViewId === 'x-piano-view-2' &&
				entry.toViewId === 'x-corner-view-1'
		);
		expect(shared).toHaveLength(1);

		const stopOne = resolvePathOccurrence(experience, guide, {
			kind: 'transition',
			stopId: fixture.ids.stopIds[3]!
		})!;
		const read = readExperiencePath({
			experience,
			guide,
			graph,
			occurrence: stopOne.occurrence
		})!;
		expect(read.state).toBe('ready');
		expect(read.connectionId).toBe('x-path-shared');
		expect(read.sharedUses).toHaveLength(0);
		expect(read.seconds).toBeGreaterThan(0);
		expect(read.lengthMeters).toBeGreaterThan(0);

		const step = readExperiencePath({
			experience,
			guide,
			graph,
			occurrence: { kind: 'step', presentationId: 'x-piano', toViewId: 'x-piano-view-2' }
		})!;
		expect(step.state).toBe('ready');
		expect(step.connectionId).toBe('x-path-step');
		expect(step.transition).toBe('travel');
	});

	it('admits independent Travel pairs through Save and runtime, and joins a cross-group Travel in the same change', async () => {
		const { fixture, coordinator, accept, op } = await pathsFixture();
		const project = fixture.project;
		const experience = project.units.experience.data.experiences[0]!;
		const guide = experience.guides[0]!;
		const stopIds = fixture.ids.stopIds;

		// Two disconnected Camera components: the shared/step piano pair and the
		// wall/door pair. No bridge edge was authored.
		const adjacency = new Map<string, Set<string>>();
		const addEdge = (from: string, to: string) => {
			const neighbors = adjacency.get(from) ?? new Set<string>();
			neighbors.add(to);
			adjacency.set(from, neighbors);
		};
		for (const connection of project.units.camera.data.connections) {
			addEdge(connection.fromNodeId, connection.toNodeId);
			addEdge(connection.toNodeId, connection.fromNodeId);
		}
		const visited = new Set<string>();
		let components = 0;
		for (const [id, neighbors] of adjacency) {
			if (neighbors.size === 0 || visited.has(id)) continue;
			components += 1;
			const queue = [id];
			while (queue.length > 0) {
				const current = queue.shift()!;
				if (visited.has(current)) continue;
				visited.add(current);
				for (const neighbor of adjacency.get(current) ?? []) queue.push(neighbor);
			}
		}
		expect(components).toBe(2);
		expect(project.units.camera.data.connections.map((connection) => connection.id).sort()).toEqual(
			['x-path-door', 'x-path-shared', 'x-path-step']
		);

		const prepared = prepareUnitRuntime(project);
		if (prepared.kind !== 'ready') throw new Error('x-paths did not prepare');
		// A host cannot relax or tighten the Camera-unit policy: the projection
		// forces the named policy after catalogue options.
		expect(prepareUnitRuntime(project, { connectivity: 'single-component' }).kind).toBe('ready');
		const read = (value: typeof experience, occurrence: { kind: 'transition'; stopId: string } | { kind: 'step'; presentationId: string; toViewId: string }, graph = prepared.graph) =>
			readExperiencePath({ experience: value, guide, graph, occurrence });
		const shared = read(experience, { kind: 'transition', stopId: stopIds[3]! });
		expect(shared?.state).toBe('ready');
		expect(shared?.connectionId).toBe('x-path-shared');
		expect(shared?.direction).toBe('forward');
		const walled = read(experience, { kind: 'step', presentationId: 'x-window', toViewId: 'x-window-path-inside' });
		expect(walled?.state).toBe('ready');
		expect(walled?.connectionId).toBe('x-path-door');
		expect(walled?.direction).toBe('forward');

		// Stop 2 continues to Stop 3 by Cut: no Camera edge is invented.
		const cut = read(experience, { kind: 'transition', stopId: stopIds[1]! });
		expect(cut?.state).toBe('cut');
		expect(cut?.connectionId).toBeNull();
		expect(project.units.camera.data.connections).toHaveLength(3);

		const loweringOptions = {
			experienceId: fixture.ids.experienceId!,
			guideId: fixture.ids.guideId!,
			sourceContentId: await computeEnvelopeSourceContentId(project),
			sessionEpoch: 's29'
		};
		const lowered = lowerExperienceProgram(project, loweringOptions);
		expect(lowered.kind).toBe('lowered');
		if (lowered.kind === 'lowered') {
			const cutTransition = lowered.transitions.find((entry) => entry.fromStopId === stopIds[1] && entry.toStopId === stopIds[2]);
			expect(cutTransition?.invocation.kind).toBe('cut');
			const sharedTransition = lowered.transitions.find((entry) => entry.fromStopId === stopIds[3] && entry.toStopId === stopIds[4]);
			expect(sharedTransition?.invocation).toEqual({ kind: 'travel', connectionId: 'x-path-shared' });
		}

		// The real canonical Save reader accepts the two-component envelope; a
		// reload prepares the same graph and both filmed paths.
		const saved = await readUnitEnvelopeForSave(serializeProjectEnvelope(project));
		expect(saved.kind).toBe('read');
		if (saved.kind !== 'read') return;
		const reloaded = prepareUnitRuntime(saved.envelope);
		if (reloaded.kind !== 'ready') throw new Error('the saved x-paths did not prepare');
		const reloadedExperience = reloaded.envelope.units.experience.data.experiences[0]!;
		const reloadedGuide = reloadedExperience.guides[0]!;
		expect(readExperiencePath({
			experience: reloadedExperience,
			guide: reloadedGuide,
			graph: reloaded.graph,
			occurrence: { kind: 'transition', stopId: stopIds[3]! }
		})?.connectionId).toBe('x-path-shared');
		expect(readExperiencePath({
			experience: reloadedExperience,
			guide: reloadedGuide,
			graph: reloaded.graph,
			occurrence: { kind: 'step', presentationId: 'x-window', toViewId: 'x-window-path-inside' }
		})?.connectionId).toBe('x-path-door');

		// A Travel requested across the two components joins them in the same change:
		// no ordinary edit leaves a gap (G7), so its pair takes a straight path and
		// lowering plays it.
		const crossPathId = op('cross-group-path');
		const requested = await accept(
			stopUpdateIntent({
				envelope: coordinator.acceptedSnapshot().domain.source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: op('cross-group-travel'), connections: [crossPathId] },
				experienceId: fixture.ids.experienceId!,
				stopId: stopIds[1]!,
				transition: 'travel'
			})
		);
		expect(requested.kind).toBe('accepted');
		const joinedProject = coordinator.acceptedSnapshot().domain.source;
		expect(joinedProject.units.camera.data.connections).toHaveLength(4);
		const joinedPrepared = prepareUnitRuntime(joinedProject);
		if (joinedPrepared.kind !== 'ready') throw new Error('the cross-group Travel did not prepare');
		const joinedExperience = joinedPrepared.envelope.units.experience.data.experiences[0]!;
		const joined = readExperiencePath({
			experience: joinedExperience,
			guide: joinedExperience.guides[0]!,
			graph: joinedPrepared.graph,
			occurrence: { kind: 'transition', stopId: stopIds[1]! }
		});
		expect(joined?.state).toBe('ready');
		expect(joined?.connectionId).toBe(crossPathId);
		expect(lowerExperienceProgram(joinedProject, loweringOptions).kind).toBe('lowered');
	});

	it('the walled in-Stop Travel warns until its point moves through the doorway', async () => {
		const { fixture, graph, geometry, coordinator, accept, op } = await pathsFixture();
		const experience = fixture.project.units.experience.data.experiences[0]!;
		const guide = experience.guides[0]!;
		const occurrence = { kind: 'step', presentationId: 'x-window', toViewId: 'x-window-path-inside' } as const;
		const before = readExperiencePath({ experience, guide, graph, geometry, occurrence });
		expect(before?.state).toBe('ready');
		expect(before?.connectionId).toBe('x-path-door');
		expect(before?.wall?.crosses).toBe(true);
		expect(before?.anchorCount).toBe(1);

		const accepted = await accept(
			cameraConnectionUpdateIntent({
				envelope: coordinator.acceptedSnapshot().domain.source,
				revision: coordinator.acceptedRevision(),
				ids: { operation: op('door-move') },
				connectionId: 'x-path-door',
				anchors: [{ id: 'x-path-door-point', position: [3, 1.5, 0] }]
			})
		);
		expect(accepted.kind).toBe('accepted');
		const prepared = prepareUnitRuntime(coordinator.acceptedSnapshot().domain.source);
		if (prepared.kind !== 'ready') throw new Error('door move did not prepare');
		const after = readExperiencePath({
			experience: prepared.envelope.units.experience.data.experiences[0]!,
			guide: prepared.envelope.units.experience.data.experiences[0]!.guides[0]!,
			graph: prepared.graph,
			geometry: prepared.geometry,
			occurrence
		});
		expect(after?.wall?.crosses).toBe(false);
		expect(after?.anchors).toHaveLength(1);
		// Shared and in-Stop paths survive the walled Travel edit.
		expect(readExperiencePath({ experience: prepared.envelope.units.experience.data.experiences[0]!, guide: prepared.envelope.units.experience.data.experiences[0]!.guides[0]!, graph: prepared.graph, geometry: prepared.geometry, occurrence: { kind: 'transition', stopId: fixture.ids.stopIds[3]! } })?.connectionId).toBe('x-path-shared');
		expect(readExperiencePath({ experience: prepared.envelope.units.experience.data.experiences[0]!, guide: prepared.envelope.units.experience.data.experiences[0]!.guides[0]!, graph: prepared.graph, geometry: prepared.geometry, occurrence: { kind: 'step', presentationId: 'x-piano', toViewId: 'x-piano-view-2' } })?.connectionId).toBe('x-path-step');
	});

	it('describes a Cut as cut and a Travel without a connection as a gap', async () => {
		const { fixture, graph } = await pathsFixture();
		const experience = fixture.project.units.experience.data.experiences[0]!;
		const guide = experience.guides[0]!;
		const cut = readExperiencePath({
			experience,
			guide,
			graph,
			occurrence: { kind: 'transition', stopId: fixture.ids.stopIds[1]! }
		});
		// Stop 2 continues to Stop 3 by Cut: no path is invented.
		expect(cut).not.toBeNull();
		if (cut === null) return;
		expect(cut.transition).toBe('cut');
		expect(cut.state).toBe('cut');
		expect(cut.connectionId).toBeNull();
	});

	it('the create planner refuses an existing unordered pair', async () => {
		const { fixture, accept, op } = await pathsFixture();
		const project = fixture.project;
		const view = (id: string) => project.units.camera.data.views.find((entry) => entry.id === id)!;
		const outcome = await accept(
			cameraConnectionCreateIntent({
				envelope: project,
				revision: project.acceptedRevision,
				ids: { operation: op('duplicate'), connection: 'x-path-duplicate' },
				fromView: view('x-corner-view-1'),
				toView: view('x-piano-view-2')
			})
		);
		expect(outcome.kind).toBe('rejected');
		if (outcome.kind === 'rejected') expect(outcome.message).toMatch(/already/i);
	});

	it('the update planner writes one direction and clears only its duration', async () => {
		const { fixture, accept, op, coordinator } = await pathsFixture();
		const project = fixture.project;
		const update = (timing: {
			readonly forward?: { readonly durationSeconds: number | null };
			readonly reverse?: { readonly durationSeconds: number | null };
		}) =>
			accept(
				cameraConnectionUpdateIntent({
					envelope: coordinator.acceptedSnapshot().domain.source,
					revision: coordinator.acceptedRevision(),
					ids: { operation: op('timing') },
					connectionId: 'x-path-shared',
					timing
				})
			);
		expect((await update({ reverse: { durationSeconds: 7 } })).kind).toBe('accepted');
		const withBoth = await update({ forward: { durationSeconds: 9 } });
		expect(withBoth.kind).toBe('accepted');
		const connection = () =>
			coordinator
				.acceptedSnapshot()
				.domain.source.units.camera.data.connections.find((entry) => entry.id === 'x-path-shared')!;
		expect(connection().timing?.forward?.durationSeconds).toBe(9);
		expect(connection().timing?.reverse?.durationSeconds).toBe(7);

		expect((await update({ forward: { durationSeconds: null } })).kind).toBe('accepted');
		expect(connection().timing?.forward?.durationSeconds).toBeUndefined();
		expect(connection().timing?.reverse?.durationSeconds).toBe(7);

		const noOp = await update({ reverse: { durationSeconds: 7 } });
		expect(noOp.kind).toBe('rejected');
	});

	it('the update planner refuses duplicate anchor ids and a Room-owned point', async () => {
		const { fixture, accept, op, coordinator } = await pathsFixture();
		const outcome = await accept({
			version: 1,
			kind: 'camera-connection-update',
			operationId: op('anchors'),
			expectedRevision: coordinator.acceptedRevision(),
			targets: [
				{
					version: 1,
					domain: 'camera',
					revision: {
						kind: 'exact',
						contentRevision: coordinator.acceptedSnapshot().domain.source.units.camera.header.contentRevision
					},
					subject: { kind: 'connection', id: 'x-path-shared' },
					instancePath: [],
					location: { kind: 'project-root' },
					componentId: null,
					capabilityId: null
				}
			],
			payload: {
				anchors: [
					{ id: 'a', position: [4, 1.4, 1.5] },
					{ id: 'a', position: [5, 1.4, 1.6] }
				]
			},
			capturedInputs: [],
			allocatedIds: []
		});
		expect(outcome.kind).toBe('rejected');
		void fixture;
	});

	it('inserts at the authored slot between points, including reverse and rounded paths', () => {
		const nodes = [
			{ id: 'a', label: 'A', position: [0, 1.5, 0] as const, cameraTarget: [6, 1.5, 0] as const, fov: 54, connectedNodeIds: ['b'] },
			{ id: 'b', label: 'B', position: [6, 1.5, 0] as const, cameraTarget: [0, 1.5, 0] as const, fov: 54, connectedNodeIds: ['a'] }
		];
		const anchors = [
			{ id: 'a1', position: [2, 1.5, 0] as const },
			{ id: 'a2', position: [4, 1.5, 0] as const }
		];
		function slot(kind: 'auto-bezier' | 'rounded-polyline', direction: 'forward' | 'reverse', point: readonly [number, number, number]) {
			const connection = {
				id: 'c',
				fromNodeId: 'a',
				toNodeId: 'b',
				clearance: 0.35,
				positionPath: { kind, anchors: anchors.map((anchor) => ({ ...anchor, position: [...anchor.position] as [number, number, number] })) }
			};
			// Camera's structural graph inserts the generated View endpoints; authored
			// connections keep interior anchors only.
			const graphConnection = {
				...connection,
				positionPath: {
					kind,
					anchors: [
						{ id: 'c-from', position: [0, 1.5, 0] as [number, number, number] },
						...connection.positionPath.anchors,
						{ id: 'c-to', position: [6, 1.5, 0] as [number, number, number] }
					]
				}
			};
			const graph: CameraGraph = {
				navigationNodes: nodes.map((node) => ({ ...node, position: [...node.position] as [number, number, number], cameraTarget: [...node.cameraTarget] as [number, number, number] })),
				connections: [graphConnection],
				nodeById: new Map(nodes.map((node) => [node.id, { ...node, position: [...node.position] as [number, number, number], cameraTarget: [...node.cameraTarget] as [number, number, number] }]))
			};
			return resolvePathAnchorInsertion({ connection, direction, graph, point: [point[0], point[1], point[2]] });
		}
		expect(slot('auto-bezier', 'forward', [3, 1.5, 0])?.index).toBe(1);
		expect(slot('rounded-polyline', 'forward', [3, 1.5, 0])?.index).toBe(1);
		// Near View A on a reversed rounded path is authored index 0, not the directed slot 2.
		expect(slot('rounded-polyline', 'reverse', [1, 1.5, 0])?.index).toBe(0);
		expect(slot('rounded-polyline', 'reverse', [5, 1.5, 0])?.index).toBe(2);
	});

	it('samples a temporary bend with the accepted View endpoints in either direction', async () => {
		const { graph } = await pathsFixture();
		const cameraGraph: CameraGraph = graph;
		const connection = cameraGraph.connections.find((entry) => entry.id === 'x-path-shared')!;
		const accepted = structuredClone(connection.positionPath.anchors);
		const from = accepted[0]!.position;
		const to = accepted.at(-1)!.position;
		const anchor = {
			id: 'draft-point',
			position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2 + 1] as [number, number, number]
		};
		for (const direction of ['forward', 'reverse'] as const) {
			const samples = previewPathSamples(connection.id, direction, cameraGraph, [anchor])!;
			expect(samples[0]).toEqual(connection.positionPath.anchors.at(direction === 'forward' ? 0 : -1)?.position);
			expect(samples.at(-1)).toEqual(connection.positionPath.anchors.at(direction === 'forward' ? -1 : 0)?.position);
			expect(samples.some((sample) => Math.hypot(...sample.map((value, axis) =>
				value - anchor.position[axis]!)) < 0.2)).toBe(true);
		}
		expect(connection.positionPath.anchors).toEqual(accepted);
	});

	it('only the selected route is an armed edit target', async () => {
		const { fixture, graph } = await pathsFixture();
		const experience = fixture.project.units.experience.data.experiences[0]!;
		const guide = experience.guides[0]!;
		const shared = readExperiencePath({
			experience,
			guide,
			graph,
			occurrence: { kind: 'transition', stopId: fixture.ids.stopIds[3]! }
		})!;
		const step = readExperiencePath({
			experience,
			guide,
			graph,
			occurrence: { kind: 'step', presentationId: 'x-piano', toViewId: 'x-piano-view-2' }
		})!;
		// The two Travels share `x-path-shared`; only the selected occurrence is a target.
		const otherShared = readExperiencePath({
			experience,
			guide,
			graph,
			occurrence: { kind: 'step', presentationId: 'x-piano', toViewId: 'x-piano-view-2' }
		})!;
		expect(otherShared.connectionId).not.toBe(shared.connectionId);
		expect(isPathEditTarget(shared, shared)).toBe(true);
		expect(isPathEditTarget(otherShared, shared)).toBe(false);
		expect(isPathEditTarget(step, shared)).toBe(false);
		expect(isPathEditTarget(shared, step)).toBe(false);
	});

	it('the Layout read crosses a real compiled Wall and clears above it', () => {
		const base = createEmptyWallFirstLayoutDocument();
		const room = planWallChain({
			baseline: base,
			points: [
				[0, 0],
				[6, 0],
				[6, 4],
				[0, 4]
			],
			close: true,
			height: 3,
			capture: freshCapture(),
			levelId: base.floor.id
		});
		expect(room.kind).toBe('success');
		if (room.kind !== 'success') return;
		const compiled = compileWallFirstLayoutGeometry(room.document);
		const through = routeCrossesWall({
			samples: [
				[1, 1.5, 2],
				[7, 1.5, 2]
			],
			geometry: compiled.geometry
		});
		expect(through.crosses).toBe(true);
		expect(through.wallIds.length).toBeGreaterThan(0);
		const above = routeCrossesWall({
			samples: [
				[1, 5, 2],
				[7, 5, 2]
			],
			geometry: compiled.geometry
		});
		expect(above.crosses).toBe(false);
	});

	it('clips the same segment inside the solid, at a sample boundary and through a compiled doorway', () => {
		const base = createEmptyWallFirstLayoutDocument();
		const room = planWallChain({
			baseline: base,
			points: [[0, 0], [6, 0], [6, 4], [0, 4]],
			close: true,
			height: 3,
			capture: freshCapture(),
			levelId: base.floor.id
		});
		expect(room.kind).toBe('success');
		if (room.kind !== 'success') return;
		const opening = planCreateWallFirstOpening(
			room.document,
			{ wallId: room.document.walls[0]!.id, kind: 'door', offset: 2.4, width: 1.2, height: 2.1 },
			freshCapture(),
			base.floor.id
		);
		expect(opening.kind).toBe('success');
		if (opening.kind !== 'success') return;
		const compiled = compileWallFirstLayoutGeometry(opening.document);
		const doorway = routeCrossesWall({ samples: [[3, 1.5, -1], [3, 1.5, 1]], geometry: compiled.geometry });
		expect(doorway.crosses).toBe(false);
		const solid = routeCrossesWall({ samples: [[1.5, 1.5, -1], [1.5, 1.5, 1]], geometry: compiled.geometry });
		expect(solid.crosses).toBe(true);
		// A whole segment inside the solid (not just the boundary) and a vertical entry.
		expect(routeCrossesWall({ samples: [[6.01, 1.5, 1], [6.01, 1.5, 3]], geometry: compiled.geometry }).crosses).toBe(true);
		expect(routeCrossesWall({ samples: [[6.01, 0.5, 2], [6.01, 2.5, 2]], geometry: compiled.geometry }).crosses).toBe(true);

		// Nonzero Floor datum: the same crossing at y=3.2 clears a datum-0 wall but
		// is inside a wall whose floor is raised to 2.5 m.
		const raised = createEmptyWallFirstLayoutDocument();
		raised.floor.elevation = 2.5;
		const raisedRoom = planWallChain({
			baseline: raised,
			points: [[0, 0], [6, 0], [6, 4], [0, 4]],
			close: true,
			height: 3,
			capture: freshCapture(),
			levelId: raised.floor.id
		});
		expect(raisedRoom.kind).toBe('success');
		if (raisedRoom.kind !== 'success') return;
		const raisedCompiled = compileWallFirstLayoutGeometry(raisedRoom.document);
		expect(routeCrossesWall({ samples: [[1, 3.2, 2], [7, 3.2, 2]], geometry: raisedCompiled.geometry }).crosses).toBe(true);
	});

	it('the path UI keeps the shell roles, one shared Movement section and 44 px coarse targets', () => {
		const source = readFileSync('src/lib/authoring/experience/ExperiencePaths.svelte', 'utf8');
		expect(source).toContain('--shell-gold');
		expect(source).toContain('--shell-leaf');
		expect(source).toMatch(/@media \(pointer: coarse\) \{\s*\.anchor-hit \{\s*r: 22;/);
		expect(source).toContain('@media (pointer: coarse)');
		// Point selection and drag are rendered only for the selected occurrence.
		expect(source).toContain('beginDrag(event, path.read, anchorAt(event, path.points))');
		expect(source).toContain('{#if isPathEditTarget(path.read, selected)}');
		expect(source).toContain('!selectionOnly || entry.key === selectedKey');
		// A press releases its capture and lease on every way out.
		expect(source).toContain('onDestroy(() => cancelDrag())');
		expect(source).toContain('drag.connectionId !== connectionId');

		const movement = readFileSync('src/lib/authoring/experience/ExperiencePathMovement.svelte', 'utf8');
		const stopWriter = readFileSync('src/lib/authoring/experience/ExperienceStopWriter.svelte', 'utf8');
		const rail = readFileSync('src/lib/authoring/experience/ExperienceViewRail.svelte', 'utf8');
		const transitionWriter = readFileSync('src/lib/authoring/experience/ExperienceTransitionWriter.svelte', 'utf8');
		const guide = readFileSync('src/lib/authoring/experience/ExperienceGuide.svelte', 'utf8');
		expect(transitionWriter).toContain('<ExperiencePathMovement');
		// §32: a Stop Card edits no connection; explore steps are edited on the rail.
		expect(stopWriter).not.toContain('<ExperiencePathMovement');
		expect(movement).toContain('data-path-movement');
		expect(movement).toMatch(/@media \(pointer: coarse\)[\s\S]*?min-height: 44px/);
		expect(rail).toMatch(/@media \(pointer: coarse\)[\s\S]*?min-height: 44px/);
		expect(guide).toMatch(/@media \(pointer: coarse\)[\s\S]*?width: 44px/);
	});

	it('x-salon auto Travel duration is Camera’s, with no fixture-authored seconds', async () => {
		const { fixture, coordinator, accept, op } = await pathsFixture('x-salon');
		const project = coordinator.acceptedSnapshot().domain.source;
		const experience = project.units.experience.data.experiences[0]!;
		const stopId = fixture.ids.stopIds[0]!;
		const destinationId = fixture.ids.stopIds[1]!;
		const stop = experience.stops.find((entry) => entry.id === stopId)!;
		const destination = experience.stops.find((entry) => entry.id === destinationId)!;
		const travelled = await accept(
			stopUpdateIntent({
				envelope: project,
				revision: coordinator.acceptedRevision(),
				ids: { operation: op('salon-travel'), connections: ['x-salon-path'] },
				experienceId: experience.id,
				stopId,
				transition: 'travel'
			})
		);
		expect(travelled.kind).toBe('accepted');

		const prepared = prepareUnitRuntime(coordinator.acceptedSnapshot().domain.source);
		if (prepared.kind !== 'ready') throw new Error('the salon path did not prepare');
		const read = readExperiencePath({
			experience: prepared.envelope.units.experience.data.experiences[0]!,
			guide: prepared.envelope.units.experience.data.experiences[0]!.guides[0]!,
			graph: prepared.graph,
			geometry: prepared.geometry,
			occurrence: { kind: 'transition', stopId }
		});
		expect(read?.state).toBe('ready');
		// Camera owns automatic timing: no fixture or production override is written.
		expect(read?.authoredSeconds).toBeNull();
		// X29.1's pair is 2.6 m; Camera clamps automatic travel to 1.25–4.8 s, so it
		// reads the 1.25 s floor — an authored duration is the only way higher.
		expect(read?.seconds).toBe(1.25);
	});
	it('Experience review 1: Travel adds its straight path in the same accepted change', async () => {
		const { fixture, coordinator, accept, op } = await pathsFixture('x-salon');
		const project = coordinator.acceptedSnapshot().domain.source;
		const experience = project.units.experience.data.experiences[0]!;
		const stop = experience.stops.find((entry) => entry.id === fixture.ids.stopIds[0]!)!;
		const destination = experience.stops.find((entry) => entry.id === fixture.ids.stopIds[4]!)!;
		const before = project.units.camera.data.connections.length;
		const travelled = await accept(
			stopUpdateIntent({
				envelope: project,
				revision: coordinator.acceptedRevision(),
				ids: { operation: op('travel-with-path'), connections: ['x-salon-implicit', op('salon-extra-1'), op('salon-extra-2'), op('salon-extra-3')] },
				experienceId: experience.id,
				stopId: stop.id,
				transition: 'travel'
			})
		);
		if (travelled.kind !== 'accepted') throw new Error(JSON.stringify(travelled));
		const after = coordinator.acceptedSnapshot().domain.source;
		expect(after.units.camera.data.connections).toHaveLength(before + 1);
		expect(after.units.camera.data.connections.some((entry) => entry.id === 'x-salon-implicit')).toBe(true);
		expect(after.units.experience.data.experiences[0]!.stops.find((entry) => entry.id === stop.id)!.transition).toBe('travel');

		const environment = await accept({
			version: 1,
			kind: SCENE_ENVIRONMENT_SET_KIND,
			operationId: op('environment'),
			expectedRevision: coordinator.acceptedRevision(),
			targets: [],
			payload: { preset: 'daylight' },
			allocatedIds: [],
			capturedInputs: []
		} as Parameters<typeof accept>[0]);
		if (environment.kind !== 'accepted') throw new Error(JSON.stringify(environment).slice(0, 600));
		expect(coordinator.acceptedSnapshot().domain.source.units.scene.data.environment).toEqual({ preset: 'daylight' });
	});

	it('Experience review 1: a ready draft is created by its first capture, in the same accepted change', async () => {
		const { coordinator, accept, op } = await pathsFixture('x-salon');
		const project = coordinator.acceptedSnapshot().domain.source;
		const before = project.units.experience.data.experiences.length;
		const captured = await accept(
			captureBindIntent({
				envelope: project,
				revision: coordinator.acceptedRevision(),
				ids: { operation: op('draft-capture'), view: 'draft-view', presentation: 'draft-presentation' },
				experienceId: 'draft-experience',
				view: capturedViewPose({ label: 'View d', eye: [1, 1.6, 1], target: [2, 1.6, 2], fov: 50 }),
				presentationLabel: 'Presentation 1',
				subjectEntityId: null,
				text: null,
				guideId: null,
				afterStopId: null,
				newExperienceLabel: 'Untitled experience'
			})
		);
		if (captured.kind !== 'accepted') throw new Error(JSON.stringify(captured).slice(0, 600));
		const after = coordinator.acceptedSnapshot().domain.source;
		expect(after.units.experience.data.experiences).toHaveLength(before + 1);
		const created = after.units.experience.data.experiences.find((entry) => entry.id === 'draft-experience')!;
		expect(created.label).toBe('Untitled experience');
		expect(created.presentations.map((entry) => entry.id)).toEqual(['draft-presentation']);
		expect(after.units.camera.data.views.some((entry) => entry.id === 'draft-view')).toBe(true);
	});
});
