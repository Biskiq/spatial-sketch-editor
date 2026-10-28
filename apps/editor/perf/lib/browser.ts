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
