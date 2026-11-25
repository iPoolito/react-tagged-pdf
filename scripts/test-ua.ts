// Renders every fixture in test/fixtures/ and validates the PDFs with the
// official veraPDF CLI image against the PDF/UA-1 profile. Exits non-zero on
// any rule failure. Requires Docker.
import { mkdir, readdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ReactNode } from 'react';
import { renderToFile } from '../src/index.js';
import { validateDirectory } from './verapdf.js';

// fileURLToPath rather than import.meta.dirname, which needs Node >=20.11.
const root = fileURLToPath(new URL('..', import.meta.url));
const fixturesDir = join(root, 'test', 'fixtures');
const outDir = join(root, 'test-output', 'ua');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const fixtures = (await readdir(fixturesDir)).filter((f) => /\.(tsx|ts)$/.test(f)).sort();
for (const file of fixtures) {
  const mod = (await import(pathToFileURL(join(fixturesDir, file)).href)) as { default: ReactNode };
  const out = join(outDir, `${basename(file).replace(/\.tsx?$/, '')}.pdf`);
  await renderToFile(mod.default, out);
}
console.log(`Rendered ${fixtures.length} fixture(s) to ${outDir}`);

const results = validateDirectory(outDir);
let failures = 0;
for (const result of results) {
  if (result.compliant) {
    console.log(`PASS ${result.file} (PDF/UA-1)`);
    continue;
  }
  failures++;
  console.error(`FAIL ${result.file} (PDF/UA-1)${result.error ? `: ${result.error}` : ''}`);
  for (const rule of result.failedRules) {
    console.error(`  ${rule.rule} (${rule.failedChecks}x): ${rule.description}`);
  }
}
if (results.length !== fixtures.length) {
  console.error(`Expected ${fixtures.length} veraPDF job(s), got ${results.length}`);
  failures++;
}
process.exit(failures === 0 ? 0 : 1);
