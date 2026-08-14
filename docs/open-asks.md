# Open asks — the four things blocking launch that aren't ours to decide

**Created:** 14 August 2026 · **Owner:** Lauren Palma (lauren.palma@destpet.com)

Four people hold the decisions this page can't ship without. Each section below is self-contained —
paste it as-is into Teams or email, no editing needed. **Record the answer in this file when it comes
back**, then update `README.md`'s blocking-decisions table and `docs/project-context.md`.

These are separated out because they have the longest latency on the project: everything else on the
build is either done or in our own hands. Send all four before doing anything else.

Status legend: ⬜ not sent · 📨 sent, waiting · ✅ answered (record it here)

| # | Ask | Who | Status |
|---|---|---|---|
| 1 | The boarding rate, and the "save more than 50%" claim | David | ⬜ (narrowed — see Answers) |
| 2 | The Guarantee, auto-renewal, and the refund copy | Kai / Legal | ⬜ (reviewed 14 Aug, sent intact) |
| 3 | Notification channel, and what we may claim about Pros | Jeff | ⬜ |
| 4 | Power Automate licence + a Stripe key an admin creates | IT / Stripe admin | ⬜ (narrowed — see §4) |

---

## 1 → David: the boarding rate, and the "save more than 50%" claim

> **Narrowed 14 Aug 2026.** This ask originally carried four decisions. Lauren answered two of them
> that day — the prices are final, and the top plan stays uncapped on purpose — so only the two below
> still need David. Don't send him the price question; it's settled. Both answers are in Answers.

Two decisions, and the second depends on the first.

**a. The pay-as-you-go rates.** The page computes against $30 a walk, $55 a daycare day and $195 a
boarding night. Walk and daycare are cross-checked two ways each against your grid and agree exactly.
**Boarding at $195 is a residual** — what's left of the Baseline unlimited column once walks and
daycare come out — so it's inferred from your model, not stated in it. **Is $195 right?** Every
savings figure the page shows rests on it.

**b. "Save more than 50%."** That sentence ships on all three plan cards with no stated basis. At the
rates above the plans save about **18%** (Two Anything) and **34%** (Five Anything) when spent on
walks. It only clears 50% if a plan is spent on overnights — and it currently shows on the entry
plan, which is the one least likely to be spent that way. Three options: state the basis in
fineprint, drop the figure, or replace it with one that's true on walks. **Which?**

For context on why this isn't urgent-but-cosmetic: it's the only unverified pricing claim left on a
page that now has approved prices, so it's the last thing standing between the copy and a clean
legal read.

---

## 2 → Kai / Legal: the Guarantee, auto-renewal, and the refund copy

> **Reviewed 14 Aug 2026 by Lauren and left intact — all five parts go to Legal.** Worth recording
> because three of them were page-copy calls she could have made unilaterally and didn't: the hero's
> 48-hour line, the footer Guarantee paragraph, and the two FAQ commitments. Each stays on the page
> exactly as written until Legal rules. **Nothing here is an oversight — don't "fix" any of it.**

This page takes real recurring money, which changes what can be a placeholder. Five things.

**a. Does the Yourgi Guarantee cover subscription bookings?** Undetermined, and it's the blocker.
Until it's answered there's no Guarantee band on the page — and note the band that used to hold it
was removed, so restoring one is a rebuild, not an edit.

**b. The sharpest instance.** The hero carries **"Guaranteed coverage within 48-hours."** That's a
Guarantee-adjacent promise *with a timeframe attached*, which is exactly the mechanic the brand guide
says not to state while the Guarantee's legal boundaries are undocumented. It's on the page on
purpose, from the Figma. **Keep it, reword it, or cut it?**

**c. The footer.** It carries the full inherited Guarantee paragraph — "Book with a Yourgi Pro and
you're getting pet care we stand behind… we'll apply a coupon code toward your next booking."
**Does that stand unchanged on a page selling a subscription?**

**d. Auto-renewal.** Plans renew automatically and indefinitely, services expire monthly with nothing
rolling over, and **nothing in the system counts what anyone has used** — so we can't answer "how many
do I have left?" US auto-renewal rules carry disclosure and sometimes reminder requirements. Not a
reason to change the model; a reason for you to look before launch.

**e. The refund and forfeiture copy.** Two FAQ answers need a read. The refund answer commits us to
giving a month back **"if we end the beta early"** — which ties to the beta ribbon's promise that
we'll tell people before the next charge if anything changes. And the multi-pet answer says using a
plan for more than one pet **"will cause cancellation of plan without refund."** Is that forfeiture
defensible as written? Stripe refunds nothing automatically, so every refund is a manual decision
either way.

---

## 3 → Jeff: the notification channel, and what we may say about Pros

**a. A dedicated Teams channel for signups.** When someone subscribes, Stripe fires a webhook at a
Power Automate flow that posts a card into Teams. That card is the only notification anyone should act
on, because it's the only one that means money actually moved. **It must not be the concierge team's
existing order-form channel** — that channel carries unpaid leads and mixing the two makes it
impossible to tell a paid subscriber from an enquiry. Need a new channel and who should be in it. The
flow can be built and tested against a private channel first, so this isn't blocking the build — only
the go-live.

**b. What the page is allowed to claim about who turns up.** Right now: nothing. Every continuity
claim was stripped in August — no "same Pro every week", no named backup, no "Pros who already know
your pet" — because none of them were supported, and there's now a test that blocks them coming back.
That's the safe position, but it's a thin one for a page asking for a recurring commitment. **What
*can* we say?** Specifically: how are Pros matched to subscription bookings, do they know a booking is
subscription-driven, are they paid differently, and does a subscriber get any continuity at all in
practice? Whatever's true and repeatable, we can use.

---

## 4 → IT / Stripe admin: two access blocks

Two separate blocks, possibly two different people.

**a. A Power Automate Premium licence for Lauren.** The flow that turns a Stripe payment into a Teams
card is built but cannot run. Flow checker says: *"This flow's owner needs a Power Automate Premium
license."* It needs the premium HTTP action to call the Stripe API back and verify the event is real
before staff act on it. **Without it the design has to drop event verification**, which means a Teams
card could be posted by anyone who finds the flow URL.

> **Route chosen 14 Aug 2026: request the licence, not the trial.** Flow checker offers a free 90-day
> trial that would unblock this today with nobody else involved. Deliberately not taken — it expires,
> and when it does the flow stops posting to Teams **silently**. Signups would keep arriving with no
> card in the channel, and the failure looks identical to nobody signing up, which is the one number
> this experiment exists to measure. The trial remains a fallback if the licence stalls; if it's ever
> taken, put the expiry date at the top of `docs/stripe-webhook.md`.

**b. A Stripe restricted key, created by an admin.** Lauren has Stripe access, but it's limited —
Stripe returns *"you don't have permission to create an API key for this merchant."* So **the
restricted key the webhook's verification step needs can't be created at all.**

**The ask is for an admin to create the key, not for a role change.** In Stripe: **Developers → API
keys → Create restricted key**, granting **read on Events and nothing else**. That is the whole
permission — the flow's only call is `GET /v1/events/{id}`, to re-fetch an event by ID and confirm
it's genuine. It cannot move money, read a customer, or change anything. Send it to Lauren over
something private; it goes straight into the Power Automate connection.

**It must be a key on the real account, not a sandbox one.** A claimable sandbox key can't read
`/v1/events` at all, so the verify step fails outright rather than degrading.

**It must never be committed.** This repo's page source is public and a test asserts no `sk_…` key
appears in it. The key belongs in Power Automate's connection config and nowhere else.

*Separately, and lower priority:* the same permission gap is why the page's three Payment Links live
in an auto-generated sandbox rather than Yourgi's live account. That needs Developer or Administrator
on Yourgi Pro to resolve, and it only matters when this goes to live mode — which is gated on
everything else here anyway. Not part of this ask.

---

## Answers

Record them here as they land — date, who, and what was decided. Anything that changes the page also
needs the copy changed and the test suite re-run.

### 14 Aug 2026 — Lauren — prices are final

**$49 / $99 / $499 are approved.** Not David's to sign off after all; Lauren took it. The page already
carried these numbers, so no copy changed — what changed is that seven files had stopped being true,
having said in various words that the prices were unapproved and that David owned them.

Updated: `README.md` (the offer intro, the status paragraph, blocking decision #1), `index.html` (the
head comment, and the note above `STRIPE_PAYMENT_LINKS`), `docs/handoff.md` (the decisions table, the
status section, the build outline), `stripe/plans.json` (the `_readme` and the `status` metadata),
`stripe/create-plans.mjs` (the header comment and the CLI output).

One test changed with them. `test/prototype.test.mjs` asserted the manifest was *"flagged as
unapproved pricing"*, matching `/prices not approved/i` — which would now fail on a fact that is no
longer true. The reason behind that test outlives the string: these are still sandbox objects, and
approved pricing doesn't make them production ones. So it now asserts the status still says `DRAFT`.

**What did NOT change: the `test_` prefix guard.** Approval is not what stops this page taking real
money — the test-mode links are. Several of the files above had quietly fused the two ideas, warning
that losing the prefix would mean "taking payments at prices nobody approved." That reasoning would
have evaporated the moment prices were approved, and the guard is just as necessary now. Each of
those warnings was rewritten to stand on the uncapped plan instead.

### 14 Aug 2026 — Lauren — Full Coverage stays uncapped, deliberately

**Accepted as a chosen subsidy, not an inherited gap.** §5 permits running the experiment underwater,
and the point of the ask was to make it a decision rather than an oversight — so the exposure was
sized *first* and then accepted: roughly **−$1,256 from a ten-night month on a single subscriber**,
against a model whose Downside case never tested it (it stresses walk volume and sets boarding to
zero).

No page copy changed — the plan is already sold as unlimited. `docs/handoff.md` carried this as
*"Highest open risk here"*, which was the strongest open-risk flag in the file; it now records the
decision, the date, and the number, and notes it remains the largest financial exposure on the page —
now a chosen one. The same reasoning replaced the stale live-mode warning in `stripe/create-plans.mjs`.

**Worth revisiting if anything changes on the Pro payout side**, since the whole exposure is that Pros
are paid full rate on a plan that collects a flat $499.

### 14 Aug 2026 — Lauren — asks 2 and 3 go out unchanged, ask 4 narrowed

**Ask 2 (Legal): all five parts stand.** Three of them were page-copy calls Lauren could have made
without Legal — the hero's 48-hour line, the footer Guarantee paragraph, the two FAQ commitments — and
she declined to pre-empt the ruling on any. Recorded at the top of §2 so nobody later reads them as
oversights and tidies them up.

**Ask 3 (Jeff): both halves stand**, the channel request and the what-may-we-claim-about-Pros
question.

**Ask 4 (IT / Stripe): both halves narrowed to one route each.**

- **Licence, not the 90-day trial.** Reasoning in §4 and now also in `stripe-webhook.md`, which had
  recommended the opposite. The trial's failure mode is silent: when it lapses the flow stops posting
  and the channel just goes quiet, which is indistinguishable from nobody signing up.
- **An admin-issued key, not a role change.** Also corrected a real error in the first draft of this
  file, which asked for a key scoped to Checkout Sessions and Subscriptions. **Wrong scope** — the
  flow's only call is `GET /v1/events/{id}`, so the key needs **read on Events and nothing else**.
  Would have had an admin issue a key that couldn't do the job, or a broader one than necessary.

Also updated: `README.md` blocking decisions #6 and #11 now record the chosen route rather than
listing options, and a broken relative link to `stripe/plans.json` in `stripe-webhook.md` was fixed
while in there.
