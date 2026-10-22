// Machine-readable probe output: one JSON file per probe under ./results, plus a console line.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type Verdict = 'pass' | 'refuse' | 'fail' | 'untested';
export type Row = { id: string; verdict: Verdict; expected: Verdict; detail: Record<string, unknown> };

export function recorder(probe: string) {
	const rows: Row[] = [];
	return {
		row(id: string, expected: Verdict, verdict: Verdict, detail: Record<string, unknown> = {}) {
			rows.push({ id, verdict, expected, detail });
			return verdict === expected;
		},
		flush(meta: Record<string, unknown> = {}) {
			const dir = fileURLToPath(new URL('./results/', import.meta.url));
			mkdirSync(dir, { recursive: true });
			const body = { probe, node: process.version, ...meta, rows };
			writeFileSync(`${dir}${probe}.json`, JSON.stringify(body, null, 2) + '\n');
			const mismatches = rows.filter((r) => r.verdict !== r.expected).map((r) => r.id);
			console.log(`[probe ${probe}] rows=${rows.length} mismatches=${JSON.stringify(mismatches)}`);
			return mismatches;
		}
	};
}
