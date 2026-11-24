import { describe, expect, it, vi } from 'vitest';
import { createEmptyUnitEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';
import {
	actionsForIssue,
	classifyRuntimeFailure,
	createAppearanceIssues
} from '$lib/authoring/look/appearance-issues.svelte';
import { classifyFinishViewIssues } from '$lib/render/resources/finish-outcome-sink';

async function makeEnvelopeWithTwoUsers(options: { readonly overrides?: boolean } = {}): Promise<ProjectEnvelope> {
	const base = await createEmptyUnitEnvelope({
		id: 'proj-1',
		name: 'Test Project',
		acceptedRevision: { projectId: 'proj-1', revisionId: 'rev-1' }
	});
	const scene = {
		...base.units.scene.data,
		textures: [
			{
				id: 'tex-tile',
				name: 'client-tile_basecolor.png',
				uri: 'project-asset://tex-tile',
				mimeType: 'image/png' as const,
				sha256: 'sha256-abc123',
				pixelWidth: 256,
				pixelHeight: 256,
				byteLength: 128
			}
		],
		materials: [
			{
				id: 'fin-tile',
				name: 'Client Tile',
				base: { catalogue: 'plaster-warm' as const },
				...(options.overrides === false
					? {}
					: {
						overrides: {
							maps: {
								color: { image: { textureId: 'tex-tile' } }
							}
						}
					})
			}
		],
		entities: [
			{
				id: 'box-1',
				kind: 'primitive' as const,
				name: 'Box 1',
				primitive: 'box' as const,
				dimensions: { width: 1, height: 1, depth: 1 },
				position: [0, 0.5, 0] as [number, number, number],
				rotation: [0, 0, 0] as [number, number, number],
				materialId: 'plaster-warm' as const,
				materialInstanceId: 'fin-tile',
				castShadow: true,
				receiveShadow: true
			},
			{
				id: 'box-2',
				kind: 'primitive' as const,
				name: 'Box 2',
				primitive: 'box' as const,
				dimensions: { width: 1, height: 1, depth: 1 },
				position: [2, 0.5, 0] as [number, number, number],
				rotation: [0, 0, 0] as [number, number, number],
				materialId: 'plaster-warm' as const,
				materialInstanceId: 'fin-tile',
				castShadow: true,
				receiveShadow: true
			}
		]
	};
	const resources = {
		...base.units.resources!.data,
		resources: [
			{
				id: 'tex-tile',
				kind: 'texture' as const,
				name: 'client-tile_basecolor.png',
				mimeType: 'image/png',
				byteLength: 128,
				pin: { hash: 'sha256-abc123' },
				unresolved: null
			}
		]
	};
	return {
		...base,
		units: {
			...base.units,
			scene: { ...base.units.scene, data: scene },
			resources: { ...base.units.resources!, data: resources as unknown as NonNullable<ProjectEnvelope['units']['resources']>['data'] }
		}
	};
}

describe('appearance-issues service (T2.S8 · U6)', () => {
	it('classifies FinishViewIssue outcomes cleanly and never counts pending or budget as failed', () => {
		expect(classifyFinishViewIssues([], true)).toBe('ready');
		expect(classifyFinishViewIssues([], false)).toBe('pending');
		expect(
			classifyFinishViewIssues([{ code: 'texture-budget', role: 'color', uri: 'project-asset://a' }], false)
		).toBe('budget');
		expect(
			classifyFinishViewIssues(
				[{ code: 'image-load-failed', role: 'color', uri: 'project-asset://a', phase: 'acquire', httpStatus: 404 }],
				false
			)
		).toBe('failed');

		expect(
			classifyRuntimeFailure({ code: 'image-load-failed', role: 'color', phase: 'acquire', httpStatus: 404 })
		).toBe('image-unavailable');
		expect(
			classifyRuntimeFailure({ code: 'image-load-failed', role: 'color', phase: 'acquire', httpStatus: 503 })
		).toBe('image-unreachable');
		expect(
			classifyRuntimeFailure({ code: 'image-load-failed', role: 'color', phase: 'verify' })
		).toBe('image-mismatch');
		expect(
			classifyRuntimeFailure({ code: 'image-load-failed', role: 'color', phase: 'decode' })
		).toBe('image-undecodable');
	});

	it('scopes runtime failures strictly to affected targets and ignores pending/budget', async () => {
		const envelope = await makeEnvelopeWithTwoUsers();
		const service = createAppearanceIssues({ envelope: () => envelope });

		// Pending & budget never create issues or hatch.
		service.recordOutcome({
			targetKey: 'entity:box-1',
			finishKey: 'project:fin-tile',
			state: 'pending',
			issues: []
		});
		service.recordOutcome({
			targetKey: 'entity:box-2',
			finishKey: 'project:fin-tile',
			state: 'budget',
			issues: [{ code: 'texture-budget', role: 'color', uri: 'project-asset://tex-tile' }]
		});
		expect(service.count).toBe(0);
		expect(service.hatchedTargets.size).toBe(0);
		expect(service.budgetTargets.has('entity:box-2')).toBe(true);

		// Only box-1 fails at runtime; box-2 shares the Finish but is NOT affected.
		service.recordOutcome({
			targetKey: 'entity:box-1',
			finishKey: 'project:fin-tile',
			state: 'failed',
			issues: [
				{
					code: 'image-load-failed',
					role: 'color',
					uri: 'project-asset://tex-tile',
					phase: 'acquire',
					httpStatus: 404
				}
			]
		});
		expect(service.count).toBe(1);
		expect(service.open[0]?.code).toBe('image-unavailable');
		expect(service.open[0]?.affected).toEqual(['entity:box-1']);
		expect(service.hasIssuesForTarget('entity:box-1')).toBe(true);
		expect(service.hasIssuesForTarget('entity:box-2')).toBe(false);
		expect(service.open[0]?.actions.map((a) => a.label)).toEqual([
			'Relink…',
			'Replace image…',
			'Use colour instead'
		]);
	});

	it('canonicalises a pristine project instance to its curated Finish before merging', async () => {
		// A pristine instance renders exactly as its catalogue base; the Stage
		// still names `project:<id>` when it reports a failed image. The issue must
		// merge under the curated Finish that `inspectFinish` lists its users on.
		const envelope = await makeEnvelopeWithTwoUsers({ overrides: false });
		const service = createAppearanceIssues({ envelope: () => envelope });
		service.recordOutcome({
			targetKey: 'entity:box-1',
			finishKey: 'project:fin-tile',
			state: 'failed',
			issues: [
				{
					code: 'image-load-failed',
					role: 'color',
					uri: 'project-asset://tex-tile',
					phase: 'acquire',
					httpStatus: 404
				}
			]
		});
		expect(service.count).toBe(1);
		expect(service.open[0]?.code).toBe('image-unavailable');
		expect(service.open[0]?.finishKey).toBe('curated:plaster-warm');
		expect(service.open[0]?.affected).toEqual(['entity:box-1']);
	});

	it('Relink restores bytes with zero history, invalidates cache, and records a non-undoable fix', async () => {
		const envelope = await makeEnvelopeWithTwoUsers();
		const repairAsset = vi.fn(async () => ({ ok: true as const }));
		const invalidateAndReloadAsset = vi.fn();
		const service = createAppearanceIssues({
			envelope: () => envelope,
			repairAsset,
			invalidateAndReloadAsset
		});

		service.recordOutcome({
			targetKey: 'entity:box-1',
			finishKey: 'project:fin-tile',
			state: 'failed',
			issues: [
				{
					code: 'image-load-failed',
					role: 'color',
					uri: 'project-asset://tex-tile',
					phase: 'verify'
				}
			]
		});
		const issue = service.open[0]!;
		expect(issue.code).toBe('image-mismatch');

		const file = new File([new Uint8Array([1, 2, 3, 4])], 'client-tile_basecolor.png', { type: 'image/png' });
		const outcome = await service.relink(issue, file);
		expect(outcome.ok).toBe(true);
		expect(repairAsset).toHaveBeenCalledWith('tex-tile', expect.any(Uint8Array), 'sha256-abc123', expect.any(AbortSignal));
		expect(invalidateAndReloadAsset).toHaveBeenCalledWith('tex-tile');
		expect(service.count).toBe(0);
		expect(service.repaired).toHaveLength(1);
		expect(service.repaired[0]?.history).toBe('none');
	});

	it('ignores a relink completion after the project session is reset', async () => {
		const envelope = await makeEnvelopeWithTwoUsers();
		let resolveRepair: ((value: { ok: true }) => void) | undefined;
		const repairAsset = vi.fn((_assetId: string, _bytes: Uint8Array, _pin: string, _signal?: AbortSignal) =>
			new Promise<{ ok: true }>((resolve) => { resolveRepair = resolve; })
		);
		const invalidateAndReloadAsset = vi.fn();
		const service = createAppearanceIssues({ envelope: () => envelope, repairAsset, invalidateAndReloadAsset });
		service.recordOutcome({
			targetKey: 'entity:box-1',
			finishKey: 'project:fin-tile',
			state: 'failed',
			issues: [{ code: 'image-load-failed', role: 'color', uri: 'project-asset://tex-tile', phase: 'verify' }]
		});
		const pending = service.relink(service.open[0]!, new File([new Uint8Array([1])], 'tile.png'));
		await vi.waitFor(() => expect(resolveRepair).toBeDefined());
		const signal = repairAsset.mock.calls[0]![3];
		service.reset();
		expect(signal?.aborted).toBe(true);
		resolveRepair!({ ok: true });
		expect((await pending).ok).toBe(false);
		expect(invalidateAndReloadAsset).not.toHaveBeenCalled();
		expect(service.repaired).toHaveLength(0);
	});

	it('drops authored Repaired entries if Undo brings the issue back, and clears all on reset()', async () => {
		const envelope = await makeEnvelopeWithTwoUsers();
		const service = createAppearanceIssues({ envelope: () => envelope });

		service.noteRepaired({
			finishKey: 'project:fin-tile',
			finishName: 'Client Tile',
			code: 'image-unavailable',
			role: 'color',
			action: 'used colour instead',
			history: 'authored'
		});
		expect(service.repaired).toHaveLength(1);

		// Simulate Undo bringing the issue back: authored entry drops!
		service.recordOutcome({
			targetKey: 'entity:box-1',
			finishKey: 'project:fin-tile',
			state: 'failed',
			issues: [
				{
					code: 'image-load-failed',
					role: 'color',
					uri: 'project-asset://tex-tile',
					phase: 'acquire',
					httpStatus: 404
				}
			]
		});
		expect(service.repaired).toHaveLength(0);

		service.reset();
		expect(service.count).toBe(0);
		expect(service.repaired).toHaveLength(0);
	});

	it('offers the exact action table for model UV, normal frame, and unreachable image codes', () => {
		expect(
			actionsForIssue({ code: 'missing-uv', role: null, hasPin: false, hasMetricBasis: true }).map((a) => a.label)
		).toEqual(['Use UV set 0', 'Surface mapping']);
		expect(
			actionsForIssue({ code: 'missing-uv', role: null, hasPin: false, hasMetricBasis: false }).map((a) => a.label)
		).toEqual(['Use UV set 0']);
		expect(
			actionsForIssue({ code: 'missing-normal-frame', role: 'normal', hasPin: false, hasMetricBasis: false }).map(
				(a) => a.label
			)
		).toEqual(['Turn off relief']);
		expect(
			actionsForIssue({ code: 'image-unreachable', role: 'color', hasPin: true, hasMetricBasis: false }).map(
				(a) => a.label
			)
		).toEqual(['Retry']);
	});
});
