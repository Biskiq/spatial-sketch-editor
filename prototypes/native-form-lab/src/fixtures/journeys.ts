import { createCarrier } from '../model/store';
import { createProfile } from '../model/types';
import type { FormDraft, Frame, Vec2, Vec3 } from '../model/types';

export type Journey = 'pedestal' | 'ornament' | 'trim';

export const groundFrame: Frame = {
  origin: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 0, -1],
  normal: [0, 1, 0],
};

export const verticalFrame: Frame = {
  origin: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 1, 0],
  normal: [0, 0, 1],
};

export const trimFrame: Frame = {
  origin: [0, 0.08, 0],
  u: [0, 0, -1],
  v: [0, 1, 0],
  normal: [1, 0, 0],
};

export function createJourneyDraft(journey: Journey): FormDraft {
  if (journey === 'pedestal') {
    return {
      name: 'Pedestal',
      profile: createProfile([[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]], 'pedestal-profile'),
      frame: { ...groundFrame },
      operation: { kind: 'extrude', height: 1.15 },
      rounding: { radius: 0.11, policy: 'profile-corners' },
      hostLink: {
        target: { kind: 'fixture-plane', fixtureId: 'workspace', planeKey: 'ground' },
        lastFrame: { ...groundFrame },
        status: 'resolved',
      },
    };
  }

  if (journey === 'ornament') {
    return {
      name: 'Turned ornament',
      profile: createProfile([[0, 0], [0.3, 0], [0.39, 0.22], [0.24, 0.43], [0.36, 0.78], [0.25, 1.03], [0, 1.24]], 'ornament-profile'),
      frame: { ...verticalFrame },
      operation: { kind: 'revolve', angleDegrees: 360 },
      rounding: { radius: 0, policy: 'none' },
    };
  }

  const pathPoints: Vec3[] = [
    [0, 0.08, 0],
    [1.45, 0.08, 0],
    [2.1, 0.08, -0.04],
    [2.46, 0.08, -0.2],
    [2.5, 0.08, -0.45],
    [2.25, 0.08, -0.72],
    [1.72, 0.08, -0.9],
    [0.35, 0.08, -0.9],
  ];
  const section: Vec2[] = [[0, 0], [0.075, 0], [0.075, 0.13], [0, 0.13]];
  return {
    name: 'Room trim',
    profile: createProfile(section, 'room-trim-section'),
    frame: { ...trimFrame },
    operation: { kind: 'sweep', carrier: createCarrier(pathPoints, trimFrame, 'room-trim-path') },
    rounding: { radius: 0, policy: 'none' },
    hostLink: {
      target: { kind: 'fixture-plane', fixtureId: 'workspace', planeKey: 'ground' },
      lastFrame: { ...groundFrame },
      status: 'resolved',
    },
  };
}

export function createTiltedHostDraft(): FormDraft {
  const tilt = Math.PI / 12;
  const frame: Frame = {
    origin: [0, 0, 0],
    u: [1, 0, 0],
    v: [0, Math.sin(tilt), -Math.cos(tilt)],
    normal: [0, Math.cos(tilt), Math.sin(tilt)],
  };
  return {
    name: 'Tilted host study · 15°',
    profile: createProfile([[-0.95, -0.58], [0.95, -0.58], [0.95, 0.58], [-0.95, 0.58]], 'tilted-host-profile'),
    frame,
    operation: { kind: 'extrude', height: 0.24 },
    rounding: { radius: 0.035, policy: 'profile-corners' },
  };
}
