# Subscription Landing Page — "Yourgi Pack"

A standalone landing page testing one question: **will people pay a recurring monthly fee for pet care?**
Visitor picks one of three walking plans, gives us enough to reach them, and **completes a real purchase
through Stripe**. Everything after checkout is manual — concierge issues coupons and sets the schedule up
by hand.

Seeded from the [Concierge Landing Page](../Concierge%20Landing%20Page) repo on 2026-08-10 — same brand
shell, footer, analytics wiring, zip gate, and form validation. Different offer, and a **real payment flow
instead of a manual concierge follow-up**.

**No site nav** — just the logo. This page is a test that stands on its own (§6: decoupled from the app, no
authentication), so nav links would only leak people out of the one page whose whole job is measuring
whether they sign up. The logo links to yourgi.com so someone about to enter a card can confirm who they're
paying.

**New here? → Read [`docs/handoff.md`](docs/handoff.md) first.**

## Files

- `index.html` — the page (canonical). Double-click to open, or serve it (see below).
- `preview.html` — **review harness.** Frames the page with a mobile / tablet / desktop toggle and
  shortcuts to the post-Stripe screens. Send reviewers here. **Never goes into Webflow**, and a test
  keeps it out of `deploy/` and out of `index.html`.
- `deploy/index.html` — identical copy of `index.html`, ready to drop into a static host. A test asserts they match.
- `test/prototype.test.mjs` — 137 headless checks. See "Testing".
- `docs/handoff.md` — start-here onboarding, open decisions, and the Stripe wiring steps.
- `docs/project-context.md` — **the authoritative source.** Synthesized from the 10 Aug 2026 team
  discussion. Where this doc and the page disagree, this doc wins and the page is wrong.

## What the page offers

Three plans, walking-led, every one of them capped. Prices sit inside the $100–$200 band the team floated
(§7 q1 called $50/month too low). **The numbers are structurally sound but not approved** — David owns
pricing.

| Plan | Price | Included |
|---|---|---|
| Once a Week | $99/mo | 5 walks a month |
| Twice a Week (default) | $149/mo | 9 walks a month |
| Weekdays | $199/mo | 14 walks + 2 daycare days |

Four structural choices, each traceable to the PRD:

- **Capped, never unlimited.** The cap *is* the subsidy guardrail §6 asks for. An unlimited plan at these
  prices is exactly the exposure the team flagged — someone booking $200/night house-sitting on a flat fee.
- **Walking is the spine; daycare only at the top.** §7 q3's lean. Boarding and house-sitting are out, and
  the FAQ says so in plain words rather than staying quiet about it.
- **No Yourgi Guarantee claim anywhere on the page.** §8 gap 4 says coverage is undetermined and legally
  risky. The concierge page's Guarantee band was replaced with an honest beta band. With the nav gone, the
  only Guarantee text a visitor sees is the unchanged site-wide footer, which claims nothing about plans.
- **Beta framing up top, before anyone pays.** §8 gap 5 wants an off-ramp and honest comms for enrolled
  subscribers. Saying "this is a test and we'll warn you before your next charge" costs nothing now and a
  lot later.

§7 q4 (should the form collect service interest?) is answered with the lightest useful option: one optional
free-text "which days do you need?" box. §4 says a person follows up to set each subscriber's services up by
hand — that box is the single thing they need before dialling.

## What the market actually does — and what we borrowed

Checked against the operators who sell subscriptions well. **The headline finding is that neither big pet-care
player sells what Yourgi Pack sells:**

| Who | What they actually sell | Read-across |
|---|---|---|
| [Wag! Premium](https://wagwalking.com/wag-premium) | **$9.99/mo discount membership** — 5% off bookings, waived booking fees, vet chat, priority matching | A loyalty layer, not a services bundle. Cheap, near-zero subsidy exposure, and it never has to answer "what happens to unused walks?" |
| [Rover](https://www.rover.com/dog-walking/) | **No subscription at all** — "Repeat Weekly" recurring bookings with auto-billing at normal rates | The recurring-revenue outcome without prepayment. Some walkers discount recurring bookings themselves. |
| [ClassPass](https://help.classpass.com/hc/en-us/articles/209367426-Do-my-credits-roll-over) | Monthly credits for third-party services, **rollover capped at one cycle's worth** | The closest structural analog to Yourgi Pack, and the source of our proposed rollover answer. |

Nobody in pet care is selling a prepaid, capped bundle at $99–$199. That's either the opportunity or the
warning — worth putting in front of David and Scott either way, because **there is a materially cheaper
experiment available**: a Wag-style ~$10–20/mo discount membership tests willingness to pay for a
relationship with roughly none of the subsidy exposure in §6. It answers a slightly different question, but
it answers it for a fraction of the risk.

**Applied to the page:**

- **Per-unit price on every card** ("$16.56 a walk"). Standard wherever usage is capped — ClassPass,
  HelloFresh, Blue Apron all do it, because "$149/mo" alone makes the buyer do the division.
- **Savings vs. booking one at a time**, in dollars and percent. Concrete dollar amounts beat bare
  percentages.
- **Side-by-side comparison table** so all three plans are visible at once. In the signup card you can only
  see the plan you've clicked, which is the wrong way round for choosing.
- **Closing CTA** after the FAQ. By then the signup card is thousands of pixels behind you.
- **Stripe named before the handoff** — an unexplained jump to another domain mid-purchase reads as a
  redirect gone wrong.
- **Phone is now optional.** Every required field before payment costs signups. Turn on phone collection in
  the Stripe Payment Link so concierge still gets a number for anyone who actually pays.
- **A proposed rollover answer**, borrowed from ClassPass: unused walks roll forward, capped at one month's
  worth. Kills the "I'll waste it" objection without creating an unbounded liability. Still needs sign-off.

**Deliberately not applied:**

- **No free trial or intro discount.** Standard in subscription growth, wrong here — this experiment measures
  *willingness to pay*, and a free first month measures willingness to try something free. It would corrupt
  the one number the test exists to produce.
- **No annual prepay.** Normally the best margin lever available, but §8 gap 5 says this beta may be wound
  down. Taking a year's money for a plan that might not last a quarter is a refund problem, not a growth one.
- **No scarcity messaging** ("only N spots"). There *is* a real ceiling — §8 gap 6's unscoped concierge
  capacity — but nobody has produced the number, and inventing one would be a fake claim.

### ⚠️ The savings row exposed a pricing problem

Making the discount visible doubles as a subsidy check, and the Weekdays plan does not survive it. At the
placeholder rates, it bundles **$440 of services for $199 — a 55% giveaway, about $241/month of subsidy per
subscriber**, before Yourgi has paid the Pro anything less than full rate. Once a Week gives away 21%, which
reads like a normal bulk discount. §5 says the experiment may run underwater deliberately, so this may be
fine — but it should be a decision someone makes, not an accident of three round numbers. The rates driving
it live in `LIST_RATES` in `index.html` and need David's real figures.

## Status

**MVP, not production.** It runs in **dry-run mode** out of the box: no Stripe links are configured, so
"Continue to payment" captures the lead and shows the confirmation screen without charging anyone. Nothing
here has been priced, brand-reviewed, or legally approved.

## Blocking decisions — nothing ships until these land

Full detail in `docs/project-context.md` §7 (Open Questions) and §8 (Gaps). Condensed:

| # | Decision | Owner |
|---|----------|-------|
| 1 | **The actual prices and caps.** The page proposes a structure; David owns the numbers. | Facilitator / David |
| 2 | **Rollover** — what happens to unused walks. Still an open FAQ placeholder, and the single question most likely to decide whether anyone signs up. | Facilitator / David |
| 3 | **Guarantee coverage** for subscription bookings. Until this lands, no Guarantee claim goes on the page. | Kai / Legal |
| 4 | **Wind-down terms** — the beta band promises notice before the next charge. Confirm we can hold that. | Legal / Kai |
| 5 | **Geography** — the zip gate is inherited, not decided. See below. | Undecided |
| 6 | **Stripe access provisioning** for Lauren to wire up the plans. | Facilitator |
| 7 | **Concierge capacity** — the page promises a callback within one business day. Confirm the team can. | Concierge lead |
| 8 | **Success metric** — no target, baseline, or kill threshold defined. | Facilitator / Scott |
| 9 | **Notification channel** — a new dedicated Teams channel, never the concierge order-form channel. | Jeff |
| 10 | Page slug, National 2 font + official logo lockup, dog-walking reviews to replace the boarding/cat ones. | Webflow / brand |

### One deliberate disagreement with the PRD

**The zip market gate is kept**, even though §8 gap 8 says geography is undefined and the gate is therefore
an assumption. The reasoning: this page takes **real recurring money**, and a plan is a promise to show up
every week. Selling one where no Pro can walk the dog turns a cheap experiment into refunds and an angry
customer. Out-of-market visitors are never sent to Stripe — the lead is captured and an honest "no Pros
there yet" screen shows instead. If the real launch geography differs, change `MARKET_RANGES` in
`index.html`; don't delete the gate.

## Running it

Open `index.html` directly, or serve it to exercise the JS:

```bash
python3 -m http.server 8137
```

To see the post-Stripe screens without a real payment, append `?checkout=success` or `?checkout=cancel`.

**Sharing it with reviewers:** send them `preview.html`, not `index.html`. It renders the page at real
mobile (390×844), tablet (768×1024), and desktop (1280×800) viewport widths — actual widths, so the page's
own breakpoints fire exactly as they would on a device — and has one-click access to the paid and
backed-out screens. Switching device does **not** reload the frame, so anything typed into the form
survives the switch.

## Testing

```bash
npm install jsdom && node test/prototype.test.mjs
```

Covers plan switching, validation, phone/zip masking, the market gate, the optional schedule field, dry-run
behavior, per-plan Stripe URL routing, out-of-market handling, webhook payload and failure, both
return-from-Stripe states, and deploy/canonical sync.

It also carries a **PRD reconciliation guard** block that fails if the page drifts back toward the pre-PRD
scaffold — a price outside the band, an "unlimited" plan, a boarding promise, a Guarantee claim, a rollover
promise the FAQ contradicts, or "pet parent" in customer-facing copy. If one of those fails, re-read the PRD
before "fixing" the test.

The suite stubs Mixpanel, Segment, and `fetch`, so **it never fires a real side effect** — keep it that way.

---
_Related: [Concierge Landing Page](../Concierge%20Landing%20Page) — the flat-rate test this page was seeded from._
