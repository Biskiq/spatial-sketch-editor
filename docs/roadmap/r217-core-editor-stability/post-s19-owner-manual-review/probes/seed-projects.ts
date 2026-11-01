/**
 * PR #247 probe — seed the review's source fixtures through the real save route.
 * Run through vite-node with the editor's test aliases (see ./README in the report).
 * Reads E2E_TEST_AUTH_SECRET from the environment; writes only agent-user-a projects.
 */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createEmptyWallFirstLayoutDocument, mintLayoutIdCapture, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core';
import { computeEnvelopeSourceContentId, serializeProjectEnvelope, UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '@portfolio/project-model/units';
import { SAVE_ACCEPTED_SOURCE_VERSION, SAVE_CONTENT_IDENTITY_SCHEME } from '@portfolio/project-model/save';

const editorTests = process.env.PROBE_EDITOR + '/tests';
const { loginAs } = await import(/* @vite-ignore */ `${editorTests}/e2e/test-auth.ts`);
const { createUnitProject } = await import(/* @vite-ignore */ `${editorTests}/lib/authoring/__fixtures__/unit-envelope-fixtures.ts`);

const apiOrigin = 'http://localhost:8787';
const editorOrigin = 'http://localhost:5173';

function chain(base: LayoutDocumentWallFirst, points: [number, number][], close = false): LayoutDocumentWallFirst {
	const plan = planWallChain({ baseline: base, points, close, height: 3, capture: mintLayoutIdCapture(), levelId: base.floor.id });
	if (plan.kind !== 'success') throw new Error(`chain refused: ${JSON.stringify((plan as { rejection?: unknown }).rejection)}`);
	return plan.document;
}
const empty = createEmptyWallFirstLayoutDocument();
const single = chain(empty, [[0, 0], [5, 0]]);
const room = chain(empty, [[0, 0], [5, 0], [5, -4], [0, -4]], true);
const roomAndSingle = chain(room, [[-3, 0], [-3, -4]]);
const heightsBase = chain(empty, [[0, 0], [4, 0], [4, 4]]);
const heights: LayoutDocumentWallFirst = {
	...heightsBase,
	walls: heightsBase.walls.map((wall, index) => (index === 1 ? { ...wall, height: 2 } : wall))
};
const large = chain(empty, [[0, 0], [120, 0], [120, -90], [0, -90]], true);
const fixtures: Record<string, LayoutDocumentWallFirst> = {
	'pr247-empty': empty,
	'pr247-single-wall': single,
	'pr247-room': room,
	'pr247-room-and-single': roomAndSingle,
	'pr247-heights': heights,
	'pr247-large-room': large
};

const session = await loginAs({ user: 'agent-user-a', apiOrigin, secret: process.env.E2E_TEST_AUTH_SECRET!, origin: editorOrigin });
const manifest: Record<string, { projectId: string; walls: string[]; rooms: string[] }> = {};
for (const [name, layout] of Object.entries(fixtures)) {
	const projectId = randomUUID();
	const project = await createUnitProject({ id: projectId, name, layout });
	const capture = {
		protocol: SAVE_ACCEPTED_SOURCE_VERSION,
		projectId,
		operationId: `pr247-seed-${randomUUID()}`,
		precondition: { kind: 'create-only' },
		sourceKind: UNIT_SOURCE_KIND,
		sourceVersion: UNIT_SOURCE_VERSION,
		acceptedRevision: project.acceptedRevision,
		sourceContentId: await computeEnvelopeSourceContentId(project),
		canonicalJson: serializeProjectEnvelope(project)
	};
	const response = await fetch(`${apiOrigin}/projects/${encodeURIComponent(projectId)}`, {
		method: 'PUT',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json', Cookie: session.cookie, Origin: editorOrigin },
		body: JSON.stringify({ contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME, capture })
	});
	if (!response.ok) throw new Error(`${name}: HTTP ${response.status} ${await response.text()}`);
	manifest[name] = { projectId, walls: layout.walls.map((w) => w.id), rooms: layout.rooms.map((r) => r.id) };
}
writeFileSync(process.env.PROBE_OUT!, JSON.stringify({ cookie: session.cookie, manifest }, null, 2));
console.log(Object.entries(manifest).map(([k, v]) => `${k} ${v.projectId} walls=${v.walls.length} rooms=${v.rooms.length}`).join('\n'));
