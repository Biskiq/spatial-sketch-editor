import { DOC_VERSION, type E0Document, type Entrance } from './types';

export const FLOOR_HALF = 3;

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Shaded arrival areas from the brief (§2.1). */
export const ARRIVAL: Record<Entrance, Rect> = {
  south: { minX: -0.6, maxX: 0.6, minZ: -3, maxZ: -1.8 },
  east: { minX: 1.8, maxX: 3, minZ: -0.6, maxZ: 0.6 },
};

export const ENTRANCE_LABEL: Record<Entrance, string> = {
  south: 'Entrance A (−Z side)',
  east: 'Entrance B (+X side)',
};

export const DEFAULT_BAND = { width: 0.2, height: 0.3 };
export const DEFAULT_ARRANGE = { startMargin: 0.3, endMargin: 0.3, sideOffset: 0.5 };

export function freshFixture(): E0Document {
  return {
    version: DOC_VERSION,
    entrance: 'south',
    notes: '',
    guide: null,
    band: null,
    arrangement: null,
    pieces: [
      { id: 'piece-main', name: 'Main piece', main: true, width: 0.45, depth: 0.45, height: 1.0, pose: { x: -1, z: 0, yaw: 0 } },
      { id: 'piece-b', name: 'Support B', main: false, width: 0.45, depth: 0.45, height: 0.6, pose: { x: 0, z: 0, yaw: 0 } },
      { id: 'piece-c', name: 'Support C', main: false, width: 0.45, depth: 0.45, height: 0.4, pose: { x: 1, z: 0, yaw: 0 } },
    ],
  };
}
