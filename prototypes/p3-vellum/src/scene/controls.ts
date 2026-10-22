// Camera: a turntable around the model (orbit), a plan view from above, and standing inside at eye height.
import * as THREE from 'three';
import type { CamSnap } from '../store';

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

export class CamCtl {
  camera: THREE.PerspectiveCamera;
  // goals
  target = new THREE.Vector3(0, 1, 0);
  az = -0.75;
  pol = 0.95;
  dist = 34;
  // current
  cTarget = new THREE.Vector3(0, 1, 0);
  cAz = -0.75;
  cPol = 0.95;
  cDist = 34;
  mode: 'orbit' | 'eye' = 'orbit';
  eyePos = new THREE.Vector3(0, 1.6, 0);
  eyeYaw = 0;
  eyePitch = 0;
  cEyePos = new THREE.Vector3(0, 1.6, 0);
  cEyeYaw = 0;
  cEyePitch = 0;
  /** Direct input (fingers, mouse) follows tightly; programmatic moves (views, framing, Esc) glide. */
  static FOLLOW = 28;
  static GLIDE = 9;
  /** true while a programmatic move is easing towards its goal */
  gliding = false;
  keys = new Set<string>();
  /** when set (visit playback), the camera is driven externally */
  external: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /** Direct input during a glide stops the glide where it is, then applies on top. */
  private interrupt() {
    if (!this.gliding) return;
    this.gliding = false;
    this.target.copy(this.cTarget);
    this.az = this.cAz;
    this.pol = this.cPol;
    this.dist = this.cDist;
  }

  private glide() {
    this.gliding = true;
  }

  /** Turn to a heading and tilt, gliding (e.g. to face a slice). */
  glideTo(az: number, pol: number) {
    this.glide();
    this.az = az;
    this.pol = pol;
  }

  orbitBy(dx: number, dy: number) {
    this.interrupt();
    if (this.mode === 'eye') {
      this.eyeYaw -= dx * 0.004;
      this.eyePitch = THREE.MathUtils.clamp(this.eyePitch - dy * 0.004, -1.2, 1.2);
      return;
    }
    this.az -= dx * 0.006;
    this.pol = THREE.MathUtils.clamp(this.pol - dy * 0.005, 0.02, 1.48);
  }

  /** Pan so the ground under the fingers tracks them: mpp is metres per screen pixel at the target. */
  panBy(dx: number, dy: number, mpp = this.dist * 0.0012) {
    this.interrupt();
    if (this.mode === 'eye') return;
    const right = new THREE.Vector3(Math.cos(this.az), 0, -Math.sin(this.az));
    const fwd = new THREE.Vector3(Math.sin(this.az), 0, Math.cos(this.az));
    // the ground is foreshortened by the tilt: a screen pixel up covers more of it
    const tilt = 1 / Math.max(Math.cos(this.pol), 0.35);
    this.target.addScaledVector(right, -dx * mpp);
    this.target.addScaledVector(fwd, -dy * mpp * tilt);
  }

  /**
   * Zoom by factor f (<1 is closer) about a world point that stays under the cursor: target and distance scale
   * together about it. `now` applies it to the shown camera too (trackpad pinch: the OS already smooths it).
   */
  zoomAt(f: number, pivot: THREE.Vector3 | null, now: boolean) {
    this.interrupt();
    if (this.mode === 'eye') {
      const dir = new THREE.Vector3(Math.sin(this.eyeYaw), 0, Math.cos(this.eyeYaw)).multiplyScalar(-1);
      this.eyePos.addScaledVector(dir, (f - 1) * -6);
      return;
    }
    const nd = THREE.MathUtils.clamp(this.dist * f, 3, 160);
    const s = nd / this.dist;
    if (pivot) this.target.sub(pivot).multiplyScalar(s).add(pivot);
    this.dist = nd;
    if (now) {
      const cs = THREE.MathUtils.clamp(this.cDist * s, 3, 160) / this.cDist;
      if (pivot) this.cTarget.sub(pivot).multiplyScalar(cs).add(pivot);
      this.cDist *= cs;
    }
  }

  setPlan() {
    this.glide();
    this.mode = 'orbit';
    this.pol = 0.02;
    this.az = Math.round(this.az / (Math.PI / 2)) * (Math.PI / 2);
  }

  setModel() {
    this.glide();
    this.mode = 'orbit';
    this.pol = 0.95;
  }

  turn(step: number) {
    this.glide();
    if (this.mode === 'eye') this.eyeYaw += step;
    else this.az += step;
  }

  standAt(x: number, y: number, z: number, lookX: number, lookZ: number) {
    const first = this.mode !== 'eye';
    this.mode = 'eye';
    this.eyePos.set(x, y + 1.6, z);
    this.eyeYaw = Math.atan2(-(lookX - x), -(lookZ - z));
    this.eyePitch = 0.05;
    if (first) {
      this.cEyePos.copy(this.camera.position);
      this.cEyeYaw = this.eyeYaw;
      this.cEyePitch = -0.6;
    }
  }

  /** Orbit azimuth by a direct gesture (trackpad rotate). */
  rotateBy(rad: number) {
    this.interrupt();
    if (this.mode === 'eye') this.eyeYaw += rad;
    else this.az += rad;
  }

  frame(min: [number, number], max: [number, number], top: number, keepAngle = true) {
    this.glide();
    this.mode = 'orbit';
    const cx = (min[0] + max[0]) / 2, cz = (min[1] + max[1]) / 2;
    const size = Math.max(max[0] - min[0], max[1] - min[1], top * 1.4, 10);
    this.target.set(cx, Math.min(top * 0.3, 3), cz);
    this.dist = size * 2.1 + 6;
    if (!keepAngle) {
      this.az = -0.75;
      this.pol = 0.95;
    }
  }

  snap(): CamSnap {
    return { target: [this.target.x, this.target.y, this.target.z], az: this.az, pol: this.pol, dist: this.dist, mode: this.mode, ...(this.mode === 'eye' ? { eye: [this.eyePos.x, this.eyePos.y, this.eyePos.z, this.eyeYaw, this.eyePitch] } : {}) } as any;
  }

  restore(s: CamSnap & { eye?: number[] }) {
    this.glide();
    this.target.set(...s.target);
    this.az = s.az;
    this.pol = s.pol;
    this.dist = s.dist;
    this.mode = s.mode;
    if (s.mode === 'eye' && s.eye) {
      this.eyePos.set(s.eye[0], s.eye[1], s.eye[2]);
      this.eyeYaw = s.eye[3];
      this.eyePitch = s.eye[4];
    }
  }

  update(dt: number) {
    const cam = this.camera;
    if (this.external) {
      cam.position.copy(this.external.pos);
      cam.lookAt(this.external.look);
      return;
    }
    if (this.mode === 'eye') {
      const f = new THREE.Vector3(-Math.sin(this.eyeYaw), 0, -Math.cos(this.eyeYaw));
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const v = new THREE.Vector3();
      if (this.keys.has('w') || this.keys.has('arrowup')) v.add(f);
      if (this.keys.has('s') || this.keys.has('arrowdown')) v.sub(f);
      if (this.keys.has('d') || this.keys.has('arrowright')) v.add(r);
      if (this.keys.has('a') || this.keys.has('arrowleft')) v.sub(r);
      if (v.lengthSq() > 0) this.eyePos.addScaledVector(v.normalize(), dt * 3.2);
      this.cEyePos.lerp(this.eyePos, 1 - Math.exp(-8 * dt));
      this.cEyeYaw = damp(this.cEyeYaw, this.eyeYaw, 12, dt);
      this.cEyePitch = damp(this.cEyePitch, this.eyePitch, 12, dt);
      cam.position.copy(this.cEyePos);
      const look = new THREE.Vector3(
        -Math.sin(this.cEyeYaw) * Math.cos(this.cEyePitch),
        Math.sin(this.cEyePitch),
        -Math.cos(this.cEyeYaw) * Math.cos(this.cEyePitch),
      );
      cam.lookAt(this.cEyePos.clone().add(look));
      // keep orbit state roughly in sync so leaving eye mode is smooth
      this.cTarget.copy(this.cEyePos).add(look.clone().multiplyScalar(6));
      this.cDist = 8;
      return;
    }
    const k = this.gliding ? CamCtl.GLIDE : CamCtl.FOLLOW;
    this.cTarget.lerp(this.target, 1 - Math.exp(-k * dt));
    this.cAz = damp(this.cAz, this.az, k, dt);
    this.cPol = damp(this.cPol, this.pol, k, dt);
    this.cDist = damp(this.cDist, this.dist, k, dt);
    if (this.gliding && this.cTarget.distanceTo(this.target) < 1e-3 && Math.abs(this.cAz - this.az) < 1e-4 && Math.abs(this.cPol - this.pol) < 1e-4 && Math.abs(this.cDist - this.dist) < 1e-3) this.gliding = false;
    const sp = Math.sin(this.cPol), cp = Math.cos(this.cPol);
    cam.position.set(
      this.cTarget.x + this.cDist * sp * Math.sin(this.cAz),
      this.cTarget.y + this.cDist * cp,
      this.cTarget.z + this.cDist * sp * Math.cos(this.cAz),
    );
    cam.up.set(0, 1, 0);
    if (this.cPol < 0.05) {
      // top-down: keep "north" stable
      cam.up.set(-Math.sin(this.cAz), 0, -Math.cos(this.cAz));
    }
    cam.lookAt(this.cTarget);
  }
}
