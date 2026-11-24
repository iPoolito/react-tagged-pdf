// Paint pass on upstream PDFKit. Everything PDF/UA-1 needs at the document
// level is configured in createPdfDocument(); keep the workarounds there.
import PDFDocument from 'pdfkit';
import { DEFAULT_FONT_PATH } from './fonts.js';
import type { Frame, LaidOutBlock, LaidOutPage, Measure } from './layout.js';
import type { TextStyle } from './style.js';

export type PdfDoc = InstanceType<typeof PDFDocument>;

const normalizeColor = (PDFDocument.prototype as unknown as { _normalizeColor(c: unknown): unknown })._normalizeColor;

/** Whether PDFKit can paint `value` as a color: a 3- or 6-digit hex, or a CSS color name. */
export function isPdfColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // PDFKit parses any '#...' string without checking it, so validate hex here.
  if (value.startsWith('#')) return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
  return normalizeColor.call({ spotColors: {} }, value) != null;
}

const registeredFaces = new WeakMap<PdfDoc, Set<string>>();

/** Select a resolved text style. Layout measures and paint draws with exactly this. */
function useFont(doc: PdfDoc, style: TextStyle): PdfDoc {
  const { font } = style;
  const registered = registeredFaces.get(doc) ?? new Set();
  registeredFaces.set(doc, registered);
  if (!registered.has(font.id)) {
    const src = typeof font.src === 'string' ? font.src : Buffer.from(font.src);
    doc.registerFont(font.id, src as never);
    registered.add(font.id);
  }
  return doc.font(font.id).fontSize(style.fontSize);
}

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
  return doc;
}

export function measurerFor(doc: PdfDoc): Measure {
  return (style) => {
    useFont(doc, style);
    const lineHeight = doc.currentLineHeight(true);
    return {
      widthOf: (text) => useFont(doc, style).widthOfString(text),
      lineHeight,
    };
  };
}

type StructElem = ReturnType<PdfDoc['struct']>;

export function paint(doc: PdfDoc, pages: LaidOutPage[]): void {
  const root = doc.struct('Document');
  doc.addStructure(root);
  for (const page of pages) {
    const { width, height, margin } = page.geometry;
    doc.addPage({ size: [width, height], margin });
    for (const block of page.blocks) paintBlock(doc, root, block);
  }
  root.end();
}

function paintBlock(doc: PdfDoc, parent: StructElem, block: LaidOutBlock): void {
  // Decoration first, while no structure content is open (artifact marking would close it).
  if (block.frame) paintFrame(doc, block.frame);
  const elem = doc.struct(block.kind, block.lang ? { lang: block.lang } : {});
  parent.add(elem);
  if (block.kind === 'Sect') {
    for (const child of block.children) paintBlock(doc, elem, child);
  } else {
    const content = doc.markStructureContent(block.kind);
    useFont(doc, block.style).fillColor(block.style.color);
    for (const line of block.lines) {
      if (line.text) doc.text(line.text, line.x, line.y, { lineBreak: false });
    }
    doc.endMarkedContent();
    elem.add(content);
  }
  elem.end();
}

/** Background and border are decoration: Layout artifacts, absent from the structure tree. */
function paintFrame(doc: PdfDoc, { x, y, width, height, box }: Frame): void {
  doc.markContent('Artifact', { type: 'Layout' });
  doc.save();
  if (box.backgroundColor) doc.rect(x, y, width, height).fill(box.backgroundColor);
  const b = box.borderWidth;
  if (b > 0) {
    // Stroke centered on a rect inset by half the width keeps the border inside the border box.
    doc.lineWidth(b).rect(x + b / 2, y + b / 2, width - b, height - b).stroke(box.borderColor);
  }
  doc.restore();
  doc.endMarkedContent();
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
