import React, { useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  ArrowDownToLine,
  Check,
  Compass,
  Equal,
  Flame,
  Layers,
  Lock,
  MoveHorizontal,
  RotateCcw,
  Sparkles,
  Sun,
  Unlock,
} from 'lucide-react';
import {
  ArtworkItem,
  GalleryLight,
  GapMode,
  PairwiseGapRelation,
  SpatialConflict,
  WallAnchorMode,
} from '../core/types';
import { HudProjectionData } from '../scene/GallerySceneManager';

interface SurfaceOverlayHUDProps {
  projection: HudProjectionData | null;
  artworks: ArtworkItem[];
  lights: GalleryLight[];
  selectedArtworkId: string | null;
  selectedLightId: string | null;
  wallEditMode: boolean;
  showGhostOverlay: boolean;
  onSelectArtwork: (id: string | null) => void;
  onSelectLight: (id: string | null) => void;
  onCycleGapMode: (rel: PairwiseGapRelation) => void;
  onSetExactGap: (rel: PairwiseGapRelation, newGapMeters: number) => void;
  onUpdateArtworkProps: (artId: string, patch: Partial<ArtworkItem>) => void;
  onMoveArtworkToRack: (artId: string) => void;
  onFocusLightOnArtwork: (artId: string) => void;
  onUpdateLightProps: (lightId: string, patch: Partial<GalleryLight>) => void;
  onStartLightTargetDrag: (lightId: string) => void;
  onResolveConflict: (
    conflict: SpatialConflict,
    actionType: SpatialConflict['resolutions'][number]['actionType']
  ) => void;
  onRestoreSingleArtworkFromGhost: (artId: string) => void;
}

const ANCHOR_LABELS: Record<WallAnchorMode, { short: string; hint: string }> = {
  proportional: {
    short: 'Proportional Flow (%)',
    hint: 'Floats proportionally when wall stretches or bends',
  },
  'left-measure': {
    short: 'Fixed from Left Edge (m)',
    hint: 'Preserves exact meter distance from left wall end',
  },
  'right-measure': {
    short: 'Fixed from Right Edge (m)',
    hint: 'Preserves exact meter distance from right wall end',
  },
  'apex-pinned': {
    short: 'Pinned to Curve Apex',
    hint: 'Stays locked to the wall’s primary bend/inflection point',
  },
};

export const SurfaceOverlayHUD: React.FC<SurfaceOverlayHUDProps> = ({
  projection,
  artworks,
  lights,
  selectedArtworkId,
  selectedLightId,
  wallEditMode,
  showGhostOverlay,
  onSelectArtwork,
  onSelectLight,
  onCycleGapMode,
  onSetExactGap,
  onUpdateArtworkProps,
  onMoveArtworkToRack,
  onFocusLightOnArtwork,
  onUpdateLightProps,
  onStartLightTargetDrag,
  onResolveConflict,
  onRestoreSingleArtworkFromGhost,
}) => {
  const [editingGapKey, setEditingGapKey] = useState<string | null>(null);
  const [gapInputVal, setGapInputVal] = useState<string>('0.45');

  if (!projection) return null;

  const selectedArtwork = artworks.find((a) => a.id === selectedArtworkId) ?? null;
  const selectedArtProj = projection.artworks.find(
    (p) => p.id === selectedArtworkId
  );

  const selectedLight = lights.find((l) => l.id === selectedLightId) ?? null;
  const selectedLightProj = projection.lights.find(
    (l) => l.id === selectedLightId
  );

  const cycleAnchorMode = (art: ArtworkItem) => {
    const order: WallAnchorMode[] = [
      'proportional',
      'left-measure',
      'apex-pinned',
      'right-measure',
    ];
    const next = order[(order.indexOf(art.anchorMode) + 1) % order.length];
    onUpdateArtworkProps(art.id, { anchorMode: next });
  };

  // Start interactive drag for light cone spread or penumbra directly on the HUD halo
  const startHaloRimDrag = (
    e: React.PointerEvent,
    light: GalleryLight,
    mode: 'cone' | 'penumbra'
  ) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initCone = light.coneAngleDeg;
    const initPenumbra = light.penumbra;

    const onMove = (moveEvt: PointerEvent) => {
      const dx = moveEvt.clientX - startX;
      const dy = startY - moveEvt.clientY;
      if (mode === 'cone') {
        const nextCone = Math.round(
          Math.max(12, Math.min(52, initCone + dx * 0.18))
        );
        onUpdateLightProps(light.id, { coneAngleDeg: nextCone });
      } else {
        const nextPen = Number(
          Math.max(0.1, Math.min(0.95, initPenumbra + dy * 0.005)).toFixed(2)
        );
        onUpdateLightProps(light.id, { penumbra: nextPen });
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Start interactive horizontal scrubbing of a gap token
  const startGapScrub = (
    e: React.PointerEvent,
    rel: PairwiseGapRelation
  ) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initGap = rel.currentGap;
    let moved = false;

    const onMove = (moveEvt: PointerEvent) => {
      const dx = moveEvt.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      if (moved) {
        const nextGap = Number(
          Math.max(0.1, Math.min(2.2, initGap + dx * 0.004)).toFixed(2)
        );
        onSetExactGap(rel, nextGap);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!moved) {
        setEditingGapKey(rel.pairKey);
        setGapInputVal(rel.currentGap.toFixed(2));
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="surface-hud-layer">
      {/* 1. SVG Layer for Curved Dimension Threads & Light Halos */}
      <svg className="surface-hud-svg">
        <defs>
          <radialGradient id="lightHaloGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(245, 185, 99, 0.22)" />
            <stop offset="70%" stopColor="rgba(245, 185, 99, 0.06)" />
            <stop offset="100%" stopColor="rgba(245, 185, 99, 0)" />
          </radialGradient>
        </defs>

        {/* Curved Gap Dimension Threads */}
        {projection.gaps.map((g) => {
          if (g.polylineScreen.length < 2) return null;
          const dPath = g.polylineScreen
            .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
            .join(' ');

          const strokeColor =
            g.relation.mode === 'locked'
              ? '#f5a642'
              : g.relation.mode === 'equal'
              ? '#58d68d'
              : 'rgba(232, 224, 212, 0.48)';

          return (
            <g key={g.pairKey}>
              <path
                d={dPath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={g.relation.mode === 'free' ? 1.5 : 2.2}
                strokeDasharray={g.relation.mode === 'free' ? '4 4' : 'none'}
              />
              {g.leftEdge.visible && (
                <circle
                  cx={g.leftEdge.x}
                  cy={g.leftEdge.y}
                  r={3.5}
                  fill={strokeColor}
                />
              )}
              {g.rightEdge.visible && (
                <circle
                  cx={g.rightEdge.x}
                  cy={g.rightEdge.y}
                  r={3.5}
                  fill={strokeColor}
                />
              )}
            </g>
          );
        })}

        {/* Active Light Halo Ring on Wall Surface */}
        {selectedLight &&
          selectedLightProj &&
          selectedLightProj.targetCenter.visible && (() => {
            const cx = selectedLightProj.targetCenter.x;
            const cy = selectedLightProj.targetCenter.y;
            const rx = Math.max(
              42,
              Math.min(
                220,
                Math.hypot(
                  selectedLightProj.coneRimRight.x - cx,
                  selectedLightProj.coneRimRight.y - cy
                )
              )
            );
            const ry = Math.max(
              42,
              Math.min(
                220,
                Math.hypot(
                  selectedLightProj.penumbraRimTop.x - cx,
                  selectedLightProj.penumbraRimTop.y - cy
                )
              )
            );

            return (
              <g>
                {/* Outer feather / penumbra ring */}
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx * (1 + selectedLight.penumbra * 0.28)}
                  ry={ry * (1 + selectedLight.penumbra * 0.28)}
                  fill="url(#lightHaloGrad)"
                  stroke="rgba(245, 185, 99, 0.45)"
                  strokeWidth={1.2}
                  strokeDasharray="5 5"
                />
                {/* Inner core cone ring */}
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill="none"
                  stroke="#f5b963"
                  strokeWidth={2}
                />
                {/* Sightline to overhead track fixture */}
                {selectedLightProj.fixtureScreen.visible && (
                  <line
                    x1={selectedLightProj.fixtureScreen.x}
                    y1={selectedLightProj.fixtureScreen.y}
                    x2={cx}
                    y2={cy}
                    stroke="rgba(245, 185, 99, 0.55)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                )}
              </g>
            );
          })()}
      </svg>

      {/* 2. Clickable & Scrubbable On-Wall Gap Tokens */}
      {projection.gaps.map((g) => {
        if (!g.midpoint.visible) return null;
        const { relation } = g;
        const isEditing = editingGapKey === relation.pairKey;

        return (
          <div
            key={relation.pairKey}
            className={`hud-gap-token mode-${relation.mode}`}
            style={{
              left: `${g.midpoint.x}px`,
              top: `${g.midpoint.y}px`,
            }}
          >
            <button
              className="gap-mode-btn"
              title={
                relation.mode === 'free'
                  ? 'Free Gap — Click to Lock exact distance (🔒)'
                  : relation.mode === 'locked'
                  ? 'Locked Gap — Click to switch to Equal Rhythm (≋)'
                  : 'Equal Rhythm — Click to return to Free Gap'
              }
              onClick={(e) => {
                e.stopPropagation();
                onCycleGapMode(relation);
              }}
            >
              {relation.mode === 'locked' ? (
                <Lock size={11} />
              ) : relation.mode === 'equal' ? (
                <Equal size={12} />
              ) : (
                <Unlock size={11} />
              )}
            </button>

            {isEditing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const parsed = parseFloat(gapInputVal);
                  if (!isNaN(parsed) && parsed >= 0.08 && parsed <= 3.0) {
                    onSetExactGap(relation, parsed);
                  }
                  setEditingGapKey(null);
                }}
              >
                <input
                  type="number"
                  step="0.01"
                  min="0.08"
                  max="3.0"
                  autoFocus
                  className="gap-inline-input"
                  value={gapInputVal}
                  onChange={(e) => setGapInputVal(e.target.value)}
                  onBlur={() => {
                    const parsed = parseFloat(gapInputVal);
                    if (!isNaN(parsed) && parsed >= 0.08 && parsed <= 3.0) {
                      onSetExactGap(relation, parsed);
                    }
                    setEditingGapKey(null);
                  }}
                />
              </form>
            ) : (
              <span
                className="gap-value-label"
                title="Drag horizontally to scrub spacing, or click to type exact meters"
                onPointerDown={(e) => startGapScrub(e, relation)}
              >
                {relation.currentGap.toFixed(2)}m
              </span>
            )}
          </div>
        );
      })}

      {/* 3. Floor Spline Control Point Labels when reshaping or in Wall Mode */}
      {projection.controlPoints.map((cp) => {
        if (!cp.screen.visible) return null;
        return (
          <div
            key={cp.id}
            className={`hud-floor-node ${wallEditMode ? 'prominent' : ''}`}
            style={{
              left: `${cp.screen.x}px`,
              top: `${cp.screen.y + 18}px`,
            }}
          >
            <span>
              Curve Node {cp.index + 1} · ({cp.worldX.toFixed(1)}m,{' '}
              {cp.worldZ.toFixed(1)}m)
            </span>
          </div>
        );
      })}

      {/* 4. Floor Staging Rack Label */}
      {projection.rackScreen.visible && (
        <div
          className="hud-rack-badge"
          style={{
            left: `${projection.rackScreen.x}px`,
            top: `${projection.rackScreen.y}px`,
          }}
        >
          <Layers size={12} />
          <span>
            Floor Staging Rack (
            {artworks.filter((a) => a.location === 'rack').length} works)
          </span>
          <small>Drag onto wall to hang</small>
        </div>
      )}

      {/* 5. Subtle Light Target Badges on Wall (when light is not selected, lets you click any light pool) */}
      {projection.lights.map((lp) => {
        const light = lights.find((l) => l.id === lp.id);
        if (!light || !lp.targetCenter.visible) return null;
        const isSelected = selectedLightId === light.id;
        if (isSelected) return null;

        return (
          <button
            key={light.id}
            className={`hud-light-mini-pin ${!light.enabled ? 'off' : ''}`}
            style={{
              left: `${lp.targetCenter.x}px`,
              top: `${lp.targetCenter.y - 34}px`,
            }}
            title={`${light.name} (${light.kelvin}K · ${lp.incidenceDeg}° grazing) — Click to shape light`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectLight(light.id);
              onSelectArtwork(null);
            }}
          >
            <Sun size={11} />
          </button>
        );
      })}

      {/* 6. Selected Light Interactive Halo Handles & Contextual Popover */}
      {selectedLight &&
        selectedLightProj &&
        selectedLightProj.targetCenter.visible && (() => {
          const cx = selectedLightProj.targetCenter.x;
          const cy = selectedLightProj.targetCenter.y;
          const rx = Math.max(
            42,
            Math.min(
              220,
              Math.hypot(
                selectedLightProj.coneRimRight.x - cx,
                selectedLightProj.coneRimRight.y - cy
              )
            )
          );
          const ry = Math.max(
            42,
            Math.min(
              220,
              Math.hypot(
                selectedLightProj.penumbraRimTop.x - cx,
                selectedLightProj.penumbraRimTop.y - cy
              )
            )
          );

          const boundArtwork = artworks.find(
            (a) => a.id === selectedLight.targetArtworkId
          );

          return (
            <>
              {/* Center Target Drag Reticle */}
              <div
                className="light-halo-center-handle"
                style={{ left: `${cx}px`, top: `${cy}px` }}
                title="Drag to aim light pool across the wall or snap onto an artwork"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onStartLightTargetDrag(selectedLight.id);
                }}
              >
                <Sun size={14} />
              </div>

              {/* Right Rim Handle: Cone Spread Angle */}
              <div
                className="light-halo-rim-handle"
                style={{ left: `${cx + rx}px`, top: `${cy}px` }}
                title="Drag horizontally to widen or narrow Beam Cone Spread"
                onPointerDown={(e) => startHaloRimDrag(e, selectedLight, 'cone')}
              >
                <MoveHorizontal size={11} />
                <span>{selectedLight.coneAngleDeg}°</span>
              </div>

              {/* Top Rim Handle: Penumbra Feather Softness */}
              <div
                className="light-halo-rim-handle feather"
                style={{ left: `${cx}px`, top: `${cy - ry}px` }}
                title="Drag vertically to adjust Edge Feather / Penumbra"
                onPointerDown={(e) =>
                  startHaloRimDrag(e, selectedLight, 'penumbra')
                }
              >
                <Sparkles size={11} />
                <span>{Math.round(selectedLight.penumbra * 100)}% soft</span>
              </div>

              {/* Contextual Light Control Card */}
              <div
                className="hud-contextual-card light-card"
                style={{
                  left: `${Math.min(window.innerWidth - 310, Math.max(20, cx + rx + 26))}px`,
                  top: `${Math.max(76, Math.min(window.innerHeight - 260, cy - 80))}px`,
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="card-header">
                  <div className="card-title-row">
                    <Sun size={14} className="accent-amber" />
                    <strong>{selectedLight.name}</strong>
                  </div>
                  <span className="grazing-badge">
                    {selectedLightProj.incidenceDeg}° Grazing
                  </span>
                </div>

                {/* Target Binding Toggle */}
                <div className="card-row">
                  <button
                    className={`binding-pill ${
                      selectedLight.targetType === 'artwork' ? 'active' : ''
                    }`}
                    onClick={() => {
                      if (selectedLight.targetType === 'artwork') {
                        onUpdateLightProps(selectedLight.id, {
                          targetType: 'wall-point',
                        });
                      } else {
                        // Bind to nearest wall artwork
                        const nearest = artworks
                          .filter((a) => a.location === 'wall')
                          .sort(
                            (a, b) =>
                              Math.abs(a.u - selectedLight.targetU) -
                              Math.abs(b.u - selectedLight.targetU)
                          )[0];
                        if (nearest) {
                          onUpdateLightProps(selectedLight.id, {
                            targetType: 'artwork',
                            targetArtworkId: nearest.id,
                            artworkOffsetU: 0,
                            artworkOffsetH: 0.02,
                            targetU: nearest.u,
                            targetH: nearest.h + 0.02,
                          });
                        }
                      }
                    }}
                  >
                    <Anchor size={12} />
                    {selectedLight.targetType === 'artwork' && boundArtwork
                      ? `Tracks "${boundArtwork.title}"`
                      : 'Pinned to Wall Zone (Free)'}
                  </button>
                </div>

                {/* Sliders for Warmth (Kelvin), Intensity, and Track Angle Offset */}
                <div className="card-sliders">
                  <label>
                    <span>
                      <Flame size={11} /> Warmth
                    </span>
                    <input
                      type="range"
                      min={2700}
                      max={5400}
                      step={50}
                      value={selectedLight.kelvin}
                      onChange={(e) =>
                        onUpdateLightProps(selectedLight.id, {
                          kelvin: Number(e.target.value),
                        })
                      }
                    />
                    <span className="mono-val">{selectedLight.kelvin}K</span>
                  </label>

                  <label>
                    <span>Intensity</span>
                    <input
                      type="range"
                      min={0.4}
                      max={3.8}
                      step={0.05}
                      value={selectedLight.intensity}
                      onChange={(e) =>
                        onUpdateLightProps(selectedLight.id, {
                          intensity: Number(e.target.value),
                        })
                      }
                    />
                    <span className="mono-val">
                      {Math.round(selectedLight.intensity * 100)}%
                    </span>
                  </label>

                  <label>
                    <span>Track Lateral</span>
                    <input
                      type="range"
                      min={-1.2}
                      max={1.2}
                      step={0.02}
                      value={selectedLight.trackOffsetU}
                      onChange={(e) =>
                        onUpdateLightProps(selectedLight.id, {
                          trackOffsetU: Number(e.target.value),
                        })
                      }
                    />
                    <span className="mono-val">
                      {selectedLight.trackOffsetU >= 0 ? '+' : ''}
                      {selectedLight.trackOffsetU.toFixed(2)}m
                    </span>
                  </label>
                </div>
              </div>
            </>
          );
        })()}

      {/* 7. Selected Artwork Contextual Halo Bar */}
      {selectedArtwork &&
        !selectedLight &&
        !showGhostOverlay &&
        selectedArtwork.location === 'wall' &&
        selectedArtProj &&
        selectedArtProj.topCenter.visible && (
          <div
            className="hud-contextual-card artwork-card"
            style={{
              left: `${Math.min(
                window.innerWidth - 360,
                Math.max(20, selectedArtProj.topCenter.x - 165)
              )}px`,
              top: `${Math.max(
                68,
                selectedArtProj.topCenter.y - 118
              )}px`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <div>
                <strong>{selectedArtwork.title}</strong>
                <span className="card-sub">
                  {selectedArtwork.width.toFixed(2)} ×{' '}
                  {selectedArtwork.height.toFixed(2)}m · Arc u={' '}
                  {selectedArtwork.u.toFixed(2)}m · Elev h={' '}
                  {selectedArtwork.h.toFixed(2)}m
                </span>
              </div>
            </div>

            <div className="art-controls-grid">
              {/* Wall Reshape Anchor Behavior */}
              <button
                className="contextual-pill-btn"
                title={ANCHOR_LABELS[selectedArtwork.anchorMode].hint}
                onClick={() => cycleAnchorMode(selectedArtwork)}
              >
                <Compass size={12} className="accent-amber" />
                <span>{ANCHOR_LABELS[selectedArtwork.anchorMode].short}</span>
              </button>

              {/* Deliberate Surface Standoff Depth */}
              <button
                className="contextual-pill-btn"
                title="Cycle deliberate frame standoff depth from the wall surface (Flush / Floating Pin / Cantilever)"
                onClick={() => {
                  const depths = [0.015, 0.055, 0.12];
                  const nextIdx =
                    (depths.findIndex(
                      (d) => Math.abs(d - selectedArtwork.standoff) < 0.015
                    ) +
                      1) %
                    depths.length;
                  onUpdateArtworkProps(selectedArtwork.id, {
                    standoff: depths[nextIdx],
                  });
                }}
              >
                <span>
                  Offset:{' '}
                  {(
                    (selectedArtwork.standoff +
                      selectedArtwork.autoCurveClearance) *
                    100
                  ).toFixed(1)}
                  cm
                </span>
              </button>

              {/* Deliberate Salon Pitch Tilt */}
              <button
                className="contextual-pill-btn"
                title="Cycle deliberate downward viewing tilt angle"
                onClick={() => {
                  const pitches = [0, -3, -6];
                  const nextIdx =
                    (pitches.indexOf(selectedArtwork.pitchDeg) + 1) %
                    pitches.length;
                  onUpdateArtworkProps(selectedArtwork.id, {
                    pitchDeg: pitches[nextIdx],
                  });
                }}
              >
                <span>Tilt: {selectedArtwork.pitchDeg}°</span>
              </button>

              {/* Illuminate / Focus Light */}
              <button
                className="contextual-pill-btn highlight"
                title="Aim or inspect the spotlight illuminating this artwork"
                onClick={() => onFocusLightOnArtwork(selectedArtwork.id)}
              >
                <Sun size={12} />
                <span>Shape Light</span>
              </button>

              {/* Rest on Floor Staging Rack */}
              <button
                className="contextual-pill-btn subtle"
                title="Take down from wall and lean on the 3D Floor Staging Rack"
                onClick={() => onMoveArtworkToRack(selectedArtwork.id)}
              >
                <ArrowDownToLine size={12} />
                <span>To Floor Rack</span>
              </button>
            </div>
          </div>
        )}

      {/* 8. In-Scene Spatial Conflict Badges (with One-Click Resolutions) */}
      {projection.conflicts.map(({ conflict, screen }) => {
        if (!screen.visible) return null;
        return (
          <div
            key={conflict.id}
            className="hud-conflict-card"
            style={{
              left: `${Math.min(
                window.innerWidth - 320,
                Math.max(20, screen.x - 140)
              )}px`,
              top: `${Math.max(80, screen.y - 40)}px`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="conflict-header">
              <AlertTriangle size={14} className="conflict-icon" />
              <strong>{conflict.title}</strong>
            </div>
            <p className="conflict-desc">{conflict.description}</p>
            <div className="conflict-actions">
              {conflict.resolutions.map((res) => (
                <button
                  key={res.id}
                  className="conflict-res-btn"
                  onClick={() => onResolveConflict(conflict, res.actionType)}
                >
                  <Check size={11} />
                  <span>{res.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* 9. Ghost Comparison Per-Artwork Selective Restore Pills */}
      {showGhostOverlay &&
        projection.ghostArtworks.map((ghost) => {
          if (!ghost.screen.visible || ghost.movedDistance < 0.05) return null;
          return (
            <button
              key={ghost.id}
              className="hud-ghost-restore-pill"
              style={{
                left: `${ghost.screen.x}px`,
                top: `${ghost.screen.y}px`,
              }}
              title="Keep current wall shape, but restore this artwork's previous relative placement"
              onClick={(e) => {
                e.stopPropagation();
                onRestoreSingleArtworkFromGhost(ghost.id);
              }}
            >
              <RotateCcw size={11} />
              <span>
                Restore "{ghost.title}" (Δ{ghost.movedDistance.toFixed(2)}m)
              </span>
            </button>
          );
        })}
    </div>
  );
};
