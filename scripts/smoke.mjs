// Smoke test of the published package: renders a small document with the installed tarball and
// checks the output is a PDF. Plain JavaScript (no tsx, no JSX) so it runs on the engines floor.
// CI copies it into a directory where the packed tarball and react are installed.
import { createElement as h } from 'react';
import { Document, H1, List, ListItem, P, Page, renderToBuffer, Table, TD, TH, TR } from 'react-tagged-pdf';

const doc = h(
  Document,
  { title: 'Smoke test', lang: 'en-US' },
  h(
    Page,
    { footer: ({ pageNumber, totalPages }) => h(P, null, `Page ${pageNumber} of ${totalPages}`) },
    h(H1, null, 'Smoke test'),
    h(P, null, 'Rendered from the packed tarball.'),
    h(List, null, h(ListItem, null, 'One'), h(ListItem, null, 'Two')),
    h(Table, null, h(TR, null, h(TH, null, 'Name'), h(TH, null, 'Value')), h(TR, null, h(TD, null, 'a'), h(TD, null, '1'))),
  ),
);

const pdf = await renderToBuffer(doc);
const header = Buffer.from(pdf.subarray(0, 5)).toString('latin1');
if (header !== '%PDF-') {
  console.error(`Expected the output to start with %PDF-, got ${JSON.stringify(header)}`);
  process.exit(1);
}
console.log(`OK: ${pdf.byteLength} byte PDF on Node ${process.version}`);
