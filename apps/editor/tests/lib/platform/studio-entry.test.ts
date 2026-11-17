import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { studioEntryFromSearch, studioProjectUrl } from '../../../src/lib/platform/studio-entry';

const SRC = join(__dirname, '..', '..', '..', 'src');

describe('Object Studio entry addresses', () => {
	it('names the Studio posture on the ordinary spatial route', () => {
		expect(studioProjectUrl('project:1', { create: true })).toBe(
			'/project/project%3A1/spatial?create=1&entry=studio'
		);
		expect(studioProjectUrl('p', { load: true, object: 'a b' })).toBe(
			'/project/p/spatial?load=1&entry=studio&object=a%20b'
		);
		expect(studioProjectUrl('p')).toBe('/project/p/spatial?entry=studio');
	});

	it('reads the posture and one explicit root, never a guess', () => {
		expect(studioEntryFromSearch(new URLSearchParams('entry=studio&object=x'))).toEqual({ studio: true, objectId: 'x' });
		expect(studioEntryFromSearch(new URLSearchParams('entry=studio'))).toEqual({ studio: true, objectId: null });
		// An object without the posture is ignored, and an empty one names nothing.
		expect(studioEntryFromSearch(new URLSearchParams('object=x'))).toEqual({ studio: false, objectId: null });
		expect(studioEntryFromSearch(new URLSearchParams('entry=studio&object='))).toEqual({ studio: true, objectId: null });
		expect(studioEntryFromSearch(new URLSearchParams('entry=other'))).toEqual({ studio: false, objectId: null });
	});

	it('keeps the first-load routes free of the project model and Three', () => {
		const specifiers = (file: string): string[] =>
			[...readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]!);
		// The entry module itself imports nothing, like project-identity.
		expect(specifiers(join(SRC, 'lib', 'platform', 'studio-entry.ts'))).toEqual([]);
		for (const route of [['+page.svelte'], ['projects', '+page.svelte'], ['studio', '+page.svelte']]) {
			const imports = specifiers(join(SRC, 'routes', ...route));
			expect(imports.filter((specifier) => specifier === 'three' || specifier.startsWith('three/')), route.join('/')).toEqual([]);
			expect(imports.filter((specifier) => specifier === '@portfolio/project-model'), route.join('/')).toEqual([]);
			expect(imports.some((specifier) => specifier.includes('authoring/studio')), route.join('/')).toBe(false);
		}
	});
});
