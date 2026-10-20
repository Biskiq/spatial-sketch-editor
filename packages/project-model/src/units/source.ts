/**
 * The one declared F.2 source pair every live caller names.
 *
 * A single module so the Stage, the planners, Save and the API cannot drift on
 * the admitted kind/version string.
 */
export const UNIT_SOURCE_KIND = 'unit-envelope' as const;
export const UNIT_SOURCE_VERSION = 1 as const;
