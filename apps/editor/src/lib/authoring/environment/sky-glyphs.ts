import type { SceneSky } from '@portfolio/project-model/units';
import {
	DAWN_START,
	NIGHT_START,
	SUNRISE,
	SUNSET,
	skyBodyAt,
	skyKind,
	wrap24,
} from '$lib/render/sky-time';

// SVG drawing from Gallery UX rev 4, §4.
type Glyph = ReturnType<typeof skyKind>;
const FOREST = '#263e31';
const f1 = (value: number) => value.toFixed(1);
let skyUid = 0;

export function skyGlyph(x: number, y: number, r: number, kind: Glyph) {
	const id = 'sg' + ++skyUid;
	if (kind === 'moon') {
		const a = [x - 0.233 * r, y - 0.973 * r],
			b = [x + 0.783 * r, y + 0.623 * r];
		return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="#fff3b0" stop-opacity=".6"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient></defs><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 2.1)}" fill="url(#${id})"/><path d="M${f1(a[0]!)},${f1(a[1]!)} A${f1(r)} ${f1(r)} 0 1 0 ${f1(b[0]!)},${f1(b[1]!)} A${f1(r)} ${f1(r)} 0 0 1 ${f1(a[0]!)},${f1(a[1]!)}Z" fill="#ffd84d" stroke="#b8891a" stroke-width="1"/>`;
	}
	if (kind === 'overcast') {
		const c = (cx: number, cy: number, rr: number) =>
			`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(rr)}"/>`;
		return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="#fffbe8" stop-opacity=".8"/><stop offset="1" stop-color="#fffbe8" stop-opacity="0"/></radialGradient></defs><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 2)}" fill="url(#${id})"/><circle cx="${f1(x - r * 0.25)}" cy="${f1(y - r * 0.3)}" r="${f1(r * 0.85)}" fill="#f6efd8" stroke="#b9b098" stroke-width="1"/>
      <g fill="#f4f6f7" stroke="#a9b1b6" stroke-width="1">${c(x - r * 0.75, y + r * 0.45, r * 0.62)}${c(x + r * 0.05, y + r * 0.2, r * 0.82)}${c(x + r * 0.85, y + r * 0.5, r * 0.58)}</g><path d="M${f1(x - r * 1.3)},${f1(y + r * 0.95)}h${f1(r * 2.7)}" stroke="#f4f6f7" stroke-width="${f1(r * 0.5)}" stroke-linecap="round"/>`;
	}
	const low = kind === 'low' || kind === 'twilight',
		core = low ? '#ff9a3c' : '#ffd23f',
		ray = low ? '#f07a1f' : '#f5b400',
		glow = low ? '#ffb36b' : '#fff1a0',
		r1 = r * 1.4,
		r2 = r * (low ? 1.75 : 2);
	let rays = '';
	for (let k = 0; k < 8; k++) {
		const t = (k / 8) * Math.PI * 2;
		rays += `M${f1(x + Math.cos(t) * r1)},${f1(y + Math.sin(t) * r1)}L${f1(x + Math.cos(t) * r2)},${f1(y + Math.sin(t) * r2)}`;
	}
	return `<g${kind === 'twilight' ? ' opacity=".7"' : ''}><defs><radialGradient id="${id}"><stop offset="0" stop-color="${glow}" stop-opacity=".95"/><stop offset=".55" stop-color="${glow}" stop-opacity=".35"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 2.4)}" fill="url(#${id})"/><path d="${rays}" stroke="${ray}" stroke-width="${f1(Math.max(1.4, r * 0.3))}" stroke-linecap="round"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${core}" stroke="${low ? '#c75d12' : '#d99a00'}" stroke-width="1"/></g>`;
}

const DC = 60;
const tAng = (t: number) => (wrap24(t) / 24) * 2 * Math.PI;
const tXY = (t: number, r: number): [number, number] => [
	DC - r * Math.sin(tAng(t)),
	DC + r * Math.cos(tAng(t)),
];
/* The Time dial is a small sky (restored from the 68b1b3f drawSky dial, now cut by phase): a blue day sector with
   noon at the top, apricot dusk, rose dawn and a starry night sector, with the sun, low sun or moon riding on it. */
const STARS = [
	[44, 88, 1.1],
	[60, 104, 0.8],
	[86, 96, 1.2],
	[96, 108, 0.7],
	[70, 112, 0.9],
	[90, 84, 0.6],
	[50, 106, 0.6],
	[30, 90, 0.7],
	[78, 102, 0.6],
	[38, 80, 0.5],
	[66, 94, 0.5],
	[56, 76, 0.5],
	[22, 74, 0.5],
];
function sectorD(t0: number, t1: number, r: number) {
	if (t1 < t0) t1 += 24;
	const n = Math.max(2, Math.ceil((t1 - t0) * 4));
	let d = `M${DC},${DC}`;
	for (let i = 0; i <= n; i++) {
		const p = tXY(t0 + ((t1 - t0) * i) / n, r);
		d += 'L' + f1(p[0]) + ',' + f1(p[1]);
	}
	return d + 'Z';
}
export function timeDialSVG(sky: SceneSky, held: boolean, id: string) {
	const t = sky.time,
		s = skyBodyAt(t, sky.heading, sky.arcHeight),
		R = 54,
		tp = tXY(t, 37),
		k = skyKind(s, sky.haze);
	let g = `<defs><linearGradient id="${id}-tdDay" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="74"><stop offset="0" stop-color="#2f8fef"/><stop offset=".5" stop-color="#7cc8ff"/><stop offset=".85" stop-color="#e2f4ff"/><stop offset="1" stop-color="#fff0b0"/></linearGradient>
    <linearGradient id="${id}-tdNight" gradientUnits="userSpaceOnUse" x1="0" y1="114" x2="0" y2="52"><stop offset="0" stop-color="#04071a"/><stop offset=".6" stop-color="#11163a"/><stop offset="1" stop-color="#2a2f5e"/></linearGradient>
    <linearGradient id="${id}-tdDusk" gradientUnits="userSpaceOnUse" x1="114" y1="60" x2="80" y2="100"><stop offset="0" stop-color="#ffbe73"/><stop offset="1" stop-color="#8a4f86"/></linearGradient>
    <linearGradient id="${id}-tdDawn" gradientUnits="userSpaceOnUse" x1="6" y1="60" x2="40" y2="100"><stop offset="0" stop-color="#ffd2a1"/><stop offset="1" stop-color="#7b5a92"/></linearGradient>
    <clipPath id="${id}-tdNightClip"><path d="${sectorD(NIGHT_START, DAWN_START, R)}"/></clipPath></defs>`;
	g += `<circle cx="${DC}" cy="${DC}" r="${R + 3.5}" fill="#fbfaf6" stroke="#d9d5c8"/>`;
	g += `<path d="${sectorD(SUNRISE, SUNSET, R)}" fill="url(#${id}-tdDay)"/><path d="${sectorD(SUNSET, NIGHT_START, R)}" fill="url(#${id}-tdDusk)"/><path d="${sectorD(DAWN_START, SUNRISE, R)}" fill="url(#${id}-tdDawn)"/><path d="${sectorD(NIGHT_START, DAWN_START, R)}" fill="url(#${id}-tdNight)"/>`;
	g += `<g clip-path="url(#${id}-tdNightClip)">${STARS.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".85"/>`).join('')}</g>`;
	let ticks = '';
	for (let h = 0; h < 24; h++) {
		const a = tXY(h, h % 6 ? R - 4 : R - 7.5),
			b = tXY(h, R - 0.5);
		ticks += `M${f1(a[0])},${f1(a[1])}L${f1(b[0])},${f1(b[1])}`;
	}
	g += `<path d="${ticks}" stroke="#fff" stroke-opacity=".7" stroke-width="1.1" stroke-linecap="round"/><circle cx="${DC}" cy="${DC}" r="${R}" fill="none" stroke="${FOREST}" stroke-width="1.6"/>`;
	(
		[
			[12, '12', '#ffffff'],
			[0, '00', '#c9d2ff'],
			[6, '06', '#3d2f4f'],
			[18, '18', '#3a2a1a'],
		] as const
	).forEach(([h, txt, c]) => {
		const p = tXY(h, R - 15);
		g += `<text x="${f1(p[0])}" y="${f1(p[1] + 3)}" text-anchor="middle" font-size="9" font-weight="600" font-family="ui-monospace,Menlo,monospace" fill="${c}" fill-opacity=".9">${txt}</text>`;
	});
	g += `<circle cx="${f1(tp[0])}" cy="${f1(tp[1])}" r="12.5" fill="#fff" fill-opacity=".001" stroke="#fff" stroke-opacity="${held ? 0.9 : 0}" stroke-width="1.5"/>`;
	g += skyGlyph(tp[0], tp[1], k === 'moon' ? 8 : 7, k);
	return g;
}
export function compassSVG(heading: number) {
	const a = (heading * Math.PI) / 180;
	return `<circle cx="14" cy="14" r="12" fill="#fff" stroke="#d9d5c8"/><path d="M14 14 L${f1(14 + Math.sin(a) * 10)},${f1(14 - Math.cos(a) * 10)}" stroke="${FOREST}" stroke-width="2" stroke-linecap="round"/><circle cx="${f1(14 + Math.sin(a) * 10)}" cy="${f1(14 - Math.cos(a) * 10)}" r="2.6" fill="#ffd66b" stroke="#8a5d0b"/><circle cx="14" cy="14" r="1.5" fill="${FOREST}"/>`;
}

export function medallionSVG(sky: SceneSky) {
	if (sky.preset === 'studio')
		return '<circle cx="18" cy="18" r="17" fill="#eeebe1" stroke="#d9d5c8"/><path d="M5 29h26" stroke="#b9bdb2"/>';
	const s = skyBodyAt(sky.time, sky.heading, sky.arcHeight),
		id = 'md' + ++skyUid;
	const k = skyKind(s, sky.haze),
		night = s.phase === 'night',
		tw = s.body === 'none';
	const top =
		k === 'overcast'
			? '#9aa3a8'
			: night
				? '#070b24'
				: tw
					? s.phase === 'dusk'
						? '#4b3f78'
						: '#6a5a92'
					: s.el < 14
						? '#f08a4b'
						: '#2f8fef';
	const mid =
		k === 'overcast'
			? '#d5dadc'
			: night
				? '#1d2452'
				: tw
					? '#d98a7a'
					: s.el < 14
						? '#ffc58a'
						: '#8fd0ff';
	const u = s.body === 'none' ? (s.phase === 'dusk' ? 0.9 : 0.1) : s.u,
		x = 18 + (u - 0.5) * 18,
		y = tw ? 29 : 27 - (Math.max(0, s.el) / 62) * 16;
	let g = `<defs><clipPath id="${id}c"><circle cx="18" cy="18" r="17"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".78" stop-color="${mid}"/><stop offset="1" stop-color="${night ? '#2a2f5e' : '#fff0c8'}"/></linearGradient></defs>`;
	g += `<g clip-path="url(#${id}c)"><rect width="36" height="36" fill="url(#${id}g)"/>`;
	if (night)
		g += [
			[7, 8, 0.7],
			[13, 5, 0.5],
			[26, 9, 0.6],
			[30, 15, 0.45],
			[9, 16, 0.45],
			[21, 4, 0.4],
		]
			.map(([a, b, r]) => `<circle cx="${a}" cy="${b}" r="${r}" fill="#fff" opacity=".9"/>`)
			.join('');
	g +=
		skyGlyph(x, y, k === 'moon' ? 4.4 : 4, k) +
		`<rect y="28" width="36" height="8" fill="${night ? '#1a2033' : '#b9bdb2'}"/><rect y="28" width="36" height=".8" fill="#fff" opacity=".5"/></g>`;
	return (
		g +
		`<circle cx="18" cy="18" r="17.25" fill="none" stroke="${FOREST}" stroke-opacity=".35" stroke-width="1.5"/>`
	);
}
