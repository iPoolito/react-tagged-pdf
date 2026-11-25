import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Document, H1, Image, List, ListItem, P, Page, Section } from '../../src/index.js';

/** 120 × 80 px PNG with an alpha channel (embedded with an SMask). */
export const CHART = fileURLToPath(new URL('./images/chart.png', import.meta.url));
/** 400 × 8 px baseline JPEG. */
export const DIVIDER = fileURLToPath(new URL('./images/divider.jpg', import.meta.url));

// Described images (path and Buffer sources, a bordered one, one in a list item, one with a
// Lang) and decorative ones, intrinsic and styled sizes.
export default (
  <Document title="Images and figures" lang="en-US">
    <Page>
      <H1>Images and figures</H1>
      <Image src={DIVIDER} decorative />
      <P>The chart below shows quarterly sales.</P>
      <Image src={CHART} alt="Bar chart: sales rose in each of the four quarters." />
      <Section>
        <P>The same chart, framed and smaller, read from a Buffer:</P>
        <Image
          src={readFileSync(CHART)}
          alt="Smaller copy of the quarterly sales chart."
          style={{ width: 60, borderWidth: 1, borderColor: '#999999', padding: 4, marginBottom: 6 }}
        />
      </Section>
      <List>
        <ListItem>
          With a figure:
          <Image src={CHART} alt="Gráfico de ventas trimestrales." lang="es-ES" style={{ height: 40 }} />
        </ListItem>
      </List>
      <Image src={DIVIDER} decorative style={{ width: 200, marginTop: 12 }} />
    </Page>
  </Document>
);
