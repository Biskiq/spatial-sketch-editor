(() => {
	const R = window.__pr247.rec;
	R.on = false;
	const out = { frames: R.frames.length, facts: [], mismatched: 0, pops: [] };
	const residualOf = (t) => {
		let sum = 0, max = 0;
		const a = R.blocks[t - 1], b = R.blocks[t], c = R.blocks[t + 1];
		for (let i = 0; i < b.length; i += 1) { const d = Math.abs(b[i] - (a[i] + c[i]) / 2); sum += d; if (d > max) max = d; }
		return { mean: sum / b.length, max };
	};
	const series = [];
	for (let t = 1; t < R.blocks.length - 1; t += 1) series.push(residualOf(t).mean);
	const sorted = [...series].sort((x, y) => x - y);
	out.residualMedian = +(sorted[sorted.length >> 1] ?? 0).toFixed(3);
	out.residualMax = +(sorted[sorted.length - 1] ?? 0).toFixed(3);
	R.frames.forEach((f, t) => {
		if (f.gridScale !== undefined && (f.uSize !== f.gridScale || f.matScale !== f.gridScale || f.matX !== f.gridX || f.matZ !== f.gridZ)) out.mismatched += 1;
		const p = R.frames[t - 1];
		if (p && (p.matScale !== f.matScale || p.matX !== f.matX || p.matZ !== f.matZ)) {
			out.pops.push({ t, residual: t >= 1 && t < series.length ? +series[t - 1].toFixed(3) : null, scale: [p.matScale, f.matScale], x: [p.matX, f.matX], z: [p.matZ, f.matZ], near: [+p.near.toFixed(3), +f.near.toFixed(3)] });
		}
	});
	const ns = R.frames.map((f) => f.near), fs = R.frames.map((f) => f.far);
	out.near = [+Math.min(...ns).toFixed(3), +Math.max(...ns).toFixed(3)];
	out.far = [Math.round(Math.min(...fs)), Math.round(Math.max(...fs))];
	out.topResiduals = series.map((v, i) => [i + 1, +v.toFixed(3)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
	out.pr = R.frames[0]?.pr;
	out.dtMs = R.frames.length > 1 ? Math.round((R.frames.at(-1).t - R.frames[0].t) / (R.frames.length - 1)) : null;
	return JSON.stringify(out);
})();
