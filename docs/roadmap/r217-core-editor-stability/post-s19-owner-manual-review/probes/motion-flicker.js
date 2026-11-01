/*
 * PR #247 probe: temporal flicker in motion, per isolated layer.
 *
 * Frame-to-frame swing that a smooth motion cannot explain: for each 8×8 block the
 * residual |f[t] − (f[t−1] + f[t+1]) / 2| of mean luminance, and the per-pixel blink
 * rate (a swing > 24/255 that reverses on the next frame). A supersampled run is the
 * reference for how much of that the moving picture itself contains.
 * Set window.__motion = { pose, radius, frames, azStep, tScale, elStep, layers, ssaa }.
 */
(() => {
	const P = window.__pr247;
	const c = window.__motion;
	const r = P.renderer;
	const basePR = r.getPixelRatio();
	const size = r.getSize(new P.THREE.Vector2());
	function run(layers, ssaa) {
		P.show(layers);
		if (ssaa > 1) r.setPixelRatio(basePR * ssaa);
		const frames = [];
		let bw = 0, bh = 0, w = 0, h = 0, s = 0;
		const blinkSeries = [];
		let prevLum = null, prevPrevLum = null, blink = 0, compared = 0;
		const bandBlink = new Float64Array(8);
		const bandCount = new Float64Array(8);
		for (let t = 0; t < c.frames; t += 1) {
			const pose = {
				target: c.pose.target,
				azimuthRadians: c.pose.azimuthRadians + t * (c.azStep ?? 0),
				elevationRadians: c.pose.elevationRadians + t * (c.elStep ?? 0),
				targetPlaneHeightMeters: c.pose.targetPlaneHeightMeters * Math.pow(c.tScale ?? 1, t)
			};
			P.apply(pose, c.radius);
			const f = P.read();
			w = f.w; h = f.h; s = ssaa;
			const W = Math.floor(w / s), H = Math.floor(h / s);
			const lum = new Float32Array(W * H);
			for (let y = 0; y < H; y += 1) {
				for (let x = 0; x < W; x += 1) {
					let sum = 0;
					for (let j = 0; j < s; j += 1) {
						for (let i = 0; i < s; i += 1) {
							const k = ((y * s + j) * w + x * s + i) * 4;
							sum += 0.2126 * f.data[k] + 0.7152 * f.data[k + 1] + 0.0722 * f.data[k + 2];
						}
					}
					lum[y * W + x] = sum / (s * s);
				}
			}
			bw = Math.floor(W / 8); bh = Math.floor(H / 8);
			const blocks = new Float32Array(bw * bh);
			for (let y = 0; y < bh * 8; y += 1) for (let x = 0; x < bw * 8; x += 1) blocks[(y >> 3) * bw + (x >> 3)] += lum[y * W + x] / 64;
			frames.push(blocks);
			if (prevPrevLum) {
				for (let i = 0; i < lum.length; i += 1) {
					const d1 = prevLum[i] - prevPrevLum[i];
					const d2 = lum[i] - prevLum[i];
					compared += 1;
					const band = Math.min(7, Math.floor(((i / W) | 0) / (H / 8)));
					bandCount[band] += 1;
					if (Math.abs(d1) > 24 && Math.abs(d2) > 24 && d1 * d2 < 0) { blink += 1; bandBlink[band] += 1; }
				}
			}
			prevPrevLum = prevLum; prevLum = lum;
		}
		if (ssaa > 1) r.setPixelRatio(basePR);
		const res = [];
		for (let t = 1; t < frames.length - 1; t += 1) {
			for (let i = 0; i < frames[t].length; i += 1) res.push(Math.abs(frames[t][i] - (frames[t - 1][i] + frames[t + 1][i]) / 2));
		}
		res.sort((a, b) => a - b);
		const pct = (p) => +res[Math.floor(res.length * p)].toFixed(3);
		return {
			blockResidual: { mean: +(res.reduce((a, b) => a + b, 0) / res.length).toFixed(4), p99: pct(0.99), p999: pct(0.999), max: +res[res.length - 1].toFixed(2) },
			blinkPerMille: +((1000 * blink) / compared).toFixed(3),
			// band 0 is the bottom of the frame in GL row order
			blinkByBandBottomToTop: [...bandBlink].map((v, i) => +((1000 * v) / bandCount[i]).toFixed(2))
		};
	}
	const out = {};
	for (const [name, layers] of Object.entries(c.layers)) out[name] = run(layers, 1);
	if (c.ssaa) out['ssaa-reference'] = run(c.ssaaLayers, c.ssaa);
	P.show({ mat: true, grid: true, floor: true, walls: true });
	return JSON.stringify(out);
})();
