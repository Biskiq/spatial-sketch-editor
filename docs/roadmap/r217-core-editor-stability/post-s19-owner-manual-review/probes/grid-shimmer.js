/*
 * PR #247 probe: how much grid shimmer is aliasing, and do candidate line filters fix it?
 *
 * For one fine camera motion it renders the real grid quad + mat in a central crop, twice per
 * frame: the current pixel sampling, and a 4× supersampled box-filtered reference of the same
 * line (`uSsaaScale` keeps its width in final pixels). What motion alone explains is in the
 * reference, so flicker = the frame-to-frame change of (frame − reference), in linear light,
 * on c.block × c.block blocks (default 8; 1 reads per-pixel crawl). Candidates are runtime shader patches; no product file changes.
 */
(() => {
	const P = window.__pr247;
	const c = window.__shimmer;
	const r = P.renderer;
	const o = P.objects();
	const material = o.grid.material;
	const original = (P.originalFragment = P.originalFragment ?? material.fragmentShader);
	material.uniforms.uSsaaScale = { value: 1 };
	const head = 'uniform float uSsaaScale;\nvarying vec2 vLattice;';
	const CURRENT = `float lineCoverage(float cells) {
	float distance = abs(fract(cells - 0.5) - 0.5) / max(fwidth(cells) * uSsaaScale, 1e-9);
	return 1.0 - min(distance, 1.0);
}`;
	// C1: the same one-pixel triangle, measured on the true perpendicular gradient.
	const TRUE_GRADIENT = `float lineCoverage(float cells) {
	float g = length(vec2(dFdx(cells), dFdy(cells)));
	float distance = abs(fract(cells - 0.5) - 0.5) / max(g * uSsaaScale, 1e-9);
	return 1.0 - min(distance, 1.0);
}`;
	// C2: a line 1.5 final pixels wide with a one-pixel soft edge (flat core, stable energy).
	const WIDE_CORE = `float lineCoverage(float cells) {
	float g = max(length(vec2(dFdx(cells), dFdy(cells))) * uSsaaScale, 1e-9);
	float distance = abs(fract(cells - 0.5) - 0.5) / g;
	return 1.0 - smoothstep(0.25, 1.25, distance);
}`;
	// C3: a line 1.25 CSS px wide, whatever the buffer ratio, with a one-buffer-pixel soft edge.
	const CSS_WIDTH = `float lineCoverage(float cells) {
	float g = max(length(vec2(dFdx(cells), dFdy(cells))) * uSsaaScale, 1e-9);
	float distance = abs(fract(cells - 0.5) - 0.5) / g;
	float halfWidth = 0.625 * uPixelRatio / uSsaaScale;
	return 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distance);
}`;
	const patterns = { current: CURRENT, 'true-gradient': TRUE_GRADIENT, 'wide-core': WIDE_CORE, 'css-1.25': CSS_WIDTH };
	const lineFn = /float lineCoverage\(float cells\) \{[\s\S]*?\n\}/;
	const toLinear = new Float32Array(256).map((_, v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
	function crop(s) {
		r.setRenderTarget(null);
		r.render(P.scene, P.camera);
		const gl = r.getContext();
		const W = c.crop[2], H = c.crop[3];
		const data = new Uint8Array(W * s * H * s * 4);
		gl.readPixels(c.crop[0] * s, c.crop[1] * s, W * s, H * s, gl.RGBA, gl.UNSIGNED_BYTE, data);
		const B = c.block ?? 8;
		const blocks = new Float32Array(Math.floor(W / B) * Math.floor(H / B));
		const bw = Math.floor(W / B);
		for (let i = 0, y = 0; y < H * s; y += 1) {
			const by = Math.floor(y / s / B);
			for (let x = 0; x < W * s; x += 1, i += 4) {
				const bx = Math.floor(x / s / B);
				if (bx >= bw || by >= Math.floor(H / B)) continue;
				blocks[by * bw + bx] += (0.2126 * toLinear[data[i]] + 0.7152 * toLinear[data[i + 1]] + 0.0722 * toLinear[data[i + 2]]) / (B * B * s * s);
			}
		}
		return blocks;
	}
	function evaluate(name, patch, ratio) {
		material.fragmentShader = original.replace('varying vec2 vLattice;', head).replace(lineFn, patch);
		material.needsUpdate = true;
		const frames = [], refs = [];
		P.show({ mat: true, grid: true, floor: false, walls: false });
		for (let t = 0; t < c.frames; t += 1) {
			const pose = { ...c.pose, azimuthRadians: c.pose.azimuthRadians + t * (c.azStep ?? 0), targetPlaneHeightMeters: c.pose.targetPlaneHeightMeters * Math.pow(c.tScale ?? 1, t) };
			r.setPixelRatio(ratio);
			material.uniforms.uSsaaScale.value = 1;
			P.apply(pose, c.radius);
			frames.push(crop(1));
			r.setPixelRatio(ratio * 4);
			material.uniforms.uSsaaScale.value = 4;
			P.apply(pose, c.radius);
			material.uniforms.uPixelRatio.value = ratio * 4;
			refs.push(crop(4));
		}
		r.setPixelRatio(ratio);
		let change = 0, n = 0, energy = 0;
		const deltas = [];
		for (let t = 1; t < frames.length; t += 1) {
			for (let i = 0; i < frames[t].length; i += 1) {
				const d = Math.abs(frames[t][i] - refs[t][i] - (frames[t - 1][i] - refs[t - 1][i]));
				change += d; n += 1; deltas.push(d);
				energy += refs[t][i];
			}
		}
		deltas.sort((a, b) => a - b);
		return { name, flickerMean: +(1e4 * change / n).toFixed(3), flickerP99: +(1e4 * deltas[Math.floor(deltas.length * 0.99)]).toFixed(2), meanLinear: +(1e4 * energy / n).toFixed(1) };
	}
	const out = [];
	for (const [name, patch] of Object.entries(patterns)) out.push(evaluate(name, patch, c.ratio));
	material.fragmentShader = original;
	material.needsUpdate = true;
	delete material.uniforms.uSsaaScale;
	r.setPixelRatio(c.basePR);
	P.show({ mat: true, grid: true, floor: true, walls: true });
	return JSON.stringify(out);
})();
