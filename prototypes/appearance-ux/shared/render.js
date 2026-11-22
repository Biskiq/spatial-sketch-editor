/*
 * A small WebGL2 swatch renderer for the U thumbnail study.
 *
 * It is a PROTOTYPE APPROXIMATION of the product's metallic–roughness path,
 * written to compare presentations, crops and sizes quickly. It is not the E7
 * inspection host and never becomes one: the production treatment must be
 * re-rendered and re-measured through E7 (see the decision sheet, slice U1).
 *
 * What it shares with the product on purpose:
 *  - the shipped texture bytes (colour sRGB, normal +Y, ORM R occlusion / G
 *    roughness, metalness a factor only), the recipe tint and factors;
 *  - metre mapping: texcoord = rotate(position in metres) / tileMeters;
 *  - the sphere's reference spans (π m equator, π/2 m meridian, E7 recipe 1);
 *  - an explicit tone map (Khronos PBR Neutral) and a single sRGB encode.
 * What it approximates: image-based light is an analytic sky gradient plus
 * Gaussian "softbox" lobes widened by roughness, and a split-sum fit.
 */

const VS = `#version 300 es
in vec2 aP; out vec2 vQ;
void main(){ vQ = aP; gl_Position = vec4(aP, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vQ; out vec4 outC;
uniform sampler2D uColorMap, uNormalMap, uOrmMap;
uniform bool uHasColor, uHasNormal, uHasOrm, uHasOcc;
uniform vec3 uTint;
uniform float uRough, uMetal, uNormalScale, uNormalY;
uniform vec2 uTile, uCentre;
uniform float uWindow, uRot, uAspect;
uniform int uGeom;      // 0 flat, 1 chip, 2 sphere, 3 tile (seamless, one tile)
uniform int uShade;     // 0 unlit colour, 1 lit
uniform int uSolo;      // 0 none, 1 normal, 2 roughness, 3 metal, 4 occlusion
uniform float uSheen, uExposure, uKey;
uniform vec3 uBg;
uniform float uLightTurn;  // rotates the key + softbox about the view axis (grazing study)
uniform float uGrazing;    // 0 studio, 1 grazing key
uniform float uStrip;      // 1 adds a horizontal strip light whose reflection crosses a flat sample as a sheen band
uniform float uEye;        // camera distance for flat/chip, in multiples of the window
uniform float uStripGain;  // strip light intensity

const float PI = 3.14159265;

vec3 lin2srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }

vec3 neutral(vec3 color){
  const float startCompression = 0.8 - 0.04; const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, newPeak * vec3(1.0), g);
}

vec2 rot2(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }
vec3 turnZ(vec3 v, float a){ vec2 r = rot2(v.xy, a); return vec3(r, v.z); }

float lobe(vec3 R, vec3 S, float sb, float sr){
  float s2 = sb*sb + sr*sr; float a = acos(clamp(dot(R, S), -1.0, 1.0));
  return (sb*sb / s2) * exp(-a*a / (2.0*s2));
}

vec3 env(vec3 R, float rough){
  float sr = rough * rough * 1.35 + 0.015;
  float up = smoothstep(-0.35, 0.9, R.y);
  vec3 sky = mix(vec3(0.16, 0.16, 0.17), vec3(0.62, 0.63, 0.64), up);
  // a broad blur of the sky when rough, so rough surfaces read evenly
  sky = mix(sky, vec3(0.42), clamp(rough, 0.0, 1.0) * 0.55);
  vec3 S1 = turnZ(normalize(vec3(-0.34, 0.46, 1.0)), uLightTurn);
  vec3 S2 = turnZ(normalize(vec3(0.9, 0.05, 0.55)), uLightTurn);
  float strip = 0.0;
  if (uStrip > 0.5) {
    float el = asin(clamp(R.y, -1.0, 1.0)); float az = atan(R.x, R.z);
    float sb = 0.085; float s2 = sb*sb + sr*sr;
    strip = (sb*sb / s2) * exp(-(el - 0.33)*(el - 0.33) / (2.0*s2)) * exp(-az*az / (2.0*0.9*0.9));
  }
  float box = uSheen * (7.0 * lobe(R, S1, 0.16, sr) + 1.6 * lobe(R, S2, 0.22, sr) + uStripGain * strip);
  return sky + vec3(box);
}

vec2 envBRDF(float rough, float NdV){
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
  const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = rough * c0 + c1;
  float a004 = min(r.x * r.x, exp2(-9.28 * NdV)) * r.x + r.y;
  return vec2(-1.04, 1.04) * a004 + r.zw;
}

float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }

void main(){
  vec2 q = vQ; q.x *= uAspect;
  vec3 N = vec3(0.0, 0.0, 1.0), T = vec3(1.0, 0.0, 0.0), B = vec3(0.0, 1.0, 0.0);
  vec2 m;               // metres on the surface
  vec3 Pw;              // world position for the view vector
  float inside = 1.0; float shadow = 0.0;
  if (uGeom == 2) {
    vec2 s = q / 0.8; float rr = dot(s, s);
    if (rr > 1.0) { inside = 0.0; }
    else {
      N = vec3(s, sqrt(1.0 - rr));
      float lon = atan(N.x, N.z), lat = asin(clamp(N.y, -1.0, 1.0));
      m = vec2(lon * 0.5, lat * 0.5);
      T = vec3(cos(lon), 0.0, -sin(lon));
      B = normalize(cross(N, T));
      Pw = N * 0.5;
    }
  } else if (uGeom == 1) {
    float hb = 0.86, rad = 0.2, bw = 0.12;
    float d = sdRoundBox(q, vec2(hb), rad);
    if (d > 0.0) { inside = 0.0; shadow = exp(-max(sdRoundBox(q - vec2(0.03, -0.05), vec2(hb), rad), 0.0) * 22.0); }
    else {
      float e = 0.002;
      vec2 g = vec2(sdRoundBox(q + vec2(e, 0.0), vec2(hb), rad) - sdRoundBox(q - vec2(e, 0.0), vec2(hb), rad),
                    sdRoundBox(q + vec2(0.0, e), vec2(hb), rad) - sdRoundBox(q - vec2(0.0, e), vec2(hb), rad));
      g = normalize(g + 1e-6);
      float t = clamp(1.0 + d / bw, 0.0, 1.0); t = t * t * 0.82;
      N = normalize(vec3(g * t, sqrt(max(1.0 - t*t, 0.0))));
      T = normalize(vec3(1.0, 0.0, -N.x / max(N.z, 0.2)));
      B = normalize(cross(N, T));
      m = q * (uWindow / (2.0 * hb));
      Pw = vec3(m, 0.0);
    }
  } else if (uGeom == 3) {
    m = (vQ * 0.5 + 0.5) * uTile;   // exactly one tile, seamless
    Pw = vec3(m, 0.0);
  } else {
    m = q * (uWindow * 0.5);
    Pw = vec3(m, 0.0);
  }
  if (inside < 0.5) {
    vec3 bg = uBg * (1.0 - 0.22 * shadow);
    outC = vec4(lin2srgb(bg), 1.0); return;
  }
  vec2 tm = rot2(m, -uRot);
  vec2 tc = tm / uTile + uCentre;
  if (uGeom == 3) tc = rot2(m / uTile, -uRot);

  vec3 base = uTint;
  if (uHasColor) base *= texture(uColorMap, tc).rgb;
  vec3 orm = uHasOrm ? texture(uOrmMap, tc).rgb : vec3(1.0);
  float ao = uHasOcc ? orm.r : 1.0;
  float rough = clamp(uRough * (uHasOrm ? orm.g : 1.0), 0.04, 1.0);
  float metal = clamp(uMetal, 0.0, 1.0);
  vec3 nt = vec3(0.0, 0.0, 1.0);
  if (uHasNormal) { nt = texture(uNormalMap, tc).rgb * 2.0 - 1.0; nt.y *= uNormalY; nt.xy *= uNormalScale; nt = normalize(nt); }
  vec2 nr = rot2(nt.xy, uRot);
  vec3 Nn = normalize(T * nr.x + B * nr.y + N * nt.z);

  if (uSolo == 1) { outC = vec4(nt * 0.5 + 0.5, 1.0); return; }
  if (uSolo == 2) { outC = vec4(vec3(uHasOrm ? orm.g : uRough), 1.0); return; }
  if (uSolo == 3) { outC = vec4(vec3(metal), 1.0); return; }
  if (uSolo == 4) { outC = vec4(vec3(ao), 1.0); return; }
  if (uShade == 0) { outC = vec4(lin2srgb(base), 1.0); return; }

  vec3 eye = uGeom == 3 ? vec3(Pw.xy, 1e4) : (uGeom == 2 ? vec3(0.0, 0.0, 3.6) : vec3(0.0, 0.0, uWindow * uEye));
  vec3 V = normalize(eye - Pw);
  vec3 L = turnZ(mix(normalize(vec3(-0.55, 0.6, 0.58)), normalize(vec3(-0.97, 0.1, 0.2)), uGrazing), uLightTurn);
  float NdL = max(dot(Nn, L), 0.0), NdV = max(dot(Nn, V), 1e-3);
  float hemi = mix(0.78, 1.0, Nn.y * 0.5 + 0.5);
  float amb = mix(1.0 - uKey * 0.58, 0.18, uGrazing) * hemi;
  vec3 diffuse = base * (1.0 - metal) * (amb * mix(1.0, ao, 0.85) + uKey * mix(1.0, 2.2, uGrazing) * NdL * mix(1.0, ao, 0.4));
  vec3 F0 = mix(vec3(0.04), base, metal);
  vec3 R = reflect(-V, Nn);
  vec2 ab = envBRDF(rough, NdV);
  vec3 spec = env(R, rough) * (F0 * ab.x + ab.y) * mix(1.0, ao, 0.6);
  // key highlight (GGX) so raking light shows relief on smooth sets
  vec3 H = normalize(L + V); float a = rough * rough; float a2 = a * a;
  float NdH = max(dot(Nn, H), 0.0); float dd = NdH*NdH*(a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  float k = (rough + 1.0); k = k*k/8.0;
  float G = (NdL / (NdL*(1.0-k)+k)) * (NdV / (NdV*(1.0-k)+k));
  spec += uSheen * uKey * D * F * G / max(4.0 * NdL * NdV, 1e-3) * NdL * 0.6;
  vec3 col = (diffuse + spec) * uExposure;
  outC = vec4(lin2srgb(neutral(col)), 1.0);
}`;

const hexToLin = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
};

export function createRenderer() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL2 is required for the thumbnail study');
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aP');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  const u = (n) => (U[n] ??= gl.getUniformLocation(prog, n));
  gl.uniform1i(u('uColorMap'), 0); gl.uniform1i(u('uNormalMap'), 1); gl.uniform1i(u('uOrmMap'), 2);

  const textures = new Map();
  const white = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, white);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

  function loadTexture(url, srgb) {
    const key = url + (srgb ? '#srgb' : '');
    if (textures.has(key)) return textures.get(key);
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const ext = gl.getExtension('EXT_texture_filter_anisotropic');
        if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
        resolve(t);
      };
      img.onerror = () => reject(new Error('Could not load ' + url));
      img.src = url;
    });
    textures.set(key, p);
    return p;
  }

  const resolved = new Map();
  async function load(entry, texBase) {
    if (resolved.has(entry.id + texBase)) return;
    const d = texBase + entry.set + '/';
    const [c, n, o] = await Promise.all([
      entry.colorMap ? loadTexture(d + 'color.webp', true) : null,
      loadTexture(d + 'normal.webp', false),
      loadTexture(d + 'orm.webp', false)
    ]);
    resolved.set(entry.id + texBase, { c, n, o });
  }

  /**
   * spec: { entry, texBase, finish?: { tint, rough, metal, normalScale, tile, rot, colour: 'natural'|'tint'|'coat', coat },
   *         geom: 'flat'|'chip'|'sphere'|'tile', shade: 'lit'|'unlit', sheen, window, centre, exposure, key,
   *         bg, solo, lightTurn, grazing }
   */
  function draw(spec, w, h) {
    const e = spec.entry;
    const t = resolved.get(e.id + spec.texBase);
    if (!t) throw new Error('not loaded: ' + e.id);
    const f = spec.finish || {};
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    const colourMode = f.colour || 'natural';
    const useMap = e.colorMap && colourMode !== 'coat';
    const tint = colourMode === 'natural' ? (f.tint || e.tint) : (f.coat || f.tint || e.tint);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, useMap ? t.c : white);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t.n);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, t.o);
    gl.uniform1i(u('uHasColor'), useMap ? 1 : 0);
    gl.uniform1i(u('uHasNormal'), f.normalOff ? 0 : 1);
    gl.uniform1i(u('uHasOrm'), f.ormOff ? 0 : 1);
    gl.uniform1i(u('uHasOcc'), e.occ ? 1 : 0);
    gl.uniform3fv(u('uTint'), hexToLin(tint));
    gl.uniform1f(u('uRough'), f.rough ?? e.rough);
    gl.uniform1f(u('uMetal'), f.metal ?? e.metal);
    gl.uniform1f(u('uNormalScale'), f.normalScale ?? 1);
    gl.uniform1f(u('uNormalY'), f.normalFlip ? -1 : 1);
    const tile = f.tile || e.tile;
    gl.uniform2fv(u('uTile'), tile);
    gl.uniform2fv(u('uCentre'), spec.centre || e.frame.c);
    gl.uniform1f(u('uWindow'), spec.window ?? e.frame.w);
    gl.uniform1f(u('uRot'), f.rot || 0);
    gl.uniform1f(u('uAspect'), w / h);
    gl.uniform1i(u('uGeom'), { flat: 0, chip: 1, sphere: 2, tile: 3 }[spec.geom || 'flat']);
    gl.uniform1i(u('uShade'), spec.shade === 'unlit' ? 0 : 1);
    gl.uniform1i(u('uSolo'), { normal: 1, roughness: 2, metal: 3, occlusion: 4 }[spec.solo] || 0);
    gl.uniform1f(u('uSheen'), spec.sheen === false ? 0 : 1);
    gl.uniform1f(u('uExposure'), spec.exposure ?? 1);
    gl.uniform1f(u('uKey'), spec.key ?? 0.78);
    gl.uniform1f(u('uLightTurn'), spec.lightTurn || 0);
    gl.uniform1f(u('uGrazing'), spec.grazing ? 1 : 0);
    gl.uniform1f(u('uStrip'), spec.strip ? 1 : 0);
    gl.uniform1f(u('uEye'), spec.eye ?? 1.9);
    gl.uniform1f(u('uStripGain'), spec.stripGain ?? 6);
    gl.uniform3fv(u('uBg'), hexToLin(spec.bg || '#e9e6dd'));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return canvas;
  }

  function toURL(spec, w, h, type = 'image/png', q) {
    draw(spec, w, h);
    return canvas.toDataURL(type, q);
  }

  /** RGBA rows, top row first, as a 2D canvas would return them. */
  function pixels(spec, w, h) {
    draw(spec, w, h);
    const out = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);
    const row = w * 4, flipped = new Uint8Array(out.length);
    for (let y = 0; y < h; y++) flipped.set(out.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    return flipped;
  }

  /** Copy the current frame into a 2D canvas (for live previews). */
  function paint(spec, target) {
    const w = target.width, h = target.height;
    draw(spec, w, h);
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(canvas, 0, 0);
  }

  return { gl, canvas, load, draw, toURL, pixels, paint };
}
