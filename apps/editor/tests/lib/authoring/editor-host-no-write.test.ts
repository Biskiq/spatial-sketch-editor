/**
 * T1.P01.S02/S04 — **the editor host reaches exactly one write path**.
 *
 * The cloud API client can save a project (`PUT`), and the platform layer exports
 * pending-cloud-save helpers. T1.P01.S02's contract was a read-only boot. T1.P01.S04
 * is the owner-authorized exception: the Head mounts `T3.P01.S02`'s conditional Save,
 * so the **one** authorized writer is `api.saveAcceptedSource`, and it must be
 * reached only through the Save transport (`save/api-transport.ts`) — never from the
 * route, a shell module or an adapter. The pending-cloud-save helpers and any other
 * write path stay forbidden.
 *
 * Nothing executable can prove an absence. The writer is *reachable* (the API
 * client is a single module), an imported name is not a call, and no lane, build or
 * type check breaks when a host file stops calling the reader or starts calling a
 * writer. So this is a call-site proof over the host's real module graph — the same
 * walk `f4-public-isolation.test.ts` resolves with the shared closure reader
 * (`tests/helpers/import-closure.ts`, `tests/README.md` rule 7) — and it belongs to
 * the unconditional arch lane for the same reason that suite does.
 *
 * **Scope.** Every editor-source member of the route host's closure except
 * `lib/platform/project-persistence.ts` itself, which is the writer's own home: the
 * client interface declares `saveProject`, and the platform exports the
 * pending-save helpers. That module matching the write predicate is therefore
 * expected, and it is asserted below — the *exclusion* is deliberate, not the
 * absence.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	EDITOR_SRC,
	REPO_ROOT,
	importClosure,
	relativeToRepo,
	stripComments
} from '../../helpers/import-closure';

/** The stage route host — the editor's one authoring entry point. */
const ROUTE_ROOT = join(EDITOR_SRC, 'routes', 'project', '[projectId]', 'spatial', '+page.svelte');
const ROUTE_MEMBER = 'apps/editor/src/routes/project/[projectId]/spatial/+page.svelte';
const PLATFORM_PERSISTENCE_MEMBER = 'apps/editor/src/lib/platform/project-persistence.ts';
const EDITOR_SOURCE_PREFIX = 'apps/editor/src/';

/** The host's closure, as repository-relative paths. */
const REACHED = [...importClosure([ROUTE_ROOT])].map(relativeToRepo);

/** The members whose call sites are judged (everything editor-side but the writer's home). */
const HOST_MEMBERS = REACHED.filter(
	(member) =>
		member.startsWith(EDITOR_SOURCE_PREFIX) && member !== PLATFORM_PERSISTENCE_MEMBER
);

/** The write paths the host must never reach, even with conditional Save mounted. */
const WRITE_PATHS = ['saveProject', 'writePendingCloudSave', 'clearPendingCloudSave'] as const;

/** The one authorized writer, allowed only in its platform transport module. */
const AUTHORIZED_SAVE = 'saveAcceptedSource';
const SAVE_TRANSPORT_MEMBER = 'apps/editor/src/lib/authoring/save/api-transport.ts';

/**
 * Which write paths this source *calls*. Comments are blanked first: the host's own
 * docblock names these paths in prose, and a commented-out call is not a call.
 */
function callsIn(source: string): string[] {
	const code = stripComments(source);
	return WRITE_PATHS.filter((name) => new RegExp(`\\b${name}\\s*\\(`).test(code));
}

function sourceOf(member: string): string {
	return readFileSync(join(REPO_ROOT, member), 'utf8');
}

describe('the editor host reaches only authorized write paths', () => {
	it('walks the route host and the editor modules it mounts', () => {
		// Positive controls: the walk is real, and it is the host's own graph.
		expect(REACHED).toContain(ROUTE_MEMBER);
		expect(REACHED).toContain(PLATFORM_PERSISTENCE_MEMBER);
		expect(REACHED).toContain('apps/editor/src/lib/project/project-codec.ts');
		expect(REACHED).toContain('apps/editor/src/lib/authoring/stage/boot-state.ts');
		expect(REACHED).toContain('apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte');
		expect(HOST_MEMBERS.length).toBeGreaterThan(8);
		// Exactly one route is in the graph, and it is the host: route files are entry
		// points, so a second one would mean a peer route was imported.
		expect(REACHED.filter((member) => member.endsWith('+page.svelte'))).toEqual([ROUTE_MEMBER]);
	});

	it('calls no forbidden write path from the host or any editor module it mounts', () => {
		// The reader is the host's whole interaction with persistence, so a rename of it
		// cannot leave this suite approving an otherwise empty host.
		expect(/\bloadProject\s*\(/.test(stripComments(sourceOf(ROUTE_MEMBER)))).toBe(true);

		const offenders = HOST_MEMBERS.filter((member) => callsIn(sourceOf(member)).length > 0).map(
			(member) => `${member}: ${callsIn(sourceOf(member)).join(', ')}`
		);
		expect(offenders).toEqual([]);
	});

	it('mounts the one authorized Save controller on the Head', () => {
		const route = stripComments(sourceOf(ROUTE_MEMBER));
		// The exception is scoped to the Head Save mount: the route builds the epoch's
		// state machine and passes it to the Head. It must not grow a second writer.
		expect(/\bcreateSaveState\s*\(/.test(route)).toBe(true);
		expect(/\bcreateHeadSave\s*\(/.test(route)).toBe(true);
		expect(/save=\{headSave\}/.test(route)).toBe(true);
	});

	it('reaches the authorized Save writer only through its transport module', () => {
		const callers = HOST_MEMBERS.filter((member) =>
			new RegExp(`\\b${AUTHORIZED_SAVE}\\s*\\(`).test(stripComments(sourceOf(member)))
		);
		// Conditional Save is mounted, so the transport must be reached; and no other
		// host module may call the writer directly.
		expect(callers).toEqual([SAVE_TRANSPORT_MEMBER]);
		expect(REACHED).toContain(SAVE_TRANSPORT_MEMBER);
	});

	it('would flag a write call, and does flag the writer module the walk reaches', () => {
		// The predicate detects real writer code in a module this walk reaches, so the
		// host exclusion above is a scope decision rather than a hole. `saveProject`
		// moved out of this module with T3's conditional Save; the pending-cloud-save
		// writers are still here, and both must be detected.
		expect(callsIn(sourceOf(PLATFORM_PERSISTENCE_MEMBER))).toEqual([
			'writePendingCloudSave',
			'clearPendingCloudSave'
		]);
		expect(sourceOf(PLATFORM_PERSISTENCE_MEMBER)).not.toMatch(/\bsaveProject\s*\(/);
		// And it flags a call site, which is the defect this suite exists to catch.
		expect(callsIn('await api.saveProject(project, signal)')).toEqual(['saveProject']);
		expect(callsIn('clearPendingCloudSave();')).toEqual(['clearPendingCloudSave']);
		expect(callsIn('writePendingCloudSave(storage, pending)')).toEqual(['writePendingCloudSave']);
		// Prose is not a call.
		expect(callsIn('// saveProject(project);\n/* writePendingCloudSave(storage, pending) */')).toEqual(
			[]
		);
	});
});
