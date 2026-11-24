import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import helloWorld from './fixtures/hello-world.js';
import { structOutline } from './support/read-pdf.js';

describe('renderToBuffer', () => {
  it('produces a Document > P structure tree for the hello-world fixture', async () => {
    const pdf = await renderToBuffer(helloWorld);
    expect(await structOutline(pdf)).toMatchInlineSnapshot(`
      "Document
        P "Hello, tagged PDF world!""
    `);
  });
});
