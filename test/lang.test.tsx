import { describe, expect, it } from 'vitest';
import { Document, H1, P, Page, Section, renderToBuffer } from '../src/index.js';
import { structOutline } from './support/read-pdf.js';

describe('lang prop', () => {
  it("writes the element's Lang attribute on P, headings and Section", async () => {
    const pdf = await renderToBuffer(
      <Document title="Languages" lang="en-US">
        <Page>
          <H1 lang="en-GB">Colour</H1>
          <P>Inherits the document language.</P>
          <P lang="es-ES">Hola mundo.</P>
          <Section lang="fr-FR">
            <P>Bonjour.</P>
          </Section>
        </Page>
      </Document>,
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 [Lang="en-GB"] "Colour"',
        '  P "Inherits the document language."',
        '  P [Lang="es-ES"] "Hola mundo."',
        '  Sect [Lang="fr-FR"]',
        '    P "Bonjour."',
      ].join('\n'),
    );
  });

  it('applies a Page lang to the blocks on that page that do not set their own', async () => {
    const pdf = await renderToBuffer(
      <Document title="Languages" lang="en-US">
        <Page lang="de-DE">
          <P>Hallo.</P>
          <P lang="en-US">Hello.</P>
        </Page>
      </Document>,
    );
    expect(await structOutline(pdf)).toBe(
      ['Document', '  P [Lang="de-DE"] "Hallo."', '  P [Lang="en-US"] "Hello."'].join('\n'),
    );
  });

  it('rejects an empty lang', async () => {
    const element = (
      <Document title="T" lang="en-US">
        <Page>
          <P lang=" ">x</P>
        </Page>
      </Document>
    );
    await expect(renderToBuffer(element)).rejects.toThrow('<P> `lang` must be a non-empty BCP 47 language tag');
  });
});
