/*
 * PR #247 probe: does a surface lose its depth test to the surface it should cover?
 * Each row renders the production meshes in isolation at one pose. Set window.__sweep
 * = { target, radius, azimuth } before running.
 */
(() => {
	const P = window.__pr247;
	const cfg = window.__sweep;
	const o = P.objects();
	const diffCount = (a, b, mask) => {
		let n = 0;
		for (let i = 0; i < a.data.length; i += 4) {
			if (mask && !mask[i >> 2]) continue;
			if (Math.abs(a.data[i] - b.data[i]) > 3 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 3 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 3) n += 1;
		}
		return n;
	};
	const rows = [];
	for (const elevationDeg of cfg.elevations) {
		for (const T of cfg.heights) {
			const pose = { target: cfg.target, azimuthRadians: cfg.azimuth, elevationRadians: (elevationDeg * Math.PI) / 180, targetPlaneHeightMeters: T };
			const a = P.apply(pose, cfg.radius);
			const row = { elevationDeg, T, near: +a.near.toFixed(3), far: Math.round(a.far), eyeDist: +Math.hypot(a.eye[0] - cfg.target[0], a.eye[1] - cfg.target[1], a.eye[2] - cfg.target[2]).toFixed(1), half: a.halfExtent };
			// E1: grid against its own mat.
			P.show({ mat: true, grid: true, floor: false, walls: false });
			o.grid.material.depthTest = false; o.grid.material.needsUpdate = true;
			const noTest = P.read();
			o.grid.material.depthTest = true; o.grid.material.needsUpdate = true;
			const withTest = P.read();
			row.gridLostToMat = diffCount(noTest, withTest);
			// E2: floor against the mat 4 mm below it.
			if (o.floors.length > 0) {
				P.show({ mat: false, grid: false, floor: false, walls: false });
				const none = P.read();
				P.show({ mat: false, grid: false, floor: true, walls: false });
				const floorOnly = P.read();
				P.show({ mat: true, grid: false, floor: false, walls: false });
				const matOnly = P.read();
				P.show({ mat: true, grid: false, floor: true, walls: false });
				const both = P.read();
				const mask = new Uint8Array(none.data.length >> 2);
				let floorPx = 0;
				for (let i = 0; i < none.data.length; i += 4) {
					if (Math.abs(none.data[i] - floorOnly.data[i]) + Math.abs(none.data[i + 1] - floorOnly.data[i + 1]) + Math.abs(none.data[i + 2] - floorOnly.data[i + 2]) > 6) { mask[i >> 2] = 1; floorPx += 1; }
				}
				// Floor edge pixels blend with whatever is behind them, so only an eroded interior counts.
				const W = none.w, H = none.h;
				const eroded = new Uint8Array(mask.length);
				floorPx = 0;
				for (let y = 2; y < H - 2; y += 1) for (let x = 2; x < W - 2; x += 1) {
					const i = y * W + x;
					if (mask[i] && mask[i - 1] && mask[i + 1] && mask[i - W] && mask[i + W] && mask[i - 2] && mask[i + 2] && mask[i - 2 * W] && mask[i + 2 * W]) { eroded[i] = 1; floorPx += 1; }
				}
				mask.set(eroded);
				row.floorPx = floorPx;
				row.floorLostToMat = diffCount(both, floorOnly, mask);
				row.floorLostPct = floorPx ? +((100 * row.floorLostToMat) / floorPx).toFixed(1) : 0;
			}
			rows.push(row);
		}
	}
	P.show({ mat: true, grid: true, floor: true, walls: true });
	return JSON.stringify(rows);
})();
