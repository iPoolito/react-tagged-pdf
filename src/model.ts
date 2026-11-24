// Host tree -> validated document model. All authoring errors that can be
// detected before layout are raised here, with the offending component named.
import { HostType } from './components.js';
import { HEADING_KINDS, HEADING_RANGE, type HeadingKind, headingLevel } from './headings.js';
import type { HostElement, HostNode } from './reconciler.js';
import {
  type BoxStyle,
  type InheritedText,
  inheritText,
  parseStyle,
  ROOT_TEXT,
  resolveBox,
  resolveText,
  type TextStyle,
} from './style.js';

/** Structure tag of a text block; layout and paint carry it through to the PDF structure tree. */
export type TextKind = 'P' | HeadingKind;
/** Structure tag of any block-level element. */
export type BlockKind = TextKind | 'Sect';
/** `lang` is the element's own `Lang` attribute; absent means inherited from the parent structure element. */
export type TextBlock = { kind: TextKind; text: string; lang?: string; style: TextStyle; box: BoxStyle };
export type SectionBlock = { kind: 'Sect'; children: Block[]; lang?: string; box: BoxStyle };
export type Block = TextBlock | SectionBlock;
export type PageModel = { blocks: Block[] };
export type DocumentModel = {
  title: string;
  lang: string;
  pages: PageModel[];
  /** Accessibility problems that do not stop rendering; reported with `console.warn`. */
  warnings: string[];
};

const componentName: Record<string, string> = Object.fromEntries(
  Object.entries(HostType).map(([name, type]) => [type, name]),
);
const nameOf = (node: HostNode) => (node.kind === 'text' ? 'text' : (componentName[node.type] ?? node.type));

const isBlank = (node: HostNode) => node.kind === 'text' && node.text.trim() === '';

function requireString(el: HostElement, prop: string, why: string): string {
  const value = el.props[prop];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`<${nameOf(el)}> requires a non-empty \`${prop}\` prop: ${why}`);
  }
  return value;
}

export function buildDocumentModel(roots: HostNode[]): DocumentModel {
  const content = roots.filter((n) => !isBlank(n));
  const root = content[0];
  if (content.length !== 1 || !root || root.kind !== 'element' || root.type !== HostType.Document) {
    throw new Error('The element passed to renderToBuffer/renderToFile must be a single <Document> at the root.');
  }
  const example = 'e.g. <Document title="Invoice 42" lang="en-US">.';
  const title = requireString(root, 'title', `PDF/UA requires a document title (dc:title), ${example}`);
  const lang = requireString(root, 'lang', `PDF/UA requires the document language, ${example}`);

  const pages: PageModel[] = [];
  for (const child of root.children) {
    if (isBlank(child)) continue;
    if (child.kind !== 'element' || child.type !== HostType.Page) {
      throw new Error(`<Document> may only contain <Page> children, found ${describe(child)}.`);
    }
    const pageLang = optionalLang(child);
    // Page is not a structure element, so its language lands on each top-level block.
    const blocks = toBlocks(child, ROOT_TEXT).map((b) => (b.lang || !pageLang ? b : { ...b, lang: pageLang }));
    pages.push({ blocks });
  }
  if (pages.length === 0) throw new Error('<Document> must contain at least one <Page>.');
  return { title, lang, pages, warnings: checkHeadingLevels(pages) };
}

/** Headings must start at H1 and never skip a level going down (PDF/UA-1, veraPDF rule 7.4.2-1). */
function checkHeadingLevels(pages: PageModel[]): string[] {
  const warnings: string[] = [];
  let previous: { block: TextBlock; level: number } | undefined;
  const label = (b: TextBlock) => `<${b.kind}> ${JSON.stringify(b.text.trim().slice(0, 40))}`;
  const visit = (block: Block) => {
    if (block.kind === 'Sect') return block.children.forEach(visit);
    if (block.kind === 'P') return;
    const level = headingLevel(block.kind);
    if (!previous && level > 1) {
      warnings.push(`Heading ${label(block)} is the first heading; PDF/UA expects the first heading to be an <H1>.`);
    } else if (previous && level > previous.level + 1) {
      const skipped = previous.level + 1;
      warnings.push(
        `Heading ${label(block)} follows ${label(previous.block)} and skips level ${skipped}; ` +
          'PDF/UA does not allow skipped heading levels (use consecutive levels).',
      );
    }
    previous = { block, level };
  };
  pages.forEach((page) => page.blocks.forEach(visit));
  return warnings;
}

const textKinds: Partial<Record<string, TextKind>> = Object.fromEntries(
  (['P', ...HEADING_KINDS] as const).map((kind) => [HostType[kind], kind]),
);

function toBlock(node: HostNode, parent: string, inherited: InheritedText): Block {
  if (node.kind === 'element') {
    const textKind = textKinds[node.type];
    const lang = optionalLang(node);
    const common = lang ? { lang } : {};
    const own = parseStyle(node.props.style, nameOf(node));
    if (textKind) {
      const style = resolveText(inheritText(inherited, own, textKind));
      return { kind: textKind, text: collectText(node), style, box: resolveBox(own, textKind), ...common };
    }
    if (node.type === HostType.Section) {
      const children = toBlocks(node, inheritText(inherited, own));
      return { kind: 'Sect', children, box: resolveBox(own), ...common };
    }
  }
  throw new Error(`<${parent}> may only contain <P>, ${HEADING_RANGE} and <Section> children, found ${describe(node)}.`);
}

function optionalLang(el: HostElement): string | undefined {
  const value = el.props.lang;
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`<${nameOf(el)}> \`lang\` must be a non-empty BCP 47 language tag, e.g. lang="es-ES".`);
  }
  return value;
}

const toBlocks = (el: HostElement, inherited: InheritedText): Block[] =>
  el.children.filter((c) => !isBlank(c)).map((c) => toBlock(c, nameOf(el), inherited));

function collectText(el: HostElement): string {
  return el.children
    .map((c) => {
      if (c.kind === 'text') return c.text;
      throw new Error(`<${nameOf(el)}> may only contain text, found ${describe(c)}.`);
    })
    .join('');
}

const describe = (node: HostNode) =>
  node.kind === 'text' ? `text ${JSON.stringify(node.text.trim().slice(0, 30))}` : `<${nameOf(node)}>`;
