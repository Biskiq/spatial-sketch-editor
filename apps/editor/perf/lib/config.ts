/**
 * Shared session constants for functional browser checks and the spot check.
 *
 * The spot runner passes `N0` itself. Functional acceptance specs that import
 * `NETWORK` keep the broadband profile they were written against.
 */
import type { NetworkProfile } from './browser';

export const VIEWPORT = { width: 1920, height: 1080 } as const;
export const DEVICE_SCALE_FACTOR = 1;
export const NETWORK: NetworkProfile = 'N1';
