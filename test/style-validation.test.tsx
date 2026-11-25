import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { Document, Image, P, Page, renderToBuffer, Table, TD, TH, TR } from '../src/index.js';

const renderP = (style: unknown) =>
  renderToBuffer(
    <Document title="Style" lang="en-US">
      <Page>
        <P style={style as never}>x</P>
      </Page>
    </Document>,
  );

describe('style validation', () => {
  it.each([
    ['fontSize', -1, 'must be a number greater than 0'],
    ['fontSize', 0, 'must be a number greater than 0'],
    ['fontSize', '12', 'must be a number greater than 0'],
    ['lineHeight', -2, 'must be a non-negative number of points'],
    ['margin', Number.NaN, 'must be a non-negative number of points'],
    ['marginTop', -1, 'must be a non-negative number of points'],
    ['paddingLeft', Number.POSITIVE_INFINITY, 'must be a non-negative number of points'],
    ['padding', '4pt', 'must be a non-negative number of points'],
    ['borderWidth', -0.5, 'must be a non-negative number of points'],
  ])('rejects %s = %s', async (key, value, problem) => {
    await expect(renderP({ [key]: value })).rejects.toThrow(`<P> \`style.${key}\` ${problem}`);
  });

  it.each([
    ['fontWeight', 450, "must be 'normal', 'bold' or a multiple of 100 from 100 to 900"],
    ['fontWeight', 1000, "must be 'normal', 'bold' or a multiple of 100 from 100 to 900"],
    ['fontWeight', 'heavy', "must be 'normal', 'bold' or a multiple of 100 from 100 to 900"],
    ['fontStyle', 'oblique', "must be 'normal' or 'italic'"],
    ['color', 'notacolor', 'must be a CSS color name or hex color'],
    ['borderColor', '#12', 'must be a CSS color name or hex color'],
    ['backgroundColor', '#gggggg', 'must be a CSS color name or hex color'],
    ['fontFamily', '', 'must be a non-empty font family name'],
  ])('rejects %s = %s', async (key, value, problem) => {
    await expect(renderP({ [key]: value })).rejects.toThrow(`<P> \`style.${key}\` ${problem}`);
  });

  it('accepts valid values, including 100–900 weights and hex or named colors', async () => {
    await expect(
      renderP({ fontWeight: 300, fontStyle: 'italic', color: '#abc', borderColor: 'navy', backgroundColor: '#1A1A1A' }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('rejects unknown keys and names the element and the key', async () => {
    await expect(renderP({ colour: 'red' })).rejects.toThrow('<P> `style` has unknown key "colour".');
    await expect(renderP({ toString: 1 })).rejects.toThrow('<P> `style` has unknown key "toString".');
  });
});

describe('style that is not an object', () => {
  const PNG = fileURLToPath(new URL('./fixtures/images/chart.png', import.meta.url));
  const elements: Record<string, (style: never) => ReactNode> = {
    P: (style) => <P style={style}>x</P>,
    Image: (style) => <Image src={PNG} alt="Chart" style={style} />,
    TD: (style) => (
      <Table>
        <TR>
          <TH>h</TH>
        </TR>
        <TR>
          <TD style={style}>x</TD>
        </TR>
      </Table>
    ),
  };
  const cases = Object.keys(elements).flatMap((name) => ['wide', 5, [{ width: 50 }]].map((style) => [name, style] as const));

  it.each(cases)('rejects <%s style=%j>', async (name, style) => {
    const run = renderToBuffer(
      <Document title="Style" lang="en-US">
        <Page>{elements[name]!(style as never)}</Page>
      </Document>,
    );
    await expect(run).rejects.toMatchObject({
      code: 'RTP_INVALID_STYLE',
      message: expect.stringContaining(`<${name}> \`style\` must be an object.`),
    });
  });
});
