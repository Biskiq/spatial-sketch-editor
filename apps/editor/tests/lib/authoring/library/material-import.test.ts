import { describe, expect, it, vi } from 'vitest';
import {
	createMaterialImportSession,
	titleCaseStem,
	validateImportName,
	validateImportSize
} from '$lib/authoring/library/material-import.svelte';
import { createMaterialProofRegistry } from '$lib/authoring/material-proof';

/** Minimal valid 1x1 RGB PNG bytes for deterministic header probing. */
const TINY_PNG = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
	0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54,
	0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
	0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0,
	0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
	0xae, 0x42, 0x60, 0x82
]);

function pngFile(name: string): File {
	return new File([TINY_PNG], name, { type: 'image/png' });
}

describe('Material import session over E5 (T2.S8 U6)', () => {
	it('validates physical size (0.05–20 m), name (1–120 chars), and title-cases stem', () => {
		expect(titleCaseStem('rough_oak')).toBe('Rough Oak');
		expect(validateImportSize('1.2')).toEqual({ ok: true, value: 1.2 });
		expect(validateImportSize('0.01').ok).toBe(false);
		expect(validateImportSize('25').ok).toBe(false);
		expect(validateImportName('Rough Oak')).toEqual({ ok: true, value: 'Rough Oak' });
		expect(validateImportName('   ').ok).toBe(false);
		expect(validateImportName('a'.repeat(121)).ok).toBe(false);
	});

	it('detects collisions and generic normal acknowledgement, then becomes ready once resolved', async () => {
		const proofs = createMaterialProofRegistry();
		const session = createMaterialImportSession({
			acceptHost: () => null,
			expectedRevision: () => ({ projectId: 'p1', revisionId: 'r1' }),
			materialProofs: () => proofs
		});

		await session.start(
			[
				pngFile('RoughOak_Color.png'),
				pngFile('RoughOak_Normal.png'),
				pngFile('RoughOak_ORM.png'),
				pngFile('RoughOak_Gloss.png')
			],
			[
				{ kind: 'surface', surface: { kind: 'wall-side', wallId: 'w1', side: 'left' }, label: 'Wall 1' },
				{ kind: 'entity', id: 'e1', label: 'Table' }
			]
		);

		expect(session.open).toBe(true);
		expect(session.phase).toBe('ready');
		expect(session.blockingCount()).toBe(2); // roughness collision + generic normal ack
		expect(session.isReady()).toBe(false);

		// Mixed kinds select one domain at a time
		expect(session.selectedTargets()).toHaveLength(1);
		session.setTargetKind('scene');
		expect(session.selectedTargets()[0]).toMatchObject({ kind: 'entity', id: 'e1' });

		// Resolve collision
		const conflict = session.candidate!.conflicts.find((c) => c.role === 'roughness')!;
		session.chooseConflict('roughness', conflict.files[0]!);
		expect(session.blockingCount()).toBe(1);

		// Reopen collision via Change
		session.reopenConflict('roughness');
		expect(session.blockingCount()).toBe(2);
		session.chooseConflict('roughness', conflict.files[0]!);

		// Acknowledge generic normal
		session.setNormalAck(true);
		expect(session.blockingCount()).toBe(0);
		expect(session.isReady()).toBe(true);

		// Cancel aborts and closes cleanly
		expect(session.cancel(false)).toBe(true);
		expect(session.open).toBe(false);
	});

	it('discards out-of-order preparation and results from a cancelled session', async () => {
		const proofs = createMaterialProofRegistry();
		const session = createMaterialImportSession({
			acceptHost: () => null,
			expectedRevision: () => ({ projectId: 'p1', revisionId: 'r1' }),
			materialProofs: () => proofs
		});
		await session.start([pngFile('oak_albedo.png')], []);
		const original = proofs.prepareFinishRegistration.bind(proofs);
		const pending: Array<{
			release: () => void;
			result: ReturnType<typeof original>;
		}> = [];
		const spy = vi.spyOn(proofs, 'prepareFinishRegistration').mockImplementation((recipe) => {
			let release!: () => void;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			const result = Promise.all([original(recipe), gate]).then(([proof]) => proof);
			pending.push({ release, result });
			return result;
		});
		async function finishPreparation(index: number) {
			const { release, result } = pending[index]!;
			release();
			await result;
			// Let the session consume the settled proof through prepareDraft.
			await Promise.resolve();
		}

		session.setName('Earlier');
		session.setName('Later');
		expect(pending).toHaveLength(2);
		await finishPreparation(1);
		expect(session.prepared?.name).toBe('Later');
		await finishPreparation(0);
		expect(session.prepared?.name).toBe('Later');

		session.setName('Cancelled');
		expect(pending).toHaveLength(3);
		session.cancel(false);
		spy.mockRestore();
		await session.start([pngFile('maple_albedo.png')], []);
		expect(session.prepared?.name).toBe('Maple');
		await finishPreparation(2);
		expect(session.prepared?.name).toBe('Maple');
		session.cancel(false);
	});

	it('requires review again when the accepted project revision changes', async () => {
		const proofs = createMaterialProofRegistry();
		const accept = vi.fn();
		let revision = 'r1';
		const session = createMaterialImportSession({
			acceptHost: () => ({ accept }) as never,
			expectedRevision: () => ({ projectId: 'p1', revisionId: revision }),
			materialProofs: () => proofs
		});
		await session.start([pngFile('oak_albedo.png')], []);
		revision = 'r2';
		expect(await session.accept()).toBe(false);
		expect(accept).not.toHaveBeenCalled();
		expect(session.errorMessage).toContain('project changed');
		expect(session.proposal?.expectedRevision).toBe('r2');
		session.cancel(false);
	});

	it('does not accept a draft if a field changes while acceptance is preparing', async () => {
		const proofs = createMaterialProofRegistry();
		const accept = vi.fn();
		const session = createMaterialImportSession({
			acceptHost: () => ({ accept }) as never,
			expectedRevision: () => ({ projectId: 'p1', revisionId: 'r1' }),
			materialProofs: () => proofs
		});
		await session.start([pngFile('oak_albedo.png')], []);
		const original = proofs.prepareFinishRegistration.bind(proofs);
		let release: (() => void) | undefined;
		vi.spyOn(proofs, 'prepareFinishRegistration').mockImplementationOnce(async (recipe) => {
			const result = await original(recipe);
			await new Promise<void>((resolve) => { release = resolve; });
			return result;
		});
		const accepting = session.accept();
		await vi.waitFor(() => expect(release).toBeDefined());
		session.setName('Changed');
		release!();
		expect(await accepting).toBe(false);
		expect(accept).not.toHaveBeenCalled();
		expect(session.phase).toBe('ready');
		session.cancel(false);
	});

	it('auto-settles a clean vendor set (_gl + _arm) with zero blocking questions', async () => {
		const proofs = createMaterialProofRegistry();
		const session = createMaterialImportSession({
			acceptHost: () => null,
			expectedRevision: () => ({ projectId: 'p1', revisionId: 'r1' }),
			materialProofs: () => proofs
		});

		await session.start(
			[
				pngFile('rough_oak_color.png'),
				pngFile('rough_oak_normal_gl.png'),
				pngFile('rough_oak_orm.png')
			],
			[]
		);

		expect(session.normalDetected).toBe(true);
		expect(session.blockingCount()).toBe(0);
		expect(session.isReady()).toBe(true);

		// Clicking Change on detected normal reopens the segment and requires ack
		session.reopenNormalChoice();
		expect(session.normalDetected).toBe(false);
		expect(session.normalAck).toBe(false);
		expect(session.isReady()).toBe(false);

		session.cancel(false);
	});
});
