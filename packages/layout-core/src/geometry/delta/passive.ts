import type { CompiledLayoutGeometry, LayoutGeometryIssue } from '../types';
import type { LayoutDocumentWallFirst } from '../../wall/types';
import { verifiedFrozenSource } from './snapshots';

type PassiveCompileRecord = {
	readonly geometry: CompiledLayoutGeometry;
	readonly issues: readonly LayoutGeometryIssue[];
	/** Only clean records seed a compile store. */
	readonly clean: boolean;
	/** The document already carried a deep immutable-JSON proof when this was
	 * recorded, so the record is its compile for as long as the object lives.
	 * A shallow freeze proves nothing. */
	readonly sealed: boolean;
};

export const PASSIVE_COMPILE_BY_DOC = new WeakMap<LayoutDocumentWallFirst, PassiveCompileRecord>();

export function readPassiveCompiledGeometry(
	document: LayoutDocumentWallFirst,
): PassiveCompileRecord | undefined {
	return PASSIVE_COMPILE_BY_DOC.get(document);
}

/** Record a clean result. Sealing is proven once per document: O(1) once the
 * immutable-JSON proof exists, one deep check that mints it otherwise. Warming
 * can restore a proven retained root in O(1), or build retained indexes in O(N)
 * when this is only a passive result. */
export function recordPassiveCompiledGeometry(
	document: LayoutDocumentWallFirst,
	geometry: CompiledLayoutGeometry,
	issues: readonly LayoutGeometryIssue[] = [],
): void {
	if (issues.length > 0) return;
	PASSIVE_COMPILE_BY_DOC.set(document, {
		geometry,
		issues,
		clean: true,
		sealed: verifiedFrozenSource(document),
	});
}

/** The session-less compile records every canonical result, issues
 * included; a record with issues is read back verbatim but never seeds. */
export function recordSessionlessCompile(
	document: LayoutDocumentWallFirst,
	geometry: CompiledLayoutGeometry,
	issues: readonly LayoutGeometryIssue[],
): void {
	PASSIVE_COMPILE_BY_DOC.set(document, {
		geometry,
		issues,
		clean: issues.length === 0,
		sealed: verifiedFrozenSource(document),
	});
}
