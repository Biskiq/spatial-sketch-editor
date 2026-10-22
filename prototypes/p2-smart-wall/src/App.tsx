import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createInitialSceneState } from './core/initialState';
import {
  computePairwiseGaps,
  enforceRelationalConstraints,
  getSortedWallArtworks,
  makePairKey,
  solveArtworkDrag,
  solveWallReshape,
  syncLights,
  updateClearances,
} from './core/RelationalSolver';
import {
  AmbientPreset,
  ArtworkItem,
  GalleryLight,
  GapMode,
  PairwiseGapRelation,
  RevisionSnapshot,
  SnapGuide,
  SpatialConflict,
  SplineControlPoint,
  WallPresetId,
} from './core/types';
import { WALL_PRESETS, WallSplineEngine } from './core/WallSplineEngine';
import {
  GallerySceneManager,
  HudProjectionData,
} from './scene/GallerySceneManager';
import { ElevationRibbonBar } from './ui/ElevationRibbonBar';
import { SurfaceOverlayHUD } from './ui/SurfaceOverlayHUD';
import { TopCuratorialBar } from './ui/TopCuratorialBar';

function cloneSnapshot(
  label: string,
  wallPoints: SplineControlPoint[],
  artworks: ArtworkItem[],
  gapRelations: Record<string, { mode: GapMode; targetGap: number }>,
  lights: GalleryLight[],
  eyeLevelDatum: number
): RevisionSnapshot {
  return {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    timestamp: Date.now(),
    wallPoints: wallPoints.map((p) => ({ ...p })),
    artworks: artworks.map((a) => ({ ...a })),
    gapRelations: JSON.parse(JSON.stringify(gapRelations)),
    lights: lights.map((l) => ({ ...l })),
    eyeLevelDatum,
  };
}

export const App: React.FC = () => {
  const initial = useMemo(() => createInitialSceneState(), []);

  const [wallPoints, setWallPoints] = useState<SplineControlPoint[]>(
    initial.wallPoints
  );
  const [activeWallPreset, setActiveWallPreset] = useState<
    WallPresetId | 'custom'
  >('gentle-arc');
  const [artworks, setArtworks] = useState<ArtworkItem[]>(initial.artworks);
  const [gapRelations, setGapRelations] = useState<
    Record<string, { mode: GapMode; targetGap: number }>
  >(initial.gapRelations);
  const [lights, setLights] = useState<GalleryLight[]>(initial.lights);
  const [eyeLevelDatum, setEyeLevelDatum] = useState<number>(
    initial.eyeLevelDatum
  );

  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(
    'art-horizon-hero'
  );
  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);
  const [wallEditMode, setWallEditMode] = useState<boolean>(false);
  const [showLightBeams, setShowLightBeams] = useState<boolean>(true);
  const [ambientPreset, setAmbientPreset] =
    useState<AmbientPreset>('opening-night');

  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [conflicts, setConflicts] = useState<SpatialConflict[]>([]);
  const [snapshots, setSnapshots] = useState<RevisionSnapshot[]>([]);
  const [showGhostOverlay, setShowGhostOverlay] = useState<boolean>(false);
  const [hudProjection, setHudProjection] =
    useState<HudProjectionData | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sceneManagerRef = useRef<GallerySceneManager | null>(null);
  const morphAnimRef = useRef<number | null>(null);

  // Refs for latest state inside synchronous callbacks
  const stateRef = useRef({
    wallPoints,
    artworks,
    gapRelations,
    lights,
    eyeLevelDatum,
  });
  stateRef.current = {
    wallPoints,
    artworks,
    gapRelations,
    lights,
    eyeLevelDatum,
  };

  const spline = useMemo(() => new WallSplineEngine(wallPoints), [wallPoints]);
  const splineRef = useRef(spline);
  splineRef.current = spline;

  const pairwiseGaps = useMemo(
    () => computePairwiseGaps(artworks, gapRelations),
    [artworks, gapRelations]
  );

  const activeGhostSnapshot =
    snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  const pushSnapshot = useCallback((label: string) => {
    const s = stateRef.current;
    const snap = cloneSnapshot(
      label,
      s.wallPoints,
      s.artworks,
      s.gapRelations,
      s.lights,
      s.eyeLevelDatum
    );
    setSnapshots((prev) => [...prev.slice(-8), snap]);
  }, []);

  // Handle Artwork Drag (from 3D Wall or 2D Unfolded Ribbon)
  const handleDragArtwork = useCallback(
    (
      artId: string,
      desiredU: number,
      desiredH: number,
      bypassSnaps: boolean,
      dropToRack = false
    ) => {
      const currSpline = splineRef.current;
      const s = stateRef.current;

      if (dropToRack) {
        const nextArts = s.artworks.map((a) =>
          a.id === artId ? { ...a, location: 'rack' as const } : a
        );
        setArtworks(nextArts);
        setSnapGuides([]);
        return;
      }

      const solved = solveArtworkDrag({
        artworks: s.artworks,
        activeArtId: artId,
        desiredU,
        desiredH,
        spline: currSpline,
        eyeLevelDatum: s.eyeLevelDatum,
        gapStateMap: s.gapRelations,
        bypassSnaps,
      });

      const syncedLights = syncLights(s.lights, solved.artworks, currSpline);
      setArtworks(solved.artworks);
      setLights(syncedLights);
      setSnapGuides(solved.guides);
      setConflicts([]);
    },
    []
  );

  // Handle moving a Floor Spline Control Point in 3D
  const handleMoveControlPoint = useCallback(
    (pointId: string, x: number, z: number) => {
      const s = stateRef.current;
      const prevSpline = splineRef.current;

      const nextPoints = s.wallPoints.map((pt) =>
        pt.id === pointId ? { ...pt, x, z } : pt
      );
      const nextSpline = new WallSplineEngine(nextPoints);

      const reshaped = solveWallReshape({
        artworks: s.artworks,
        lights: s.lights,
        gapStateMap: s.gapRelations,
        prevWallLength: prevSpline.totalLength,
        nextSpline,
      });

      setWallPoints(nextPoints);
      setActiveWallPreset('custom');
      setArtworks(reshaped.artworks);
      setLights(reshaped.lights);
      setConflicts(reshaped.conflicts);
    },
    []
  );

  // Initialize Three.js GallerySceneManager
  useEffect(() => {
    if (!viewportRef.current) return;

    const manager = new GallerySceneManager(
      viewportRef.current,
      splineRef.current,
      {
        onSelectArtwork: (id) => setSelectedArtworkId(id),
        onSelectLight: (id) => setSelectedLightId(id),
        onDragArtwork: (artId, u, h, bypass, toRack) =>
          handleDragArtwork(artId, u, h, bypass, toRack),
        onDragStart: (label) => pushSnapshot(label),
        onDragEnd: () => setSnapGuides([]),
        onMoveControlPoint: (pointId, x, z) =>
          handleMoveControlPoint(pointId, x, z),
        onUpdateLightTarget: (lightId, u, h, hitArtworkId) => {
          setLights((prev) =>
            prev.map((l) => {
              if (l.id !== lightId) return l;
              if (hitArtworkId) {
                const art = stateRef.current.artworks.find(
                  (a) => a.id === hitArtworkId
                );
                if (art && art.location === 'wall') {
                  return {
                    ...l,
                    targetType: 'artwork',
                    targetArtworkId: art.id,
                    artworkOffsetU: Number((u - art.u).toFixed(2)),
                    artworkOffsetH: Number((h - art.h).toFixed(2)),
                    targetU: u,
                    targetH: h,
                  };
                }
              }
              return {
                ...l,
                targetType: 'wall-point',
                targetArtworkId: undefined,
                targetU: u,
                targetH: h,
              };
            })
          );
        },
        onUpdateLightTrackOffset: (lightId, newTrackOffsetU) => {
          setLights((prev) =>
            prev.map((l) =>
              l.id === lightId
                ? { ...l, trackOffsetU: Number(newTrackOffsetU.toFixed(2)) }
                : l
            )
          );
        },
        onUpdateEyeLevel: (newHeight) => setEyeLevelDatum(newHeight),
        onProjectionUpdate: (proj) => setHudProjection(proj),
      }
    );

    sceneManagerRef.current = manager;
    manager.syncState({
      spline: splineRef.current,
      artworks: stateRef.current.artworks,
      lights: stateRef.current.lights,
      gaps: computePairwiseGaps(
        stateRef.current.artworks,
        stateRef.current.gapRelations
      ),
      conflicts: [],
      guides: [],
      eyeLevelDatum: stateRef.current.eyeLevelDatum,
      selectedArtworkId: 'art-horizon-hero',
      selectedLightId: null,
      wallEditMode: false,
      showLightBeams: true,
      ambientPreset: 'opening-night',
      ghostSnapshot: null,
      showGhostOverlay: false,
    });

    return () => {
      manager.dispose();
      sceneManagerRef.current = null;
    };
  }, [handleDragArtwork, handleMoveControlPoint, pushSnapshot]);

  // Sync React state to Three.js scene
  useEffect(() => {
    sceneManagerRef.current?.syncState({
      spline,
      artworks,
      lights,
      gaps: pairwiseGaps,
      conflicts,
      guides: snapGuides,
      eyeLevelDatum,
      selectedArtworkId,
      selectedLightId,
      wallEditMode,
      showLightBeams,
      ambientPreset,
      ghostSnapshot: activeGhostSnapshot,
      showGhostOverlay,
    });
  }, [
    spline,
    artworks,
    lights,
    pairwiseGaps,
    conflicts,
    snapGuides,
    eyeLevelDatum,
    selectedArtworkId,
    selectedLightId,
    wallEditMode,
    showLightBeams,
    ambientPreset,
    activeGhostSnapshot,
    showGhostOverlay,
  ]);

  // Hold Spacebar to peek Before/After Ghost Comparison
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        document.activeElement?.tagName !== 'INPUT' &&
        !e.repeat
      ) {
        e.preventDefault();
        setShowGhostOverlay(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setShowGhostOverlay(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Smoothly morph wall control points to a target array
  const animateWallMorph = useCallback(
    (
      targetPoints: SplineControlPoint[],
      presetLabel: string,
      presetId: WallPresetId | 'custom'
    ) => {
      if (morphAnimRef.current) {
        cancelAnimationFrame(morphAnimRef.current);
      }

      pushSnapshot(presetLabel);
      const startPoints = stateRef.current.wallPoints.map((p) => ({ ...p }));
      const startSpline = new WallSplineEngine(startPoints);
      const startArtworks = stateRef.current.artworks.map((a) => ({ ...a }));
      const startLights = stateRef.current.lights.map((l) => ({ ...l }));
      const startGaps = JSON.parse(
        JSON.stringify(stateRef.current.gapRelations)
      );

      const duration = 520;
      const startTime = performance.now();

      const step = (now: number) => {
        const rawT = Math.min(1, (now - startTime) / duration);
        // Cubic ease out
        const easeT = 1 - Math.pow(1 - rawT, 3);

        const interpPoints = startPoints.map((sp, idx) => {
          const tp = targetPoints[idx] || sp;
          return {
            id: sp.id,
            x: sp.x + (tp.x - sp.x) * easeT,
            z: sp.z + (tp.z - sp.z) * easeT,
          };
        });

        const nextSpline = new WallSplineEngine(interpPoints);
        const reshaped = solveWallReshape({
          artworks: startArtworks,
          lights: startLights,
          gapStateMap: startGaps,
          prevWallLength: startSpline.totalLength,
          nextSpline,
        });

        setWallPoints(interpPoints);
        setActiveWallPreset(presetId);
        setArtworks(reshaped.artworks);
        setLights(reshaped.lights);
        setConflicts(reshaped.conflicts);

        if (rawT < 1) {
          morphAnimRef.current = requestAnimationFrame(step);
        } else {
          morphAnimRef.current = null;
        }
      };

      morphAnimRef.current = requestAnimationFrame(step);
    },
    [pushSnapshot]
  );

  // Cycle Gap Mode on a pairwise token ('free' -> 'locked' -> 'equal')
  const handleCycleGapMode = (rel: PairwiseGapRelation) => {
    const order: GapMode[] = ['free', 'locked', 'equal'];
    const nextMode = order[(order.indexOf(rel.mode) + 1) % order.length];
    pushSnapshot(`Set Gap to ${nextMode.toUpperCase()} (${rel.currentGap.toFixed(2)}m)`);

    const nextMap = {
      ...gapRelations,
      [rel.pairKey]: {
        mode: nextMode,
        targetGap: Number(rel.currentGap.toFixed(2)),
      },
    };

    const enforced = enforceRelationalConstraints(
      artworks,
      nextMap,
      spline,
      rel.leftArtId
    );
    setGapRelations(nextMap);
    setArtworks(enforced);
    setLights(syncLights(lights, enforced, spline));
  };

  // Set an exact gap measurement in meters
  const handleSetExactGap = (
    rel: PairwiseGapRelation,
    newGapMeters: number
  ) => {
    const nextMap = {
      ...gapRelations,
      [rel.pairKey]: {
        mode: 'locked' as GapMode,
        targetGap: newGapMeters,
      },
    };
    const enforced = enforceRelationalConstraints(
      artworks,
      nextMap,
      spline,
      rel.leftArtId
    );
    setGapRelations(nextMap);
    setArtworks(enforced);
    setLights(syncLights(lights, enforced, spline));
  };

  // Equalize all hung artworks across the wall with generous gallery margins
  const handleDistributeAllEqual = () => {
    pushSnapshot('Equalized Rhythm Across Wall');
    const sorted = getSortedWallArtworks(artworks);
    if (sorted.length < 2) return;

    const totalArtW = sorted.reduce((acc, a) => acc + a.width, 0);
    const availSpace = Math.max(0.4, spline.totalLength - totalArtW);
    // Give outer margins 1.15x the internal gap for classic museum proportion
    const equalGap = Math.max(
      0.16,
      availSpace / (sorted.length - 1 + 2.3)
    );
    const totalSpan = totalArtW + equalGap * (sorted.length - 1);
    let cursor = (spline.totalLength - totalSpan) * 0.5;

    const nextMap = { ...gapRelations };
    const posById = new Map<string, number>();

    sorted.forEach((art, i) => {
      const newU = cursor + art.width * 0.5;
      posById.set(art.id, newU);
      cursor += art.width + equalGap;
      if (i < sorted.length - 1) {
        const pk = makePairKey(art.id, sorted[i + 1].id);
        nextMap[pk] = { mode: 'equal', targetGap: Number(equalGap.toFixed(2)) };
      }
    });

    const nextArts = updateClearances(
      artworks.map((a) => {
        const u = posById.get(a.id);
        return u !== undefined
          ? { ...a, u, uNormAnchor: u / spline.totalLength }
          : a;
      }),
      spline
    );

    setGapRelations(nextMap);
    setArtworks(nextArts);
    setLights(syncLights(lights, nextArts, spline));
    setConflicts([]);
  };

  // Lock all current gaps
  const handleLockAllGaps = () => {
    pushSnapshot('Locked All Pairwise Gaps');
    const nextMap = { ...gapRelations };
    for (const rel of pairwiseGaps) {
      nextMap[rel.pairKey] = {
        mode: 'locked',
        targetGap: Number(rel.currentGap.toFixed(2)),
      };
    }
    setGapRelations(nextMap);
  };

  // Update Eye-Level Datum and move all eye-level-snapped works with it
  const handleUpdateEyeLevel = (newEyeLevel: number) => {
    setEyeLevelDatum(newEyeLevel);
    const nextArts = artworks.map((a) =>
      a.location === 'wall' && a.verticalMode === 'eye-level'
        ? { ...a, h: newEyeLevel }
        : a
    );
    setArtworks(nextArts);
    setLights(syncLights(lights, nextArts, spline));
  };

  // Update individual artwork properties (standoff, pitch, anchorMode)
  const handleUpdateArtworkProps = (
    artId: string,
    patch: Partial<ArtworkItem>
  ) => {
    pushSnapshot('Updated Artwork Mounting');
    const nearestApex =
      spline.landmarks.find(
        (l) => l.kind === 'apex' || l.kind === 'inflection'
      ) || spline.landmarks.find((l) => l.kind === 'center');

    const nextArts = updateClearances(
      artworks.map((a) => {
        if (a.id !== artId) return a;
        const updated = { ...a, ...patch };
        if (patch.anchorMode === 'apex-pinned' && nearestApex) {
          updated.apexDeltaU = updated.u - nearestApex.u;
          updated.pinnedLandmarkId = nearestApex.id;
        }
        return updated;
      }),
      spline
    );
    setArtworks(nextArts);
  };

  // Move an artwork from the wall to the 3D Floor Staging Rack
  const handleMoveArtworkToRack = (artId: string) => {
    const target = artworks.find((a) => a.id === artId);
    if (!target) return;
    pushSnapshot(`Moved "${target.title}" to Staging Rack`);
    const nextArts = artworks.map((a) =>
      a.id === artId ? { ...a, location: 'rack' as const } : a
    );
    setArtworks(nextArts);
    setSelectedArtworkId(null);
    setConflicts([]);
  };

  // Hang an artwork from the 3D Floor Staging Rack onto the wall
  const handleHangArtworkFromRack = (artId: string) => {
    const target = artworks.find((a) => a.id === artId);
    if (!target) return;
    pushSnapshot(`Hung "${target.title}" from Staging Rack`);

    const wallWorks = getSortedWallArtworks(artworks);
    const lastWork = wallWorks[wallWorks.length - 1];
    const desiredU = lastWork
      ? Math.min(
          spline.totalLength - target.width * 0.5 - 0.16,
          lastWork.u + lastWork.width * 0.5 + 0.42 + target.width * 0.5
        )
      : spline.totalLength * 0.5;

    const nextArts = updateClearances(
      artworks.map((a) =>
        a.id === artId
          ? {
              ...a,
              location: 'wall' as const,
              u: desiredU,
              uNormAnchor: desiredU / spline.totalLength,
              h: eyeLevelDatum,
            }
          : a
      ),
      spline
    );
    setArtworks(nextArts);
    setSelectedArtworkId(artId);
  };

  // Focus or spawn a spotlight on the selected artwork
  const handleFocusLightOnArtwork = (artId: string) => {
    const art = artworks.find((a) => a.id === artId);
    if (!art) return;

    const existing = lights.find((l) => l.targetArtworkId === artId);
    if (existing) {
      setSelectedLightId(existing.id);
      return;
    }

    pushSnapshot(`Illuminated "${art.title}"`);
    const newLight: GalleryLight = {
      id: `light-${Date.now()}`,
      name: `Track Spot 0${lights.length + 1}`,
      targetType: 'artwork',
      targetArtworkId: art.id,
      artworkOffsetU: 0,
      artworkOffsetH: 0.02,
      targetU: art.u,
      targetH: art.h + 0.02,
      trackOffsetU: 0.12,
      trackDistance: 1.38,
      coneAngleDeg: 26,
      penumbra: 0.68,
      intensity: 2.35,
      kelvin: 3350,
      enabled: true,
    };
    setLights((prev) => [...prev, newLight]);
    setSelectedLightId(newLight.id);
  };

  // Add a new spotlight in the center or on selected artwork
  const handleAddSpotlight = () => {
    if (selectedArtworkId) {
      handleFocusLightOnArtwork(selectedArtworkId);
      return;
    }
    pushSnapshot('Added Overhead Track Spotlight');
    const newLight: GalleryLight = {
      id: `light-${Date.now()}`,
      name: `Track Spot 0${lights.length + 1}`,
      targetType: 'wall-point',
      artworkOffsetU: 0,
      artworkOffsetH: 0,
      targetU: spline.totalLength * 0.5,
      targetH: eyeLevelDatum,
      trackOffsetU: 0.0,
      trackDistance: 1.38,
      coneAngleDeg: 28,
      penumbra: 0.65,
      intensity: 2.4,
      kelvin: 3400,
      enabled: true,
    };
    setLights((prev) => [...prev, newLight]);
    setSelectedLightId(newLight.id);
  };

  // Resolve a SpatialConflict with one click
  const handleResolveConflict = (
    conflict: SpatialConflict,
    actionType: SpatialConflict['resolutions'][number]['actionType']
  ) => {
    if (
      actionType === 'compress-locked-gaps' ||
      actionType === 'switch-to-proportional'
    ) {
      handleDistributeAllEqual();
    } else if (actionType === 'move-overflow-to-rack') {
      const sorted = getSortedWallArtworks(artworks);
      const rightmost = sorted[sorted.length - 1];
      if (rightmost) {
        handleMoveArtworkToRack(rightmost.id);
        setTimeout(() => handleDistributeAllEqual(), 20);
      }
    } else if (actionType === 'separate-overlaps') {
      pushSnapshot('Restored 35cm Frame Breathing Room');
      const sorted = getSortedWallArtworks(artworks);
      const gap = 0.35;
      const totalSpan =
        sorted.reduce((s, a) => s + a.width, 0) + gap * (sorted.length - 1);
      let cursor = (spline.totalLength - totalSpan) * 0.5;
      const posMap = new Map<string, number>();
      for (const a of sorted) {
        posMap.set(a.id, cursor + a.width * 0.5);
        cursor += a.width + gap;
      }
      const nextArts = updateClearances(
        artworks.map((a) => {
          const u = posMap.get(a.id);
          return u !== undefined
            ? { ...a, u, uNormAnchor: u / spline.totalLength }
            : a;
        }),
        spline
      );
      setArtworks(nextArts);
      setLights(syncLights(lights, nextArts, spline));
      setConflicts((prev) => prev.filter((c) => c.id !== conflict.id));
    } else if (actionType === 'apply-curve-standoff') {
      const targetId = conflict.affectedArtworkIds[0];
      if (targetId) {
        setArtworks((prev) =>
          prev.map((a) =>
            a.id === targetId
              ? {
                  ...a,
                  standoff: Number(
                    (a.standoff + a.autoCurveClearance).toFixed(3)
                  ),
                  autoCurveClearance: 0,
                }
              : a
          )
        );
      }
      setConflicts((prev) => prev.filter((c) => c.id !== conflict.id));
    }
  };

  // Restore a single artwork from the active ghost snapshot while keeping the current wall curve!
  const handleRestoreSingleArtworkFromGhost = (artId: string) => {
    if (!activeGhostSnapshot) return;
    const ghostArt = activeGhostSnapshot.artworks.find((a) => a.id === artId);
    if (!ghostArt) return;

    const restoredU = Math.max(
      ghostArt.width * 0.5 + 0.14,
      Math.min(
        spline.totalLength - ghostArt.width * 0.5 - 0.14,
        ghostArt.uNormAnchor * spline.totalLength
      )
    );

    const nextArts = updateClearances(
      artworks.map((a) =>
        a.id === artId
          ? {
              ...a,
              location: ghostArt.location,
              u: restoredU,
              uNormAnchor: ghostArt.uNormAnchor,
              h: ghostArt.h,
              standoff: ghostArt.standoff,
              pitchDeg: ghostArt.pitchDeg,
            }
          : a
      ),
      spline
    );
    setArtworks(nextArts);
    setLights(syncLights(lights, nextArts, spline));
  };

  // Revert completely to a previous snapshot
  const handleRevertToSnapshot = (snapshot: RevisionSnapshot) => {
    setWallPoints(snapshot.wallPoints.map((p) => ({ ...p })));
    setArtworks(snapshot.artworks.map((a) => ({ ...a })));
    setGapRelations(JSON.parse(JSON.stringify(snapshot.gapRelations)));
    setLights(snapshot.lights.map((l) => ({ ...l })));
    setEyeLevelDatum(snapshot.eyeLevelDatum);
    setConflicts([]);
    setShowGhostOverlay(false);
    setSnapshots((prev) => prev.slice(0, -1));
  };

  // Reset entire exhibition to initial curated state
  const handleResetExhibition = () => {
    const fresh = createInitialSceneState();
    setWallPoints(fresh.wallPoints);
    setActiveWallPreset('gentle-arc');
    setArtworks(fresh.artworks);
    setGapRelations(fresh.gapRelations);
    setLights(fresh.lights);
    setEyeLevelDatum(fresh.eyeLevelDatum);
    setConflicts([]);
    setSnapshots([]);
    setSelectedArtworkId('art-horizon-hero');
    setSelectedLightId(null);
    sceneManagerRef.current?.setCameraView('perspective');
  };

  // Guided one-click curatorial experiments so the user can test revisions immediately
  const handleRunCuratorialExperiment = (
    exp: 'serpentine-Test' | 'tight-compression' | 'salon-asymmetric'
  ) => {
    if (exp === 'serpentine-Test') {
      animateWallMorph(
        WALL_PRESETS['serpentine-s'].points,
        'Morphed Wall to Serpentine S-Curve',
        'serpentine-s'
      );
    } else if (exp === 'tight-compression') {
      // Lock current 0.45m gaps first, then shorten the wall into a compact alcove so the user sees the in-scene conflict resolution badge!
      const lockedMap: Record<string, { mode: GapMode; targetGap: number }> = {};
      for (const rel of pairwiseGaps) {
        lockedMap[rel.pairKey] = { mode: 'locked', targetGap: 0.55 };
      }
      stateRef.current.gapRelations = lockedMap;
      setGapRelations(lockedMap);

      const compactWallPoints: SplineControlPoint[] = [
        { id: 'cp-0', x: -2.25, z: 0.95 },
        { id: 'cp-1', x: -0.78, z: -0.35 },
        { id: 'cp-2', x: 0.78, z: -0.35 },
        { id: 'cp-3', x: 2.25, z: 0.95 },
      ];
      animateWallMorph(
        compactWallPoints,
        'Compressed Wall Under Locked Gaps',
        'custom'
      );
    } else if (exp === 'salon-asymmetric') {
      pushSnapshot('Hung 5th Work & Equalized');
      const rackWork = artworks.find((a) => a.location === 'rack');
      if (rackWork) {
        const nextArts = artworks.map((a) =>
          a.id === rackWork.id
            ? {
                ...a,
                location: 'wall' as const,
                u: spline.totalLength - 0.8,
                h: eyeLevelDatum + 0.14,
                standoff: 0.055,
              }
            : a
        );
        const sorted = getSortedWallArtworks(nextArts);
        const totalW = sorted.reduce((acc, item) => acc + item.width, 0);
        const gap = Math.max(
          0.2,
          (spline.totalLength - 0.8 - totalW) / Math.max(1, sorted.length - 1)
        );
        const span = totalW + gap * (sorted.length - 1);
        let cursor = (spline.totalLength - span) * 0.5;
        const posMap = new Map<string, number>();
        for (const item of sorted) {
          posMap.set(item.id, cursor + item.width * 0.5);
          cursor += item.width + gap;
        }
        const finalArts = updateClearances(
          nextArts.map((a) => {
            const u = posMap.get(a.id);
            return u !== undefined
              ? { ...a, u, uNormAnchor: u / spline.totalLength }
              : a;
          }),
          spline
        );
        setArtworks(finalArts);
        setLights(syncLights(lights, finalArts, spline));
        setSelectedArtworkId(rackWork.id);
      }
    }
  };

  return (
    <div className="biskiq-app-shell">
      {/* 3D WebGL Viewport */}
      <div ref={viewportRef} className="webgl-viewport" />

      {/* Top Floating Curatorial Bar & Guided Scenarios */}
      <TopCuratorialBar
        activeWallPreset={activeWallPreset}
        wallEditMode={wallEditMode}
        showLightBeams={showLightBeams}
        ambientPreset={ambientPreset}
        snapshots={snapshots}
        activeGhostSnapshot={activeGhostSnapshot}
        showGhostOverlay={showGhostOverlay}
        onSelectWallPreset={(pid) =>
          animateWallMorph(
            WALL_PRESETS[pid].points,
            `Reshaped Wall to ${WALL_PRESETS[pid].name}`,
            pid
          )
        }
        onToggleWallEditMode={() => setWallEditMode((v) => !v)}
        onToggleShowLightBeams={() => setShowLightBeams((v) => !v)}
        onSetAmbientPreset={setAmbientPreset}
        onSetCameraView={(view) => sceneManagerRef.current?.setCameraView(view)}
        onAddSpotlight={handleAddSpotlight}
        onToggleGhostOverlay={(explicit) =>
          setShowGhostOverlay((prev) =>
            explicit !== undefined ? explicit : !prev
          )
        }
        onRevertToSnapshot={handleRevertToSnapshot}
        onResetExhibition={handleResetExhibition}
        onRunCuratorialExperiment={handleRunCuratorialExperiment}
      />

      {/* Projected On-Surface Dimension Threads, Tokens, Light Halo & Conflict Cards */}
      <SurfaceOverlayHUD
        projection={hudProjection}
        artworks={artworks}
        lights={lights}
        selectedArtworkId={selectedArtworkId}
        selectedLightId={selectedLightId}
        wallEditMode={wallEditMode}
        showGhostOverlay={showGhostOverlay}
        onSelectArtwork={setSelectedArtworkId}
        onSelectLight={setSelectedLightId}
        onCycleGapMode={handleCycleGapMode}
        onSetExactGap={handleSetExactGap}
        onUpdateArtworkProps={handleUpdateArtworkProps}
        onMoveArtworkToRack={handleMoveArtworkToRack}
        onFocusLightOnArtwork={handleFocusLightOnArtwork}
        onUpdateLightProps={(lightId, patch) =>
          setLights((prev) =>
            prev.map((l) => (l.id === lightId ? { ...l, ...patch } : l))
          )
        }
        onStartLightTargetDrag={(lightId) =>
          sceneManagerRef.current?.startLightTargetDrag(lightId)
        }
        onResolveConflict={handleResolveConflict}
        onRestoreSingleArtworkFromGhost={handleRestoreSingleArtworkFromGhost}
      />

      {/* Bottom Synchronized Unfolded Surface Elevation Ribbon */}
      <ElevationRibbonBar
        spline={spline}
        artworks={artworks}
        lights={lights}
        gaps={pairwiseGaps}
        eyeLevelDatum={eyeLevelDatum}
        selectedArtworkId={selectedArtworkId}
        selectedLightId={selectedLightId}
        onSelectArtwork={setSelectedArtworkId}
        onSelectLight={setSelectedLightId}
        onDragArtworkFromRibbon={(artId, u, h, bypass) =>
          handleDragArtwork(artId, u, h, bypass, false)
        }
        onHangArtworkFromRack={handleHangArtworkFromRack}
        onCycleGapMode={handleCycleGapMode}
        onDistributeAllEqual={handleDistributeAllEqual}
        onLockAllGaps={handleLockAllGaps}
        onUpdateEyeLevel={handleUpdateEyeLevel}
        onFocusElevationCamera={() =>
          sceneManagerRef.current?.setCameraView('elevation')
        }
        onDragStart={(label) => pushSnapshot(label)}
        onDragEnd={() => setSnapGuides([])}
      />
    </div>
  );
};
export default App;
