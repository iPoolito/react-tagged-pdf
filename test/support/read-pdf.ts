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

type TextItem = { str: string; transform: number[]; width: number };

async function withPdfjs<T>(bytes: Uint8Array, fn: (pdf: any) => Promise<T>): Promise<T> {
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
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

/**
 * Readable outline of the structure tree, one element per line, indented by depth:
 *   Document
 *     P "Hello world"
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
    const K = node.get(PDFName.of('K'));
    const kids: PDFObject[] = K instanceof PDFArray ? K.asArray() : K ? [K] : [];
    let own = '';
    for (const raw of kids) {
      const k = ctx.lookup(raw);
      if (k instanceof PDFNumber) own += ' ' + mcText(pg, k.asNumber());
      else if (k instanceof PDFDict && k.get(PDFName.of('Type'))?.toString() === '/MCR') {
        own += ' ' + mcText(k.get(PDFName.of('Pg')) as PDFRef, (k.get(PDFName.of('MCID')) as PDFNumber).asNumber());
      }
    }
    const S = node.get(PDFName.of('S'));
    if (S) {
      const attrs: string[] = [];
      for (const key of ['Alt', 'Lang']) {
        const v = node.lookup(PDFName.of(key));
        if (v instanceof PDFString || v instanceof PDFHexString) attrs.push(`${key}=${JSON.stringify(v.decodeText())}`);
      }
      const t = own.replace(/\s+/g, ' ').trim();
      lines.push(
        `${'  '.repeat(depth)}${S.toString().slice(1)}${attrs.length ? ` [${attrs.join(' ')}]` : ''}${t ? ` ${JSON.stringify(t)}` : ''}`,
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

/** Every text run drawn on each page, with its left x, width and baseline y (PDF user space). */
export async function textRuns(bytes: Uint8Array) {
  return withPdfjs(bytes, async (pdf) => {
    const pages: { width: number; height: number; runs: { str: string; x: number; y: number; width: number }[] }[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const [, , width, height] = page.view as number[];
      const tc = await page.getTextContent();
      const runs = (tc.items as TextItem[])
        .filter((it) => typeof it.str === 'string' && it.str.length > 0)
        .map((it) => ({ str: it.str, x: it.transform[4]!, y: it.transform[5]!, width: it.width }));
      pages.push({ width: width!, height: height!, runs });
    }
    return pages;
  });
}
