// Host tree -> validated document model. All authoring errors that can be
// detected before layout are raised here, with the offending component named.
import { type ArtifactType, HostType, type RunningContent } from './components.js';
import { HEADING_KINDS, HEADING_RANGE, type HeadingKind, headingLevel } from './headings.js';
import type { HostElement, HostNode } from './reconciler.js';
import {
  type BoxStyle,
  parseCellStyle,
  parseRowStyle,
  type InheritedText,
  inheritText,
  parseInlineStyle,
  parseStyle,
  ROOT_TEXT,
  resolveBox,
  resolveText,
  type Sides,
  sameStyle,
  type TextStyle,
} from './style.js';

/**
 * Structure tag of a text block; layout and paint carry it through to the PDF structure tree.
 * `Lbl` is a list item's generated bullet or number; `TH` and `TD` are table cells.
 */
export type TextKind = 'P' | HeadingKind | 'Lbl' | CellKind;
/** Structure tag of a table cell. */
export type CellKind = 'TH' | 'TD';
/** What a header cell describes: the cells below it (`Column`) or to its right (`Row`). */
export type Scope = 'Column' | 'Row';
/**
 * Structure tag of a block that holds other blocks. `Artifact` is not a structure element: it and
 * everything in it are painted as one artifact.
 */
export type ContainerKind = 'Sect' | 'L' | 'LI' | 'LBody' | 'Table' | 'TR' | 'Artifact';
/** Structure tag of any block-level element. */
export type BlockKind = TextKind | ContainerKind;
/**
 * One `<Link>`. Every run of the link refers to the same object, so its pieces on several
 * lines or pages become one structure element. `contents` is the annotation's `/Contents`.
 * `parent` is the tagged inline element it sits in, if any.
 */
export type LinkTarget = { kind: 'Link'; href: string; contents: string; parent?: InlineElement };
/** One `<Span lang>`: a `Span` structure element with its own `Lang`. Untagged spans have none. */
export type LangSpan = { kind: 'Span'; lang: string; parent?: InlineElement };
/**
 * An inline element that becomes a structure element of its own, a child of its `parent` or,
 * at the top, of the enclosing block's element.
 */
export type InlineElement = LinkTarget | LangSpan;
/**
 * A stretch of a text block's content set in one resolved style. `inline` is the innermost
 * tagged inline element it belongs to; `link` is the `<Link>` it is part of, at any depth.
 */
export type TextRun = { text: string; style: TextStyle; inline?: InlineElement; link?: LinkTarget };
/**
 * `text` is all of the block's runs joined. `style` is the block's own text style (its line
 * height applies to every line). `lang` is the element's own `Lang` attribute; absent means
 * inherited from the parent structure element. `inParent` marks the text of a list item, which
 * is content of the enclosing `LBody` rather than an element of its own.
 */
export type TextBlock = {
  kind: TextKind;
  text: string;
  runs: TextRun[];
  lang?: string;
  style: TextStyle;
  box: BoxStyle;
  inParent?: true;
  /** A header cell's `Scope` attribute. */
  scope?: Scope;
};
/**
 * A block of blocks: a `<Section>`, a `<List>`, a `<ListItem>`, a list item's body or an
 * `<Artifact>`. `label` is a list item's bullet or number; layout puts it in the list's indent, on
 * its body's first line. `artifact` is an `<Artifact>`'s type.
 */
export type ContainerBlock = {
  kind: ContainerKind;
  children: Block[];
  lang?: string;
  box: BoxStyle;
  label?: TextBlock;
  /** A table's column widths in points; `undefined` columns share the remaining width equally. */
  columns?: (number | undefined)[];
  artifact?: ArtifactType;
};
/** Forces the following content onto a new page. Not tagged. */
export type PageBreakBlock = { kind: 'PageBreak' };
export type Block = TextBlock | ContainerBlock | PageBreakBlock;
/** Page size and margins in points. */
export type PageGeometry = { width: number; height: number; margin: Sides };
/**
 * One `<Page>` template: its geometry, the blocks that flow onto as many physical pages as
 * needed, and the running header and footer repeated on each of those pages.
 */
export type PageModel = { geometry: PageGeometry; blocks: Block[]; header?: RunningContent; footer?: RunningContent };
/** Where running content goes on a page. */
export type RunningPlace = 'header' | 'footer';
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
    const blocks = toBlocks(child, ROOT_TEXT).map((b) =>
      b.kind === 'PageBreak' || b.lang || !pageLang ? b : { ...b, lang: pageLang },
    );
    pages.push({ geometry: pageGeometry(child), blocks, ...runningContent(child) });
  }
  if (pages.length === 0) throw new Error('<Document> must contain at least one <Page>.');
  return { title, lang, pages, warnings: [...checkHeadingLevels(pages), ...checkTableHeaders(pages)] };
}

/** Headings must start at H1 and never skip a level going down (PDF/UA-1, veraPDF rule 7.4.2-1). */
function checkHeadingLevels(pages: PageModel[]): string[] {
  const warnings: string[] = [];
  let previous: { block: TextBlock; level: number } | undefined;
  const label = (b: TextBlock) => `<${b.kind}> ${JSON.stringify(b.text.trim().slice(0, 40))}`;
  const visit = (block: Block) => {
    // An artifact's headings are not in the structure tree, so they are not part of the outline.
    if (block.kind === 'Artifact') return;
    if ('children' in block) return block.children.forEach(visit);
    if (block.kind === 'PageBreak' || !isHeading(block.kind)) return;
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

/** A table without header cells cannot tell a screen reader what its data cells mean. */
function checkTableHeaders(pages: PageModel[]): string[] {
  const warnings: string[] = [];
  const visit = (block: Block) => {
    // An artifact is hidden from assistive technology: a table in it is decoration, not data.
    if (!('children' in block) || block.kind === 'Artifact') return;
    if (block.kind !== 'Table') return block.children.forEach(visit);
    const cells = block.children.flatMap((row) => ('children' in row ? row.children : []));
    if (cells.some((cell) => cell.kind === 'TH')) return;
    const first = cells.map((cell) => ('text' in cell ? cell.text.trim() : '')).find((text) => text !== '') ?? '';
    warnings.push(
      `<Table> starting ${JSON.stringify(first.slice(0, 40))} has no <TH> header cells; screen readers need ` +
        'header cells to announce which row and column a data cell belongs to. Use <TH> for its headers.',
    );
  };
  pages.forEach((page) => page.blocks.forEach(visit));
  return warnings;
}

const isHeading = (kind: string): kind is HeadingKind => (HEADING_KINDS as readonly string[]).includes(kind);

const textKinds: Partial<Record<string, 'P' | HeadingKind>> = Object.fromEntries(
  (['P', ...HEADING_KINDS] as const).map((kind) => [HostType[kind], kind]),
);

/** How many lists the content sits in: 0 outside any list. */
type ListDepth = number;

function toBlock(node: HostNode, parent: string, inherited: InheritedText, depth: ListDepth): Block[] {
  if (node.kind === 'element') {
    const textKind = textKinds[node.type];
    const lang = optionalLang(node);
    const common = lang ? { lang } : {};
    const own = parseStyle(node.props.style, nameOf(node));
    if (textKind) {
      const text = inheritText(inherited, own, textKind);
      const runs = mergeRuns(collectRuns(node, text));
      const block = { kind: textKind, text: textOf(runs), runs };
      return [{ ...block, style: resolveText(text), box: resolveBox(own, textKind), ...common }];
    }
    if (node.type === HostType.Section) {
      const children = toBlocks(node, inheritText(inherited, own), depth);
      return [{ kind: 'Sect', children, box: resolveBox(own), ...common }];
    }
    if (node.type === HostType.List) return listBlock(node, inherited, depth);
    if (node.type === HostType.Artifact) {
      const children = toBlocks(node, inheritText(inherited, own), depth);
      rejectLinks(children, 'Artifact', 'an artifact is skipped by assistive technology');
      return [{ kind: 'Artifact', artifact: artifactType(node), children, box: resolveBox(own) }];
    }
    if (node.type === HostType.ListItem) throw new Error('<ListItem> must be a child of <List>.');
    if (node.type === HostType.Table) return tableBlock(node, inherited);
    if (node.type === HostType.TR) throw new Error('<TR> must be a child of <Table>.');
    if (node.type === HostType.TH || node.type === HostType.TD) {
      throw new Error(`<${nameOf(node)}> must be a child of <TR>.`);
    }
    if (node.type === HostType.PageBreak) {
      const child = node.children.find((c) => !isBlank(c));
      if (child) throw new Error(`<PageBreak> takes no children, found ${describe(child)}.`);
      return [{ kind: 'PageBreak' }];
    }
  }
  const inline = parent === 'ListItem' ? 'text, <Span>, <Link>, ' : '';
  throw new Error(
    `<${parent}> may only contain ${inline}<P>, ${HEADING_RANGE}, <Section>, <List>, <Table>, <Artifact> and <PageBreak> children, ` +
      `found ${describe(node)}.`,
  );
}

/** Bullets of unordered lists by nesting depth, repeating. Both are in practically every text font. */
const BULLETS = ['•', '–'];

/** A `<List>`: an `L` of `LI`s, each a generated label and an `LBody`. An empty list adds nothing. */
function listBlock(el: HostElement, inherited: InheritedText, depth: ListDepth): Block[] {
  const { ordered = false } = el.props;
  if (typeof ordered !== 'boolean') {
    throw new Error(`<List> \`ordered\` must be true or false; got ${JSON.stringify(ordered)}.`);
  }
  const own = parseStyle(el.props.style, 'List');
  const text = inheritText(inherited, own);
  const items = el.children.filter((c) => !isBlank(c));
  if (items.length === 0) return [];
  const lang = optionalLang(el);
  const children = items.map((item, index): ContainerBlock => {
    if (item.kind !== 'element' || item.type !== HostType.ListItem) {
      throw new Error(`<List> may only contain <ListItem> children, found ${describe(item)}.`);
    }
    const label = ordered ? `${index + 1}.` : BULLETS[depth % BULLETS.length]!;
    return listItemBlock(item, text, depth + 1, label);
  });
  const box = resolveBox(own, depth > 0 ? 'nested L' : 'L');
  return [{ kind: 'L', children, box, ...(lang ? { lang } : {}) }];
}

const hasText = (block: Block): boolean =>
  'children' in block ? block.children.some(hasText) : block.kind !== 'PageBreak';

const isInline = (node: HostNode) => node.kind === 'text' || node.type === HostType.Span || node.type === HostType.Link;

/**
 * A `<ListItem>`: an `LI` whose `LBody` holds its blocks in order. Each stretch of text (with
 * `<Span>` and `<Link>`) between blocks becomes a text block that is content of the `LBody` itself.
 */
function listItemBlock(el: HostElement, inherited: InheritedText, depth: ListDepth, label: string): ContainerBlock {
  const own = parseStyle(el.props.style, 'ListItem');
  const text = inheritText(inherited, own);
  const lang = optionalLang(el);
  const body: Block[] = [];
  let inline: HostNode[] = [];
  const flushText = () => {
    const runs = mergeRuns(collectRuns({ ...el, children: inline }, text));
    inline = [];
    if (textOf(runs).trim() === '') return;
    body.push({ kind: 'P', text: textOf(runs), runs, style: resolveText(text), box: resolveBox({}), inParent: true });
  };
  for (const child of el.children) {
    if (isInline(child)) {
      inline.push(child);
    } else {
      flushText();
      body.push(...toBlock(child, 'ListItem', text, depth));
    }
  }
  flushText();
  // The label sits on the item's first line of text, so an item needs some.
  if (!body.some(hasText)) throw new Error('<ListItem> has no content; put its text or blocks inside <ListItem>.');
  // A label is never underlined, like a browser's list marker.
  const labelStyle = resolveText({ ...text, textDecoration: 'none' });
  const lbl: TextBlock = {
    kind: 'Lbl',
    text: label,
    runs: [{ text: label, style: labelStyle }],
    style: labelStyle,
    box: resolveBox({}),
  };
  const lbody: ContainerBlock = { kind: 'LBody', children: body, box: resolveBox({}) };
  return { kind: 'LI', children: [lbody], label: lbl, box: resolveBox(own), ...(lang ? { lang } : {}) };
}

/**
 * A `<Table>`: a `Table` of `TR`s of `TH`/`TD` cells, one cell per row and column. Header cells
 * get a `Scope`; column widths come from the cells' `style.width`. An empty table adds nothing.
 */
function tableBlock(el: HostElement, inherited: InheritedText): Block[] {
  const own = parseStyle(el.props.style, 'Table');
  const text = inheritText(inherited, own);
  const rows = el.children.filter((c) => !isBlank(c));
  if (rows.length === 0) return [];
  const widths: (number | undefined)[][] = [];
  const explicitScope = new Set<TextBlock>();
  const children = rows.map((row): ContainerBlock => {
    if (row.kind !== 'element' || row.type !== HostType.TR) {
      throw new Error(`<Table> may only contain <TR> children, found ${describe(row)}.`);
    }
    const rowText = inheritText(text, parseRowStyle(row.props.style));
    const cells = row.children.filter((c) => !isBlank(c));
    if (cells.length === 0) throw new Error('<TR> has no cells; put <TH> and <TD> cells inside it.');
    const rowWidths: (number | undefined)[] = [];
    widths.push(rowWidths);
    const blocks = cells.map((cell): TextBlock => {
      if (cell.kind !== 'element' || (cell.type !== HostType.TH && cell.type !== HostType.TD)) {
        throw new Error(`<TR> may only contain <TH> and <TD> children, found ${describe(cell)}.`);
      }
      const block = cellBlock(cell, rowText);
      if (block.scope) explicitScope.add(block);
      rowWidths.push(cellWidth(cell));
      return block;
    });
    const lang = optionalLang(row);
    return { kind: 'TR', children: blocks, box: resolveBox({}), ...(lang ? { lang } : {}) };
  });

  const grid = children.map((row) => row.children as TextBlock[]);
  const columnCount = grid[0]!.length;
  grid.forEach((cells, i) => {
    if (cells.length !== columnCount) {
      throw new Error(
        `<Table> rows must all have the same number of cells: row 1 has ${columnCount}, row ${i + 1} has ` +
          `${cells.length}. Use an empty <TD/> for a cell with no content; rowSpan and colSpan are not supported yet.`,
      );
    }
  });
  grid.forEach((cells) =>
    cells.forEach((cell, column) => {
      if (cell.kind !== 'TH' || explicitScope.has(cell)) return;
      const headerRow = cells.every((c) => c.kind === 'TH');
      cell.scope = !headerRow && column === 0 ? 'Row' : 'Column';
    }),
  );

  const columns = Array.from({ length: columnCount }, (_, column) => {
    const set = widths.map((row) => row[column]).filter((w) => w !== undefined);
    if (new Set(set).size > 1) {
      throw new Error(
        `<Table> column ${column + 1} has cells with different \`style.width\` values (${[...new Set(set)].join(', ')} pt); ` +
          'set the width on one cell of the column, or the same width on all of them.',
      );
    }
    return set[0];
  });
  const lang = optionalLang(el);
  return [{ kind: 'Table', children, columns, box: resolveBox(own, 'Table'), ...(lang ? { lang } : {}) }];
}

function cellBlock(el: HostElement, inherited: InheritedText): TextBlock {
  const kind: CellKind = el.type === HostType.TH ? 'TH' : 'TD';
  for (const prop of ['rowSpan', 'colSpan']) {
    const value = el.props[prop];
    if (value !== undefined && value !== 1) {
      throw new Error(
        `<${kind}> \`${prop}\` is not supported yet: tables have one cell per row and column; got ${JSON.stringify(value)}.`,
      );
    }
  }
  const { width: _width, ...own } = parseCellStyle(el.props.style, kind);
  const text = inheritText(inherited, own, kind);
  const runs = mergeRuns(collectRuns(el, text));
  const lang = optionalLang(el);
  const scope = kind === 'TH' ? optionalScope(el) : undefined;
  return {
    kind,
    text: textOf(runs),
    runs,
    style: resolveText(text),
    box: resolveBox(own, kind),
    ...(lang ? { lang } : {}),
    ...(scope ? { scope } : {}),
  };
}

function optionalScope(el: HostElement): Scope | undefined {
  const { scope } = el.props;
  if (scope === undefined || scope === 'Column' || scope === 'Row') return scope;
  throw new Error(`<TH> \`scope\` must be 'Column' or 'Row'; got ${JSON.stringify(scope)}.`);
}

const cellWidth = (el: HostElement): number | undefined =>
  (el.props.style as { width?: number } | undefined)?.width;

function runningContent(page: HostElement): { header?: RunningContent; footer?: RunningContent } {
  const out: { header?: RunningContent; footer?: RunningContent } = {};
  for (const place of ['header', 'footer'] as const) {
    const value = page.props[place];
    if (value === undefined) continue;
    if (typeof value !== 'function') {
      throw new Error(
        `<Page> \`${place}\` must be a function of { pageNumber, totalPages } returning its content, e.g. ` +
          `${place}={({ pageNumber, totalPages }) => <P>Page {pageNumber} of {totalPages}</P>}; got ${JSON.stringify(value)}.`,
      );
    }
    out[place] = value as RunningContent;
  }
  return out;
}

/**
 * The blocks of a running header or footer, from the host tree its function rendered. Text,
 * `<Span>` and blocks are allowed; a stretch of text between blocks becomes a paragraph.
 * Running content is an artifact, hidden from assistive technology, so it cannot hold a `<Link>`.
 */
export function runningBlocks(nodes: HostNode[], place: RunningPlace): Block[] {
  const owner = `Page ${place}`;
  const el: HostElement = { kind: 'element', type: owner, props: {}, children: [] };
  const blocks: Block[] = [];
  let inline: HostNode[] = [];
  const flushText = () => {
    const runs = mergeRuns(collectRuns({ ...el, children: inline }, ROOT_TEXT));
    inline = [];
    if (textOf(runs).trim() === '') return;
    blocks.push({ kind: 'P', text: textOf(runs), runs, style: resolveText(ROOT_TEXT), box: resolveBox({}) });
  };
  for (const node of nodes) {
    if (isInline(node)) {
      inline.push(node);
    } else {
      flushText();
      blocks.push(...toBlock(node, owner, ROOT_TEXT, 0));
    }
  }
  flushText();
  const noBreaks = (block: Block) => {
    if (block.kind === 'PageBreak') throw new Error(`<${owner}> cannot contain <PageBreak>.`);
    if ('children' in block) block.children.forEach(noBreaks);
  };
  blocks.forEach(noBreaks);
  rejectLinks(blocks, owner, 'running headers and footers are artifacts, which assistive technology skips');
  return blocks;
}

/** Artifact content cannot hold links: nothing in it is reachable by assistive technology. */
function rejectLinks(blocks: Block[], owner: string, why: string): void {
  const check = (block: Block) => {
    if ('children' in block) return block.children.forEach(check);
    if (block.kind !== 'PageBreak' && block.runs.some((run) => run.link)) {
      throw new Error(`<${owner}> cannot contain <Link>: ${why}, so a link there could not be reached.`);
    }
  };
  blocks.forEach(check);
}

const ARTIFACT_TYPES: readonly ArtifactType[] = ['Layout', 'Page', 'Pagination'];

function artifactType(el: HostElement): ArtifactType {
  const { type = 'Layout' } = el.props;
  if (!ARTIFACT_TYPES.includes(type as ArtifactType)) {
    throw new Error(`<Artifact> \`type\` must be 'Layout', 'Page' or 'Pagination'; got ${JSON.stringify(type)}.`);
  }
  return type as ArtifactType;
}

/** Paper sizes in points, portrait. */
const PAGE_SIZES = {
  A3: [841.89, 1190.55],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  Letter: [612, 792],
  Legal: [612, 1008],
} as const satisfies Record<string, readonly [number, number]>;
const DEFAULT_PAGE_MARGIN = 72;

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function pageGeometry(page: HostElement): PageGeometry {
  const { size = 'A4', margin = DEFAULT_PAGE_MARGIN } = page.props as { size?: unknown; margin?: unknown };
  let width: number;
  let height: number;
  if (typeof size === 'string' && Object.hasOwn(PAGE_SIZES, size)) {
    [width, height] = PAGE_SIZES[size as keyof typeof PAGE_SIZES];
  } else if (Array.isArray(size) && size.length === 2 && size.every((n) => isNumber(n) && n > 0)) {
    [width, height] = size as [number, number];
  } else {
    throw new Error(
      `<Page> \`size\` must be one of ${Object.keys(PAGE_SIZES).map((n) => `'${n}'`).join(', ')} ` +
        `or [width, height] in points greater than 0; got ${JSON.stringify(size)}.`,
    );
  }

  const side = (name: keyof Sides, value: unknown) => {
    if (value === undefined) return DEFAULT_PAGE_MARGIN;
    if (isNumber(value) && value >= 0) return value;
    throw new Error(`<Page> \`margin.${name}\` must be a non-negative number of points; got ${JSON.stringify(value)}.`);
  };
  let sides: Sides;
  if (isNumber(margin)) {
    if (margin < 0) throw new Error(`<Page> \`margin\` must be a non-negative number of points; got ${margin}.`);
    sides = { top: margin, right: margin, bottom: margin, left: margin };
  } else if (margin !== null && typeof margin === 'object' && !Array.isArray(margin)) {
    const m = margin as Record<string, unknown>;
    const unknown = Object.keys(m).filter((k) => !['top', 'right', 'bottom', 'left'].includes(k));
    if (unknown.length > 0) {
      throw new Error(`<Page> \`margin\` has unknown key ${JSON.stringify(unknown[0])}; use top, right, bottom, left.`);
    }
    sides = { top: side('top', m.top), right: side('right', m.right), bottom: side('bottom', m.bottom), left: side('left', m.left) };
  } else {
    throw new Error(
      `<Page> \`margin\` must be a number of points or { top, right, bottom, left }; got ${JSON.stringify(margin)}.`,
    );
  }

  const contentWidth = width - sides.left - sides.right;
  const contentHeight = height - sides.top - sides.bottom;
  if (!(contentWidth > 0 && contentHeight > 0)) {
    throw new Error(
      `<Page> margins leave no content area: ${round(contentWidth)} × ${round(contentHeight)} pt ` +
        `on a ${round(width)} × ${round(height)} pt page.`,
    );
  }
  return { width, height, margin: sides };
}

const round = (n: number) => Number(n.toFixed(2));

function optionalLang(el: HostElement): string | undefined {
  const value = el.props.lang;
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`<${nameOf(el)}> \`lang\` must be a non-empty BCP 47 language tag, e.g. lang="es-ES".`);
  }
  return value;
}

const toBlocks = (el: HostElement, inherited: InheritedText, depth: ListDepth = 0): Block[] =>
  el.children.filter((c) => !isBlank(c)).flatMap((c) => toBlock(c, nameOf(el), inherited, depth));

/** All of the items' text, in order. */
export const textOf = (items: readonly { text: string }[]) => items.map((i) => i.text).join('');

/**
 * `items` appended to `head`, each one's text joined onto the previous item when `same` says
 * they belong together. Items with no text are dropped. Neither input is mutated.
 */
export function mergeAdjacent<T extends { text: string }>(
  head: readonly T[],
  items: readonly T[],
  same: (a: T, b: T) => boolean,
): T[] {
  const out = head.map((item) => ({ ...item }));
  for (const item of items) {
    const last = out.at(-1);
    if (last && same(last, item)) last.text += item.text;
    else if (item.text) out.push({ ...item });
  }
  return out;
}

/** Neighbouring runs that look the same become one run. */
const mergeRuns = (runs: TextRun[]): TextRun[] =>
  mergeAdjacent([], runs, (a, b) => a.inline === b.inline && sameStyle(a.style, b.style));

/** Where a run sits: the innermost tagged inline element, and the link around it. */
type InlineContext = { inline?: InlineElement; link?: LinkTarget };

/** The text of a block in document order, split into runs wherever the style or inline element changes. */
function collectRuns(el: HostElement, inherited: InheritedText, context: InlineContext = {}): TextRun[] {
  const { link } = context;
  return el.children.flatMap((c): TextRun[] => {
    if (c.kind === 'text') return [{ text: c.text, style: resolveText(inherited), ...context }];
    if (c.type === HostType.Span) {
      const lang = optionalLang(c);
      const inner = lang ? { ...context, inline: { kind: 'Span', lang, ...parentOf(context) } satisfies LangSpan } : context;
      return collectRuns(c, inheritText(inherited, parseInlineStyle(c.props.style, 'Span')), inner);
    }
    if (c.type === HostType.Link && !link) return linkRuns(c, inherited, context);
    const allowed = link ? 'text and <Span>' : 'text, <Span> and <Link>';
    throw new Error(`<${nameOf(el)}> may only contain ${allowed}, found ${describe(c)}.`);
  });
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** The only URL schemes a <Link> may point to; anything else (javascript:, file:, data:, …) is refused. */
const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

const parentOf = (context: InlineContext) => (context.inline ? { parent: context.inline } : {});

function linkRuns(el: HostElement, inherited: InheritedText, context: InlineContext): TextRun[] {
  const href = requireString(el, 'href', 'an external URL such as "https://example.com".');
  if (!HAS_SCHEME.test(href) || !URL.canParse(href)) {
    throw new Error(
      `<Link> href ${JSON.stringify(href)} is not supported yet: only external URLs with a scheme ` +
        '(e.g. "https://example.com") are; internal links and anchors are not.',
    );
  }
  const scheme = new URL(href).protocol;
  if (!ALLOWED_SCHEMES.includes(scheme)) {
    throw new Error(
      `<Link> href ${JSON.stringify(href)} uses the scheme ${JSON.stringify(scheme)}, which is not allowed; ` +
        `use one of ${ALLOWED_SCHEMES.join(', ')}.`,
    );
  }
  const { description } = el.props;
  if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) {
    throw new Error(
      `<Link> \`description\` must be a non-empty string (it is what assistive technology announces); ` +
        `got ${JSON.stringify(description)}. Leave it out to use the link text.`,
    );
  }
  const target: LinkTarget = { kind: 'Link', href, contents: '', ...parentOf(context) };
  const own = parseInlineStyle(el.props.style, 'Link');
  // Links are underlined unless the author says otherwise, so they never rely on color alone (WCAG 1.4.1).
  const style = { ...own, textDecoration: own.textDecoration ?? 'underline' };
  const runs = collectRuns(el, inheritText(inherited, style), { inline: target, link: target });
  const visible = textOf(runs).replace(/\s+/g, ' ').trim();
  if (!visible) {
    throw new Error(`<Link> href ${JSON.stringify(href)} has no visible text; put the link text inside <Link>.`);
  }
  target.contents = typeof description === 'string' ? description.trim() : visible;
  return runs;
}

const describe = (node: HostNode) =>
  node.kind === 'text' ? `text ${JSON.stringify(node.text.trim().slice(0, 30))}` : `<${nameOf(node)}>`;
