// Run with `npm run example:images`, then open test-output/images.pdf.
// Shows described and decorative images:
// - in Acrobat's Tags panel each described image is a <Figure> whose Alt text a screen reader
//   reads out; its BBox outlines the image on the page;
// - decorative images (the blue rules) are not in the tags at all: screen readers skip them;
// - sizes come from style.width/height (one of them keeps the aspect ratio) or from the image's
//   pixels; an image never splits, so one that does not fit moves to the next page whole.
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, H1, H2, Image, P, Page, renderToFile } from '../src/index.js';

const out = fileURLToPath(new URL('../test-output/images.pdf', import.meta.url));
const chart = fileURLToPath(new URL('../test/fixtures/images/chart.png', import.meta.url));
const divider = fileURLToPath(new URL('../test/fixtures/images/divider.jpg', import.meta.url));
await mkdir(dirname(out), { recursive: true });

await renderToFile(
  <Document title="Images" lang="en-US">
    <Page size="A5" margin={48}>
      <H1>Images</H1>
      <Image src={divider} decorative style={{ marginBottom: 12 }} />
      <H2>Described</H2>
      <P>A PNG at its own size, one point per pixel:</P>
      <Image src={chart} alt="Bar chart: sales rose in each of the four quarters." style={{ marginBottom: 12 }} />
      <P>The same image 240 pt wide, framed; its height follows the aspect ratio:</P>
      <Image
        src={chart}
        alt="Larger copy of the quarterly sales chart."
        style={{ width: 240, borderWidth: 1, borderColor: '#999999', padding: 6, marginBottom: 12 }}
      />
      <H2>Decorative</H2>
      <P>The rule below is decorative, so it is drawn as an artifact and left out of the tags.</P>
      <Image src={divider} decorative style={{ width: 120 }} />
    </Page>
  </Document>,
  out,
);
console.log(`Wrote ${out}`);
