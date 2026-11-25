// Prepares the docs site's example pages: runs every examples/*.tsx, copies the PDF it writes to
// site/public/examples/, validates those PDFs with veraPDF (PDF/UA-1, Docker required) and writes
// site/src/data/examples.json for the site to read. An example that is not PDF/UA-1 compliant
// fails the build (exit status 1, listing its failed rules), so a broken example is never deployed.
// `VERAPDF=skip` renders the PDFs without validating them; their badges then say "not validated".
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type DocsExample, displaySource, examplePdfName, nonCompliant } from './docs-examples.js';
import { type FileResult, VERAPDF_IMAGE, validateDirectory } from './verapdf.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const examplesDir = join(root, 'examples');
const siteDir = join(root, 'site');
const pdfDir = join(siteDir, 'public', 'examples');
const dataFile = join(siteDir, 'src', 'data', 'examples.json');
const skipValidation = process.env.VERAPDF === 'skip';

await rm(pdfDir, { recursive: true, force: true });
await mkdir(pdfDir, { recursive: true });

const files = (await readdir(examplesDir)).filter((f) => f.endsWith('.tsx')).sort();
const rendered: { name: string; source: string }[] = [];
for (const file of files) {
  const name = file.replace(/\.tsx$/, '');
  const source = await readFile(join(examplesDir, file), 'utf8');
  const run = spawnSync(process.execPath, ['--import', 'tsx', join(examplesDir, file)], { cwd: root, stdio: 'inherit' });
  if (run.status !== 0) throw new Error(`examples/${file} exited with status ${run.status}`);
  await copyFile(join(root, 'test-output', examplePdfName(source)), join(pdfDir, `${name}.pdf`));
  rendered.push({ name, source });
}

const results = new Map<string, FileResult>();
if (!skipValidation) for (const r of validateDirectory(pdfDir)) results.set(r.file, r);

const examples: DocsExample[] = rendered.map(({ name, source }) => {
  const result = results.get(`${name}.pdf`);
  if (!skipValidation && !result) throw new Error(`veraPDF returned no result for ${name}.pdf`);
  return {
    name,
    source: displaySource(source),
    pdf: `examples/${name}.pdf`,
    verapdf: {
      status: !result ? 'not-run' : result.compliant ? 'passed' : 'failed',
      profile: 'PDF/UA-1',
      validator: VERAPDF_IMAGE,
      failedRules: result?.failedRules ?? [],
    },
  };
});

await mkdir(join(siteDir, 'src', 'data'), { recursive: true });
await writeFile(dataFile, `${JSON.stringify(examples, null, 2)}\n`);
for (const e of examples) console.log(`${e.verapdf.status.toUpperCase().padEnd(7)} ${e.name}`);
console.log(`Wrote ${examples.length} example(s) to ${dataFile}`);

const failures = nonCompliant(examples);
if (failures) {
  console.error(failures);
  process.exit(1);
}
