// Paint pass on upstream PDFKit. Everything PDF/UA-1 needs at the document
// level is configured in createPdfDocument(); keep the workarounds there.
import PDFDocument from 'pdfkit';
import { DEFAULT_FONT_PATH } from './fonts.js';
import type { ImageSource } from './components.js';
import type {
  Frame,
  ImageSize,
  LaidOutArtifact,
  LaidOutBlock,
  LaidOutImage,
  LaidOutPage,
  LaidOutText,
  Line,
  Measure,
} from './layout.js';
import { imageLabel, type InlineElement, type LinkTarget } from './model.js';
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

/** The parts of PDFKit's embedded font (and its fontkit font) that measuring reads. */
type EmbeddedFont = {
  ascender: number;
  font: { unitsPerEm: number; underlinePosition: number; underlineThickness: number };
};

export function measurerFor(doc: PdfDoc): Measure {
  return (style) => {
    useFont(doc, style);
    const lineHeight = doc.currentLineHeight(true);
    // PDFKit's text(str, x, y) puts the baseline this far below y.
    const font = (doc as unknown as { _font: EmbeddedFont })._font;
    const ascent = (font.ascender / 1000) * style.fontSize;
    // The post table's underline position is the top of the underline, negative below the baseline.
    const perUnit = style.fontSize / font.font.unitsPerEm;
    const underline = { offset: -font.font.underlinePosition * perUnit, thickness: font.font.underlineThickness * perUnit };
    return {
      widthOf: (text) => useFont(doc, style).widthOfString(text),
      lineHeight,
      ascent,
      underline,
    };
  };
}

/** The parts of PDFKit's opened image that layout and paint read. */
type OpenedImage = { width: number; height: number; orientation?: number };

const openedImages = new WeakMap<PdfDoc, Map<ImageSource, OpenedImage>>();

/** An image opened once per document and source, so it is parsed and embedded only once. */
function openImage(doc: PdfDoc, src: ImageSource): OpenedImage {
  const cache = openedImages.get(doc) ?? new Map<ImageSource, OpenedImage>();
  openedImages.set(doc, cache);
  let image = cache.get(src);
  if (!image) {
    try {
      // PDFKit accepts a path or a Buffer; a plain Uint8Array is wrapped without copying.
      const input = typeof src === 'string' || Buffer.isBuffer(src) ? src : Buffer.from(src.buffer, src.byteOffset, src.byteLength);
      // @types/pdfkit (0.17) lacks openImage.
      image = (doc as unknown as { openImage(src: string | Buffer): OpenedImage }).openImage(input);
    } catch (error) {
      throw new Error(`${imageLabel(src)} could not be read as a JPEG or PNG: ${(error as Error).message}`, { cause: error });
    }
    cache.set(src, image);
  }
  return image;
}

/** Image sizes for layout, read with the same PDFKit image parser paint embeds with. */
export function imageSizer(doc: PdfDoc): ImageSize {
  return (block) => {
    const image = openImage(doc, block.src);
    // EXIF orientations 5–8 rotate a JPEG by 90°; PDFKit draws it rotated.
    const rotated = (image.orientation ?? 1) > 4;
    return rotated ? { width: image.height, height: image.width } : { width: image.width, height: image.height };
  };
}

type StructElem = ReturnType<PdfDoc['struct']>;

/**
 * Paints physical pages in order. A block split across pages has one fragment per page but
 * one structure element: it is created with the first fragment, and every later fragment's
 * marked content is added to it. Elements stay open until the end, when ending the root ends
 * them all (PDFKit writes an element once it is ended).
 */
export function paint(doc: PdfDoc, pages: LaidOutPage[]): void {
  const root = doc.struct('Document');
  doc.addStructure(root);
  const elements = new Map<object, StructElem>();
  for (const page of pages) {
    const { width, height, margin } = page.geometry;
    doc.addPage({ size: [width, height], margins: margin });
    // Before any structure content on the page: artifact marking would close it.
    for (const artifact of page.artifacts) paintArtifact(doc, artifact);
    for (const block of page.blocks) paintBlock(doc, root, block, elements);
  }
  root.end();
}

function paintBlock(doc: PdfDoc, parent: StructElem, block: LaidOutBlock, elements: Map<object, StructElem>): void {
  if (block.kind === 'Artifact') {
    paintArtifact(doc, { type: block.source.artifact ?? 'Layout', blocks: [block] });
    return;
  }
  // Decoration first, while no structure content is open (artifact marking would close it).
  if (block.frame) paintFrame(doc, block.frame);
  if (block.kind === 'Image') {
    paintImage(doc, parent, block);
    return;
  }
  if (!('children' in block) && block.source.inParent) {
    // A list item's text: content of the enclosing LBody, no element of its own.
    paintText(doc, parent, block, elements);
    return;
  }
  let elem = elements.get(block.source);
  if (!elem) {
    const scope = 'scope' in block.source ? block.source.scope : undefined;
    // A header cell's Scope is written as /A << /O /Table /Scope ... >>.
    elem = doc.struct(block.kind, { ...(block.lang ? { lang: block.lang } : {}), ...(scope ? { scope } : {}) });
    parent.add(elem);
    elements.set(block.source, elem);
  }
  if ('children' in block) {
    for (const child of block.children) paintBlock(doc, elem, child, elements);
  } else {
    paintText(doc, elem, block, elements);
  }
}

/**
 * A described image is a `Figure` whose `Alt` is its description and whose `BBox` is where it is
 * drawn (a figure is on one page, so its element is created on that page, as PDFKit's bbox
 * conversion needs). A decorative one (no or empty `alt`) is a Layout artifact.
 */
function paintImage(doc: PdfDoc, parent: StructElem, block: LaidOutImage): void {
  const { x, y, width, height } = block.placement!;
  const draw = () => drawImage(doc, block);
  const { alt } = block.source;
  if (!alt) {
    doc.markContent('Artifact', { type: 'Layout' });
    draw();
    doc.endMarkedContent();
    return;
  }
  const figure = doc.struct('Figure', {
    alt,
    // Top-left origin, [left, top, right, bottom]; PDFKit flips it to PDF user space.
    bbox: [x, y, x + width, y + height],
    placement: 'Block',
    ...(block.lang ? { lang: block.lang } : {}),
  } as never);
  parent.add(figure);
  const content = doc.markStructureContent('Figure');
  draw();
  doc.endMarkedContent();
  figure.add(content);
}

/** Draws an image where layout placed it; the caller marks it as content. */
function drawImage(doc: PdfDoc, block: LaidOutImage): void {
  const { x, y, width, height } = block.placement!;
  doc.image(openImage(doc, block.source.src) as never, x, y, { width, height });
}

/**
 * Text is marked content of the block's element, except text inside a tagged inline element
 * (a `<Link>`, or a `<Span lang>`), which is marked content of that element's own structure
 * element: a child of the enclosing inline element's, or of the block's, in reading order.
 * Each run of consecutive fragments with the same owner is one marked-content sequence. Every
 * line a link occupies gets one link annotation, attached to the `Link` element (OBJR + StructParent).
 */
function paintText(doc: PdfDoc, blockElem: StructElem, block: LaidOutText, elements: Map<object, StructElem>): void {
  type Open = { inline: InlineElement | undefined; owner: StructElem; content: ReturnType<PdfDoc['markStructureContent']> };
  let open: Open | undefined;
  const close = () => {
    if (!open) return;
    doc.endMarkedContent();
    open.owner.add(open.content);
    open = undefined;
  };
  /** The structure element of a tagged inline element, created (with its ancestors) on first use. */
  const inlineElem = (inline: InlineElement): StructElem => {
    let elem = elements.get(inline);
    if (!elem) {
      const parent = inline.parent ? inlineElem(inline.parent) : blockElem;
      elem = doc.struct(inline.kind, inline.kind === 'Span' ? { lang: inline.lang } : {});
      parent.add(elem);
      elements.set(inline, elem);
    }
    return elem;
  };

  for (const line of block.lines) {
    for (const { text, x, y, width, run, underline } of line.fragments) {
      if (!open || open.inline !== run.inline) {
        // Close first: text before an inline element must precede that element among its parent's kids.
        close();
        const owner = run.inline ? inlineElem(run.inline) : blockElem;
        const tag = run.inline?.kind ?? (block.source.inParent ? 'LBody' : block.kind);
        open = { inline: run.inline, owner, content: doc.markStructureContent(tag) };
      }
      useFont(doc, run.style).fillColor(run.style.color);
      doc.text(text, x, y, { lineBreak: false });
      // Inside the same marked content as the text it decorates: never untagged.
      if (underline) doc.rect(x, underline.y, width, underline.thickness).fill(run.style.color);
    }
    for (const { link, x, width } of linkSpans(line)) {
      // @types/pdfkit lacks structParent; passing a variable (not a literal) skips the excess-property check.
      const options = {
        structParent: inlineElem(link),
        // PDFKit's default is empty, which veraPDF rejects, so it is always the link text or the author's description.
        Contents: pdfTextString(link.contents),
      };
      doc.link(x, line.top, width, line.height, link.href, options);
    }
  }
  close();
}

/**
 * A PDF text string for an annotation entry. PDFKit, like its own `note()`/`link()`, writes a
 * String object as a text string (UTF-16BE when it is not plain ASCII); a primitive string
 * would be written as a PDF name. The typings only accept `string`.
 */
const pdfTextString = (text: string): string => new String(text) as unknown as string;

/** One link's horizontal extent on one line: where its annotation goes. */
type LinkSpan = { link: LinkTarget; x: number; width: number };

/** Each link's horizontal extent on one line. */
function linkSpans(line: Line): LinkSpan[] {
  const spans: LinkSpan[] = [];
  for (const { run, x, width } of line.fragments) {
    const last = spans.at(-1);
    if (!run.link) continue;
    if (last?.link === run.link) last.width = x + width - last.x;
    else spans.push({ link: run.link, x, width });
  }
  return spans;
}

/**
 * Decoration or running content: one artifact marked-content sequence holding every frame, line,
 * underline and image of the blocks, with no structure elements. Screen readers skip it.
 */
function paintArtifact(doc: PdfDoc, { type, blocks }: LaidOutArtifact): void {
  doc.markContent('Artifact', { type });
  const draw = (block: LaidOutBlock) => {
    if (block.frame) drawFrame(doc, block.frame);
    if ('children' in block) return block.children.forEach(draw);
    // Inside an artifact an image is decoration whatever its alt: there is no Figure to carry it.
    if (block.kind === 'Image') return drawImage(doc, block);
    for (const line of block.lines) {
      for (const { text, x, y, width, run, underline } of line.fragments) {
        useFont(doc, run.style).fillColor(run.style.color);
        doc.text(text, x, y, { lineBreak: false });
        if (underline) doc.rect(x, underline.y, width, underline.thickness).fill(run.style.color);
      }
    }
  };
  blocks.forEach(draw);
  doc.endMarkedContent();
}

/** Background and border are decoration: Layout artifacts, absent from the structure tree. */
function paintFrame(doc: PdfDoc, frame: Frame): void {
  doc.markContent('Artifact', { type: 'Layout' });
  drawFrame(doc, frame);
  doc.endMarkedContent();
}

/** Draws a frame's background and border; the caller marks it as content. */
function drawFrame(doc: PdfDoc, { x, y, width, height, box, openTop, openBottom }: Frame): void {
  doc.save();
  if (box.backgroundColor) doc.rect(x, y, width, height).fill(box.backgroundColor);
  const b = box.borderWidth;
  if (b > 0) {
    // Strokes centered on lines inset by half the width keep the border inside the border box.
    const [left, right, top, bottom] = [x + b / 2, x + width - b / 2, y + b / 2, y + height - b / 2];
    doc.lineWidth(b);
    if (!openTop && !openBottom) {
      doc.rect(left, top, right - left, bottom - top);
    } else {
      // A slice of a block split across pages: no border on the edge where it continues.
      const [y1, y2] = [openTop ? y : top, openBottom ? y + height : bottom];
      doc.moveTo(left, y1).lineTo(left, y2).moveTo(right, y1).lineTo(right, y2);
      if (!openTop) doc.moveTo(left, top).lineTo(right, top);
      if (!openBottom) doc.moveTo(left, bottom).lineTo(right, bottom);
    }
    doc.stroke(box.borderColor);
  }
  doc.restore();
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
