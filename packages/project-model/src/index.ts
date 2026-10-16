export * from '@portfolio/layout-core';
export * from './references';
export * from './channels';
/**
 * The one strict shape reader's result vocabulary. The reader itself stays
 * internal: the shared foundation interfaces expose validators, not a generic
 * object bag a caller could use to admit its own shapes.
 */
export type { ShapeIssue, ShapeValidation } from './strict-shape';
export * from './package-format';
export * from './package-sha';
export * from './runtime';
export * from './project-codec';
// T1.P01.S03 — the one current-source content identity, and the F.4 acceptance
// contract, intent reader, planner registry and current-source admission.
// (Appended: barrels are append-only for the 2026-10-16 parallel batch.)
export * from './content-identity';
export * from './f4';
export * from './project-layout-semantics';
export * from './project-types';
export * from './scene';
export * from './scene-codec';
export * from './wall-first-project';
export * from './shipped-static';
export * from './scene-planning';
