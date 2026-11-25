import { describe, expect, it } from 'vitest';
import { parseVeraPdfReport } from '../scripts/verapdf.js';

// Shaped like real `verapdf/cli:v1.30.4 -f ua1 --format json` output, trimmed to the fields used.
const report = (jobs: unknown[]) => JSON.stringify({ report: { jobs } });

describe('parseVeraPdfReport', () => {
  it('reports each file as compliant or not, with the rules it failed', () => {
    const stdout = report([
      {
        itemDetails: { name: '/data/bad.pdf' },
        validationResult: [
          {
            compliant: false,
            details: {
              ruleSummaries: [
                {
                  clause: '6.2',
                  testNumber: 1,
                  failedChecks: 1,
                  description: 'The document catalog dictionary shall include a MarkInfo dictionary',
                },
                { clause: '7.21.4.1', testNumber: 1, failedChecks: 3, description: 'Fonts shall be embedded' },
              ],
            },
          },
        ],
      },
      { itemDetails: { name: '/data/good.pdf' }, validationResult: [{ compliant: true, details: { ruleSummaries: [] } }] },
    ]);
    expect(parseVeraPdfReport(stdout)).toEqual([
      {
        file: 'bad.pdf',
        compliant: false,
        failedRules: [
          { rule: '6.2-1', failedChecks: 1, description: 'The document catalog dictionary shall include a MarkInfo dictionary' },
          { rule: '7.21.4.1-1', failedChecks: 3, description: 'Fonts shall be embedded' },
        ],
      },
      { file: 'good.pdf', compliant: true, failedRules: [] },
    ]);
  });

  it('accepts a validationResult that is an object rather than an array', () => {
    const stdout = report([{ itemDetails: { name: '/data/a.pdf' }, validationResult: { compliant: true, details: {} } }]);
    expect(parseVeraPdfReport(stdout)).toEqual([{ file: 'a.pdf', compliant: true, failedRules: [] }]);
  });

  it('treats a job without a validation result as not compliant', () => {
    const stdout = report([{ itemDetails: { name: '/data/broken.pdf' } }]);
    expect(parseVeraPdfReport(stdout)).toEqual([
      { file: 'broken.pdf', compliant: false, failedRules: [], error: 'veraPDF returned no validation result' },
    ]);
  });
});
