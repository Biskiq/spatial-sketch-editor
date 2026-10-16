/**
 * The single **current-source content identity**.
 *
 * `SnapshotIdentity@1` (`references-v1`) carries two identities that are not
 * interchangeable: `acceptedRevision` is the opaque *acceptance* identity, fresh
 * on every source change including Undo/Redo, and `sourceContentId` is the
 * *content* identity, hashing the canonical serialized source. This module owns
 * the one definition of the content half, so the boot host (`T1.P01.S02`), local
 * acceptance (`T1.P01.S03`) and the conditional-Save recomputation
 * (`T3.P01.S02`) cannot disagree about what "the same content" means.
 *
 * The identity is `sha256Bytes` (the package's one cross-runtime hash primitive)
 * over the **strict writer's canonical bytes**: `serializeProject` re-validates
 * against the current format and re-serializes, so the bytes are produced by the
 * same code path that owns the only supported document pair. Consequences the
 * tests pin:
 *
 * - **Content only.** `acceptedRevision`, revision counters, allocation
 *   bookkeeping, host session state and history never enter the hash, because the
 *   input is the authored document alone.
 * - **Stable under an Undo.** Undoing back to earlier authored contents produces
 *   the same content identity, so a Camera-output rebase over identical content is
 *   `unchanged` even though the acceptance revision is fresh.
 * - **Distinct contents, distinct identities.** Different authored contents
 *   necessarily serialize differently (or the writer is not a function of the
 *   content), so equal identities mean equal authored content.
 *
 * Input key order and whitespace invariance is a property of the writer, not of a
 * normalization step here: `serializeProject` rebuilds the document from the
 * validators' own field order before serializing, so a permuted-key or
 * differently-indented input that denotes the same document yields the same bytes.
 * `T1.P01.S03`, which owns this identity's meaning, proves that invariance; this
 * module deliberately adds no second canonicalization that could drift from it.
 *
 * Runtime-safe: package-internal imports only, so the server-side recomputation
 * (`T3.P01.S02`) and a visitor runtime can compute the same identity as the editor.
 */

import { sha256Bytes } from './package-sha';
import { serializeProject } from './project-codec';

/**
 * The current-source content identity of one authored source.
 *
 * Throws `ProjectValidationError` when the strict writer refuses the document.
 * That is deliberate rather than a fabricated identity: a caller that reaches the
 * identity of an unvalidated source would otherwise label it with a digest that
 * no reader could reproduce, and every caller in this batch holds an already
 * validated source (boot validates before it admits, acceptance validates before
 * it mints a revision).
 */
export async function computeSourceContentId(source: unknown): Promise<string> {
	const canonical = serializeProject(source);
	return sha256Bytes(new TextEncoder().encode(canonical));
}
