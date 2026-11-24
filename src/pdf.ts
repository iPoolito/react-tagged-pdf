// Paint pass on upstream PDFKit. Everything PDF/UA-1 needs at the document
// level is configured in createPdfDocument(); keep the workarounds there.
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import type { LaidOutPage, Measurer } from './layout.js';

const DEFAULT_FONT = 'NotoSans';
const DEFAULT_FONT_PATH = fileURLToPath(new URL('../fonts/NotoSans-Regular.ttf', import.meta.url));
const DEFAULT_FONT_SIZE = 12;

export type PdfDoc = InstanceType<typeof PDFDocument>;

/** Select the bundled font at the body size. Layout measures and paint draws with exactly this. */
const useDefaultFont = (doc: PdfDoc) => doc.font(DEFAULT_FONT).fontSize(DEFAULT_FONT_SIZE);

export function createPdfDocument(meta: { title: string; lang: string }): PdfDoc {
  const doc = new PDFDocument({
    // Default 1.3 writes no XMP metadata stream (veraPDF 7.1-8).
    pdfVersion: '1.7',
    tagged: true,
    // @types/pdfkit (0.17) predates the 'PDF/UA' subset that pdfkit 0.21 supports.
    subset: 'PDF/UA' as never,
    lang: meta.lang,
    // ViewerPreferences /DisplayDocTitle (veraPDF 7.1-10).
    displayTitle: true,
    info: { Title: meta.title },
    // Never let PDFKit fall back to an unembedded standard-14 font (Helvetica).
    font: DEFAULT_FONT_PATH,
    autoFirstPage: false,
  });
  // WORKAROUND (pdfkit 0.21): subset 'PDF/UA' sets `subset = 1`, which makes
  // PDFKit write a CIDSet meant for PDF/A-1 that is incomplete and fails veraPDF
  // PDF/UA-1 rule 7.21.4.2-2 for every embedded font. A truthy non-1 value keeps
  // the PDF/UA XMP identification but skips the CIDSet. Must run before any font
  // is embedded. Regression: test/fixtures/cidset-regression.tsx under `npm run test:ua`
  // (whether the bad CIDSet trips veraPDF depends on the subset's glyph set).
  (doc as unknown as { subset: unknown }).subset = '1';
  doc.registerFont(DEFAULT_FONT, DEFAULT_FONT_PATH);
  useDefaultFont(doc);
  return doc;
}

export function measurerFor(doc: PdfDoc): Measurer {
  useDefaultFont(doc);
  return {
    widthOf: (text) => doc.widthOfString(text),
    lineHeight: doc.currentLineHeight(true),
  };
}

export function paint(doc: PdfDoc, pages: LaidOutPage[]): void {
  const root = doc.struct('Document');
  doc.addStructure(root);
  for (const page of pages) {
    const { width, height, margin } = page.geometry;
    doc.addPage({ size: [width, height], margin });
    for (const block of page.blocks) {
      const elem = doc.struct(block.kind);
      root.add(elem);
      const content = doc.markStructureContent(block.kind);
      useDefaultFont(doc);
      for (const line of block.lines) {
        if (line.text) doc.text(line.text, line.x, line.y, { lineBreak: false });
      }
      doc.endMarkedContent();
      elem.add(content);
      elem.end();
    }
  }
  root.end();
}

export function toBuffer(doc: PdfDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
