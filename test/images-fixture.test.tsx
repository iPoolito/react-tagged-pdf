import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import fixture from './fixtures/images-and-figures.js';
import { figures, paintedImages, structOutline } from './support/read-pdf.js';

describe('images and figures fixture (validated by veraPDF in npm run test:ua)', () => {
  it('tags described images as Figures and leaves decorative ones out of the tree', async () => {
    const pdf = await renderToBuffer(fixture);
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "Images and figures"',
        '  P "The chart below shows quarterly sales."',
        '  Figure [Alt="Bar chart: sales rose in each of the four quarters."]',
        '  Sect',
        '    P "The same chart, framed and smaller, read from a Buffer:"',
        '    Figure [Alt="Smaller copy of the quarterly sales chart."]',
        '  L',
        '    LI',
        '      Lbl "•"',
        '      LBody "With a figure: [Figure]"',
        '        Figure [Alt="Gráfico de ventas trimestrales." Lang="es-ES"]',
      ].join('\n'),
    );
  });

  it('gives every Figure a BBox around its image, and draws decorative images as artifacts', async () => {
    const pdf = await renderToBuffer(fixture);
    const images = await paintedImages(pdf);
    expect(images.map((i) => i.tag)).toEqual(['Artifact', 'Figure', 'Figure', 'Figure', 'Artifact']);
    const drawn = images.filter((i) => i.tag === 'Figure');
    const figs = await figures(pdf);
    expect(figs).toHaveLength(3);
    figs.forEach((figure, i) => {
      const image = drawn[i]!;
      expect(figure.placement).toBe('Block');
      expect(figure.bbox!.map((n) => Number(n.toFixed(1)))).toEqual(
        [image.x, image.y, image.x + image.width, image.y + image.height].map((n) => Number(n.toFixed(1))),
      );
    });
  });
});
