import { execFileSync, execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// Regression fixture for the P24A.1 normalization job (evidence spike, R1).
// Gated on tool availability: sh + shasum + the pinned CLI + the piano source
// fixture. Skips (rather than fails) where the pipeline toolchain is absent,
// because the pinned CLI is not installed on every machine that runs the fast
// lanes. A checkpoint (or any run whose whole point is this pipeline) sets
// P24A_REQUIRE_PIPELINE=1: a missing tool then fails the file loudly with the
// missing names instead of reporting a green skip. WP3T §7.6 criterion 4: a
// conditional tool skip is not evidence that the external job ran.
const editorRoot = path.resolve(__dirname, '..', '..', '..');
const repoRoot = path.resolve(editorRoot, '..', '..');
const script = path.join(editorRoot, 'assets-source', 'pipeline', 'normalize-asset.sh');
const cli = path.join(repoRoot, 'node_modules', '.bin', 'gltf-transform');
const piano = path.join(editorRoot, 'assets-source', 'models', 'grand-piano.glb');

function missingTooling(): string[] {
  const missing: string[] = [];
  try {
    execSync('command -v sh shasum', { stdio: 'ignore' });
  } catch {
    missing.push('sh/shasum on PATH');
  }
  if (!existsSync(script)) missing.push('pipeline/normalize-asset.sh');
  if (!existsSync(cli)) missing.push('node_modules/.bin/gltf-transform');
  if (!existsSync(piano)) missing.push('models/grand-piano.glb');
  return missing;
}

const missing = missingTooling();
if (process.env.P24A_REQUIRE_PIPELINE === '1' && missing.length > 0) {
  throw new Error(
    `P24A_REQUIRE_PIPELINE=1 but the normalize-asset pipeline cannot run: ${missing.join(', ')}`
  );
}

// Every case works in a fresh temp tree; the trees hold a normalized GLB each,
// so they are removed when the file finishes instead of accumulating in
// `$TMPDIR` on every lane run.
const tempTrees: string[] = [];

function tempTree(prefix: string): string {
  const base = mkdtempSync(path.join(tmpdir(), prefix));
  tempTrees.push(base);
  return base;
}

afterAll(() => {
  for (const tree of tempTrees) rmSync(tree, { recursive: true, force: true });
});

function runJob(args: string[], cwd: string): { status: number } {
  try {
    execFileSync('sh', [script, ...args], { cwd, stdio: 'pipe', timeout: 120000 });
    return { status: 0 };
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    return { status: typeof status === 'number' ? status : 1 };
  }
}

function readProvenance(outdir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(outdir, 'provenance.json'), 'utf8'));
}

describe.runIf(missing.length === 0)('normalize-asset.sh (P24A.1 pipeline fixture)', () => {
  it('produces identical content hashes on identical reruns', () => {
    const base = tempTree('p24a-rerun-');
    const first = path.join(base, 'run1');
    const second = path.join(base, 'run2');
    expect(runJob([piano, 'furniture-floor', '0.032', first], repoRoot).status).toBe(0);
    expect(runJob([piano, 'furniture-floor', '0.032', second], repoRoot).status).toBe(0);
    const a = readProvenance(first);
    const b = readProvenance(second);
    expect(a.sourceSha256).toBe(b.sourceSha256);
    expect(a.contentSha256).toBe(b.contentSha256);
    expect(a.toolVersionActual).toBe('4.4.1');
    expect(a.recipe).toBe('furniture-floor');
    expect(a.recipeVersion).toBe(1);
    expect(typeof a.recipeHash).toBe('string');
    expect(a.unitScaleToMeters).toBe(0.032);
    expect(existsSync(path.join(first, 'model.glb'))).toBe(true);
    expect(existsSync(path.join(first, 'metrics.json'))).toBe(true);
  }, 240000);

  it('rejects non-numeric, non-positive, and malformed unit scales', () => {
    const base = tempTree('p24a-scale-');
    for (const bad of ['0', '.', '1.2.3', '-2', 'NaN', 'Infinity']) {
      const dest = path.join(base, `out-${bad.replace(/[^a-zA-Z0-9]/g, '_')}`);
      expect(runJob([piano, 'furniture-floor', bad, dest], repoRoot).status).not.toBe(0);
      expect(existsSync(dest)).toBe(false);
    }
  }, 120000);

  it('replaces a pre-existing destination on success with no backup litter', () => {
    const base = tempTree('p24a-replace-');
    const dest = path.join(base, 'out');
    mkdirSync(dest, { recursive: true });
    writeFileSync(path.join(dest, 'stale.txt'), 'stale');
    expect(runJob([piano, 'furniture-floor', '0.032', dest], repoRoot).status).toBe(0);
    expect(existsSync(path.join(dest, 'model.glb'))).toBe(true);
    expect(existsSync(path.join(dest, 'stale.txt'))).toBe(false);
    expect(existsSync(`${dest}.p24a-backup`)).toBe(false);
    expect(
      readdirSync(base).filter((entry) => entry.startsWith('.p24a-stage.'))
    ).toEqual([]);
  }, 120000);

  it('canonicalizes loose-but-finite scales to valid JSON numbers', () => {
    const base = tempTree('p24a-canon-');
    for (const loose of ['01', '1.']) {
      const dest = path.join(base, `out-${loose.replace(/[^a-zA-Z0-9]/g, '_')}`);
      expect(runJob([piano, 'furniture-floor', loose, dest], repoRoot).status).toBe(0);
      const provenance = JSON.parse(readFileSync(path.join(dest, 'provenance.json'), 'utf8'));
      expect(provenance.unitScaleToMeters).toBe(1);
    }
  }, 120000);

  it('rejects unknown recipes and missing inputs without touching the destination', () => {
    const base = tempTree('p24a-reject-');
    const dest = path.join(base, 'out');
    writeFileSync(path.join(base, 'sentinel.txt'), 'untouched');
    expect(runJob([piano, 'no-such-recipe', '0.032', dest], repoRoot).status).not.toBe(0);
    expect(runJob([path.join(base, 'missing.glb'), 'furniture-floor', '0.032', dest], repoRoot).status).not.toBe(0);
    expect(existsSync(dest)).toBe(false);
  }, 120000);

  it('leaves a pre-existing destination unchanged when normalization fails', () => {
    const base = tempTree('p24a-atomic-');
    const dest = path.join(base, 'out');
    const corrupt = path.join(base, 'corrupt.glb');
    writeFileSync(corrupt, 'not a glb');
    mkdirSync(dest, { recursive: true });
    writeFileSync(path.join(dest, 'sentinel.txt'), 'untouched');
    expect(runJob([corrupt, 'furniture-floor', '0.032', dest], repoRoot).status).not.toBe(0);
    expect(readFileSync(path.join(dest, 'sentinel.txt'), 'utf8')).toBe('untouched');
    expect(existsSync(path.join(dest, 'model.glb'))).toBe(false);
  }, 120000);
});
