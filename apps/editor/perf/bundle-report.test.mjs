import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { sealProvenance, sha256 } from './bundle-provenance.mjs';

const script = fileURLToPath(new URL('./bundle-report.mjs', import.meta.url));

test('bundle absence assertions require complete source evidence; file-only checks do not', () => {
	const root = mkdtempSync(join(tmpdir(), 'biskiq-bundle-regression-'));
	try {
		mkdirSync(join(root, 'server/nodes'), { recursive: true });
		mkdirSync(join(root, 'client/_app/immutable'), { recursive: true });
		writeFileSync(join(root, 'server/manifest.js'), 'client: {start:"start.js",app:"app.js",imports:[]}\nid: "/p/[publicationId]", page: { layouts: [], errors: [], leaf: 0 }');
		writeFileSync(join(root, 'server/nodes/0.js'), 'imports = ["visitor.js"]; stylesheets = []');
		for (const file of ['start.js', 'app.js', 'visitor.js']) writeFileSync(join(root, 'client', file), 'console.log(1);');
		const run = (flag, substring) => spawnSync(process.execPath, [script, '--out', root, flag, `/p/[publicationId]=${substring}`], { encoding: 'utf8' });
		const runOptions = (...options) => spawnSync(process.execPath, [script, '--out', root, ...options], { encoding: 'utf8' });
		const unavailable = run('--forbid', 'src/lib/absent/');
		assert.equal(unavailable.status, 1);
		assert.match(unavailable.stderr, /SOURCE ATTRIBUTION UNAVAILABLE/);
		assert.equal(run('--forbid-file', 'visitor.js').status, 1);
		assert.equal(run('--forbid-file', 'absent.js').status, 0);
		for (const file of ['start.js', 'app.js', 'visitor.js']) {
			writeFileSync(join(root, 'client', `${file}.map`), JSON.stringify({ version: 3, sources: ['../../src/lib/visitor/present.ts'], names: [], mappings: 'AAAA' }));
		}
		assert.equal(runOptions().status, 0); // Omitting provenance uses the complete source maps normally.
		for (const args of [['--provenance'], ['--provenance', ''], ['--provenance=']]) {
			const invalidSelection = runOptions(...args);
			assert.equal(invalidSelection.status, 2);
			assert.match(invalidSelection.stderr, /--provenance requires a non-empty path/);
		}
		const present = run('--forbid', 'src/lib/visitor/');
		assert.equal(present.status, 1);
		assert.match(present.stderr, /FORBIDDEN LOAD-SET ENTRY/);
		assert.equal(run('--forbid', 'src/lib/absent/').status, 0);
		// A map with no usable source identity is also unavailable evidence.
		writeFileSync(join(root, 'client/app.js.map'), JSON.stringify({ version: 3, sources: [], names: [], mappings: '' }));
		assert.equal(run('--forbid', 'src/lib/absent/').status, 1);
		// One missing map must also fail, even if the others provide module names.
		rmSync(join(root, 'client/app.js.map'));
		assert.equal(run('--forbid', 'src/lib/absent/').status, 1);
		writeFileSync(join(root, 'client/app.js.map'), JSON.stringify({ version: 3, sources: ['src/app.ts'], names: [], mappings: 'AAAA' }));
		rmSync(join(root, 'client/app.js'));
		assert.equal(run('--forbid', 'src/lib/absent/').status, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('explicit Rollup evidence binds complete module inventory to exact bytes and refuses corruption', () => {
	const root = mkdtempSync(join(tmpdir(), 'biskiq-provenance-regression-'));
	try {
		mkdirSync(join(root, 'server/nodes'), { recursive: true });
		mkdirSync(join(root, 'client/_app/immutable'), { recursive: true });
		writeFileSync(join(root, 'server/manifest.js'), 'client: {start:"start.js",app:"app.js",imports:[]}\nid: "/p/[publicationId]", page: { layouts: [], errors: [], leaf: 0 }');
		writeFileSync(join(root, 'server/nodes/0.js'), 'imports = ["visitor.js"]; stylesheets = []');
		const files = ['start.js', 'app.js', 'visitor.js', 'lazy.js'];
		for (const file of files) writeFileSync(join(root, 'client', file), 'export {};');
		const evidencePath = join(root, 'client/bundle-provenance.json');
		const chunks = files.map((file) => ({ file, sha256: sha256('export {};'), modules: [file === 'start.js' ? '\u0000virtual:generated-start' : '/repo/src/lib/visitor/present.ts'] }));
		const save = (records = chunks) => writeFileSync(evidencePath, JSON.stringify(sealProvenance(records)));
		const run = (substring = 'src/lib/authoring/') => spawnSync(process.execPath, [script, '--out', root, '--provenance', evidencePath, '--forbid', `/p/[publicationId]=${substring}`], { encoding: 'utf8' });
		const refuse = () => {
			const result = run();
			assert.equal(result.status, 1);
			assert.match(result.stderr, /SOURCE ATTRIBUTION UNAVAILABLE/);
		};
		refuse(); // Missing evidence.
		assert.equal(spawnSync(process.execPath, [script, '--out', root, '--provenance', evidencePath], { encoding: 'utf8' }).status, 1);
		save();
		assert.equal(run().status, 0); // No maps at all, including generated entry.
		assert.match(run('src/lib/visitor/').stderr, /FORBIDDEN LOAD-SET ENTRY/);
		assert.equal(run('virtual:generated-start').status, 1);
		// Map identities cannot be injected into the independently selected proof.
		for (const file of files) writeFileSync(join(root, 'client', `${file}.map`), JSON.stringify({ version: 3, sources: ['src/lib/authoring/injected.ts'], names: [], mappings: 'AAAA' }));
		assert.equal(run().status, 0);
		writeFileSync(evidencePath, '{'); refuse();
		writeFileSync(evidencePath, JSON.stringify({ ...sealProvenance(chunks), version: 2 })); refuse();
		const injected = sealProvenance(structuredClone(chunks));
		injected.chunks[0].modules.push('/repo/src/lib/authoring/injected.ts');
		writeFileSync(evidencePath, JSON.stringify(injected)); refuse();
		// Even resealed structural defects must fail, including a lazy chunk omission.
		for (const records of [chunks.slice(0, -1), [...chunks, chunks[0]], chunks.map((entry, index) => index ? entry : { ...entry, modules: [] }), chunks.map((entry, index) => index ? entry : { ...entry, modules: [''] }), chunks.map((entry, index) => index ? entry : { ...entry, file: '../start.js' })]) {
			save(records); refuse();
		}
		save(chunks.map((entry, index) => index ? entry : { ...entry, modules: null })); refuse(); // An asset cannot stand in for an entry's module evidence.
		save();
		writeFileSync(join(root, 'client/lazy.js'), 'export const changed = 1;'); refuse();
		writeFileSync(join(root, 'client/lazy.js'), 'export {};');
		writeFileSync(join(root, 'client/added.js'), 'export {};'); refuse();
		rmSync(join(root, 'client/added.js'));
		rmSync(join(root, 'client/start.js')); refuse();
	} finally { rmSync(root, { recursive: true, force: true }); }
});
