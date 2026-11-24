import { writeFile } from 'node:fs/promises';
import type { ReactNode } from 'react';
import { layoutDocument } from './layout.js';
import { buildDocumentModel } from './model.js';
import { createPdfDocument, measurerFor, paint, toBuffer } from './pdf.js';
import { renderTree } from './reconciler.js';

export type RenderOptions = {
  /** Turn accessibility warnings (such as a skipped heading level) into errors instead of `console.warn`. */
  strict?: boolean;
};

/** Render a `<Document>` element to a tagged PDF/UA-1 PDF in memory. */
export async function renderToBuffer(element: ReactNode, options: RenderOptions = {}): Promise<Buffer> {
  const model = buildDocumentModel(renderTree(element));
  if (options.strict && model.warnings.length > 0) throw new Error(model.warnings.join('\n'));
  for (const warning of model.warnings) console.warn(`react-tagged-pdf: ${warning}`);
  const doc = createPdfDocument(model);
  const pages = layoutDocument(model, measurerFor(doc));
  paint(doc, pages);
  return toBuffer(doc);
}

/** Render a `<Document>` element and write the PDF to `path`. */
export async function renderToFile(element: ReactNode, path: string, options: RenderOptions = {}): Promise<void> {
  await writeFile(path, await renderToBuffer(element, options));
}
