import { execFileSync } from 'node:child_process';
import { ARCH_FILES, HEAVY_FILES } from '../../apps/editor/test-lanes.ts';

const heavyFiles = new Set(HEAVY_FILES);

// Area cohorts include source-reading, mounted, and dynamically loaded tests
// that import-graph selection alone cannot reliably see. Keep the editor's
// authoring integration coverage for any editor change.
export function focusedFiles(plan, cwd = process.cwd()) {
	const paths = plan.changes.filter(({ profile }) => profile === 'focused').map(({ path }) => path);
	const areas = new Set(['authoring', 'design']);
	for (const path of paths) {
		const area = /^apps\/editor\/src\/lib\/([^/]+)\//.exec(path)?.[1];
		if (area) areas.add(area);
		if (/camera|navigation|experience|\/routes\//i.test(path)) {
			areas.add('experience');
			areas.add('museum');
		}
		if (!area || !['authoring', 'design', 'content', 'museum', 'render'].includes(area)) {
			for (const fallback of ['content', 'experience', 'museum', 'render']) areas.add(fallback);
		}
	}
	const cohort = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', plan.head, 'apps/editor/tests/lib'],
		{ cwd, encoding: 'utf8' }).split('\0')
		.filter((path) => /\.(?:test|spec)\.[jt]s$/.test(path))
		.map((path) => path.slice('apps/editor/'.length))
		.filter((path) => {
			const [, , area, subarea] = path.split('/');
			return areas.has(area) && !heavyFiles.has(path) && !(area === 'museum' && subarea === 'layout');
		});
	return [...new Set([...ARCH_FILES, ...cohort])].sort();
}
