/**
 * P1.6 framing guard-status accessor (F3).
 *
 * `readCameraFramingGuardStatus` reports the compiled guard flags for one edge
 * without sampling or mutating motion output. Part of the former
 * `camera-motion.test.ts`; the motion core stays there.
 */
import { describe, expect, it } from 'vitest';
import {
  createCameraMotion,
  createCameraMotionSample,
  readCameraFramingGuardStatus,
  sampleCameraMotion,
  type CameraFramingGuardStatus,
  type CameraRoute
} from '@portfolio/camera-core';

describe('P1.6 framing guard-status accessor (F3)', () => {
  function guardRoute(options: {
    viewTrack: NonNullable<CameraRoute['edges']>[number]['viewTrack'];
    automaticTargetPoints: [number, number, number][];
    positionPoints?: [number, number, number][];
    targetPoints?: [number, number, number][];
  }): CameraRoute {
    const positionPoints = options.positionPoints ?? [[0, 0, 0], [10, 0, 0]];
    const targetPoints = options.targetPoints ?? [[0, 0, 2], [10, 0, 2]];
    return {
      positionParts: [{ kind: 'rounded-polyline', points: positionPoints }],
      targetPoints,
      startFov: 54,
      endFov: 54,
      edges: [{
        connectionId: 'guarded',
        direction: 'forward',
        fromNodeId: 'a',
        toNodeId: 'b',
        positionSpan: {
          start: { partIndex: 0, pointIndex: 0 },
          end: { partIndex: 0, pointIndex: positionPoints.length - 1 }
        },
        viewTrack: options.viewTrack,
        automaticTargetPoints: options.automaticTargetPoints
      }]
    };
  }

  const angularLimitRoute = () => guardRoute({
    positionPoints: [[0, 0, 0], [5, 0, 0], [10, 0, 0]],
    targetPoints: [[5, 0, 0], [5, 0, 0], [5, 0, 0]],
    automaticTargetPoints: [[5, 0, 0], [5, 0, 0]],
    viewTrack: {
      start: { cameraTarget: [5, 0, 0], fov: 54 },
      keyframes: [{
        id: 'ahead-of-eye',
        progress: 0.5,
        cameraTarget: [5, 0, 1],
        fov: 54
      }],
      end: { cameraTarget: [5, 0, 0], fov: 54 },
      framingEnvelope: {
        enterStart: 0.3,
        enterEnd: 0.4,
        exitStart: 0.5,
        exitEnd: 0.6
      }
    }
  });

  const bypassRoute = () => guardRoute({
    automaticTargetPoints: [[0, 0, 5], [30, 0, -5], [10, 0, 5]],
    viewTrack: {
      start: { cameraTarget: [0, 0, 5], fov: 54 },
      keyframes: [{
        id: 'hold-subject',
        progress: 0.8,
        cameraTarget: [8, 0, 5],
        fov: 54
      }],
      end: { cameraTarget: [10, 0, 5], fov: 54 },
      framingEnvelope: {
        enterStart: 0,
        enterEnd: 0,
        exitStart: 0.8,
        exitEnd: 0.9
      }
    }
  });

  const standoffRoute = () => guardRoute({
    targetPoints: [[0.15, 0, 0], [10.15, 0, 0]],
    automaticTargetPoints: [[0.15, 0, 0], [10.15, 0, 0]],
    viewTrack: {
      start: { cameraTarget: [0.15, 0, 0], fov: 54 },
      keyframes: [{
        id: 'track-ahead',
        progress: 0.5,
        cameraTarget: [5.15, 0, 0],
        fov: 54
      }],
      end: { cameraTarget: [10.15, 0, 0], fov: 54 },
      framingEnvelope: {
        enterStart: 0,
        enterEnd: 0,
        exitStart: 1,
        exitEnd: 1
      }
    }
  });

  // Targets hug the camera path (standoff danger) in the automatic region
  // while the authored key swings the camera off-axis (angular-rate limit).
  // Both flags must be reported simultaneously — the case a synthetic
  // standoff heuristic could not distinguish.
  const standoffWithAngularLimitRoute = () => guardRoute({
    positionPoints: [[0, 0, 0], [5, 0, 0], [10, 0, 0]],
    targetPoints: [[0.15, 0, 0], [5.15, 0, 0], [10.15, 0, 0]],
    automaticTargetPoints: [[0.15, 0, 0], [10.15, 0, 0]],
    viewTrack: {
      start: { cameraTarget: [0.15, 0, 0], fov: 54 },
      keyframes: [{
        id: 'swing-off-path',
        progress: 0.5,
        cameraTarget: [5, 0, 1],
        fov: 54
      }],
      end: { cameraTarget: [10.15, 0, 0], fov: 54 },
      framingEnvelope: {
        enterStart: 0.3,
        enterEnd: 0.4,
        exitStart: 0.5,
        exitEnd: 0.6
      }
    }
  });

  it('exposes angular-limit, bypass, and standoff status from the compiled guard', () => {
    const angular = createCameraMotion(angularLimitRoute(), undefined, {
      durationSeconds: 1.5,
      easing: 'linear'
    });
    expect(readCameraFramingGuardStatus(angular, 0)).toEqual({
      limitsAngularRate: true,
      hasBypass: false,
      hasStandoff: false
    } satisfies CameraFramingGuardStatus);

    const bypass = createCameraMotion(bypassRoute(), undefined, {
      durationSeconds: 0.5,
      easing: 'linear'
    });
    expect(bypass.edgeViews[0]?.guard?.bypass).not.toBeNull();
    expect(readCameraFramingGuardStatus(bypass, 0)).toEqual({
      limitsAngularRate: bypass.edgeViews[0]!.guard!.limitsAngularRate,
      hasBypass: true,
      hasStandoff: false
    } satisfies CameraFramingGuardStatus);

    const standoff = createCameraMotion(standoffRoute(), undefined, {
      durationSeconds: 10,
      easing: 'linear'
    });
    const standoffGuard = standoff.edgeViews[0]?.guard;
    expect(standoffGuard).not.toBeNull();
    expect(standoffGuard?.limitsAngularRate).toBe(false);
    expect(standoffGuard?.bypass).toBeNull();
    expect(readCameraFramingGuardStatus(standoff, 0)).toEqual({
      limitsAngularRate: false,
      hasBypass: false,
      hasStandoff: true
    } satisfies CameraFramingGuardStatus);
  });

  it('reports standoff accurately when it coexists with angular-rate limiting', () => {
    const motion = createCameraMotion(standoffWithAngularLimitRoute(), undefined, {
      durationSeconds: 1.5,
      easing: 'linear'
    });
    const guard = motion.edgeViews[0]?.guard;
    expect(guard).not.toBeNull();
    expect(guard?.hasStandoffDanger).toBe(true);
    expect(guard?.limitsAngularRate).toBe(true);
    expect(readCameraFramingGuardStatus(motion, 0)).toEqual({
      limitsAngularRate: true,
      hasBypass: false,
      hasStandoff: true
    } satisfies CameraFramingGuardStatus);
  });

  it('returns null for an unguarded or out-of-range edge', () => {
    const motion = createCameraMotion(guardRoute({
      automaticTargetPoints: [[0, 0, 2], [10, 0, 2]],
      viewTrack: {
        start: { cameraTarget: [0, 0, 2], fov: 40 },
        keyframes: [],
        end: { cameraTarget: [10, 0, 2], fov: 60 },
        framingEnvelope: {
          enterStart: 0.2,
          enterEnd: 0.4,
          exitStart: 0.8,
          exitEnd: 1
        }
      }
    }), undefined, { durationSeconds: 10, easing: 'linear' });
    expect(readCameraFramingGuardStatus(motion, 0)).toBeNull();
    expect(readCameraFramingGuardStatus(motion, -1)).toBeNull();
    expect(readCameraFramingGuardStatus(motion, 1)).toBeNull();
    expect(readCameraFramingGuardStatus(motion, 1.5)).toBeNull();
  });

  it('reading guard status leaves sampled motion output byte-identical', () => {
    const motion = createCameraMotion(angularLimitRoute(), undefined, {
      durationSeconds: 1.5,
      easing: 'linear'
    });
    const output = createCameraMotionSample();
    sampleCameraMotion(motion, 0.45, output);
    const before = {
      position: output.position.toArray(),
      target: output.target.toArray(),
      fov: output.fov
    };
    readCameraFramingGuardStatus(motion, 0);
    sampleCameraMotion(motion, 0.45, output);
    const after = {
      position: output.position.toArray(),
      target: output.target.toArray(),
      fov: output.fov
    };
    expect(after).toEqual(before);
  });
});
