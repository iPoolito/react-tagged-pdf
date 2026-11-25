---
title: Validating your PDFs
description: Check PDFs against PDF/UA-1 with veraPDF and PAC, and know what neither tool can check.
---

react-tagged-pdf is tested against the **veraPDF PDF/UA-1** profile: every fixture in the repository's
`test/fixtures/` and every example on this site is validated in CI. Validate your own documents too: your
content, fonts and images are not in our tests.

## veraPDF (PDF/UA-1)

[veraPDF](https://verapdf.org) is an open-source validator. Its PDF/UA-1 profile checks the machine-checkable
requirements of ISO 14289-1. The easiest way to run it is the official Docker image; pin a version so results
don't change under you:

```bash
docker run --rm -v "$PWD":/data verapdf/cli:v1.30.4 -f ua1 --format text -v report.pdf
```

- `-f ua1` forces the PDF/UA-1 profile instead of auto-detecting one.
- `-v` lists the id of each failed rule, e.g. `7.4.2-1` (a skipped heading level).
- File names are paths inside the container: the current directory is mounted at `/data`.
- `--format html` writes a human-readable report; `--format json` is easier to read from a script.
- `-r /data` validates every PDF in the directory.

Output looks like:

```text
PASS /data/report.pdf ua1
```

The exit code is `0` when every file is compliant and `1` when at least one is not, so the command can fail a
CI job directly. Other codes mean veraPDF could not validate at all (for example `4`: no such file, `7`: not a
PDF).

In the repository, `npm run test:ua` renders every fixture and runs this check (Docker required).

### Combine it with strict mode

`renderToFile(element, path, { strict: true })` rejects with an `AccessibilityError` for problems the library
can see in your components, such as a skipped heading level, a table without header cells or an empty `alt`.
veraPDF then checks the file that comes out. Use both in CI.

## PAC

[PAC](https://pac.pdf-accessibility.org) (PDF Accessibility Checker, by axes4) is a free Windows application.
It checks PDF/UA and also has a screen-reader preview that shows the document's structure and reading order as
assistive technology would get it. Open the PDF in PAC and run the check; the preview is the fastest way to see
whether the tag tree matches what you meant.

veraPDF and PAC implement the checks independently, so on edge cases they can disagree. A file that passes
veraPDF's PDF/UA-1 profile is what this project tests for.

## What no checker can tell you

Both tools verify that the file is technically well formed: it has a structure tree, a language, a title,
embedded fonts, alt text on figures, tagged links and no untagged content. Neither can judge:

- whether alt text actually describes the image, and whether an image marked `decorative` really is;
- whether the reading order and heading outline make sense to someone who can't see the page;
- whether link text makes sense out of context;
- whether table headers are the right cells, and whether complex tables are understandable;
- colour contrast, text size and whether meaning is conveyed by colour alone;
- whether the document's `lang` and in-text language changes are correct.

Passing veraPDF is not a claim that a document is accessible or complies with any law or guideline. Test with a
screen reader and, where it matters, have people with disabilities review the result. See
[Author responsibilities](../author-responsibilities/).
