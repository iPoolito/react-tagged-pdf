// Run with `npm run example:lists`, then open test-output/lists.pdf.
// Shows bulleted, numbered and nested lists:
// - in Acrobat's Tags panel each <List> is an <L>, each item an <LI> holding an <Lbl> (its bullet
//   or number) and an <LBody> (its content); a screen reader announces "list with 3 items";
// - a nested list is an <L> inside the item's <LBody>, indented one more level, with – bullets;
// - item text can hold links and language changes; an item can also hold paragraphs;
// - a long list flows onto the next page: an item split by the page break is still one <LI>,
//   and its number stays with its first line.
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, H1, H2, Link, List, ListItem, P, Page, renderToFile, Span } from '../src/index.js';

const out = fileURLToPath(new URL('../test-output/lists.pdf', import.meta.url));
await mkdir(dirname(out), { recursive: true });

await renderToFile(
  <Document title="Lists" lang="en-US">
    <Page size="A5" margin={48}>
      <H1>Lists</H1>
      <H2>Packing list</H2>
      <List>
        <ListItem>
          Clothes
          <List>
            <ListItem>Rain jacket</ListItem>
            <ListItem>Walking boots</ListItem>
          </List>
        </ListItem>
        <ListItem>
          A phrasebook, to say <Span lang="fr-FR">où est la gare ?</Span>
        </ListItem>
        <ListItem>
          Tickets from <Link href="https://example.com/tickets">the booking site</Link>
        </ListItem>
      </List>
      <H2>Itinerary</H2>
      <List ordered>
        {Array.from({ length: 14 }, (_, i) => (
          <ListItem key={i}>
            Day {i + 1}: walk to the next village, stopping for lunch on the way.
            {i === 2 && <P style={{ fontStyle: 'italic' }}>Rest day if the weather is bad.</P>}
          </ListItem>
        ))}
      </List>
    </Page>
  </Document>,
  out,
);
console.log(`Wrote ${out}`);
