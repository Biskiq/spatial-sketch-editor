import { describe, expect, it } from 'vitest';
import {
  CubicBezierCurve3,
  LineCurve3,
  QuadraticBezierCurve3,
  Vector3
} from 'three';
import {
  CAMERA_FRAMING_GUARD_POLICY,
  CAMERA_MOTION_PATH,
  CAMERA_MOTION_TIMING,
  VISITOR_CAMERA_PROJECTION,
  cameraMotionEdgeProgressAtProgress,
  cameraMotionProgressAtEdgeProgress,
  createCameraMotion,
  createCameraMotionSample,
  createCameraPositionPath,
  sampleCameraMotion,
  type CameraRoute
} from '@portfolio/camera-core';
import { sample, sampleFull, inverseSmootherstep, expectVectorClose } from '../../../helpers/camera-motion-fixtures';

describe('camera motion constants', () => {
  it('publishes visitor projection, timing, and path policies', () => {
    expect(VISITOR_CAMERA_PROJECTION).toEqual({ fov: 54, near: 0.1, far: 90 });
    expect(CAMERA_MOTION_TIMING).toEqual({
      unitsPerSecond: 6.2,
      minDurationSeconds: 1.25,
      maxDurationSeconds: 4.8
    });
    expect(CAMERA_MOTION_PATH).toEqual({
      positionCornerRadius: 0.42,
      targetCornerRadius: 0.65,
      cornerTrimRatio: 0.2,
      autoBezierAlpha: 0.5
    });
    expect(CAMERA_FRAMING_GUARD_POLICY).toEqual({
      minTargetStandoffMeters: VISITOR_CAMERA_PROJECTION.near,
      targetStandoffShoulderMeters: VISITOR_CAMERA_PROJECTION.near * 2,
      directionEpsilonMeters: 1e-6,
      maxAngularRateRadiansPerSecond: Math.PI * 1.5,
      angularInterpolationPeakRateFactor: 1.875,
      maxSampleAngularDeltaRadians: Math.PI / 36,
      maxTargetDistanceCurvatureMeters: VISITOR_CAMERA_PROJECTION.near / 2,
      baseSampleSegments: 24,
      maxAdaptiveDepth: 8,
      doubleWhipOffAxisRadians: Math.PI / 12,
      doubleWhipPathExcessRadians: Math.PI / 18,
      sphericalLerpLinearDotThreshold: 1 - 1e-6
    });
  });
});

describe('createCameraMotion', () => {
  it('clones its route and live start pose without mutating either input', () => {
    const route = {
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 1, 0],
            [10, 1, 0]
          ],
          clearance: 0.3
        }
      ],
      targetPoints: [
        [0, 1, 1],
        [10, 1, 1]
      ],
      edges: [
        {
          connectionId: 'straight',
          direction: 'forward',
          fromNodeId: 'a',
          toNodeId: 'b',
          positionSpan: {
            start: { partIndex: 0, pointIndex: 0 },
            end: { partIndex: 0, pointIndex: 1 }
          }
        }
      ]
    } as const satisfies CameraRoute;
    const startPose = {
      position: { x: -2, y: 3, z: 4 },
      target: { x: -1, y: 3, z: 4 },
      fov: 63
    } as const;
    const originalRoute = structuredClone(route);
    const originalStartPose = structuredClone(startPose);

    const motion = createCameraMotion(route, startPose);

    expect(route).toEqual(originalRoute);
    expect(startPose).toEqual(originalStartPose);
    expect(motion.positionEdgeSpans[0].positionSpan).not.toBe(
      route.edges[0].positionSpan
    );
    expect(motion.positionEdgeSpans[0]).toEqual(
      expect.objectContaining({
        connectionId: 'straight',
        direction: 'forward',
        startDistance: 0,
        endDistance: motion.positionPath.getLength(),
        length: motion.positionPath.getLength()
      })
    );
    expect(sample(motion, 0)).toEqual({
      position: [-2, 3, 4],
      target: [-1, 3, 4]
    });
    expect(sample(motion, 1)).toEqual({
      position: [10, 1, 0],
      target: [10, 1, 1]
    });
  });

  it('carries an isolated framing envelope into the prepared edge view', () => {
    const route = {
      positionParts: [{
        kind: 'rounded-polyline',
        points: [[0, 1, 0], [10, 1, 0]]
      }],
      targetPoints: [[0, 1, 1], [10, 1, 1]],
      edges: [{
        connectionId: 'straight',
        direction: 'forward',
        fromNodeId: 'a',
        toNodeId: 'b',
        positionSpan: {
          start: { partIndex: 0, pointIndex: 0 },
          end: { partIndex: 0, pointIndex: 1 }
        },
        viewTrack: {
          start: { cameraTarget: [0, 1, 1], fov: 54 },
          keyframes: [],
          end: { cameraTarget: [10, 1, 1], fov: 48 },
          framingEnvelope: {
            enterStart: 0.1,
            enterEnd: 0.25,
            exitStart: 0.8,
            exitEnd: 1
          }
        }
      }]
    } as const satisfies CameraRoute;

    const motion = createCameraMotion(route);
    expect(motion.edgeViews[0]?.framingEnvelope).toEqual(
      route.edges[0].viewTrack.framingEnvelope
    );
    expect(motion.edgeViews[0]?.framingEnvelope).not.toBe(
      route.edges[0].viewTrack.framingEnvelope
    );

    const { framingEnvelope: _envelope, ...viewTrackWithoutEnvelope } =
      route.edges[0].viewTrack;
    const legacyMotion = createCameraMotion({
      ...route,
      edges: [{ ...route.edges[0], viewTrack: viewTrackWithoutEnvelope }]
    });
    for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
      const withEnvelope = sampleFull(motion, progress);
      const withoutEnvelope = sampleFull(legacyMotion, progress);
      expect(withEnvelope.position.toArray()).toEqual(withoutEnvelope.position.toArray());
      expect(withEnvelope.target.toArray()).toEqual(withoutEnvelope.target.toArray());
      expect(withEnvelope.fov).toBe(withoutEnvelope.fov);
    }
  });

  it('applies a live position before automatic tangents are generated', () => {
    const route = {
      positionParts: [
        {
          kind: 'auto-bezier',
          anchors: [
            [0, 0, 0],
            [2, 0, 1],
            [4, 0, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 0, 1],
        [2, 0, 2],
        [4, 0, 1]
      ]
    } as const satisfies CameraRoute;
    const authoredPath = createCameraPositionPath(route.positionParts);
    const motion = createCameraMotion(route, {
      position: [-3, 1, 0],
      target: [-2, 1, 0],
      fov: 54
    });

    expect(sample(motion, 0).position).toEqual([-3, 1, 0]);
    expect(
      (motion.positionPath.curves[0] as CubicBezierCurve3).v1.equals(
        (authoredPath.curves[0] as CubicBezierCurve3).v1
      )
    ).toBe(false);
    expect(route.positionParts[0].anchors[0]).toEqual([0, 0, 0]);
  });

  it('keeps a live start continuous across a leading singleton mixed part', () => {
    const route = {
      positionParts: [
        { kind: 'rounded-polyline', points: [[0, 0, 0]] },
        {
          kind: 'auto-bezier',
          anchors: [
            [0, 0, 0],
            [5, 0, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 0, 1],
        [5, 0, 1]
      ]
    } as const satisfies CameraRoute;
    const motion = createCameraMotion(route, {
      position: [-2, 1, 0],
      target: [-1, 1, 0],
      fov: 54
    });

    expect(sample(motion, 0)).toEqual({
      position: [-2, 1, 0],
      target: [-1, 1, 0]
    });
    expect(sample(motion, 1)).toEqual({
      position: [5, 0, 0],
      target: [5, 0, 1]
    });
    expect(
      motion.positionPath.curves[0]
        .getPoint(1, new Vector3())
        .equals(motion.positionPath.curves[1].getPoint(0, new Vector3()))
    ).toBe(true);
  });

  it('ignores a start override for a singleton route and returns a zero-duration pose', () => {
    const motion = createCameraMotion(
      {
        positionParts: [
          { kind: 'rounded-polyline', points: [[2, 3, 4]] }
        ],
        targetPoints: [[5, 6, 7]]
      },
      {
        position: [20, 30, 40],
        target: [50, 60, 70],
        fov: 80
      }
    );

    expect(motion.durationSeconds).toBe(0);
    expect(sample(motion, 0)).toEqual({ position: [2, 3, 4], target: [5, 6, 7] });
    expect(sample(motion, 0.5)).toEqual({ position: [2, 3, 4], target: [5, 6, 7] });
    expect(sample(motion, 1)).toEqual({ position: [2, 3, 4], target: [5, 6, 7] });
  });

  it('does not inspect an ignored singleton start override', () => {
    const motion = createCameraMotion(
      {
        positionParts: [
          { kind: 'rounded-polyline', points: [[2, 3, 4]] }
        ],
        targetPoints: [[5, 6, 7]]
      },
      {
        position: [Number.NaN, 0, 0],
        target: [0, Number.POSITIVE_INFINITY, 0],
        fov: Number.NaN
      }
    );

    expect(motion.durationSeconds).toBe(0);
    expect(sample(motion, 1)).toEqual({ position: [2, 3, 4], target: [5, 6, 7] });
  });

  it('uses position distance with shared minimum, calculated, and maximum durations', () => {
    const motionForDistance = (distance: number) =>
      createCameraMotion({
        positionParts: [
          {
            kind: 'rounded-polyline',
            points: [
              [0, 0, 0],
              [distance, 0, 0]
            ]
          }
        ],
        targetPoints: [
          [0, 0, 1],
          [distance, 0, 1]
        ]
      }).durationSeconds;

    expect(motionForDistance(1)).toBe(CAMERA_MOTION_TIMING.minDurationSeconds);
    expect(motionForDistance(12.4)).toBeCloseTo(2);
    expect(motionForDistance(100)).toBe(CAMERA_MOTION_TIMING.maxDurationSeconds);
  });

  it('keeps a multi-pose zero-length position route at the minimum duration', () => {
    const motion = createCameraMotion({
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [1, 2, 3],
            [1, 2, 3]
          ]
        }
      ],
      targetPoints: [
        [1, 2, 4],
        [11, 2, 4]
      ]
    });

    expect(motion.durationSeconds).toBe(CAMERA_MOTION_TIMING.minDurationSeconds);
    expect(sample(motion, 0.25).position).toEqual([1, 2, 3]);
    expect(sample(motion, 0.25).target[0]).toBeCloseTo(2.03515625);
  });

  it('preserves frozen Phase 6 rounded-path samples and duration', () => {
    const motion = createCameraMotion({
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 1, 0],
            [1, 1, 0],
            [2, 1, 0],
            [3, 1, 1],
            [4, 1, 2]
          ],
          clearance: 0.2
        }
      ],
      targetPoints: [
        [0, 1, 1],
        [3, 1, 1],
        [4, 1, 2],
        [4, 1, 2],
        [4, 1, 3]
      ]
    });

    expect(motion.positionPath.getLength()).toBeCloseTo(4.808289638378762, 12);
    expect(motion.durationSeconds).toBe(1.25);
    expect(sample(motion, 0.25).position).toEqual([
      0.4977291008015312,
      1,
      0
    ]);
    expect(sample(motion, 0.5).position[0]).toBeCloseTo(2.30002657873801, 12);
    expect(sample(motion, 0.5).position[2]).toBeCloseTo(0.30002657873801, 12);
    expect(sample(motion, 0.75).position[0]).toBeCloseTo(3.6480523776293534, 12);
    expect(sample(motion, 0.75).position[2]).toBeCloseTo(1.6480523776293534, 12);
  });

  it('hits authored edge targets and FOV exactly at position-distance progress', () => {
    const route = {
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 0, 0],
            [10, 0, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 0, 1],
        [10, 0, 1]
      ],
      startFov: 50,
      endFov: 70,
      edges: [
        {
          connectionId: 'authored',
          direction: 'forward',
          fromNodeId: 'a',
          toNodeId: 'b',
          positionSpan: {
            start: { partIndex: 0, pointIndex: 0 },
            end: { partIndex: 0, pointIndex: 1 }
          },
          viewTrack: {
            start: { cameraTarget: [0, 0, 2], fov: 50 },
            keyframes: [
              {
                id: 'authored-view-forward-01',
                progress: 0.25,
                cameraTarget: [2.5, 2, 3],
                fov: 35
              },
              {
                id: 'authored-view-forward-02',
                progress: 0.75,
                cameraTarget: [7.5, -1, 4],
                fov: 90
              }
            ],
            end: { cameraTarget: [10, 0, 2], fov: 70 }
          },
          automaticTargetPoints: [
            [0, 0, 2],
            [10, 0, 2]
          ]
        }
      ]
    } as const satisfies CameraRoute;
    const original = structuredClone(route);
    const motion = createCameraMotion(route);

    const first = sampleFull(motion, inverseSmootherstep(0.25));
    expect(first.position.toArray()).toEqual([2.5, 0, 0]);
    expect(first.target.toArray()).toEqual([2.5, 2, 3]);
    expect(first.fov).toBe(35);

    const second = sampleFull(motion, inverseSmootherstep(0.75));
    expect(second.position.toArray()).toEqual([7.5, 0, 0]);
    expect(second.target.toArray()).toEqual([7.5, -1, 4]);
    expect(second.fov).toBe(90);
    expect(route).toEqual(original);
  });

  it('uses non-overshooting interval easing for authored targets and FOV', () => {
    const motion = createCameraMotion({
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 0, 0],
            [10, 0, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 0, 1],
        [10, 0, 1]
      ],
      edges: [
        {
          connectionId: 'authored',
          direction: 'forward',
          fromNodeId: 'a',
          toNodeId: 'b',
          positionSpan: {
            start: { partIndex: 0, pointIndex: 0 },
            end: { partIndex: 0, pointIndex: 1 }
          },
          viewTrack: {
            start: { cameraTarget: [0, 0, 2], fov: 20 },
            keyframes: [
              {
                id: 'peak',
                progress: 0.5,
                cameraTarget: [5, 4, 2],
                fov: 100
              }
            ],
            end: { cameraTarget: [10, 0, 2], fov: 40 }
          }
        }
      ]
    });

    for (const localProgress of [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]) {
      const output = sampleFull(motion, inverseSmootherstep(localProgress));
      expect(output.target.y).toBeGreaterThanOrEqual(0);
      expect(output.target.y).toBeLessThanOrEqual(4);
      expect(output.fov).toBeGreaterThanOrEqual(20);
      expect(output.fov).toBeLessThanOrEqual(100);
    }
  });

  it('keeps synthesized targets unchanged when only node FOV is authored', () => {
    const baseRoute = {
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 0, 0],
            [5, 0, 3],
            [10, 0, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 1, 1],
        [7, 2, 4],
        [10, 1, 1]
      ]
    } as const satisfies CameraRoute;
    const automatic = createCameraMotion(baseRoute);
    const fovOnly = createCameraMotion({
      ...baseRoute,
      startFov: 40,
      endFov: 80,
      edges: [
        {
          connectionId: 'fov-only',
          direction: 'forward',
          fromNodeId: 'a',
          toNodeId: 'b',
          positionSpan: {
            start: { partIndex: 0, pointIndex: 0 },
            end: { partIndex: 0, pointIndex: 2 }
          },
          viewTrack: {
            start: { cameraTarget: [0, 1, 1], fov: 40 },
            keyframes: [],
            end: { cameraTarget: [10, 1, 1], fov: 80 }
          },
          automaticTargetPoints: baseRoute.targetPoints
        }
      ]
    });

    for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
      const expected = sampleFull(automatic, progress);
      const actual = sampleFull(fovOnly, progress);
      expectVectorClose(actual.target, expected.target, 12);
    }
    expect(sampleFull(fovOnly, 0).fov).toBe(40);
    expect(sampleFull(fovOnly, 0.5).fov).toBe(60);
    expect(sampleFull(fovOnly, 1).fov).toBe(80);
  });

  it('keeps mixed automatic and authored edges continuous at their shared node', () => {
    const motion = createCameraMotion({
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 0, 0],
            [5, 0, 0],
            [10, 0, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 0, 1],
        [5, 0, 1],
        [10, 0, 1]
      ],
      startFov: 45,
      endFov: 65,
      edges: [
        {
          connectionId: 'first',
          direction: 'forward',
          fromNodeId: 'a',
          toNodeId: 'b',
          positionSpan: {
            start: { partIndex: 0, pointIndex: 0 },
            end: { partIndex: 0, pointIndex: 1 }
          },
          viewTrack: {
            start: { cameraTarget: [0, 0, 1], fov: 45 },
            keyframes: [
              {
                id: 'first-view-forward-01',
                progress: 0.5,
                cameraTarget: [2.5, 2, 2],
                fov: 35
              }
            ],
            end: { cameraTarget: [5, 0, 1], fov: 55 }
          }
        },
        {
          connectionId: 'second',
          direction: 'forward',
          fromNodeId: 'b',
          toNodeId: 'c',
          positionSpan: {
            start: { partIndex: 0, pointIndex: 1 },
            end: { partIndex: 0, pointIndex: 2 }
          },
          viewTrack: {
            start: { cameraTarget: [5, 0, 1], fov: 55 },
            keyframes: [],
            end: { cameraTarget: [10, 0, 1], fov: 65 }
          },
          automaticTargetPoints: [
            [5, 0, 1],
            [10, 0, 1]
          ]
        }
      ]
    });

    const boundary = sampleFull(motion, 0.5);
    expect(boundary.position.toArray()).toEqual([5, 0, 0]);
    expect(boundary.target.toArray()).toEqual([5, 0, 1]);
    expect(boundary.fov).toBe(55);

    const before = sampleFull(motion, 0.499);
    const after = sampleFull(motion, 0.501);
    expect(before.target.distanceTo(after.target)).toBeLessThan(0.025);
    expect(Math.abs(before.fov - after.fov)).toBeLessThan(0.025);
  });

  it('uses live target and FOV as the generated departure view', () => {
    const route = {
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 0, 0],
            [10, 0, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 0, 1],
        [10, 0, 1]
      ],
      startFov: 40,
      endFov: 60,
      edges: [
        {
          connectionId: 'live',
          direction: 'forward',
          fromNodeId: 'a',
          toNodeId: 'b',
          positionSpan: {
            start: { partIndex: 0, pointIndex: 0 },
            end: { partIndex: 0, pointIndex: 1 }
          },
          viewTrack: {
            start: { cameraTarget: [0, 0, 1], fov: 40 },
            keyframes: [
              {
                id: 'live-view-forward-01',
                progress: 0.5,
                cameraTarget: [5, 2, 2],
                fov: 50
              }
            ],
            end: { cameraTarget: [10, 0, 1], fov: 60 }
          }
        }
      ]
    } as const satisfies CameraRoute;
    const startPose = {
      position: [-2, 1, 0],
      target: [-1, 2, 3],
      fov: 77
    } as const;
    const originalRoute = structuredClone(route);
    const originalStartPose = structuredClone(startPose);
    const motion = createCameraMotion(route, startPose);

    const start = sampleFull(motion, 0);
    expect(start.position.toArray()).toEqual([-2, 1, 0]);
    expect(start.target.toArray()).toEqual([-1, 2, 3]);
    expect(start.fov).toBe(77);
    expect(sampleFull(motion, 1).fov).toBe(60);
    expect(route).toEqual(originalRoute);
    expect(startPose).toEqual(originalStartPose);
  });

  it('samples FOV for singleton and zero-distance authored motion', () => {
    const singleton = createCameraMotion({
      positionParts: [{ kind: 'rounded-polyline', points: [[1, 2, 3]] }],
      targetPoints: [[1, 2, 4]],
      startFov: 33,
      endFov: 33
    });
    expect(sampleFull(singleton, 0.5).fov).toBe(33);

    const targetOnly = createCameraMotion({
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [1, 2, 3],
            [1, 2, 3]
          ]
        }
      ],
      targetPoints: [
        [1, 2, 4],
        [2, 2, 4]
      ],
      startFov: 40,
      endFov: 70,
      edges: [
        {
          connectionId: 'target-only',
          direction: 'forward',
          fromNodeId: 'a',
          toNodeId: 'b',
          positionSpan: {
            start: { partIndex: 0, pointIndex: 0 },
            end: { partIndex: 0, pointIndex: 1 }
          },
          viewTrack: {
            start: { cameraTarget: [1, 2, 4], fov: 40 },
            keyframes: [
              {
                id: 'target-only-view-forward-01',
                progress: 0.5,
                cameraTarget: [1.5, 3, 4],
                fov: 55
              }
            ],
            end: { cameraTarget: [2, 2, 4], fov: 70 }
          }
        }
      ]
    });
    const midpoint = sampleFull(targetOnly, 0.5);
    expect(midpoint.position.toArray()).toEqual([1, 2, 3]);
    expect(midpoint.target.toArray()).toEqual([1.5, 3, 4]);
    expect(midpoint.fov).toBe(55);
  });

  it('precomputes rounded position and target paths using separate radii', () => {
    const route = {
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 0, 0],
            [5, 0, 0],
            [5, 0, 5]
          ]
        }
      ],
      targetPoints: [
        [0, 1, 0],
        [5, 1, 0],
        [5, 1, 5]
      ]
    } as const satisfies CameraRoute;
    const motion = createCameraMotion(route);
    const limitedMotion = createCameraMotion({
      ...route,
      positionParts: [{ ...route.positionParts[0], clearance: 0.25 }]
    });

    expect(motion.positionPath.curves).toHaveLength(3);
    expect(motion.positionPath.curves[0]).toBeInstanceOf(LineCurve3);
    expect(motion.positionPath.curves[1]).toBeInstanceOf(QuadraticBezierCurve3);
    expect(motion.positionPath.curves[0].getPoint(1, new Vector3()).toArray()).toEqual([
      4.58,
      0,
      0
    ]);
    expect(motion.targetPath.curves[0].getPoint(1, new Vector3()).toArray()).toEqual([
      4.35,
      1,
      0
    ]);
    expect(
      limitedMotion.positionPath.curves[0].getPoint(1, new Vector3()).toArray()
    ).toEqual([4.75, 0, 0]);
  });

  it.each([
    [
      'no position parts',
      { positionParts: [], targetPoints: [] },
      'Camera route must contain at least one position path part'
    ],
    [
      'an empty rounded part',
      {
        positionParts: [{ kind: 'rounded-polyline', points: [] }],
        targetPoints: []
      },
      'Camera route position part[0] must contain at least one point'
    ],
    [
      'an empty automatic part',
      {
        positionParts: [{ kind: 'auto-bezier', anchors: [] }],
        targetPoints: []
      },
      'Camera route position part[0] must contain at least one anchor'
    ],
    [
      'mismatched pose counts',
      {
        positionParts: [{ kind: 'rounded-polyline', points: [[0, 0, 0]] }],
        targetPoints: []
      },
      'Camera route ordered position points and target points must have the same length'
    ],
    [
      'a non-finite position',
      {
        positionParts: [
          { kind: 'rounded-polyline', points: [[0, Number.NaN, 0]] }
        ],
        targetPoints: [[0, 0, 0]]
      },
      'Camera route position part[0] point[0] must contain exactly three finite numbers'
    ],
    [
      'a non-finite target',
      {
        positionParts: [{ kind: 'rounded-polyline', points: [[0, 0, 0]] }],
        targetPoints: [[0, Number.POSITIVE_INFINITY, 0]]
      },
      'Camera route target[0] must contain exactly three finite numbers'
    ],
    [
      'negative clearance',
      {
        positionParts: [
          { kind: 'rounded-polyline', points: [[0, 0, 0]], clearance: -0.1 }
        ],
        targetPoints: [[0, 0, 0]]
      },
      'Camera route position part[0] clearance must be a finite non-negative number'
    ],
    [
      'non-finite clearance',
      {
        positionParts: [
          {
            kind: 'rounded-polyline',
            points: [[0, 0, 0]],
            clearance: Number.NaN
          }
        ],
        targetPoints: [[0, 0, 0]]
      },
      'Camera route position part[0] clearance must be a finite non-negative number'
    ],
    [
      'a non-contiguous join',
      {
        positionParts: [
          {
            kind: 'rounded-polyline',
            points: [
              [0, 0, 0],
              [1, 0, 0]
            ]
          },
          {
            kind: 'auto-bezier',
            anchors: [
              [2, 0, 0],
              [3, 0, 0]
            ]
          }
        ],
        targetPoints: [
          [0, 0, 1],
          [1, 0, 1],
          [3, 0, 1]
        ]
      },
      'Camera route position parts 0 and 1 must form a contiguous join'
    ]
  ])('rejects %s', (_label, route, message) => {
    expect(() => createCameraMotion(route as unknown as CameraRoute)).toThrow(message);
  });

  it('rejects invalid runtime view-track candidates', () => {
    const route = {
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 0, 0],
            [10, 0, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 0, 1],
        [10, 0, 1]
      ],
      edges: [
        {
          connectionId: 'invalid-view',
          direction: 'forward',
          fromNodeId: 'a',
          toNodeId: 'b',
          positionSpan: {
            start: { partIndex: 0, pointIndex: 0 },
            end: { partIndex: 0, pointIndex: 1 }
          },
          viewTrack: {
            start: { cameraTarget: [0, 0, 1], fov: 54 },
            keyframes: [
              {
                id: 'duplicate',
                progress: 0.3,
                cameraTarget: [3, 1, 1],
                fov: 54
              },
              {
                id: 'duplicate',
                progress: 0.6,
                cameraTarget: [6, 1, 1],
                fov: 54
              }
            ],
            end: { cameraTarget: [10, 0, 1], fov: 54 }
          }
        }
      ]
    } as const satisfies CameraRoute;

    expect(() => createCameraMotion(route)).toThrow(
      'Camera route edge[0] view keyframe[1] id must be unique within the edge track'
    );

    const coincident = JSON.parse(JSON.stringify(route)) as CameraRoute;
    coincident.edges![0]!.viewTrack!.keyframes[1]!.id = 'distinct';
    coincident.edges![0]!.viewTrack!.keyframes[1]!.progress = 0.5;
    coincident.edges![0]!.viewTrack!.keyframes[1]!.cameraTarget = [5, 0, 0];
    expect(() => createCameraMotion(coincident)).toThrow(
      'Camera route edge[0] view keyframe[1] target must be farther than 0.000001 from its sampled position'
    );

    const invalidFov = JSON.parse(JSON.stringify(route)) as CameraRoute;
    invalidFov.edges![0]!.viewTrack!.keyframes[1]!.id = 'distinct';
    invalidFov.edges![0]!.viewTrack!.keyframes[1]!.fov = 121;
    expect(() => createCameraMotion(invalidFov)).toThrow(
      'Camera route edge[0] view keyframe[1] fov must be a finite number between 10 and 120'
    );
  });

  it('rejects invalid multi-pose live projection and coincident live view', () => {
    const route = {
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 0, 0],
            [10, 0, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 0, 1],
        [10, 0, 1]
      ]
    } as const satisfies CameraRoute;

    expect(() =>
      createCameraMotion(route, {
        position: [1, 2, 3],
        target: [1, 2, 4],
        fov: 121
      })
    ).toThrow('Camera start fov must be a finite number between 10 and 120');
    expect(() =>
      createCameraMotion(route, {
        position: [1, 2, 3],
        target: [1, 2, 3],
        fov: 54
      })
    ).toThrow(
      'Camera start target must be farther than 0.000001 from its position'
    );
  });
});

describe('cameraMotionProgressAtEdgeProgress', () => {
  it('maps exact edge distance back through transition smootherstep', () => {
    const motion = createCameraMotion({
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 0, 0],
            [10, 0, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 0, 1],
        [10, 0, 1]
      ],
      edges: [
        {
          connectionId: 'edge',
          direction: 'forward',
          fromNodeId: 'a',
          toNodeId: 'b',
          positionSpan: {
            start: { partIndex: 0, pointIndex: 0 },
            end: { partIndex: 0, pointIndex: 1 }
          }
        }
      ]
    });

    const progress = cameraMotionProgressAtEdgeProgress(motion, 0, 0.25);
    expect(progress).toBeCloseTo(inverseSmootherstep(0.25), 10);
    const sample = sampleFull(motion, progress);
    expect(sample.position.x).toBeCloseTo(2.5, 8);
    expect(cameraMotionProgressAtEdgeProgress(motion, 0, 0)).toBe(0);
    expect(cameraMotionProgressAtEdgeProgress(motion, 0, 1)).toBe(1);

    expect(
      cameraMotionEdgeProgressAtProgress(motion, 0, progress)
    ).toBeCloseTo(0.25, 10);
    expect(cameraMotionEdgeProgressAtProgress(motion, 0, 0)).toBe(0);
    expect(cameraMotionEdgeProgressAtProgress(motion, 0, 1)).toBe(1);
    expect(() => cameraMotionEdgeProgressAtProgress(motion, 1, 0.5)).toThrow(
      'Camera motion edge index is out of range'
    );
  });
});


describe('sampleCameraMotion', () => {
  const motion = createCameraMotion({
    positionParts: [
      {
        kind: 'rounded-polyline',
        points: [
          [0, 0, 0],
          [10, 0, 0]
        ]
      }
    ],
    targetPoints: [
      [0, 0, 1],
      [10, 0, 1]
    ]
  });

  it('clamps progress and writes into supplied output vectors', () => {
    const output = createCameraMotionSample();
    output.position.set(100, 100, 100);
    output.target.set(200, 200, 200);

    expect(sampleCameraMotion(motion, -1, output)).toBeUndefined();
    expect(output.position.toArray()).toEqual([0, 0, 0]);
    expect(output.target.toArray()).toEqual([0, 0, 1]);
    expect(output.fov).toBe(54);

    sampleCameraMotion(motion, 2, output);
    expect(output.position.toArray()).toEqual([10, 0, 0]);
    expect(output.target.toArray()).toEqual([10, 0, 1]);
    expect(output.fov).toBe(54);
  });

  it('applies smootherstep before sampling precomputed paths', () => {
    const result = sample(motion, 0.25);

    expect(result.position[0]).toBeCloseTo(1.03515625);
    expect(result.target[0]).toBeCloseTo(1.03515625);
  });

  it('rejects non-finite progress', () => {
    expect(() =>
      sampleCameraMotion(motion, Number.NaN, createCameraMotionSample())
    ).toThrow('Camera motion progress must be finite');
  });
});

