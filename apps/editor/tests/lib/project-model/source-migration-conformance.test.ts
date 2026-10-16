/**
 * The sole current-source converter — AM-7 conformance, one fixture per row of
 * the phase's converted/refused matrix.
 *
 * The behaviour under test is not "does it convert" but "does it convert
 * *without deciding policy*". Every ambiguous row must produce a typed refusal
 * until the caller supplies a reviewed decision, an identity or byte value that
 * can be preserved must be preserved exactly, and the source must be unchanged
 * on both preparation and refusal. Replay determinism is asserted from identical
 * captured inputs, because the operation is defined as pure.
 */
import { describe, expect, it } from 'vitest';

import {
	createEmptyWallFirstProject,
	type ProjectDocument,
	type SceneConnection,
	type SceneNavigationNode
} from '@portfolio/project-model';
import { prepareSourceMigration, type MigrationInput, type MigrationResult } from '@portfolio/project-model/migration';
import { serializeProjectEnvelope, verifyUnitContentRevisions } from '@portfolio/project-model/units';

function node(id: string, x: number, overrides: Partial<SceneNavigationNode> = {}): SceneNavigationNode {
	return { id, label: id, position: [x, 0, 0], cameraTarget: [x, 0, 1], fov: 54, connectedNodeIds: [], ...overrides };
}

function connection(id: string, fromNodeId: string, toNodeId: string, overrides: Partial<SceneConnection> = {}): SceneConnection {
	return {
		id,
		fromNodeId,
		toNodeId,
		positionPath: { kind: 'auto-bezier', anchors: [] },
		clearance: 0.5,
		...overrides
	};
}

function project(): ProjectDocument {
	return createEmptyWallFirstProject({ id: 'project-1', name: 'Project one' });
}

function input(source: unknown, overrides: Partial<MigrationInput> = {}): MigrationInput {
	return {
		source,
		baseline: { projectId: 'project-1', sourceContentId: 'sha256-source-1', storedVersion: '12' },
		acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
		policy: { entry: null, lockInteraction: {}, viewKeyHolds: {}, detours: {} },
		pins: [],
		...overrides
	};
}

function prepared(result: MigrationResult) {
	expect(result.kind).toBe('prepared');
	if (result.kind !== 'prepared') throw new Error('expected a prepared conversion');
	return result;
}

function refusalCodes(result: MigrationResult): string[] {
	expect(result.kind).toBe('refused');
	return result.kind === 'refused' ? result.refusals.map((refusal) => refusal.code) : [];
}

/** A two-node reciprocal open chain: node-1 continues to node-2. */
function openChain(): ProjectDocument {
	const document = project();
	document.scene.navigationNodes = [
		node('node-1', 0, { connectedNodeIds: ['node-2'], nextNodeId: 'node-2' }),
		node('node-2', 4, { connectedNodeIds: ['node-1'], previousNodeId: 'node-1', holdSeconds: 3 })
	];
	document.scene.connections = [connection('connection-1', 'node-1', 'node-2')];
	return document;
}

/**
 * A residual cycle: no head, so the old runtime cannot explain its order, and a
 * **sole** undirected connection closes it.
 */
function residualCycle(): ProjectDocument {
	const document = project();
	document.scene.navigationNodes = [
		node('node-1', 0, { connectedNodeIds: ['node-2'], nextNodeId: 'node-2', previousNodeId: 'node-2' }),
		node('node-2', 4, { connectedNodeIds: ['node-1'], nextNodeId: 'node-1', previousNodeId: 'node-1' })
	];
	document.scene.connections = [connection('connection-1', 'node-1', 'node-2')];
	return document;
}

/**
 * A three-node closed cycle carried by three **distinct** connections.
 *
 * The codec refuses a duplicate undirected connection, so a cycle carried by two
 * opposite connections between one pair is not a valid source at all; a distinct
 * closing edge is what makes the loop encodable in the first place. The order
 * links are the cycle `node-1 → node-2 → node-3 → node-1`.
 */
function distinctClosingCycle(): ProjectDocument {
	const document = project();
	document.scene.navigationNodes = [
		node('node-1', 0, { connectedNodeIds: ['node-2', 'node-3'], nextNodeId: 'node-2', previousNodeId: 'node-3' }),
		node('node-2', 4, { connectedNodeIds: ['node-1', 'node-3'], nextNodeId: 'node-3', previousNodeId: 'node-1' }),
		node('node-3', 8, { connectedNodeIds: ['node-2', 'node-1'], nextNodeId: 'node-1', previousNodeId: 'node-2' })
	];
	document.scene.connections = [
		connection('connection-1', 'node-1', 'node-2'),
		connection('connection-2', 'node-2', 'node-3'),
		connection('connection-3', 'node-3', 'node-1')
	];
	return document;
}

describe('the conversion matrix — converted rows', () => {
	it('wraps an empty project unchanged with explicit empty camera and Experience collections', async () => {
		const source = project();
		const { envelope, report } = prepared(await prepareSourceMigration(input(source)));
		expect(envelope.units.camera.data.views).toEqual([]);
		expect(envelope.units.camera.data.connections).toEqual([]);
		expect(envelope.units.experience.data.experiences).toHaveLength(1);
		expect(envelope.units.experience.data.experiences[0]!.guides).toEqual([]);
		expect(envelope.units.experience.data.experiences[0]!.entryGuideId).toBeNull();
		expect(envelope.units.experience.data.experiences[0]!.stops).toEqual([]);
		expect(envelope.units.scene.data.textures).toEqual(source.scene.textures);
		expect(envelope.units.scene.data.entities).toEqual(source.scene.entities);
		expect(report.views).toEqual([]);
		expect(await verifyUnitContentRevisions(envelope)).toEqual([]);
	});

	it('preserves a free-only node as a Camera view and a labelled Presentation, with no implied order', async () => {
		const source = project();
		source.scene.navigationNodes = [node('node-1', 0)];
		const { envelope, report } = prepared(await prepareSourceMigration(input(source)));
		const experience = envelope.units.experience.data.experiences[0]!;
		expect(envelope.units.camera.data.views.map((view) => view.id)).toEqual(['node-1']);
		expect(experience.presentations).toEqual([{ id: 'presentation:node-1', label: 'node-1', viewId: 'node-1' }]);
		expect(experience.stops).toEqual([]);
		expect(experience.guides).toEqual([]);
		expect(experience.entryGuideId).toBeNull();
		expect(report.views[0]).toMatchObject({ nodeId: 'node-1', presentationId: 'presentation:node-1', stopId: null, guideId: null });
	});

	it('maps a reciprocal open chain to one ordered Guide and preserves every identity and byte value', async () => {
		const source = openChain();
		const { envelope, report } = prepared(await prepareSourceMigration(input(source)));
		const experience = envelope.units.experience.data.experiences[0]!;
		expect(experience.guides).toEqual([
			{ id: 'guide:node-1', label: 'node-1', stopIds: ['stop:node-1', 'stop:node-2'], entryStopId: 'stop:node-1' }
		]);
		expect(experience.entryGuideId).toBe('guide:node-1');
		expect(experience.stops).toEqual([
			{
				id: 'stop:node-1',
				presentationId: 'presentation:node-1',
				continuation: { kind: 'sequence-next' }
			},
			{
				id: 'stop:node-2',
				presentationId: 'presentation:node-2',
				holdSeconds: 3,
				continuation: { kind: 'end' }
			}
		]);
		expect(envelope.units.camera.data.views).toEqual([
			{ id: 'node-1', label: 'node-1', eye: [0, 0, 0], target: [0, 0, 1], fov: 54, connectedViewIds: ['node-2'] },
			{ id: 'node-2', label: 'node-2', eye: [4, 0, 0], target: [4, 0, 1], fov: 54, connectedViewIds: ['node-1'] }
		]);
		expect(envelope.units.camera.data.connections.map((entry) => entry.id)).toEqual(['connection-1']);
		expect(report.connections).toEqual([{ connectionId: 'connection-1', fromViewId: 'node-1', toViewId: 'node-2' }]);
	});

	it('keeps each open component as its own Guide once the entry is supplied', async () => {
		const source = project();
		// Two open order components inside **one** connected graph: the codec admits a
		// single connected navigation graph, so the components are separated by the
		// order links alone (the bridging `node-2 / node-3` connection keeps the graph
		// connected) — the exact shape the component rule is about.
		source.scene.navigationNodes = [
			node('node-1', 0, { connectedNodeIds: ['node-2'], nextNodeId: 'node-2' }),
			node('node-2', 4, { connectedNodeIds: ['node-1', 'node-3'], previousNodeId: 'node-1' }),
			node('node-3', 9, { connectedNodeIds: ['node-2', 'node-4'], nextNodeId: 'node-4' }),
			node('node-4', 13, { connectedNodeIds: ['node-3'], previousNodeId: 'node-3' })
		];
		source.scene.connections = [
			connection('connection-1', 'node-1', 'node-2'),
			connection('connection-2', 'node-2', 'node-3'),
			connection('connection-3', 'node-3', 'node-4')
		];
		const without = await prepareSourceMigration(input(source));
		expect(refusalCodes(without)).toEqual(['requires-policy-mapping']);

		const withEntry = await prepareSourceMigration(
			input(source, {
				policy: {
					entry: { experienceId: 'experience-main', entryStopId: 'stop:node-3' },
					lockInteraction: {},
					viewKeyHolds: {},
					detours: {}
				}
			})
		);
		const { envelope } = prepared(withEntry);
		const experience = envelope.units.experience.data.experiences[0]!;
		expect(experience.id).toBe('experience-main');
		expect(experience.guides.map((guide) => guide.stopIds)).toEqual([
			['stop:node-1', 'stop:node-2'],
			['stop:node-3', 'stop:node-4']
		]);
		expect(experience.entryGuideId).toBe('guide:node-3');
	});

	it('re-bases a residual cycle on the supplied entry and encodes no loop for a sole two-node edge', async () => {
		const source = residualCycle();
		expect(refusalCodes(await prepareSourceMigration(input(source)))).toEqual(['requires-policy-mapping']);

		const { envelope } = prepared(
			await prepareSourceMigration(
				input(source, {
					policy: {
						entry: { experienceId: 'experience-cycle', entryStopId: 'stop:node-2' },
						lockInteraction: {},
						viewKeyHolds: {},
						detours: {}
					}
				})
			)
		);
		const experience = envelope.units.experience.data.experiences[0]!;
		expect(experience.guides[0]!.stopIds).toEqual(['stop:node-2', 'stop:node-1']);
		expect(experience.stops.find((stop) => stop.id === 'stop:node-1')!.continuation).toEqual({ kind: 'end' });
	});

	it('encodes a loop only when a distinct closing connection supports it, wherever the cycle is entered', async () => {
		const source = distinctClosingCycle();
		const entered = async (entryStopId: string) => {
			const { envelope } = prepared(
				await prepareSourceMigration(
					input(source, {
						policy: {
							entry: { experienceId: 'experience-cycle', entryStopId },
							lockInteraction: {},
							viewKeyHolds: {},
							detours: {}
						}
					})
				)
			);
			return envelope.units.experience.data.experiences[0]!;
		};

		// The closing edge belongs to the traversal, not to where the component's
		// head happens to be, so the loop is encoded for a mid-cycle entry too.
		const fromHead = await entered('stop:node-1');
		expect(fromHead.guides[0]!.stopIds).toEqual(['stop:node-1', 'stop:node-2', 'stop:node-3']);
		expect(fromHead.stops.find((stop) => stop.id === 'stop:node-3')!.continuation).toEqual({
			kind: 'stop',
			stopId: 'stop:node-1'
		});

		const fromMidCycle = await entered('stop:node-2');
		expect(fromMidCycle.guides[0]!.stopIds).toEqual(['stop:node-2', 'stop:node-3', 'stop:node-1']);
		expect(fromMidCycle.stops.find((stop) => stop.id === 'stop:node-1')!.continuation).toEqual({
			kind: 'stop',
			stopId: 'stop:node-2'
		});
	});

	it('resolves lockInteraction only from a reviewed decision, and maps a gate explicitly', async () => {
		const source = project();
		source.scene.navigationNodes = [node('node-1', 0, { lockInteraction: true })];
		expect(refusalCodes(await prepareSourceMigration(input(source)))).toEqual(['requires-policy-mapping']);

		const noGate = prepared(
			await prepareSourceMigration(
				input(source, {
					policy: { entry: null, lockInteraction: { 'node-1': { kind: 'no-gate' } }, viewKeyHolds: {}, detours: {} }
				})
			)
		);
		expect(noGate.report.lockInteraction).toEqual([{ nodeId: 'node-1', decision: 'no-gate' }]);
		expect(noGate.envelope.units.experience.data.experiences[0]!.gates).toEqual([]);

		const gated = prepared(
			await prepareSourceMigration(
				input(source, {
					policy: {
						entry: null,
						lockInteraction: {
							'node-1': { kind: 'gate', presentationId: 'presentation:node-1', reason: 'reviewed' }
						},
						viewKeyHolds: {},
						detours: {}
					}
				})
			)
		);
		expect(gated.envelope.units.experience.data.experiences[0]!.gates).toEqual([
			{ id: 'gate:node-1', presentationId: 'presentation:node-1' }
		]);

		const mismatched = await prepareSourceMigration(
			input(source, {
				policy: {
					entry: null,
					lockInteraction: { 'node-1': { kind: 'gate', presentationId: 'presentation:other', reason: 'reviewed' } },
					viewKeyHolds: {},
					detours: {}
				}
			})
		);
		expect(refusalCodes(mismatched)).toEqual(['policy-mismatch']);
	});

	it('requires a decision for every authored View-key hold and records the mapping', async () => {
		const source = openChain();
		source.scene.connections = [
			connection('connection-1', 'node-1', 'node-2', {
				viewTracks: {
					forward: [{ id: 'key-1', progress: 0.5, cameraTarget: [2, 0, 1], fov: 54, holdSeconds: 2 }],
					reverse: []
				}
			})
		];
		expect(refusalCodes(await prepareSourceMigration(input(source)))).toEqual(['requires-policy-mapping']);

		const mapped = prepared(
			await prepareSourceMigration(
				input(source, {
					policy: {
						entry: null,
						lockInteraction: {},
						viewKeyHolds: { 'connection-1/forward': { stopId: 'stop:node-1', holdSeconds: 2 } },
						detours: {}
					}
				})
			)
		);
		expect(mapped.report.retainedViewKeyHolds).toEqual([
			{
				connectionId: 'connection-1',
				direction: 'forward',
				authoredHoldSeconds: 2,
				stopId: 'stop:node-1',
				mappedHoldSeconds: 2
			}
		]);
		expect(mapped.envelope.units.experience.data.experiences[0]!.stops[0]!.holdSeconds).toBe(2);

		const conflicting = await prepareSourceMigration(
			input(source, {
				policy: {
					entry: null,
					lockInteraction: {},
					viewKeyHolds: { 'connection-1/forward': { stopId: 'stop:node-2', holdSeconds: 2 } },
					detours: {}
				}
			})
		);
		expect(refusalCodes(conflicting)).toEqual(['policy-mismatch']);
	});

	it('maps a detour only from a reviewed decision and refuses a self-origin', async () => {
		const source = openChain();
		source.scene.navigationNodes = [
			node('node-1', 0, { connectedNodeIds: ['node-2'], nextNodeId: 'node-2' }),
			node('node-2', 4, { connectedNodeIds: ['node-1'], previousNodeId: 'node-1' }),
			node('node-3', 8, { detourOfNodeId: 'node-1' })
		];
		expect(refusalCodes(await prepareSourceMigration(input(source)))).toEqual(['requires-policy-mapping']);

		const mapped = prepared(
			await prepareSourceMigration(
				input(source, {
					policy: {
						entry: null,
						lockInteraction: {},
						viewKeyHolds: {},
						detours: {
							'node-3': { fromStopId: 'stop:node-1', toStopId: 'stop:node-3', returnToStopId: 'stop:node-1' }
						}
					}
				})
			)
		);
		expect(mapped.envelope.units.experience.data.experiences[0]!.detours).toEqual([
			{ id: 'detour:node-3', fromStopId: 'stop:node-1', toStopId: 'stop:node-3', returnToStopId: 'stop:node-1' }
		]);
		expect(mapped.report.detours).toEqual([
			{ nodeId: 'node-3', detourId: 'detour:node-3', fromStopId: 'stop:node-1', toStopId: 'stop:node-3', returnToStopId: 'stop:node-1' }
		]);

		const selfOrigin = project();
		selfOrigin.scene.navigationNodes = [node('node-1', 0, { detourOfNodeId: 'node-1' })];
		expect(
			refusalCodes(
				await prepareSourceMigration(
					input(selfOrigin, {
						policy: {
							entry: null,
							lockInteraction: {},
							viewKeyHolds: {},
							detours: { 'node-1': { fromStopId: 'stop:node-1', toStopId: 'stop:node-1', returnToStopId: 'stop:node-1' } }
						}
					})
				)
			)
		).toEqual(['ambiguous-origin']);
	});

	it('keeps a texture identity with a typed unresolved status until a pin is staged', async () => {
		const source = project();
		// A texture URI is a safe **root-relative public path** in the landed codec.
		source.scene.textures = [{ id: 'texture-1', name: 'Paper', uri: '/textures/paper.png' }];
		const pending = prepared(await prepareSourceMigration(input(source)));
		expect(pending.envelope.units.resources.data.resources).toEqual([
			{
				kind: 'texture',
				id: 'texture-1',
				contentRevision: null,
				pin: null,
				unresolved: {
					reference: {
						version: 1,
						domain: 'resource:texture',
						revision: { kind: 'exact', contentRevision: 'sha256-source-1' },
						subject: { kind: 'resource', id: 'texture-1' },
						instancePath: [],
						location: { kind: 'project-root' },
						componentId: null,
						capabilityId: null
					},
					domain: 'resource:texture',
					status: 'repair-required',
					message: 'texture "texture-1" has no staged external pin; its bytes are not admitted'
				}
			}
		]);
		expect(pending.report.unresolved.map((entry) => entry.resourceId)).toEqual(['texture-1']);

		const pin = { hash: 'sha256-paper', mime: 'image/png', size: 512, locator: 'objects/paper' };
		const staged = prepared(
			await prepareSourceMigration(
				input(source, { pins: [{ kind: 'texture', id: 'texture-1', pin, contentRevision: pin.hash }] })
			)
		);
		expect(staged.envelope.units.resources.data.resources[0]).toEqual({
			kind: 'texture',
			id: 'texture-1',
			contentRevision: pin.hash,
			pin,
			unresolved: null
		});
		expect(staged.envelope.dependencyLock.entries.some((entry) => entry.pin?.hash === pin.hash)).toBe(true);
		expect(staged.report.unresolved).toEqual([]);
	});

	it('replays identically from identical captured inputs', async () => {
		const source = openChain();
		const first = prepared(await prepareSourceMigration(input(source)));
		const second = prepared(await prepareSourceMigration(input(source)));
		expect(serializeProjectEnvelope(second.envelope)).toBe(serializeProjectEnvelope(first.envelope));
		expect(second.report).toEqual(first.report);
	});
});

describe('the conversion matrix — refused rows', () => {
	it('refuses a malformed source and an unsupported source unit', async () => {
		expect(refusalCodes(await prepareSourceMigration(input({ id: 'project-1', name: 'Project one' })))).toContain(
			'invalid-source'
		);
		const source = project() as unknown as { scene: { formatVersion: number } };
		source.scene.formatVersion = 3;
		expect(refusalCodes(await prepareSourceMigration(input(source)))).toContain('unsupported-unit');
	});

	it('refuses an asymmetric order link rather than choosing one side', async () => {
		// Connectivity stays mutual, so the only defect is the order link: a
		// `nextNodeId` without the reciprocal `previousNodeId`. The landed source
		// codec refuses that shape itself — a valid post-#115 pair cannot carry it —
		// so the *source* is what refuses here, and the converter is never asked to
		// decide which side of an asymmetric link is right.
		const source = project();
		source.scene.navigationNodes = [
			node('node-1', 0, { connectedNodeIds: ['node-2'], nextNodeId: 'node-2' }),
			node('node-2', 4, { connectedNodeIds: ['node-1'] })
		];
		source.scene.connections = [connection('connection-1', 'node-1', 'node-2')];
		const codes = refusalCodes(await prepareSourceMigration(input(source)));
		expect(codes.length).toBeGreaterThan(0);
		expect(codes.every((code) => code === 'invalid-source')).toBe(true);
		const refusals = await prepareSourceMigration(input(source));
		if (refusals.kind !== 'refused') return;
		expect(refusals.refusals.map((refusal) => refusal.message)).toContain(
			'node-2.previousNodeId must equal node-1'
		);
	});

	it('refuses a connectivity edge to an unknown node', async () => {
		const source = project();
		source.scene.navigationNodes = [node('node-1', 0, { connectedNodeIds: ['node-absent'] })];
		expect(refusalCodes(await prepareSourceMigration(input(source)))).toContain('invalid-source');
	});

	it('refuses a conversion with no captured baseline or accepted revision', async () => {
		expect(
			refusalCodes(
				await prepareSourceMigration(
					input(project(), { baseline: { projectId: '', sourceContentId: '', storedVersion: null } })
				)
			)
		).toEqual(['missing-baseline']);
		expect(refusalCodes(await prepareSourceMigration(input(project(), { acceptedRevision: null })))).toEqual([
			'missing-revision'
		]);
		expect(
			refusalCodes(
				await prepareSourceMigration(
					input(project(), { acceptedRevision: { projectId: 'project-other', revisionId: 'revision-1' } })
				)
			)
		).toEqual(['missing-revision']);
	});

	it('leaves the source unchanged on preparation and on refusal', async () => {
		const source = openChain();
		const before = JSON.stringify(source);
		prepared(await prepareSourceMigration(input(source)));
		expect(JSON.stringify(source)).toBe(before);

		const broken = project();
		broken.scene.navigationNodes = [node('node-1', 0, { connectedNodeIds: ['node-absent'] })];
		const brokenBefore = JSON.stringify(broken);
		expect(refusalCodes(await prepareSourceMigration(input(broken)))).toContain('invalid-source');
		expect(JSON.stringify(broken)).toBe(brokenBefore);
	});
});
