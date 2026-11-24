// Host tree -> validated document model. All authoring errors that can be
// detected before layout are raised here, with the offending component named.
import { HostType } from './components.js';
import type { HostElement, HostNode } from './reconciler.js';

/** Structure tag of a text block; layout and paint carry it through to the PDF structure tree. */
export type TextKind = 'P' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
/** Structure tag of any block-level element. */
export type BlockKind = TextKind | 'Sect';
export type TextBlock = { kind: TextKind; text: string };
export type SectionBlock = { kind: 'Sect'; children: Block[] };
export type Block = TextBlock | SectionBlock;
export type PageModel = { blocks: Block[] };
export type DocumentModel = { title: string; lang: string; pages: PageModel[] };

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
    pages.push({ blocks: toBlocks(child) });
  }
  if (pages.length === 0) throw new Error('<Document> must contain at least one <Page>.');
  return { title, lang, pages };
}

const textKinds: Partial<Record<string, TextKind>> = {
  [HostType.P]: 'P',
  [HostType.H1]: 'H1',
  [HostType.H2]: 'H2',
  [HostType.H3]: 'H3',
  [HostType.H4]: 'H4',
  [HostType.H5]: 'H5',
  [HostType.H6]: 'H6',
};

function toBlock(node: HostNode, parent: string): Block {
  if (node.kind === 'element') {
    const textKind = textKinds[node.type];
    if (textKind) return { kind: textKind, text: collectText(node) };
    if (node.type === HostType.Section) return { kind: 'Sect', children: toBlocks(node) };
  }
  throw new Error(`<${parent}> may only contain <P>, <H1>–<H6> and <Section> children, found ${describe(node)}.`);
}

const toBlocks = (el: HostElement): Block[] =>
  el.children.filter((c) => !isBlank(c)).map((c) => toBlock(c, nameOf(el)));

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
