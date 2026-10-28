/**
 * Scene-native form evaluation for pure planners.
 *
 * The Scene planner never stores generated geometry. Support, contact and the
 * extent checks all read one canonical evaluation of the authored source, so a
 * form's floor behaviour and its rendered body cannot disagree.
 */
import {
  evaluateProfile,
  extrudeProfile,
  type FormMesh,
  type ProfileAnchor
} from '@portfolio/geometry-core';
import type { SceneFormSource } from '../scene';

/** Evaluate one form source at its stored extent and per-axis scale. */
export function evaluateSceneForm(source: SceneFormSource): FormMesh {
  return extrudeProfile({
    profile: evaluateProfile(source.generator.outline as readonly ProfileAnchor[]),
    extent: source.generator.extent,
    scale: source.scale,
    plane: source.generator.plane
  });
}

/**
 * The form's floor contact at its stored scale, or `null` when the authored
 * source cannot evaluate. Admission has already validated the source, so
 * `null` is a defensive answer for corrupt in-memory data, not a repair path.
 */
export function sceneFormContactMinY(source: SceneFormSource): number | null {
  try {
    const contact = evaluateSceneForm(source).contactMinY;
    return Number.isFinite(contact) ? contact : null;
  } catch {
    return null;
  }
}
