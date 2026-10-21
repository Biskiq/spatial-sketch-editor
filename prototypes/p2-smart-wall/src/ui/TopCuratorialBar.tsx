import React, { useState } from 'react';
import {
  Camera,
  ChevronDown,
  Compass,
  Eye,
  HelpCircle,
  History,
  Lightbulb,
  Plus,
  RotateCcw,
  Sparkles,
  Spline,
  Sun,
  Wand2,
} from 'lucide-react';
import {
  AmbientPreset,
  RevisionSnapshot,
  WallPresetId,
} from '../core/types';
import { WALL_PRESETS } from '../core/WallSplineEngine';

interface TopCuratorialBarProps {
  activeWallPreset: WallPresetId | 'custom';
  wallEditMode: boolean;
  showLightBeams: boolean;
  ambientPreset: AmbientPreset;
  snapshots: RevisionSnapshot[];
  activeGhostSnapshot: RevisionSnapshot | null;
  showGhostOverlay: boolean;
  onSelectWallPreset: (presetId: WallPresetId) => void;
  onToggleWallEditMode: () => void;
  onToggleShowLightBeams: () => void;
  onSetAmbientPreset: (preset: AmbientPreset) => void;
  onSetCameraView: (
    view: 'perspective' | 'elevation' | 'plan' | 'rack' | 'focus-selected'
  ) => void;
  onAddSpotlight: () => void;
  onToggleGhostOverlay: (show?: boolean) => void;
  onRevertToSnapshot: (snapshot: RevisionSnapshot) => void;
  onResetExhibition: () => void;
  onRunCuratorialExperiment: (
    exp: 'serpentine-Test' | 'tight-compression' | 'salon-asymmetric'
  ) => void;
}

export const TopCuratorialBar: React.FC<TopCuratorialBarProps> = ({
  activeWallPreset,
  wallEditMode,
  showLightBeams,
  ambientPreset,
  snapshots,
  activeGhostSnapshot,
  showGhostOverlay,
  onSelectWallPreset,
  onToggleWallEditMode,
  onToggleShowLightBeams,
  onSetAmbientPreset,
  onSetCameraView,
  onAddSpotlight,
  onToggleGhostOverlay,
  onRevertToSnapshot,
  onResetExhibition,
  onRunCuratorialExperiment,
}) => {
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [showGuideDrawer, setShowGuideDrawer] = useState(true);

  return (
    <>
      <header className="top-curatorial-bar">
        {/* Left: Brand & Exhibition Title */}
        <div className="brand-cluster">
          <div className="brand-mark">B</div>
          <div className="brand-text">
            <span className="brand-name">Biskiq</span>
            <span className="brand-sub">Adaptive Spatial Composition</span>
          </div>
        </div>

        {/* Center: Primary Spatial Controls (Wall Architecture, Lighting, Camera) */}
        <div className="center-tool-cluster">
          {/* Wall Architecture Selector */}
          <div className="dropdown-wrapper">
            <button
              className={`tool-pill ${wallEditMode ? 'active' : ''}`}
              onClick={() => setShowPresetsMenu((v) => !v)}
            >
              <Spline size={14} className="accent-amber" />
              <span>
                Wall:{' '}
                {activeWallPreset === 'custom'
                  ? 'Custom Reshaped Curve'
                  : WALL_PRESETS[activeWallPreset].name}
              </span>
              <ChevronDown size={13} />
            </button>

            {showPresetsMenu && (
              <div
                className="floating-menu"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="menu-section-label">
                  Reshape Wall Architecture (Preserves Relations)
                </div>
                {(Object.keys(WALL_PRESETS) as WallPresetId[]).map((pid) => {
                  const p = WALL_PRESETS[pid];
                  return (
                    <button
                      key={pid}
                      className={`menu-item ${
                        activeWallPreset === pid ? 'selected' : ''
                      }`}
                      onClick={() => {
                        onSelectWallPreset(pid);
                        setShowPresetsMenu(false);
                      }}
                    >
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.subtitle}</small>
                      </div>
                    </button>
                  );
                })}
                <div className="menu-divider" />
                <button
                  className={`menu-item highlight ${
                    wallEditMode ? 'selected' : ''
                  }`}
                  onClick={() => {
                    onToggleWallEditMode();
                    setShowPresetsMenu(false);
                  }}
                >
                  <div>
                    <strong>
                      {wallEditMode
                        ? '✓ Floor Spline Handles Emphasized'
                        : 'Emphasize 3D Floor Curve Handles'}
                    </strong>
                    <small>
                      Drag the 4 brass floor nodes in 3D to sculpt any curve
                    </small>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            className={`tool-pill ${wallEditMode ? 'active' : ''}`}
            onClick={onToggleWallEditMode}
            title="Highlight the 4 floor spline control handles to bend or stretch the wall in 3D"
          >
            <Compass size={14} />
            <span>Sculpt Wall</span>
          </button>

          <div className="pill-divider" />

          {/* Lighting Controls */}
          <button
            className={`tool-pill ${showLightBeams ? 'active' : ''}`}
            onClick={onToggleShowLightBeams}
            title="Toggle subtle volumetric spotlight cones in 3D space"
          >
            <Lightbulb size={14} />
            <span>Light Cones</span>
          </button>

          <button
            className="tool-pill"
            onClick={onAddSpotlight}
            title="Add a new adjustable spotlight on the overhead curved track"
          >
            <Plus size={14} />
            <span>Add Spot</span>
          </button>

          {/* Ambient Atmosphere Cycle */}
          <button
            className="tool-pill"
            onClick={() => {
              const order: AmbientPreset[] = [
                'opening-night',
                'dramatic-nocturne',
                'daylight-museum',
              ];
              const next =
                order[(order.indexOf(ambientPreset) + 1) % order.length];
              onSetAmbientPreset(next);
            }}
            title="Cycle gallery ambient lighting atmosphere"
          >
            <Sun size={14} />
            <span>
              {ambientPreset === 'opening-night'
                ? 'Warm Reception'
                : ambientPreset === 'dramatic-nocturne'
                ? 'Nocturne'
                : 'Daylight'}
            </span>
          </button>

          <div className="pill-divider" />

          {/* Camera Views */}
          <div className="camera-pills-group">
            <button
              className="cam-btn"
              onClick={() => onSetCameraView('perspective')}
              title="3/4 Curator Perspective"
            >
              <Camera size={13} />
              <span>3/4</span>
            </button>
            <button
              className="cam-btn"
              onClick={() => onSetCameraView('elevation')}
              title="Front Elevation View"
            >
              <span>Front</span>
            </button>
            <button
              className="cam-btn"
              onClick={() => onSetCameraView('plan')}
              title="Overhead Floor Plan View (Ideal for sculpting wall curve)"
            >
              <span>Plan</span>
            </button>
            <button
              className="cam-btn"
              onClick={() => onSetCameraView('rack')}
              title="Focus Floor Staging Rack"
            >
              <span>Rack</span>
            </button>
          </div>
        </div>

        {/* Right: Revision Memory / Before & After Compare + Guided Scenarios */}
        <div className="right-revision-cluster">
          {activeGhostSnapshot && (
            <div className="revision-pill-group">
              <button
                className={`tool-pill compare-btn ${
                  showGhostOverlay ? 'active' : ''
                }`}
                onClick={() => onToggleGhostOverlay()}
                title="Click to toggle (or hold Space) to overlay the previous wall curve and artwork placements in 3D"
              >
                <Eye size={14} />
                <span>Compare Before/After (Space)</span>
              </button>

              <button
                className="tool-pill undo-btn"
                onClick={() => onRevertToSnapshot(activeGhostSnapshot)}
                title={`Revert to "${activeGhostSnapshot.label}"`}
              >
                <RotateCcw size={13} />
                <span>Undo</span>
              </button>
            </div>
          )}

          <button
            className={`tool-pill guide-toggle ${showGuideDrawer ? 'active' : ''}`}
            onClick={() => setShowGuideDrawer((v) => !v)}
            title="Toggle Interactive Curatorial Guide"
          >
            <HelpCircle size={14} />
            <span>Guide</span>
          </button>
        </div>
      </header>

      {/* Dismissible Curatorial Interactive Prompt Card */}
      {showGuideDrawer && (
        <aside className="curatorial-guide-card">
          <div className="guide-card-header">
            <div className="guide-title">
              <Sparkles size={14} className="accent-amber" />
              <span>The Creative Journey: Try Changing Your Mind</span>
            </div>
            <button
              className="guide-close"
              onClick={() => setShowGuideDrawer(false)}
            >
              ×
            </button>
          </div>

          <ul className="guide-steps-list">
            <li>
              <strong>1. Glide & Swap on the Surface:</strong> Drag any painting
              in 3D (or on the bottom <em>Unfolded Ribbon</em>). Drag one painting
              across another to feel magnetic <strong>Sequence Swap</strong>. Hold{' '}
              <code>Alt</code> for freeform salon offsets.
            </li>
            <li>
              <strong>2. Tangible Relational Threads:</strong> Click any{' '}
              <code>0.45m</code> token between frames to cycle{' '}
              <strong>Locked Gap (🔒)</strong>, <strong>Equal Rhythm (≋)</strong>,
              or <strong>Free (○)</strong>—or drag the number to scrub spacing!
            </li>
            <li>
              <strong>3. Reshape the Wall:</strong> Drag the{' '}
              <strong>4 brass floor handles</strong> in 3D (or try a preset below).
              Watch artworks and their <strong>bound spotlights</strong> flow along
              the new curve while preserving your curatorial rules.
            </li>
            <li>
              <strong>4. Compare & Selectively Restore:</strong> Hold{' '}
              <code>Space</code> to see the translucent 3D ghost of your previous
              arrangement and restore individual paintings.
            </li>
          </ul>

          <div className="guide-experiments">
            <span className="exp-label">
              <Wand2 size={11} /> One-Click Revision Scenarios:
            </span>
            <div className="exp-buttons">
              <button
                onClick={() => onRunCuratorialExperiment('serpentine-Test')}
              >
                Bend into S-Curve
              </button>
              <button
                onClick={() => onRunCuratorialExperiment('tight-compression')}
              >
                Test Wall Squeeze Conflict
              </button>
              <button
                onClick={() => onRunCuratorialExperiment('salon-asymmetric')}
              >
                Hang 5th Work from Rack
              </button>
              <button className="subtle" onClick={onResetExhibition}>
                Reset Vignette
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Subtle Bottom-Left Status & Keyboard Hint Pill */}
      {snapshots.length > 0 && (
        <div className="revision-toast-indicator">
          <History size={12} className="accent-amber" />
          <span>
            Last change: <strong>{snapshots[snapshots.length - 1].label}</strong>
          </span>
          <span className="kbd-hint">Hold Space to Compare</span>
        </div>
      )}
    </>
  );
};
