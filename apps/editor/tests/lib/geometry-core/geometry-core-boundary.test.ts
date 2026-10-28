import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GEOMETRY_CORE_EVALUATOR_VERSION } from '@portfolio/geometry-core';
import { parseModuleSpecifiers, stripComments } from '../../helpers/import-closure';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, '../../../../../packages/geometry-core');
const sourceRoot = resolve(packageRoot, 'src');

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const entry = pending.pop()!;
    const stat = statSync(entry);
    if (stat.isDirectory()) {
      for (const child of readdirSync(entry)) pending.push(resolve(entry, child));
    } else if (entry.endsWith('.ts')) {
      files.push(entry);
    }
  }
  return files.sort();
}

describe('geometry-core boundary', () => {
  const files = sourceFiles(sourceRoot);

  it('evaluates under one pinned evaluator version', () => {
    expect(GEOMETRY_CORE_EVALUATOR_VERSION).toBe(1);
    expect(files.length).toBeGreaterThan(0);
  });

  it('imports only its two admitted libraries and relative modules', () => {
    for (const path of files) {
      const source = stripComments(readFileSync(path, 'utf8'));
      for (const specifier of parseModuleSpecifiers(source)) {
        if (specifier.startsWith('.')) continue;
        expect(
          ['earcut', 'robust-predicates'].includes(specifier),
          `${relative(packageRoot, path)} imports "${specifier}"`
        ).toBe(true);
      }
      expect(source, relative(packageRoot, path)).not.toMatch(
        /from\s*['"][^'"]*(@portfolio\/|\$lib|\/apps\/|svelte|@threlte|three)/
      );
    }
  });

  it('keeps canonical arithmetic to the admitted operations', () => {
    const forbidden =
      /\bMath\.(sin|cos|tan|asin|acos|atan|atan2|exp|log|pow|hypot|cbrt|expm1|log1p|sinh|cosh|tanh|random)\b|\*\*/;
    for (const path of files) {
      const source = stripComments(readFileSync(path, 'utf8'));
      expect(source, relative(packageRoot, path)).not.toMatch(forbidden);
    }
  });

  it('carries no DOM or browser global', () => {
    const forbidden = /\b(window|document|navigator|HTMLElement|WebGL\w*)\b/;
    for (const path of files) {
      const source = stripComments(readFileSync(path, 'utf8'));
      expect(source, relative(packageRoot, path)).not.toMatch(forbidden);
    }
  });

  it('declares exactly the two admitted runtime dependencies', () => {
    const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      'earcut',
      'robust-predicates'
    ]);
  });
});
