/**
 * Capability ledger — definitions only.
 *
 * The ledger lists what the product should do, one entry per thing a creator
 * would say they can do. It never stores status: maturity and health are
 * derived by `tools/harness/report.mjs` from tagged checks, open issues and
 * owner reviews. A ledger entry that carries a status field is rejected, so
 * "shipped" can never become a hand-edited claim.
 *
 * Entry shape (see `capabilities.json`):
 *
 *   id         dotted lowercase capability id, stable across work
 *   area       T1–T5 (areas organize work; they are not approval gates)
 *   summary    one creator-facing sentence
 *   northStar  `north-star.md#<anchor>` in docs/reference/north-star.md
 *   surface    repository-relative path globs the capability's implementation
 *              touches; a later merge matching one of these expires an owner
 *              review
 *   design     null, or { reference, revision } for an owner-approved design
 *   review     null, or { implementation, design, date, verdict }
 */

export const SCHEMA_VERSION = 1;

/** Areas are names for product surfaces, never approval gates. */
export const AREAS = ['T1', 'T2', 'T3', 'T4', 'T5'];

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)+$/;
// GitHub heading slugs keep repeated hyphens ("Build — World architecture"
// becomes `#build--world-architecture`), so a single segment allows `--`.
const NORTH_STAR = /^north-star\.md#[a-z0-9][a-z0-9-]*$/;
const COMMIT = /^[0-9a-f]{7,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VERDICTS = ['accepted', 'rejected'];

/** Status is computed, so an entry may not carry any of these. */
const COMPUTED_KEYS = ['status', 'maturity', 'health', 'regressed', 'checks'];

function isObject(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Every problem that would make the ledger unable to drive a report.
 * Returns an empty array for a valid ledger.
 *
 * @param {unknown} data parsed `capabilities.json`
 * @returns {string[]}
 */
export function validateLedger(data) {
	const problems = [];
	if (!isObject(data)) return ['ledger must be a JSON object'];
	if (data.schemaVersion !== SCHEMA_VERSION) {
		problems.push(`schemaVersion must be ${SCHEMA_VERSION}`);
	}
	if (!Array.isArray(data.capabilities) || data.capabilities.length === 0) {
		problems.push('capabilities must be a non-empty array');
		return problems;
	}

	const seen = new Set();
	for (const [index, entry] of data.capabilities.entries()) {
		const where = `capabilities[${index}]`;
		if (!isObject(entry)) {
			problems.push(`${where}: must be an object`);
			continue;
		}
		for (const key of COMPUTED_KEYS) {
			if (key in entry) problems.push(`${where}: "${key}" is computed, never stored`);
		}

		if (!isNonEmptyString(entry.id)) {
			problems.push(`${where}: id must be a non-empty string`);
		} else if (!ID.test(entry.id)) {
			problems.push(
				`${where}: id "${entry.id}" must be dotted lowercase segments like "layout.roof.gable-join"`
			);
		} else if (seen.has(entry.id)) {
			problems.push(`${where}: duplicate id "${entry.id}"`);
		} else {
			seen.add(entry.id);
		}

		if (!AREAS.includes(entry.area)) {
			problems.push(`${where}: area must be one of ${AREAS.join(', ')}`);
		}
		if (!isNonEmptyString(entry.summary)) {
			problems.push(`${where}: summary must be a non-empty string`);
		}
		if (!isNonEmptyString(entry.northStar) || !NORTH_STAR.test(entry.northStar)) {
			problems.push(`${where}: northStar must look like "north-star.md#anchor"`);
		}

		if (!Array.isArray(entry.surface) || entry.surface.length === 0) {
			problems.push(`${where}: surface must be a non-empty array of path globs`);
		} else {
			for (const glob of entry.surface) {
				if (!isNonEmptyString(glob)) problems.push(`${where}: surface entries must be strings`);
			}
		}

		if (entry.design !== null && entry.design !== undefined) {
			if (!isObject(entry.design)) {
				problems.push(`${where}: design must be null or an object`);
			} else {
				if (!isNonEmptyString(entry.design.reference)) {
					problems.push(`${where}: design.reference must be a non-empty string`);
				}
				if (!isNonEmptyString(entry.design.revision)) {
					problems.push(`${where}: design.revision must be a non-empty string`);
				}
			}
		}

		if (entry.review !== null && entry.review !== undefined) {
			if (!isObject(entry.review)) {
				problems.push(`${where}: review must be null or an object`);
			} else {
				if (!isNonEmptyString(entry.review.implementation) || !COMMIT.test(entry.review.implementation)) {
					problems.push(`${where}: review.implementation must be a commit sha`);
				}
				if (!isNonEmptyString(entry.review.design)) {
					problems.push(`${where}: review.design must name the reviewed design revision`);
				}
				if (!isNonEmptyString(entry.review.date) || !DATE.test(entry.review.date)) {
					problems.push(`${where}: review.date must be YYYY-MM-DD`);
				}
				if (!VERDICTS.includes(entry.review.verdict)) {
					problems.push(`${where}: review.verdict must be one of ${VERDICTS.join(', ')}`);
				}
			}
		}
	}

	return problems;
}

/**
 * @param {unknown} data parsed `capabilities.json`
 * @returns {Map<string, any>}
 */
export function capabilityIndex(data) {
	/** @type {Map<string, any>} */
	const index = new Map();
	if (!isObject(data) || !Array.isArray(data.capabilities)) return index;
	for (const entry of data.capabilities) {
		if (isObject(entry) && typeof entry.id === 'string') index.set(entry.id, entry);
	}
	return index;
}
