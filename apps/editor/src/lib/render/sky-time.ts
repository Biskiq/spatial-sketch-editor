export const SUNRISE = 6.5;
export const SOLAR_NOON = 13;
export const SUNSET = 19.5;
export const NIGHT_START = 21;
export const DAWN_START = 4.5;
export const phaseStarts = [DAWN_START, SUNRISE, SUNSET, NIGHT_START] as const;
const NIGHT_HOURS = 7.5;
const MOON_PEAK = 38;
const RADIANS = Math.PI / 180;

function wrap(value: number, period: number): number {
	return ((value % period) + period) % period;
}

export const wrap24 = (time: number): number => wrap(time, 24);
export const wrap360 = (degrees: number): number => wrap(degrees, 360);

export type SkyBody =
	| { phase: 'day'; body: 'sun'; u: number; az: number; el: number }
	| { phase: 'night'; body: 'moon'; u: number; az: number; el: number }
	| { phase: 'dawn' | 'dusk'; body: 'none'; u: null; az: number; el: number };

export function skyBodyAt(time: number, heading: number, arcHeight: number): SkyBody {
	const hour = wrap24(time);
	if (hour >= SUNRISE && hour <= SUNSET) {
		const u = (hour - SUNRISE) / (SUNSET - SUNRISE);
		return {
			phase: 'day',
			body: 'sun',
			u,
			az: wrap360(heading - 90 + 180 * u),
			el: u === 0 || u === 1 ? 4 : 4 + (arcHeight - 4) * Math.sin(Math.PI * u),
		};
	}
	if (hour >= NIGHT_START || hour < DAWN_START) {
		const u = wrap24(hour - NIGHT_START) / NIGHT_HOURS;
		return {
			phase: 'night',
			body: 'moon',
			u,
			az: wrap360(heading - 90 + 180 * u),
			el: 4 + (MOON_PEAK - 4) * Math.sin(Math.PI * u),
		};
	}
	const phase = hour > SUNSET ? 'dusk' : 'dawn';
	return {
		phase,
		body: 'none',
		u: null,
		az: wrap360(heading + (phase === 'dusk' ? 90 : -90)),
		el: -4,
	};
}

export function skyDirection(azimuth: number, elevation: number): [number, number, number] {
	const az = azimuth * RADIANS;
	const el = elevation * RADIANS;
	return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

export function phaseName(time: number): string {
	const hour = wrap24(time);
	switch (skyBodyAt(hour, 0, 62).phase) {
		case 'day':
			if (Math.abs(hour - SOLAR_NOON) < 1 / 24) return 'Solar noon';
			return hour < SOLAR_NOON ? 'Morning' : 'Afternoon';
		case 'night':
			return 'Night · Moon';
		case 'dusk':
			return 'Dusk · no direct light';
		case 'dawn':
			return 'Dawn · no direct light';
	}
}

export function hhmm(time: number): string {
	const minutes = wrap(Math.round(time * 60), 24 * 60);
	return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function snapTime(time: number): number {
	return wrap(Math.round(time * 12), 24 * 12) / 12;
}

export function adjacentPhaseStart(time: number, step: -1 | 1): number {
	const hour = wrap24(time);
	if (step === 1) return phaseStarts.find((start) => start > hour) ?? DAWN_START;
	return phaseStarts.findLast((start) => start < hour) ?? NIGHT_START;
}

export function skyKind(
	body: SkyBody,
	haze: number,
): 'twilight' | 'moon' | 'overcast' | 'low' | 'sun' {
	if (body.body === 'none') return 'twilight';
	if (body.body === 'moon') return 'moon';
	if (haze >= 80) return 'overcast';
	return body.el < 14 ? 'low' : 'sun';
}
