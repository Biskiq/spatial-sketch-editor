import { describe, expect, it } from 'vitest';
import {
	WORLD_FAMILIES,
	WORLD_LIBRARY_CATEGORIES,
	WORLD_TOOLS,
	familyOf,
	familyTools,
	worldFamily,
	worldTool
} from '$lib/authoring/world-toolbar/registry';

describe('Living Draft World toolbar registry', () => {
	it('keeps ids unique and every family member declared', () => {
		expect(new Set(WORLD_TOOLS.map((tool) => tool.id)).size).toBe(WORLD_TOOLS.length);
		for (const family of WORLD_FAMILIES) {
			expect(family.tools).toContain(family.defaultTool);
			for (const member of familyTools(family)) {
				expect(member.family).toBe(family.id);
			}
		}
	});

	it('makes every planned row declare the post-merge branch that owns it', () => {
		for (const tool of WORLD_TOOLS.filter((entry) => entry.stage === 'planned')) {
			expect(['T1', 'T2', 'T5']).toContain(tool.after);
		}
		for (const tool of WORLD_TOOLS.filter((entry) => entry.stage === 'landed')) {
			expect(tool.after).toBeUndefined();
		}
	});

	it('resolves family ownership without a second vocabulary', () => {
		expect(familyOf('walls')?.id).toBe('build');
		expect(familyOf('objects')?.id).toBe('furnish');
		expect(familyOf('measure')).toBeNull();
		expect(worldTool('opening').label).toBe('Opening');
		expect(worldFamily('land').defaultTool).toBe('ground');
	});

	it('keeps the complete #285 library category set', () => {
		expect(WORLD_LIBRARY_CATEGORIES.map((category) => category.id)).toEqual([
			'objects',
			'materials',
			'my-objects',
			'lights',
			'plants',
			'buildings'
		]);
		expect(new Set(WORLD_LIBRARY_CATEGORIES.map((category) => category.label)).size).toBe(
			WORLD_LIBRARY_CATEGORIES.length
		);
	});
});
