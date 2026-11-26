/**
 * The deterministic set-recognition grammar (T2.S8 E5, step 1–2).
 *
 * A file name yields a *proposal*, never a decision. The proposal groups the
 * creator's selected files by stem, offers a role, component and conversion for
 * each recognized suffix, and reports every disagreement as a blocking
 * conflict. It never picks a winning file by enumeration order: shuffling the
 * input produces byte-identical output.
 *
 * Grammar:
 *
 * 1. Normalize to NFC, case-fold ASCII, strip the final extension and tokenize
 *    on space, underscore, dot and hyphen.
 * 2. Strip a final resolution token (`1k`, `2k`, `4k`).
 * 3. Match the longest terminal role alias. A resolution token immediately
 *    before the role is stripped too.
 * 4. Group by the remaining stem.
 *
 * Standalone scalars read R. ORM is occlusion R, roughness G, metallic B; RMA
 * is roughness R, metallic G, occlusion B. Gloss proposes roughness with
 * inversion. A generic `normal` proposes `+Y` and must be acknowledged.
 */
import {
	MATERIAL_MAP_ROLES,
	type MapRole,
	type NormalConvention,
	type ScalarComponent,
} from '../materials/types';
import type {
	ProposalConflict,
	ProposalSource,
	ProposalWarning,
	RoleChoice,
	SetCandidate,
	SetFileFact,
	SetProposal,
	UnassignedFile,
} from './types';

type Family =
	| 'color'
	| 'roughness'
	| 'metalness'
	| 'occlusion'
	| 'gloss'
	| 'normal'
	| 'normal-gl'
	| 'normal-dx'
	| 'orm'
	| 'rma'
	| 'unsupported';

const ALIASES: readonly { readonly tokens: readonly string[]; readonly family: Family }[] = [
	{ tokens: ['basecolor'], family: 'color' },
	{ tokens: ['base', 'color'], family: 'color' },
	{ tokens: ['albedo'], family: 'color' },
	{ tokens: ['roughness'], family: 'roughness' },
	{ tokens: ['rough'], family: 'roughness' },
	{ tokens: ['metallic'], family: 'metalness' },
	{ tokens: ['metalness'], family: 'metalness' },
	{ tokens: ['ao'], family: 'occlusion' },
	{ tokens: ['occlusion'], family: 'occlusion' },
	{ tokens: ['gloss'], family: 'gloss' },
	{ tokens: ['glossiness'], family: 'gloss' },
	{ tokens: ['normalgl'], family: 'normal-gl' },
	{ tokens: ['normal', 'gl'], family: 'normal-gl' },
	{ tokens: ['normaldx'], family: 'normal-dx' },
	{ tokens: ['normal', 'dx'], family: 'normal-dx' },
	{ tokens: ['normal'], family: 'normal' },
	{ tokens: ['orm'], family: 'orm' },
	{ tokens: ['rma'], family: 'rma' },
	// Recognized signals this profile cannot represent: named, never guessed.
	{ tokens: ['height'], family: 'unsupported' },
	{ tokens: ['displacement'], family: 'unsupported' },
	{ tokens: ['bump'], family: 'unsupported' },
	{ tokens: ['beauty'], family: 'unsupported' },
];

/** Longest alias first so `normal gl` wins over `normal`, `base color` over nothing. */
const ALIASES_BY_LENGTH = [...ALIASES].sort(
	(left, right) => right.tokens.length - left.tokens.length,
);

const RESOLUTION = /^(?:1|2|4)k$/;
const SEPARATORS = /[ _.-]+/;

function compare(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

/** NFC, ASCII case folding only: non-ASCII letters keep their exact form. */
export function normalizeSetFileName(name: string): string {
	return name.normalize('NFC').replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export type ParsedSetName = {
	readonly stem: string;
	readonly family: Family | null;
	/** The suffix that did not match any alias, for the unassigned reason. */
	readonly suffix: string | null;
	readonly resolution: string | null;
};

/** Parse one file name through steps 1–3 of the grammar. */
export function parseSetFileName(name: string): ParsedSetName {
	const folded = normalizeSetFileName(name);
	const withoutExtension = folded.includes('.') ? folded.replace(/\.[^.]*$/, '') : folded;
	const tokens = withoutExtension.split(SEPARATORS).filter((token) => token.length > 0);
	let resolution: string | null = null;
	if (tokens.length > 0 && RESOLUTION.test(tokens[tokens.length - 1]!)) {
		resolution = tokens.pop()!;
	}
	const alias = ALIASES_BY_LENGTH.find(
		(candidate) =>
			candidate.tokens.length <= tokens.length &&
			candidate.tokens.every(
				(token, index) => tokens[tokens.length - candidate.tokens.length + index] === token,
			),
	);
	if (alias === undefined) {
		const suffix = tokens.pop() ?? null;
		return { stem: tokens.join(' '), family: null, suffix, resolution };
	}
	tokens.splice(tokens.length - alias.tokens.length, alias.tokens.length);
	if (tokens.length > 0 && RESOLUTION.test(tokens[tokens.length - 1]!)) {
		const before = tokens.pop()!;
		if (resolution === null) resolution = before;
		else if (resolution !== before) {
			// `wood_2k_roughness_4k` names two resolutions; keep both visible by
			// leaving the earlier token in the stem rather than silently choosing.
			tokens.push(before);
		}
	}
	return { stem: tokens.join(' '), family: alias.family, suffix: null, resolution };
}

type Proposed = Omit<RoleChoice, 'name' | 'hash' | 'file'> & {
	readonly fact: SetFileFact;
	readonly packed: boolean;
};

function scalar(
	role: 'roughness' | 'metalness' | 'occlusion',
	component: ScalarComponent,
	source: ProposalSource,
	invert = false,
): Omit<Proposed, 'fact' | 'packed'> {
	return { role, component, invert, source };
}

function proposalsOf(family: Family): readonly Omit<Proposed, 'fact' | 'packed'>[] {
	switch (family) {
		case 'color':
			return [{ role: 'color', source: 'alias' }];
		case 'roughness':
			return [scalar('roughness', 'r', 'alias')];
		case 'metalness':
			return [scalar('metalness', 'r', 'alias')];
		case 'occlusion':
			return [scalar('occlusion', 'r', 'alias')];
		case 'gloss':
			return [scalar('roughness', 'r', 'gloss', true)];
		case 'normal-gl':
			return [{ role: 'normal', convention: '+Y' as NormalConvention, source: 'alias' }];
		case 'normal-dx':
			return [{ role: 'normal', convention: '-Y' as NormalConvention, source: 'alias' }];
		case 'normal':
			return [
				{
					role: 'normal',
					convention: '+Y' as NormalConvention,
					source: 'alias',
					acknowledge: 'normal-convention',
				},
			];
		case 'orm':
			return [
				scalar('occlusion', 'r', 'packed-orm'),
				scalar('roughness', 'g', 'packed-orm'),
				scalar('metalness', 'b', 'packed-orm'),
			];
		case 'rma':
			return [
				scalar('roughness', 'r', 'packed-rma'),
				scalar('metalness', 'g', 'packed-rma'),
				scalar('occlusion', 'b', 'packed-rma'),
			];
		case 'unsupported':
			return [];
	}
}

function choiceKey(proposed: Proposed): string {
	return [
		proposed.role,
		proposed.fact.hash,
		proposed.source,
		proposed.component ?? '',
		proposed.invert === undefined ? '' : String(proposed.invert),
		proposed.convention ?? '',
		proposed.acknowledge ?? '',
	].join('\0');
}

function byNameThenHash(left: SetFileFact, right: SetFileFact): number {
	return (
		compare(left.name, right.name) || compare(left.hash, right.hash) || compare(left.key, right.key)
	);
}

function toChoice(proposed: Proposed): RoleChoice {
	const { fact, packed: _packed, ...rest } = proposed;
	void _packed;
	return { ...rest, file: fact.key, name: fact.name, hash: fact.hash };
}

function sortChoices(choices: RoleChoice[]): RoleChoice[] {
	return choices.sort(
		(left, right) =>
			compare(left.role, right.role) ||
			compare(left.name, right.name) ||
			compare(left.hash, right.hash),
	);
}

const ENCODING_ACTION =
	'Re-export the map as an 8-bit, single-frame PNG, JPEG or WebP and select it again.';

function candidateOf(
	stem: string,
	members: readonly { fact: SetFileFact; parsed: ParsedSetName }[],
): SetCandidate {
	const sorted = [...members].sort((left, right) => byNameThenHash(left.fact, right.fact));
	const proposed: Proposed[] = [];
	const unassigned: UnassignedFile[] = [];
	for (const { fact, parsed } of sorted) {
		if (parsed.family === null) {
			unassigned.push({
				file: fact.key,
				name: fact.name,
				reason: 'unknown-suffix',
				detail:
					parsed.suffix === null
						? 'The name has no role suffix.'
						: `“${parsed.suffix}” is not a recognized map role.`,
				action: 'Assign the file to a role, or leave it out.',
			});
			continue;
		}
		if (parsed.family === 'unsupported') {
			unassigned.push({
				file: fact.key,
				name: fact.name,
				reason: 'unsupported-signal',
				detail:
					'Height, bump and beauty maps need a different evaluator than pbr-metallic-roughness/v1.',
				action: 'Leave it out of this Finish.',
			});
			continue;
		}
		const roles = proposalsOf(parsed.family);
		const packed = roles.length > 1;
		for (const role of roles) {
			const admission = role.role === 'color' ? fact.colour : fact.raw;
			if (!admission.ok) {
				unassigned.push({
					file: fact.key,
					name: fact.name,
					reason: 'unsupported-image-encoding',
					role: role.role,
					detail: admission.reason,
					action: admission.action || ENCODING_ACTION,
				});
				continue;
			}
			proposed.push({ ...role, fact, packed });
		}
	}

	// Identical digests proposing the same role and selector collapse onto the
	// lexically first name; anything else for one role is a conflict.
	const collapsed = new Map<string, Proposed>();
	for (const entry of proposed) {
		const key = choiceKey(entry);
		if (!collapsed.has(key)) collapsed.set(key, entry);
	}
	const byRole = new Map<MapRole, Proposed[]>();
	for (const entry of collapsed.values()) {
		const list = byRole.get(entry.role) ?? [];
		list.push(entry);
		byRole.set(entry.role, list);
	}

	const choices: RoleChoice[] = [];
	const conflicts: ProposalConflict[] = [];
	const warnings: ProposalWarning[] = [];
	for (const role of MATERIAL_MAP_ROLES) {
		const entries = byRole.get(role);
		if (entries === undefined || entries.length === 0) continue;
		if (entries.length === 1) {
			choices.push(toChoice(entries[0]!));
			continue;
		}
		const packedCount = entries.filter((entry) => entry.packed).length;
		const mixed = packedCount > 0 && packedCount < entries.length;
		const files = [...new Set(entries.map((entry) => entry.fact.key))].sort();
		conflicts.push({
			code: mixed ? 'packed-loose-collision' : 'duplicate-role',
			role,
			files,
			action: mixed
				? `Choose the packed or the separate ${role} map, then exclude the other.`
				: `Choose one ${role} map, then exclude the others.`,
		});
	}

	for (const choice of choices) {
		const fact = sorted.find((member) => member.fact.key === choice.file)!.fact;
		const admission = choice.role === 'color' ? fact.colour : fact.raw;
		if (choice.role !== 'color' && admission.ok && admission.lossy) {
			warnings.push({
				code: 'lossy-data',
				role: choice.role,
				files: [choice.file],
				detail:
					'A lossy JPEG changes data values; prefer a PNG export for normals and scalar maps.',
			});
		}
	}

	const resolutions = [
		...new Set(
			sorted
				.map((member) => member.parsed.resolution)
				.filter((value): value is string => value !== null),
		),
	].sort();
	if (resolutions.length > 1) {
		warnings.push({
			code: 'multiple-resolutions',
			files: sorted
				.filter((member) => member.parsed.resolution !== null)
				.map((member) => member.fact.key)
				.sort(),
			detail: `The selection mixes ${resolutions.join(', ')} files.`,
		});
	}
	const chosenFiles = [...new Set(choices.map((choice) => choice.file))].sort();
	const sizes = new Set(
		chosenFiles.map((key) => {
			const fact = sorted.find((member) => member.fact.key === key)!.fact;
			return `${fact.width}x${fact.height}`;
		}),
	);
	if (sizes.size > 1) {
		warnings.push({
			code: 'dimension-mismatch',
			files: chosenFiles,
			detail: 'The chosen maps have different pixel dimensions; check that their texels align.',
		});
	}
	if (stem.length === 0) {
		warnings.push({
			code: 'empty-stem',
			files: sorted.map((member) => member.fact.key).sort(),
			detail: 'These names have no shared stem; name the Finish before accepting it.',
		});
	}

	return {
		stem,
		roleChoices: sortChoices(choices),
		conflicts: conflicts.sort(
			(left, right) => compare(left.role, right.role) || compare(left.code, right.code),
		),
		unassigned: unassigned.sort(
			(left, right) =>
				compare(left.name, right.name) ||
				compare(left.file, right.file) ||
				compare(left.role ?? '', right.role ?? ''),
		),
		warnings: warnings.sort(
			(left, right) =>
				compare(left.code, right.code) ||
				compare(left.role ?? '', right.role ?? '') ||
				compare(left.files.join(','), right.files.join(',')),
		),
	};
}

/**
 * Propose candidate Finishes for one selection of files.
 *
 * Pure and order-independent: the same set of facts in any order yields the
 * same proposal. `expectedRevision` is the accepted revision the proposal was
 * made against; a correction accepted against another revision is re-proposed.
 */
export function proposeMaterialSet(
	files: readonly SetFileFact[],
	expectedRevision: string,
): SetProposal {
	const keys = new Set<string>();
	for (const file of files) {
		if (keys.has(file.key)) throw new Error(`Duplicate set file key: ${file.key}`);
		keys.add(file.key);
	}
	const groups = new Map<string, { fact: SetFileFact; parsed: ParsedSetName }[]>();
	for (const fact of files) {
		const parsed = parseSetFileName(fact.name);
		const group = groups.get(parsed.stem) ?? [];
		group.push({ fact, parsed });
		groups.set(parsed.stem, group);
	}
	const candidates = [...groups.entries()]
		.sort(([left], [right]) => compare(left, right))
		.map(([stem, members]) => candidateOf(stem, members));
	const fileFacts = [...files].sort(byNameThenHash);
	return { expectedRevision, candidates, fileFacts };
}
