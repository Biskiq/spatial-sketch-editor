import { describe, it, expect } from 'vitest';
import { wheelSource } from '../src/scene/wheel';

describe('mouse wheel zooms, trackpad scroll orbits', () => {
  it('reads mouse wheels as mouse', () => {
    expect(wheelSource({ dx: 0, dy: 4.000244140625, mode: 0, wdy: -12 })).toBe('mouse'); // Safari, macOS
    expect(wheelSource({ dx: 0, dy: -8.00048828125, mode: 0, wdy: 24 })).toBe('mouse');
    expect(wheelSource({ dx: 0, dy: 100, mode: 0, wdy: -120 })).toBe('mouse'); // Chrome notch
    expect(wheelSource({ dx: 0, dy: 3, mode: 1 })).toBe('mouse'); // Firefox lines
    expect(wheelSource({ dx: 0, dy: 40, mode: 0, wdy: -120 })).toBe('mouse');
    expect(wheelSource({ dx: 0, dy: 7.5, mode: 0 })).toBe('mouse'); // no evidence: never tilt
  });
  it('reads trackpads as trackpad', () => {
    expect(wheelSource({ dx: 0, dy: 3, mode: 0, wdy: -9 })).toBe('trackpad');
    expect(wheelSource({ dx: 0, dy: 0.5, mode: 0, wdy: -1.5 })).toBe('trackpad');
    expect(wheelSource({ dx: 2, dy: 6, mode: 0, wdy: -18 })).toBe('trackpad');
    expect(wheelSource({ dx: -1, dy: 0, mode: 0 })).toBe('trackpad');
  });
});
