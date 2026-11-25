// The v0.0.1 milestone document: a title, headings, a paragraph with an inline link, a list, an
// image with alt text and a simple table. The README's example and its veraPDF screenshot use it.
import { fileURLToPath } from 'node:url';
import { Document, H1, H2, Image, Link, List, ListItem, P, Page, Table, TD, TH, TR } from '../../src/index.js';

const chart = fileURLToPath(new URL('./images/chart.png', import.meta.url));

export default (
  <Document title="Quarterly report" lang="en-US">
    <Page>
      <H1>Quarterly report</H1>
      <P>
        Sales grew this quarter. Read the{' '}
        <Link href="https://example.com/methodology">full methodology</Link> for details.
      </P>
      <H2>Highlights</H2>
      <List>
        <ListItem>Sales rose in every quarter.</ListItem>
        <ListItem>Two new regions opened.</ListItem>
      </List>
      <H2>Sales chart</H2>
      <Image src={chart} alt="Bar chart: sales rose in each of the four quarters." />
      <H2>Sales by region</H2>
      <Table>
        <TR>
          <TH>Region</TH>
          <TH>Sales</TH>
        </TR>
        <TR>
          <TD>North</TD>
          <TD>120</TD>
        </TR>
        <TR>
          <TD>South</TD>
          <TD>95</TD>
        </TR>
      </Table>
    </Page>
  </Document>
);
