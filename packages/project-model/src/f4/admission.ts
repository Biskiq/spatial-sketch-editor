/**
 * `local-single-domain-v1` — current-source admission (T1.P01.S03, plan
 * §Admission; PR #127 decision 3: **admission equals runtime preparation**).
 *
 * A candidate is shown only when the visitor's own cold path would accept it:
 *
 * 1. the project's one canonical validator accepts it, with the **host's** Scene
 *    options (`validateProject`: root shape, unknown keys, both nested documents
 *    and the project-level Camera-pose rule);
 * 2. it prepares through the **runtime Scene path** the visitor cold runtime
 *    uses (`prepareRuntime` → the one Layout compiler + one Scene resolution), so
 *    the editor cannot accept a document the visitor refuses;
 * 3. it introduces **no blocking canonical-compile issue its baseline does not
 *    already carry** — baseline-relative because the accepted chain normally
 *    carries none (S02's boot refuses sources with blocking issues), and only a
 *    later repair mode would ever start from a dirty baseline.
 *
 * The admission also computes the current-source **content identity** (the one
 * export owned here, see ../content-identity) and nothing else: no accepted
 * revision is minted, no fixity/history value is stored, no F.2 header or lock is
 * written, and the source stays the current-format document pair. Those are the
 * boundaries that keep this adapter retiring cleanly at `T3.P01.S04`.
 *
 * Cost, stated rather than hidden (the plan asks for a measured observation):
 * admission validates the project twice — once inside `prepareRuntime` for the
 * runtime path, once through the landed writer for the canonical bytes — and the
 * second pass is the price of reusing the one writer instead of reproducing its
 * byte format here. Compilation and Scene resolution happen once.
 *
 * Runtime-safe: imports the Layout/Camera-free packages and this package's own
 * codec/runtime; no editor, renderer, Svelte or Three import. Usable server-side,
 * which `T3.P01.S02`'s shared validation needs.
 */

import { immutableF4Data, freezeF4Data } from './immutable';
import {
	hasBlockingLayoutIssues,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutGeometryIssue
} from '@portfolio/layout-core';
import type { ShapeIssue } from '../strict-shape';
import { ProjectValidationError } from '../project-codec';
import { prepareRuntime, type RuntimeReady } from '../runtime';
import { canonicalSourceJson, sourceContentIdForCanonicalJson } from '../content-identity';
import type { SceneValidationOptions } from '../scene-codec';
import type { ProjectDocument, ProjectIssue } from '../project-types';
import type {
	AcceptanceSourceAdapter,
	AcceptedRevision,
	AcceptedSnapshot,
	AdmissionIssue,
	SourceAdmission
} from './types';

/** The admitted source kind: today's current-format document pair. */
export const CURRENT_SOURCE_KIND = 'current-source';

/**
 * The admitted source version: the current Layout format number
 * (`formatVersion: 5`), which is the number that changes when the pair does. It
 * is the landed constant, never a literal, so a Layout format cutover cannot
 * leave this adapter claiming the old version.
 */
export const CURRENT_SOURCE_VERSION: number = LAYOUT_WALL_FIRST_FORMAT_VERSION;

export type CurrentSourceAdmissionOptions = {
	/** The host's Scene options. Admission uses the same ones the host renders with. */
	readonly scene?: SceneValidationOptions;
	/** Blocking issues the baseline already carries; only *new* ones refuse. */
	readonly baselineBlockingIssues?: readonly AdmissionIssue[];
};

/** One admitted current source: validated, prepared and identified. */
export type AdmittedCurrentSource = {
	readonly kind: 'admitted';
	/** The validated project document (the current pair). */
	readonly project: ProjectDocument;
	/** The landed writer's canonical bytes for exactly this project. */
	readonly canonicalJson: string;
	/** `sha256Bytes` over those canonical bytes — the current-source content identity. */
	readonly sourceContentId: string;
	/** Blocking issues this source carries (baseline-relative, so usually empty). */
	readonly blockingIssues: readonly AdmissionIssue[];
	/** Every compiler issue, warnings included, for diagnostics. */
	readonly issues: readonly AdmissionIssue[];
	/** The runtime preparation: the one compiler and the one Scene resolution. */
	readonly runtime: RuntimeReady;
};

export type CurrentSourceRefusal = {
	readonly kind: 'rejected';
	readonly code:
		| 'invalid-project'
		| 'runtime-refused'
		| 'blocking-geometry'
		| 'content-identity-failed';
	readonly message: string;
	readonly issues: readonly ProjectIssue[];
	readonly blockingIssues: readonly AdmissionIssue[];
};

export type CurrentSourceAdmission = AdmittedCurrentSource | CurrentSourceRefusal;

/** Admission plus the accepted revision it is published under. */
export type AdmittedCurrentSourceSnapshot = AdmittedCurrentSource & {
	readonly acceptedRevision: AcceptedRevision;
	readonly snapshot: AcceptedSnapshot<ProjectDocument>;
};

/**
 * Admit one candidate as the current source, published under
 * `options.acceptedRevision`.
 *
 * The revision is an input, not a product: minting belongs to the coordinator,
 * which mints **outside** deterministic planning (AM-4). This function only ever
 * answers "is this a source the visitor would accept, and what is its content".
 */
export async function admitCurrentSource(
	input: unknown,
	options: CurrentSourceAdmissionOptions & { readonly acceptedRevision: AcceptedRevision }
): Promise<AdmittedCurrentSourceSnapshot | CurrentSourceRefusal> {
	const revision = immutableF4Data(options.acceptedRevision);
	const admitted = await admitCurrentSourceContent(input, options);
	if (admitted.kind === 'rejected') return admitted;
	return {
		...admitted,
		acceptedRevision: revision,
		snapshot: createAcceptedSnapshot(revision, admitted)
	};
}

/**
 * The snapshot one admitted source publishes, in the AM-4 field names S02's boot
 * snapshot uses. `identity` is the F.1 read-context identity, so a planner can
 * hand it straight to the landed resolvers without re-deriving anything.
 */
export function createAcceptedSnapshot(
	acceptedRevision: AcceptedRevision,
	admitted: AdmittedCurrentSource
): AcceptedSnapshot<ProjectDocument> {
	const revision = immutableF4Data(acceptedRevision);
	return freezeF4Data({
		acceptedRevision: revision,
		sourceContentId: admitted.sourceContentId,
		sourceKind: CURRENT_SOURCE_KIND,
		sourceVersion: CURRENT_SOURCE_VERSION,
		domain: {
			identity: { acceptedRevision: revision, sourceContentId: admitted.sourceContentId },
			source: admitted.project
		}
	});
}

/**
 * The source-content half of admission, without an accepted revision: what a
 * source adapter needs. Exported because the coordinator's adapter and the
 * snapshot-producing form must not diverge — there is one admission path.
 */
export async function admitCurrentSourceContent(
	input: unknown,
	options: CurrentSourceAdmissionOptions = {}
): Promise<AdmittedCurrentSource | CurrentSourceRefusal> {
	const baseline = immutableF4Data(options.baselineBlockingIssues ?? []);

	const preparation = prepareRuntime(input, options.scene);
	if (preparation.kind === 'rejected') {
		return {
			kind: 'rejected',
			code: preparation.reason === 'invalid-project' ? 'invalid-project' : 'runtime-refused',
			message: preparation.issues[0]?.message ?? 'The source is not the current document pair',
			issues: preparation.issues,
			blockingIssues: []
		};
	}

	const issues: readonly AdmissionIssue[] = preparation.issues;
	const blocking = issues.filter((issue) => hasBlockingLayoutIssues([issue]));
	const baselineSignatures = new Set(baseline.map(issueSignature));
	const introduced = blocking.filter((issue) => !baselineSignatures.has(issueSignature(issue)));
	if (introduced.length > 0) {
		return {
			kind: 'rejected',
			code: 'blocking-geometry',
			message: introduced[0]!.message,
			issues: preparation.issues,
			blockingIssues: introduced
		};
	}

	let canonicalJson: string;
	try {
		const canonical = canonicalSourceJson(preparation.project, options.scene ? { scene: options.scene } : {});
		if (canonical.kind === 'rejected') throw new ProjectValidationError(canonical.issues[0]!);
		canonicalJson = canonical.canonicalJson;
		preparation.project = canonical.project;
	} catch (error) {
		const issue = error instanceof ProjectValidationError
			? error.issue
			: { path: '$', code: 'serialize_failed', message: error instanceof Error ? error.message : 'Serialization failed' };
		return {
			kind: 'rejected',
			code: 'content-identity-failed',
			message: issue.message,
			issues: [issue],
			blockingIssues: []
		};
	}

	freezeF4Data(preparation.project);
	return {
		kind: 'admitted',
		project: preparation.project,
		canonicalJson,
		sourceContentId: await sourceContentIdForCanonicalJson(canonicalJson),
		blockingIssues: blocking,
		issues,
		runtime: preparation
	};
}

/**
 * The F.4 source adapter for the current source: the coordinator's admission and
 * content-identity seam, with the host's Scene options baked in.
 *
 * It refuses candidates through the same path the visitor cold runtime uses, so
 * "the editor accepted it and the visitor refuses it" is not a reachable state.
 */
export function createCurrentSourceAdapter(
	options: CurrentSourceAdmissionOptions = {}
): AcceptanceSourceAdapter<ProjectDocument> {
	return {
		sourceKind: CURRENT_SOURCE_KIND,
		sourceVersion: CURRENT_SOURCE_VERSION,
		validateChange(before, after, domain) {
			const issues: ShapeIssue[] = [];
			function unchanged(path: string, a: unknown, b: unknown) {
				if (JSON.stringify(a) !== JSON.stringify(b)) issues.push({ path, code: 'unsupported-change', message: `${path} is outside this ${domain} operation's admitted scope` });
			}
			unchanged('$.id', before.id, after.id);
			unchanged('$.name', before.name, after.name);
			if (domain === 'layout') unchanged('$.scene', before.scene, after.scene);
			else if (domain === 'scene') unchanged('$.layout', before.layout, after.layout);
			else issues.push({ path: '$', code: 'unsupported-domain', message: 'Only Layout or Scene changes are admitted' });
			for (const key of ['navigationNodes', 'connections', 'materials', 'textures'] as const) unchanged(`$.scene.${key}`, before.scene[key], after.scene[key]);
			return issues;
		},
		async admit(candidate, baselineBlockingIssues): Promise<SourceAdmission<ProjectDocument>> {
			const admitted = await admitCurrentSourceContent(candidate, {
				...options,
				baselineBlockingIssues
			});
			if (admitted.kind === 'rejected') {
				return {
					kind: 'rejected',
					code: admitted.code,
					message: admitted.message,
					issues: admitted.issues.map(toShapeIssue)
				};
			}
			return {
				kind: 'admitted',
				source: admitted.project,
				canonicalJson: admitted.canonicalJson,
				sourceContentId: admitted.sourceContentId,
				blockingIssues: admitted.blockingIssues
			};
		}
	};
}

/** The project-codec issue as the shared reader's issue vocabulary. */
function toShapeIssue(issue: ProjectIssue): ShapeIssue {
	return { path: issue.path, code: issue.code, message: issue.message };
}

/**
 * The stable identity of a blocking issue, for baseline comparison. Deliberately
 * structural (path · code · target · message) rather than object identity: a
 * candidate is admitted when it introduces no *new* blocking issue, whatever
 * object carries the old one.
 */
export function issueSignature(issue: AdmissionIssue | LayoutGeometryIssue): string {
	return [issue.path, issue.code, issue.targetId ?? '', issue.message].join('\u0000');
}
