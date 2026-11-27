/**
 * G1b — the selection-primary architecture guard.
 *
 * A selection **set** has more than one ordered identity and no primary. Every
 * consumer that reads `primary` must therefore be known: either it owns the
 * selection (the one normalizer and the one session), it acts on one subject and
 * explicitly guards null, or it hands the value to a helper that already accepts
 * null. A new unclassified consumer fails this test, and a classified consumer
 * that stops guarding null fails it too.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../src/lib/authoring', import.meta.url));

type PrimaryConsumer = {
	/** `owner` normalizes or holds the canonical selection. */
	readonly kind: 'owner' | 'single-subject' | 'null-tolerant';
	readonly why: string;
};

/**
 * The audited consumer set. Each entry names why reading `primary` is safe for a
 * set. `single-subject` entries must also contain an explicit null guard.
 */
const CONSUMERS: Readonly<Record<string, PrimaryConsumer>> = {
	'stage/semantic-selection.ts': {
		kind: 'owner',
		why: 'The one normalizer: a set is admitted with primary null.',
	},
	'stage/stage-session.ts': {
		kind: 'owner',
		why: 'Requalification preserves a set as a set (no primary is promoted).',
	},
	'stage/route/stage-shell-commands.ts': {
		kind: 'single-subject',
		why: '⇧⌘G reads the selected group; Ungroup is offered only for its cluster primary.',
	},
	'stage/route/stage-selection-presentation.svelte.ts': {
		kind: 'single-subject',
		why: 'The rename guard only carries a primary that is still selected.',
	},
	'stage/host-acceptance.ts': {
		kind: 'null-tolerant',
		why: 'Compares the primary before/after acceptance to word the removal notice.',
	},
	'adapters/scene.adapter.ts': {
		kind: 'single-subject',
		why: 'A form profile task names the selected entity; a set has none.',
	},
	'adapters/scene/SceneTransformInstrument.svelte': {
		kind: 'single-subject',
		why: 'The transform instrument edits one object; a set has no instrument.',
	},
	'adapters/scene/SceneObjectCardFields.svelte': {
		kind: 'single-subject',
		why: 'Object fields read the one selected entity; a group renders its own writer.',
	},
	'adapters/scene/SceneGroupCardFields.svelte': {
		kind: 'single-subject',
		why: 'The group writer reads the selected cluster primary, and only that.',
	},
	'adapters/scene/group-card.ts': {
		kind: 'single-subject',
		why: 'Group with… requires the light itself to be the primary selection.',
	},
	'adapters/scene/group-session.ts': {
		kind: 'single-subject',
		why: 'Rigid Move/Turn needs exactly one selected group.',
	},
	'adapters/scene/object-card.ts': {
		kind: 'single-subject',
		why: 'Object commands address one entity.',
	},
	'adapters/scene/object-readings.ts': {
		kind: 'single-subject',
		why: 'Object marks read the one selected object.',
	},
	'adapters/scene/placement-binding.ts': {
		kind: 'single-subject',
		why: 'Placement re-seats one selected object.',
	},
	'adapters/scene/scene-contributions.ts': {
		kind: 'single-subject',
		why: 'Marks choose the group or the object; each branch needs one primary.',
	},
	'adapters/layout/curve-gesture-session.ts': {
		kind: 'null-tolerant',
		why: 'Layout subjects never join a set; a missing primary simply starts no curve.',
	},
	'adapters/layout/layout-subjects.ts': {
		kind: 'single-subject',
		why: 'Layout facts and names address one selected Plan subject.',
	},
	'adapters/layout/open-side-gesture-session.ts': {
		kind: 'null-tolerant',
		why: 'A Wall press without a primary is not an open-side gesture.',
	},
	'adapters/layout/opening-placement-session.ts': {
		kind: 'null-tolerant',
		why: 'Opening placement only starts from one host Wall selection.',
	},
	'adapters/layout/space-create-session.ts': {
		kind: 'null-tolerant',
		why: 'Room creation compares the selection before/after and can begin with none.',
	},
	'adapters/light/light-actions.ts': {
		kind: 'null-tolerant',
		why: 'Light it reads the whole ordered selection; a set is its normal input.',
	},
	'adapters/light/light-subjects.ts': {
		kind: 'null-tolerant',
		why: 'Returns null when no single subject is primary; a set lights through its own Card.',
	},
	'adapters/light/LightCardFields.svelte': {
		kind: 'single-subject',
		why: 'Light fields edit one light.',
	},
	'artwork/ArtworkCard.svelte': {
		kind: 'null-tolerant',
		why: 'The Artwork Card reads its own subject and tolerates no primary.',
	},
	'look/finish-authoring.svelte.ts': {
		kind: 'null-tolerant',
		why: 'Finish authoring targets every ordered entry; a set is supported directly.',
	},
	'look/finish-library.svelte.ts': {
		kind: 'null-tolerant',
		why: 'Replace target resolution accepts a null primary (no single replace target).',
	},
};

function sourceFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...sourceFiles(path));
		else if (/\.(ts|svelte)$/.test(entry.name)) files.push(path);
	}
	return files;
}

function stripped(path: string): { readonly rel: string; readonly text: string } {
	const source = readFileSync(path, 'utf8');
	const text = source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^[ \t]*\/\/.*$/gm, '');
	return { rel: relative(ROOT, path).split('\\').join('/'), text };
}

/** A read of the canonical selection's primary, never a CSS class or action group. */
function readsSelectionPrimary(text: string): boolean {
	if (!/selectionState\(\)|primaryEntry|StageSelectionState|setSelection\(/.test(text))
		return false;
	return /\b\w+\.primary\b/.test(text) || /\)\s*\.\s*primary\b/.test(text);
}

const GUARD =
	/primary\s*(===|!==|==|!=)\s*(null|undefined)|\bprimary\?\.|!primary\b|primary\s*\?\?|\bprimary\s*&&|\bprimary\s*\?/;

describe('selection primary consumers', () => {
	const actual = sourceFiles(ROOT)
		.map(stripped)
		.filter((file) => readsSelectionPrimary(file.text))
		.map((file) => file.rel)
		.sort();

	it('classifies every file that reads the canonical primary', () => {
		const classified = Object.keys(CONSUMERS).sort();
		expect(actual).toEqual(classified);
	});

	it('has no stale audit entry', () => {
		for (const rel of Object.keys(CONSUMERS)) {
			expect(actual, `${rel} no longer reads the primary; retire its audit entry`).toContain(rel);
		}
	});

	it('requires every single-subject consumer to guard a null primary', () => {
		const byPath = new Map(
			sourceFiles(ROOT).map((path) => {
				const file = stripped(path);
				return [file.rel, file.text] as const;
			}),
		);
		for (const [rel, consumer] of Object.entries(CONSUMERS)) {
			if (consumer.kind !== 'single-subject') continue;
			const text = byPath.get(rel);
			expect(text, `${rel} is audited but missing`).toBeDefined();
			expect(GUARD.test(text!), `${rel} must guard a null primary (a set has none)`).toBe(true);
		}
	});
});
