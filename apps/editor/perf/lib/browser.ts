/**
 * Measured browser sessions for the on-demand harness (T3.P03.S02).
 *
 * Never a user profile; Playwright's own browser cache supplies Chromium and
 * (where installed) branded Chrome. Cache states follow the performance
 * contract: cold is a fresh context per measured run with cache/cookies cleared
 * and service workers blocked, warm is a second navigation in one context, and
 * repeat-use cycles that same context without clearing.
 */

import type { Browser, BrowserContext, CDPSession, Page } from '@playwright/test';

import type { EarlyStopDecision } from './early-stop';
import { perfInitScript, type HarnessOptions } from './ledger';

/** The performance contract's gating and proposed network profiles. */
export const NETWORK_PROFILES = {
	/** Unthrottled loopback: developer iteration only, never a gate. */
	N0: { latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
	/** Broadband: the gating profile for viewer and editor. */
	N1: { latency: 40, downloadThroughput: 2_500_000, uploadThroughput: 625_000 },
	/** Constrained: reported for the viewer only, a target. */
	N2: { latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750 }
} as const;

export type NetworkProfile = keyof typeof NETWORK_PROFILES;
export type CacheState = 'cold' | 'warm' | 'repeat-use';

export type MeasuredSession = {
	readonly context: BrowserContext;
	readonly page: Page;
	readonly cdp: CDPSession;
	readonly cacheState: CacheState;
	readonly network: NetworkProfile;
	readonly cpuRate: number;
	close(): Promise<void>;
};

export type MeasuredSessionOptions = {
	readonly viewport: { readonly width: number; readonly height: number };
	readonly deviceScaleFactor: number;
	readonly network?: NetworkProfile;
	/** CDP `Emulation.setCPUThrottlingRate`; 1 means unthrottled. */
	readonly cpuRate?: number;
	readonly cacheState?: CacheState;
	readonly harness?: HarnessOptions;
};

export async function newMeasuredSession(
	browser: Browser,
	options: MeasuredSessionOptions
): Promise<MeasuredSession> {
	const network = options.network ?? 'N1';
	const cpuRate = options.cpuRate ?? 1;
	const cacheState = options.cacheState ?? 'cold';
	const context = await browser.newContext({
		viewport: options.viewport,
		deviceScaleFactor: options.deviceScaleFactor,
		serviceWorkers: cacheState === 'cold' ? 'block' : 'allow',
		reducedMotion: 'no-preference',
		locale: 'en-US',
		timezoneId: 'UTC'
	});
	try {
		await context.addInitScript(perfInitScript, options.harness ?? {});
		const page = await context.newPage();
		const cdp = await context.newCDPSession(page);
		await cdp.send('Network.enable');
		const profile = NETWORK_PROFILES[network];
		await cdp.send('Network.emulateNetworkConditions', {
			offline: false,
			latency: profile.latency,
			downloadThroughput: profile.downloadThroughput,
			uploadThroughput: profile.uploadThroughput
		});
		if (cpuRate !== 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
		if (cacheState === 'cold') await clearBrowserState(cdp);
		return {
			context,
			page,
			cdp,
			cacheState,
			network,
			cpuRate,
			async close() {
				await context.close();
			}
		};
	} catch (error) {
		await context.close();
		throw error;
	}
}

/**
 * The contract's cold state, applied before the first navigation: an empty HTTP
 * cache and no cookies. Service workers are blocked at the context level, so
 * there is no third store to clear.
 */
export async function clearBrowserState(cdp: CDPSession): Promise<void> {
	await cdp.send('Network.clearBrowserCache');
	await cdp.send('Network.clearBrowserCookies');
}

/** JS heap used after a forced GC, in MiB. */
export async function heapUsedMiB(cdp: CDPSession): Promise<number> {
	await cdp.send('Performance.enable');
	await cdp.send('HeapProfiler.enable');
	await cdp.send('HeapProfiler.collectGarbage');
	const metrics = await cdp.send('Performance.getMetrics');
	const used = metrics.metrics.find((metric: { name: string }) => metric.name === 'JSHeapUsedSize');
	return used === undefined ? Number.NaN : used.value / (1024 * 1024);
}

export type MeasuredRunPlan<T = unknown> = {
	readonly cacheState: CacheState;
	readonly warmup: number;
	/** The planned minimum measured runs; an extension may raise it below. */
	readonly runs: number;
	/** Called once per session before any measured navigation (e.g. F9's cookie). */
	readonly prepare?: (session: MeasuredSession) => Promise<void>;
	/** Called after each warm/repeat-use run to close the cycle boundary. */
	readonly afterRun?: (page: Page) => Promise<void>;
	/**
	 * Optional decisive-failure stop, evaluated after each measured run with the
	 * results so far. A decision ends the series early; the caller must record it
	 * as a demonstrated failure with a partial sample count, never as a pass.
	 */
	readonly earlyStop?: (results: readonly T[], completedRuns: number) => EarlyStopDecision | null;
	/**
	 * Optional bounded adaptive escalation (the S06 milestone method): after the
	 * planned minimum, return the larger number of measured runs to collect, or
	 * `null` to stop. Called after every measured run that meets or exceeds the
	 * planned minimum, so the caller may stop as soon as its rows are decided.
	 * The returned target must be greater than the completed count and no larger
	 * than {@link maxRuns}; anything else is a harness error, never a silent stop.
	 * Escalation is additional **independent runs**, never extra pointer samples
	 * inside one run, and it is evaluated on the rows' per-run statistics.
	 */
	readonly extendRuns?: (results: readonly T[], completedRuns: number) => number | null;
	/** The hard ceiling for {@link extendRuns}; required to use it. */
	readonly maxRuns?: number;
};

export type CollectedRuns<T> = {
	readonly results: T[];
	readonly facts: Record<string, string>;
	/** Set only when the series stopped on a decisive hard-budget failure. */
	readonly earlyStop: EarlyStopDecision | null;
	/** Measured runs actually completed (the full plan unless stopped). */
	readonly measuredRuns: number;
};

/**
 * The next target after a measured run: the planned count, a validated
 * extension, or the count reached when the row is decided (null from the hook).
 * A hook cannot shrink the series or exceed its declared ceiling.
 */
function nextTarget<T>(plan: MeasuredRunPlan<T>, results: readonly T[], target: number): number {
	if (plan.extendRuns === undefined || results.length < plan.runs) return target;
	const requested = plan.extendRuns(results, results.length);
	if (requested === null) return results.length;
	if (!Number.isInteger(requested) || requested <= results.length) {
		throw new Error(`extendRuns must return a target above ${results.length} runs, not ${requested}`);
	}
	if (plan.maxRuns === undefined || requested > plan.maxRuns) {
		throw new Error(`extendRuns returned ${requested} runs, outside the declared maximum ${plan.maxRuns ?? 'none'}`);
	}
	return requested;
}

/**
 * Run a flow's warm-up and measured runs under the contract's cache states.
 *
 * Cold creates a **new context for every run** (the contract's definition),
 * not one context with the cache cleared; warm and repeat-use keep one context
 * so the HTTP cache and V8 code cache stay populated, and repeat-use calls
 * `afterRun` between cycles.
 */
export async function collectMeasuredRuns<T>(
	browser: Browser,
	options: Omit<MeasuredSessionOptions, 'cacheState'>,
	plan: MeasuredRunPlan<T>,
	run: (session: MeasuredSession) => Promise<T>
): Promise<CollectedRuns<T>> {
	const results: T[] = [];
	if (plan.cacheState === 'cold') {
		let facts: Record<string, string> = {};
		for (let index = 0; index < plan.warmup; index++) {
			await withSession(browser, { ...options, cacheState: 'cold' }, plan.prepare, run);
		}
		let target = plan.runs;
		for (let index = 0; index < target; index++) {
			await withSession(browser, { ...options, cacheState: 'cold' }, plan.prepare, async (session) => {
				// Browser facts are constant for the flow; reading them on every cold
				// run repeated three evaluates per context for the same answer.
				if (Object.keys(facts).length === 0) facts = await browserFacts(browser, session.page);
				results.push(await run(session));
			});
			const stop = plan.earlyStop?.(results, index + 1) ?? null;
			if (stop !== null) return { results, facts, earlyStop: stop, measuredRuns: results.length };
			target = nextTarget(plan, results, target);
		}
		return { results, facts, earlyStop: null, measuredRuns: results.length };
	}
	const session = await newMeasuredSession(browser, { ...options, cacheState: plan.cacheState });
	try {
		await plan.prepare?.(session);
		const facts = await browserFacts(browser, session.page);
		for (let index = 0; index < plan.warmup; index++) {
			await run(session);
			await plan.afterRun?.(session.page);
		}
		let target = plan.runs;
		for (let index = 0; index < target; index++) {
			results.push(await run(session));
			const stop = plan.earlyStop?.(results, index + 1) ?? null;
			if (stop !== null) return { results, facts, earlyStop: stop, measuredRuns: results.length };
			target = nextTarget(plan, results, target);
			if (results.length < target) await plan.afterRun?.(session.page);
		}
		return { results, facts, earlyStop: null, measuredRuns: results.length };
	} finally {
		await session.close();
	}
}

async function withSession<T>(
	browser: Browser,
	options: MeasuredSessionOptions,
	prepare: ((session: MeasuredSession) => Promise<void>) | undefined,
	run: (session: MeasuredSession) => Promise<T>
): Promise<T> {
	const session = await newMeasuredSession(browser, options);
	try {
		await prepare?.(session);
		return await run(session);
	} finally {
		await session.close();
	}
}

/**
 * Browser and platform version facts recorded with every result.
 * `chromeVersion` is the launched binary's own version: the `Desktop Chrome`
 * device descriptor overrides the user agent with Playwright's bundled
 * Chromium version, so the UA token (`userAgentChrome`) can name another build.
 */
export async function browserFacts(browser: Browser, page: Page): Promise<Record<string, string>> {
	const ua = await page.evaluate(() => navigator.userAgent);
	const userAgentChrome = /Chrome\/([\d.]+)/.exec(ua)?.[1] ?? 'unknown';
	const platform = await page.evaluate(() => (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform);
	return { browserVersion: browser.version(), chromeVersion: browser.version(), userAgentChrome, platform, userAgent: ua };
}
