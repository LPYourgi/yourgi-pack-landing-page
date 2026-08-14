# Section-by-section Designer build

Build these in order, top to bottom. Class names are the contract with the generated CSS block — use
them exactly as written. Copy comes from `copy-deck.md`, assets from `assets.md`.

**Conventions used below**

- `div.wrap` is the page's shared container: `max-width:1080px; margin:0 auto; padding:0 20px`. Every
  section has one. Two sections deliberately override its width — see §5 and §6.
- **Custom attributes** are set in Designer under *Element settings > Custom attributes*.
- **`[JS]`** marks an element the footer script writes into. Leave it empty in Designer. Do not type
  placeholder text into one — it will flash on first paint before the script runs.
- **`.vh`** is the visually-hidden utility (screen readers only). It is in the CSS block; just apply
  the class.

Custom code does not run on the Designer canvas, so the page will look unstyled while you work.
Use Preview or publish to staging to see it.

---

## 1. Nav — logo only, deliberately

```
nav                                    (Navbar or plain Section — no Webflow nav interactions needed)
└─ div.wrap
   └─ a  href="https://www.yourgi.com"  aria-label="Yourgi home"
      └─ img.logo-img  height=30
```

**No site nav links.** `index.html` explains why and it is worth preserving: this page is decoupled
from the app, it has one job, and nav links leak people out of the page whose entire purpose is
measuring whether they sign up. The logo links to yourgi.com so someone about to hand over a card can
confirm who they are paying.

The source has an `onerror` fallback that swaps the image for the wordmark. Webflow will strip inline
`onerror`, so **either** rebuild it as an Embed **or** accept losing it — it is a nice-to-have, not
load-bearing.

## 2. Beta ribbon

```
div.beta
└─ div.wrap
   └─ span
      ├─ strong        "New & in testing"
      └─ (text)        " Yourgi Plus is a limited beta. Cancel any month, …"
```

Do not drop this. §8 gap 5 of the PRD requires that people are told this is a test that may end
*before* they pay, and since the "Straight up" band was removed to match the Figma, **this ribbon is
now the only place on the page carrying that disclosure.**

## 3. Hero — two columns

```
header.hero
└─ div.wrap                            (grid: 1.05fr .95fr, gap 32, padding 48px 20px)
   ├─ div                              ← left: the offer
   │  ├─ h1                            "Pet care,<br>handled for you"   (keep the line break)
   │  ├─ p.lede  × 3
   │  ├─ h2.g-eyebrow                  "What you get"    (inline: font-size 24px, margin 26px 0 10px)
   │  └─ ul.incl.incl-hero             4 × li, each: inline check SVG + span
   └─ div#signup.card                  ← right: the signup card, four states
```

The hero list is **static markup with the check SVGs written in**, not JS-injected — it is above the
fold and should not need a script to stop looking broken. In Webflow, that means an Embed for the
four `li` (SVG + span each), or four list items each containing an Embed for the check.

`.incl-hero` exists because scoping by `.hero .incl` was wrong and shipped once: the signup card sits
*inside* `header.hero`, so that selector also hit the card's bullets and made them 16px bold. Keep the
class-based scoping.

### 3a. The signup card — `div#signup.card`

Four sibling panels. Only the first is visible at rest; the other three carry `.hidden` and the script
swaps them.

```
div#signup.card
├─ div#step-plan                       ← visible at rest
│  ├─ h2                               "Pick your routine"   (inline: 16px, margin-bottom 14px)
│  ├─ div#tiers.tier-row               role="radiogroup"  aria-label="Choose a plan"
│  │  └─ button.tier  × 3              ← see the attribute table below
│  ├─ ul#incl.incl                     aria-live="polite"          [JS]
│  ├─ p#save-line.save                                             [JS]
│  ├─ div  (flex, gap 12)              ← email + phone side by side
│  │  ├─ div  → label[for=q-email] + input#q-email + div#e-email.err-msg
│  │  └─ div  → label[for=q-phone] + input#q-phone + div#e-qphone.err-msg
│  ├─ div                              ← zip
│  │  ├─ label[for=q-zip] + input#q-zip + div#e-zip.err-msg
│  │  └─ p.fineprint                   "So we can check we have Pros walking your streets…"
│  ├─ button#to-checkout.btn-dark      "Get started"   (width 100%)
│  └─ p.fineprint                      billing line, centred, full card width
├─ div#step-confirm.hidden             ← returned from Stripe, paid
├─ div#step-oom.hidden                 ← out of market
└─ div#step-cancel.hidden              ← returned without paying
```

**Note the error-message id:** the phone field's error div is **`e-qphone`**, not `e-phone`. The
script looks it up by that exact id.

**Inputs** — set these in Designer, they matter:

| Field | id | type | autocomplete | Extra |
|---|---|---|---|---|
| Email | `q-email` | `email` | `email` | `aria-required="true"`, `aria-describedby="e-email"` |
| Phone | `q-phone` | `tel` | `tel` | `aria-required="true"`, `aria-describedby="e-qphone"` |
| Zip | `q-zip` | `text` | `postal-code` | `inputmode="numeric"`, `aria-required="true"`, `aria-describedby="e-zip"` |

Each `.err-msg` needs `role="alert"`. They are `display:none` in CSS and the script toggles them.

**The 16px font size on inputs is not a style choice.** iOS Safari zooms the whole page when it
focuses an input under 16px, which throws the layout sideways mid-form on exactly the device most ad
traffic uses. It is in the CSS block; do not let a Designer style override it down.

**The three plan buttons** — these must be `<button>` elements, not links or divs, and each needs
five custom attributes:

| | Plan 1 | Plan 2 (default) | Plan 3 |
|---|---|---|---|
| `data-tier` | `weekly` | `twice` | `weekdays` |
| `data-price` | `49` | `99` | `499` |
| `data-label` | `Two Anything` | `Five Anything` | `Full Coverage` |
| `role` | `radio` | `radio` | `radio` |
| `aria-checked` | `false` | **`true`** | `false` |
| `tabindex` | `-1` | **`0`** | `-1` |

The `data-tier` values look wrong and are correct. They read `weekly` / `twice` / `weekdays` while the
plans are called Two Anything / Five Anything / Full Coverage, because the plans were renamed and the
keys were not. They are load-bearing in three other places — the Stripe Payment Link map, the
`cmp-p-*` element ids in the comparison table, and the `plan_tier` value on every analytics event —
so renaming them is a mechanical refactor with real breakage risk, not a copy change. **Leave them.**

Each button's children:

```
button.tier
├─ span.tier-badge                     ← plan 2 only: "Most picked"
├─ span.tier-check                     ← the circled tick SVG (Embed); CSS shows it only when selected
├─ span.tier-name
├─ span.tier-price   → "$49" + span.per "/mo"
└─ span.tier-blurb
```

**The selected-state tint.** In `index.html` each button carries `style="--tint:#DBEFEF"` and
`.tier[aria-checked="true"]` uses it as a background. Webflow blocks `style` as a custom attribute
name, so **add this to the head CSS block instead** (it is a straight improvement — it removes the
inline style and puts all three tints in one place):

```css
#tiers [data-tier="weekly"]   { --tint:#DBEFEF; }
#tiers [data-tier="twice"]    { --tint:#FFF3D6; }
#tiers [data-tier="weekdays"] { --tint:#F1E9EE; }
```

`.tier` also declares `color` explicitly, which is not redundant: a `<button>` takes its text colour
from the browser's own stylesheet — black on desktop, **system blue on iOS Safari** — and without it
the plan name and price rendered blue on iPhones while the other three lines stayed correct.

### 3b–3d. The three result panels

All three: `text-align:center; padding:10px 4px`, a `div.display` heading, a paragraph, and a
`button.btn-dark`. Buttons are `#restart`, `#restart2`, `#restart3` — three separate ids, all wired to
the same reset.

`#step-confirm`'s paragraph must have **`id="confirm-body"`**. The script prepends the plan name and
price to whatever text is in it, so the approved paragraph has to be there as real text in Designer.
Get this one right: it is the screen someone sees straight after paying, and it carried retired copy
for a day because a JS override replaced it instead of prepending. Five tests now guard it.

## 4. How it works — three steps

```
section.band.steps#how                 (inline background:#fff)
├─ div.steps-head → h2                 "How Yourgi Plus works"
└─ div.wrap                            (grid: 3 × 1fr, gap 32)
   └─ div × 3
      ├─ div.step-num                  "Step 1" / "Step 2" / "Step 3"
      ├─ h3                            sentence case in the markup
      └─ p
```

**Type the headings in sentence case.** `.steps h3` uppercases them with `text-transform`, which is
how every other uppercase heading on this page works. It reads better aloud too — a screen reader says
the words rather than spelling out what looks like an acronym.

Step 3 is **"White glove booking"**, which deliberately diverges from the Figma. The frame gives steps
2 and 3 the same heading ("Choose providers", trailing space and all) while step 3's body is about
Concierge handling the booking — a copy-paste slip in the design, not a spec. Do not "correct" it back.

## 5. Comparison table — this one is an Embed

```
section.band#compare
└─ div.wrap                            ← override max-width to 820px
   ├─ h2                               "Which plan is right for your pet?"  (32px, centred)
   ├─ p                                intro line (14px, #444, centred)
   └─ Embed                            ← paste dist/embed-compare-table.html
```

**Webflow has no table element**, so the whole table is markup. This is the one section with no
Designer-native option.

`<tbody id="cmp-body">` is empty and the script fills it from `PLAN_UNITS` — the same config the plan
tiles read, which is why the tiles and the table can never disagree about a price. The three
`<span class="cmp-price" id="cmp-p-weekly|twice|weekdays">` in the header are also `[JS]`. Do not type
rows or prices into the embed.

The table scrolls sideways on narrow screens with the row-label column pinned, because scrolling away
from what the numbers mean is worse than scrolling. That is `position:sticky` plus a `mask-image`
fade — both in the CSS block, neither expressible in Designer.

## 6. Why Yourgi Plus — three columns, wider than the rest of the page

```
section.band.why                       (inline background:#fff)
└─ div.wrap                            ← override: max-width 1213px, grid 260px 413px 405px,
   │                                     column-gap 29px, align-items center
   ├─ div.polaroid-wrap → img.polaroid           ← rotated −7deg in CSS
   ├─ div → h2 + p                                "Why Yourgi Plus?"
   └─ div.why-card
      ├─ div.why-panel → h2 + p                  "Expert help,<br>when you need it"
      └─ figure.why-pro
         ├─ img.polaroid  width=160 height=125   ← rotated +13deg in CSS
         └─ figcaption → strong "Kai F." / "Yourgi Concierge" / "Text or Call" + tel: link
```

**This band is wider than every other band on the page** (1173px of content against the FAQ's 1040)
and that is the frame, not a mistake. Do not normalise it to match the others.

**The column gaps are unequal on purpose.** 29px binds the polaroid to the copy as one unit; the card
is pushed away by 29 + a 37px margin as a separate thing. Averaging them to 48 flattens that grouping.

Both photos are **straight files rotated in CSS** — do not go looking for pre-rotated assets. The
`why-pro` photo straddles the yellow panel's bottom edge via a negative margin measured against the
*rotated* bounding box, so it holds if the card grows taller.

The phone number is a real `tel:` link, unstyled at rest and underlined on hover/focus. The frame
draws it as plain text; the link is the half the frame cannot express and the half that matters on the
phone someone is reading it on.

⚠️ **Two copy items in this card need sign-off before launch, per `docs/open-asks.md`:** the
"8am-8pm access to the Yourgi Concierge" line reads as a plan entitlement here (it came from a
benefits page), and a named staff member with a direct number is a different proposition on a page
taking recurring money from the public. Build it as specified; flag it.

## 7. FAQ — full page width

```
section.band#faq
└─ div.wrap                            ← the default 1080px; do NOT cap the answers
   ├─ h2                               "FAQ's"
   └─ div.faq-item × 8 → h3 + p
```

**Do not add a max-width to `.faq-item p`.** The answers run 102–132 characters a line, which is over
the brand's 30–60 rule, and this is a decision on record rather than an oversight: the frame has
always been 1044px here, the narrow cap this page used to carry was a local override of the source of
truth, and Lauren was shown the measured number and chose the frame's width twice — the second time
explicitly. If it is ever revisited, the column narrows in Figma first and the page follows.

`.faq-item h3` sets `text-transform:none`, unlike the step headings — the frame sets FAQ questions in
sentence case, so the two `h3` contexts genuinely differ. Type them as sentences.

## 8. Closing CTA

```
section.band.closer                    (background: --sky, centred)
└─ div.wrap
   ├─ h2 + p
   └─ button#closer-cta.btn-dark        "Pick your Plus plan"
```

Scrolls back to `#signup` rather than navigating. By the time someone has read the FAQ the signup card
is ~3000px behind them.

## 9. Footer

```
footer
└─ div.wrap
   ├─ div.foot-grid                    (grid: 2fr 1fr 1fr)
   │  ├─ div                           ← logo, tagline, Guarantee legal, socials
   │  │  ├─ img  height=30
   │  │  ├─ p.tagline                  "Pet care so good, it's guaranteed."
   │  │  ├─ p.legal                    → a → strong "The Yourgi Guarantee." + sentence
   │  │  └─ div.foot-social → a × 5     (Embed each SVG; aria-label on every link)
   │  ├─ div.foot-col → h4 + ul        "About Yourgi"
   │  └─ div.foot-col → h4 + ul        "Support"
   └─ div.foot-bottom → span × 2       copyright + policy links
```

This is inherited site furniture — it should match the live site rather than this page. The Guarantee
paragraph states the remedy ("a coupon code toward your next booking"), which is the mechanic the brand
guide says not to put in copy while the Guarantee's legal boundaries are undocumented. Flagged, not
rewritten: Legal owns it.

Three nodes on this page are deliberately still **Archivo**, not National 2, and two of them are here:
the tagline, and the bold "The Yourgi Guarantee." lead-in inside `.legal`. The third is the comparison
table's row labels. A test counts them, so removing one is a decision rather than a tidy-up.

---

## Verification checklist

Publish to staging, then check all of these. Several are things that look fine and are not.

**Behaviour**

- [ ] Clicking each plan card moves the tick, the border, the tint, and swaps the benefit bullets.
- [ ] Arrow keys / Home / End move between plan cards; Tab passes the whole group in one press.
- [ ] The comparison table renders four rows and three prices. If it is empty, the script did not run.
- [ ] Phone field formats as you type: `2815134667` → `(281) 513-4667`.
- [ ] Zip rejects non-digits and caps at 5.
- [ ] Submitting empty shows three errors and focuses the first bad field.
- [ ] An out-of-market zip (e.g. `90210`) shows "No Pros there yet" and **never reaches Stripe**.
- [ ] An in-market zip (e.g. `80202`) reaches Stripe's hosted checkout.
- [ ] Every "Back to plans" / "Start over" / "Pick a plan" button returns a usable empty form.
- [ ] `?checkout=success` shows the paid screen; `?checkout=cancel` shows the no-charge screen.
- [ ] The closing CTA scrolls to the signup card rather than navigating.

**The things that fail quietly**

- [ ] **Stripe links still carry `test_`.** Open one and confirm the sandbox pill. The moment a link
      loses that prefix this page takes real money, on an uncapped top plan.
- [ ] **Mixpanel fires each event exactly once.** Two instances double-count. Check the network tab,
      not the console.
- [ ] Mixpanel events from staging carry `test_mode:true`.
- [ ] Segment logs `[preview] Segment suppressed:` in the console and sends nothing.
- [ ] National 2 is actually loading — not the Archivo fallback. Check the network tab for the
      `.woff2` files, and confirm they are **not** the `-test-` builds (those are Klim's trial fonts
      and shipping them is a licensing problem; the filenames differ by six characters).
- [ ] The plan name and price on the paid screen are correct, and that screen promises **no** callback,
      **no** named Pro, and **no** timeframe.

**Layout**

- [ ] At 1440: Why band is wider than the FAQ band. That is correct.
- [ ] Between 820 and 1252: the polaroid and copy stay paired, the concierge card drops below them.
- [ ] At 375: table scrolls sideways with the label column pinned and the right edge faded.
- [ ] Focusing an input on a real iPhone does **not** zoom the page.
- [ ] Keyboard focus rings are visible on every control.
