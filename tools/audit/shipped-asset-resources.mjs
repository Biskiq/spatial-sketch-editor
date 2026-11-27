#!/usr/bin/env node
/**
 * Read-only D8a compatibility audit for persisted shipped-asset resources.
 *
 * It never writes to the database and never rewrites a resource record. Two
 * sources are inspected:
 *
 * 1. tracked text fixtures, seeds, SQL and source files containing an
 *    `asset`-kind resource record (best-effort extraction; the record's own file
 *    and line are always reported); and
 * 2. every project version in the authorized development database, when a
 *    connection string is supplied.
 *
 * Each record is classified against the committed production pin ledger:
 *
 *   matches        resolved and exactly the shipped revision
 *   no-revision    resolved but no contentRevision
 *   differs        resolved at another revision
 *   unresolved     carries an unresolved diagnostic
 *   unknown-asset  id outside the shipped pin registry (not a D8a failure)
 *   intentional    a test fixture that deliberately constructs a mismatch
 *
 * A record marked by a nearby `shipped-asset-audit: intentional-mismatch`
 * comment is reported but cannot block the gate.
 *
 * Usage:
 *   node tools/audit/shipped-asset-resources.mjs [--json] [--fail-on-incompatible]
 *   DATABASE_URL=postgresql://... node tools/audit/shipped-asset-resources.mjs
 *
 * Only a record for a pinned shipped id with `no-revision`, `differs` or
 * `unresolved` classifies as incompatible. `--fail-on-incompatible` exits 1 when
 * any such record exists, so the compatibility gate can be checked in CI.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const LEDGER = JSON.parse(
	readFileSync(resolve(ROOT, 'packages/project-model/shipped-model-pins.json'), 'utf8'),
);
const EXPECTED = new Map(
	Object.entries(LEDGER.models).map(([assetId, pin]) => [assetId, `sha256-${pin.sha256}`]),
);

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const failOnIncompatible = args.has('--fail-on-incompatible');
const databaseUrl = process.env.DATABASE_URL ?? '';
const trackedExtensions = /\.(?:ts|mts|js|mjs|json|sql)$/;

function classify(assetId, contentRevision, unresolved) {
	if (!EXPECTED.has(assetId)) return 'unknown-asset';
	if (unresolved && unresolved !== 'null') return 'unresolved';
	if (contentRevision === null || contentRevision === '') return 'no-revision';
	return contentRevision === EXPECTED.get(assetId) ? 'matches' : 'differs';
}

function textRecords() {
	const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
		.split('\0')
		.filter((file) => file && trackedExtensions.test(file));
	const records = [];
	for (const file of files) {
		const text = readFileSync(resolve(ROOT, file), 'utf8');
		const pattern = /\bkind\s*:\s*['"]asset['"]/g;
		for (const match of text.matchAll(pattern)) {
			const before = text.slice(Math.max(0, match.index - 400), match.index);
			const window = text.slice(Math.max(0, match.index - 200), match.index + 500);
			const id = /\bid\s*:\s*['"]([^'"]+)['"]/.exec(window)?.[1];
			if (id === undefined) continue;
			const revision = /\bcontentRevision\s*:\s*(?:['"]([^'"]*)['"]|null)/.exec(window);
			const contentRevision = revision === null ? null : (revision[1] ?? null);
			const unresolved =
				/\bunresolved\s*:\s*(null|['"][^'"]*['"]|\{[^}]*\})/.exec(window)?.[1] ?? null;
			const line = text.slice(0, match.index).split('\n').length;
			records.push({
				source: `${file}:${line}`,
				assetId: id,
				contentRevision,
				unresolved,
				classification: before.includes('shipped-asset-audit: intentional-mismatch')
					? 'intentional'
					: classify(id, contentRevision, unresolved),
			});
		}
	}
	return records;
}

function databaseRecords() {
	if (!databaseUrl) return null;
	const query = `
		SELECT v.project_id, v.version, r->>'id',
		       COALESCE(r->>'contentRevision',''),
		       COALESCE(r->>'unresolved','null')
		FROM project_versions v,
		     jsonb_array_elements(COALESCE(v.document->'units'->'resources'->'data'->'resources','[]'::jsonb)) r
		WHERE r->>'kind' = 'asset'
		ORDER BY v.project_id, v.version`;
	const output = execFileSync('psql', [databaseUrl, '-X', '-A', '-t', '-F', '\t', '-c', query], {
		encoding: 'utf8',
	}).trim();
	if (!output) return [];
	return output.split('\n').map((line) => {
		const [projectId, version, assetId, contentRevision, unresolved] = line.split('\t');
		return {
			source: `${projectId}@v${version}`,
			projectId,
			version: Number(version),
			assetId,
			contentRevision: contentRevision || null,
			unresolved,
			classification: classify(assetId, contentRevision || null, unresolved),
		};
	});
}

function printTable(rows) {
	const headers = ['source', 'asset id', 'content revision', 'class'];
	const cellsOf = (row) => [row.source, row.assetId, row.contentRevision, row.classification];
	const widths = headers.map((header, index) =>
		Math.max(header.length, ...rows.map((row) => String(cellsOf(row)[index]).length), 4),
	);
	const line = (cells) => cells.map((cell, index) => String(cell).padEnd(widths[index])).join('  ');
	console.log(line(headers));
	console.log(widths.map((width) => '-'.repeat(width)).join('  '));
	for (const row of rows) console.log(line(cellsOf(row)));
}

const fixtures = textRecords();
const database = databaseRecords();
const all = [...fixtures, ...(database ?? [])];
const incompatible = all.filter(
	(record) =>
		record.classification === 'no-revision' ||
		record.classification === 'differs' ||
		record.classification === 'unresolved',
);

if (asJson) {
	console.log(
		JSON.stringify(
			{
				gate: incompatible.length === 0 ? 'cleared' : 'blocked',
				incompatible,
				ledger: { formatVersion: LEDGER.formatVersion, models: Object.keys(LEDGER.models).length },
				fixtures,
				database: database === null ? 'skipped (no DATABASE_URL)' : database,
			},
			null,
			2,
		),
	);
} else {
	console.log(`D8a shipped-asset audit — ${EXPECTED.size} pinned ids`);
	console.log(
		`Fixtures/seeds/source: ${fixtures.length} record(s); database: ${database === null ? 'skipped (no DATABASE_URL)' : `${database.length} record(s)`}`,
	);
	if (fixtures.length > 0) {
		console.log('\nTracked fixtures, seeds and source:');
		printTable(fixtures);
	}
	if (database !== null) {
		console.log('\nPersisted project versions:');
		printTable(
			database.length === 0
				? [{ source: '(none)', assetId: '', contentRevision: '', classification: '' }]
				: database,
		);
	}
	console.log(
		`\nGate: ${incompatible.length === 0 ? 'CLEARED' : 'BLOCKED'} (${incompatible.length} incompatible record(s))`,
	);
	for (const record of incompatible) {
		console.log(`  ${record.classification}: ${record.assetId} at ${record.source}`);
	}
}

if (failOnIncompatible && incompatible.length > 0) process.exitCode = 1;
