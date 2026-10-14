import type { LayoutDocumentWallFirst } from '@portfolio/layout-core';
import type { SceneDocument } from './scene';

/**
 * A stored Project document.
 *
 * PR #115 (WP3) — there is exactly one supported pair, so the type names it: a
 * wall-first Layout (current format) and a world-local Scene. Before this, the
 * type named the historical Layout shape while the readers accepted both, which
 * is why every call site needed a cast to compile through it.
 */
export type ProjectDocument = {
	id: string;
	name: string;
	layout: LayoutDocumentWallFirst;
	scene: SceneDocument;
};

/** Temporary app compatibility name; the durable model name is ProjectDocument. */
export type Project = ProjectDocument;

export type ProjectIssue = {
	path: string;
	code: string;
	message: string;
};

export type ProjectValidationResult =
	| { success: true; project: Project; canonicalJson: string }
	| { success: false; issues: ProjectIssue[] };
