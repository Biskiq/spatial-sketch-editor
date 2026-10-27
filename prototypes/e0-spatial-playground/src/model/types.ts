// Experiment-only document. Units are metres and radians; floor plane is X/Z.
// Nothing here is a production format.

export const DOC_VERSION = 'e0-playground/1' as const;

export type Vec2 = [number, number];

/** Which side the visitor enters from. `south` = initial brief (−Z edge); `east` = revised brief (+X edge). */
export type Entrance = 'south' | 'east';

export interface GuidePoint {
  id: string;
  x: number;
  z: number;
}

export interface Guide {
  id: string;
  name: string;
  points: GuidePoint[];
}

export interface Band {
  id: string;
  guideId: string;
  width: number;
  height: number;
}

export interface Pose {
  x: number;
  z: number;
  /** Rotation about +Y (three.js convention): yaw 0 means the piece's local +X is world +X. */
  yaw: number;
}

export interface Piece {
  id: string;
  name: string;
  main: boolean;
  width: number;
  depth: number;
  height: number;
  /** The free pose. Ignored while the piece is following an arrangement. */
  pose: Pose;
}

export interface ArrangementMember {
  pieceId: string;
  slot: 0 | 1 | 2;
  following: boolean;
}

export interface Arrangement {
  id: string;
  guideId: string;
  startMargin: number;
  endMargin: number;
  /** Signed sideways offset from the guide, along (−tangentZ, tangentX). */
  sideOffset: number;
  members: ArrangementMember[];
}

export interface E0Document {
  version: typeof DOC_VERSION;
  entrance: Entrance;
  notes: string;
  guide: Guide | null;
  band: Band | null;
  arrangement: Arrangement | null;
  pieces: Piece[];
}
