# Class and id reference

The class names in Designer are the **contract** with the generated CSS block. A typo silently
unstyles a section and there is no error anywhere — this is the main failure mode of this build route,
so check names against this list rather than typing from memory.

Everything in the CSS block is already written. You are not styling in Designer; you are applying the
right class so the existing rule matches.

## Ids the script needs

These are looked up by `getElementById`. **Wrong id = silently dead feature**, no console error.

| Id | Element | Purpose |
|---|---|---|
| `signup` | the card wrapper | scroll target for the closing CTA |
| `tiers` | plan row | the radiogroup the script queries for `.tier` children |
| `incl` | `<ul>` | **`[JS]`** benefit bullets, rewritten on every plan change |
| `save-line` | `<p>` | **`[JS]`** the savings claim |
| `q-email` / `q-phone` / `q-zip` | inputs | validation, masking, lead capture |
| `e-email` / **`e-qphone`** / `e-zip` | `.err-msg` divs | error messages. **Note `e-qphone`, not `e-phone`.** |
| `to-checkout` | button | the CTA. The script also inserts a hidden retry message after it. |
| `step-plan` / `step-confirm` / `step-oom` / `step-cancel` | panels | the four card states |
| `confirm-body` | `<p>` inside `#step-confirm` | the script **prepends** plan + price to its text |
| `restart` / `restart2` / `restart3` | buttons | reset, one per result panel |
| `cmp-body` | `<tbody>` | **`[JS]`** table rows |
| `cmp-p-weekly` / `cmp-p-twice` / `cmp-p-weekdays` | spans in `<thead>` | **`[JS]`** prices |
| `closer-cta` | button | scrolls to `#signup` |
| `how` / `compare` / `faq` | sections | anchors only |

## Structural classes

| Class | Where | Note |
|---|---|---|
| `wrap` | every section | 1080px container. Overridden in two places — see below. |
| `band` | each `<section>` | 56px vertical padding |
| `hero` | `<header>` | yellow background, 2-col grid |
| `card` | `#signup` | bone panel, 16px radius |
| `beta` | ribbon | black bar |
| `steps` | `#how` | 3-col grid |
| `steps-head` | above the grid | so the heading centres over the full width |
| `why` | Why band | **1213px wrap, 3 fixed columns.** Wider than every other band, deliberately. |
| `closer` | closing CTA | sky background |
| `faq-item` | 8 divs | bottom rule + padding |
| `foot-grid` / `foot-col` / `foot-bottom` / `foot-social` | footer | |

**Two deliberate `wrap` overrides.** `#compare`'s wrap is capped to **820px** (inline in the source);
`.why`'s wrap is **1213px** with `grid-template-columns:260px 413px 405px`. Both come from the Figma
frame. Do not normalise either to 1080.

## Plan tiles

| Class | Note |
|---|---|
| `tier-row` | 3-col grid, collapses to 1 under 820px |
| `tier` | the `<button>`. Declares `color` explicitly — see below. |
| `tier-name` / `tier-price` / `per` / `tier-blurb` | contents |
| `tier-badge` | "Most picked", plan 2 only |
| `tier-check` | the tick. `display:none` until `aria-checked="true"`. |
| `tier-unit` | **retired but kept on purpose.** Nothing renders it. |
| `incl` / `incl-hero` | benefit lists — two different lists, see below |
| `save` | the savings callout |

**`.tier` declares its own `color` and that is not redundant.** A `<button>` inherits text colour from
the browser's stylesheet — black on desktop, **system blue on iOS Safari**. Without the explicit
declaration, `.tier-name` and `.tier-price` (the only descendants that set no colour of their own)
rendered blue on iPhones while the price suffix, unit line and blurb stayed correct.

**`.tier-unit` is dead code that stays.** The per-visit price was removed from the tiles on 13 Aug to
match the Figma, but `economics()` still computes `perUse` and `unitNoun` correctly from `PLAN_UNITS`.
Keeping the rule means restoring the line is a renderer, not a re-derivation. Carry it across. This is
the opposite call from `.stepper` and `.review-*`, which were deleted on 14 Aug — those had no live
computation behind them and no note asking for them to stay.

**`.incl` and `.incl-hero` are the same component at two weights, and the scoping matters.** The hero
list is 16px bold; the card's list is 13/400 National 2. It is scoped by class, **not** by
`.hero .incl` — that selector was wrong and shipped once, because `#signup` sits *inside*
`<header class="hero">`, so it also hit the card's bullets. `#incl li` restates size and weight on the
element itself so the next over-reaching selector changes nothing.

## Comparison table

All of these live inside the Embed. You will not touch them in Designer, but recognise them if the
table looks wrong.

| Class | Note |
|---|---|
| `compare-card` | white card, clips the sticky column's left shadow |
| `compare-wrap` | the scrollport, with the right-edge `mask-image` fade |
| `compare` | on `<table>`. `border-collapse:separate` + `table-layout:fixed`, both load-bearing. |
| `cmp-col-label` / `cmp-col-plan` | `<col>` widths — fixed, not content-derived |
| `cmp-plan` / `cmp-price` / `cmp-flag` | header contents |
| `best` | the highlighted middle column, header included |
| `cmp-yes` / `no` | the tick and the em dash |
| `cmp-rule` / `cmp-money` / `pct` | **applied by JS**, not present in the embed markup |

`border-collapse:separate` is required because a collapsed-border table does not reliably honour
`z-index` on cells, which is what keeps the pinned label column above the scrolling ones.
`table-layout:fixed` makes the `<col>` widths authoritative so a long value cannot widen a column at
the plans' expense.

## Applied by JavaScript at runtime

Not in any Designer element, and not in the embed. Do not delete these rules from the CSS block
because you cannot find them in the markup:

`err` (invalid field) · `cmp-rule` · `cmp-money` · `pct` · `tier-unit`

## Utilities

| Class | Note |
|---|---|
| `vh` | visually hidden — in the accessibility tree, off screen. Webflow has no equivalent; use the class. |
| `hidden` | `display:none !important`. The script toggles it on the four card panels. |
| `btn-dark` | every button on the page |
| `fineprint` / `lede` / `display` / `g-eyebrow` | type roles |
| `req` | the red asterisk in labels |
| `err-msg` | error text, `display:none` until the script shows it |
| `polaroid` / `polaroid-wrap` | the rotated photo frames |
| `logo` / `logo-img` / `tag` / `tagline` / `legal` | nav and footer |

`.logo` and `.tag` are the **wordmark fallbacks** in the `onerror` handlers on the two logo images.
Webflow strips inline `onerror`, so unless you rebuild those as Embeds the classes go unused — keep the
rules anyway, they cost nothing and the fallback may come back.

## Rules that cannot be built in Designer

Listed in full in `README.md`. In this file, these are the specific selectors to leave alone in the CSS
block — every one is either state the script drives or a combinator the style panel has no concept of:

```
.tier[aria-checked="true"]                    selected plan: border + tint
.tier[aria-checked="true"] .tier-check        selected plan: reveal the tick
.compare-wrap[data-scroll-end="true"]         clear the scroll fade at the end
table.compare thead th:first-child            pinned label column (header)
table.compare tbody th[scope="row"]           pinned label column (body)
table.compare tbody tr + tr > *               row hairlines
table.compare tbody tr.cmp-rule > *           the heavier group rule
table.compare thead th:last-child .cmp-plan   wider tracking on column 3
input::placeholder, textarea::placeholder     one placeholder colour across browsers
*:focus-visible                               keyboard focus rings
.btn-dark:hover
.why p:last-child
.why-pro figcaption a:hover / :focus-visible
```

Plus the `:root` custom-property block (the whole palette) and the three `@font-face` rules.

## One addition to make in the CSS block

`index.html` sets each tile's selected-state tint with an inline `style="--tint:…"`. Webflow blocks
`style` as a custom attribute name, so add this to the head block instead. It is a straight
improvement — three values in one place instead of three inline styles:

```css
#tiers [data-tier="weekly"]   { --tint:#DBEFEF; }
#tiers [data-tier="twice"]    { --tint:#FFF3D6; }
#tiers [data-tier="weekdays"] { --tint:#F1E9EE; }
```
