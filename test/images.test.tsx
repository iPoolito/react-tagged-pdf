import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import {
  Artifact,
  Document,
  Image,
  type ImageStyle,
  List,
  ListItem,
  P,
  Page,
  Section,
  renderToBuffer,
} from '../src/index.js';
import { figures, pageContent, paintedImages, structOutline } from './support/read-pdf.js';

/** 120 × 80 px PNG with an alpha channel. */
const PNG = fileURLToPath(new URL('./fixtures/images/chart.png', import.meta.url));
/** 400 × 8 px baseline JPEG. */
const JPEG = fileURLToPath(new URL('./fixtures/images/divider.jpg', import.meta.url));

const A4_HEIGHT = 841.89;
const MARGIN = 72;

const render = (children: ReactNode) =>
  renderToBuffer(
    <Document title="Images" lang="en-US">
      <Page>{children}</Page>
    </Document>,
  );

describe('Image', () => {
  it('tags a described image as a Figure with its Alt and a BBox where it is drawn', async () => {
    const pdf = await render(<Image src={PNG} alt="Sales rose in every quarter" />);
    expect(await structOutline(pdf)).toBe(['Document', '  Figure [Alt="Sales rose in every quarter"]'].join('\n'));
    const [image] = await paintedImages(pdf);
    expect(image).toMatchObject({ page: 1, tag: 'Figure' });
    // Intrinsic size: one point per pixel, at the top-left of the content area.
    expect(image!.x).toBeCloseTo(MARGIN);
    expect(image!.width).toBeCloseTo(120);
    expect(image!.height).toBeCloseTo(80);
    expect(image!.y + image!.height).toBeCloseTo(A4_HEIGHT - MARGIN);
    const [figure] = await figures(pdf);
    expect(figure!.page).toBe(1);
    expect(figure!.placement).toBe('Block');
    const [x1, y1, x2, y2] = figure!.bbox!;
    expect([x1, y1, x2, y2].map((n) => Math.round(n!))).toEqual(
      [image!.x, image!.y, image!.x + image!.width, image!.y + image!.height].map(Math.round),
    );
  });

  it('draws a decorative image as a Layout artifact, absent from the structure tree', async () => {
    const pdf = await render(
      <>
        <P>Before</P>
        <Image src={JPEG} decorative />
        <P>After</P>
      </>,
    );
    expect(await structOutline(pdf)).toBe(['Document', '  P "Before"', '  P "After"'].join('\n'));
    expect(await figures(pdf)).toEqual([]);
    const [image] = await paintedImages(pdf);
    expect(image).toMatchObject({ page: 1, tag: 'Artifact' });
    expect(await pageContent(pdf)).toMatch(/\/Artifact <<\s*\/Type \/Layout\s*>> BDC/);
  });

  it('writes the Figure Lang when the alt text is in another language', async () => {
    const pdf = await render(<Image src={PNG} alt="Las ventas subieron" lang="es-ES" />);
    expect(await structOutline(pdf)).toContain('Figure [Alt="Las ventas subieron" Lang="es-ES"]');
  });

  it('reads JPEG and PNG from a path, a Buffer or a Uint8Array', async () => {
    const bytes = readFileSync(PNG);
    const pdf = await render(
      <>
        <Image src={JPEG} alt="A blue rule" />
        <Image src={bytes} alt="Chart from a Buffer" />
        <Image src={new Uint8Array(bytes)} alt="Chart from a Uint8Array" />
      </>,
    );
    const images = await paintedImages(pdf);
    expect(images.map((i) => [Math.round(i.width), Math.round(i.height)])).toEqual([
      [400, 8],
      [120, 80],
      [120, 80],
    ]);
    // Stacked top to bottom, each starting where the previous ended.
    expect(images[1]!.y + images[1]!.height).toBeCloseTo(images[0]!.y);
    expect(images[2]!.y + images[2]!.height).toBeCloseTo(images[1]!.y);
  });

  describe('size', () => {
    const sizeOf = async (style: ImageStyle) => {
      const [image] = await paintedImages(await render(<Image src={PNG} alt="Chart" style={style} />));
      return [Number(image!.width.toFixed(2)), Number(image!.height.toFixed(2))];
    };

    it('takes width and height from style', async () => {
      expect(await sizeOf({ width: 200, height: 50 })).toEqual([200, 50]);
    });

    it('keeps the aspect ratio when only one of width and height is given', async () => {
      expect(await sizeOf({ width: 60 })).toEqual([60, 40]);
      expect(await sizeOf({ height: 160 })).toEqual([240, 160]);
    });

    it('scales an intrinsically wider image down to the content width', async () => {
      const pdf = await renderToBuffer(
        <Document title="Images" lang="en-US">
          <Page size={[300, 400]} margin={50}>
            <Image src={JPEG} decorative />
          </Page>
        </Document>,
      );
      const [image] = await paintedImages(pdf);
      expect(image!.width).toBeCloseTo(200);
      expect(image!.height).toBeCloseTo(4);
    });

    it('scales an image with only a height down to the content width when it would be wider', async () => {
      // 120 × 80 px at height 400 would be 600 pt wide; A4 with 72 pt margins has 451.28 pt.
      expect(await sizeOf({ height: 400 })).toEqual([451.28, 300.85]);
    });

    it('sits inside its margin, border and padding, which are Layout artifacts', async () => {
      const pdf = await render(
        <Image src={PNG} alt="Chart" style={{ marginLeft: 10, borderWidth: 2, padding: 4, width: 60 }} />,
      );
      const [image] = await paintedImages(pdf);
      expect(image!.x).toBeCloseTo(MARGIN + 10 + 2 + 4);
      expect(image!.y + image!.height).toBeCloseTo(A4_HEIGHT - MARGIN - 2 - 4);
      expect(await structOutline(pdf)).toBe(['Document', '  Figure [Alt="Chart"]'].join('\n'));
    });

    it('throws when an explicit width is wider than the content area', async () => {
      await expect(render(<Image src={PNG} alt="Chart" style={{ width: 1000 }} />)).rejects.toThrow(
        /<Image> ".*chart\.png" is 1000 pt wide, wider than the 451\.28 pt of content width/,
      );
    });
  });

  it('moves an image that does not fit the rest of the page to the next page, whole', async () => {
    const pdf = await renderToBuffer(
      <Document title="Images" lang="en-US">
        <Page size={[300, 300]} margin={50}>
          <P style={{ marginBottom: 0, lineHeight: 150 }}>Tall line</P>
          <Image src={PNG} alt="Chart" style={{ width: 120 }} />
        </Page>
      </Document>,
    );
    const [image] = await paintedImages(pdf);
    expect(image!.page).toBe(2);
    expect(image!.y + image!.height).toBeCloseTo(300 - 50);
    expect((await figures(pdf))[0]!.page).toBe(2);
  });

  it('throws when an image is taller than the page content area', async () => {
    await expect(render(<Image src={PNG} alt="Chart" style={{ width: 100, height: 800 }} />)).rejects.toThrow(
      /is 800 pt tall and does not fit in the page content area/,
    );
  });

  it('can be a block of a Section and of a ListItem', async () => {
    const pdf = await render(
      <>
        <Section>
          <Image src={PNG} alt="In a section" style={{ width: 30 }} />
        </Section>
        <List>
          <ListItem>
            Item text
            <Image src={PNG} alt="In an item" style={{ width: 30 }} />
          </ListItem>
        </List>
      </>,
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  Sect',
        '    Figure [Alt="In a section"]',
        '  L',
        '    LI',
        '      Lbl "•"',
        '      LBody "Item text [Figure]"',
        '        Figure [Alt="In an item"]',
      ].join('\n'),
    );
  });

  it('is part of the artifact inside <Artifact>, alt or not, and does not warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const pdf = await render(
        <Artifact>
          <Image src={PNG} alt="Logo" style={{ width: 30 }} />
          <Image src={PNG} alt="" style={{ width: 30 }} />
        </Artifact>,
      );
      expect(await structOutline(pdf)).toBe('Document');
      expect((await paintedImages(pdf)).map((i) => i.tag)).toEqual(['Artifact', 'Artifact']);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('can be in a running header, as part of its Pagination artifact', async () => {
    const pdf = await renderToBuffer(
      <Document title="Images" lang="en-US">
        <Page header={() => <Image src={PNG} decorative style={{ height: 20 }} />}>
          <P>Body</P>
        </Page>
      </Document>,
    );
    expect(await structOutline(pdf)).toBe(['Document', '  P "Body"'].join('\n'));
    const [image] = await paintedImages(pdf);
    expect(image!.tag).toBe('Artifact');
    expect(await pageContent(pdf)).toMatch(/\/Artifact <<\s*\/Type \/Pagination\s*>> BDC/);
    // Top at half the top margin, inside the margin.
    expect(image!.y + image!.height).toBeCloseTo(A4_HEIGHT - MARGIN / 2);
  });

  describe('alt text', () => {
    let warn: MockInstance<typeof console.warn>;
    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => warn.mockRestore());

    it('treats an empty alt as decorative and warns to use decorative instead', async () => {
      const pdf = await render(<Image src={PNG} alt="  " />);
      expect(await structOutline(pdf)).toBe('Document');
      expect((await paintedImages(pdf))[0]!.tag).toBe('Artifact');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toMatch(/<Image> ".*chart\.png" has an empty `alt`.*use `decorative`/);
    });

    it('does not warn for a described or a decorative image', async () => {
      await render(
        <>
          <Image src={PNG} alt="Chart" />
          <Image src={PNG} decorative />
        </>,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('errors', () => {
    it('throws when neither alt nor decorative is given', async () => {
      // @ts-expect-error: the props type requires alt or decorative
      await expect(render(<Image src={PNG} />)).rejects.toThrow(
        /<Image> ".*chart\.png" needs a text alternative: give `alt` .* or `decorative`/,
      );
    });

    it('throws when both alt and decorative are given', async () => {
      // @ts-expect-error: alt and decorative are mutually exclusive
      await expect(render(<Image src={PNG} alt="Chart" decorative />)).rejects.toThrow(
        'has both `alt` and `decorative`',
      );
    });

    it('throws when decorative is not true', async () => {
      // @ts-expect-error: decorative can only be true
      await expect(render(<Image src={PNG} decorative={false} />)).rejects.toThrow(
        '`decorative` must be true when given; got false',
      );
    });

    it('throws when src is missing', async () => {
      // @ts-expect-error: src is required
      await expect(render(<Image alt="Chart" />)).rejects.toThrow('<Image> requires a `src`');
    });

    it('throws a clear error for a file that is not a JPEG or PNG', async () => {
      await expect(render(<Image src={Buffer.from('GIF89a')} alt="Chart" />)).rejects.toThrow(
        '<Image> (6 bytes) could not be read as a JPEG or PNG',
      );
    });

    it('refuses text style properties, bad sizes and children', async () => {
      // @ts-expect-error: images take no text style
      await expect(render(<Image src={PNG} alt="Chart" style={{ fontSize: 12 }} />)).rejects.toThrow(
        '<Image> `style.fontSize` is not supported on images',
      );
      await expect(render(<Image src={PNG} alt="Chart" style={{ width: -1 }} />)).rejects.toThrow(
        '<Image> `style.width` must be a number of points greater than 0; got -1',
      );
      const props = { src: PNG, alt: 'Chart', children: 'caption' };
      await expect(render(<Image {...props} />)).rejects.toThrow('<Image> takes no children, found text "caption"');
    });
  });
});
