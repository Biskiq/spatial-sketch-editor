import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_EASING,
  CAMERA_FOV,
  createCameraMotionSample,
  getNode,
  type CameraGraph,
  type CameraGraphNode
} from '@portfolio/camera-core';

const appSrc = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src');
const packageSrc = resolve(appSrc, '../../../packages/camera-core/src');
/**
 * The product's visitor-facing layer after PR #115: the cold visitor runtime and
 * the shared renderer it mounts. The separate `apps/museum` fork this used to
 * walk was retired with the frozen project (§3.5).
 */
const visitorSrcRoots = [resolve(appSrc, 'lib/visitor'), resolve(appSrc, 'lib/museum')];

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const file = pending.pop()!;
    const stat = statSync(file);
    if (stat.isDirectory()) {
      for (const child of readdirSync(file)) {
        if (!child.startsWith('.')) pending.push(resolve(file, child));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.svelte')) {
      files.push(file);
    }
  }
  return files;
}

/**
 * T3b — one navigation system.
 *
 * The motion side was already pinned (headless package, TransformControls-free).
 * What no test owned was the *evaluator* half: that route/flow evaluation is
 * defined exactly once, under `packages/camera-core`. A second copy (the classic
 * "re-derived adjacency" drift) fails here.
 *
 * PR #115 removed the editor half of this ownership check: the second half
 * asserted that `lib/editor/editor-navigation-graph.ts` was the single owner of
 * flow/ordering semantics, and that module is gone with the editor shell (§5.1).
 * Editorial order is now a T3 obligation (`t3-experience` planning evidence), so
 * there is no in-repo owner left to pin — the kernel half below is unchanged.
 */
describe('one navigation system — single route evaluator', () => {
  const repoRoot = resolve(appSrc, '../../..');

  function packageExportingOwners(symbol: string): string[] {
    return sourceFiles(packageSrc)
      .filter((file) =>
        new RegExp(`export\\s+(?:async\\s+)?function\\s+${symbol}\\b`).test(readFileSync(file, 'utf8'))
      )
      .map((file) => relative(repoRoot, file));
  }

  it('defines each route/flow evaluator exactly once, under camera-core', () => {
    for (const symbol of [
      'getCameraRoute',
      'getCameraConnectionRoute',
      'resolveFlowRoute',
      'getFlowRoute',
      'getFlowLoopConnectionId'
    ]) {
      expect(packageExportingOwners(symbol), symbol).toEqual([
        'packages/camera-core/src/camera-route.ts'
      ]);
    }
  });
});

describe('camera-core package boundary', () => {
  it('exposes the camera API directly without an app shim', () => {
    const node: CameraGraphNode = {
      id: 'node',
      roomId: 'room',
      label: 'Node',
      position: [0, 1, 0],
      cameraTarget: [0, 1, 1],
      fov: CAMERA_FOV.default,
      connectedNodeIds: []
    };
    const graph: CameraGraph = {
      navigationNodes: [node],
      connections: [],
      nodeById: new Map([[node.id, node]])
    };

    expect(CAMERA_EASING).toContain('smootherstep');
    expect(createCameraMotionSample().fov).toBe(CAMERA_FOV.default);
    expect(getNode(node.id, graph)).toBe(node);
  });

  it('keeps package sources headless and independent from app/editor code', () => {
    const files = ['index.ts', 'camera-motion.ts', 'camera-route.ts', 'navigation.ts', 'scene-types.ts'];
    for (const file of files) {
      expect(existsSync(resolve(packageSrc, file))).toBe(true);
      const source = readFileSync(resolve(packageSrc, file), 'utf8');
      expect(source, file).not.toMatch(
        /(?:from|import\()\s*['"][^'"]*(?:\$lib|chopin-project|@threlte|svelte)(?:\/|['"])/
      );
      expect(source, file).not.toMatch(
        /(?:from|import\()\s*['"]@portfolio\/project-model(?:\/|['"])/
      );
      expect(source, file).not.toMatch(
        /(?:from|import\()\s*['"](?:three\/(?:addons|examples)|@threlte|svelte)/
      );
    }
  });

  it('keeps the visitor and shared renderer source free of editor imports', () => {
    for (const root of visitorSrcRoots) {
      for (const file of sourceFiles(root)) {
        const source = readFileSync(file, 'utf8');
        expect(source, file).not.toMatch(
          /(?:from|import\()\s*['"][^'"]*(?:\$lib\/editor|(?:\.\.?\/)\.?editor\/)/
        );
      }
    }
  });
});
