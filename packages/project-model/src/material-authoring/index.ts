/**
 * Manual material composition and correctable set import (T2.S8 E5).
 *
 * Authoring-only: the editor and agents import this subpath; visitor, release
 * and cold-runtime code never does (the preview/public surface boundary
 * forbids it). Runtime-safe material contracts stay on
 * `@portfolio/project-model/materials`.
 */
export * from './types';
export * from './proposal';
export * from './draft';
