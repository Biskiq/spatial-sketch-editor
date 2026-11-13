/**
 * E1/R1 — rendered objects are found by owned identity, never by name.
 *
 * Product code never searches a subtree by name (`getObjectByName`,
 * `getObjectByProperty('name', …)`) and never parses a debug name to learn what
 * an object is. Names remain on objects for debugging only. The owned index
 * (`objectOf`) and the `userData` identity tag are the only functional channels.
 */
import { describe, expect, it } from 'vitest';
import { readProductSources, scanTokens, type TokenRule } from '../../helpers/render-boundary-scan';

const RULES: readonly TokenRule[] = [
	{ name: 'getObjectByName', pattern: /\bgetObjectByName\b/ },
	{ name: 'getObjectByProperty-name', pattern: /\bgetObjects?ByProperty\(\s*['"]name['"]/ },
	{
		name: 'render-name-parsing',
		pattern: /\.name\s*(?:\.|\?\.)\s*(?:startsWith|endsWith|includes|indexOf|split|slice|substring|match|replace)\(\s*['"`](?:Visitor|SceneEntity|Stage)/
	}
];

describe('render identity boundary', () => {
	it('has no name search and no render-name parsing in product source', () => {
		expect(scanTokens(readProductSources(), RULES)).toEqual({});
	});

	describe('the scanner sees what it must', () => {
		const scan = (code: string) => scanTokens([{ file: 'synthetic.ts', code }], RULES)['synthetic.ts'] ?? [];

		it('flags a name search and a name parse', () => {
			expect(scan("root.getObjectByName(`VisitorPhysicalWall:${id}`)")).toEqual(['getObjectByName']);
			expect(scan("root.getObjectByProperty('name', 'x')")).toEqual(['getObjectByProperty-name']);
			expect(scan("mesh.name.startsWith('VisitorFloor:')")).toEqual(['render-name-parsing']);
			expect(scan("object?.name.startsWith(`SceneEntity:${id}`)")).toEqual(['render-name-parsing']);
		});

		it('ignores unrelated names and prose', () => {
			expect(scan("entity.name.startsWith('x')")).toEqual([]);
			expect(scan('// getObjectByName is forbidden')).toEqual([]);
		});
	});
});
