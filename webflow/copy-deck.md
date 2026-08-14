# Copy deck

Every customer-facing string on the page, in document order, ready to paste into Designer.

**Read this before pasting anything.** Several strings on this page are contested, ship on an explicit
instruction, or are the corrected version of copy that was wrong. Those are flagged ⚠️ with the owner.
A well-meaning copy pass has broken this page more than once — three separate claims about who shows up
have had to be removed, and the post-payment screen carried a retired promise for a day. **If a string
below reads slightly awkwardly, that is usually the fix, not the bug.**

Typographic characters matter: the page uses curly apostrophes (`’`), em dashes (`—`) and `&nbsp;` in
the phone number. Copy them as written.

The four rules that keep tripping people up:

1. **No Yourgi Guarantee claim** anywhere on this page (the inherited footer paragraph is the sole
   exception). §8 gap 4 — coverage is undetermined and legally risky until Legal rules.
2. **No promise about who shows up.** A plan buys care, not continuity with a person. Nothing has
   established that a Pro on a plan booking has met the pet.
3. **No timeframe on the booking code.** §8 gap 6 — fulfilment is manual and nobody has committed to a
   turnaround.
4. **"pet parent" appears exactly once**, in the Why band, carried from the Figma. It is internal
   shorthand and not customer-facing anywhere else. A test enforces the count.

---

## 1. Beta ribbon

> **New & in testing** &nbsp; Yourgi Plus is a limited beta. Cancel any month, and we'll tell you before your next charge if anything changes.

"New & in testing" is `<strong>`, 11px, uppercased in CSS, yellow.

⚠️ **This is now the only beta disclosure on the page.** The "Straight up" band that also carried it was
removed to match the Figma. §8 gap 5 asks that enrolled subscribers be told honestly this is a test that
may end; one ribbon line is thinner cover than a band was. Do not delete it.

## 2. Hero

**H1** (keep the line break)

> Pet care,
> handled for you

⚠️ **Changed 12 Aug 2026, and the previous version must not come back.** It read "STOP RE-HIRING A
STRANGER EVERY WEEK." — which promised continuity with a person and was contradicted by the FAQ two
screens down. A plan does not remove the stranger; it removes the *arranging*. That is mechanically
true, so someone can hold us to it. **Positioning is still open and Kai owns it** (§7 q5) — this was a
correction, not a positioning decision. If Kai wants a stronger line, "single platform" is the value
prop that survives scrutiny: one plan spanning walking through overnight, one charge.

**Three lede paragraphs**

> Stop scrolling through endless profiles with different rates.

> Yourgi Plus is the monthly pet care subscription that comes with Concierge, a real person, who finds you a vetted Pet Care Provider when you need it for one simple, flat monthly price, for your pet.

> No hidden fees, cancel anytime.

**Eyebrow heading**

> What you get

**Four checked bullets**

> Dedicated Concierge to manage all your bookings, match you with perfect Providers for your needs, and get top notch service.

> Access to all Yourgi Pro services (boarding, house sitting, daycare, or walking).

> Hand-picked matches based on your needs, you make the final decision.

> Guaranteed coverage within 48-hours.

⚠️ **"Guaranteed coverage within 48-hours" needs Kai/Legal before launch.** It is a Guarantee-adjacent
promise with a timeframe attached, and the brand guide says not to state Guarantee mechanics while the
legal boundaries are undocumented. It is carried verbatim on instruction. Flag it; do not quietly drop
it either.

## 3. Signup card

**Heading:** Pick your routine

### Plan tiles

| | Plan 1 | Plan 2 | Plan 3 |
|---|---|---|---|
| Name | Two Anything | Five Anything | Full Coverage |
| Price | $49 | $99 | $499 |
| Suffix | /mo | /mo | /mo |
| Badge | — | Most picked | — |
| Blurb | Two services per month for one pet. | Five services per month for one pet. | Unlimited care for a month that won't sit still. |

⚠️ **The Full Coverage blurb no longer says "for one pet"** (changed 14 Aug 2026); the other two still
do. The one-pet restriction is a real term — the FAQ says using a plan across pets can cancel it
without refund — and it is still stated in the FAQ and the comparison table, so it is disclosed. But
it is now absent from the most expensive tile, whose buyer is the most likely to have two pets.
Flagged for Kai. **This string is also the Stripe product description** (`stripe/plans.json`), which
renders on the hosted checkout page — see `assets.md`.

**Prices are final** — approved by Lauren, 14 Aug 2026 — and $499 matches Schedule 1 of the T&Cs.

⚠️ **Every tier covers every service.** The ladder is by *volume*, not service type. All three cover
walks, drop-ins, house sitting, daycare and overnights. Do not reintroduce copy suggesting the entry
plan is walking-only — that was an earlier shape, superseded on 13 Aug.

⚠️ **Full Coverage is uncapped as a deliberate subsidy**, not an oversight. The exposure was sized
first (about −$1,256 from a ten-night month on one subscriber) and accepted.

### Benefit bullets — injected by JS, per plan

Two per plan. In `PLAN_BENEFITS` in `index.html`, not in Designer:

| Plan | Bullet 1 | Bullet 2 |
|---|---|---|
| Two Anything | Walks, drop-ins, house sitting, daycare, or overnights. | One charge a month, cancel any month |
| Five Anything | All services in the Two Anything, just more. | One charge a month, cancel any month |
| Full Coverage | All-you-need pet care, for one low monthly rate. | One charge a month, cancel any month |

⚠️ **These promise less than the bullets they replaced, and that is known.** The old versions stated a
countable quantity a buyer could check against a receipt; two of these state no quantity and the middle
one is relative to a plan the reader may not have read. Carried because the Figma is the source of
truth for copy. The count now lives only in the tile blurb and the comparison table.

### Callout line — injected by JS, per plan

One per plan now. In `PLAN_SAVE` in `index.html`, not in Designer:

| Plan | Line |
|---|---|
| Two Anything | The absolute best value in pet care, ever. |
| Five Anything | Our most popular Yourgi Plus subscription. |
| Full Coverage | Overflowing toy basket, unlimited pet care for the pet who has it all. |

✅ **This retired the page's only numeric claim** (14 Aug 2026). All three plans used to show *"Save
more than 50% on pet care with Yourgi Plus subscriptions!"* — unverified, and true only if a plan was
spent on overnights, with no basis stated anywhere on the page. It was launch blocker #1. **None of
the three lines above states a number**, so that blocker closes by deletion rather than by
verification. Two consequences worth carrying forward:

- The claim that replaced it is *superlative* ("the absolute best value in pet care, ever"), which is
  a brand/legal question rather than a finance one. Different owner, not no owner.
- **Nothing on the page checks arithmetic any more.** The comparison table dropped "Works out at" and
  "You save", and the per-visit line left the tiles in the same pass. If a figure ever comes back it
  should be derived through `economics()` and rendered, not typed — untyped figures are how the Figma
  ended up showing "$9.80 a walk" on a two-service plan.

⚠️ In the frame the Full Coverage line is set in **Archivo SemiBold with the single word "the" in
National 2 Bold** mid-sentence, while the other two are National 2 Bold throughout. That is an editing
artifact, not a design decision, and it is deliberately **not** reproduced — `.save` styles all three
identically. Raise it if it was intentional.

### Form

| Label | Placeholder | Error message |
|---|---|---|
| Email `*` | `name@example.com` | Enter a valid email address. |
| Phone `*` | `(555) 555-0123` | Enter a valid 10-digit US phone number. |
| Zip code `*` | `12345` | Enter a 5-digit zip. |

**Zip helper:** So we can check we have Pros walking your streets before you pay.

**Button:** Get started

**Billing fineprint** (full card width, centred)

> Yourgi Plus is billed monthly. Cancel anytime, contact the Yourgi Concierge to manage your subscription. Once you're in, our Concierge texts and/or calls to complete your profile, match you with a Yourgi Pro pet care provider, and book your needed services.

⚠️ A line naming Stripe before the jump was removed to match the Figma ("Next: Stripe takes your email
and card on their secure page. Your card never touches Yourgi."). An unexplained hop to another domain
mid-purchase is what that line existed to prevent, and naming the processor is standard on hosted
checkouts. **Worth raising with Lauren** — it may not have been a deliberate drop.

### Paid screen — `#step-confirm`

**Heading:** You're in.

**Paragraph** — type this into Designer exactly. The script *prepends* `Your [plan] plan is live at $[price]/mo.` to it.

> A receipt was emailed, your Yourgi Plus plan is live, and the Yourgi Concierge team will be in touch surprisingly fast.

**Button:** Browse providers — **this navigates**, see below.

⚠️ **This is the most dangerous string on the page and it has now been wrong twice and rewritten
three times.** Until 13 Aug it read *"Someone from our team calls within a day to lock in your days and
introduce your Pro."* — a concierge callback that contradicts Step 2 of How it works, plus the
single-assigned-Pro claim the FAQ answers "Up to you." Until 14 Aug a JS override was **still injecting
that exact sentence** for every real paying customer, because the fix landed on the static paragraph
and missed the override. Before that it rendered the word PLACEHOLDER and an internal engineering note
to people who had just paid.

⚠️ **"will be in touch surprisingly fast" is a fulfilment promise, and §8 gap 6 is open.** That gap is
exactly that fulfilment is manual — a concierge issues the booking code by hand — and **nobody has
confirmed who sends it or how fast.** It is vaguer than "within a day" and not a number, which is why
the guards accept it, but a customer who waits three days has been told something untrue by the screen
that took their money. It also reinstates concierge contact as the next step, which the 13 Aug pass
removed for contradicting Step 2. Shipped because the frame is the source of truth for copy and this is
Lauren's own edit; **flagged because ops has not agreed to it** — this belongs with ask 3 (Jeff).

Seven tests guard this screen. **No named Pro, no callback-within-a-day, no numeric timeframe**, and
the JS must *prepend* rather than replace.

### Out of market — `#step-oom`

**Heading:** Hang tight

> Yourgi Plus isn’t available in your neighborhood yet, but we'll email you when we get there. **You have not been charged.**

**Button:** Start over

⚠️ **"You have not been charged." keeps its bold and the frame does not have one.** Node 4191:1093 is a
single uniform run, so this is a deliberate deviation. The sentence is the only thing a worried person
scans this screen for, and emphasis is presentation rather than copy — so the words follow the frame
while the emphasis stays. Overrule it deliberately if you want; drop the bold, don't reword.

⚠️ **The seven-state list is gone** — the frame's fineprint block (4073:256) is hidden, and
hidden-in-the-frame means absent-from-the-page. Worth a second look, because that line was added on
14 Aug — hours before this change — on Lauren's own confirmation of the market, and it fixed a real
bug: a six-city list narrower than the gate, naming no market for Maine, New Hampshire or Washington
while all three could pay. It answered §8 gap 8. Removing it means an out-of-market visitor is told
nothing about where we *do* operate, so someone who mistypes a zip cannot tell a typo from a real gap.

For reference, the line was: *"Right now we cover Colorado, Maine, Massachusetts, New Hampshire,
Oregon, Texas, and Washington."* **The gate itself is unchanged** — `MARKET_RANGES` still encodes those
seven states, so nothing about who can buy has changed. This is a disclosure question, not a coverage
one. If it should come back, unhide it in the frame first so the two do not drift again.

### Backed out — `#step-cancel`

**Heading:** No charge made.

> You backed out before payment went through. Your plan is still here when you're ready.

**Button:** Pick a plan

## 4. How Yourgi Plus works

**Heading:** How Yourgi Plus works

Type step headings in **sentence case** — CSS uppercases them.

| | Heading | Body |
|---|---|---|
| Step 1 | Concierge intro | You’ll be introduced to a Yourgi Concierge to learn about your pet care needs and your pet’s unique traits. |
| Step 2 | Choose providers | Concierge then sends hand-selected matches of Yourgi Providers that meet your needs. You choose the Providers you’d like to meet and/or book with. |
| Step 3 | White glove booking | Concierge manages your booking directly with your chosen providers. Simply call or text your Concierge whenever you have pet care needs. |

⚠️ **Step 3's heading deliberately diverges from the Figma**, which gives steps 2 and 3 the same
heading ("Choose providers", trailing space included) while step 3's body is about Concierge handling
the booking. That is a copy-paste slip in the design, not a spec. Lauren's direction: where the repo is
right, the repo wins and Figma follows. Do not "restore" it.

## 5. Comparison table

**Heading:** Which plan is right for your pet?

**Intro:** Whether your pet needs coverage just twice a month, or if you have higher frequency needs, we have a plan for you.

**Caption** (screen readers only): The three Yourgi Plus plans compared. Five Anything is the most picked.

**Column headers:** Two Anything · Five Anything (Most picked) · Full Coverage — prices injected by JS.

**Rows** — all four injected by JS from `renderCompare()`:

| Row label | Two Anything | Five Anything | Full Coverage |
|---|---|---|---|
| What it covers - Walks, house sitting, daycare, or boarding. | 2 services per month for one pet. | 5 services per month for one pet. | Unlimited services per month for one pet. |
| Unused days | Expire monthly | Expire monthly | Expire monthly |
| Dedicated Concierge Team | ✓ | ✓ | ✓ |
| Add-On’s | Booked separately | Booked separately | 1 per month included |

The row label's odd "What it covers - Walks, house sitting…" phrasing is the Figma's. Three rows the
Figma hides are gone with it — "Days or nights a month", "Works out at", and "You save vs. one at a
time". Those were the computed cells, so **the table no longer carries any savings argument** and can no
longer check the 50% claim in the card. Nothing else on the page checks it either.

"Unused days: Expire monthly" applies to all three including the uncapped plan, per the Figma. This is
the harshest term in the offer and it is stated here on purpose, where people choose — it used to be in
the FAQ only, which meant most people met it after paying.

## 6. Why Yourgi Plus

**Heading:** Why Yourgi Plus?

> Most pet parents have a system that works until it does not. The neighbor moves, the regular sitter books up, the trip comes together on Wednesday. Then you are scrambling. Yourgi Plus exists so there is always someone to call. You get a Concierge who knows your pet and your standards, sorts out who is available, and comes back with a confirmed booking. Not a directory to search. A person who handles it.

**This is the one permitted "pet parents".** A test asserts exactly one instance and that it is this
sentence.

### Concierge card

**Heading** (keep the line break)

> Expert help,
> when you need it

> 8am-8pm access to the Yourgi Concierge, who can help match you with your ideal provider. Real humans connecting you with the perfect Yourgi Pro or to a booking at one of our 160+ centers.

**Caption:** Kai F. / Yourgi Concierge / Text or Call [(281)&nbsp;513-4667](tel:+12815134667)

⚠️ **This card is lifted from a live Yourgi page** (`/benefits/nike`), so the copy is already published
— but **two lines change meaning on this page** and need sign-off:

- **"8am-8pm access to the Yourgi Concierge"** reads as a plan entitlement here. This page deliberately
  makes no promise the match team has to keep, and a staffed-hours promise on a page taking money is one.
- **A named staff member and a direct number** is fine on a benefits page aimed at one employer. On a
  page taking recurring money from the public, whoever answers that number should agree first.

"160+ centers" is a Destination Pet network fact and carries over unchanged. Kai owns final copy (§7 q5).

## 7. FAQ

Questions are **sentence case** — `.faq-item h3` sets `text-transform:none`, unlike the step headings.

**Heading:** FAQ’s

**Nine items now** — one was restored on 14 Aug 2026. Order matters; it is the frame's.

**How many pets are covered by the plans?**
> Each plan covers Services for one pet. If you wish to cover an additional or different pet, you must enroll the pet in a separate plan. If Yourgi determines there has been a violation, it may immediately cancel the plan without refund or credit.

Rewritten 14 Aug. The old answer stated only the penalty; this one leads with the remedy — enrol the
second pet in its own plan — and puts cancellation after it as the consequence of a violation Yourgi
determines. Better for the reader and better for us: the old wording told a two-pet household the
product forbids them, this one tells them what to buy. **"Services" is capitalised** because it is a
defined term in the T&Cs; keep it.

**What if I need an extra walk one week?**
> Book it the normal way and pay for that one walk. Your plan isn't a cap on how much care you can get &mdash; it's the part that repeats.

**What happens to services I don’t use?**
> Your limits reset every month. All bookings must be made and used within the month your plan is active. Services do not accrue or rollover.

✅ **The rollover question is back** (14 Aug 2026, node 4191:1095), third in the list. It was removed on
13 Aug for one reason only — the frame had dropped it — and it returns on the same rule. **This is the
harshest term in the offer**, and it now sits where people go looking for it rather than only in the
comparison table's "Unused days" row. It agrees with that row rather than contradicting it, and four
tests pin both.

Note: the frame's layer name for this node is still "What if I need an extra walk one week?", a
copy-paste artifact. **Trust the text, not the layer name** — that exact drift once hid a missing FAQ
answer in this file.

**Can I cancel?**
> Yes, any month, and you never have to phone anyone. Ask your Yourgi Concierge and they'll cancel it for you. Your plan runs through the month you've already paid for &mdash; that month isn't refunded &mdash; and you won't be charged again.

⚠️ Rewritten, not just repunctuated. The Figma told people to cancel "from the link on your receipt";
Legal's Annex A row 11 says Stripe receipts carry **no portal link by default**. This routes to the
Concierge, which works today.

**Can I get a refund?**
> Monthly fees aren’t refundable, and we don’t refund part-months or days you didn’t use. There are exceptions: if we can’t cover your area, if we end the beta early, or if we cancel your plan for a reason that isn’t your fault, you get that month back. Anything else, ask your Concierge and we’ll look at it.

⚠️ **Restored from the T&Cs, not from intent, and this wording is load-bearing.** It tracks Terms §12:
12.1 is the rule, the three exceptions are 12.2(b), (c) and (e), and the last line keeps 12.4's
discretion without promising an outcome. An earlier version promised a refund whenever someone hadn't
used the plan — drafted before the T&Cs existed and unsupported by §12.1. **Do not soften it back
toward that without Legal.** This is the sentence a customer will quote at us.

If it ever needs improving, the route is the **copy, not the layout** — break the three exceptions into
a list so they scan. Do not narrow the column; see the FAQ note in `build-spec.md`.

**Can I change plans?**
> Any time, and either way &mdash; do it yourself from your billing page, or ask your Concierge to do it for you. Changes take effect straight away: move up and you pay the difference for the rest of the month, move down and the difference comes off your next bill.

⚠️ **This describes what Stripe is actually configured to do.** The portal is set to
`create_prorations`, so changes land immediately and prorate. If anyone changes `proration_behavior`,
this sentence becomes wrong. Two dependencies, neither of them copy: "your billing page" needs a
permanent URL that mints a portal session (Stripe receipts carry no portal link), and self-serve
upgrades bypass any completed-sessions cap on a Payment Link.

**Do I get the same Pro every time?**
> Up to you. You can choose the same Provider every time or try someone new. Your Yourgi Concierge helps every step of the way.

The question stays in the customer's own words. What must never appear is the page *asserting* a single
assigned Pro.

**What if I need an extra service?**
> Your Yourgi Concierge will either help you make the most cost-effective decision, or just help you book a single additional service.

**What qualifies as a service provider?**
> Only services booked with a Yourgi Pro can be used for Yourgi Plus subscriptions, Destination Pet-owned pet resorts and vet clinics are not included in Yourgi Plus plans.

Four typos in the Figma are fixed here: a missing full stop after "Yourgi Concierge", "everytime" →
"every time", "incure" → "incur", "cost effective" → "cost-effective". All four are still open in the
Figma. Verbatim-from-the-Figma is right for wording, not for spelling on a page that takes money.

**The rollover question is back** — see it in position 3 above. This note used to say it was gone.

## 8. Closing CTA

**Heading:** Let Yourgi handle your pet care

> Pick a Yourgi Plus plan, meet your Yourgi Concierge, and never scramble for pet care again.

**Button:** Pick your Plus plan

## 9. Footer

Inherited site furniture — match the live site, not this page.

**Tagline:** Pet care so good, it's guaranteed.

**Guarantee paragraph** ("The Yourgi Guarantee." is a bold link to `/book/best-care-guarantee`)

> **The Yourgi Guarantee.** Book with a Yourgi Pro and you're getting pet care we stand behind. If your service doesn't meet or exceed your expectations, let us know and we'll apply a coupon code toward your next booking. That's our promise.

⚠️ **The only Guarantee language permitted on this page**, and only because it is unchanged site-wide
text that describes booking with a Pro and makes **no claim about plan coverage**. Keep it that way
until §8 gap 4 closes. Separately: it states the remedy, which is the mechanic the brand guide says not
to put in copy while the Guarantee's boundaries are undocumented. Flagged, not rewritten — Legal owns it.

**About Yourgi:** Our Story · Careers · Rewards Program · Become a Yourgi Pro

**Support:** Yourgi Customer Support: +1 (888) 887-3875 · Help Center · Contact Us · Book a Service

**Bottom:** ©2026 Yourgi, Inc. All rights reserved · Privacy Policy · Terms of Service

---

## Still open before launch

From `docs/open-asks.md`. Every one of these touches copy above.

| # | What | Who |
|---|---|---|
| 1 | ~~The "save more than 50%" claim~~ — **closed 14 Aug**, the claim is gone. The boarding rate ($195/night, inferred and never stated) still matters for the comparison table and subsidy sizing, but no longer for page copy. | David |
| 2 | The Guarantee, auto-renewal, and the refund copy | Kai / Legal |
| 3 | The notification channel, and what we may claim about Pros — **now also covers "in touch surprisingly fast"** on the paid screen | Jeff |
| 4 | Power Automate licence + a Stripe key an admin creates | IT / Stripe admin |

Also unresolved and copy-adjacent:

- **"Guaranteed coverage within 48-hours"** — hero bullet, Guarantee-adjacent with a timeframe
- **8am-8pm** and the **named concierge with a direct number** — Why card
- Whether dropping the **Stripe mention before the jump** was deliberate
- **NEW 14 Aug:** **"in touch surprisingly fast"** on the paid screen, against open §8 gap 6
- **NEW 14 Aug:** the **seven-state list** disappearing from the out-of-market screen
- **NEW 14 Aug:** **"for one pet"** dropped from the Full Coverage tile and its Stripe description
- **NEW 14 Aug:** *"The absolute best value in pet care, ever."* — a superlative that replaced a
  numeric claim, so it needs brand/legal eyes rather than finance's
