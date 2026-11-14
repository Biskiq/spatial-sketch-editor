/**
 * F.3 `inspection-v1` — the shared channel address/value/negotiation provider
 * (AM-3), including the Camera-output ticket protocol.
 *
 * Exports: addresses, descriptors, typed values, the v1 families, strict
 * validation, negotiation/conflict/replacement/union rules, family satisfaction
 * and the Camera-output acquire/request/replace/return/cancel ticket protocol.
 * Runtime-safe: no editor, renderer, Svelte or Three import reaches this module.
 *
 * There is no evaluator, output controller, projection or navigation here — the
 * Stage/viewport provider owns the one inspection controller, and
 * the Camera authority evaluates pose and projection.
 */

export * from './types';
export * from './validate';
export * from './families';
export * from './negotiate';
export * from './camera-output';
// The complete `camera-handoff-v1` over that protocol: guided/free
// ownership, Follow/Look-through/Preview, return and stale-run cleanup.
// Appended: barrels are append-only for the batch.
export * from './handoff';
