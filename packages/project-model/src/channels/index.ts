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
 * Stage/viewport provider (T1.P01.S02) owns the one inspection controller, and
 * the Camera authority evaluates pose and projection.
 */

export * from './types';
export * from './validate';
export * from './families';
export * from './negotiate';
export * from './camera-output';
