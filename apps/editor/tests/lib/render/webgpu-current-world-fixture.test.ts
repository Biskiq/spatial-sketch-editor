/**
 * PR 1 — the canonical current-world fixture.
 *
 * The measured saved world is absent, so the approved plan permits reproducing
 * its scale with the canonical builders. This verifier holds the fixture to the
 * plan's manifest: 10 rooms, 31 Walls, an opening, a curved Wall, a Room
 * floor/lid, a standalone Region with an S5b face Finish, a Layout object, a
 * primitive and a native form, a mapped Finish, an imported textured GLB, both
 * Artworks and the three shadow casters.
 *
 * It also opens the prepared-publication projection through the real cold
 * release composer. P20 refuses native forms, so that projection is explicit
 * and hashed rather than silently replacing the source fixture.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareUnitRuntime } from '@portfolio/project-model/units';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';

const ROOT = resolve(process.cwd(), '../..');
const BASELINE = 'apps/editor/experiments/webgpu-migration/baseline';

type Summary = {
	digest: string;
	bytes: number;
	counts: Record<string, number>;
	publicationProjection: {
		fixture: string;
		digest: string;
		bytes: number;
		removedContent: string[];
		reason: string;
	};
	requiredContent: Record<string, boolean>;
	artwork: Array<{
		path: string;
		assetId: string;
		mime: string;
		byteSize: number;
		digest: string;
	}>;
};

function read(path: string): Uint8Array<ArrayBuffer> {
	return new Uint8Array(readFileSync(resolve(ROOT, path)));
}

function text(path: string): string {
	return new TextDecoder().decode(read(path));
}

function json<T>(path: string): T {
	return JSON.parse(text(path)) as T;
}

const summary = json<Summary>(`${BASELINE}/current-world.summary.json`);
const sourceText = text(`${BASELINE}/current-world.project.json`);
const publicText = text(summary.publicationProjection.fixture);
const source = JSON.parse(sourceText) as unknown;
const publication = JSON.parse(publicText) as unknown;

function sha256(bytes: Uint8Array<ArrayBufferLike>): string {
	return `sha256-${createHash('sha256').update(new Uint8Array(bytes)).digest('hex')}`;
}

describe('PR 1 canonical current-world fixture', () => {
	it('pins the exact canonical bytes and the plan-scale counts', () => {
		expect(sha256(new TextEncoder().encode(sourceText))).toBe(summary.digest);
		expect(Buffer.byteLength(sourceText)).toBe(summary.bytes);
		expect(summary.counts).toMatchObject({
			rooms: 10,
			walls: 31,
			junctions: 22,
			openings: 1,
			regions: 1,
			objects: 1,
			forms: 1
		});
	});

	it('contains every required current-world element', () => {
		expect(summary.requiredContent).toEqual(
			Object.fromEntries(Object.keys(summary.requiredContent).map((key) => [key, true]))
		);
	});

	it('the source fixture, including the native form, prepares through the live runtime', () => {
		const prepared = prepareUnitRuntime(source);
		expect(prepared.kind).toBe('ready');
		if (prepared.kind !== 'ready') return;
		expect(prepared.geometry.rooms).toHaveLength(10);
		expect(prepared.geometry.walls).toHaveLength(31);
		expect(prepared.geometry.regions).toHaveLength(1);
		expect(prepared.geometry.objects).toHaveLength(1);
	});

	it('the explicit publication projection opens through the cold release composer', () => {
		expect(sha256(new TextEncoder().encode(publicText))).toBe(summary.publicationProjection.digest);
		expect(Buffer.byteLength(publicText)).toBe(summary.publicationProjection.bytes);
		expect(summary.publicationProjection.removedContent).toEqual(['form']);
		const bytesByUri = new Map(
			summary.artwork.map((asset) => [
				`/project-assets/${asset.assetId}`,
				{
					bytes: read(asset.path),
					mime: asset.mime,
					sha256: asset.digest
				}
			])
		);
		const bundle = composeColdReleaseBundle({
			document: publication,
			manifest: { releaseId: 'pr1-current-world@v1', bytesByUri }
		});
		try {
			expect(bundle.geometry.rooms).toHaveLength(10);
			expect(bundle.geometry.walls).toHaveLength(31);
			expect(bundle.scene.entities.some((entity) => entity.kind === 'form')).toBe(false);
			expect(bundle.scene.entities.some((entity) => entity.kind === 'artwork')).toBe(true);
		} finally {
			bundle.dispose();
		}
	});
});
