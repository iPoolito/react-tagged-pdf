// Test-only helpers that read a rendered PDF back through independent parsers
// (pdf-lib for object structure, pdfjs-dist for text), so assertions never
// depend on how the renderer builds the file.
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFStream,
  PDFString,
  decodePDFRawStream,
  type PDFObject,
  type PDFRawStream,
} from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

type TextItem = { str: string; transform: number[]; width: number; fontName: string };

async function withPdfjs<T>(bytes: Uint8Array, fn: (pdf: any) => Promise<T>): Promise<T> {
  // fontExtraProperties keeps each font's PDF name, which textRuns reports.
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0, fontExtraProperties: true, disableFontFace: true });
  try {
    return await fn(await task.promise);
  } finally {
    await task.destroy();
  }
}

/** Map of pdfjs marked-content id (`p<pageObj>R_mc<mcid>`) to the text drawn inside it. */
async function markedContentText(bytes: Uint8Array): Promise<Map<string, string>> {
  return withPdfjs(bytes, async (pdf) => {
    const text = new Map<string, string>();
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent({ includeMarkedContent: true });
      const stack: (string | null)[] = [];
      for (const it of tc.items as any[]) {
        if (it.type === 'beginMarkedContentProps' || it.type === 'beginMarkedContent') stack.push(it.id ?? null);
        else if (it.type === 'endMarkedContent') stack.pop();
        else {
          const id = stack.findLast((x) => x);
          if (id) text.set(id, (text.get(id) ?? '') + it.str + (it.hasEOL ? ' ' : ''));
        }
      }
    }
    return text;
  });
}

/** A structure element's `/K` entries, unresolved: `/K` may be one kid or an array of them. */
function kidsOf(node: PDFDict): PDFObject[] {
  const K = node.get(PDFName.of('K'));
  return K instanceof PDFArray ? K.asArray() : K ? [K] : [];
}

/**
 * Readable outline of the structure tree, one element per line, indented by depth:
 *   Document
 *     P "Read the [Link] today."
 *       Link "privacy policy" (1 OBJR)
 * An element's text is its own marked content; a child element inside it shows as `[Tag]`,
 * and object references (annotations) are counted.
 */
export async function structOutline(bytes: Uint8Array): Promise<string> {
  const text = await markedContentText(bytes);
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const ctx = doc.context;
  const lines: string[] = [];
  const mcText = (pg: PDFRef | undefined, mcid: number) =>
    pg ? (text.get(`p${pg.objectNumber}R_mc${mcid}`) ?? '') : '';

  const walk = (node: PDFDict, depth: number, inheritedPg: PDFRef | undefined) => {
    const pg = (node.get(PDFName.of('Pg')) as PDFRef | undefined) ?? inheritedPg;
    const kids = kidsOf(node);
    // Own text in kid order; a child element inside mixed content shows as [Tag] where it sits.
    const parts: string[] = [];
    let hasContent = false;
    let objrs = 0;
    for (const raw of kids) {
      const k = ctx.lookup(raw);
      const type = k instanceof PDFDict ? k.get(PDFName.of('Type'))?.toString() : undefined;
      if (k instanceof PDFNumber) {
        parts.push(mcText(pg, k.asNumber()));
        hasContent = true;
      } else if (k instanceof PDFDict && type === '/MCR') {
        parts.push(mcText(k.get(PDFName.of('Pg')) as PDFRef, (k.get(PDFName.of('MCID')) as PDFNumber).asNumber()));
        hasContent = true;
      } else if (k instanceof PDFDict && type === '/OBJR') {
        objrs++;
      } else if (k instanceof PDFDict && k.get(PDFName.of('S'))) {
        parts.push(`[${k.get(PDFName.of('S'))!.toString().slice(1)}]`);
      }
    }
    const own = hasContent ? parts.join(' ') : '';
    const S = node.get(PDFName.of('S'));
    if (S) {
      const attrs: string[] = [];
      for (const key of ['Alt', 'Lang']) {
        const v = node.lookup(PDFName.of(key));
        if (v instanceof PDFString || v instanceof PDFHexString) attrs.push(`${key}=${JSON.stringify(v.decodeText())}`);
      }
      const t = own.replace(/\s+/g, ' ').trim();
      lines.push(
        `${'  '.repeat(depth)}${S.toString().slice(1)}${attrs.length ? ` [${attrs.join(' ')}]` : ''}${t ? ` ${JSON.stringify(t)}` : ''}` +
          (objrs ? ` (${objrs} OBJR)` : ''),
      );
    }
    for (const raw of kids) {
      const k = ctx.lookup(raw);
      if (k instanceof PDFDict && k.get(PDFName.of('S'))) walk(k, S ? depth + 1 : depth, pg);
    }
  };

  const root = doc.catalog.lookupMaybe(PDFName.of('StructTreeRoot'), PDFDict);
  if (!root) return '(no StructTreeRoot)';
  walk(root, 0, undefined);
  return lines.join('\n');
}

export type PdfFacts = {
  version: string;
  catalogLang: string | undefined;
  markInfoMarked: boolean;
  displayDocTitle: boolean;
  infoTitle: string | undefined;
  xmp: string;
  fonts: { baseFont: string; embedded: boolean }[];
};

/** Document-level facts PDF/UA cares about, read straight from the file objects. */
export async function pdfFacts(bytes: Uint8Array): Promise<PdfFacts> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const cat = doc.catalog;
  const str = (o: PDFObject | undefined) =>
    o instanceof PDFString || o instanceof PDFHexString ? o.decodeText() : undefined;

  const metaStream = cat.lookupMaybe(PDFName.of('Metadata'), PDFStream);
  const xmp = metaStream ? new TextDecoder().decode(decodePDFRawStream(metaStream as PDFRawStream).decode()) : '';

  const fonts: PdfFacts['fonts'] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || obj.get(PDFName.of('Type'))?.toString() !== '/Font') continue;
    const subtype = obj.get(PDFName.of('Subtype'))?.toString();
    if (subtype === '/Type0') continue; // descendant CIDFont carries the descriptor
    const desc = obj.lookupMaybe(PDFName.of('FontDescriptor'), PDFDict);
    const embedded = !!desc && ['FontFile', 'FontFile2', 'FontFile3'].some((k) => desc.has(PDFName.of(k)));
    fonts.push({ baseFont: obj.get(PDFName.of('BaseFont'))?.toString().slice(1) ?? '?', embedded });
  }

  const header = new TextDecoder().decode(bytes.subarray(0, 16)).match(/%PDF-(\d\.\d)/)?.[1] ?? '?';
  return {
    version: header,
    catalogLang: str(cat.lookup(PDFName.of('Lang'))),
    markInfoMarked: cat.lookupMaybe(PDFName.of('MarkInfo'), PDFDict)?.get(PDFName.of('Marked'))?.toString() === 'true',
    displayDocTitle:
      cat.lookupMaybe(PDFName.of('ViewerPreferences'), PDFDict)?.get(PDFName.of('DisplayDocTitle'))?.toString() === 'true',
    infoTitle: doc.getTitle(),
    xmp,
    fonts,
  };
}

/**
 * Every text run drawn on each page, with its left x, width, baseline y (PDF user space), font size
 * and font: the PostScript name without the subset prefix, e.g. `NotoSans-Bold`.
 */
export async function textRuns(bytes: Uint8Array) {
  return withPdfjs(bytes, async (pdf) => {
    type Run = { str: string; x: number; y: number; width: number; size: number; font: string };
    const pages: { width: number; height: number; runs: Run[] }[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const [, , width, height] = page.view as number[];
      const tc = await page.getTextContent();
      // Font objects are only resolved once the page's operator list has been built.
      await page.getOperatorList();
      const fontName = (id: string) =>
        new Promise<string>((resolve) => page.commonObjs.get(id, (f: { name?: string }) => resolve(f?.name ?? '?')));
      const runs: Run[] = [];
      for (const it of tc.items as TextItem[]) {
        if (typeof it.str !== 'string' || it.str.length === 0) continue;
        runs.push({
          str: it.str,
          x: it.transform[4]!,
          y: it.transform[5]!,
          width: it.width,
          size: Math.hypot(it.transform[2]!, it.transform[3]!),
          font: (await fontName(it.fontName)).replace(/^[A-Z]{6}\+/, ''),
        });
      }
      pages.push({ width: width!, height: height!, runs });
    }
    return pages;
  });
}

/** Decoded content stream(s) of a page (1-based), for checking drawing operators such as colors and rectangles. */
export async function pageContent(bytes: Uint8Array, pageNumber = 1): Promise<string> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const page = doc.getPage(pageNumber - 1).node;
  const contents = page.lookup(PDFName.of('Contents'));
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents];
  return streams
    .map((s) => new TextDecoder('latin1').decode(decodePDFRawStream(s as PDFRawStream).decode()))
    .join('\n');
}

export type LinkAnnotation = {
  /** 1-based page the annotation is on. */
  page: number;
  /** [x1, y1, x2, y2] in PDF user space (origin bottom left). */
  rect: number[];
  uri: string | undefined;
  contents: string | undefined;
  structParent: number | undefined;
  /** Object number and tag of the structure element whose OBJR points at this annotation. */
  owner: { ref: number; type: string } | undefined;
  /** Object number of the structure element the ParentTree maps `structParent` to. */
  parentTreeOwner: number | undefined;
};

/** Every Link annotation, with the structure element that claims it (via OBJR) and the ParentTree's view of it. */
export async function linkAnnotations(bytes: Uint8Array): Promise<LinkAnnotation[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const ctx = doc.context;
  const str = (o: PDFObject | undefined) =>
    o instanceof PDFString || o instanceof PDFHexString ? o.decodeText() : undefined;

  const owners = new Map<number, { ref: number; type: string }>();
  const walk = (ref: PDFRef | undefined, node: PDFDict) => {
    for (const raw of kidsOf(node)) {
      const k = ctx.lookup(raw);
      if (!(k instanceof PDFDict)) continue;
      if (k.get(PDFName.of('Type'))?.toString() === '/OBJR' && ref) {
        const obj = k.get(PDFName.of('Obj')) as PDFRef;
        owners.set(obj.objectNumber, { ref: ref.objectNumber, type: node.get(PDFName.of('S'))!.toString().slice(1) });
      } else if (k.get(PDFName.of('S'))) {
        walk(raw instanceof PDFRef ? raw : undefined, k);
      }
    }
  };
  const root = doc.catalog.lookupMaybe(PDFName.of('StructTreeRoot'), PDFDict);
  if (root) walk(undefined, root);

  const parentTree = new Map<number, number>();
  const readNumberTree = (node: PDFDict | undefined) => {
    if (!node) return;
    const nums = node.lookupMaybe(PDFName.of('Nums'), PDFArray)?.asArray() ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const value = nums[i + 1];
      if (value instanceof PDFRef) parentTree.set((nums[i] as PDFNumber).asNumber(), value.objectNumber);
    }
    for (const kid of node.lookupMaybe(PDFName.of('Kids'), PDFArray)?.asArray() ?? []) {
      readNumberTree(ctx.lookup(kid) as PDFDict);
    }
  };
  readNumberTree(root?.lookupMaybe(PDFName.of('ParentTree'), PDFDict));

  const out: LinkAnnotation[] = [];
  doc.getPages().forEach((page, i) => {
    for (const raw of page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)?.asArray() ?? []) {
      const annot = ctx.lookup(raw) as PDFDict;
      if (annot.get(PDFName.of('Subtype'))?.toString() !== '/Link') continue;
      const structParent = (annot.get(PDFName.of('StructParent')) as PDFNumber | undefined)?.asNumber();
      out.push({
        page: i + 1,
        rect: (annot.lookup(PDFName.of('Rect')) as PDFArray).asArray().map((n) => (n as PDFNumber).asNumber()),
        uri: str(annot.lookupMaybe(PDFName.of('A'), PDFDict)?.lookup(PDFName.of('URI'))),
        contents: str(annot.lookup(PDFName.of('Contents'))),
        structParent,
        owner: raw instanceof PDFRef ? owners.get(raw.objectNumber) : undefined,
        parentTreeOwner: structParent === undefined ? undefined : parentTree.get(structParent),
      });
    }
  });
  return out;
}
