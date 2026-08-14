# Moving this page into Webflow

**Route: hybrid.** Structure and text get built as real Webflow elements so the copy is editable in
Designer. Styling and behaviour stay as generated code blocks, because a lot of this page cannot be
expressed in Designer at all — see [What Designer cannot do](#what-designer-cannot-do) below, and
`build-spec.md` section by section.

**`index.html` stays the source of truth.** Everything in `dist/` is generated and gitignored.

```bash
node webflow/build.mjs
```

That writes three paste-ready files and reports each against Webflow's character limit. If a block
looks wrong, fix `index.html` and re-run — never edit `dist/`. This repo already deleted a
hand-maintained copy of the page (`deploy/index.html`, removed 12 Aug 2026) after it drifted and
outlived the comment telling people to sync it.

## The files

| File | What it is |
|---|---|
| `build.mjs` | Generates the paste blocks from `index.html`. Run it first. |
| `build-spec.md` | Section-by-section Designer build, in order, with the structure to create. |
| `classes.md` | Every class on the page: what to style in Designer, what to leave to the CSS block. |
| `copy-deck.md` | Every string, per section — including which ones are contested and who owns them. |
| `assets.md` | Fonts and images. All of them are already on this site's Webflow CDN. |
| `dist/` | Generated. Not in git. |

## Order of operations

1. **`node webflow/build.mjs`** — you need the numbers before you plan anything.
2. **Check `Site settings > Fonts` for National 2** before touching the head block. See `assets.md`;
   if it is already uploaded, delete the `@font-face` rules from the generated head code so the
   site is not serving two copies of the same face.
3. **Paste the head block** into `Page settings > Custom code > Inside <head> tag`.
4. **Build the sections** per `build-spec.md`, using the exact class names in `classes.md`. The
   class names are the contract between Designer and the CSS block — a typo silently unstyles a
   section.
5. **Paste the footer block** into `Page settings > Custom code > Before </body> tag`.
6. **Publish to staging and verify** against the checklist at the bottom of `build-spec.md`.

Custom code requires a **paid Site plan**, and it does not run in the Designer canvas — only on
published sites and in Preview. Expect the page to look unstyled while you build it. That is normal
and it is the main ergonomic cost of this route.

## Size, and the one thing to watch

Measured on the current page:

| Block | Chars | Of 50k |
|---|---|---|
| `head-code.html` | 15,758 | 32% |
| `footer-code.js` | 19,816 | 40% |
| `embed-compare-table.html` | 1,902 | 4% |
| **Total** | **37,476** | **75%** |

Webflow's limit is 50,000 characters, and its own documentation is ambiguous about whether that is
per field or a total across the site — the announcement says "up to 50,000 characters of custom code
across Site settings, Page settings, Code Embed elements and CMS Rich text fields", while the Help
Center says a Code Embed "cannot exceed 50,000 characters" and suggests splitting long code across
several embeds, which only helps if the limit is per element. **At 75% of the ceiling the page fits
either way**, so this does not need resolving before you start. It does need watching if the page
grows.

The build strips comments to get there. The annotated behaviour script is **45,390 characters on its
own — 91% of the limit** — and those comments are the most valuable documentation in this project.
They belong in git. Read them in `index.html`; do not try to carry them into a Webflow text field.

If the page ever does outgrow the limit, the escape is to self-host the behaviour script and
reference it with `<script src>` rather than to start deleting things.

## What Designer cannot do

This is the honest case for keeping a CSS block rather than translating everything into Designer
styles. None of the following can be built in the Designer style panel:

- **`<table>`.** Webflow has no table element, so the comparison table is markup in an Embed. There
  is no Designer-native version of that section. This one is structural, not cosmetic.
- **Attribute selectors.** `.tier[aria-checked="true"]` is how the selected plan card gets its
  border and tint, and `.compare-wrap[data-scroll-end="true"]` is how the scroll-fade clears. Both
  are driven by JS setting attributes; Designer has no state for either.
- **`::placeholder`.** The page sets one placeholder colour on purpose, because Chrome, Firefox and
  Safari each ship a different default and the same form otherwise renders three weights of hint
  text. Firefox also needs `opacity:1` reset on top of the colour.
- **`:focus-visible`.** The whole keyboard focus ring.
- **Sibling and structural combinators.** `tbody tr + tr > *` draws the table hairlines,
  `thead th:last-child` widens the third column's tracking, `p:last-child` closes the Why band.
- **`position:sticky` on table cells,** which is what pins the row-label column while the plans
  scroll under it, plus the two box-shadows that keep it above them.
- **`mask-image`,** the right-edge fade on the scrollable table.
- **CSS custom properties.** The whole palette is tokens, and `--tint` is set per plan card.
- **`@font-face`,** if National 2 is not already uploaded as a custom font.

Translating the rest into Designer styles is possible but is not recommended as a first pass: the
stylesheet carries ~170 lines of comments explaining measured decisions — colour contrast ratios
checked against WCAG, the 16px input size that stops iOS zooming the page mid-form, the frame widths
the Why band is built from — and hand-translating them into a style panel discards all of that
reasoning while inviting exactly the drift this repo keeps getting bitten by. Do it later, per
section, if and when marketing actually needs to restyle something.

## Two things that will bite you

**Mixpanel will double-count if you are not careful.** This page's Mixpanel block is a *fallback*.
`index.html` records that the page expects the site-wide Mixpanel already initialised in Webflow's
**site** footer custom code, on the same project token, so cross-page UTM and referrer attribution
survives. The loader in the generated footer only fires when no site-wide instance exists — a local
file, or the GitHub Pages review link. On Webflow it should no-op. **Verify that it does**, because
two initialised instances double every event on the one page whose entire output is a signup count.

**Nothing will reach Segment from staging, and that is correct.** `YG_IS_PROD` tests the hostname
against `yourgi.com`, so a `webflow.io` staging domain tags every Mixpanel event `test_mode:true` and
suppresses Segment `identify()` completely. That gate is deliberate — `identify()` writes a real
person record keyed on a real email and fans out to downstream tooling, and a colleague testing the
form should not become a marketing contact. While testing on staging, look for the
`[preview] Segment suppressed:` line in the browser console instead of Segment traffic.

## The test suite does not test the Webflow build

Keep running it against `index.html`:

```bash
node test/prototype.test.mjs
```

All 300 assertions pass against the page. Run against a page assembled from `dist/`, **290 pass and
10 fail — and all 10 are correct failures.** Every one of them asserts that a piece of *reasoning* is
written down in the page source ("the §7 q1 override is written down in the page itself", "the source
still records why it was blanked", "and warns that `stripe config --list` cannot tell you if the
sandbox is claimed"). Comment-stripping removes exactly those. No behavioural assertion fails.

So: the suite's job is to guard `index.html`, which is where the reasoning lives. Do not point it at
`dist/`, and do not "fix" those ten guards by deleting them — they are the reason this page's
history is legible.
