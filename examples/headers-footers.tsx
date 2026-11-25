// Run with `npm run example:headers`, then open test-output/headers-footers.pdf.
// Shows running headers and footers:
// - every page has a header and a "Page X of Y" footer; Y is the final page count, because
//   headers and footers are laid out after the content has been split into pages;
// - in Acrobat's Tags panel they do not appear: they are Pagination artifacts, which a screen
//   reader skips, so it does not read "Page 2 of 4" in the middle of a sentence;
// - the divider between the sections is an <Artifact>: drawn in the flow, absent from the tags.
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Artifact, Document, H1, H2, P, Page, renderToFile, Span } from '../src/index.js';

const out = fileURLToPath(new URL('../test-output/headers-footers.pdf', import.meta.url));
await mkdir(dirname(out), { recursive: true });

const paragraph = (topic: string) =>
  Array.from({ length: 12 }, (_, i) => `${topic} note ${i + 1}: the figures for this quarter are in line with the plan.`).join(
    ' ',
  );

await renderToFile(
  <Document title="Quarterly report" lang="en-US">
    <Page
      size="A5"
      margin={{ top: 64, right: 48, bottom: 64, left: 48 }}
      header={() => (
        <P style={{ fontSize: 8, color: '#555555' }}>
          Quarterly report <Span style={{ fontStyle: 'italic' }}>(draft)</Span>
        </P>
      )}
      footer={({ pageNumber, totalPages }) => <P style={{ fontSize: 8 }}>{`Page ${pageNumber} of ${totalPages}`}</P>}
    >
      <H1>Quarterly report</H1>
      <H2>Sales</H2>
      <P>{paragraph('Sales')}</P>
      <P>{paragraph('Sales')}</P>
      <Artifact>
        <P style={{ color: '#999999', marginTop: 6, marginBottom: 12 }}>* * *</P>
      </Artifact>
      <H2>Costs</H2>
      <P>{paragraph('Costs')}</P>
      <P>{paragraph('Costs')}</P>
    </Page>
  </Document>,
  out,
);
console.log(`Wrote ${out}`);
