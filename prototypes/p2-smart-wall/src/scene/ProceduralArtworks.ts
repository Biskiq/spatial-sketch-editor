import * as THREE from 'three';
import { ArtworkItem, FrameStyle } from '../core/types';

const textureCache = new Map<string, THREE.CanvasTexture>();

function addFilmGrain(ctx: CanvasRenderingContext2D, w: number, h: number, opacity = 0.035) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const amount = opacity * 255;
  // Deterministic PRNG for clean repeatable grain
  let seed = 1337;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = ((seed & 0xff) / 255 - 0.5) * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);
}

export function generateArtworkTexture(art: ArtworkItem): THREE.CanvasTexture {
  const cacheKey = `${art.id}_${art.motif}_${art.matWidth}`;
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const aspect = art.width / art.height;
  const baseRes = 768;
  const cw = aspect >= 1 ? Math.round(baseRes * aspect) : baseRes;
  const ch = aspect >= 1 ? baseRes : Math.round(baseRes / aspect);

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;

  // 1. Passepartout Mat board background
  ctx.fillStyle = art.matWidth > 0 ? '#f4f1ea' : '#181818';
  ctx.fillRect(0, 0, cw, ch);

  const matPxX = Math.round((art.matWidth / art.width) * cw);
  const matPxY = Math.round((art.matWidth / art.height) * ch);

  const ix = matPxX;
  const iy = matPxY;
  const iw = cw - matPxX * 2;
  const ih = ch - matPxY * 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();

  // 2. Render fine-art photograph motif inside (ix, iy, iw, ih)
  if (art.motif === 'horizon-dusk') {
    // Atmospheric Hiroshi Sugimoto / Rothko inspired twilight seascape
    const skyGrad = ctx.createLinearGradient(ix, iy, ix, iy + ih * 0.56);
    skyGrad.addColorStop(0, '#1c2430');
    skyGrad.addColorStop(0.55, '#3b4b5e');
    skyGrad.addColorStop(0.88, '#957d6a');
    skyGrad.addColorStop(1, '#d8b48e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(ix, iy, iw, ih * 0.56);

    const seaGrad = ctx.createLinearGradient(ix, iy + ih * 0.56, ix, iy + ih);
    seaGrad.addColorStop(0, '#a38972');
    seaGrad.addColorStop(0.18, '#384654');
    seaGrad.addColorStop(0.65, '#1b232c');
    seaGrad.addColorStop(1, '#0e1318');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(ix, iy + ih * 0.56, iw, ih * 0.44);

    // Subtle horizontal water ripples & distant mist glow
    for (let r = 0; r < 140; r++) {
      const ry = iy + ih * 0.56 + Math.pow(r / 140, 1.6) * (ih * 0.43);
      const alpha = (1 - r / 140) * 0.16;
      ctx.fillStyle = r % 2 === 0 ? `rgba(235, 205, 170, ${alpha})` : `rgba(12, 18, 26, ${alpha * 1.3})`;
      const rw = iw * (0.25 + ((r * 37) % 75) / 100);
      const rx = ix + ((r * 97) % Math.max(1, Math.floor(iw - rw)));
      ctx.fillRect(rx, ry, rw, 1.5);
    }

    // Minimalist solitary piling silhouette in the calm water
    const px = ix + iw * 0.34;
    const py = iy + ih * 0.69;
    ctx.fillStyle = '#0f1318';
    ctx.fillRect(px, py - ih * 0.08, 5, ih * 0.08);
    ctx.fillStyle = 'rgba(15, 19, 24, 0.35)';
    ctx.fillRect(px - 1, py, 7, ih * 0.07);
  } else if (art.motif === 'monolith-i') {
    // High-contrast architectural concrete monolith in stark desert light
    const bgGrad = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    bgGrad.addColorStop(0, '#232323');
    bgGrad.addColorStop(0.65, '#7c7a75');
    bgGrad.addColorStop(1, '#b8b4ac');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(ix, iy, iw, ih);

    // Ground plane
    ctx.fillStyle = '#52504c';
    ctx.fillRect(ix, iy + ih * 0.74, iw, ih * 0.26);

    // Sunlit face of brutalist monolith
    ctx.fillStyle = '#e7e4dc';
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.3, iy + ih * 0.16);
    ctx.lineTo(ix + iw * 0.54, iy + ih * 0.12);
    ctx.lineTo(ix + iw * 0.54, iy + ih * 0.78);
    ctx.lineTo(ix + iw * 0.3, iy + ih * 0.76);
    ctx.closePath();
    ctx.fill();

    // Shadowed face of monolith
    ctx.fillStyle = '#1b1b1a';
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.54, iy + ih * 0.12);
    ctx.lineTo(ix + iw * 0.71, iy + ih * 0.19);
    ctx.lineTo(ix + iw * 0.71, iy + ih * 0.76);
    ctx.lineTo(ix + iw * 0.54, iy + ih * 0.78);
    ctx.closePath();
    ctx.fill();

    // Long cast shadow on desert salt flat
    ctx.fillStyle = '#141413';
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.54, iy + ih * 0.78);
    ctx.lineTo(ix + iw * 0.71, iy + ih * 0.76);
    ctx.lineTo(ix + iw, iy + ih * 0.84);
    ctx.lineTo(ix + iw, iy + ih * 0.93);
    ctx.closePath();
    ctx.fill();
  } else if (art.motif === 'monolith-ii') {
    // Companion architectural study: cantilevered portal & geometric light slice
    const bgGrad = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    bgGrad.addColorStop(0, '#191919');
    bgGrad.addColorStop(0.7, '#64625e');
    bgGrad.addColorStop(1, '#9d9991');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(ix, iy, iw, ih);

    // Architectural wall mass
    ctx.fillStyle = '#242322';
    ctx.fillRect(ix + iw * 0.16, iy + ih * 0.14, iw * 0.68, ih * 0.68);

    // Illuminated recessed courtyard portal
    ctx.fillStyle = '#dfd9ce';
    ctx.fillRect(ix + iw * 0.36, iy + ih * 0.28, iw * 0.28, ih * 0.54);

    // Diagonal shadow cutting across the bright recess
    ctx.fillStyle = '#3c3a37';
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.36, iy + ih * 0.28);
    ctx.lineTo(ix + iw * 0.64, iy + ih * 0.28);
    ctx.lineTo(ix + iw * 0.36, iy + ih * 0.68);
    ctx.closePath();
    ctx.fill();

    // Reflecting pool at base
    const poolGrad = ctx.createLinearGradient(ix, iy + ih * 0.82, ix, iy + ih);
    poolGrad.addColorStop(0, '#181817');
    poolGrad.addColorStop(1, '#3b3936');
    ctx.fillStyle = poolGrad;
    ctx.fillRect(ix, iy + ih * 0.82, iw, ih * 0.18);

    // Light reflection in water
    ctx.fillStyle = 'rgba(223, 217, 206, 0.32)';
    ctx.fillRect(ix + iw * 0.36, iy + ih * 0.82, iw * 0.28, ih * 0.14);
  } else if (art.motif === 'tidal-geometry') {
    // Serene minimalist platinum-palladium study of coastal fog & geometric breakwater
    const grad = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    grad.addColorStop(0, '#dcd7cd');
    grad.addColorStop(0.48, '#b8b1a5');
    grad.addColorStop(0.5, '#8f887d');
    grad.addColorStop(1, '#3d3934');
    ctx.fillStyle = grad;
    ctx.fillRect(ix, iy, iw, ih);

    // Stepped concrete sea-wall receding in perspective
    const steps = 6;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const sx = ix + iw * (0.18 + t * 0.52);
      const sy = iy + ih * (0.68 - t * 0.16);
      const sw = iw * (0.11 * (1 - t * 0.45));
      const sh = ih * (0.14 * (1 - t * 0.45));

      ctx.fillStyle = s % 2 === 0 ? '#262421' : '#33302c';
      ctx.fillRect(sx, sy, sw, sh);

      // Soft water reflection below each pier block
      ctx.fillStyle = 'rgba(38, 36, 33, 0.24)';
      ctx.fillRect(sx, sy + sh, sw, sh * 0.85);
    }
  } else if (art.motif === 'desert-sine') {
    // Sweeping Namib desert S-curve dune ridge in golden hour contrast
    const sky = ctx.createLinearGradient(ix, iy, ix, iy + ih * 0.35);
    sky.addColorStop(0, '#2c3d4f');
    sky.addColorStop(1, '#798894');
    ctx.fillStyle = sky;
    ctx.fillRect(ix, iy, iw, ih);

    // Lit side of dune (warm ochre terracotta)
    const litGrad = ctx.createLinearGradient(ix, iy + ih * 0.25, ix + iw * 0.6, iy + ih);
    litGrad.addColorStop(0, '#df9b5c');
    litGrad.addColorStop(1, '#b5632f');
    ctx.fillStyle = litGrad;
    ctx.beginPath();
    ctx.moveTo(ix, iy + ih * 0.42);
    ctx.bezierCurveTo(
      ix + iw * 0.35,
      iy + ih * 0.18,
      ix + iw * 0.45,
      iy + ih * 0.55,
      ix + iw * 0.58,
      iy + ih
    );
    ctx.lineTo(ix, iy + ih);
    ctx.closePath();
    ctx.fill();

    // Shadowed side of dune (deep burnt umber)
    const darkGrad = ctx.createLinearGradient(ix + iw * 0.45, iy + ih * 0.25, ix + iw, iy + ih);
    darkGrad.addColorStop(0, '#4a2615');
    darkGrad.addColorStop(1, '#1e110a');
    ctx.fillStyle = darkGrad;
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.24, iy + ih * 0.29);
    ctx.bezierCurveTo(
      ix + iw * 0.44,
      iy + ih * 0.28,
      ix + iw * 0.47,
      iy + ih * 0.62,
      ix + iw * 0.58,
      iy + ih
    );
    ctx.lineTo(ix + iw, iy + ih);
    ctx.lineTo(ix + iw, iy + ih * 0.36);
    ctx.closePath();
    ctx.fill();
  } else {
    // 'portrait-shadow' — Chiaroscuro architectural figure silhouette in a shaft of light
    ctx.fillStyle = '#121212';
    ctx.fillRect(ix, iy, iw, ih);

    // Diagonal shaft of warm gallery window light on back wall
    const beamGrad = ctx.createLinearGradient(ix + iw * 0.15, iy, ix + iw * 0.85, iy + ih);
    beamGrad.addColorStop(0, 'rgba(235, 224, 205, 0.92)');
    beamGrad.addColorStop(0.7, 'rgba(185, 172, 152, 0.65)');
    beamGrad.addColorStop(1, 'rgba(60, 55, 48, 0.15)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.22, iy + ih * 0.08);
    ctx.lineTo(ix + iw * 0.68, iy + ih * 0.08);
    ctx.lineTo(ix + iw * 0.86, iy + ih * 0.92);
    ctx.lineTo(ix + iw * 0.38, iy + ih * 0.92);
    ctx.closePath();
    ctx.fill();

    // Contemplative silhouette profile
    ctx.fillStyle = '#0d0d0d';
    ctx.beginPath();
    ctx.arc(ix + iw * 0.52, iy + ih * 0.45, iw * 0.075, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(ix + iw * 0.41, iy + ih * 0.53, iw * 0.22, ih * 0.39, [iw * 0.08, iw * 0.08, 0, 0]);
    ctx.fill();
  }

  ctx.restore();

  // 3. Draw inner mat window bevel & subtle inner shadow if matted
  if (art.matWidth > 0) {
    ctx.strokeStyle = 'rgba(30, 26, 20, 0.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(ix - 1.5, iy - 1.5, iw + 3, ih + 3);

    ctx.strokeStyle = 'rgba(255, 253, 248, 0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ix + 1, iy + 1, iw - 2, ih - 2);
  }

  addFilmGrain(ctx, cw, ch, 0.032);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  textureCache.set(cacheKey, texture);
  return texture;
}

export function getFrameMaterial(style: FrameStyle): THREE.MeshStandardMaterial {
  switch (style) {
    case 'walnut':
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#3b2618'),
        roughness: 0.42,
        metalness: 0.06,
      });
    case 'warm-oak':
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#9e7b56'),
        roughness: 0.48,
        metalness: 0.04,
      });
    case 'brushed-brass':
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#b89758'),
        roughness: 0.28,
        metalness: 0.72,
      });
    case 'floating-dibond':
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1f1f1f'),
        roughness: 0.35,
        metalness: 0.3,
      });
    case 'black-metal':
    default:
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1c1d1f'),
        roughness: 0.32,
        metalness: 0.55,
      });
  }
}

/**
 * Builds a complete 3D framed artwork Group whose origin (0,0,0) is at the back-center of the frame,
 * facing +Z.
 */
export function createFramedArtworkMesh(art: ArtworkItem): THREE.Group {
  const group = new THREE.Group();
  group.name = `artwork-${art.id}`;
  group.userData = { artworkId: art.id };

  const W = art.width;
  const H = art.height;
  const D = art.frameDepth;
  const rim = art.frameStyle === 'floating-dibond' ? 0.006 : 0.024;

  const frameMat = getFrameMaterial(art.frameStyle);

  // Backboard / shadow-mount Cleat
  const backGeo = new THREE.BoxGeometry(W - 0.01, H - 0.01, D * 0.55);
  const backMat = new THREE.MeshStandardMaterial({
    color: 0x161514,
    roughness: 0.85,
  });
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.position.set(0, 0, D * 0.275);
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  backMesh.userData = { artworkId: art.id };
  group.add(backMesh);

  // Artwork canvas / print plane
  const artGeo = new THREE.PlaneGeometry(W - rim * 2, H - rim * 2);
  const artTex = generateArtworkTexture(art);
  const artMat = new THREE.MeshStandardMaterial({
    map: artTex,
    roughness: 0.36, // Semi-matte museum baryta paper finish with gentle specular sheen
    metalness: 0.02,
  });
  const artMesh = new THREE.Mesh(artGeo, artMat);
  artMesh.position.set(0, 0, D * 0.76);
  artMesh.receiveShadow = true;
  artMesh.userData = { artworkId: art.id };
  group.add(artMesh);

  // 4 mitered outer frame bars (Top, Bottom, Left, Right)
  const topBarGeo = new THREE.BoxGeometry(W, rim, D);
  const topBar = new THREE.Mesh(topBarGeo, frameMat);
  topBar.position.set(0, (H - rim) * 0.5, D * 0.5);
  topBar.castShadow = true;
  topBar.receiveShadow = true;
  topBar.userData = { artworkId: art.id };
  group.add(topBar);

  const botBar = new THREE.Mesh(topBarGeo, frameMat);
  botBar.position.set(0, -(H - rim) * 0.5, D * 0.5);
  botBar.castShadow = true;
  botBar.receiveShadow = true;
  botBar.userData = { artworkId: art.id };
  group.add(botBar);

  const sideBarGeo = new THREE.BoxGeometry(rim, H - rim * 2, D);
  const leftBar = new THREE.Mesh(sideBarGeo, frameMat);
  leftBar.position.set(-(W - rim) * 0.5, 0, D * 0.5);
  leftBar.castShadow = true;
  leftBar.receiveShadow = true;
  leftBar.userData = { artworkId: art.id };
  group.add(leftBar);

  const rightBar = new THREE.Mesh(sideBarGeo, frameMat);
  rightBar.position.set((W - rim) * 0.5, 0, D * 0.5);
  rightBar.castShadow = true;
  rightBar.receiveShadow = true;
  rightBar.userData = { artworkId: art.id };
  group.add(rightBar);

  // Subtle selection / hover outline frame
  const outlineEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.012, H + 0.012, D + 0.008));
  const outlineMat = new THREE.LineBasicMaterial({
    color: 0xd99b4e,
    transparent: true,
    opacity: 0.0,
  });
  const outlineLine = new THREE.LineSegments(outlineEdges, outlineMat);
  outlineLine.position.set(0, 0, D * 0.5);
  outlineLine.name = 'selection-outline';
  group.add(outlineLine);

  // Standoff mounting pins (visible when artwork is floated off the wall)
  const pinGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.25, 12);
  pinGeo.rotateX(Math.PI * 0.5);
  const pinMat = new THREE.MeshStandardMaterial({
    color: 0x8c7b65,
    metalness: 0.8,
    roughness: 0.25,
  });
  const pinPositions = [
    [-W * 0.36, H * 0.36],
    [W * 0.36, H * 0.36],
    [-W * 0.36, -H * 0.36],
    [W * 0.36, -H * 0.36],
  ];
  const pinsGroup = new THREE.Group();
  pinsGroup.name = 'standoff-pins';
  for (const [px, py] of pinPositions) {
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.set(px, py, -0.125);
    pinsGroup.add(pin);
  }
  group.add(pinsGroup);

  return group;
}
