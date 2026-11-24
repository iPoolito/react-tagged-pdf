// Layout pass: block flow onto physical pages, greedy line wrapping at UAX #14
// break opportunities, measured with the same font metrics the paint pass uses.
import { LineBreaker } from 'linebreak';
import type { Block, DocumentModel, PageGeometry, SectionBlock, TextBlock, TextKind } from './model.js';
import type { BoxStyle, TextStyle } from './style.js';

/** Measures text set in one resolved text style. */
export type Measurer = {
  widthOf(text: string): number;
  /** Natural height of one line (ascender to descender plus line gap) in points. */
  lineHeight: number;
};

/** Metrics provider: layout and paint must use the same fonts. */
export type Measure = (style: TextStyle) => Measurer;

/** `y` is the top of the glyph box, as PDFKit's `text(str, x, y)` expects. */
export type Line = { text: string; x: number; y: number };
/**
 * A block fragment's border box (top-left origin) and what to paint on it. Absent when there is
 * nothing to paint. An open edge is where the block continues on the previous or next page:
 * no border is drawn there (like CSS `box-decoration-break: slice`).
 */
export type Frame = {
  x: number;
  y: number;
  width: number;
  height: number;
  box: BoxStyle;
  openTop: boolean;
  openBottom: boolean;
};
/**
 * The part of a block that lies on one physical page. `source` is the model block, the same
 * object for every fragment of a block that splits across pages: paint tags them as one element.
 */
export type LaidOutText = {
  kind: TextKind;
  source: TextBlock;
  lang?: string;
  style: TextStyle;
  frame?: Frame;
  lines: Line[];
};
export type LaidOutSection = {
  kind: 'Sect';
  source: SectionBlock;
  lang?: string;
  frame?: Frame;
  children: LaidOutBlock[];
};
export type LaidOutBlock = LaidOutText | LaidOutSection;
/** One physical page of the PDF. */
export type LaidOutPage = { geometry: PageGeometry; blocks: LaidOutBlock[] };

const EPSILON = 0.01;

const elementName = (block: TextBlock | SectionBlock) => (block.kind === 'Sect' ? 'Section' : block.kind);

/** A box whose fragment on the current page is still being filled. */
type OpenBox = {
  block: TextBlock | SectionBlock;
  fragment: LaidOutBlock;
  /** Container the fragment was added to, so an empty fragment can move to the next page. */
  container: LaidOutBlock[];
  /** Left edge and width of the border box. */
  x: number;
  width: number;
  /** Left edge and width of the content box. */
  innerX: number;
  innerWidth: number;
  /** Top of the fragment's border box on the current page. */
  top: number;
  /** Whether the block itself starts on the current page (top edge closed). */
  startsHere: boolean;
};

/**
 * Block flow with a CSS-like box model: margin, border, padding, content. Vertical
 * margins of adjacent blocks add up (no margin collapsing). Text blocks split between
 * lines across pages; boxes that split are sliced, and the margin adjoining a page
 * break is dropped. Every `<Page>` template starts on a new physical page.
 */
export function layoutDocument(model: DocumentModel, measureFor: Measure): LaidOutPage[] {
  const pages: LaidOutPage[] = [];
  for (const template of model.pages) layoutTemplate(template.geometry, template.blocks, measureFor, pages);
  return pages;
}

function layoutTemplate(geometry: PageGeometry, blocks: Block[], measureFor: Measure, pages: LaidOutPage[]): void {
  const { margin } = geometry;
  const bottom = geometry.height - margin.bottom;
  let page: LaidOutPage = { geometry, blocks: [] };
  pages.push(page);
  let y = margin.top;
  /** True right after a page break: the next margin adjoins the break and is dropped. */
  let atBreak = false;
  /** Whether anything (a line or a painted box) is on the current page. */
  let hasContent = false;
  /** A `<PageBreak>` waits for the next content, so a trailing break never adds an empty page. */
  let pendingBreak = false;
  const stack: OpenBox[] = [];

  /** Where the fragment of the box at stack depth `depth` goes: its parent section's fragment, or the page. */
  const containerAt = (depth: number) =>
    depth === 0 ? page.blocks : (stack[depth - 1]!.fragment as LaidOutSection).children;
  const isEmpty = (fragment: LaidOutBlock): boolean =>
    !fragment.frame && (fragment.kind === 'Sect' ? fragment.children.every(isEmpty) : fragment.lines.length === 0);

  /** Border and padding at the top of a box that starts here; content then no longer adjoins a break. */
  const openTopEdge = (box: OpenBox) => {
    const { borderWidth, padding } = box.block.box;
    y += borderWidth + padding.top;
    if (borderWidth + padding.top > 0) atBreak = false;
  };

  const frameFor = (box: OpenBox, frameBottom: number, openBottom: boolean): Frame | undefined => {
    const style = box.block.box;
    if (!(style.borderWidth > 0 || style.backgroundColor)) return undefined;
    return {
      x: box.x,
      y: box.top,
      width: box.width,
      height: frameBottom - box.top,
      box: style,
      openTop: !box.startsHere,
      openBottom,
    };
  };

  const newPage = () => {
    // Boxes with nothing on this page yet move to the next page whole; the others are sliced.
    let firstMoved = stack.length;
    while (firstMoved > 0 && isEmpty(stack[firstMoved - 1]!.fragment)) firstMoved--;
    for (let i = stack.length - 1; i >= 0; i--) {
      const box = stack[i]!;
      if (i >= firstMoved) {
        box.container.splice(box.container.indexOf(box.fragment), 1);
      } else {
        const frame = frameFor(box, bottom, true);
        if (frame) box.fragment.frame = frame;
      }
    }

    page = { geometry, blocks: [] };
    pages.push(page);
    y = margin.top;
    atBreak = true;
    hasContent = false;
    stack.forEach((box, i) => {
      const moved = i >= firstMoved;
      const old = box.fragment;
      const next = stack[i + 1]?.fragment;
      const base = { source: old.source, ...(old.lang ? { lang: old.lang } : {}) };
      // A moved box keeps its closed children: they are empty, so nothing of them was placed.
      box.fragment =
        old.kind === 'Sect'
          ? { kind: 'Sect', ...base, source: old.source, children: moved ? old.children.filter((c) => c !== next) : [] }
          : { kind: old.kind, ...base, source: old.source, style: old.style, lines: [] };
      box.container = containerAt(i);
      box.container.push(box.fragment);
      box.top = y;
      // Moved whole: the top margin adjoins the break and is dropped; border and padding stay.
      if (moved && box.startsHere) openTopEdge(box);
      else box.startsHere = false;
    });
  };

  const openBox = (block: TextBlock | SectionBlock, x: number, width: number): OpenBox => {
    if (pendingBreak) {
      pendingBreak = false;
      newPage();
    }
    const { margin: m, padding, borderWidth } = block.box;
    if (!atBreak) y += m.top;
    const outerX = x + m.left;
    const outerWidth = width - m.left - m.right;
    const innerX = outerX + borderWidth + padding.left;
    const innerWidth = outerWidth - 2 * borderWidth - padding.left - padding.right;
    if (!(innerWidth > 0)) {
      throw new Error(
        `<${elementName(block)}> has no room for content: margin, border and padding leave a content width of ` +
          `${Number(innerWidth.toFixed(2))} pt.`,
      );
    }
    const base = block.lang ? { lang: block.lang } : {};
    const fragment: LaidOutBlock =
      block.kind === 'Sect'
        ? { kind: 'Sect', source: block, ...base, children: [] }
        : { kind: block.kind, source: block, ...base, style: block.style, lines: [] };
    const parent = containerAt(stack.length);
    parent.push(fragment);
    const box: OpenBox = {
      block,
      fragment,
      container: parent,
      x: outerX,
      width: outerWidth,
      innerX,
      innerWidth,
      top: y,
      startsHere: true,
    };
    stack.push(box);
    openTopEdge(box);
    return box;
  };

  const closeBox = () => {
    const box = stack.pop()!;
    const { padding, borderWidth, margin: m } = box.block.box;
    y += padding.bottom + borderWidth;
    const frame = frameFor(box, y, false);
    if (frame) {
      box.fragment.frame = frame;
      hasContent = true;
    }
    if (padding.bottom + borderWidth > 0) atBreak = false;
    y += m.bottom;
  };

  const placeText = (box: OpenBox, block: TextBlock) => {
    const measure = measureFor(block.style);
    const lineBox = block.style.lineHeight ?? measure.lineHeight;
    // Center the glyph box in the line box (half-leading).
    const halfLeading = (lineBox - measure.lineHeight) / 2;
    for (const text of wrap(block.text, box.innerWidth, measure)) {
      if (y + lineBox > bottom + EPSILON) {
        newPage();
        if (y + lineBox > bottom + EPSILON) {
          const label = JSON.stringify(block.text.trim().slice(0, 40));
          throw new Error(
            `<${elementName(block)}> ${label} has a ${Number(lineBox.toFixed(2))} pt line that does not fit ` +
              `in the page content area (${Number((bottom - y).toFixed(2))} pt left below its border and padding).`,
          );
        }
      }
      (box.fragment as LaidOutText).lines.push({ text, x: box.innerX, y: y + halfLeading });
      y += lineBox;
      atBreak = false;
      hasContent = true;
    }
  };

  const place = (block: Block, x: number, width: number) => {
    if (block.kind === 'PageBreak') {
      if (hasContent) pendingBreak = true;
      return;
    }
    const box = openBox(block, x, width);
    if (block.kind === 'Sect') {
      for (const child of block.children) place(child, box.innerX, box.innerWidth);
    } else {
      placeText(box, block);
    }
    closeBox();
  };

  for (const block of blocks) place(block, margin.left, geometry.width - margin.left - margin.right);
}

/** Greedy wrap. Trailing whitespace never counts toward the fit and is not kept at line ends. */
export function wrap(text: string, maxWidth: number, measure: Measurer): string[] {
  const lines: string[] = [];
  let line = '';
  const push = () => {
    lines.push(line.trimEnd());
    line = '';
  };

  const breaker = new LineBreaker(text);
  let last = 0;
  for (let bk = breaker.nextBreak(); bk; bk = breaker.nextBreak()) {
    let word = text.slice(last, bk.position);
    last = bk.position;
    if (bk.required) word = word.replace(/[\r\n\x0B\x0C\x85\u2028\u2029]+$/, '');

    if (line && measure.widthOf((line + word).trimEnd()) > maxWidth) push();
    // A single word wider than the line: break it between characters.
    while (!line && measure.widthOf(word.trimEnd()) > maxWidth) {
      const chars = Array.from(word);
      let n = 1;
      while (n < chars.length && measure.widthOf(chars.slice(0, n + 1).join('')) <= maxWidth) n++;
      line = chars.slice(0, n).join('');
      word = chars.slice(n).join('');
      push();
    }
    line += word;
    if (bk.required) push();
  }
  if (line.trim() || lines.length === 0) push();
  return lines;
}
