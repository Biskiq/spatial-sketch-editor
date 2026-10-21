import {
  ArtworkItem,
  GalleryLight,
  GapMode,
  PairwiseGapRelation,
  SnapGuide,
  SpatialConflict,
} from './types';
import { WALL_HEIGHT, WallSplineEngine } from './WallSplineEngine';

export function makePairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}__${idB}` : `${idB}__${idA}`;
}

/**
 * Returns wall artworks sorted from left to right along arc coordinate u.
 */
export function getSortedWallArtworks(artworks: ArtworkItem[]): ArtworkItem[] {
  return artworks
    .filter((a) => a.location === 'wall')
    .slice()
    .sort((a, b) => a.u - b.u);
}

/**
 * Computes active pairwise gap relations between adjacent artworks on the wall.
 */
export function computePairwiseGaps(
  artworks: ArtworkItem[],
  gapStateMap: Record<string, { mode: GapMode; targetGap: number }>
): PairwiseGapRelation[] {
  const sorted = getSortedWallArtworks(artworks);
  const relations: PairwiseGapRelation[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const left = sorted[i];
    const right = sorted[i + 1];
    const pairKey = makePairKey(left.id, right.id);
    const leftRightEdge = left.u + left.width * 0.5;
    const rightLeftEdge = right.u - right.width * 0.5;
    const currentGap = rightLeftEdge - leftRightEdge;

    const saved = gapStateMap[pairKey];
    const mode: GapMode = saved ? saved.mode : 'free';
    const targetGap = saved ? saved.targetGap : Math.max(0.1, currentGap);

    relations.push({
      pairKey,
      leftArtId: left.id,
      rightArtId: right.id,
      mode,
      targetGap,
      currentGap,
    });
  }

  return relations;
}

/**
 * Enforces equal-rhythm groups and locked gaps starting from current artwork positions.
 */
export function enforceRelationalConstraints(
  artworks: ArtworkItem[],
  gapStateMap: Record<string, { mode: GapMode; targetGap: number }>,
  spline: WallSplineEngine,
  anchorArtId?: string
): ArtworkItem[] {
  const result = artworks.map((a) => ({ ...a }));
  const sorted = getSortedWallArtworks(result);
  if (sorted.length < 2) {
    return updateClearances(result, spline);
  }

  // 1. Handle contiguous 'equal' runs
  let i = 0;
  while (i < sorted.length - 1) {
    const key = makePairKey(sorted[i].id, sorted[i + 1].id);
    if (gapStateMap[key]?.mode === 'equal') {
      let endIdx = i + 1;
      while (endIdx < sorted.length - 1) {
        const nextKey = makePairKey(sorted[endIdx].id, sorted[endIdx + 1].id);
        if (gapStateMap[nextKey]?.mode === 'equal') {
          endIdx++;
        } else {
          break;
        }
      }

      // If only a single pair is marked 'equal' and there are 3+ artworks, we still equalize
      // or if it's a run from i..endIdx:
      const group = sorted.slice(i, endIdx + 1);
      if (group.length >= 3) {
        const leftOuter = group[0].u - group[0].width * 0.5;
        const rightOuter = group[group.length - 1].u + group[group.length - 1].width * 0.5;
        const totalSpan = rightOuter - leftOuter;
        const totalArtWidth = group.reduce((acc, item) => acc + item.width, 0);
        const equalGap = Math.max(0.08, (totalSpan - totalArtWidth) / (group.length - 1));

        let cursor = leftOuter;
        for (let k = 0; k < group.length; k++) {
          group[k].u = cursor + group[k].width * 0.5;
          group[k].uNormAnchor = group[k].u / spline.totalLength;
          cursor += group[k].width + equalGap;
          if (k < group.length - 1) {
            const pk = makePairKey(group[k].id, group[k + 1].id);
            gapStateMap[pk] = { mode: 'equal', targetGap: equalGap };
          }
        }
      } else if (group.length === 2) {
        // 2-item equal mode: keep targetGap or center symmetrically
        const pk = makePairKey(group[0].id, group[1].id);
        const targetGap = gapStateMap[pk]?.targetGap ?? 0.42;
        const mid = (group[0].u - group[0].width * 0.5 + (group[1].u + group[1].width * 0.5)) * 0.5;
        const totalW = group[0].width + group[1].width + targetGap;
        group[0].u = mid - totalW * 0.5 + group[0].width * 0.5;
        group[1].u = mid + totalW * 0.5 - group[1].width * 0.5;
      }

      i = endIdx + 1;
    } else {
      i++;
    }
  }

  // 2. Handle 'locked' gap propagation outward from anchorArtId (or cluster center)
  const pivotIdx = anchorArtId
    ? Math.max(
        0,
        sorted.findIndex((a) => a.id === anchorArtId)
      )
    : Math.floor(sorted.length / 2);

  // Propagate right from pivotIdx
  for (let r = pivotIdx; r < sorted.length - 1; r++) {
    const left = sorted[r];
    const right = sorted[r + 1];
    const key = makePairKey(left.id, right.id);
    const rel = gapStateMap[key];
    if (rel && rel.mode === 'locked') {
      right.u = left.u + left.width * 0.5 + rel.targetGap + right.width * 0.5;
      right.uNormAnchor = right.u / spline.totalLength;
    }
  }

  // Propagate left from pivotIdx
  for (let l = pivotIdx; l > 0; l--) {
    const right = sorted[l];
    const left = sorted[l - 1];
    const key = makePairKey(left.id, right.id);
    const rel = gapStateMap[key];
    if (rel && rel.mode === 'locked') {
      left.u = right.u - right.width * 0.5 - rel.targetGap - left.width * 0.5;
      left.uNormAnchor = left.u / spline.totalLength;
    }
  }

  return updateClearances(result, spline);
}

export function updateClearances(
  artworks: ArtworkItem[],
  spline: WallSplineEngine
): ArtworkItem[] {
  return artworks.map((art) => {
    if (art.location !== 'wall') {
      return { ...art, autoCurveClearance: 0 };
    }
    const clearance = spline.computeConcaveClearance(art.u, art.width);
    return {
      ...art,
      autoCurveClearance: clearance,
    };
  });
}

/**
 * Solves interactive dragging of an artwork on the curved wall, including:
 * - Eye-level and neighbor edge snapping
 * - Wall landmark and equal-gap magnetic snapping
 * - Magnetic sequence swap & ripple when crossing a neighbor
 * - Coupled locked/equal gap propagation
 */
export function solveArtworkDrag(params: {
  artworks: ArtworkItem[];
  activeArtId: string;
  desiredU: number;
  desiredH: number;
  spline: WallSplineEngine;
  eyeLevelDatum: number;
  gapStateMap: Record<string, { mode: GapMode; targetGap: number }>;
  bypassSnaps: boolean;
}): {
  artworks: ArtworkItem[];
  guides: SnapGuide[];
  swappedWithId?: string;
} {
  const {
    artworks,
    activeArtId,
    desiredU,
    desiredH,
    spline,
    eyeLevelDatum,
    gapStateMap,
    bypassSnaps,
  } = params;

  const nextArtworks = artworks.map((a) => ({ ...a }));
  const active = nextArtworks.find((a) => a.id === activeArtId);
  if (!active) {
    return { artworks: nextArtworks, guides: [] };
  }

  active.location = 'wall';
  const guides: SnapGuide[] = [];
  const wallLen = spline.totalLength;

  // Clamp within wall boundaries with 12cm margin
  const minU = active.width * 0.5 + 0.12;
  const maxU = Math.max(minU, wallLen - active.width * 0.5 - 0.12);
  let targetU = Math.max(minU, Math.min(maxU, desiredU));
  let targetH = Math.max(
    active.height * 0.5 + 0.28,
    Math.min(WALL_HEIGHT - active.height * 0.5 - 0.22, desiredH)
  );

  const others = nextArtworks
    .filter((a) => a.location === 'wall' && a.id !== activeArtId)
    .sort((a, b) => a.u - b.u);

  if (!bypassSnaps) {
    // 1. Vertical Snapping: Eye-level datum & neighbor top/center/bottom edges
    const SNAP_H = 0.055;
    if (Math.abs(targetH - eyeLevelDatum) < SNAP_H) {
      targetH = eyeLevelDatum;
      active.verticalMode = 'eye-level';
      guides.push({
        id: 'snap-eye-level',
        type: 'eye-level',
        label: `Eye Level ${eyeLevelDatum.toFixed(2)}m`,
        uStart: 0.15,
        uEnd: wallLen - 0.15,
        h: eyeLevelDatum,
      });
    } else {
      active.verticalMode = 'free';
      for (const other of others) {
        // Center alignment
        if (Math.abs(targetH - other.h) < SNAP_H) {
          targetH = other.h;
          guides.push({
            id: `snap-h-center-${other.id}`,
            type: 'horizontal-align',
            label: `Center Align ${targetH.toFixed(2)}m`,
            uStart: Math.min(targetU, other.u) - 0.4,
            uEnd: Math.max(targetU, other.u) + 0.4,
            h: targetH,
          });
          break;
        }
        // Top edge alignment
        const activeTop = targetH + active.height * 0.5;
        const otherTop = other.h + other.height * 0.5;
        if (Math.abs(activeTop - otherTop) < SNAP_H) {
          targetH = otherTop - active.height * 0.5;
          active.verticalMode = 'top-linked';
          guides.push({
            id: `snap-h-top-${other.id}`,
            type: 'horizontal-align',
            label: `Top Edge ${otherTop.toFixed(2)}m`,
            uStart: Math.min(targetU - active.width * 0.5, other.u - other.width * 0.5),
            uEnd: Math.max(targetU + active.width * 0.5, other.u + other.width * 0.5),
            h: otherTop,
          });
          break;
        }
        // Bottom edge alignment
        const activeBottom = targetH - active.height * 0.5;
        const otherBottom = other.h - other.height * 0.5;
        if (Math.abs(activeBottom - otherBottom) < SNAP_H) {
          targetH = otherBottom + active.height * 0.5;
          active.verticalMode = 'bottom-linked';
          guides.push({
            id: `snap-h-bot-${other.id}`,
            type: 'horizontal-align',
            label: `Base Line ${otherBottom.toFixed(2)}m`,
            uStart: Math.min(targetU - active.width * 0.5, other.u - other.width * 0.5),
            uEnd: Math.max(targetU + active.width * 0.5, other.u + other.width * 0.5),
            h: otherBottom,
          });
          break;
        }
      }
    }

    // 2. Horizontal Landmark Snapping (Wall Center, Curve Apex, Inflection)
    const SNAP_U = 0.075;
    for (const lm of spline.landmarks) {
      if (lm.kind === 'left-edge' || lm.kind === 'right-edge') continue;
      if (Math.abs(targetU - lm.u) < SNAP_U) {
        targetU = lm.u;
        guides.push({
          id: `snap-lm-${lm.id}`,
          type: 'landmark',
          label: lm.label,
          uStart: lm.u,
          uEnd: lm.u,
          h: targetH,
          isVertical: true,
          hStart: 0.2,
          hEnd: WALL_HEIGHT - 0.2,
        });
        break;
      }
    }

    // 3. Equal-Spacing Magnetic Snap with Adjacent Neighbors
    // Check if there is an existing gap rhythm to snap to
    for (let i = 0; i < others.length - 1; i++) {
      const a = others[i];
      const b = others[i + 1];
      const existingGap = b.u - b.width * 0.5 - (a.u + a.width * 0.5);
      if (existingGap > 0.08 && existingGap < 2.5) {
        // Snap to right of b with same gap
        const candidateRight = b.u + b.width * 0.5 + existingGap + active.width * 0.5;
        if (Math.abs(targetU - candidateRight) < SNAP_U && candidateRight <= maxU) {
          targetU = candidateRight;
          guides.push({
            id: `snap-eq-right-${b.id}`,
            type: 'equal-gap',
            label: `Equal Rhythm ${existingGap.toFixed(2)}m`,
            uStart: b.u + b.width * 0.5,
            uEnd: targetU - active.width * 0.5,
            h: targetH,
          });
          break;
        }
        // Snap to left of a with same gap
        const candidateLeft = a.u - a.width * 0.5 - existingGap - active.width * 0.5;
        if (Math.abs(targetU - candidateLeft) < SNAP_U && candidateLeft >= minU) {
          targetU = candidateLeft;
          guides.push({
            id: `snap-eq-left-${a.id}`,
            type: 'equal-gap',
            label: `Equal Rhythm ${existingGap.toFixed(2)}m`,
            uStart: targetU + active.width * 0.5,
            uEnd: a.u - a.width * 0.5,
            h: targetH,
          });
          break;
        }
      }
    }
  }

  // 4. Magnetic Sequence Swap & Collision Prevention (unless bypassSnaps is held)
  const prevU = active.u;
  active.u = targetU;
  active.h = targetH;
  active.uNormAnchor = targetU / wallLen;

  // Record relative distance to nearest apex landmark
  const nearestApex = spline.landmarks.find((l) => l.kind === 'apex' || l.kind === 'inflection');
  if (nearestApex) {
    active.apexDeltaU = targetU - nearestApex.u;
    active.pinnedLandmarkId = nearestApex.id;
  }

  let swappedWithId: string | undefined;

  if (!bypassSnaps) {
    // Check if active crossed over a neighbor's center horizontally while vertically overlapping
    for (const other of others) {
      const vertOverlap =
        Math.abs(active.h - other.h) < (active.height + other.height) * 0.45;
      if (!vertOverlap) continue;

      const crossedRight = prevU < other.u && targetU >= other.u - 0.04;
      const crossedLeft = prevU > other.u && targetU <= other.u + 0.04;

      if (crossedRight || crossedLeft) {
        const defaultGap = 0.36;
        if (crossedRight) {
          // Shift `other` to the left of `active`
          other.u = Math.max(
            other.width * 0.5 + 0.12,
            targetU - active.width * 0.5 - defaultGap - other.width * 0.5
          );
          other.uNormAnchor = other.u / wallLen;
          swappedWithId = other.id;
        } else if (crossedLeft) {
          // Shift `other` to the right of `active`
          other.u = Math.min(
            wallLen - other.width * 0.5 - 0.12,
            targetU + active.width * 0.5 + defaultGap + other.width * 0.5
          );
          other.uNormAnchor = other.u / wallLen;
          swappedWithId = other.id;
        }
      }
    }

    // Gentle magnetic push so non-overlapping gallery hangs don't accidentally clip each other
    const MIN_BREATHING_GAP = 0.14;
    const sortedNow = getSortedWallArtworks(nextArtworks);
    const activeIdx = sortedNow.findIndex((a) => a.id === activeArtId);

    // Push right neighbors if overlapping or locked
    for (let r = activeIdx; r < sortedNow.length - 1; r++) {
      const curr = sortedNow[r];
      const next = sortedNow[r + 1];
      const vertOverlap = Math.abs(curr.h - next.h) < (curr.height + next.height) * 0.45;
      if (!vertOverlap) continue;

      const key = makePairKey(curr.id, next.id);
      const rel = gapStateMap[key];
      if (rel?.mode === 'locked') {
        next.u = curr.u + curr.width * 0.5 + rel.targetGap + next.width * 0.5;
        next.uNormAnchor = next.u / wallLen;
      } else {
        const minNextU = curr.u + curr.width * 0.5 + MIN_BREATHING_GAP + next.width * 0.5;
        if (next.u < minNextU) {
          next.u = minNextU;
          next.uNormAnchor = next.u / wallLen;
        }
      }
    }

    // Push left neighbors if overlapping or locked
    for (let l = activeIdx; l > 0; l--) {
      const curr = sortedNow[l];
      const prev = sortedNow[l - 1];
      const vertOverlap = Math.abs(curr.h - prev.h) < (curr.height + prev.height) * 0.45;
      if (!vertOverlap) continue;

      const key = makePairKey(prev.id, curr.id);
      const rel = gapStateMap[key];
      if (rel?.mode === 'locked') {
        prev.u = curr.u - curr.width * 0.5 - rel.targetGap - prev.width * 0.5;
        prev.uNormAnchor = prev.u / wallLen;
      } else {
        const maxPrevU = curr.u - curr.width * 0.5 - MIN_BREATHING_GAP - prev.width * 0.5;
        if (prev.u > maxPrevU) {
          prev.u = maxPrevU;
          prev.uNormAnchor = prev.u / wallLen;
        }
      }
    }
  }

  return {
    artworks: updateClearances(nextArtworks, spline),
    guides,
    swappedWithId,
  };
}

/**
 * Solves how artworks and lights adapt when the wall itself is reshaped.
 * Preserves curatorial intent (anchor mode, locked meter gaps, equal rhythm)
 * and surfaces explicit SpatialConflicts when physical constraints collide.
 */
export function solveWallReshape(params: {
  artworks: ArtworkItem[];
  lights: GalleryLight[];
  gapStateMap: Record<string, { mode: GapMode; targetGap: number }>;
  prevWallLength: number;
  nextSpline: WallSplineEngine;
}): {
  artworks: ArtworkItem[];
  lights: GalleryLight[];
  conflicts: SpatialConflict[];
} {
  const { artworks, lights, gapStateMap, prevWallLength, nextSpline } = params;
  const newLen = nextSpline.totalLength;
  const nextArtworks = artworks.map((a) => ({ ...a }));
  const wallArts = getSortedWallArtworks(nextArtworks);

  if (wallArts.length === 0) {
    return {
      artworks: nextArtworks,
      lights: syncLights(lights, nextArtworks, nextSpline),
      conflicts: [],
    };
  }

  // Group wall artworks into connected relational clusters (linked by 'locked' or 'equal' gaps)
  const clusters: ArtworkItem[][] = [];
  let currentCluster: ArtworkItem[] = [wallArts[0]];

  for (let i = 0; i < wallArts.length - 1; i++) {
    const a = wallArts[i];
    const b = wallArts[i + 1];
    const key = makePairKey(a.id, b.id);
    const mode = gapStateMap[key]?.mode ?? 'free';
    if (mode === 'locked' || mode === 'equal') {
      currentCluster.push(b);
    } else {
      clusters.push(currentCluster);
      currentCluster = [b];
    }
  }
  clusters.push(currentCluster);

  const primaryApex =
    nextSpline.landmarks.find((l) => l.kind === 'apex' || l.kind === 'inflection') ||
    nextSpline.landmarks.find((l) => l.kind === 'center');

  // Map each cluster onto the reshaped wall according to its anchor rule
  for (const cluster of clusters) {
    const lead = cluster[0];
    const last = cluster[cluster.length - 1];

    // Calculate internal widths and desired gaps for this cluster
    const gaps: number[] = [];
    for (let i = 0; i < cluster.length - 1; i++) {
      const k = makePairKey(cluster[i].id, cluster[i + 1].id);
      const rel = gapStateMap[k];
      if (rel?.mode === 'locked') {
        gaps.push(rel.targetGap);
      } else {
        // Equal mode scales breathing room with the wall ratio
        const baseGap = rel?.targetGap ?? 0.42;
        const scaledGap = Math.max(0.14, baseGap * (newLen / Math.max(0.5, prevWallLength)));
        gaps.push(scaledGap);
      }
    }

    const clusterSpan =
      cluster.reduce((acc, item) => acc + item.width, 0) +
      gaps.reduce((acc, g) => acc + g, 0);

    // Compute old cluster center normalized
    const oldLeftEdge = lead.u - lead.width * 0.5;
    const oldRightEdge = last.u + last.width * 0.5;
    const oldCenterNorm =
      cluster.reduce((acc, item) => acc + item.uNormAnchor, 0) / cluster.length;

    let newLeftEdge = 0;
    const anchorMode = lead.anchorMode;

    if (anchorMode === 'left-measure') {
      newLeftEdge = oldLeftEdge;
    } else if (anchorMode === 'right-measure') {
      const rightMargin = Math.max(0.15, prevWallLength - oldRightEdge);
      newLeftEdge = newLen - rightMargin - clusterSpan;
    } else if (anchorMode === 'apex-pinned' && primaryApex) {
      const delta = lead.apexDeltaU ?? 0;
      const newLeadU = primaryApex.u + delta;
      newLeftEdge = newLeadU - lead.width * 0.5;
    } else {
      // 'proportional' flow along the wall
      const newCenterU = oldCenterNorm * newLen;
      newLeftEdge = newCenterU - clusterSpan * 0.5;
    }

    // Place items in cluster
    let cursor = newLeftEdge;
    for (let i = 0; i < cluster.length; i++) {
      const item = cluster[i];
      item.u = cursor + item.width * 0.5;
      cursor += item.width + (gaps[i] ?? 0);
    }
  }

  // Detect spatial conflicts BEFORE hard-clamping so the creator gets transparent feedback
  const conflicts: SpatialConflict[] = [];
  const sortedAfter = getSortedWallArtworks(nextArtworks);
  const totalArtWidth = sortedAfter.reduce((acc, item) => acc + item.width, 0);

  // Check if total span overflows wall length
  const leftmostEdge = sortedAfter[0].u - sortedAfter[0].width * 0.5;
  const rightmostEdge =
    sortedAfter[sortedAfter.length - 1].u + sortedAfter[sortedAfter.length - 1].width * 0.5;

  if (leftmostEdge < 0.08 || rightmostEdge > newLen - 0.08) {
    // Gently shift cluster inward so nothing floats in mid-air off the wall ends
    if (rightmostEdge - leftmostEdge <= newLen - 0.24) {
      const shift =
        leftmostEdge < 0.12
          ? 0.12 - leftmostEdge
          : newLen - 0.12 - rightmostEdge;
      for (const item of sortedAfter) {
        item.u += shift;
      }
    } else {
      // The composition + locked gaps is literally wider than the shortened wall!
      const availForGaps = Math.max(0.05, newLen - 0.28 - totalArtWidth);
      const compressedGap =
        sortedAfter.length > 1 ? availForGaps / (sortedAfter.length - 1) : 0;

      // Keep frames on the wall surface (clamped) and raise an explicit conflict badge
      let cursor = 0.14;
      for (const item of sortedAfter) {
        item.u = Math.min(newLen - item.width * 0.5 - 0.1, cursor + item.width * 0.5);
        cursor += item.width + Math.max(0.04, compressedGap);
      }

      conflicts.push({
        id: 'conflict-wall-compression',
        kind: 'wall-compression',
        severity: 'warning',
        title: 'Wall shortened beyond locked spacing',
        description: `Wall arc is now ${newLen.toFixed(2)}m. Locked gaps were temporarily compressed to ${Math.max(0.04, compressedGap).toFixed(2)}m to keep frames on the surface.`,
        u: newLen * 0.5,
        h: 2.65,
        affectedArtworkIds: sortedAfter.map((a) => a.id),
        resolutions: [
          {
            id: 'res-accept-compressed',
            label: `Adopt ${Math.max(0.08, compressedGap).toFixed(2)}m Equal Rhythm`,
            actionType: 'compress-locked-gaps',
          },
          {
            id: 'res-move-outer-rack',
            label: 'Rest Rightmost Work on Floor Rack',
            actionType: 'move-overflow-to-rack',
          },
        ],
      });
    }
  }

  // Check pairwise collisions between independent clusters
  for (let i = 0; i < sortedAfter.length - 1; i++) {
    const left = sortedAfter[i];
    const right = sortedAfter[i + 1];
    const vertOverlap = Math.abs(left.h - right.h) < (left.height + right.height) * 0.45;
    if (!vertOverlap) continue;

    const gap = right.u - right.width * 0.5 - (left.u + left.width * 0.5);
    if (gap < 0.08 && conflicts.length === 0) {
      conflicts.push({
        id: `conflict-overlap-${left.id}-${right.id}`,
        kind: 'frame-overlap',
        severity: 'warning',
        title: 'Frames crowded after wall reshape',
        description: `"${left.title}" and "${right.title}" have only ${Math.max(0, gap * 100).toFixed(0)}cm clearance.`,
        u: (left.u + right.u) * 0.5,
        h: 2.6,
        affectedArtworkIds: [left.id, right.id],
        resolutions: [
          {
            id: 'res-separate',
            label: 'Restore 35cm Breathing Room',
            actionType: 'separate-overlaps',
          },
          {
            id: 'res-equalize-all',
            label: 'Distribute All Works Evenly',
            actionType: 'switch-to-proportional',
          },
        ],
      });
    }
  }

  // Update concave clearances & check if any wide frame sits on an extreme acute bend
  const withClearance = updateClearances(nextArtworks, nextSpline);
  for (const art of withClearance) {
    if (art.location === 'wall' && art.autoCurveClearance > 0.14) {
      conflicts.push({
        id: `conflict-curve-${art.id}`,
        kind: 'concave-clearance',
        severity: 'warning',
        title: 'Acute concave bend behind wide frame',
        description: `"${art.title}" (${art.width.toFixed(2)}m wide) is auto-offset +${(
          art.autoCurveClearance * 100
        ).toFixed(1)}cm so its corners clear the sharp bend.`,
        u: art.u,
        h: art.h - art.height * 0.5 - 0.25,
        affectedArtworkIds: [art.id],
        resolutions: [
          {
            id: 'res-commit-standoff',
            label: `Keep +${(art.autoCurveClearance * 100).toFixed(1)}cm Floating Mount`,
            actionType: 'apply-curve-standoff',
          },
        ],
      });
    }
  }

  const syncedLights = syncLights(lights, withClearance, nextSpline);

  return {
    artworks: withClearance,
    lights: syncedLights,
    conflicts,
  };
}

/**
 * Synchronizes target-centric gallery lights with their bound artworks and wall spline.
 */
export function syncLights(
  lights: GalleryLight[],
  artworks: ArtworkItem[],
  spline: WallSplineEngine
): GalleryLight[] {
  const wallLen = spline.totalLength;
  return lights.map((light) => {
    const copy = { ...light };
    if (copy.targetType === 'artwork' && copy.targetArtworkId) {
      const targetArt = artworks.find(
        (a) => a.id === copy.targetArtworkId && a.location === 'wall'
      );
      if (targetArt) {
        copy.targetU = Math.max(
          0.1,
          Math.min(wallLen - 0.1, targetArt.u + copy.artworkOffsetU)
        );
        copy.targetH = Math.max(
          0.3,
          Math.min(WALL_HEIGHT - 0.2, targetArt.h + copy.artworkOffsetH)
        );
      }
    } else {
      copy.targetU = Math.max(0.1, Math.min(wallLen - 0.1, copy.targetU));
    }
    return copy;
  });
}
