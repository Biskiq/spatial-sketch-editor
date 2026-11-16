/**
 * Where Lift's ink sits, and how close to a surface it still answers the pointer.
 *
 * The dashed outline is drawn just under the lid it stands for, so the line clears
 * the Wall tops it traces rather than z-fighting them. The pick tests the plane the
 * outline is **drawn** on, not the lid's own elevation: a creator aims at the line
 * they can see. An outline at most `LIFT_OUTLINE_DEPTH_BAND_METERS` behind the
 * surface under the pointer still wins, so a boundary that sits on a floor's own
 * edge selects the lifted overhead instead of the floor it was cut from — and an
 * outline clearly behind a nearer Wall never does.
 */
export const LIFT_OUTLINE_DROP_METERS = 0.01;
export const LIFT_OUTLINE_DEPTH_BAND_METERS = 0.05;
