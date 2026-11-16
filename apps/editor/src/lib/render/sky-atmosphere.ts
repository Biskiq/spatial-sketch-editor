import { SCENE_SKY_DEFAULT, sunShadowRadius, type SceneSky } from '@portfolio/project-model/units';
import { DAWN_START, NIGHT_START, SUNRISE, SUNSET, skyBodyAt, skyDirection } from './sky-time';

type LinearRgb = readonly [number, number, number];

function fromHex(hex: string): LinearRgb {
	function channel(index: number): number {
		const value = parseInt(hex.slice(index, index + 2), 16) / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	}
	return [channel(1), channel(3), channel(5)];
}

export function srgbByte(linear: number): number {
	const value = Math.min(1, Math.max(0, linear));
	return Math.round(255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055));
}

function blend(a: number, b: number, amount: number): number {
	return a + (b - a) * amount;
}

export function mixSkyColor(a: LinearRgb, b: LinearRgb, amount: number): LinearRgb {
	return [blend(a[0], b[0], amount), blend(a[1], b[1], amount), blend(a[2], b[2], amount)];
}

function tint(user: string, reference: LinearRgb): LinearRgb {
	const [r, g, b] = fromHex(user);
	return [Math.min(r / reference[0], 2.5), Math.min(g / reference[1], 2.5), Math.min(b / reference[2], 2.5)];
}

function applyTint(a: LinearRgb, b: LinearRgb): LinearRgb {
	return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
}

function desaturate(color: LinearRgb, amount: number): LinearRgb {
	const grey = (0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]) * 1.1;
	return mixSkyColor(color, [grey, grey, grey], amount);
}

function smoothstep(min: number, max: number, value: number): number {
	const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
	return t * t * (3 - 2 * t);
}

function frame(angle: number, fill: number, zenith: string, horizon: string, ground: string,
	fillSky: string, fillGround: string, sun: string) {
	return {
		angle, fill, zenith: fromHex(zenith), horizon: fromHex(horizon), ground: fromHex(ground),
		fillSky: fromHex(fillSky), fillGround: fromHex(fillGround), sun: fromHex(sun)
	};
}

const frames = [
	frame(-12, 0.25, '#0b1226', '#1f2a44', '#1a1d22', '#2a3552', '#15171c', '#ff9e5e'),
	frame(0, 0.7, '#25313e', '#8b6e5d', '#45473c', '#5b6884', '#3a342c', '#ff9e5e'),
	frame(15, 1.2, '#e2a676', '#f8e4c2', '#e2c99e', '#ffe6c4', '#a07e58', '#ffc985'),
	frame(40, 1.5, '#b7cfcd', '#eef0e6', '#e0e4d3', '#f4f7f2', '#b9b49c', '#fff6df')
] as const;
const skyReference = fromHex(SCENE_SKY_DEFAULT.skyColor);
const groundReference = fromHex(SCENE_SKY_DEFAULT.groundColor);

export function resolveSkyLook(sky: SceneSky) {
	const body = skyBodyAt(sky.time, sky.heading, sky.arcHeight);
	const dusk = body.phase === 'dusk';
	const twilight = body.body === 'none';
	const progress = dusk
		? (sky.time - SUNSET) / (NIGHT_START - SUNSET)
		: (sky.time - DAWN_START) / (SUNRISE - DAWN_START);
	const angle = twilight
		? blend(dusk ? 4 : -12, dusk ? -12 : 4, progress)
		: body.body === 'sun' ? body.el : -12;
	const index = frames.findIndex((key) => key.angle >= Math.min(40, angle));
	const upper = frames[Math.max(0, index)]!;
	const lower = frames[Math.max(0, index - 1)]!;
	const amount = upper === lower ? 0 : (Math.min(40, angle) - lower.angle) / (upper.angle - lower.angle);
	const sample = (key: 'zenith' | 'horizon' | 'ground' | 'fillSky' | 'fillGround' | 'sun') =>
		mixSkyColor(lower[key], upper[key], amount);
	const skyTint = tint(sky.skyColor, skyReference);
	const groundTint = tint(sky.groundColor, groundReference);
	const overcast = smoothstep(60, 100, sky.haze);
	const lightScale = 2 ** sky.exposure;
	const fade = smoothstep(4, 12, body.el);
	const horizon = desaturate(applyTint(sample('horizon'), skyTint), 0.8 * overcast);
	const visibility = 20000 * (60 / 20000) ** (sky.haze / 100);

	return {
		body,
		direction: skyDirection(body.az, twilight ? 4 : body.el),
		lightColor: body.body === 'moon' ? fromHex(sky.moon.color) : sample('sun'),
		lightIntensity: fade * lightScale * (body.body === 'sun'
			? 1.9 * (1 - 0.7 * overcast)
			: 0.6 * sky.moon.strength),
		castShadow: sky.sunShadows,
		shadowRadius: sunShadowRadius(sky.softness),
		zenith: desaturate(applyTint(sample('zenith'), skyTint), 0.8 * overcast),
		horizon,
		glow: twilight ? {
			bearing: body.az, color: fromHex(dusk ? '#e9a77a' : '#d8b0c8'),
			strength: 1 - Math.abs(progress - 0.5) * 2
		} : null,
		ground: applyTint(sample('ground'), groundTint),
		groundFar: horizon,
		hemisphere: {
			skyColor: applyTint(sample('fillSky'), skyTint),
			groundColor: applyTint(sample('fillGround'), groundTint),
			intensity: blend(lower.fill, upper.fill, amount) * (1 + 0.4 * overcast) * lightScale
		},
		ambient: 0.12 * lightScale,
		fog: { color: horizon, density: sky.haze === 0 ? 0 : Math.sqrt(Math.log(50)) / visibility }
	};
}
