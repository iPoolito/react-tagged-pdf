// Layout pass: block flow on a single page, greedy line wrapping at UAX #14
// break opportunities, measured with the same font metrics the paint pass uses.
import { LineBreaker } from 'linebreak';
import type { Block, DocumentModel, TextKind } from './model.js';

export type Measurer = {
  widthOf(text: string): number;
  /** Height of one line box in points. */
  lineHeight: number;
};

export type PageGeometry = { width: number; height: number; margin: number };

export type Line = { text: string; x: number; y: number };
export type LaidOutText = { kind: TextKind; lang?: string; lines: Line[] };
export type LaidOutSection = { kind: 'Sect'; lang?: string; children: LaidOutBlock[] };
export type LaidOutBlock = LaidOutText | LaidOutSection;
export type LaidOutPage = { geometry: PageGeometry; blocks: LaidOutBlock[] };

/** A4 in points with 1-inch margins. */
export const DEFAULT_PAGE: PageGeometry = { width: 595.28, height: 841.89, margin: 72 };
/** Vertical gap after each paragraph, in points. */
const PARAGRAPH_GAP = 6;

export function layoutDocument(model: DocumentModel, measure: Measurer): LaidOutPage[] {
  return model.pages.map((page) => {
    const geometry = DEFAULT_PAGE;
    const maxWidth = geometry.width - 2 * geometry.margin;
    const bottom = geometry.height - geometry.margin;
    let y = geometry.margin;
    const place = (block: Block): LaidOutBlock => {
      if (block.kind === 'Sect') return { kind: 'Sect', lang: block.lang, children: block.children.map(place) };
      const lines = wrap(block.text, maxWidth, measure).map((text) => {
        const line = { text, x: geometry.margin, y };
        y += measure.lineHeight;
        return line;
      });
      y += PARAGRAPH_GAP;
      return { kind: block.kind, lang: block.lang, lines };
    };
    const blocks = page.blocks.map(place);
    if (y - PARAGRAPH_GAP > bottom) {
      throw new Error('Page content does not fit on one page; flowing content across pages is not supported yet.');
    }
    return { geometry, blocks };
  });
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
