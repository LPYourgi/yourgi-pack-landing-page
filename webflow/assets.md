# Assets

**Everything this page loads is already on Yourgi's own Webflow CDN**, except one Google Fonts
stylesheet. Nothing needs uploading or migrating — this is the easiest part of the transfer.

All CDN paths share the site prefix `https://cdn.prod.website-files.com/6818d81fbac209b16f28ed8b/`,
which is this Webflow site's own asset bucket. Assets are shortened to their filename below.

## Fonts

### Check `Site settings > Fonts` before pasting the head block

The three National 2 files are served from **this site's own CDN with `access-control-allow-origin: *`**
— they are the files yourgi.com itself renders in. That strongly suggests National 2 is already
uploaded as a custom font on the site. **Check first.**

- **If it is already there:** delete the `@font-face` block from the generated head code and apply
  National 2 / National 2 Condensed from Designer's font dropdown. Cleaner, and it avoids the site
  serving two registrations of the same face.
- **If it is not:** keep the `@font-face` rules. They work as-is.

| Family | Weight | File |
|---|---|---|
| National 2 | 400 | `6a024053c1c43baa696b2a66_national-2-regular.woff2` |
| National 2 | 700 | `6a024053785d31ff7121b4f0_national-2-bold.woff2` |
| National 2 Condensed | 800 | `6a024053ea34740801505a2d_national-2-condensed-extrabold.woff2` |

⚠️ **These must not be swapped for the `-test-` builds** that sit alongside them in the same CSS.
Those are Klim Type Foundry's **trial** fonts and shipping them in production is a licensing problem.
The filenames differ by six characters. A test asserts the licensed builds are the ones referenced;
if you re-point a font URL, re-read that test before assuming your URL is fine.

### How the faces are used

`h1`, `h2` and `.display` are **National 2 Condensed ExtraBold**. `h3` is **National 2 Bold, not
condensed**. Body is National 2 Regular. That split is the Figma frame's own, not a simplification —
every section `h2` is condensed while the step headings and FAQ questions are the plain Bold.

### Archivo — still needed, two reasons

```
https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap
```

It is the **fallback in every National 2 stack**, so a CDN failure degrades to a near-match rather
than a system serif. And **three nodes on the page are deliberately still set in Archivo** because the
frame sets them that way:

1. The comparison table's row labels
2. The footer tagline
3. The bold "The Yourgi Guarantee." lead-in inside the footer legal paragraph

A test counts those three, so removing one is a decision rather than a tidy-up. Keep the stylesheet
link.

**Oswald is gone** (13 Aug 2026). It stood in for National 2 across the page before the licensed files
were available. Nothing sets it, a test asserts nothing does, and it must not come back.

## Images

| Asset | Where | Notes |
|---|---|---|
| `69bec48af6f4afa25791b287_Asset%202.svg` | nav logo | `height=30`. Has an `onerror` wordmark fallback that Webflow will strip. |
| `69cb1440ca3bb655fe31395c_Yourgi-white-logo.png` | footer logo | `height=30`, same fallback caveat |
| `6a6c20af693690449c2f28d0_yourgi-guarantee-pro-image.png` | Why band polaroid | A Yourgi Pro walking a dog. Rotated **−7deg in CSS.** |
| `6a6acadff9b3e51fada06e1f_kai.jpg` | concierge card | 510×400 source, placed at 160×125. Rotated **+13deg in CSS.** |

**Both photos are straight files.** The tilts are CSS transforms — do not go looking for pre-rotated
versions, and do not bake the rotation into the asset.

⚠️ **`kai.jpg` is not reachable from yourgi.com's navigation.** It lives on `/benefits/nike`. Crawling
the site for it finds nothing. If that URL ever dies, that page is where to look rather than the asset
library.

The `width`/`height` attributes on the `why-pro` image are there for layout stability (CLS). The CSS
sets `height:auto` on it, which is load-bearing under the page's global `border-box` — without it the
height attribute wins and clips 8px off the box.

## Inline SVG

Not files — written into the markup. In Webflow each needs an **Embed**, or you replace it with a
Webflow icon.

| SVG | Count | Note |
|---|---|---|
| Green check | 4 in the hero list, plus 1 per benefit bullet injected by JS | `#53A14E`, 15px, `aria-hidden="true"` |
| Circled tick | 1 per plan tile (3) | inside `span.tier-check`, hidden until selected |
| Table check | injected by JS per cell | **`#2F6B2B`** — darker than the card's |
| Social icons | 5 in the footer | Facebook, Instagram, TikTok, YouTube, LinkedIn |

**The two green checks are different colours on purpose.** `#53A14E` measures 2.62:1 on white, under
the 3:1 a meaningful graphic needs, so the table's version was darkened to `#2F6B2B`. Every yes/no
cell in the table also carries a visually-hidden text equivalent, because a bare tick announces as
"check mark" and a bare em dash announces as nothing. Do not unify these two greens.

Every footer social link needs its `aria-label` — the SVG carries no text.

## Stripe Payment Links

Not assets, but they travel with the page and they are the thing most likely to cause real harm.

All three are **test mode** — note the `test_` prefix on each:

```
weekly    buy.stripe.com/test_14A4gz1mpcQuaWOc4e2sM0f    Two Anything   $49/mo
twice     buy.stripe.com/test_cNi4gz8OR8Ae0iagku2sM0g    Five Anything  $99/mo
weekdays  buy.stripe.com/test_9B6eVd7KN17M3umgku2sM0i    Full Coverage  $499/mo
```

⚠️ **The `test_` prefix is what guards the money on this page, not the price approval.** The moment a
link loses it, this page takes real payments — including on an uncapped top plan whose subsidy exposure
(about −$1,256 from a ten-night month on one subscriber) was sized and accepted *on the understanding
that nobody could actually buy it yet*. A live link is `buy.stripe.com/<id>`; a test link carries the
prefix. A test asserts all three still have it.

Two more things that are easy to get wrong:

- **A price change is a replacement, not an edit.** Stripe Prices are immutable, so a new price means a
  new Price, a new Payment Link, and a new URL. Anything still holding the old URL keeps billing the
  old amount. The $499 tier already went through this once, from $399.
- **Never one shared link across plans.** There was a period when all three tiles pointed at one
  $50/mo link for a product called "Yourgi Membership" — within a dollar of the entry plan, so a
  mistaken charge would have looked almost right on a receipt.

When these are swapped for live links, they are edited in **`index.html`**, and `node webflow/build.mjs`
regenerates the footer block. Do not paste a link straight into Webflow — the repo stops being the
source of truth the moment you do, and `node stripe/verify-links.mjs` can no longer check the page
against Stripe itself.
