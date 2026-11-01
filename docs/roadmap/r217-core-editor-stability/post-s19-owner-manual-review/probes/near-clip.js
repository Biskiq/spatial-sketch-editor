/* PR #247 probe: what would a candidate near plane clip? Walls only (no coplanar pairs), so any
 * difference from the shipped near is geometry the candidate cut away. Needs window.__sweep. */
(() => {
	const P = window.__pr247;
	const cfg = window.__sweep;
	const rows = [];
	P.show({ mat: false, grid: false, floor: false, walls: true });
	for (const elevationDeg of cfg.elevations) for (const T of cfg.heights) {
		const pose = { target: cfg.target, azimuthRadians: cfg.azimuth, elevationRadians: (elevationDeg * Math.PI) / 180, targetPlaneHeightMeters: T };
		const saved = P.nearCandidate;
		P.nearCandidate = null;
		const a = P.apply(pose, cfg.radius);
		const shipped = P.read();
		P.nearCandidate = saved;
		const b = P.apply(pose, cfg.radius);
		const candidate = P.read();
		let changed = 0;
		for (let i = 0; i < shipped.data.length; i += 4) if (Math.abs(shipped.data[i] - candidate.data[i]) + Math.abs(shipped.data[i + 1] - candidate.data[i + 1]) + Math.abs(shipped.data[i + 2] - candidate.data[i + 2]) > 12) changed += 1;
		rows.push({ elevationDeg, T, shippedNear: +a.near.toFixed(3), candidateNear: +b.near.toFixed(3), changedPx: changed });
	}
	P.show({ mat: true, grid: true, floor: true, walls: true });
	return JSON.stringify(rows);
})();
