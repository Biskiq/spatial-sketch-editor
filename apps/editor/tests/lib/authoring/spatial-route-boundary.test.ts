/**
 * X1 / schedule guarantee — route composes; controllers own effects.
 *
 * X1 removes the route's project-epoch and approved-asset ownership. This guard
 * proves the responsibility is actually gone rather than shadowed by a second
 * implementation:
 *
 * - the route constructs the epoch and asset controllers;
 * - no acceptance host, adapter mount loop, model lease map, route Undo/Redo
 *   implementation or replacement call remains in the route;
 * - the route has no direct host-acceptance import and no executable
 *   stage-adapter-host import; those belong to the epoch controller.
 *
 * The negative control applies the same predicate to a synthetic source, so a
 * pattern that can no longer detect the old defect fails here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	EDITOR_LIB,
	EDITOR_SRC,
	moduleBindingEdges,
	resolveSpecifier,
	stripComments
} from '../../helpers/import-closure';

const ROUTE = path.join(EDITOR_SRC, 'routes/project/[projectId]/spatial/+page.svelte');
const EPOCH = path.join(EDITOR_LIB, 'authoring/stage/route/stage-project-epoch.svelte.ts');
const ASSETS = path.join(EDITOR_LIB, 'authoring/stage/route/stage-asset-leases.svelte.ts');

const OWNERSHIP_SITES = [
	{ id: 'acceptance-host', pattern: /\bcreateStageAcceptanceHost\s*\(/ },
	{ id: 'adapter-mount', pattern: /\bmountStageAdapter\s*\(/ },
	{ id: 'adapter-services', pattern: /\bcreateStageAdapterServices\s*\(/ },
	{ id: 'replacement', pattern: /\bsession\.replace\s*\(/ },
	{ id: 'model-resolution', pattern: /\b(async function resolveModels|modelPinSignature|modelResolution|approvedModelPins|resolveApprovedModels)\b/ },
	{ id: 'route-history', pattern: /\basync function (undo|redo)\s*\(/ },
	{ id: 'artwork-lease', pattern: /\bstageArtworkScope\b/ },
	{ id: 'subscriptions', pattern: /\bunsubscribe(Contributions|Acceptance)\b/ },
	{ id: 'adapter-loop', pattern: /\bfor \(const factory of stageAdapterFactories\)/ }
] as const;

function ownershipSites(source: string): string[] {
	return OWNERSHIP_SITES.filter(({ pattern }) => pattern.test(source)).map(({ id }) => id);
}

const source = fs.readFileSync(ROUTE, 'utf8');
const code = stripComments(source);

describe('spatial route composition boundary (X1)', () => {
	it('constructs the extracted epoch and asset controllers', () => {
		expect(code).toContain('createStageProjectEpoch({');
		expect(code).toContain('createStageAssetLeases({');
		expect(code).toContain('stageEpoch.activate(snapshot)');
		expect(code).toContain('stageEpoch.markTornDown()');
		expect(code).toContain('stageEpoch.dispose()');
		expect(code).toContain('onUndo={() => void stageEpoch.undo()}');
		expect(code).toContain('onRedo={() => void stageEpoch.redo()}');
		expect(code).toContain('artworkScope={stageAssets.artworkScope}');
	});

	it('keeps no second epoch, history or asset-lease owner in the route', () => {
		expect(ownershipSites(code)).toEqual([]);
	});

	it('imports the controllers directly and stops importing their owners', () => {
		const edges = moduleBindingEdges(ROUTE, source);
		const resolved = edges.flatMap((edge) => {
			if (!('specifier' in edge)) return [];
			const target = resolveSpecifier(ROUTE, edge.specifier);
			return target === null ? [] : [{ edge, target }];
		});
		const direct = resolved.map(({ target }) => target);
		expect(direct).toContain(EPOCH);
		expect(direct).toContain(ASSETS);
		expect(resolved.filter(({ target }) => target.endsWith('host-acceptance.ts'))).toEqual([]);

		const executableAdapterHost = resolved.filter(
			({ edge, target }) =>
				target.endsWith('stage-adapter-host.ts') &&
				(!('typeOnly' in edge) || !edge.typeOnly)
		);
		expect(executableAdapterHost).toEqual([]);

		// The facade factory is the one permitted construction input to the epoch;
		// there is no second acceptance writer or adapter mount path.
		const facadeCreates = edges.filter(
			(edge) => edge.kind === 'import-named' && edge.imported === 'createStageFacade' && !edge.typeOnly
		);
		expect(facadeCreates).toHaveLength(1);
	});

	it('detects every old ownership site in a synthetic route source', () => {
		const synthetic = [
			"import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';",
			'const mounted = createStageAcceptanceHost({});',
			'mountStageAdapter(facade, mounted, factory);',
			'createStageAdapterServices(facade, mounted);',
			'session.replace(snapshot);',
			'async function resolveModels(snapshot) { return modelPinSignature; }',
			'async function undo() {}',
			'async function redo() {}',
			'stageArtworkScope.dispose();',
			'unsubscribeContributions?.();',
			'for (const factory of stageAdapterFactories) {}'
		].join('\n');
		expect(ownershipSites(stripComments(synthetic))).toEqual([
			'acceptance-host',
			'adapter-mount',
			'adapter-services',
			'replacement',
			'model-resolution',
			'route-history',
			'artwork-lease',
			'subscriptions',
			'adapter-loop'
		]);
	});
});
