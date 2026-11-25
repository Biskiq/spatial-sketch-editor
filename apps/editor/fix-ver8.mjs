import { readFileSync, writeFileSync } from 'node:fs';

function edit(path, pairs) {
	let source = readFileSync(path, 'utf8');
	for (const [find, replace] of pairs) {
		if (!source.includes(find)) throw new Error(`${path}: missing ${find.slice(0, 60)}`);
		source = source.split(find).join(replace);
	}
	writeFileSync(path, source);
}

edit('test-lanes.ts', [[
	`\t// Documentation cross-reference integrity. Durable and repo-wide: no product
\t// code imports a \`docs/\` link, so a moved file or a renamed section heading
\t// breaks a reader's route silently, in every lane and every build.
\t'tests/docs/documentation-references.test.ts',
`,
	''
]]);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (!pkg.scripts['test:tooling']) {
	pkg.scripts['test:tooling'] = 'vitest run --config vitest.tooling.config.ts';
	writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
}

if (!readFileSync('vitest.tooling.config.ts', 'utf8').includes('tooling-tests')) {
	writeFileSync('vitest.tooling.config.ts', `// Tooling lane: documentation references and performance-tooling tests.
//
// These files prove repository tooling, not the editor runtime, so they run
// outside \`test:fast\`, \`test:arch\` and \`test:heavy\`. The static CI job runs
// them with the lint step.
import { defineConfig } from 'vitest/config';

import { svelteTestSetup } from './vitest.shared';

export default defineConfig({
	...svelteTestSetup,
	test: {
		include: ['tooling-tests/**/*.test.ts'],
		environment: 'node'
	}
});
`);
}

console.log('ver8 edits applied');
