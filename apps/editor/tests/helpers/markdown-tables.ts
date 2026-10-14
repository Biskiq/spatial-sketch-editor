/**
 * One Markdown table parser, shared by every structural check over a document
 * table (PR #115 §9.4/§11).
 *
 * The repository's execution structure is authored as tables a human reads and a
 * test enforces: the track register and gate register in `docs/roadmap/README.md`,
 * a phase README's slice register, a track README's phase register, and the cycle's
 * state and mechanism tables in `docs/operations/architecture-cycle.md`. Two
 * parsers for one grammar would mean two holes (`tests/README.md` rule 7), so the
 * grammar lives here once.
 *
 * Scope: pipe tables outside fenced code blocks. A table's heading is the nearest
 * preceding heading *outside a fence*, which is how a reader associates a table
 * with its section. Cells are decoration-stripped (`**bold**`, `` `code` ``, link
 * syntax) because the cells carry both a value and a human label — the parser
 * never guesses, and `linkTarget` is available when the link target itself is the
 * value.
 */

export type MarkdownTable = {
	/** Nearest preceding heading text, decoration-stripped and without its `#`s. */
	heading: string;
	/** Heading level (1–6), or 0 when the table has no preceding heading. */
	headingLevel: number;
	/** Header cells, decoration-stripped. */
	columns: string[];
	/**
	 * Body rows: one cell array per row, **as written**. A caller strips decoration for a
	 * value (`stripDecoration`) and reads a link target from the raw cell (`linkTarget`),
	 * so the parser cannot do either for it.
	 */
	rows: string[][];
	/** 1-based line number of the header row. */
	line: number;
};

/** Fenced code block delimiters (``` or ~~~), the only regions a table cannot start in. */
const FENCE = /^[ \t]*(`{3,}|~{3,})/;
/** A heading line, outside a fence. */
const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*$/;
/** A table separator row: only `|`, `-`, `:` and spaces, with at least one dash. */
const SEPARATOR = /^[ \t]*\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/;

/**
 * True for a cell that states no value: empty, `—`, `-` or `n/a`. Decoration is
 * stripped first, because a register writes an empty cell as `**—**` as often as
 * it writes `—`.
 */
export function isSentinel(cell: string | undefined): boolean {
	if (cell === undefined) return true;
	const value = stripDecoration(cell).trim().toLowerCase();
	return value === '' || value === '—' || value === '-' || value === 'n/a';
}

/**
 * Splits one table line into its cells. A `\|` inside a cell is the escape a
 * writer uses for a literal pipe (a JS union type inside a cell), so it is not a
 * separator.
 */
export function splitCells(line: string): string[] {
	const cells: string[] = [];
	let current = '';
	for (let index = 0; index < line.length; index += 1) {
		const character = line[index];
		if (character === '\\' && line[index + 1] === '|') {
			current += '|';
			index += 1;
			continue;
		}
		if (character === '|') {
			cells.push(current);
			current = '';
			continue;
		}
		current += character;
	}
	cells.push(current);
	const trimmed = cells.map((cell) => cell.trim());
	if (trimmed[0] === '') trimmed.shift();
	if (trimmed[trimmed.length - 1] === '') trimmed.pop();
	return trimmed;
}

/** Removes emphasis, code spans and link syntax, keeping the link's label text. */
export function stripDecoration(cell: string): string {
	return cell
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\*\*/g, '')
		.replace(/(^|\s)_(?=\S)/g, '$1')
		.replace(/`/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** The target of the first link or image in a cell, or `null`. */
export function linkTarget(cell: string): string | null {
	const match = /!?\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/.exec(cell);
	return match === null ? null : match[1];
}

/** Parses the header and body rows of a table whose header row is `lines[start]`. */
function parseAt(lines: string[], start: number): MarkdownTable | null {
	const columns = splitCells(lines[start]).map(stripDecoration);
	if (columns.length === 0) return null;
	const rows: string[][] = [];
	let index = start + 2;
	for (; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line.trim().startsWith('|')) break;
		// Cells stay as written: a caller needs the link target, and `stripDecoration` is
		// available for the value. Padding a short row would hide the defect instead.
		const cells = splitCells(line);
		rows.push(cells);
	}
	let heading = '';
	let headingLevel = 0;
	let insideFence = false;
	for (let line = 0; line < start; line += 1) {
		if (FENCE.test(lines[line])) insideFence = !insideFence;
		if (insideFence) continue;
		const match = HEADING.exec(lines[line]);
		if (match !== null) {
			heading = stripDecoration(match[2]);
			headingLevel = match[1].length;
		}
	}
	return { heading, headingLevel, columns, rows, line: start + 1 };
}

/** Every pipe table in a document, in file order, ignoring fenced code blocks. */
export function parseTables(source: string): MarkdownTable[] {
	const lines = source.split('\n');
	const tables: MarkdownTable[] = [];
	let insideFence = false;
	for (let index = 0; index < lines.length; index += 1) {
		if (FENCE.test(lines[index])) {
			insideFence = !insideFence;
			continue;
		}
		if (insideFence) continue;
		const line = lines[index];
		if (!line.trim().startsWith('|')) continue;
		const separator = lines[index + 1];
		if (separator === undefined || !separator.includes('-') || !SEPARATOR.test(separator)) continue;
		const table = parseAt(lines, index);
		if (table !== null) {
			tables.push(table);
			index += table.rows.length + 1;
		}
	}
	return tables;
}

/**
 * The table directly under a heading, matched case-insensitively on the
 * decoration-stripped heading text. Returns `null` when the heading or its table
 * is absent, so a caller can report a missing register instead of throwing.
 */
export function tableUnderHeading(source: string, heading: string): MarkdownTable | null {
	const wanted = heading.trim().toLowerCase();
	return (
		parseTables(source).find((table) => table.heading.trim().toLowerCase() === wanted) ?? null
	);
}

/** The header cells as the caller expects them, or the mismatch as a problem line. */
export function columnProblems(
	table: MarkdownTable,
	file: string,
	expected: readonly string[]
): string[] {
	if (table.columns.length !== expected.length) {
		return [
			`${file}: ${table.heading} has ${table.columns.length} columns, expected ${expected.length} (${expected.join(' | ')})`
		];
	}
	const problems: string[] = [];
	for (const [index, column] of expected.entries()) {
		if (table.columns[index] !== column) {
			problems.push(
				`${file}: ${table.heading} column ${index + 1} is "${table.columns[index]}", expected "${column}"`
			);
		}
	}
	return problems;
}

/** One table row as an object keyed by its column names, with row-length problems. */
export function rowObjects(
	table: MarkdownTable,
	file: string
): { rows: Array<Record<string, string>>; problems: string[] } {
	const problems: string[] = [];
	const rows: Array<Record<string, string>> = [];
	for (const cells of table.rows) {
		if (cells.length !== table.columns.length) {
			problems.push(
				`${file}: ${table.heading} row "${cells[0] ?? ''}" has ${cells.length} cells, expected ${table.columns.length}`
			);
			continue;
		}
		const row: Record<string, string> = {};
		for (const [index, column] of table.columns.entries()) row[column] = cells[index];
		rows.push(row);
	}
	return { rows, problems };
}

/** Splits a cell's comma-separated token list, sentinels removed. */
export function tokens(cell: string): string[] {
	if (isSentinel(cell)) return [];
	return cell
		.split(',')
		.map((token) => stripDecoration(token).trim())
		.filter((token) => token !== '');
}

/**
 * The `KEY: value` lines of a routing block, as written in a fenced block. Keys are
 * upper-cased so `ASSIGNED WORK:` and `assigned work:` route the same way.
 */
export function routeLines(block: string): Array<{ key: string; value: string }> {
	const routes: Array<{ key: string; value: string }> = [];
	for (const line of block.split('\n')) {
		const match = /^([A-Z][A-Z /-]*[A-Z]):[ \t]*(.+)$/.exec(line.trim());
		if (match !== null) routes.push({ key: match[1].trim(), value: match[2].trim() });
	}
	return routes;
}
