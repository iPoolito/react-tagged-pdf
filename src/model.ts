// Host tree -> validated document model. All authoring errors that can be
// detected before layout are raised here, with the offending component named.
import { HostType } from './components.js';
import type { HostElement, HostNode } from './reconciler.js';

export type ParagraphBlock = { kind: 'P'; text: string };
export type Block = ParagraphBlock;
export type PageModel = { blocks: Block[] };
export type DocumentModel = { title: string; lang: string; pages: PageModel[] };

const componentName: Record<string, string> = {
  [HostType.Document]: 'Document',
  [HostType.Page]: 'Page',
  [HostType.P]: 'P',
};
const nameOf = (node: HostNode) => (node.kind === 'text' ? 'text' : (componentName[node.type] ?? node.type));

const isBlank = (node: HostNode) => node.kind === 'text' && node.text.trim() === '';

function requireString(el: HostElement, prop: string, why: string): string {
  const value = el.props[prop];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`<Document> requires a non-empty \`${prop}\` prop: ${why}`);
  }
  return value;
}

export function buildDocumentModel(roots: HostNode[]): DocumentModel {
  const content = roots.filter((n) => !isBlank(n));
  const root = content[0];
  if (content.length !== 1 || !root || root.kind !== 'element' || root.type !== HostType.Document) {
    throw new Error('The element passed to renderToBuffer/renderToFile must be a single <Document> at the root.');
  }
  const title = requireString(root, 'title', 'PDF/UA requires a document title (dc:title), e.g. <Document title="Invoice 42" lang="en-US">.');
  const lang = requireString(root, 'lang', 'PDF/UA requires the document language, e.g. <Document title="Invoice 42" lang="en-US">.');

  const pages: PageModel[] = [];
  for (const child of root.children) {
    if (isBlank(child)) continue;
    if (child.kind !== 'element' || child.type !== HostType.Page) {
      throw new Error(`<Document> may only contain <Page> children, found ${describe(child)}.`);
    }
    pages.push({ blocks: child.children.filter((c) => !isBlank(c)).map(toBlock) });
  }
  if (pages.length === 0) throw new Error('<Document> must contain at least one <Page>.');
  return { title, lang, pages };
}

function toBlock(node: HostNode): Block {
  if (node.kind === 'element' && node.type === HostType.P) {
    return { kind: 'P', text: collectText(node) };
  }
  throw new Error(`<Page> may only contain <P> children, found ${describe(node)}.`);
}

function collectText(p: HostElement): string {
  return p.children
    .map((c) => {
      if (c.kind === 'text') return c.text;
      throw new Error(`<P> may only contain text, found ${describe(c)}.`);
    })
    .join('');
}

const describe = (node: HostNode) =>
  node.kind === 'text' ? `text ${JSON.stringify(node.text.trim().slice(0, 30))}` : `<${nameOf(node)}>`;
