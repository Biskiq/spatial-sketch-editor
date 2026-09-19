import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	resolveInspectorDomain,
	resolveInspectorExposure,
	type InspectorSelectionDomain
} from '$lib/editor/app/inspector-target';
import type { EditorWorkspace } from '$lib/editor/editor-types';

const SRC = fileURLToPath(new URL('../../../../src/lib/editor', import.meta.url));

function read(relative: string): string {
	return fs.readFileSync(path.join(SRC, relative), 'utf8');
}

const WORKSPACES: readonly EditorWorkspace[] = ['scene', 'camera', 'layout'];
const SELECTIONS: readonly InspectorSelectionDomain[] = ['none', 'scene', 'camera', 'layout'];

/**
 * P23.14 §2.5/§13 — the Inspector exposes ONE target, scoped by the workspace
 * that is on screen. A selection from another workspace is remembered (S3
 * view-switch preservation) but never presented, so Scene cannot mount the
 * Camera framing editor (F1) and the selection header can never name an entity
 * whose editor is not mounted below it (F2).
 */
describe('P23.14 §13 — one workspace-scoped Inspector target (F1/F2)', () => {
	it('resolves every workspace × selection combination to the workspace’s own authority', () => {
		for (const workspace of WORKSPACES) {
			for (const selectionDomain of SELECTIONS) {
				const domain = resolveInspectorDomain({ workspace, selectionDomain, staging: false });
				const label = `${workspace} + ${selectionDomain}`;
				if (selectionDomain === 'none') {
					expect(domain, label).toBe(workspace);
				} else if (selectionDomain === workspace) {
					expect(domain, label).toBe(selectionDomain);
				} else if (workspace === 'scene' && selectionDomain === 'layout') {
					// Scene is one workspace across Plan and 3D: its Layout
					// drafting target is exposed on both surfaces.
					expect(domain, label).toBe('layout');
				} else {
					// Remembered, not presented.
					expect(domain, label).toBe(workspace);
				}
			}
		}
	});

	it('keeps the camera editor out of Scene, the Scene editor out of Camera', () => {
		// F1 — a remembered Camera node while Scene 3D is on screen.
		expect(
			resolveInspectorDomain({ workspace: 'scene', selectionDomain: 'camera', staging: false })
		).toBe('scene');
		// F1, mirrored — a remembered Scene object while Camera 3D is on screen.
		expect(
			resolveInspectorDomain({ workspace: 'camera', selectionDomain: 'scene', staging: false })
		).toBe('camera');
		// F2 — nothing active in Scene, a Camera node still remembered: the
		// panel and its header both stay on the workspace's own target instead
		// of the header falling back to the remembered slot.
		expect(
			resolveInspectorDomain({ workspace: 'scene', selectionDomain: 'none', staging: false })
		).toBe('scene');
		// Camera Plan keeps the Camera Plan inspector.
		expect(
			resolveInspectorDomain({ workspace: 'camera', selectionDomain: 'camera', staging: false })
		).toBe('camera');
		// Arrange (staging) stays owner-aware in both directions.
		expect(
			resolveInspectorDomain({ workspace: 'scene', selectionDomain: 'layout', staging: true })
		).toBe('layout');
		expect(
			resolveInspectorDomain({ workspace: 'scene', selectionDomain: 'scene', staging: true })
		).toBe('scene');
	});

	it('exposes the remembered slots the workspace owns and no other', () => {
		expect(resolveInspectorExposure('scene')).toEqual({ layout: true, scene: true, camera: false });
		expect(resolveInspectorExposure('camera')).toEqual({
			layout: false,
			scene: false,
			camera: true
		});
	});

	it('the panel and its header read that one resolution', () => {
		const inspector = read('EditorInspector.svelte');
		expect(inspector).toContain('resolveInspectorDomain({');
		expect(inspector).toContain('resolveInspectorExposure(workspace)');
		// The body mounts the camera panel only for an EXPOSED navigation slot.
		expect(inspector).toContain('{:else if exposedNavigation}');
		expect(inspector).not.toContain('{:else if selectedNavigation}');
		// The header is scoped to the same resolved domain and the same exposed
		// slots, so it cannot describe an entity the body is not showing.
		expect(inspector).toContain('layoutDomain && selectedWallFirstWall');
		expect(inspector).toContain('const navigation = cameraDomain ? exposedNavigation : null');
		expect(inspector).toContain('const cluster = sceneDomain ? exposedCluster : null');
		expect(inspector).toContain('const placements = sceneDomain ? exposedPlacementIds : []');
		expect(inspector).toContain('const object = sceneDomain ? exposedObject : null');
		// The camera branches read the scoped local, never the raw slot.
		expect(inspector).toContain("if (navigation?.kind === 'connection')");
		expect(inspector).not.toContain("if (cameraDomain && exposedNavigation?.kind");
		// The frozen relic passes no viewState and keeps its legacy mount.
		expect(inspector).toContain('!scopedExposure ? selectedNavigation : null');
	});

	it('the resolver is pure — exposure changes, stored selection never does', () => {
		// Clearing or re-scoping stored selections on a domain switch would break
		// deterministic selection continuity (S3), so the rule may not touch them.
		const module = read('app/inspector-target.ts');
		expect(module).not.toContain('deselect');
		expect(module).not.toContain('store.');
		expect(module).toContain("import type { EditorWorkspace }");
	});
});
