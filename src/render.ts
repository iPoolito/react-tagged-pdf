import { writeFile } from 'node:fs/promises';
import type { ReactNode } from 'react';
import { report } from './diagnostics.js';
import { layoutDocument, layoutRunningContent } from './layout.js';
import { buildDocumentModel, runningBlocks } from './model.js';
import { createPdfDocument, imageSizer, measurerFor, paint, toBuffer } from './pdf.js';
import { renderTree } from './reconciler.js';

export type RenderOptions = {
  /**
   * Turn accessibility warnings into errors: rendering rejects with an `AccessibilityError`
   * listing every problem instead of warning. Meant for CI.
   */
  strict?: boolean;
};

/**
 * Render a `<Document>` element to a tagged PDF/UA-1 PDF in memory. Rejects with a
 * `ValidationError` (with a stable `code` and, where known, the component `path`) for input that
 * cannot be rendered, strict mode or not.
 */
export async function renderToBuffer(element: ReactNode, options: RenderOptions = {}): Promise<Buffer> {
  const model = buildDocumentModel(renderTree(element));
  report(model.diagnostics, options.strict === true);
  const doc = createPdfDocument(model);
  const measure = measurerFor(doc);
  const imageSize = imageSizer(doc);
  // Two passes: the flow decides the page count; then each page's header and footer can show it.
  const pages = layoutDocument(model, measure, imageSize);
  layoutRunningContent(pages, measure, imageSize, (content, info, place) =>
    runningBlocks(renderTree(content(info)), place),
  );
  paint(doc, pages);
  return toBuffer(doc);
}

/** Render a `<Document>` element and write the PDF to `path`. Rejects like `renderToBuffer`. */
export async function renderToFile(element: ReactNode, path: string, options: RenderOptions = {}): Promise<void> {
  await writeFile(path, await renderToBuffer(element, options));
}
