import { execFileSync } from 'node:child_process';

// Area cohorts include source-reading, mounted, and dynamically loaded tests
// that import-graph selection alone cannot reliably see. Keep the editor's
// authoring integration coverage for any editor change.
export function focusedFiles(plan, cwd = process.cwd()) {
	const currentTests = execFileSync('git', ['ls-files', '-z', 'apps/editor/tests'], {
		cwd,
		encoding: 'utf8'
	})
		.split('\0')
		.filter((path) => path.endsWith('.test.ts'));
	const archFiles = currentTests
		.filter((path) => path.endsWith('.arch.test.ts'))
		.map((path) => path.slice('apps/editor/'.length));
	const heavyFiles = new Set(currentTests.filter((path) => path.endsWith('.heavy.test.ts')));
	const heavyBaseNames = new Set(
		[...heavyFiles].map((path) => path.replace(/\.heavy\.test\.ts$/, '.test.ts'))
	);
	const paths = plan.changes.filter(({ profile }) => profile === 'focused').map(({ path }) => path);
	const areas = new Set(['authoring', 'design']);
	for (const path of paths) {
		const area = /^apps\/editor\/src\/lib\/([^/]+)\//.exec(path)?.[1];
		if (area) areas.add(area);
		if (/camera|navigation|experience|\/routes\//i.test(path)) {
			areas.add('experience');
			areas.add('camera-core');
			areas.add('render');
		}
		if (!area || !['authoring', 'design', 'content', 'render'].includes(area)) {
			for (const fallback of ['content', 'experience', 'camera-core', 'render']) areas.add(fallback);
		}
	}
	const cohort = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', plan.head, 'apps/editor/tests/lib'],
		{ cwd, encoding: 'utf8' }).split('\0')
		.filter((path) => /\.(?:test|spec)\.[jt]s$/.test(path))
		.map((path) => path.slice('apps/editor/'.length))
		.filter((path) => {
			const [, , area, subarea] = path.split('/');
			return (
				areas.has(area) &&
				!heavyFiles.has(`apps/editor/${path}`) &&
				!heavyBaseNames.has(`apps/editor/${path}`) &&
				!(area === 'render' && subarea === 'layout')
			);
		});
	return [...new Set([...archFiles, ...cohort])].sort();
}
