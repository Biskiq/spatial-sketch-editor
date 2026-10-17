import { currentStageSource } from '$lib/authoring/stage/current-stage-source';
/**
 * T1.P01.S02 — the editor host's explicit boot states.
 *
 * The plan's boot contract is that **every** state a creator can land in is
 * named, distinct and reached by its own rule, and that admission equals runtime
 * preparation. The material failures this suite catches are the ones a
 * collapsed state hides: an absent row silently treated as new (so a mistyped
 * address offers a starter gallery over someone's real address), a refused
 * payload rendered as a silently empty Stage, and a `diagnostics` compile
 * reported as `ready`.
 *
 * `new` vs `missing` is decided by **how the identity was reached**, not by what
 * the server returned: both get a 404 for an absent row, and only a minted
 * (`?create=1`) identity may become `new`. That is the single rule the plan
 * singles out, and it is pinned first.
 *
 * Sources are real ones: the offered starter templates built through the
 * retained Wall-chain planner, the canonical empty baseline, and the S03
 * sibling fixture for the blocking-compile case (a document that passes the
 * strict codec and still has a blocking canonical compile — no hand-built shape
 * would prove the distinction).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	bootEmpty,
	bootFromLoadOutcome,
	bootFromSourceJson,
	bootIntentFromSearch,
	bootStarterGallery,
	documentOf,
	initialBootState,
	stages,
	type BootLoadOutcome,
	type BootState
} from '$lib/authoring/stage/boot-state';
import { CURRENT_SOURCE_VERSION, type ProjectDocument } from '@portfolio/project-model';
import { EDITOR_SRC } from '../../helpers/import-closure';
import type { AdmissionContext } from '$lib/authoring/stage/source-admission';
import {
	STARTER_TEMPLATES,
	buildStarterEnclosureLayout,
	starterBlockingIssueMessages
} from '$lib/authoring/stage/starter-gallery';
import { serializeProject } from '$lib/project/project-codec';
import { FIXTURE_PROJECT_ID, buildFoldedPartitionProject } from './__fixtures__/f4-current-source-fixtures';

const PROJECT_ID = 'project-boot-states';

/** The one state vocabulary; no state is folded into another. */
const BOOT_STATUSES: readonly BootState['status'][] = [
	'loading',
	'new',
	'empty',
	'ready',
	'diagnostics',
	'refused',
	'missing',
	'forbidden',
	'error'
];

let revisions = 0;

/** One explicit admission context per accepted source, as the host supplies it. */
function contextFor(projectId: string = PROJECT_ID): AdmissionContext {
	revisions += 1;
	return {
		sessionEpoch: `session:boot-states:${revisions}`,
		acceptedRevision: { projectId, revisionId: `revision-${revisions}` }
	};
}

function starterDocument(): ProjectDocument {
	return STARTER_TEMPLATES[0]!.build(PROJECT_ID, STARTER_TEMPLATES[0]!.label);
}

describe('the editor host boots into exactly one named state', () => {
	it('offers the starter gallery only for a minted identity, and reports an opened absence as missing', async () => {
		// The intent is how the identity was reached; `?create=1` is the mint.
		expect(bootIntentFromSearch(new URLSearchParams('create=1'))).toBe('create');
		expect(bootIntentFromSearch(new URLSearchParams(''))).toBe('open');
		expect(bootIntentFromSearch(new URLSearchParams('create=0'))).toBe('open');

		const minted = await bootFromLoadOutcome(
			initialBootState(PROJECT_ID, 'create'),
			{ kind: 'not-found' },
			contextFor()
		);
		expect(minted).toEqual({ status: 'new', projectId: PROJECT_ID, intent: 'create' });

		// The same server answer, an identity someone asked to open: never a
		// silent new project over an address that simply is not there.
		const opened = await bootFromLoadOutcome(
			initialBootState(PROJECT_ID, 'open'),
			{ kind: 'not-found' },
			contextFor()
		);
		expect(opened).toEqual({ status: 'missing', projectId: PROJECT_ID });
	});

	it('maps every read failure to its own state', async () => {
		const forbidden = await bootFromLoadOutcome(
			initialBootState(PROJECT_ID, 'open'),
			{ kind: 'forbidden' },
			contextFor()
		);
		expect(forbidden).toEqual({ status: 'forbidden', projectId: PROJECT_ID });

		const network = await bootFromLoadOutcome(
			initialBootState(PROJECT_ID, 'open'),
			{ kind: 'network' },
			contextFor()
		);
		expect(network.status).toBe('error');
		if (network.status !== 'error') return;
		expect(network.message).toBe('Cloud service is unavailable');

		// A server failure keeps its own message: it is not rewritten as missing.
		const server = await bootFromLoadOutcome(
			initialBootState(PROJECT_ID, 'open'),
			{ kind: 'server', message: 'the request was rejected' },
			contextFor()
		);
		expect(server).toEqual({ status: 'error', projectId: PROJECT_ID, message: 'the request was rejected' });
	});

	it('admits a loaded valid source into ready with the read-facade contract the Stage mounts', async () => {
		const document = starterDocument();
		const before = JSON.stringify(document);
		const context = contextFor();
		const ready = await bootFromLoadOutcome(
			initialBootState(PROJECT_ID, 'open'),
			{ kind: 'loaded', document },
			context
		);
		expect(ready.status).toBe('ready');
		if (ready.status !== 'ready') return;

		const snapshot = ready.snapshot;
		expect(snapshot.acceptedRevision).toEqual(context.acceptedRevision);
		expect(snapshot.sessionEpoch).toBe(context.sessionEpoch);
		expect(snapshot.sourceKind).toBe('project-current');
		expect(snapshot.sourceVersion).toBe(CURRENT_SOURCE_VERSION);
		expect(snapshot.sourceContentId).toMatch(/^sha256-[0-9a-f]{64}$/);
		expect(snapshot.compileGeneration).toBe(`compile:${snapshot.sourceContentId}`);

		// Domain read access: the admitted source itself, the F.1 read-context
		// identity, canonical compiled Layout, the resolved runtime Scene and the
		// visitor-equivalent navigation graph.
		// The read adapters bind to the one admitted source, and admitting it does not
		// mutate or re-spell the payload the caller supplied.
		expect(snapshot.domain.references.snapshot).toEqual(currentStageSource(snapshot).snapshot);
		expect(currentStageSource(snapshot).source.id).toBe(document.id);
		expect(currentStageSource(snapshot).source.layout).toEqual(document.layout);
		expect(JSON.stringify(document)).toBe(before);
		expect(currentStageSource(snapshot).snapshot).toEqual({
			acceptedRevision: context.acceptedRevision,
			sourceContentId: snapshot.sourceContentId
		});
		expect(snapshot.domain.geometry.floors).toHaveLength(1);
		expect(snapshot.domain.datumMeters).toBe(snapshot.domain.geometry.floors[0]!.elevation);
		expect(snapshot.domain.geometry.bounds).not.toBeNull();
		// Room identity in the current format lives on the compiled Floor, and the
		// registry a consumer reads is empty by that same contract — both are asserted
		// so a registry that invented entries (or a Floor that lost its Room) fails.
		expect(snapshot.domain.geometry.floors[0]!.roomIds.length).toBeGreaterThan(0);
		expect(snapshot.domain.rooms.entries).toEqual([]);
		// The starter Scene carries no Camera path, so the navigation graph is
		// resolved and genuinely empty rather than merely present.
		expect(snapshot.domain.graph.connections).toEqual([]);
		// A clean canonical compile has no warnings to disclose.
		expect(snapshot.domain.warnings).toEqual([]);
	});

	it('separates a refused payload from a source whose canonical compile is blocked', async () => {
		const starter = starterDocument();
		const malformed = await bootFromLoadOutcome(
			initialBootState(PROJECT_ID, 'open'),
			{ kind: 'loaded', document: { ...(starter as Record<string, unknown>), layout: { units: 'meters' } } },
			contextFor()
		);
		expect(malformed.status).toBe('refused');
		if (malformed.status !== 'refused') return;
		expect(malformed.reason).toBe('invalid-format');
		expect(malformed.issues.length).toBeGreaterThan(0);
		// A refused source carries no snapshot: there is nothing to mount.
		expect('snapshot' in malformed).toBe(false);

		// Validates, but its canonical compile has a blocking issue: the state
		// names the issue instead of rendering a silent empty or partial Stage.
		const blocked = await bootFromLoadOutcome(
			initialBootState(FIXTURE_PROJECT_ID, 'open'),
			{ kind: 'loaded', document: buildFoldedPartitionProject() },
			contextFor(FIXTURE_PROJECT_ID)
		);
		expect(blocked.status).toBe('diagnostics');
		if (blocked.status !== 'diagnostics') return;
		expect(blocked.issues.length).toBeGreaterThan(0);
		expect(blocked.issues.map((issue) => issue.code)).toContain('wall_offset_fold');
		expect('snapshot' in blocked).toBe(false);
	});

	it('unwraps the reader carrier without rewriting a raw source', () => {
		const raw = { id: PROJECT_ID, name: 'Raw', layout: {}, scene: {} };
		expect(documentOf(raw)).toBe(raw);

		const inner = { id: PROJECT_ID, name: 'Carried', layout: {}, scene: {} };
		expect(documentOf({ project: inner })).toBe(inner);

		// A carrier whose `project` is not an identified document is passed
		// through unchanged: admission decides, not this reader.
		const unrelated = { project: { layout: {} } };
		expect(documentOf(unrelated)).toBe(unrelated);
		expect(documentOf(null)).toBeNull();
		expect(documentOf('not a document')).toBe('not a document');
	});

	it('boots the starter gallery to a real compilable enclosure', async () => {
		// A template that cannot compile to a real floor is not a template.
		for (const template of STARTER_TEMPLATES) {
			expect(
				starterBlockingIssueMessages(template.build(PROJECT_ID, template.label)),
				`starter template "${template.id}" must compile with no blocking issue`
			).toEqual([]);
		}

		const built = buildStarterEnclosureLayout();
		expect(built.walls).toHaveLength(4);

		const context = contextFor();
		const state = await bootStarterGallery(PROJECT_ID, context);
		expect(state.status).toBe('ready');
		if (state.status !== 'ready') return;
		expect(currentStageSource(state.snapshot).source.name).toBe(STARTER_TEMPLATES[0]!.label);
		expect(state.snapshot.domain.geometry.floors).toHaveLength(1);
		expect(state.snapshot.domain.geometry.walls).toHaveLength(4);
		// No Scene objects and no Camera content: the starter is architecture.
		expect(state.snapshot.domain.scene.entities).toEqual([]);
		expect(state.snapshot.acceptedRevision).toEqual(context.acceptedRevision);
	});

	it('refuses an unknown starter template rather than rendering an empty Stage', async () => {
		const state = await bootStarterGallery(PROJECT_ID, contextFor(), 'not-a-template');
		expect(state.status).toBe('error');
		if (state.status !== 'error') return;
		expect(state.message).toContain('not-a-template');
	});

	it('boots a genuinely empty baseline as empty, with no enclosure pretending to be one', async () => {
		const state = await bootEmpty(PROJECT_ID, contextFor());
		expect(state.status).toBe('empty');
		if (state.status !== 'empty') return;
		expect(stages(state.status)).toBe(true);
		// Empty means no architecture drawn: the current format's baseline carries its
		// unroomed level record, and the compile derives no Wall or Room polygon from it.
		expect(state.snapshot.domain.geometry.walls).toEqual([]);
		expect(state.snapshot.domain.geometry.floors.every((floor) => floor.roomIds.length === 0)).toBe(true);
		expect(state.snapshot.domain.datumMeters).toBe(0);
		expect(currentStageSource(state.snapshot).source.name).toBe('Untitled project');
	});

	it('opens explicit source JSON through the one admission path', async () => {
		const document = starterDocument();
		const viaJson = await bootFromSourceJson(serializeProject(document), PROJECT_ID, contextFor());
		expect(viaJson.status).toBe('ready');
		if (viaJson.status !== 'ready') return;

		// The same content through the cloud entry and the JSON entry admits to
		// the same content identity: one admission path, not two.
		const viaLoad = await bootFromLoadOutcome(
			initialBootState(PROJECT_ID, 'open'),
			{ kind: 'loaded', document },
			contextFor()
		);
		expect(viaLoad.status).toBe('ready');
		if (viaLoad.status !== 'ready') return;
		expect(viaJson.snapshot.sourceContentId).toBe(viaLoad.snapshot.sourceContentId);

		// JSON that does not parse is its own refusal, never a silent empty Stage.
		const broken = await bootFromSourceJson('{ "id": ', PROJECT_ID, contextFor());
		expect(broken.status).toBe('refused');
		if (broken.status !== 'refused') return;
		expect(broken.reason).toBe('invalid-json');

		// Parses, but is not a current-format source.
		const wrongShape = await bootFromSourceJson('{"nope":true}', PROJECT_ID, contextFor());
		expect(wrongShape.status).toBe('refused');
		if (wrongShape.status !== 'refused') return;
		expect(wrongShape.reason).toBe('invalid-format');
	});

	it('names nine disjoint statuses, so no state can be folded into another', async () => {
		const outcomes: BootLoadOutcome[] = [
			{ kind: 'not-found' },
			{ kind: 'forbidden' },
			{ kind: 'network' }
		];
		const states: BootState[] = [initialBootState(PROJECT_ID, 'create')];
		for (const outcome of outcomes) {
			states.push(await bootFromLoadOutcome(initialBootState(PROJECT_ID, 'open'), outcome, contextFor()));
		}
		// The minted identity's own absent row: `new`, distinct from the `missing`
		// an opened absence produces for the same server answer.
		states.push(
			await bootFromLoadOutcome(initialBootState(PROJECT_ID, 'create'), { kind: 'not-found' }, contextFor())
		);
		states.push(
			await bootFromLoadOutcome(
				initialBootState(PROJECT_ID, 'open'),
				{ kind: 'loaded', document: starterDocument() },
				contextFor()
			)
		);
		states.push(
			await bootFromLoadOutcome(
				initialBootState(FIXTURE_PROJECT_ID, 'open'),
				{ kind: 'loaded', document: buildFoldedPartitionProject() },
				contextFor(FIXTURE_PROJECT_ID)
			)
		);
		states.push(await bootEmpty(PROJECT_ID, contextFor()));
		states.push(await bootFromSourceJson('{ "id": ', PROJECT_ID, contextFor()));

		// One state per status, and nothing outside the declared vocabulary.
		expect(states.map((state) => state.status).sort()).toEqual([...BOOT_STATUSES].sort());
		// `stages` is true for exactly the two states that mount a source.
		expect(states.filter((state) => stages(state.status)).map((state) => state.status).sort()).toEqual([
			'empty',
			'ready'
		]);
	});

	it('is reached by the product: every mint entry marks its mint, and no open entry does', () => {
		// Machinery correctness is not call-site correctness: `bootIntentFromSearch`
		// reads `?create=1`, so if no entry ever wrote it, `new` (and with it the
		// starter gallery and the empty baseline) would be unreachable and every
		// mistyped address would still answer `missing`. Nothing imports these routes,
		// so only a source-level call-site proof can hold it.
		const MINT_ENTRIES = [
			// `/editor` mints an id and writes the marker straight into its redirect.
			{
				file: join(EDITOR_SRC, 'routes', 'editor', '+page.svelte'),
				minted: '/spatial?create=1',
				flags: 0
			},
			// The public entry's "Start creating" and the hub's "New Project" pass the
			// flag to the URL helper that turns it into the same marker.
			{
				file: join(EDITOR_SRC, 'routes', '+page.svelte'),
				minted: 'projectUrl(createProjectId(), { create: true })',
				flags: 1
			},
			{
				file: join(EDITOR_SRC, 'routes', 'projects', '+page.svelte'),
				minted: 'projectUrl(createProjectId(), { create: true })',
				flags: 1
			}
		];

		for (const entry of MINT_ENTRIES) {
			const source = readFileSync(entry.file, 'utf8');
			// Positive control: the file was really read and is a route.
			expect(source.length).toBeGreaterThan(200);
			expect(source).toContain('createProjectId');
			expect(source).toContain(entry.minted);
			// Exactly one mint per entry: an entry cannot create two projects, and a
			// second `create: true` would mark an open entry as a mint.
			expect((source.match(/create: true/g) ?? []).length).toBe(entry.flags);
		}

		// The reader side of the same contract, so a rename of the flag cannot leave
		// the entries above approving themselves.
		expect(bootIntentFromSearch(new URLSearchParams('create=1'))).toBe('create');

		// Open entries stay unmarked: the hub opens an owned project, and the entry
		// page resumes a saved draft, neither of which is a mint.
		expect(readFileSync(join(EDITOR_SRC, 'routes', 'projects', '+page.svelte'), 'utf8')).toContain(
			'projectUrl(project.id, { load: true })'
		);
		expect(readFileSync(join(EDITOR_SRC, 'routes', '+page.svelte'), 'utf8')).toContain(
			'projectUrl(pending.project.id)'
		);
	});
});
