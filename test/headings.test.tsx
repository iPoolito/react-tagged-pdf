import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
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

  describe('heading levels', () => {
    const skipping = (
      <Document title="Skip" lang="en-US">
        <Page>
          <H1>Title</H1>
          <Section>
            <H3>Too deep</H3>
          </Section>
        </Page>
      </Document>
    );
    let warn: MockInstance<typeof console.warn>;
    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => warn.mockRestore());

    it('warns when a heading skips a level', async () => {
      await renderToBuffer(skipping);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toContain('<H3> "Too deep" follows <H1> "Title" and skips level 2');
    });

    it('warns when the first heading is not an H1', async () => {
      await renderToBuffer(
        <Document title="Start" lang="en-US">
          <Page>
            <H2>Starts low</H2>
          </Page>
        </Document>,
      );
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toContain('<H2> "Starts low" is the first heading');
    });

    it('does not warn for sequential levels, going back up, or repeated levels', async () => {
      await renderToBuffer(
        <Document title="Ok" lang="en-US">
          <Page>
            <H1>A</H1>
            <H2>B</H2>
            <H3>C</H3>
            <H2>D</H2>
            <H2>E</H2>
            <H1>F</H1>
          </Page>
        </Document>,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
