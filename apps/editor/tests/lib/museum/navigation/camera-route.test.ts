import { describe, expect, it } from 'vitest';
import {
  createNavigationGraph,
  type RuntimeScene
} from '$lib/content/scene';
import type {
  RuntimeConnection,
  NavigationNodeData,
  Vec3
} from '$lib/types/scene';
import {
  CAMERA_MOTION_TIMING,
  createCameraMotion,
  createCameraMotionSample,
  sampleCameraMotion
} from '@portfolio/camera-core';
import {
  getCameraConnectionRoute,
  getCameraRoute,
} from '@portfolio/camera-core';

// PR #115 (§7.2 A′ / §3.7): the fixture-graph cases in this file drove
// `loadFixtureScene()`'s legacy room-local resolution through Chopin Room
// frames, which are isolated for the external frozen project. Their expectations
// are frame-transformed absolute positions (for example the multi-hop goldens)
// or Chopin-runtime identities, so they could not be re-pointed at a kernel
// fixture without changing what they assert: they are frozen-product cases and
// moved with the frozen project. Every camera-core case below builds its own
// nodes/connections, so it is frame-independent and stays.

const nodes: NavigationNodeData[] = [
  {
    id: 'a',
    roomId: 'entrance',
    label: 'A',
    position: [0, 1, 0],
    cameraTarget: [0, 1, 1],
    fov: 54,
    connectedNodeIds: ['b']
  },
  {
    id: 'b',
    roomId: 'poland',
    label: 'B',
    position: [2, 1, 0],
    cameraTarget: [2, 1, 1],
    fov: 54,
    connectedNodeIds: ['a', 'c']
  },
  {
    id: 'c',
    roomId: 'departure',
    label: 'C',
    position: [4, 1, 2],
    cameraTarget: [4, 1, 3],
    fov: 54,
    connectedNodeIds: ['b']
  },
  {
    id: 'isolated',
    roomId: 'legacy',
    label: 'Isolated',
    position: [9, 1, 9],
    cameraTarget: [8, 1, 9],
    fov: 54,
    connectedNodeIds: []
  }
];

function runtimeAnchors(connectionId: string, positions: readonly Vec3[]) {
  return positions.map((position, index) => ({
    id: `${connectionId}-${index}`,
    position: [...position] as Vec3
  }));
}

const connections: RuntimeConnection[] = [
  {
    id: 'a-b',
    fromNodeId: 'a',
    toNodeId: 'b',
    clearance: 0.4,
    positionPath: {
      kind: 'rounded-polyline',
      anchors: runtimeAnchors('a-b', [
        [0, 1, 0],
        [1, 1, 0],
        [2, 1, 0]
      ])
    }
  },
  {
    id: 'b-c',
    fromNodeId: 'b',
    toNodeId: 'c',
    clearance: 0.2,
    positionPath: {
      kind: 'rounded-polyline',
      anchors: runtimeAnchors('b-c', [
        [2, 1, 0],
        [3, 1, 1],
        [4, 1, 2]
      ])
    }
  }
];

const customScene: RuntimeScene = {
  textures: [],
  materials: [],
  entities: [],
  objects: [],
  navigationNodes: nodes,
  connections
};
const customGraph = createNavigationGraph(customScene);

// `FIXTURE_EDGE_MIDPOINTS` and `FIXTURE_MULTI_HOP` held frame-transformed
// absolute-position goldens for the Chopin fixture graph. They moved with the
// frozen project (§7.2 A′); re-deriving them against a different fixture would
// change what they assert, which the plan forbids.

function sampleRoute(route: ReturnType<typeof getCameraRoute>, progress: number) {
  const motion = createCameraMotion(route);
  const output = createCameraMotionSample();
  sampleCameraMotion(motion, progress, output);
  return {
    motion,
    position: output.position.toArray(),
    target: output.target.toArray(),
    fov: output.fov
  };
}

function expectTupleClose(actual: number[], expected: Vec3, precision = 10) {
  for (let index = 0; index < 3; index += 1) {
    expect(actual[index]).toBeCloseTo(expected[index], precision);
  }
}

function expectedRouteEdge(
  connectionId: string,
  direction: 'forward' | 'reverse',
  fromNodeId: string,
  toNodeId: string,
  partIndex: number,
  startPointIndex: number,
  endPointIndex: number
) {
  return expect.objectContaining({
    connectionId,
    direction,
    fromNodeId,
    toNodeId,
    positionSpan: {
      start: { partIndex, pointIndex: startPointIndex },
      end: { partIndex, pointIndex: endPointIndex }
    }
  });
}

describe('getCameraRoute', () => {
  it('coalesces a forward multi-edge legacy run with Phase 6 duplicate policy', () => {
    expect(getCameraRoute('a', 'c', customGraph)).toEqual({
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
      ],
      startFov: 54,
      endFov: 54,
      nodeIds: ['a', 'b', 'c'],
      edges: [
        expectedRouteEdge('a-b', 'forward', 'a', 'b', 0, 0, 2),
        expectedRouteEdge('b-c', 'forward', 'b', 'c', 0, 2, 4)
      ]
    });
  });

  it('compiles exact forward and reverse spans through a coalesced rounded join', () => {
    const forward = createCameraMotion(getCameraRoute('a', 'c', customGraph));
    const reverse = createCameraMotion(getCameraRoute('c', 'a', customGraph));
    const forwardSpans = forward.positionEdgeSpans;
    const reverseSpans = reverse.positionEdgeSpans;

    expect(forwardSpans.map((span) => span.connectionId)).toEqual(['a-b', 'b-c']);
    expect(forwardSpans.map((span) => span.direction)).toEqual([
      'forward',
      'forward'
    ]);
    expect(forwardSpans[0].startDistance).toBe(0);
    expect(forwardSpans[0].endDistance).toBe(forwardSpans[1].startDistance);
    expect(forwardSpans[1].endDistance).toBe(forward.positionPath.getLength());
    expect(forwardSpans[0].length + forwardSpans[1].length).toBeCloseTo(
      forward.positionPath.getLength(),
      12
    );

    // Point index 2 is the shared node. Its rounded quadratic is split into
    // two geometry-identical halves, and the edge boundary lands between them.
    expect(forward.positionPath.curves).toHaveLength(8);
    const splitBoundaryDistance = forward.positionPath.curves
      .slice(0, 4)
      .reduce((distance, curve) => distance + curve.getLength(), 0);
    expect(forwardSpans[0].endDistance).toBeCloseTo(splitBoundaryDistance, 12);

    expect(reverseSpans.map((span) => span.connectionId)).toEqual(['b-c', 'a-b']);
    expect(reverseSpans.map((span) => span.direction)).toEqual([
      'reverse',
      'reverse'
    ]);
    expect(reverseSpans[0].length).toBeCloseTo(forwardSpans[1].length, 12);
    expect(reverseSpans[1].length).toBeCloseTo(forwardSpans[0].length, 12);
    expect(reverseSpans[1].endDistance).toBe(reverse.positionPath.getLength());
  });

  it('reverses legacy edge points during reverse traversal', () => {
    const route = getCameraRoute('c', 'a', customGraph);

    expect(route.positionParts).toEqual([
      {
        kind: 'rounded-polyline',
        points: [
          [4, 1, 2],
          [3, 1, 1],
          [2, 1, 0],
          [1, 1, 0],
          [0, 1, 0]
        ],
        clearance: 0.2
      }
    ]);
    expect(route.nodeIds).toEqual(['c', 'b', 'a']);
    expect(route.targetPoints[0]).toEqual(nodes[2].cameraTarget);
    expect(route.targetPoints.at(-1)).toEqual(nodes[0].cameraTarget);
  });

  it('returns a cloned resting pose for a same-node route', () => {
    const route = getCameraRoute('b', 'b', customGraph);

    expect(route).toEqual({
      positionParts: [
        {
          kind: 'rounded-polyline',
          points: [[2, 1, 0]],
          clearance: 0.35
        }
      ],
      targetPoints: [[2, 1, 1]],
      startFov: 54,
      endFov: 54,
      nodeIds: ['b'],
      edges: []
    });
    const part = route.positionParts[0];
    expect(part.kind).toBe('rounded-polyline');
    if (part.kind !== 'rounded-polyline') throw new Error('Expected rounded part');
    expect(part.points[0]).not.toBe(nodes[1].position);
    expect(route.targetPoints[0]).not.toBe(nodes[1].cameraTarget);
  });

  it('preserves two poses for a target-only connection between coincident eyes', () => {
    const coincidentNodes: NavigationNodeData[] = [
      {
        ...nodes[0],
        position: [3, 1, 3],
        cameraTarget: [3, 1, 4]
      },
      {
        ...nodes[1],
        position: [3, 1, 3],
        cameraTarget: [4, 1, 3]
      }
    ];
    const graph = createNavigationGraph({
      entities: [],
  objects: [],
      navigationNodes: coincidentNodes,
      connections: [
        {
          id: 'coincident',
          fromNodeId: 'a',
          toNodeId: 'b',
          clearance: 0.3,
          positionPath: {
            kind: 'rounded-polyline',
            anchors: runtimeAnchors('coincident', [
              [3, 1, 3],
              [3, 1, 3]
            ])
          }
        }
      ]
    });

    const route = getCameraRoute('a', 'b', graph);
    expect(route.positionParts).toEqual([
      {
        kind: 'rounded-polyline',
        points: [
          [3, 1, 3],
          [3, 1, 3]
        ],
        clearance: 0.3
      }
    ]);
    expect(route.targetPoints).toEqual([
      [3, 1, 4],
      [4, 1, 3]
    ]);

    const motion = createCameraMotion(route);
    const output = createCameraMotionSample();
    expect(motion.durationSeconds).toBe(CAMERA_MOTION_TIMING.minDurationSeconds);
    sampleCameraMotion(motion, 1, output);
    expect(output.position.toArray()).toEqual([3, 1, 3]);
    expect(output.target.toArray()).toEqual([4, 1, 3]);
  });

  it('retains mixed path boundaries and reverses every kind', () => {
    const mixedNodes: NavigationNodeData[] = [
      ...nodes.slice(0, 3),
      {
        id: 'd',
        roomId: 'paris',
        label: 'D',
        position: [7, 1, 2],
        cameraTarget: [7, 1, 3],
        fov: 54,
        connectedNodeIds: ['c']
      }
    ];
    const mixedConnections: RuntimeConnection[] = [
      connections[0],
      {
        ...connections[1],
        positionPath: {
          kind: 'auto-bezier',
          anchors: runtimeAnchors('b-c-auto', [
            [2, 1, 0],
            [3, 1.2, 2],
            [4, 1, 2]
          ])
        }
      },
      {
        id: 'c-d',
        fromNodeId: 'c',
        toNodeId: 'd',
        clearance: 0.1,
        positionPath: {
          kind: 'rounded-polyline',
          anchors: runtimeAnchors('c-d', [
            [4, 1, 2],
            [6, 1, 2],
            [7, 1, 2]
          ])
        }
      }
    ];
    const graph = createNavigationGraph({
      entities: [],
  objects: [],
      navigationNodes: mixedNodes,
      connections: mixedConnections
    });

    const forward = getCameraRoute('a', 'd', graph);
    expect(forward.positionParts).toEqual([
      {
        kind: 'rounded-polyline',
        points: [
          [0, 1, 0],
          [1, 1, 0],
          [2, 1, 0]
        ],
        clearance: 0.4
      },
      {
        kind: 'auto-bezier',
        anchors: [
          [2, 1, 0],
          [3, 1.2, 2],
          [4, 1, 2]
        ]
      },
      {
        kind: 'rounded-polyline',
        points: [
          [4, 1, 2],
          [6, 1, 2],
          [7, 1, 2]
        ],
        clearance: 0.1
      }
    ]);
    expect(forward.targetPoints).toEqual([
      [0, 1, 1],
      [3, 1, 2],
      [4, 1, 2],
      [6, 1.2, 2],
      [7, 1, 2],
      [7, 1, 2],
      [7, 1, 3]
    ]);
    expect(forward.nodeIds).toEqual(['a', 'b', 'c', 'd']);
    expect(forward.edges).toEqual([
      expectedRouteEdge('a-b', 'forward', 'a', 'b', 0, 0, 2),
      expectedRouteEdge('b-c', 'forward', 'b', 'c', 1, 0, 2),
      expectedRouteEdge('c-d', 'forward', 'c', 'd', 2, 0, 2)
    ]);
    const forwardMotion = createCameraMotion(forward);
    expect(forwardMotion.positionEdgeSpans[0].startDistance).toBe(0);
    expect(forwardMotion.positionEdgeSpans[0].endDistance).toBe(
      forwardMotion.positionEdgeSpans[1].startDistance
    );
    expect(forwardMotion.positionEdgeSpans[1].endDistance).toBe(
      forwardMotion.positionEdgeSpans[2].startDistance
    );
    expect(forwardMotion.positionEdgeSpans[2].endDistance).toBe(
      forwardMotion.positionPath.getLength()
    );

    const reverse = getCameraRoute('d', 'a', graph);
    expect(reverse.positionParts.map((part) => part.kind)).toEqual([
      'rounded-polyline',
      'auto-bezier',
      'rounded-polyline'
    ]);
    expect(reverse.positionParts[0]).toEqual({
      kind: 'rounded-polyline',
      points: [
        [7, 1, 2],
        [6, 1, 2],
        [4, 1, 2]
      ],
      clearance: 0.1
    });
    expect(reverse.positionParts[1]).toEqual({
      kind: 'auto-bezier',
      anchors: [
        [4, 1, 2],
        [3, 1.2, 2],
        [2, 1, 0]
      ]
    });
    expect(reverse.targetPoints).toEqual([
      [7, 1, 3],
      [3, 1, 2],
      [2, 1, 0],
      [1, 1.2, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 1]
    ]);
    expect(reverse.edges).toEqual([
      expectedRouteEdge('c-d', 'reverse', 'd', 'c', 0, 0, 2),
      expectedRouteEdge('b-c', 'reverse', 'c', 'b', 1, 0, 2),
      expectedRouteEdge('a-b', 'reverse', 'b', 'a', 2, 0, 2)
    ]);
    expect(() => createCameraMotion(forward)).not.toThrow();
    expect(() => createCameraMotion(reverse)).not.toThrow();
  });

  it('returns cloned route data without modifying connection anchors', () => {
    const route = getCameraRoute('a', 'c', customGraph);
    const part = route.positionParts[0];
    if (part.kind !== 'rounded-polyline') throw new Error('Expected rounded part');

    expect(part.points[1]).not.toBe(connections[0].positionPath.anchors[1].position);
    expect(connections[0].positionPath.anchors[1].position).toEqual([1, 1, 0]);
  });

  it('throws when injected graph is disconnected', () => {
    expect(() => getCameraRoute('a', 'isolated', customGraph)).toThrow(
      'No camera route from a to isolated'
    );
  });

  it('rejects non-contiguous connection joins before motion compilation', () => {
    const graph = createNavigationGraph({
      entities: [],
  objects: [],
      navigationNodes: nodes.slice(0, 3),
      connections: [
        {
          ...connections[0],
          positionPath: {
            kind: 'rounded-polyline',
            anchors: runtimeAnchors('bad-a-b', [
              [0, 1, 0],
              [1.9, 1, 0]
            ])
          }
        },
        connections[1]
      ]
    });

    expect(() => getCameraRoute('a', 'c', graph)).toThrow(
      'Camera route connections a-b and b-c must form a contiguous join'
    );
  });

  it('rejects source and destination ids missing from injected graph', () => {
    expect(() => getCameraRoute('missing', 'a', customGraph)).toThrow(
      'Unknown navigation node: missing'
    );
    expect(() => getCameraRoute('a', 'missing', customGraph)).toThrow(
      'Unknown navigation node: missing'
    );
  });

});

describe('getCameraConnectionRoute', () => {
  it('resolves exact selected edge instead of using BFS and supports both directions', () => {
    const parallelConnections: RuntimeConnection[] = [
      {
        id: 'direct',
        fromNodeId: 'a',
        toNodeId: 'b',
        clearance: 0.3,
        positionPath: {
          kind: 'rounded-polyline',
          anchors: runtimeAnchors('direct', [
            [0, 1, 0],
            [2, 1, 0]
          ])
        }
      },
      {
        id: 'scenic',
        fromNodeId: 'a',
        toNodeId: 'b',
        clearance: 0.3,
        positionPath: {
          kind: 'auto-bezier',
          anchors: runtimeAnchors('scenic', [
            [0, 1, 0],
            [1, 2, 2],
            [2, 1, 0]
          ])
        }
      }
    ];
    const graph = createNavigationGraph({
      entities: [],
  objects: [],
      navigationNodes: nodes.slice(0, 2),
      connections: parallelConnections
    });

    expect(getCameraRoute('a', 'b', graph).positionParts[0].kind).toBe(
      'rounded-polyline'
    );
    expect(getCameraConnectionRoute('scenic', 'forward', graph)).toEqual({
      positionParts: [
        {
          kind: 'auto-bezier',
          anchors: [
            [0, 1, 0],
            [1, 2, 2],
            [2, 1, 0]
          ]
        }
      ],
      targetPoints: [
        [0, 1, 1],
        [2, 1.5, 0],
        [2, 1, 1]
      ],
      startFov: 54,
      endFov: 54,
      nodeIds: ['a', 'b'],
      edges: [expectedRouteEdge('scenic', 'forward', 'a', 'b', 0, 0, 2)]
    });
    expect(getCameraConnectionRoute('scenic', 'reverse', graph)).toEqual({
      positionParts: [
        {
          kind: 'auto-bezier',
          anchors: [
            [2, 1, 0],
            [1, 2, 2],
            [0, 1, 0]
          ]
        }
      ],
      targetPoints: [
        [2, 1, 1],
        [0, 1.5, 0],
        [0, 1, 1]
      ],
      startFov: 54,
      endFov: 54,
      nodeIds: ['b', 'a'],
      edges: [expectedRouteEdge('scenic', 'reverse', 'b', 'a', 0, 0, 2)]
    });
  });

  it('selects only the authored view track for the requested direction', () => {
    const directionalNodes: NavigationNodeData[] = [
      { ...nodes[0], fov: 42 },
      { ...nodes[1], fov: 68 }
    ];
    const directionalConnection: RuntimeConnection = {
      ...connections[0],
      viewTracks: {
        forward: [
          {
            id: 'a-b-view-forward-01',
            progress: 0.3,
            cameraTarget: [1, 2, 3],
            fov: 35
          }
        ],
        reverse: [
          {
            id: 'a-b-view-reverse-01',
            progress: 0.6,
            cameraTarget: [4, 5, 6],
            fov: 88
          }
        ],
        framingEnvelope: {
          forward: { enterStart: 0.1, enterEnd: 0.2, exitStart: 0.8, exitEnd: 0.9 },
          reverse: { enterStart: 0, enterEnd: 0.25, exitStart: 0.75, exitEnd: 1 }
        }
      }
    };
    const graph = createNavigationGraph({
      entities: [],
  objects: [],
      navigationNodes: directionalNodes,
      connections: [directionalConnection]
    });

    const forward = getCameraConnectionRoute('a-b', 'forward', graph);
    expect(forward.startFov).toBe(42);
    expect(forward.endFov).toBe(68);
    expect(forward.edges[0].viewTrack).toEqual({
      start: { cameraTarget: [0, 1, 1], fov: 42 },
      keyframes: [
        {
          id: 'a-b-view-forward-01',
          progress: 0.3,
          cameraTarget: [1, 2, 3],
          fov: 35
        }
      ],
      end: { cameraTarget: [2, 1, 1], fov: 68 },
      framingEnvelope: { enterStart: 0.1, enterEnd: 0.2, exitStart: 0.8, exitEnd: 0.9 }
    });

    const reverse = getCameraConnectionRoute('a-b', 'reverse', graph);
    expect(reverse.startFov).toBe(68);
    expect(reverse.endFov).toBe(42);
    expect(reverse.edges[0].viewTrack).toEqual({
      start: { cameraTarget: [2, 1, 1], fov: 68 },
      keyframes: [
        {
          id: 'a-b-view-reverse-01',
          progress: 0.6,
          cameraTarget: [4, 5, 6],
          fov: 88
        }
      ],
      end: { cameraTarget: [0, 1, 1], fov: 42 },
      framingEnvelope: { enterStart: 0, enterEnd: 0.25, exitStart: 0.75, exitEnd: 1 }
    });

    const forwardTarget = forward.edges[0].viewTrack?.keyframes[0].cameraTarget;
    if (!Array.isArray(forwardTarget)) throw new Error('Expected tuple target');
    (forwardTarget as number[])[0] = 99;
    expect(directionalConnection.viewTracks?.forward[0].cameraTarget).toEqual([
      1,
      2,
      3
    ]);
    const forwardEnvelope = forward.edges[0].viewTrack?.framingEnvelope;
    if (!forwardEnvelope) throw new Error('Expected forward framing envelope');
    forwardEnvelope.enterStart = 0.7;
    expect(directionalConnection.viewTracks?.framingEnvelope?.forward?.enterStart).toBe(0.1);

    delete directionalConnection.viewTracks?.framingEnvelope?.reverse;
    const reverseWithoutEnvelope = getCameraConnectionRoute('a-b', 'reverse', graph);
    expect(reverseWithoutEnvelope.edges[0].viewTrack).not.toHaveProperty('framingEnvelope');
  });

  it('does not reuse a forward view track as a reverse fallback', () => {
    const graph = createNavigationGraph({
      entities: [],
  objects: [],
      navigationNodes: nodes.slice(0, 2),
      connections: [
        {
          ...connections[0],
          viewTracks: {
            forward: [
              {
                id: 'forward-only',
                progress: 0.5,
                cameraTarget: [1, 4, 3],
                fov: 44
              }
            ],
            reverse: []
          }
        }
      ]
    });

    expect(
      getCameraConnectionRoute('a-b', 'forward', graph).edges[0].viewTrack
        ?.keyframes
    ).toHaveLength(1);
    expect(
      getCameraConnectionRoute('a-b', 'reverse', graph).edges[0].viewTrack
        ?.keyframes
    ).toEqual([]);
  });

  it('uses travel-facing reverse look-ahead when reverse has no authored keys', () => {
    const graph = createNavigationGraph({
      entities: [],
  objects: [],
      navigationNodes: nodes.slice(0, 2),
      connections: [connections[0]]
    });
    const reverse = getCameraConnectionRoute('a-b', 'reverse', graph);
    const targets = reverse.edges[0]!.automaticTargetPoints!;
    const start = targets[0] as Vec3;
    const bLook = nodes[1]!.cameraTarget;
    // Start look faces travel (toward A), not B's authored room look-at.
    expect(start).not.toEqual(bLook);
    expect(start[2]).toBeLessThan(bLook[2]);
  });

  it('rejects unknown connection ids', () => {
    expect(() =>
      getCameraConnectionRoute('missing', 'forward', customGraph)
    ).toThrow('Unknown camera connection: missing');
  });

  it('rejects unknown directions at runtime boundaries', () => {
    expect(() =>
      getCameraConnectionRoute(
        'a-b',
        'sideways' as unknown as 'forward',
        customGraph
      )
    ).toThrow('Unknown camera connection direction: sideways');
  });
});
