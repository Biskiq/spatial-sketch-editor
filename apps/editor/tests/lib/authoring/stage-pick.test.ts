import { describe, expect, it, vi } from 'vitest';
import { resolveStagePick } from '../../../src/lib/authoring/stage/stage-pick';
import type { StageAdapterContext, StageDomainPick, StagePickQuery } from '../../../src/lib/authoring/stage/stage-facade';

const context = {} as StageAdapterContext;
const query: StagePickQuery = { css: [0, 0], evaluationId: 'e', purpose: 'select', tool: null };
function pick(depthMeters: number | null, planLayer: number, cssDistance = 0, refusal: string | null = null): StageDomainPick {
	return { hit: { sourceId: 'a', sourceKind: 'entity', reference: {} as never, worldPoint: [0, 0, 0] }, depthMeters, planLayer, cssDistance, refusal };
}

describe('stage pick arbitration', () => {
	it('chooses spatial winners without depending on registration order', () => {
		const providers = [
			{ adapterId: 'layout', binding: { pick: () => pick(1, 40, 2) } },
			{ adapterId: 'scene', binding: { pick: () => pick(2, 60, 0) } }
		];
		for (const order of [providers, [...providers].reverse()]) {
			expect(resolveStagePick(query, order, context, '3d')?.adapterId).toBe('layout');
			expect(resolveStagePick(query, order, context, 'plan')?.adapterId).toBe('scene');
		}
	});
	it('uses CSS distance within a millimetre', () => {
		const providers = [
			{ adapterId: 'b', binding: { pick: () => pick(1, 40, 2) } },
			{ adapterId: 'a', binding: { pick: () => pick(1.0009, 40, 1) } }
		];
		expect(resolveStagePick(query, providers, context, '3d')?.adapterId).toBe('a');
		expect(resolveStagePick(query, providers, context, 'plan')?.adapterId).toBe('a');
	});
	it('prefers a forward surface intersection to a tolerance hit, independent of registration order', () => {
		const providers = [
			{ adapterId: 'layout', binding: { pick: () => pick(null, 40, 0) } },
			{ adapterId: 'scene', binding: { pick: () => pick(10, 60, 5) } }
		];
		for (const order of [providers, [...providers].reverse()]) {
			expect(resolveStagePick(query, order, context, '3d')?.adapterId).toBe('scene');
		}
	});
	it('keeps a sole tolerance hit and orders null depths by distance and then id', () => {
		const providers = [
			{ adapterId: 'z', binding: { pick: () => pick(null, 40, 1) } },
			{ adapterId: 'a', binding: { pick: () => pick(null, 40, 1) } },
			{ adapterId: 'b', binding: { pick: () => pick(null, 40, 2) } }
		];
		expect(resolveStagePick(query, providers, context, '3d')?.adapterId).toBe('a');
		expect(resolveStagePick(query, [providers[0]!], context, '3d')?.adapterId).toBe('z');
	});
	it('routes tools only to declared providers and preserves refusals', () => {
		const layout = vi.fn(() => pick(1, 40, 0, 'no'));
		const scene = vi.fn(() => pick(2, 60));
		const other = vi.fn(() => pick(0, 99));
		const providers = [
			{ adapterId: 'layout', binding: { pick: layout, hostTools: ['probe'] } },
			{ adapterId: 'scene', binding: { pick: scene, hostTools: ['probe'] } },
			{ adapterId: 'other', binding: { pick: other } }
		];
		const host = { ...query, purpose: 'tool' as const, tool: { kind: 'probe', scope: 'host' as const } };
		expect(resolveStagePick(host, providers, context, '3d')?.pick.refusal).toBe('no');
		expect(other).not.toHaveBeenCalled();
		layout.mockClear(); scene.mockClear();
		const domain = { ...host, tool: { kind: 'ink', scope: 'domain' as const } };
		expect(resolveStagePick(domain, providers, context, '3d', 'scene')?.adapterId).toBe('scene');
		expect(layout).not.toHaveBeenCalled();
	});
});
