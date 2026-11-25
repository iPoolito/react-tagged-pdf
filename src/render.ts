import { writeFile } from 'node:fs/promises';
import type { ReactNode } from 'react';
import { layoutDocument, layoutRunningContent } from './layout.js';
import { buildDocumentModel, runningBlocks } from './model.js';
import { createPdfDocument, measurerFor, paint, toBuffer } from './pdf.js';
import { renderTree } from './reconciler.js';

export type RenderOptions = {
  /** Turn accessibility warnings into errors. Reserved; not implemented yet. */
  strict?: boolean;
};

/** Render a `<Document>` element to a tagged PDF/UA-1 PDF in memory. */
export async function renderToBuffer(element: ReactNode, _options: RenderOptions = {}): Promise<Buffer> {
  const model = buildDocumentModel(renderTree(element));
  for (const warning of model.warnings) console.warn(`react-tagged-pdf: ${warning}`);
  const doc = createPdfDocument(model);
  const measure = measurerFor(doc);
  // Two passes: the flow decides the page count; then each page's header and footer can show it.
  const pages = layoutDocument(model, measure);
  layoutRunningContent(pages, measure, (content, info, place) => runningBlocks(renderTree(content(info)), place));
  paint(doc, pages);
  return toBuffer(doc);
}

/** Render a `<Document>` element and write the PDF to `path`. */
export async function renderToFile(element: ReactNode, path: string, options: RenderOptions = {}): Promise<void> {
  await writeFile(path, await renderToBuffer(element, options));
}
