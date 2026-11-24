// Ordered, unordered and nested lists (an ordered list inside a bulleted one and a bulleted list
// inside that), item text with a link and an inline language change, an item with a paragraph,
// and a list long enough to flow onto a second page, splitting one item between pages.
import { Document, H1, H2, Link, List, ListItem, P, Page, Span } from '../../src/index.js';

export const SPLIT_ITEM =
  'This item is long enough to wrap over several lines, so that it starts at the bottom of the first ' +
  'page and finishes at the top of the second one, with its bullet only on the first.';

export default (
  <Document title="Lists" lang="en-US">
    <Page size={[300, 420]} margin={36}>
      <H1>Lists</H1>
      <H2>Shopping</H2>
      <List>
        <ListItem>
          Fruit
          <List ordered>
            <ListItem>Apples</ListItem>
            <ListItem>
              Pears, of two kinds:
              <List>
                <ListItem>Conference</ListItem>
                <ListItem>
                  <Span lang="fr-FR">Doyenné du Comice</Span>
                </ListItem>
              </List>
            </ListItem>
          </List>
        </ListItem>
        <ListItem>
          Bread from <Link href="https://example.com/bakery">the bakery</Link>
        </ListItem>
      </List>
      <H2>Steps</H2>
      <List ordered>
        <ListItem>Preheat the oven.</ListItem>
        <ListItem>
          Mix the ingredients.
          <P>Do not overmix.</P>
        </ListItem>
        <ListItem>Bake for twenty minutes.</ListItem>
        <ListItem>{SPLIT_ITEM}</ListItem>
        <ListItem>Serve.</ListItem>
      </List>
    </Page>
  </Document>
);
