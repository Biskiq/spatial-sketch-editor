import { describe, expect, it } from 'vitest';
import { publicSurfaceBoundaryPlugin } from '../../vite/public-surface-boundary-plugin';

type ModuleInfo = { importedIds: string[]; dynamicallyImportedIds: string[] };

function stubContext(modules: Record<string, ModuleInfo>) {
	return {
		getModuleIds: () => Object.keys(modules),
		getModuleInfo: (id: string) => modules[id] ?? null
	};
}

const ROOT = '/src/routes/p/[publicationId]/+page.svelte';
const LOADER = '/src/lib/visitor/public-release-client.ts';

describe('public-surface boundary plugin (actual generateBundle)', () => {
	it('passes a clean public closure', () => {
		const plugin = publicSurfaceBoundaryPlugin() as unknown as {
			transform: (this: unknown, code: string, id: string) => unknown;
			generateBundle: (this: unknown, options: unknown, bundle: unknown) => void;
		};
		plugin.transform.call({}, `import Loader from './public-release-client';`, ROOT);
		plugin.transform.call({}, `export default 1;`, LOADER);
		const ctx = stubContext({
			[ROOT]: { importedIds: [LOADER], dynamicallyImportedIds: [] },
			[LOADER]: { importedIds: [], dynamicallyImportedIds: [] }
		});
		expect(() => plugin.generateBundle.call(ctx, {}, {})).not.toThrow();
	});

	it('passes a public closure that reaches runtime-safe evaluators', () => {
		// The control for the mutation proof below: the shared package evaluators
		// are admissible on the public route; only editor machinery is not.
		const plugin = publicSurfaceBoundaryPlugin() as unknown as {
			transform: (this: unknown, code: string, id: string) => unknown;
			generateBundle: (this: unknown, options: unknown, bundle: unknown) => void;
		};
		plugin.transform.call({}, `import Loader from './public-release-client';`, ROOT);
		const evaluator = '/packages/project-model/src/index.ts';
		plugin.transform.call({}, `import '@portfolio/project-model';`, LOADER);
		plugin.transform.call({}, `export default 1;`, evaluator);
		const ctx = stubContext({
			[ROOT]: { importedIds: [LOADER], dynamicallyImportedIds: [] },
			[LOADER]: { importedIds: [evaluator], dynamicallyImportedIds: [] },
			[evaluator]: { importedIds: [], dynamicallyImportedIds: [] }
		});
		expect(() => plugin.generateBundle.call(ctx, {}, {})).not.toThrow();
	});

	it('rejects a forbidden indirect editor import through the public loader', () => {
		const plugin = publicSurfaceBoundaryPlugin() as unknown as {
			transform: (this: unknown, code: string, id: string) => unknown;
			generateBundle: (this: unknown, options: unknown, bundle: unknown) => void;
		};
		// The live editor tree is `src/lib/authoring/`; the deleted `src/lib/editor/`
		// id this fixture named could no longer be rejected by the predicate.
		plugin.transform.call({}, `import './public-release-client';`, ROOT);
		plugin.transform.call({}, `import '../../authoring/f4/acceptance-coordinator';`, LOADER);
		plugin.transform.call({}, `export default 1;`, '/src/lib/authoring/f4/acceptance-coordinator.ts');
		const ctx = stubContext({
			[ROOT]: { importedIds: [LOADER], dynamicallyImportedIds: [] },
			[LOADER]: { importedIds: ['/src/lib/authoring/f4/acceptance-coordinator.ts'], dynamicallyImportedIds: [] },
			'/src/lib/authoring/f4/acceptance-coordinator.ts': { importedIds: [], dynamicallyImportedIds: [] }
		});
		expect(() => plugin.generateBundle.call(ctx, {}, {})).toThrow(/authoring/);
	});

	it('rejects a computed dynamic import in the public closure', () => {
		const plugin = publicSurfaceBoundaryPlugin() as unknown as {
			transform: (this: unknown, code: string, id: string) => unknown;
			generateBundle: (this: unknown, options: unknown, bundle: unknown) => void;
		};
		plugin.transform.call({}, `import Loader from './public-release-client';`, ROOT);
		plugin.transform.call({}, `export const m = import(specifier);`, LOADER);
		const ctx = stubContext({
			[ROOT]: { importedIds: [LOADER], dynamicallyImportedIds: [] },
			[LOADER]: { importedIds: [], dynamicallyImportedIds: [] }
		});
		expect(() => plugin.generateBundle.call(ctx, {}, {})).toThrow(/unresolved dynamic/);
	});

	it('fails when the public route root is absent', () => {
		const plugin = publicSurfaceBoundaryPlugin() as unknown as {
			transform: (this: unknown, code: string, id: string) => unknown;
			generateBundle: (this: unknown, options: unknown, bundle: unknown) => void;
		};
		const ctx = stubContext({
			'/src/lib/visitor/VisitorPreviewSurface.svelte': { importedIds: [], dynamicallyImportedIds: [] }
		});
		expect(() => plugin.generateBundle.call(ctx, {}, {})).toThrow(/missing root/);
	});
});
