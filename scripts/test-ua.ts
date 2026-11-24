// Renders every fixture in test/fixtures/ and validates the PDFs with the
// official veraPDF CLI image against the PDF/UA-1 profile. Exits non-zero on
// any rule failure. Requires Docker.
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ReactNode } from 'react';
import { renderToFile } from '../src/index.js';

const VERAPDF_IMAGE = process.env.VERAPDF_IMAGE ?? 'verapdf/cli:v1.30.4';
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

const run = spawnSync(
  'docker',
  ['run', '--rm', '-v', `${outDir}:/data`, VERAPDF_IMAGE, '-f', 'ua1', '--format', 'json', '-r', '/data'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
if (run.error) throw run.error;
// 0 = all compliant, 1 = at least one non-compliant; anything else is a tooling failure.
if (run.status !== 0 && run.status !== 1) {
  console.error(run.stderr || run.stdout);
  throw new Error(`veraPDF exited with status ${run.status}`);
}

type RuleSummary = { clause: string; testNumber: number; description: string; failedChecks: number };
type ValidationResult = { compliant: boolean; details: { ruleSummaries: RuleSummary[] } };
type Job = { itemDetails: { name: string }; validationResult: ValidationResult | ValidationResult[] };
const jobs: Job[] = JSON.parse(run.stdout).report.jobs;

let failures = 0;
for (const job of jobs) {
  const name = basename(job.itemDetails.name);
  const result = ([] as ValidationResult[]).concat(job.validationResult)[0];
  if (result?.compliant) {
    console.log(`PASS ${name} (PDF/UA-1)`);
    continue;
  }
  failures++;
  console.error(`FAIL ${name} (PDF/UA-1)`);
  for (const rule of result?.details.ruleSummaries ?? []) {
    console.error(`  ${rule.clause}-${rule.testNumber} (${rule.failedChecks}x): ${rule.description}`);
  }
}
if (jobs.length !== fixtures.length) {
  console.error(`Expected ${fixtures.length} veraPDF job(s), got ${jobs.length}`);
  failures++;
}
process.exit(failures === 0 ? 0 : 1);
