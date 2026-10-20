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
// T3.P01.S04 — the current-source reader, serializer, runtime and admission are
// retired. The one live source is the F.2 envelope at the explicit `./units`
// subpath; the F.4 acceptance contract here is source-agnostic and its F.2
// adapter lives behind that subpath too.
export * from './f4';
export * from './project-layout-semantics';
export * from './project-types';
export * from './scene';
export * from './scene-codec';
export * from './shipped-static';
// Scene planning is F.2-native (it reads and replaces unit payloads), so it is the
// explicit `./scene-planning` subpath. Exporting it here would drag the unit
// envelope into the root barrel's closure, which the F.2 entry boundary forbids.
