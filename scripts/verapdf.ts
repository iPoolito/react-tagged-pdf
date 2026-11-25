// Runs the official veraPDF CLI image against the PDF/UA-1 profile and reads its JSON report.
// Shared by `npm run test:ua` and the docs site's example badges. Requires Docker.
import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';

export const VERAPDF_IMAGE = process.env.VERAPDF_IMAGE ?? 'verapdf/cli:v1.30.4';

/** A PDF/UA-1 rule a file failed, e.g. `7.4.2-1`, and how many checks of it failed. */
export type FailedRule = { rule: string; failedChecks: number; description: string };
/** veraPDF's verdict on one file. `error` is set when veraPDF validated nothing for it. */
export type FileResult = { file: string; compliant: boolean; failedRules: FailedRule[]; error?: string };

type RuleSummary = { clause: string; testNumber: number; description: string; failedChecks: number };
type ValidationResult = { compliant: boolean; details?: { ruleSummaries?: RuleSummary[] } };
type Job = { itemDetails: { name: string }; validationResult?: ValidationResult | ValidationResult[] };

/** Read the stdout of `verapdf --format json`, one result per validated file. */
export function parseVeraPdfReport(stdout: string): FileResult[] {
  const jobs: Job[] = JSON.parse(stdout).report.jobs;
  return jobs.map((job) => {
    const file = basename(job.itemDetails.name);
    // veraPDF writes validationResult as an object or as a one-element array.
    const results = ([] as ValidationResult[]).concat(job.validationResult ?? []);
    if (results.length === 0) {
      return { file, compliant: false, failedRules: [], error: 'veraPDF returned no validation result' };
    }
    return {
      file,
      compliant: results.every((r) => r.compliant),
      failedRules: results.flatMap((r) =>
        (r.details?.ruleSummaries ?? []).map((s) => ({
          rule: `${s.clause}-${s.testNumber}`,
          failedChecks: s.failedChecks,
          description: s.description,
        })),
      ),
    };
  });
}

/** Validate every PDF in `dir` (recursively) against PDF/UA-1. Throws if veraPDF itself fails to run. */
export function validateDirectory(dir: string): FileResult[] {
  const run = spawnSync(
    'docker',
    ['run', '--rm', '-v', `${dir}:/data`, VERAPDF_IMAGE, '-f', 'ua1', '--format', 'json', '-r', '/data'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (run.error) throw run.error;
  // 0 = all compliant, 1 = at least one non-compliant; anything else is a tooling failure.
  if (run.status !== 0 && run.status !== 1) {
    throw new Error(`veraPDF exited with status ${run.status}: ${run.stderr || run.stdout}`);
  }
  return parseVeraPdfReport(run.stdout);
}
