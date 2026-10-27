/**
 * T2.P02.S03 — the approved model one Import leaves armed for placement.
 *
 * The arm is not a one-shot slot any more: a creator approves a model in an
 * empty project, is told to draw the missing floor first, and places it after
 * reopening Place. So the arm must survive a task switch without being consumed,
 * must never follow a Stage to another project, and must keep its definition
 * reachable after a rebind clears the provisional definition registry.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { NormalizedPlacementDefinition } from '@portfolio/project-model/scene-planning';

import {
	armedModelDefinition,
	clearArmedModel,
	clearCreatorDefinitions,
	creatorDefinitions,
	peekArmedModel,
	rememberArmedModel
} from '$lib/authoring/adapters/scene/import/definitions';
import type { ArmedModelPlacement } from '$lib/authoring/adapters/scene/placement';

const PROJECT = 'project-arm';
const OTHER = 'project-other';

function definition(definitionKey: string): NormalizedPlacementDefinition {
	return {
		definitionKey,
		metadataContentId: `sha256-${'a'.repeat(64)}`,
		footprintMeters: [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		],
		contactMinY: 0,
		creationDefaults: { kind: 'model' }
	} as unknown as NormalizedPlacementDefinition;
}

function armed(modelDefinition: NormalizedPlacementDefinition): ArmedModelPlacement {
	return { definition: modelDefinition, resource: null };
}

afterEach(() => {
	clearArmedModel(PROJECT);
	clearArmedModel(OTHER);
	clearCreatorDefinitions();
});

describe('pending approved model', () => {
	it('belongs to its project and never to a Stage showing another one', () => {
		rememberArmedModel(PROJECT, armed(definition('model:one')));

		expect(peekArmedModel(PROJECT)).not.toBeNull();
		expect(peekArmedModel(OTHER)).toBeNull();
		expect(armedModelDefinition(OTHER)).toBeNull();
	});

	it('survives repeated Place tasks until the placement commits', () => {
		const model = armed(definition('model:one'));
		rememberArmedModel(PROJECT, model);

		// Opening, closing and reopening Place only peeks; the arm is not consumed.
		expect(peekArmedModel(PROJECT)).toBe(model);
		expect(peekArmedModel(PROJECT)).toBe(model);

		clearArmedModel(PROJECT);
		expect(peekArmedModel(PROJECT)).toBeNull();
	});

	it('keeps its definition placeable after a rebind clears the registry', () => {
		const model = armed(definition('model:one'));
		rememberArmedModel(PROJECT, model);
		clearCreatorDefinitions();

		expect(creatorDefinitions()).toEqual([]);
		expect(armedModelDefinition(PROJECT)?.definitionKey).toBe('model:one');
	});

	it('clears only the project whose placement committed', () => {
		rememberArmedModel(PROJECT, armed(definition('model:one')));
		rememberArmedModel(OTHER, armed(definition('model:two')));

		clearArmedModel(PROJECT);

		expect(peekArmedModel(PROJECT)).toBeNull();
		expect(peekArmedModel(OTHER)?.definition.definitionKey).toBe('model:two');
	});
});
