/** CIEDE2000 on linear-sRGB readings (D65), for the E7 acceptance gate. */

type Triple = readonly [number, number, number];

const DEG = Math.PI / 180;

export function labFromLinearSrgb(rgb: readonly number[]): Triple {
	const [r, g, b] = rgb as Triple;
	const f = (value: number): number =>
		value > 216 / 24389 ? Math.cbrt(value) : ((24389 / 27) * value + 16) / 116;
	const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
	const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
	const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
	return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function deltaE2000(one: Triple, two: Triple): number {
	const [l1, a1, b1] = one;
	const [l2, a2, b2] = two;
	const cBar7 = ((Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2) ** 7;
	const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));
	const ap1 = a1 * (1 + g);
	const ap2 = a2 * (1 + g);
	const c1 = Math.hypot(ap1, b1);
	const c2 = Math.hypot(ap2, b2);
	const hue = (b: number, a: number): number => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / DEG + 360) % 360);
	const h1 = hue(b1, ap1);
	const h2 = hue(b2, ap2);
	const grey = c1 * c2 === 0;

	let dh = grey ? 0 : h2 - h1;
	if (dh > 180) dh -= 360;
	else if (dh < -180) dh += 360;
	const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((dh / 2) * DEG);

	let hBar = h1 + h2;
	if (!grey) {
		if (Math.abs(h1 - h2) > 180) hBar += hBar < 360 ? 360 : -360;
		hBar /= 2;
	}
	const lBar = (l1 + l2) / 2;
	const cBar = (c1 + c2) / 2;
	const t =
		1 -
		0.17 * Math.cos((hBar - 30) * DEG) +
		0.24 * Math.cos(2 * hBar * DEG) +
		0.32 * Math.cos((3 * hBar + 6) * DEG) -
		0.2 * Math.cos((4 * hBar - 63) * DEG);
	const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
	const sc = 1 + 0.045 * cBar;
	const sh = 1 + 0.015 * cBar * t;
	const rc = 2 * Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7));
	const rt = -rc * Math.sin(60 * DEG * Math.exp(-(((hBar - 275) / 25) ** 2)));
	const dL = (l2 - l1) / sl;
	const dC = (c2 - c1) / sc;
	const dh2 = dH / sh;
	return Math.sqrt(dL * dL + dC * dC + dh2 * dh2 + rt * dC * dh2);
}
