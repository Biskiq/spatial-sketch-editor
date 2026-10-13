/**
 * `layout-identity.ts` — P23.12 compact reference identity.
 *
 * A **reference** is presentation identity only: a short, document-unique,
 * non-semantic label a person can read out loud (`Gallery A · R-7K3M`). It is
 * never identity authority — canonical IDs remain the only identity and
 * connectivity authority — and nothing in the layout, geometry, selection,
 * history or topology code may read one.
 *
 * Shape (P23.12 final design contract §1/§2):
 * - `family + '-' + 4 characters`, exactly **6 characters** total, from the
 *   31-character unambiguous alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ`
 *   (`0 O 1 I L` are excluded so a reference can be read aloud).
 * - One family set `R`/`W`/`O`/`J` for Room / Wall / Opening / Junction. There is
 *   no `D-` family: Door and Window share `O`, because kind is mutable.
 *
 * Allocation:
 * - Tokens are allocated from a persisted, per-document cursor and stored in a
 *   document-owned ledger keyed by canonical ID (`LayoutIdentityLedger`).
 * - `suffixIndex = (cursor × K + C) mod 31⁴` with `K = 1 000 003 mod 31⁴ = 76 482`
 *   and the fixed translation `C = 20 979`. `gcd(K, 31⁴) = 1`, so the map is a
 *   **bijection** on the index space: no two indices produce the same suffix, and
 *   the inverse is closed form ({@link indexOfReference}). The translation only
 *   keeps the very first allocation from being the all-zero suffix.
 * - The token is therefore an **opaque permutation of the allocation sequence**.
 *   It is derived from allocation order (unavoidably — so is every allocated
 *   identifier, including the canonical ID), but it carries **no user-visible or
 *   semantic ordering, topology, spatial, role or ancestry meaning**: successive
 *   allocations differ in all four suffix characters, and no consumer can read an
 *   order, a position or a role out of one.
 *
 * Durable vs provisional (P23.12 D1 rule, proved by T1–T6):
 * - {@link withLayoutIdentity} is the **provisional** primitive: it mints into
 *   its own copy from a frozen base and is safe on the pointermove path. It never
 *   advances anything outside the copy it returns.
 * - {@link promoteLayoutIdentity} is the **durable** primitive: it is called at
 *   the seams where a live state becomes the document of record (a transaction
 *   commit, a Save/export payload), and it is the only caller that advances the
 *   session high-water mark.
 * - Both take an optional **latched base**. An operation latches
 *   `max(document cursor, highWater)` once at its start and passes it to every
 *   candidate and to its own promotion. Reading the live document cursor alone
 *   would be wrong: after `create A → undo` that cursor is legitimately rewound,
 *   and a fresh allocation would hand A's retired reference to a different entity.
 *
 * Pure module: JSON data in, JSON data out. No DOM, no Svelte, no mutation of the
 * input document.
 */
import type { LayoutDocumentIssue } from './layout-codec';
import type {
	LayoutDocumentWallFirst,
	LayoutIdentityFamily,
	LayoutIdentityLedger
} from './layout-wall-first-types';
import { LAYOUT_IDENTITY_FAMILIES } from './layout-wall-first-types';

/** Unambiguous 31-character suffix alphabet — `0 O 1 I L` are excluded. */
export const LAYOUT_REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Suffix length: the whole reference is `family + '-' + suffix` = 6 characters. */
export const LAYOUT_REFERENCE_SUFFIX_LENGTH = 4;

/** Size of the allocation index space: `31⁴ = 923 521`. */
export const LAYOUT_REFERENCE_SPACE = LAYOUT_REFERENCE_ALPHABET.length ** LAYOUT_REFERENCE_SUFFIX_LENGTH;

/** `1 000 003 mod 923 521` — coprime with the space, so the map steps bijectively. */
export const LAYOUT_REFERENCE_MULTIPLIER = 1000003 % LAYOUT_REFERENCE_SPACE;

/** Fixed translation, so allocation index `0` is not the all-zero suffix. */
export const LAYOUT_REFERENCE_OFFSET = 20979;

/** `LAYOUT_REFERENCE_MULTIPLIER⁻¹ mod 923 521` — the closed-form inverse. */
export const LAYOUT_REFERENCE_INVERSE_MULTIPLIER = 298772;

/** Reference family prefix per ledger collection. */
export const LAYOUT_REFERENCE_PREFIX: Record<LayoutIdentityFamily, string> = {
	rooms: 'R',
	junctions: 'J',
	walls: 'W',
	openings: 'O'
};

/** One reference: family prefix, `-`, four unambiguous characters. */
export const LAYOUT_REFERENCE_PATTERN = /^[RJWO]-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

/** Named failure code for a document that has exhausted its allocation space. */
export const LAYOUT_IDENTITY_EXHAUSTED_CODE = 'identity_space_exhausted';

/** Issue codes reported by {@link layoutIdentityCursorIssues}. */
export const LAYOUT_IDENTITY_CURSOR_BEHIND_REFERENCE = 'cursor_behind_reference';
export const LAYOUT_IDENTITY_MALFORMED_REFERENCE = 'malformed_reference';

/**
 * The allocation space is finite (923 521 lifetime allocations per document).
 * Exhaustion fails closed with a named code rather than silently reusing a token.
 */
export class LayoutIdentityExhaustedError extends Error {
	readonly code = LAYOUT_IDENTITY_EXHAUSTED_CODE;

	constructor(message: string) {
		super(message);
		this.name = 'LayoutIdentityExhaustedError';
	}
}

/** A parsed reference: which family it belongs to and which index allocated it. */
export type ParsedLayoutReference = {
	family: LayoutIdentityFamily;
	index: number;
};

const FAMILY_BY_PREFIX: Record<string, LayoutIdentityFamily> = {
	R: 'rooms',
	J: 'junctions',
	W: 'walls',
	O: 'openings'
};

/**
 * Format the reference for one allocation index of one family.
 *
 * Throws only when the index is outside the allocation space; callers that mint
 * guard with {@link LAYOUT_REFERENCE_SPACE} and raise
 * {@link LayoutIdentityExhaustedError} instead.
 */
export function formatLayoutReference(family: LayoutIdentityFamily, index: number): string {
	if (!Number.isInteger(index) || index < 0 || index >= LAYOUT_REFERENCE_SPACE) {
		throw new RangeError(
			`Reference index ${String(index)} is outside the allocation space [0, ${LAYOUT_REFERENCE_SPACE})`
		);
	}
	let remaining = (index * LAYOUT_REFERENCE_MULTIPLIER + LAYOUT_REFERENCE_OFFSET) % LAYOUT_REFERENCE_SPACE;
	let suffix = '';
	for (let position = 0; position < LAYOUT_REFERENCE_SUFFIX_LENGTH; position += 1) {
		suffix = LAYOUT_REFERENCE_ALPHABET[remaining % LAYOUT_REFERENCE_ALPHABET.length]! + suffix;
		remaining = Math.floor(remaining / LAYOUT_REFERENCE_ALPHABET.length);
	}
	return `${LAYOUT_REFERENCE_PREFIX[family]}-${suffix}`;
}

/** Is `token` a well-formed reference of any family? */
export function isLayoutReference(token: unknown): token is string {
	return typeof token === 'string' && LAYOUT_REFERENCE_PATTERN.test(token);
}

/** Parse a reference into its family and allocation index. */
export function parseLayoutReference(token: string): ParsedLayoutReference | undefined {
	if (!isLayoutReference(token)) return undefined;
	const family = FAMILY_BY_PREFIX[token.slice(0, 1)];
	if (!family) return undefined;
	const index = indexOfReference(token);
	if (index === undefined) return undefined;
	return { family, index };
}

/**
 * The allocation index a reference was minted from — the closed-form inverse of
 * {@link formatLayoutReference}.
 *
 * This is what makes the persisted-cursor consistency check possible at all: a
 * document is internally consistent iff every ledger token's index is **below**
 * its cursor, and that can be decided in O(1) per token with no lookup table.
 */
export function indexOfReference(token: string): number | undefined {
	if (!isLayoutReference(token)) return undefined;
	const suffix = token.slice(2);
	let suffixIndex = 0;
	for (const character of suffix) {
		const digit = LAYOUT_REFERENCE_ALPHABET.indexOf(character);
		if (digit < 0) return undefined;
		suffixIndex = suffixIndex * LAYOUT_REFERENCE_ALPHABET.length + digit;
	}
	const shifted = suffixIndex - LAYOUT_REFERENCE_OFFSET;
	const normalised = ((shifted % LAYOUT_REFERENCE_SPACE) + LAYOUT_REFERENCE_SPACE) % LAYOUT_REFERENCE_SPACE;
	return (normalised * LAYOUT_REFERENCE_INVERSE_MULTIPLIER) % LAYOUT_REFERENCE_SPACE;
}

/** An empty ledger: no assignment, cursor at the start of the space. */
export function emptyLayoutIdentityLedger(): LayoutIdentityLedger {
	return { cursor: 0, rooms: {}, junctions: {}, walls: {}, openings: {} };
}

/** The document's allocation cursor; `0` when the document carries no ledger. */
export function layoutIdentityCursor(document: LayoutDocumentWallFirst): number {
	return document.identity?.cursor ?? 0;
}

/**
 * The session high-water mark is the document cursor — this accessor exists so
 * call sites read as bookkeeping rather than as authored content.
 */
export function layoutIdentityHighWater(document: LayoutDocumentWallFirst): number {
	return layoutIdentityCursor(document);
}

/** The reference assigned to one entity, or `undefined` when it has none yet. */
export function referenceFor(
	document: LayoutDocumentWallFirst,
	family: LayoutIdentityFamily,
	id: string
): string | undefined {
	return document.identity?.[family]?.[id];
}

function liveIdsByFamily(
	document: LayoutDocumentWallFirst
): Record<LayoutIdentityFamily, string[]> {
	return {
		rooms: document.rooms.map((room) => room.id),
		junctions: document.junctions.map((junction) => junction.id),
		walls: document.walls.map((wall) => wall.id),
		openings: document.openings.map((opening) => opening.id)
	};
}

/**
 * Is every live entity resolved, with no stale assignment, no duplicate token and
 * a cursor that sits above every token it issued?
 */
export function layoutIdentityIsComplete(document: LayoutDocumentWallFirst): boolean {
	if (!document.identity) return false;
	if (layoutIdentityCursorIssues(document).length > 0) return false;
	const live = liveIdsByFamily(document);
	const seen = new Set<string>();
	for (const family of LAYOUT_IDENTITY_FAMILIES) {
		const ledger = document.identity[family];
		const liveIds = new Set(live[family]);
		for (const id of Object.keys(ledger)) {
			if (!liveIds.has(id)) return false;
		}
		for (const id of liveIds) {
			const token = ledger[id];
			if (!token || seen.has(token)) return false;
			seen.add(token);
		}
	}
	return true;
}

/**
 * Consistency issues for the persisted cursor, checked **against every live
 * ledger token** (P23.12 D1 "consistency invariant").
 *
 * A token whose allocation index is at or above the cursor means a future mint
 * could hand a live assignment to a different canonical ID — the one way a
 * hand-edited or stale payload could break the never-reassigned guarantee.
 */
export function layoutIdentityCursorIssues(document: LayoutDocumentWallFirst): LayoutDocumentIssue[] {
	const ledger = document.identity;
	if (!ledger) return [];
	const issues: LayoutDocumentIssue[] = [];
	for (const family of LAYOUT_IDENTITY_FAMILIES) {
		const assignments = ledger[family];
		for (const [id, token] of Object.entries(assignments)) {
			const parsed = typeof token === 'string' ? parseLayoutReference(token) : undefined;
			if (!parsed) {
				issues.push({
					path: `$.identity.${family}.${id}`,
					code: LAYOUT_IDENTITY_MALFORMED_REFERENCE,
					message: `'${String(token)}' is not a well-formed ${LAYOUT_REFERENCE_PREFIX[family]} reference`
				});
				continue;
			}
			if (parsed.family !== family) {
				issues.push({
					path: `$.identity.${family}.${id}`,
					code: LAYOUT_IDENTITY_MALFORMED_REFERENCE,
					message: `'${token}' is a ${LAYOUT_REFERENCE_PREFIX[parsed.family]} reference stored in the ${family} ledger`
				});
				continue;
			}
			if (parsed.index >= ledger.cursor) {
				issues.push({
					path: `$.identity.cursor`,
					code: LAYOUT_IDENTITY_CURSOR_BEHIND_REFERENCE,
					message: `Cursor ${ledger.cursor} is not above the allocation index ${parsed.index} of '${token}' (${family}.${id})`
				});
			}
		}
	}
	return issues;
}

/** Highest allocation index in the ledger, or `-1` when nothing is assigned. */
function highestAllocatedIndex(ledger: LayoutIdentityLedger): number {
	let highest = -1;
	for (const family of LAYOUT_IDENTITY_FAMILIES) {
		for (const token of Object.values(ledger[family])) {
			const index = typeof token === 'string' ? indexOfReference(token) : undefined;
			if (index !== undefined && index > highest) highest = index;
		}
	}
	return highest;
}

/**
 * Repair a cursor that sits at or below an assigned token's index by raising it to
 * `maxIndex + 1`. Deterministic, idempotent, and never lowers a cursor.
 *
 * This is bookkeeping, not authored content: it changes no assignment and no
 * geometry, and the authored fingerprint ignores the cursor entirely.
 */
export function repairLayoutIdentityCursor(
	document: LayoutDocumentWallFirst
): LayoutDocumentWallFirst {
	const ledger = document.identity;
	if (!ledger) return document;
	const required = highestAllocatedIndex(ledger) + 1;
	if (ledger.cursor >= required) return document;
	return { ...document, identity: { ...ledger, cursor: required } };
}

type MintOptions = {
	/**
	 * Allocation base latched once per operation as
	 * `max(document cursor, session high-water)`. Omitted for a one-shot install,
	 * where the document's own cursor is the base.
	 */
	base?: number;
};

/**
 * Compute the resolved ledger for a document: keep every existing assignment,
 * prune entries whose canonical ID is no longer live, and mint for entities that
 * have none — in the documented fixed order (rooms → junctions → walls →
 * openings), in document order within each family.
 *
 * Copy-on-write: returns the input object itself when nothing changed, so the
 * transient path is free.
 */
function resolveLayoutIdentity(
	document: LayoutDocumentWallFirst,
	options: MintOptions
): LayoutDocumentWallFirst {
	const ledger = document.identity;
	const base = Math.max(options.base ?? ledger?.cursor ?? 0, ledger?.cursor ?? 0);
	const live = liveIdsByFamily(document);
	const nextByFamily: LayoutIdentityLedger = emptyLayoutIdentityLedger();
	let next = Number.isInteger(base) && base > 0 ? base : 0;
	let changed = false;

	for (const family of LAYOUT_IDENTITY_FAMILIES) {
		const existing = ledger?.[family] ?? {};
		for (const id of live[family]) {
			const token = existing[id];
			if (token !== undefined) {
				nextByFamily[family][id] = token;
				continue;
			}
			if (next >= LAYOUT_REFERENCE_SPACE) {
				throw new LayoutIdentityExhaustedError(
					`Layout ${family} exhausted the reference space (${LAYOUT_REFERENCE_SPACE} lifetime allocations)`
				);
			}
			nextByFamily[family][id] = formatLayoutReference(family, next);
			next += 1;
			changed = true;
		}
		// Pruning retires nothing: the cursor never moves back, so a pruned
		// reference can never be handed to a different canonical ID.
		if (Object.keys(existing).length !== Object.keys(nextByFamily[family]).length) changed = true;
	}

	const cursor = next;
	if (!changed && ledger && ledger.cursor === cursor) return document;

	return { ...document, identity: { ...nextByFamily, cursor } };
}

/**
 * **Provisional** allocation: resolve references into a copy of `document`.
 *
 * Safe on the pointermove path. It never writes the input document, never
 * changes any module state and never advances a session mark — a candidate that
 * is rolled back consumes nothing, and the tokens it displayed are exactly the
 * tokens a later commit will keep (same base, same order).
 *
 * Throws {@link LayoutIdentityExhaustedError} when the document has consumed its
 * whole allocation space.
 */
export function withLayoutIdentity(
	document: LayoutDocumentWallFirst,
	options: MintOptions = {}
): LayoutDocumentWallFirst {
	return resolveLayoutIdentity(document, options);
}

/**
 * **Durable** promotion: the same resolution, plus the value the caller stores as
 * its session high-water mark.
 *
 * Called only at the seams where a live state becomes the document of record —
 * a transaction commit and a Save/export payload. The returned `cursor` is the
 * value to keep as the mark, and it is **nondecreasing** with respect to both the
 * document cursor and any base it was given, including when nothing needed
 * minting.
 */
export function promoteLayoutIdentity(
	document: LayoutDocumentWallFirst,
	options: MintOptions = {}
): { document: LayoutDocumentWallFirst; cursor: number } {
	const resolved = resolveLayoutIdentity(document, options);
	return { document: resolved, cursor: layoutIdentityCursor(resolved) };
}

/**
 * Canonical JSON of the document's **authored content** — the canonical form with
 * `identity.cursor` omitted.
 *
 * The cursor is allocation bookkeeping rather than authored content (T4), so it
 * must never take part in a change comparison: dirty state,
 * snapshot-matches-live, history `matches` and the project fingerprint all use
 * this form, and a cursor that moved or rewound can therefore never create a
 * phantom history entry or a spurious dirty state.
 *
 * The ledger itself *is* authored — assignments are restored exactly by Undo — so
 * only the cursor is dropped.
 */
export function layoutAuthoredCanonicalJson(document: LayoutDocumentWallFirst): string {
	return JSON.stringify(stripIdentityCursor(document), null, 2) + '\n';
}

function stripIdentityCursor(document: LayoutDocumentWallFirst): unknown {
	const ledger = document.identity;
	if (!ledger) return document;
	// Key order is preserved (cursor first in the ledger, dropped here), so this
	// matches the codec's canonical form for the same document minus the cursor.
	const { cursor: _cursor, ...rest } = ledger;
	return { ...document, identity: rest };
}
