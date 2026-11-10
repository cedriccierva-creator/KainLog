import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = path.join(root, 'scripts', 'validate-foods.mjs');
const source = path.join(root, 'src', 'data', 'foods.ph.json');
const scratch = mkdtempSync(path.join(tmpdir(), 'kainlog-validator-'));

function run(file: string) {
  return spawnSync(process.execPath, [script, file], { cwd: root, encoding: 'utf8' });
}

function corruptCopy(mutate: (foods: { category: string }[]) => void): string {
  const foods = JSON.parse(readFileSync(source, 'utf8')) as { category: string }[];
  mutate(foods);
  const file = path.join(scratch, 'foods.json');
  writeFileSync(file, JSON.stringify(foods));
  return file;
}

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe('validate:foods', () => {
  it('passes the shipped seed file', () => {
    const result = run(source);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('All checks passed');
  });

  it('fails when a seed food uses the "other" import fallback', () => {
    const file = corruptCopy((foods) => {
      foods[0].category = 'other';
    });

    const result = run(file);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is the import fallback and must not be used in seed data');
  });

  it('still fails when a category is genuinely unknown', () => {
    const file = corruptCopy((foods) => {
      foods[0].category = 'not-a-category';
    });

    const result = run(file);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown category');
  });
});
