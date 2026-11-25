import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import {
  AccessibilityError,
  Artifact,
  Document,
  H1,
  H2,
  H3,
  Image,
  List,
  ListItem,
  Page,
  renderToBuffer,
  renderToFile,
  Section,
  Table,
  TD,
  TR,
} from '../src/index.js';

const PNG = fileURLToPath(new URL('./fixtures/images/chart.png', import.meta.url));

const doc = (children: ReactNode) => (
  <Document title="Strict" lang="en-US">
    <Page>{children}</Page>
  </Document>
);

let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

/** Render in strict mode and return what it threw. */
async function strictError(element: ReactNode): Promise<AccessibilityError> {
  const error = await renderToBuffer(element, { strict: true }).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AccessibilityError);
  return error as AccessibilityError;
}

describe('skipped heading level', () => {
  const skipping = doc(
    <>
      <H1>Title</H1>
      <Section>
        <H3>Too deep</H3>
      </Section>
    </>,
  );

  it('warns with its code and component path by default, and still renders', async () => {
    const pdf = await renderToBuffer(skipping);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toBe(
      'react-tagged-pdf RTP_HEADING_SKIP at Document > Page[1] > Section > H3: Heading <H3> "Too deep" follows ' +
        '<H1> "Title" and skips level 2; PDF/UA does not allow skipped heading levels (use consecutive levels).',
    );
  });

  it('throws in strict mode, without warning', async () => {
    const error = await strictError(skipping);
    expect(error.code).toBe('RTP_HEADING_SKIP');
    expect(error.diagnostics).toEqual([
      expect.objectContaining({ code: 'RTP_HEADING_SKIP', path: 'Document > Page[1] > Section > H3' }),
    ]);
    expect(error.message).toContain('RTP_HEADING_SKIP at Document > Page[1] > Section > H3');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('first heading not an H1', () => {
  const startsLow = doc(<H2>Starts low</H2>);

  it('warns with its code and component path by default', async () => {
    await renderToBuffer(startsLow);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toBe(
      'react-tagged-pdf RTP_HEADING_FIRST_NOT_H1 at Document > Page[1] > H2: Heading <H2> "Starts low" is the ' +
        'first heading; PDF/UA expects the first heading to be an <H1>.',
    );
  });

  it('throws in strict mode', async () => {
    const error = await strictError(startsLow);
    expect(error.code).toBe('RTP_HEADING_FIRST_NOT_H1');
    expect(error.diagnostics.map((d) => d.path)).toEqual(['Document > Page[1] > H2']);
  });
});

describe('table without TH', () => {
  const headerless = (
    <Document title="Strict" lang="en-US">
      <Page>
        <H1>Prices</H1>
      </Page>
      <Page>
        <List>
          <ListItem>
            <Table>
              <TR>
                <TD>Apples</TD>
                <TD>1.20</TD>
              </TR>
            </Table>
          </ListItem>
        </List>
      </Page>
    </Document>
  );

  it('warns with its code and component path by default', async () => {
    await renderToBuffer(headerless);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(
      /^react-tagged-pdf RTP_TABLE_NO_TH at Document > Page\[2\] > List > ListItem > Table: <Table> starting "Apples" has no <TH> header cells/,
    );
  });

  it('throws in strict mode', async () => {
    const error = await strictError(headerless);
    expect(error.code).toBe('RTP_TABLE_NO_TH');
    expect(error.diagnostics.map((d) => d.path)).toEqual(['Document > Page[2] > List > ListItem > Table']);
  });
});

describe('image with empty alt', () => {
  const emptyAlt = doc(<Image src={PNG} alt="" />);

  it('warns with its code and component path by default', async () => {
    await renderToBuffer(emptyAlt);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(
      /^react-tagged-pdf RTP_IMAGE_EMPTY_ALT at Document > Page\[1\] > Image: <Image> ".*chart\.png" has an empty `alt`/,
    );
  });

  it('throws in strict mode', async () => {
    const error = await strictError(emptyAlt);
    expect(error.code).toBe('RTP_IMAGE_EMPTY_ALT');
    expect(error.diagnostics.map((d) => d.path)).toEqual(['Document > Page[1] > Image']);
  });
});

describe('strict mode', () => {
  it('lists every problem in one error, coded by the first', async () => {
    const error = await strictError(
      doc(
        <>
          <H2>Starts low</H2>
          <Image src={PNG} alt="" />
        </>,
      ),
    );
    expect(error.code).toBe('RTP_HEADING_FIRST_NOT_H1');
    expect(error.diagnostics.map((d) => d.code)).toEqual(['RTP_HEADING_FIRST_NOT_H1', 'RTP_IMAGE_EMPTY_ALT']);
    expect(error.message).toMatch(/2 accessibility problems:\n {2}- .*RTP_HEADING_FIRST_NOT_H1.*\n {2}- .*RTP_IMAGE_EMPTY_ALT/);
  });

  it('renders a document without problems, and does not count artifacts', async () => {
    const pdf = await renderToBuffer(
      doc(
        <>
          <H1>Fine</H1>
          <Artifact>
            <H3>Decoration</H3>
            <Image src={PNG} alt="" />
          </Artifact>
        </>,
      ),
      { strict: true },
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(warn).not.toHaveBeenCalled();
  });

  it('rejects from renderToFile too, without writing the file', async () => {
    const path = join(tmpdir(), `rtp-strict-${process.pid}.pdf`);
    await expect(renderToFile(doc(<H2>Starts low</H2>), path, { strict: true })).rejects.toBeInstanceOf(
      AccessibilityError,
    );
    expect(existsSync(path)).toBe(false);
  });
});
