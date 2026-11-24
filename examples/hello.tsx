// Run with `npm run example`, then open test-output/hello.pdf.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Document, P, Page, renderToFile } from '../src/index.js';

const out = resolve(import.meta.dirname, '..', 'test-output', 'hello.pdf');
await mkdir(resolve(out, '..'), { recursive: true });

await renderToFile(
  <Document title="Hello from react-tagged-pdf" lang="en-US">
    <Page>
      <P>Hello, tagged PDF world!</P>
      <P>
        This PDF has a structure tree (Document, then one P per paragraph), a document language and title, and an
        embedded Noto Sans font, so it passes the veraPDF PDF/UA-1 machine checks. Long paragraphs like this one
        wrap inside the page margins.
      </P>
    </Page>
  </Document>,
  out,
);
console.log(`Wrote ${out}`);
