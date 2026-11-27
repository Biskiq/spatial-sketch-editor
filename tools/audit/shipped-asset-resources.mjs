#!/usr/bin/env node
/**
 * Read-only D8a compatibility audit for shipped `asset` resource records.
 *
 * It never writes to the database and never rewrites a resource record. It
 * inspects two independent sources:
 *
 * 1. tracked fixtures and seeds: JSON documents are parsed and walked
 *    structurally; TypeScript/JavaScript object literals in fixture files are
 *    read with the TypeScript parser so a field belongs to exactly the record
 *    that declares it. Production helper calls
 *    (`shippedModelResourceEntry('…')`) are resolved from the pin ledger.
 *    Anything the parser cannot determine statically is reported
 *    `indeterminate`, never guessed from a neighbouring record. Production
 *    source and ordinary unit tests are not compatibility evidence and are not
 *    scanned.
 * 2. every project version in the authorized development database, when a
 *    connection string is supplied.
 *
 * Classification follows the closure validator in
 * `packages/project-model/src/units/validate/envelope.ts`: an id outside the pin
 * registry is `unknown-asset`; an unresolved record is `unresolved`; otherwise
 * the declared revision is `contentRevision ?? pin.hash` and is `matches`,
 * `no-revision` or `differs`.
 *
 * The gate distinguishes the three outcomes:
 *
 *   blocked     a pinned record is unresolved, unversioned or at another revision
 *   incomplete  the database was skipped or failed, or a fixture is dynamically
 *               constructed / unparseable and therefore not statically verified
 *   cleared     the static scan is determinate, the database query completed,
 *               and every pinned record matches
 *
 * A record marked by a nearby `shipped-asset-audit: intentional-mismatch`
 * comment is reported as `intentional` and cannot block the gate.
 *
 * Usage:
 *   node tools/audit/shipped-asset-resources.mjs [--json] [--fail-on-incompatible] [--require-complete]
 *   DATABASE_URL=postgresql://... node tools/audit/shipped-asset-resources.mjs --require-complete
 *
 * `--fail-on-incompatible` exits 1 for a blocked gate. `--require-complete`
 * exits 1 unless the gate is cleared, so a skipped database cannot read as a
 * pass. The script itself always exits 0 without one of those flags.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '../..');
const LEDGER_PATH = 'packages/project-model/shipped-model-pins.json';
const PIN_LEDGER = JSON.parse(readFileSync(resolve(ROOT, LEDGER_PATH), 'utf8'));
const EXPECTED = new Map(
	Object.entries(PIN_LEDGER.models).map(([assetId, pin]) => [assetId, `sha256-${pin.sha256}`]),
);

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const failOnIncompatible = args.has('--fail-on-incompatible');
const requireComplete = args.has('--require-complete');
const databaseUrl = process.env.DATABASE_URL ?? '';
const trackedExtensions = /\.(?:ts|mts|js|mjs|json|sql)$/;
const INTENTIONAL = 'shipped-asset-audit: intentional-mismatch';

/**
 * Classify one structurally read record exactly as the closure validator does.
 * `dynamic` names a field the static reader could not resolve; it is never
 * treated as missing or as a match.
 */
export function classifyRecord(record) {
	if (record.assetId == null || record.assetId === '') return 'indeterminate';
	if (!EXPECTED.has(record.assetId)) return 'unknown-asset';
	if (record.dynamic === true) return 'indeterminate';
	if (record.unresolved !== null && record.unresolved !== undefined) return 'unresolved';
	const declared = record.contentRevision ?? record.pinHash ?? null;
	if (declared === null) return 'no-revision';
	return declared === EXPECTED.get(record.assetId) ? 'matches' : 'differs';
}

function finish(record) {
	return { ...record, classification: record.intentional ? 'intentional' : classifyRecord(record) };
}

function intentionalAt(text, offset) {
	return text.slice(Math.max(0, offset - 600), offset).includes(INTENTIONAL);
}

function lineAt(sourceFile, node) {
	return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function propertyName(name) {
	if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
	return null;
}

function findProperty(object, name) {
	let found = null;
	for (const property of object.properties) {
		if (ts.isSpreadAssignment(property)) found = { spread: true };
		if (ts.isPropertyAssignment(property) && propertyName(property.name) === name) found = property;
	}
	return found;
}

function literalText(node) {
	return ts.isStringLiteralLike(node) ? node.text : null;
}

function isNull(node) {
	return node !== undefined && node.kind === ts.SyntaxKind.NullKeyword;
}

function readPinHash(node) {
	if (node === undefined || isNull(node)) return { value: null, dynamic: false };
	if (!ts.isObjectLiteralExpression(node)) return { value: null, dynamic: true };
	const hash = findProperty(node, 'hash');
	if (hash === null || hash.spread) return { value: null, dynamic: true };
	const text = literalText(hash.initializer);
	return text === null ? { value: null, dynamic: true } : { value: text, dynamic: false };
}

function readUnresolved(node) {
	if (node === undefined || isNull(node)) return { value: null, dynamic: false };
	if (ts.isObjectLiteralExpression(node)) return { value: '<unresolved>', dynamic: false };
	// An identifier could be null at runtime; do not claim it is unresolved.
	return { value: '<unresolved>', dynamic: true };
}

/**
 * Read one `kind: 'asset'` object literal. Only properties inside this node are
 * consulted, so an adjacent record's revision can never be attributed here.
 */
function fromObjectLiteral(file, sourceFile, object) {
	const id = findProperty(object, 'id');
	const revision = findProperty(object, 'contentRevision');
	const pin = findProperty(object, 'pin');
	const unresolved = findProperty(object, 'unresolved');
	const spread = object.properties.some(ts.isSpreadAssignment);
	let dynamic = spread;
	let assetId = null;
	let contentRevision = null;
	let pinHash = null;
	let unresolvedValue = null;
	let reason = spread ? 'object spread hides fields' : null;

	if (id !== null && !id.spread) {
		assetId = literalText(id.initializer);
		if (assetId === null) {
			dynamic = true;
			reason ??= 'id is not a string literal';
		}
	} else if (!spread) {
		dynamic = true;
		reason ??= 'missing id';
	}

	if (revision !== null && !revision.spread) {
		if (isNull(revision.initializer)) contentRevision = null;
		else {
			contentRevision = literalText(revision.initializer);
			if (contentRevision === null) {
				dynamic = true;
				reason ??= 'contentRevision is a dynamic expression';
			}
		}
	}

	if (pin !== null && !pin.spread) {
		const read = readPinHash(pin.initializer);
		pinHash = read.value;
		if (read.dynamic) {
			dynamic = true;
			reason ??= 'pin.hash is a dynamic expression';
		}
	}

	if (unresolved !== null && !unresolved.spread) {
		const read = readUnresolved(unresolved.initializer);
		unresolvedValue = read.value;
		if (read.dynamic) {
			dynamic = true;
			reason ??= 'unresolved is a dynamic expression';
		}
	}

	const start = object.getStart(sourceFile);
	return finish({
		source: `${file}:${lineAt(sourceFile, object)}`,
		construction: 'object-literal',
		assetId,
		contentRevision,
		pinHash,
		unresolved: unresolvedValue,
		dynamic,
		reason,
		intentional: intentionalAt(sourceFile.text, start),
	});
}

function hasAssetKind(object) {
	const kind = findProperty(object, 'kind');
	return kind !== null && !kind.spread && literalText(kind.initializer) === 'asset';
}

/** Read TypeScript/JavaScript object literals and production helper calls. */
export function parseTypeScriptRecords(file, text) {
	const scriptKind =
		file.endsWith('.mjs') || file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
	const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind);
	const records = [];
	const visit = (node) => {
		if (ts.isObjectLiteralExpression(node) && hasAssetKind(node)) {
			records.push(fromObjectLiteral(file, sourceFile, node));
		}
		if (ts.isCallExpression(node)) {
			const callee = node.expression.getText(sourceFile).split('.').pop();
			if (callee === 'shippedModelResourceEntry') {
				const argument = node.arguments[0];
				const assetId = argument === undefined ? null : literalText(argument);
				const start = node.getStart(sourceFile);
				const productionHelper = {
					source: `${file}:${lineAt(sourceFile, node)}`,
					construction: 'production-helper',
					assetId,
					contentRevision: assetId === null ? null : (EXPECTED.get(assetId) ?? null),
					pinHash: null,
					unresolved: null,
					dynamic: false,
					reason:
						assetId === null
							? 'the production helper derives its pinned revision at runtime'
							: null,
					intentional: intentionalAt(sourceFile.text, start),
				};
				// A helper call with a computed id is still the one production form:
				// the helper looks the pin up from this registry, so it cannot construct
				// an unpinned revision. Report it, but it is not an unverified record.
				records.push(
					assetId === null
						? { ...productionHelper, classification: 'production-helper' }
						: finish(productionHelper),
				);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return records;
}

function jsonPointer(path) {
	return path.length === 0 ? '$' : `$${path.map((part) => `.${part}`).join('')}`;
}

/** Parse a JSON document and walk every object, so fields stay with their record. */
export function parseJsonRecords(file, text) {
	let document;
	try {
		document = JSON.parse(text);
	} catch (error) {
		return [
			finish({
				source: file,
				construction: 'json',
				assetId: null,
				contentRevision: null,
				pinHash: null,
				unresolved: null,
				dynamic: true,
				reason: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
				intentional: false,
			}),
		];
	}
	const records = [];
	const walk = (value, path) => {
		if (Array.isArray(value)) {
			for (const [index, entry] of value.entries()) walk(entry, [...path, index]);
			return;
		}
		if (value === null || typeof value !== 'object') return;
		if (value.kind === 'asset') {
			const revision =
				typeof value.contentRevision === 'string'
					? value.contentRevision
					: value.contentRevision === null || value.contentRevision === undefined
						? null
						: undefined;
			const pinHash =
				value.pin === null || value.pin === undefined
					? null
					: typeof value.pin === 'object' && typeof value.pin.hash === 'string'
						? value.pin.hash
						: undefined;
			records.push(
				finish({
					source: `${file}:${jsonPointer(path)}`,
					construction: 'json',
					assetId: typeof value.id === 'string' ? value.id : null,
					contentRevision: revision ?? null,
					pinHash: pinHash ?? null,
					unresolved:
						value.unresolved === null || value.unresolved === undefined ? null : '<unresolved>',
					dynamic: revision === undefined || pinHash === undefined,
					reason:
						revision === undefined
							? 'contentRevision is not a string or null'
							: pinHash === undefined
								? 'pin.hash is not a string'
								: null,
					intentional: false,
				}),
			);
		}
		for (const [key, entry] of Object.entries(value)) walk(entry, [...path, key]);
	};
	walk(document, []);
	return records;
}

function trackedFiles() {
	return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
		.split('\0')
		.filter(
			(file) =>
				file &&
				trackedExtensions.test(file) &&
				(file.endsWith('.json') ||
					file.endsWith('.sql') ||
					/(^|\/)(__fixtures__|fixtures)\//.test(file) ||
					/(^|\/)[^/]*(?:fixture|seed)[^/]*\.(?:ts|mts|js|mjs|json)$/i.test(file)),
		);
}

export function scanFixtures(files = trackedFiles()) {
	const records = [];
	for (const file of files) {
		const text = readFileSync(resolve(ROOT, file), 'utf8');
		if (file.endsWith('.sql')) {
			// A SQL seed can carry JSON but is not structurally parsed here. Report it
			// as indeterminate rather than silently omitting a persisted record.
			if (!/kind['"]?\s*:\s*['"]asset/i.test(text)) continue;
			records.push(
				finish({
					source: file,
					construction: 'sql',
					assetId: null,
					contentRevision: null,
					pinHash: null,
					unresolved: null,
					dynamic: true,
					reason: 'SQL seed contains an asset record; express it as JSON or a fixture',
					intentional: false,
				}),
			);
			continue;
		}
		if (file.endsWith('.json')) {
			if (!text.includes('"asset"') || !text.includes('"kind"')) continue;
			records.push(...parseJsonRecords(file, text));
			continue;
		}
		if (!text.includes('asset')) continue;
		records.push(...parseTypeScriptRecords(file, text));
	}
	return records;
}

function parseDatabaseUnresolved(value) {
	return value === '' || value === 'null' ? null : '<unresolved>';
}

function databaseAudit() {
	if (!databaseUrl) {
		return { status: 'skipped', reason: 'DATABASE_URL is not set', records: [] };
	}
	const query = `
		SELECT v.project_id, v.version, r->>'id',
		       COALESCE(r->>'contentRevision','__null__'),
		       COALESCE(r->'pin'->>'hash','__null__'),
		       COALESCE(r->>'unresolved','null')
		FROM project_versions v,
		     jsonb_array_elements(COALESCE(v.document->'units'->'resources'->'data'->'resources','[]'::jsonb)) r
		WHERE r->>'kind' = 'asset'
		ORDER BY v.project_id, v.version`;
	try {
		const output = execFileSync(
			'psql',
			[databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', '-c', query],
			{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
		).trim();
		const records =
			output === ''
				? []
				: output.split('\n').map((line) => {
						const [projectId, version, assetId, contentRevision, pinHash, unresolved] =
							line.split('\t');
						return finish({
							source: `${projectId}@v${version}`,
							construction: 'database',
							projectId,
							version: Number(version),
							assetId: assetId || null,
							contentRevision: contentRevision === '__null__' ? null : contentRevision,
							pinHash: pinHash === '__null__' ? null : pinHash,
							unresolved: parseDatabaseUnresolved(unresolved ?? ''),
							dynamic: !assetId || !Number.isSafeInteger(Number(version)),
							reason: !assetId ? 'row has no asset id' : null,
							intentional: false,
						});
					});
		return { status: 'complete', records };
	} catch (error) {
		// Never echo the command line: it contains the connection string.
		const stderr =
			error !== null && typeof error === 'object' && 'stderr' in error
				? String(error.stderr).trim()
				: '';
		const reason = stderr.split('\n').filter(Boolean).at(-1)?.trim() ?? 'psql failed';
		return { status: 'failed', reason, records: [] };
	}
}

const INCOMPATIBLE = new Set(['no-revision', 'differs', 'unresolved']);

/** The gate outcome, including why an incomplete scan is not a clearance. */
export function gateFor(records, database) {
	const incompatible = records.filter((record) => INCOMPATIBLE.has(record.classification));
	const indeterminate = records.filter((record) => record.classification === 'indeterminate');
	const incompleteReasons = [];
	if (database.status !== 'complete') {
		incompleteReasons.push(
			`database audit ${database.status}${database.reason ? `: ${database.reason}` : ''}`,
		);
	}
	if (indeterminate.length > 0) {
		incompleteReasons.push(`${indeterminate.length} statically indeterminate fixture record(s)`);
	}
	return {
		gate:
			incompatible.length > 0 ? 'blocked' : incompleteReasons.length > 0 ? 'incomplete' : 'cleared',
		incompatible,
		indeterminate,
		incompleteReasons,
	};
}

function printTable(rows) {
	const headers = ['source', 'asset id', 'declared revision', 'class'];
	const cellsOf = (row) => [
		row.source,
		row.assetId ?? '(dynamic)',
		row.contentRevision ?? row.pinHash ?? '(none)',
		row.classification,
	];
	const widths = headers.map((header, index) =>
		Math.max(header.length, ...rows.map((row) => String(cellsOf(row)[index]).length), 4),
	);
	const line = (cells) => cells.map((cell, index) => String(cell).padEnd(widths[index])).join('  ');
	console.log(line(headers));
	console.log(widths.map((width) => '-'.repeat(width)).join('  '));
	for (const row of rows) console.log(line(cellsOf(row)));
}

function main() {
	const fixtures = scanFixtures();
	const database = databaseAudit();
	const { gate, incompatible, indeterminate, incompleteReasons } = gateFor(
		[...fixtures, ...database.records],
		database,
	);
	const intentional = fixtures.filter((record) => record.classification === 'intentional');
	const result = {
		gate,
		ledger: { formatVersion: PIN_LEDGER.formatVersion, models: EXPECTED.size },
		fixtures: { status: 'scanned', records: fixtures },
		database: {
			status: database.status,
			...(database.reason === undefined ? {} : { reason: database.reason }),
			records: database.records,
		},
		incompatible,
		indeterminate,
		intentional,
		incompleteReasons,
	};

	if (asJson) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(`D8a shipped-asset audit — ${EXPECTED.size} pinned ids`);
		console.log(
			`Fixtures and seeds: ${fixtures.length} record(s); database: ${database.status}${
				database.reason === undefined ? '' : ` (${database.reason})`
			}`,
		);
		if (fixtures.length > 0) {
			console.log('\nTracked fixtures, seeds and source:');
			printTable(fixtures);
		}
		if (database.records.length > 0) {
			console.log('\nPersisted project versions:');
			printTable(database.records);
		}
		console.log(`\nGate: ${gate.toUpperCase()}`);
		for (const reason of incompleteReasons) console.log(`  incomplete: ${reason}`);
		for (const record of incompatible) {
			console.log(`  ${record.classification}: ${record.assetId} at ${record.source}`);
		}
	}

	if (failOnIncompatible && gate === 'blocked') process.exitCode = 1;
	if (requireComplete && gate !== 'cleared') process.exitCode = 1;
}

if (
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
	main();
