import React, { useRef } from 'react';
import {
  ArrowUpRight,
  Equal,
  Eye,
  Layers,
  Lock,
  Maximize2,
  Sun,
  Unlock,
} from 'lucide-react';
import {
  ArtworkItem,
  GalleryLight,
  PairwiseGapRelation,
} from '../core/types';
import { WALL_HEIGHT, WallSplineEngine } from '../core/WallSplineEngine';

interface ElevationRibbonBarProps {
  spline: WallSplineEngine;
  artworks: ArtworkItem[];
  lights: GalleryLight[];
  gaps: PairwiseGapRelation[];
  eyeLevelDatum: number;
  selectedArtworkId: string | null;
  selectedLightId: string | null;
  onSelectArtwork: (id: string | null) => void;
  onSelectLight: (id: string | null) => void;
  onDragArtworkFromRibbon: (
    artId: string,
    desiredU: number,
    desiredH: number,
    bypassSnaps: boolean
  ) => void;
  onHangArtworkFromRack: (artId: string) => void;
  onCycleGapMode: (rel: PairwiseGapRelation) => void;
  onDistributeAllEqual: () => void;
  onLockAllGaps: () => void;
  onUpdateEyeLevel: (newEyeLevel: number) => void;
  onFocusElevationCamera: () => void;
  onDragStart: (label: string) => void;
  onDragEnd: () => void;
}

export const ElevationRibbonBar: React.FC<ElevationRibbonBarProps> = ({
  spline,
  artworks,
  lights,
  gaps,
  eyeLevelDatum,
  selectedArtworkId,
  selectedLightId,
  onSelectArtwork,
  onSelectLight,
  onDragArtworkFromRibbon,
  onHangArtworkFromRack,
  onCycleGapMode,
  onDistributeAllEqual,
  onLockAllGaps,
  onUpdateEyeLevel,
  onFocusElevationCamera,
  onDragStart,
  onDragEnd,
}) => {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const totalLen = spline.totalLength;

  const wallArtworks = artworks.filter((a) => a.location === 'wall');
  const rackArtworks = artworks.filter((a) => a.location === 'rack');

  const startRibbonArtDrag = (e: React.PointerEvent, art: ArtworkItem) => {
    e.stopPropagation();
    onSelectArtwork(art.id);
    onSelectLight(null);

    const strip = stripRef.current;
    if (!strip) return;
    const rect = strip.getBoundingClientRect();

    const pointerU = ((e.clientX - rect.left) / rect.width) * totalLen;
    const pointerH = (1 - (e.clientY - rect.top) / rect.height) * WALL_HEIGHT;
    const offsetU = art.u - pointerU;
    const offsetH = art.h - pointerH;

    onDragStart(`Adjusted "${art.title}" on Elevation Ribbon`);

    const onMove = (moveEvt: PointerEvent) => {
      const r = strip.getBoundingClientRect();
      const rawU = ((moveEvt.clientX - r.left) / r.width) * totalLen + offsetU;
      const rawH =
        (1 - (moveEvt.clientY - r.top) / r.height) * WALL_HEIGHT + offsetH;
      onDragArtworkFromRibbon(
        art.id,
        rawU,
        moveEvt.shiftKey ? art.h : rawH,
        moveEvt.altKey
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onDragEnd();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startEyeLevelDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    const strip = stripRef.current;
    if (!strip) return;
    onDragStart('Adjusted Gallery Eye-Level Datum');

    const onMove = (moveEvt: PointerEvent) => {
      const r = strip.getBoundingClientRect();
      const rawH = (1 - (moveEvt.clientY - r.top) / r.height) * WALL_HEIGHT;
      const clamped = Number(Math.max(1.05, Math.min(2.15, rawH)).toFixed(2));
      onUpdateEyeLevel(clamped);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onDragEnd();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Sample curvature bands for subtle visual indication of concave/convex bends
  const curvatureStops: string[] = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const s = spline.sampleAtU((i / steps) * totalLen);
    const pct = ((i / steps) * 100).toFixed(1);
    const k = s.curvature;
    // Concave = slightly warm deeper plaster, Convex = slightly brighter highlight
    const lightness = Math.round(21 + Math.max(-6, Math.min(6, -k * 16)));
    curvatureStops.push(`hsl(34, 10%, ${lightness}%) ${pct}%`);
  }

  return (
    <div className="elevation-ribbon-dock">
      <div className="ribbon-header">
        <div className="ribbon-title-group">
          <span className="ribbon-badge">UNFOLDED SURFACE RIBBON</span>
          <span className="ribbon-dims">
            True Arc Length <strong>{totalLen.toFixed(2)}m</strong> × Height{' '}
            <strong>{WALL_HEIGHT.toFixed(2)}m</strong>
          </span>
        </div>

        <div className="ribbon-quick-actions">
          <button
            className="ribbon-action-btn"
            title="Distribute all wall works with equal curatorial breathing room"
            onClick={onDistributeAllEqual}
          >
            <Equal size={12} />
            <span>Equalize Rhythm</span>
          </button>
          <button
            className="ribbon-action-btn"
            title="Lock all current meter gaps between neighboring frames"
            onClick={onLockAllGaps}
          >
            <Lock size={12} />
            <span>Lock All Gaps</span>
          </button>
          <button
            className="ribbon-action-btn"
            title="Align 3D camera head-on to the wall center"
            onClick={onFocusElevationCamera}
          >
            <Maximize2 size={12} />
            <span>Head-On 3D View</span>
          </button>
        </div>
      </div>

      <div className="ribbon-body">
        {/* True-Scale Unrolled Wall Canvas */}
        <div
          ref={stripRef}
          className="ribbon-wall-strip"
          style={{
            background: `linear-gradient(90deg, ${curvatureStops.join(', ')})`,
          }}
        >
          {/* Ruler Ticks along top edge (every 1m) */}
          {Array.from({ length: Math.floor(totalLen) + 1 }, (_, m) => (
            <div
              key={m}
              className="ribbon-meter-tick"
              style={{ left: `${(m / totalLen) * 100}%` }}
            >
              <span>{m}m</span>
            </div>
          ))}

          {/* Architectural Landmarks (Apex / Inflection / Center) */}
          {spline.landmarks
            .filter((lm) => lm.kind !== 'left-edge' && lm.kind !== 'right-edge')
            .map((lm) => (
              <div
                key={lm.id}
                className={`ribbon-landmark kind-${lm.kind}`}
                style={{ left: `${lm.uNorm * 100}%` }}
                title={`${lm.label} at u = ${lm.u.toFixed(2)}m`}
              >
                <span className="lm-tag">{lm.label}</span>
              </div>
            ))}

          {/* Draggable Eye-Level Datum Line */}
          <div
            className="ribbon-eye-level-line"
            style={{
              bottom: `${(eyeLevelDatum / WALL_HEIGHT) * 100}%`,
            }}
            title="Drag vertically to adjust Gallery Eye-Level Datum for all eye-level works"
            onPointerDown={startEyeLevelDrag}
          >
            <span className="eye-level-tag">
              <Eye size={10} /> Eye Level {eyeLevelDatum.toFixed(2)}m
            </span>
          </div>

          {/* Light Pools on Unfolded Wall */}
          {lights
            .filter((l) => l.enabled)
            .map((light) => {
              const leftPct = (light.targetU / totalLen) * 100;
              const botPct = (light.targetH / WALL_HEIGHT) * 100;
              const radiusPct = ((light.coneAngleDeg * 0.032) / totalLen) * 100;
              const isSel = selectedLightId === light.id;

              return (
                <div
                  key={light.id}
                  className={`ribbon-light-pool ${isSel ? 'selected' : ''}`}
                  style={{
                    left: `${leftPct}%`,
                    bottom: `${botPct}%`,
                    width: `${Math.max(7, radiusPct * 2)}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLight(light.id);
                    onSelectArtwork(null);
                  }}
                  title={`${light.name} (${light.kelvin}K)`}
                >
                  <Sun size={9} />
                </div>
              );
            })}

          {/* Gap Relation Bars on Unfolded Strip */}
          {gaps.map((rel) => {
            const leftArt = wallArtworks.find((a) => a.id === rel.leftArtId);
            const rightArt = wallArtworks.find((a) => a.id === rel.rightArtId);
            if (!leftArt || !rightArt) return null;

            const u0 = leftArt.u + leftArt.width * 0.5;
            const u1 = rightArt.u - rightArt.width * 0.5;
            const midU = (u0 + u1) * 0.5;
            const midH = (leftArt.h + rightArt.h) * 0.5;

            return (
              <button
                key={rel.pairKey}
                className={`ribbon-gap-pill mode-${rel.mode}`}
                style={{
                  left: `${(midU / totalLen) * 100}%`,
                  bottom: `${(midH / WALL_HEIGHT) * 100}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onCycleGapMode(rel);
                }}
                title="Click to cycle Free / Locked Gap / Equal Rhythm"
              >
                {rel.mode === 'locked' ? (
                  <Lock size={9} />
                ) : rel.mode === 'equal' ? (
                  <Equal size={9} />
                ) : (
                  <Unlock size={9} />
                )}
                <span>{rel.currentGap.toFixed(2)}m</span>
              </button>
            );
          })}

          {/* Hung Artworks on Unfolded Strip */}
          {wallArtworks.map((art) => {
            const wPct = (art.width / totalLen) * 100;
            const hPct = (art.height / WALL_HEIGHT) * 100;
            const leftPct = ((art.u - art.width * 0.5) / totalLen) * 100;
            const botPct = ((art.h - art.height * 0.5) / WALL_HEIGHT) * 100;
            const isSelected = selectedArtworkId === art.id;

            return (
              <div
                key={art.id}
                className={`ribbon-art-rect motif-${art.motif} ${
                  isSelected ? 'selected' : ''
                }`}
                style={{
                  left: `${leftPct}%`,
                  bottom: `${botPct}%`,
                  width: `${wPct}%`,
                  height: `${hPct}%`,
                }}
                onPointerDown={(e) => startRibbonArtDrag(e, art)}
                title={`${art.title} (${art.width}×${art.height}m) — Drag to slide along wall`}
              >
                <span className="ribbon-art-title">{art.title.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>

        {/* Floor Staging Rack Drawer on Right of Ribbon */}
        <div className="ribbon-staging-drawer">
          <div className="staging-drawer-title">
            <Layers size={11} />
            <span>Staging Rack ({rackArtworks.length})</span>
          </div>
          <div className="staging-items-row">
            {rackArtworks.length === 0 ? (
              <span className="staging-empty">All works hung on wall</span>
            ) : (
              rackArtworks.map((art) => (
                <button
                  key={art.id}
                  className="staging-art-chip"
                  onClick={() => onHangArtworkFromRack(art.id)}
                  title={`Click to hang "${art.title}" (${art.width}×${art.height}m) onto the wall`}
                >
                  <span className="chip-name">{art.title}</span>
                  <span className="chip-dims">
                    {art.width}×{art.height}m <ArrowUpRight size={10} />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
