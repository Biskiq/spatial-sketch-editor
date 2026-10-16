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
export * from './project-layout-semantics';
export * from './project-types';
export * from './scene';
export * from './scene-codec';
export * from './wall-first-project';
export * from './shipped-static';
export * from './scene-planning';
