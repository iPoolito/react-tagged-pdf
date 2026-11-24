import { describe, expect, it } from 'vitest';
import { Document, H1, H2, H3, H4, H5, H6, P, Page, Section, renderToBuffer } from '../src/index.js';
import { structOutline } from './support/read-pdf.js';

describe('headings and sections', () => {
  it('maps H1–H6 to H1–H6 tags and Section to Sect', async () => {
    const pdf = await renderToBuffer(
      <Document title="Headings" lang="en-US">
        <Page>
          <H1>One</H1>
          <Section>
            <H2>Two</H2>
            <P>Body</P>
            <Section>
              <H3>Three</H3>
              <H4>Four</H4>
              <H5>Five</H5>
              <H6>Six</H6>
            </Section>
          </Section>
        </Page>
      </Document>,
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "One"',
        '  Sect',
        '    H2 "Two"',
        '    P "Body"',
        '    Sect',
        '      H3 "Three"',
        '      H4 "Four"',
        '      H5 "Five"',
        '      H6 "Six"',
      ].join('\n'),
    );
  });
});
