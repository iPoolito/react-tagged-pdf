import { describe, expect, it, vi } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import fixture from './fixtures/headings-styles-fonts.js';
import { pdfFacts, structOutline } from './support/read-pdf.js';

describe('headings, styles and fonts fixture (validated by veraPDF in npm run test:ua)', () => {
  it('has the expected structure tree', async () => {
    const pdf = await renderToBuffer(fixture, { strict: true });
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "Annual report"',
        '  P "A short introduction in the document language."',
        '  Sect',
        '    H2 "Results"',
        '    P "Revenue grew in every region."',
        '    Sect [Lang="es-ES"]',
        '      H3 "Resumen en español"',
        '      P "Los ingresos crecieron en todas las regiones."',
        '  Sect',
        '    H2 "Notes"',
        '    P [Lang="fr-FR"] "Les chiffres ne sont pas audités."',
        '    P "Set in a registered font."',
      ].join('\n'),
    );
  });

  it('embeds every font, including the registered one, and does not warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { fonts } = await pdfFacts(await renderToBuffer(fixture));
      expect(fonts.every((f) => f.embedded)).toBe(true);
      expect(fonts.map((f) => f.baseFont.replace(/^[A-Z]{6}\+/, '')).sort()).toEqual([
        'NotoSans-Bold',
        'NotoSans-BoldItalic',
        'NotoSans-Regular',
      ]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
