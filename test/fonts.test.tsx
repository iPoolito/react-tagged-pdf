import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Document, Font, H1, P, Page, Section, renderToBuffer } from '../src/index.js';
import { pdfFacts } from './support/read-pdf.js';

const fontFile = (name: string) => fileURLToPath(new URL(`../fonts/${name}`, import.meta.url));
/** Base font names in the PDF without the 6-letter subset prefix, e.g. "NotoSans-Bold". */
const embeddedFonts = async (pdf: Uint8Array) => {
  const { fonts } = await pdfFacts(pdf);
  for (const f of fonts) expect(f.embedded, `${f.baseFont} is embedded`).toBe(true);
  return fonts.map((f) => f.baseFont.replace(/^[A-Z]{6}\+/, '')).sort();
};

describe('fonts', () => {
  it('embeds a font registered with Font.register from a file path', async () => {
    Font.register({ family: 'Path Brand', src: fontFile('NotoSans-Italic.ttf') });
    const pdf = await renderToBuffer(
      <Document title="Fonts" lang="en-US">
        <Page>
          <P style={{ fontFamily: 'Path Brand' }}>Custom font</P>
        </Page>
      </Document>,
    );
    expect(await embeddedFonts(pdf)).toEqual(['NotoSans-Italic']);
  });

  it('embeds a font registered from a Buffer', async () => {
    Font.register({ family: 'Buffer Brand', src: await readFile(fontFile('NotoSans-BoldItalic.ttf')) });
    const pdf = await renderToBuffer(
      <Document title="Fonts" lang="en-US">
        <Page>
          <P style={{ fontFamily: 'Buffer Brand' }}>Custom font</P>
        </Page>
      </Document>,
    );
    expect(await embeddedFonts(pdf)).toEqual(['NotoSans-BoldItalic']);
  });

  it('picks the registered face matching fontWeight and fontStyle', async () => {
    Font.register({ family: 'Faces', src: fontFile('NotoSans-Regular.ttf') });
    Font.register({ family: 'Faces', src: fontFile('NotoSans-Bold.ttf'), weight: 'bold' });
    Font.register({ family: 'Faces', src: fontFile('NotoSans-Italic.ttf'), style: 'italic' });
    Font.register({ family: 'Faces', src: fontFile('NotoSans-BoldItalic.ttf'), weight: 700, style: 'italic' });
    const one = (style: object) =>
      renderToBuffer(
        <Document title="Fonts" lang="en-US">
          <Page>
            <P style={{ fontFamily: 'Faces', ...style }}>x</P>
          </Page>
        </Document>,
      ).then(embeddedFonts);
    expect(await one({})).toEqual(['NotoSans-Regular']);
    expect(await one({ fontWeight: 'bold' })).toEqual(['NotoSans-Bold']);
    expect(await one({ fontWeight: 700 })).toEqual(['NotoSans-Bold']);
    expect(await one({ fontStyle: 'italic' })).toEqual(['NotoSans-Italic']);
    expect(await one({ fontWeight: 'bold', fontStyle: 'italic' })).toEqual(['NotoSans-BoldItalic']);
  });

  it('bundles bold and italic faces of the default font; headings are bold', async () => {
    const pdf = await renderToBuffer(
      <Document title="Fonts" lang="en-US">
        <Page>
          <H1>Heading</H1>
          <P style={{ fontStyle: 'italic' }}>Italic body</P>
        </Page>
      </Document>,
    );
    expect(await embeddedFonts(pdf)).toEqual(['NotoSans-Bold', 'NotoSans-Italic']);
  });

  it('inherits fontFamily from an ancestor Section, like CSS', async () => {
    Font.register({ family: 'Inherited', src: fontFile('NotoSans-Italic.ttf') });
    const pdf = await renderToBuffer(
      <Document title="Fonts" lang="en-US">
        <Page>
          <Section style={{ fontFamily: 'Inherited' }}>
            <Section>
              <P>Deep</P>
            </Section>
          </Section>
        </Page>
      </Document>,
    );
    expect(await embeddedFonts(pdf)).toEqual(['NotoSans-Italic']);
  });

  it.each(['Helvetica', 'Times-Roman', 'courier-bold', 'ZapfDingbats'])(
    'throws when a standard-14 font (%s) is requested, because PDF/UA requires embedded fonts',
    async (family) => {
      const element = (
        <Document title="Fonts" lang="en-US">
          <Page>
            <P style={{ fontFamily: family }}>x</P>
          </Page>
        </Document>
      );
      await expect(renderToBuffer(element)).rejects.toThrow(
        `"${family}" is a PDF standard-14 font, which is not embedded; PDF/UA requires every font to be embedded.`,
      );
    },
  );

  it('throws a clear error for a family that was never registered', async () => {
    const element = (
      <Document title="Fonts" lang="en-US">
        <Page>
          <P style={{ fontFamily: 'Nope Sans' }}>x</P>
        </Page>
      </Document>
    );
    await expect(renderToBuffer(element)).rejects.toThrow(
      'Font family "Nope Sans" is not registered. Register it with Font.register({ family: "Nope Sans", src }).',
    );
  });
});
