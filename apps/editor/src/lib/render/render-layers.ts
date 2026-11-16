/**
 * Render layers shared by the Stage's one Canvas and its snapshot host.
 *
 * The Stage camera's mask and the world layer live in `paper-plan.ts`
 * (`STAGE_WORLD_LAYER`, `STAGE_OVERLAY_LAYER`, `stageCameraLayerMask`). This
 * module exists so a **representation** can name the layer a session reading has
 * lifted a surface onto without importing the Paper Plan drawing module — a
 * retained Room must not depend on how Plan is inked.
 *
 * Layer 1 is reserved and unused; layer 2 is editor ink; layer 3 is this.
 */

/**
 * World content a session reading has lifted out of the Stage view and out of
 * rays. Snapshot cameras include it; the Stage camera and the default
 * `Raycaster` do not.
 *
 * **Shadow contract (T2 §10).** A lifted overhead sits on `LIFTED_RENDER_LAYER`;
 * the PR that first makes any overhead cast enables that layer on every
 * light-store shadow camera, and `lift-shadow-eligibility.test.ts` refuses it
 * otherwise. The rule in r187 is that a caster is drawn into a shadow map only
 * when `object.layers.test(effectiveShadowLayers)`, where the effective mask is
 * the light's `shadow.camera.layers` when that mask has any bit other than 0 and
 * the viewing camera's layers otherwise. Lift moves a lid off the viewing
 * camera's mask, so a casting lid would silently stop shadowing without that
 * line.
 */
export const LIFTED_RENDER_LAYER = 3;
