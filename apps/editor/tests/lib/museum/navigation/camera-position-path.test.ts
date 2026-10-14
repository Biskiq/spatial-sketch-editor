/**
 * Camera position path construction and distance-span measurement.
 *
 * `createCameraPositionPath` builds the shared position path from route parts
 * (rounded polylines, automatic beziers); `compileCameraPositionPath` measures
 * requested distance spans against it. `createCameraMotion` reuses the same
 * builder, so the two must agree on geometry and length.
 */
import { describe, expect, it } from 'vitest';
import { CubicBezierCurve3, LineCurve3, Vector3 } from 'three';
import {
  compileCameraPositionPath,
  createCameraMotion,
  createCameraPositionPath,
  type CameraRoute
} from '@portfolio/camera-core';
import { expectVectorClose } from '../../../helpers/camera-motion-fixtures';

describe('createCameraPositionPath', () => {
  it('returns exact requested spans without changing rounded geometry or length', () => {
    const parts = [
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
    ] as const;
    const shared = createCameraPositionPath(parts);
    const compiled = compileCameraPositionPath(parts, [
      {
        start: { partIndex: 0, pointIndex: 0 },
        end: { partIndex: 0, pointIndex: 2 }
      },
      {
        start: { partIndex: 0, pointIndex: 2 },
        end: { partIndex: 0, pointIndex: 4 }
      }
    ]);

    expect(compiled.positionPath.curves).toHaveLength(shared.curves.length + 1);
    expect(compiled.totalDistance).toBe(shared.getLength());
    expect(compiled.spans[0].startDistance).toBe(0);
    expect(compiled.spans[0].endDistance).toBe(
      compiled.spans[1].startDistance
    );
    expect(compiled.spans[1].endDistance).toBe(compiled.totalDistance);
    expect(compiled.spans[0].length + compiled.spans[1].length).toBeCloseTo(
      compiled.totalDistance,
      12
    );

    for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expectVectorClose(
        compiled.positionPath.getPointAt(progress, new Vector3()),
        shared.getPointAt(progress, new Vector3()),
        12
      );
    }
  });

  it('measures zero-radius and duplicate rounded boundaries monotonically', () => {
    const compiled = compileCameraPositionPath(
      [
        {
          kind: 'rounded-polyline',
          points: [
            [0, 0, 0],
            [0, 0, 0],
            [1, 0, 1],
            [2, 0, 0]
          ],
          clearance: 0
        }
      ],
      [
        {
          start: { partIndex: 0, pointIndex: 0 },
          end: { partIndex: 0, pointIndex: 1 }
        },
        {
          start: { partIndex: 0, pointIndex: 1 },
          end: { partIndex: 0, pointIndex: 3 }
        }
      ]
    );

    expect(compiled.spans[0].length).toBe(0);
    expect(compiled.spans[0].endDistance).toBe(
      compiled.spans[1].startDistance
    );
    expect(compiled.spans[1].endDistance).toBe(compiled.totalDistance);
    expect(compiled.totalDistance).toBeCloseTo(2, 12);
  });

  it.each([
    [
      'an unknown part',
      {
        start: { partIndex: 1, pointIndex: 0 },
        end: { partIndex: 1, pointIndex: 1 }
      },
      'Camera position span[0] start references an unknown position part'
    ],
    [
      'an unknown point',
      {
        start: { partIndex: 0, pointIndex: 0 },
        end: { partIndex: 0, pointIndex: 2 }
      },
      'Camera position span[0] end references an unknown position point'
    ],
    [
      'a reversed range',
      {
        start: { partIndex: 0, pointIndex: 1 },
        end: { partIndex: 0, pointIndex: 0 }
      },
      'Camera position span[0] ends before it starts'
    ]
  ])('rejects %s in requested distance spans', (_label, span, message) => {
    expect(() =>
      compileCameraPositionPath(
        [
          {
            kind: 'rounded-polyline',
            points: [
              [0, 0, 0],
              [1, 0, 0]
            ]
          }
        ],
        [span]
      )
    ).toThrow(message);
  });

  it('builds a straight cubic for two distinct automatic anchors', () => {
    const path = createCameraPositionPath([
      {
        kind: 'auto-bezier',
        anchors: [
          [0, 0, 0],
          [6, 3, 0]
        ]
      }
    ]);
    const curve = path.curves[0] as CubicBezierCurve3;

    expect(curve).toBeInstanceOf(CubicBezierCurve3);
    expect(curve.v0.toArray()).toEqual([0, 0, 0]);
    expect(curve.v1.toArray()).toEqual([2, 1, 0]);
    expect(curve.v2.toArray()).toEqual([4, 2, 0]);
    expect(curve.v3.toArray()).toEqual([6, 3, 0]);
  });

  it('passes through uneven anchors with C1 tangent direction', () => {
    const anchors = [
      [0, 0, 0],
      [1, 0, 0],
      [5, 0, 4],
      [6, 0, 4]
    ] as const;
    const path = createCameraPositionPath([
      { kind: 'auto-bezier', anchors }
    ]);

    expect(path.curves).toHaveLength(3);
    for (let index = 0; index < anchors.length; index += 1) {
      const curveIndex = Math.min(index, path.curves.length - 1);
      const point = path.curves[curveIndex].getPoint(
        index === anchors.length - 1 ? 1 : 0,
        new Vector3()
      );
      expect(point.toArray()).toEqual(anchors[index]);
    }

    for (let index = 0; index < path.curves.length - 1; index += 1) {
      const before = path.curves[index] as CubicBezierCurve3;
      const after = path.curves[index + 1] as CubicBezierCurve3;
      const incoming = before.v3.clone().sub(before.v2).normalize();
      const outgoing = after.v1.clone().sub(after.v0).normalize();
      expectVectorClose(incoming, outgoing);

      const previousInterval = Math.sqrt(
        new Vector3(...anchors[index + 1]).distanceTo(
          new Vector3(...anchors[index])
        )
      );
      const nextInterval = Math.sqrt(
        new Vector3(...anchors[index + 2]).distanceTo(
          new Vector3(...anchors[index + 1])
        )
      );
      const incomingKnotDerivative = before.v3
        .clone()
        .sub(before.v2)
        .multiplyScalar(3 / previousInterval);
      const outgoingKnotDerivative = after.v1
        .clone()
        .sub(after.v0)
        .multiplyScalar(3 / nextInterval);
      expectVectorClose(incomingKnotDerivative, outgoingKnotDerivative);
    }
  });

  it('keeps duplicate segments degenerate and all generated values finite', () => {
    const path = createCameraPositionPath([
      {
        kind: 'auto-bezier',
        anchors: [
          [0, 0, 0],
          [0, 0, 0],
          [3, 0, 2],
          [3, 0, 2],
          [7, 1, 0]
        ]
      }
    ]);

    expect(path.curves).toHaveLength(4);
    expect(path.curves[0].getLength()).toBeCloseTo(0, 12);
    expect(path.curves[2].getLength()).toBeCloseTo(0, 12);
    for (const curve of path.curves as CubicBezierCurve3[]) {
      for (const control of [curve.v0, curve.v1, curve.v2, curve.v3]) {
        expect(control.toArray().every(Number.isFinite)).toBe(true);
      }
    }
    for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
      expect(
        path.getPointAt(progress, new Vector3()).toArray().every(Number.isFinite)
      ).toBe(true);
    }
  });

  it('samples reversed automatic anchors as the same geometry backward', () => {
    const anchors = [
      [0, 0, 0],
      [2, 1, 1],
      [7, -1, 3],
      [9, 0, 0]
    ] as const;
    const forward = createCameraPositionPath([
      { kind: 'auto-bezier', anchors }
    ]);
    const reverse = createCameraPositionPath([
      { kind: 'auto-bezier', anchors: [...anchors].reverse() }
    ]);

    for (const progress of [0, 0.1, 0.35, 0.5, 0.8, 1]) {
      expectVectorClose(
        forward.getPointAt(progress, new Vector3()),
        reverse.getPointAt(1 - progress, new Vector3()),
        7
      );
    }
  });

  it('combines contiguous mixed parts without smoothing across boundaries', () => {
    const path = createCameraPositionPath([
      {
        kind: 'rounded-polyline',
        points: [
          [0, 0, 0],
          [2, 0, 0]
        ],
        clearance: 0.2
      },
      {
        kind: 'auto-bezier',
        anchors: [
          [2, 0, 0],
          [3, 0, 1],
          [4, 0, 0]
        ]
      },
      {
        kind: 'rounded-polyline',
        points: [
          [4, 0, 0],
          [5, 0, 0]
        ],
        clearance: 0.4
      }
    ]);

    expect(path.curves).toHaveLength(4);
    expect(path.curves[0]).toBeInstanceOf(LineCurve3);
    expect(path.curves[1]).toBeInstanceOf(CubicBezierCurve3);
    expect(path.curves[2]).toBeInstanceOf(CubicBezierCurve3);
    expect(path.curves[3]).toBeInstanceOf(LineCurve3);
    expect(path.curves[0].getPoint(1, new Vector3()).toArray()).toEqual([2, 0, 0]);
    expect(path.curves[1].getPoint(0, new Vector3()).toArray()).toEqual([2, 0, 0]);
    expect(path.curves[2].getPoint(1, new Vector3()).toArray()).toEqual([4, 0, 0]);
    expect(path.curves[3].getPoint(0, new Vector3()).toArray()).toEqual([4, 0, 0]);
  });

  it('returns geometry identical to createCameraMotion', () => {
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
    const shared = createCameraPositionPath(route.positionParts);
    const motion = createCameraMotion(route);

    expect(shared.getLength()).toBe(motion.positionPath.getLength());
    for (const progress of [0, 0.2, 0.5, 0.85, 1]) {
      expectVectorClose(
        shared.getPointAt(progress, new Vector3()),
        motion.positionPath.getPointAt(progress, new Vector3())
      );
    }
  });
});
