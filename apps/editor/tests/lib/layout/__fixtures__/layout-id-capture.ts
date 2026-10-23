/**
 * T1.P02.S01 §1 — test captures for Layout identity.
 *
 * A capture is minted **per operation**, outside the document. A test that
 * performs two operations must therefore mint two captures; reusing one is the
 * collision case the planner refuses. `freshCapture()` is the ordinary helper;
 * `capturedId()` is how an expectation expresses the new contract instead of a
 * literal allocation-order id.
 */
import { layoutCapturedId, mintLayoutIdCapture, type LayoutIdCapture } from '@portfolio/layout-core';

/** One fresh capture. The nonce is opaque and never parsed by production code. */
export function freshCapture(): LayoutIdCapture {
	return mintLayoutIdCapture();
}

/** A readable capture for a test that wants to derive its expected ids. */
export function captureFor(nonce: string): LayoutIdCapture {
	return mintLayoutIdCapture(() => nonce);
}

/** The id this capture derives for an allocator's seed. */
export function capturedId(capture: LayoutIdCapture, seed: string): string {
	return layoutCapturedId(capture, seed);
}
