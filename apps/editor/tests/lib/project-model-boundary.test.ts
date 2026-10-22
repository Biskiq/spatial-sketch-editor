import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as projectModel from '@portfolio/project-model';
import { derivePackageId, sha256Bytes } from '@portfolio/project-model';
import * as units from '@portfolio/project-model/units';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageSrc = resolve(testDir, '../../../../packages/project-model/src');

function sourceFiles(root: string): string[] {
	const files: string[] = [];
	const pending = [root];
	while (pending.length > 0) {
		const entry = pending.pop()!;
		const stat = statSync(entry);
		if (stat.isDirectory()) {
			for (const child of readdirSync(entry)) pending.push(resolve(entry, child));
		} else if (entry.endsWith('.ts')) {
			files.push(entry);
		}
	}
	return files;
}

describe('project-model package boundary', () => {
	it('exposes the portable package primitives directly', async () => {
		expect(await sha256Bytes(new Uint8Array())).toMatch(/^sha256-[0-9a-f]{64}$/);
		expect(await derivePackageId([])).toMatch(/^package-[0-9a-f]{12}$/);
	});

	it('keeps the live F.2 source on the explicit units subpath, never the root barrel', async () => {
		// T3.P01.S04 retired the current-source reader, so the root barrel has no
		// project validator and no unit-envelope constructors. The one live source
		// entry is `@portfolio/project-model/units`.
		expect('validateProject' in projectModel).toBe(false);
		expect('validateProjectEnvelope' in projectModel).toBe(false);
		expect('createUnitProject' in projectModel).toBe(false);
		expect(typeof units.validateProjectEnvelope).toBe('function');
		expect(typeof units.prepareUnitRuntime).toBe('function');

		const envelope = await units.createProjectEnvelope({
			id: 'project',
			name: 'Project',
			acceptedRevision: { projectId: 'project', revisionId: 'revision-1' },
			dependencyLock: { formatVersion: 1, entries: [] },
			layout: { unitId: 'project:layout', data: createEmptyWallFirstLayoutDocument() },
			scene: {
				unitId: 'project:scene',
				data: { formatVersion: 2, textures: [], materials: [], entities: [] }
			},
			camera: { unitId: 'project:camera', data: { formatVersion: 1, views: [], connections: [] } },
			experience: {
				unitId: 'project:experience',
				data: { formatVersion: 2, experiences: [] }
			},
			resources: { unitId: 'project:resources', data: { formatVersion: 1, resources: [] } }
		});
		expect(units.validateProjectEnvelope(envelope).success).toBe(true);
	});

	it('keeps the extracted leaf independent from app/editor/rendering code', () => {
		for (const path of sourceFiles(packageSrc)) {
			const source = readFileSync(path, 'utf8');
			expect(source, path).not.toMatch(
			/from\s*['"][^'"]*(\$lib|\/editor\/|svelte|@threlte|three)/
		);
		}
	});

	it('leaves no app-side re-export facade between callers and the package', () => {
		// PR #115 removed the `$lib/content/package-format.ts` and
		// `$lib/editor/helpers/package-sha.ts` re-export facades (§5.1: "thin
		// facades are not domain algorithms; callers import packages directly").
		// The guarantee they carried — callers reach `@portfolio/project-model`
		// without an app-local copy of its logic — is now the absence of the
		// facade, so this asserts the removal rather than a re-export shape.
		for (const removed of [
			'../../src/lib/content/package-format.ts',
			'../../src/lib/editor/helpers/package-sha.ts'
		]) {
			expect(existsSync(resolve(testDir, removed)), removed).toBe(false);
		}
	});
});
