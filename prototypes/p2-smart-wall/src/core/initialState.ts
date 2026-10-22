import { makePairKey, syncLights, updateClearances } from './RelationalSolver';
import {
  ArtworkItem,
  GalleryLight,
  GapMode,
  SplineControlPoint,
} from './types';
import {
  DEFAULT_EYE_LEVEL,
  WALL_PRESETS,
  WallSplineEngine,
} from './WallSplineEngine';

export function createInitialSceneState(): {
  wallPoints: SplineControlPoint[];
  artworks: ArtworkItem[];
  gapRelations: Record<string, { mode: GapMode; targetGap: number }>;
  lights: GalleryLight[];
  eyeLevelDatum: number;
} {
  const wallPoints = WALL_PRESETS['gentle-arc'].points.map((p) => ({ ...p }));
  const spline = new WallSplineEngine(wallPoints);
  const L = spline.totalLength;
  const centerU = L * 0.5;

  // Curated photography exhibition: "Studies in Horizon & Form"
  const rawArtworks: ArtworkItem[] = [
    {
      id: 'art-monolith-1',
      title: 'Monolith I (Salton Sea)',
      artist: 'Elena Vance',
      year: '2025',
      medium: 'Archival Silver Gelatin, Brushed Aluminum',
      width: 0.82,
      height: 1.12,
      frameDepth: 0.042,
      matWidth: 0.075,
      frameStyle: 'black-metal',
      motif: 'monolith-i',
      location: 'wall',
      u: centerU - 2.48,
      uNormAnchor: (centerU - 2.48) / L,
      h: DEFAULT_EYE_LEVEL,
      standoff: 0.015,
      autoCurveClearance: 0,
      pitchDeg: 0,
      anchorMode: 'proportional',
      verticalMode: 'eye-level',
    },
    {
      id: 'art-horizon-hero',
      title: 'Solitude at Dusk (No. 4)',
      artist: 'Elena Vance',
      year: '2026',
      medium: 'Large-Format Pigment Print, American Walnut',
      width: 1.48,
      height: 0.96,
      frameDepth: 0.052,
      matWidth: 0.09,
      frameStyle: 'walnut',
      motif: 'horizon-dusk',
      location: 'wall',
      u: centerU - 0.88,
      uNormAnchor: (centerU - 0.88) / L,
      h: DEFAULT_EYE_LEVEL,
      standoff: 0.018,
      autoCurveClearance: 0,
      pitchDeg: 0,
      anchorMode: 'proportional',
      verticalMode: 'eye-level',
    },
    {
      id: 'art-tidal',
      title: 'Tidal Geometry',
      artist: 'Elena Vance',
      year: '2025',
      medium: 'Platinum Palladium Print, White Oak',
      width: 0.94,
      height: 0.94,
      frameDepth: 0.045,
      matWidth: 0.08,
      frameStyle: 'warm-oak',
      motif: 'tidal-geometry',
      location: 'wall',
      u: centerU + 0.78,
      uNormAnchor: (centerU + 0.78) / L,
      h: DEFAULT_EYE_LEVEL,
      standoff: 0.015,
      autoCurveClearance: 0,
      pitchDeg: 0,
      anchorMode: 'proportional',
      verticalMode: 'eye-level',
    },
    {
      id: 'art-monolith-2',
      title: 'Monolith II (Basalt Study)',
      artist: 'Elena Vance',
      year: '2025',
      medium: 'Archival Silver Gelatin, Brushed Aluminum',
      width: 0.82,
      height: 1.12,
      frameDepth: 0.042,
      matWidth: 0.075,
      frameStyle: 'black-metal',
      motif: 'monolith-ii',
      location: 'wall',
      u: centerU + 2.11,
      uNormAnchor: (centerU + 2.11) / L,
      h: DEFAULT_EYE_LEVEL,
      standoff: 0.015,
      autoCurveClearance: 0,
      pitchDeg: 0,
      anchorMode: 'proportional',
      verticalMode: 'eye-level',
    },
    // Works resting on the 3D Floor Staging Rack beside the wall, ready to be hung!
    {
      id: 'art-desert-sine',
      title: 'Aeolian Ridge (Namib)',
      artist: 'Elena Vance',
      year: '2026',
      medium: 'Chromogenic Print, Brushed Brass',
      width: 1.05,
      height: 0.78,
      frameDepth: 0.04,
      matWidth: 0.065,
      frameStyle: 'brushed-brass',
      motif: 'desert-sine',
      location: 'rack',
      rackIndex: 0,
      u: L * 0.75,
      uNormAnchor: 0.75,
      h: DEFAULT_EYE_LEVEL,
      standoff: 0.015,
      autoCurveClearance: 0,
      pitchDeg: 0,
      anchorMode: 'proportional',
      verticalMode: 'eye-level',
    },
    {
      id: 'art-portrait-shadow',
      title: 'Figure in Chiaroscuro',
      artist: 'Elena Vance',
      year: '2024',
      medium: 'Direct-to-Dibond Matte Mount',
      width: 0.72,
      height: 0.92,
      frameDepth: 0.026,
      matWidth: 0.0,
      frameStyle: 'floating-dibond',
      motif: 'portrait-shadow',
      location: 'rack',
      rackIndex: 1,
      u: L * 0.25,
      uNormAnchor: 0.25,
      h: DEFAULT_EYE_LEVEL,
      standoff: 0.045, // Floating mount offset
      autoCurveClearance: 0,
      pitchDeg: 0,
      anchorMode: 'proportional',
      verticalMode: 'eye-level',
    },
  ];

  // Set initial curated equal gap of 0.45m across the 4 wall works
  const gapRelations: Record<string, { mode: GapMode; targetGap: number }> = {
    [makePairKey('art-monolith-1', 'art-horizon-hero')]: {
      mode: 'equal',
      targetGap: 0.45,
    },
    [makePairKey('art-horizon-hero', 'art-tidal')]: {
      mode: 'equal',
      targetGap: 0.45,
    },
    [makePairKey('art-tidal', 'art-monolith-2')]: {
      mode: 'equal',
      targetGap: 0.45,
    },
  };

  // Position the 4 wall works with exact 0.45m equal gaps centered on the wall
  const wallWorks = rawArtworks.filter((a) => a.location === 'wall');
  const gap = 0.45;
  const totalSpan =
    wallWorks.reduce((s, a) => s + a.width, 0) + gap * (wallWorks.length - 1);
  let cursor = centerU - totalSpan * 0.5;
  for (const w of wallWorks) {
    w.u = cursor + w.width * 0.5;
    w.uNormAnchor = w.u / L;
    cursor += w.width + gap;
  }

  const artworks = updateClearances(rawArtworks, spline);

  const rawLights: GalleryLight[] = [
    {
      id: 'light-1',
      name: 'Track Spot 01',
      targetType: 'artwork',
      targetArtworkId: 'art-monolith-1',
      artworkOffsetU: 0,
      artworkOffsetH: 0.04,
      targetU: wallWorks[0].u,
      targetH: DEFAULT_EYE_LEVEL + 0.04,
      trackOffsetU: -0.18,
      trackDistance: 1.38,
      coneAngleDeg: 24,
      penumbra: 0.65,
      intensity: 2.2,
      kelvin: 3400,
      enabled: true,
    },
    {
      id: 'light-2',
      name: 'Track Spot 02 (Hero Wash)',
      targetType: 'artwork',
      targetArtworkId: 'art-horizon-hero',
      artworkOffsetU: 0,
      artworkOffsetH: 0.02,
      targetU: wallWorks[1].u,
      targetH: DEFAULT_EYE_LEVEL + 0.02,
      trackOffsetU: 0.0,
      trackDistance: 1.42,
      coneAngleDeg: 32,
      penumbra: 0.72,
      intensity: 2.65,
      kelvin: 3200,
      enabled: true,
    },
    {
      id: 'light-3',
      name: 'Track Spot 03',
      targetType: 'artwork',
      targetArtworkId: 'art-tidal',
      artworkOffsetU: 0,
      artworkOffsetH: 0.03,
      targetU: wallWorks[2].u,
      targetH: DEFAULT_EYE_LEVEL + 0.03,
      trackOffsetU: 0.14,
      trackDistance: 1.38,
      coneAngleDeg: 25,
      penumbra: 0.68,
      intensity: 2.25,
      kelvin: 3600,
      enabled: true,
    },
    {
      id: 'light-4',
      name: 'Track Spot 04',
      targetType: 'artwork',
      targetArtworkId: 'art-monolith-2',
      artworkOffsetU: 0,
      artworkOffsetH: 0.04,
      targetU: wallWorks[3].u,
      targetH: DEFAULT_EYE_LEVEL + 0.04,
      trackOffsetU: 0.2,
      trackDistance: 1.38,
      coneAngleDeg: 24,
      penumbra: 0.65,
      intensity: 2.2,
      kelvin: 3400,
      enabled: true,
    },
  ];

  const lights = syncLights(rawLights, artworks, spline);

  return {
    wallPoints,
    artworks,
    gapRelations,
    lights,
    eyeLevelDatum: DEFAULT_EYE_LEVEL,
  };
}
