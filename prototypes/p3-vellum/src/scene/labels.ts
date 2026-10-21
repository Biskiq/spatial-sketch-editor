// HTML labels pinned to 3D points (room names, measurements, red-pencil markers).
import * as THREE from 'three';

interface Item {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  used: boolean;
  html: string;
  cls: string;
}

export class Labels {
  root: HTMLDivElement;
  items = new Map<string, Item>();
  private v = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'labels';
    parent.appendChild(this.root);
  }

  begin() {
    for (const it of this.items.values()) it.used = false;
  }

  put(key: string, html: string, pos: THREE.Vector3 | [number, number, number], cls = '', onClick?: (e: MouseEvent) => void) {
    let it = this.items.get(key);
    if (!it) {
      const el = document.createElement('div');
      it = { el, pos: new THREE.Vector3(), used: true, html: '', cls: '' };
      this.items.set(key, it);
      this.root.appendChild(el);
    }
    if (it.html !== html) {
      it.el.innerHTML = html;
      it.html = html;
    }
    if (it.cls !== cls) {
      it.el.className = `lbl ${cls}`;
      it.cls = cls;
    }
    (it.el as any).onclick = onClick ?? null;
    it.el.style.pointerEvents = onClick ? 'auto' : 'none';
    if (Array.isArray(pos)) it.pos.set(pos[0], pos[1], pos[2]);
    else it.pos.copy(pos);
    it.used = true;
  }

  end() {
    for (const [k, it] of this.items) {
      if (!it.used) {
        it.el.remove();
        this.items.delete(k);
      }
    }
  }

  update(camera: THREE.Camera, w: number, h: number) {
    for (const it of this.items.values()) {
      this.v.copy(it.pos).project(camera);
      const vis = this.v.z < 1 && this.v.z > -1 && Math.abs(this.v.x) < 1.2 && Math.abs(this.v.y) < 1.2;
      it.el.style.display = vis ? '' : 'none';
      if (!vis) continue;
      const x = (this.v.x * 0.5 + 0.5) * w, y = (-this.v.y * 0.5 + 0.5) * h;
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  clear() {
    for (const it of this.items.values()) it.el.remove();
    this.items.clear();
  }
}
