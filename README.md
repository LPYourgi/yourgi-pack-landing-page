# Subscription Landing Page ("Yourgi Membership")

A standalone subscription landing page — visitor picks one of three membership tiers, enters their contact info, and **completes a real purchase through Stripe**. Tests whether customers will sign up for a recurring pet-care plan.

Seeded from the [Concierge Landing Page](../Concierge%20Landing%20Page) repo on 2026-08-10. Same brand shell, nav/footer, analytics wiring, zip market gate, and form validation — different offer and, critically, a **real payment flow instead of a manual concierge follow-up**.

**New here? → Read [`docs/handoff.md`](docs/handoff.md) first.**

## Files

- `index.html` — the prototype (canonical). Double-click to open, or serve it (see below).
- `deploy/index.html` — identical copy, ready to drop into a static host. Keep in sync.
- `test/prototype.test.mjs` — 72 headless checks. See "Testing".
- `docs/handoff.md` — start-here onboarding, open decisions, and the Stripe wiring steps.
- `docs/project-context.md` — **the authoritative source.** Synthesized from the 10 Aug 2026 team discussion. Working name for the offer is **"Yourgi Prime"**. Where this doc and the prototype disagree, this doc wins.

## ⚠️ The prototype's placeholders conflict with the team discussion

The page was scaffolded before `docs/project-context.md` was read. Four placeholders now contradict what the team actually said — fix these before anyone reviews the page, or they'll review the wrong offer:

| Prototype currently shows | What the discussion says |
|---|---|
| A **$49/mo** Starter tier | $50/month was called **too low**; $100–$200 was floated |
| Boarding credit in the Premium tier | Overnight services (boarding, house-sitting) are a **poor subscription fit** and likely excluded |
| "Yourgi Guarantee on every visit" as a benefit | Whether the Guarantee covers subscription bookings is **undetermined** and flagged as a legal risk |
| A zip market gate copied from the concierge page | Geography is **not defined** in the source — this gate is an unfounded assumption |

Also unreconciled: the discussion leans toward **starting with dog walking** (possibly plus daycare), and it's still undecided whether the form should collect service interest at all.

## Status

**Prototype, not production.** It runs in **dry-run mode** out of the box: no Stripe links are configured, so "Continue to payment" captures the lead and shows the confirmation screen without charging anyone. Nothing on this page has been priced, brand-reviewed, or approved.

## Blocking decisions — nothing ships until these land

Full detail in `docs/project-context.md` §7 (Open Questions) and §8 (Gaps). Condensed:

| # | Decision | Owner |
|---|----------|-------|
| 1 | **Pricing model** — flat "unlimited" vs. capped packages, and the actual price. Actively being worked with David. | Facilitator / David |
| 2 | **Tier structure** — how many and organized by what (service level, package, or per-service). Lean is 2–3, kept simple. | Emily / Lauren |
| 3 | **Which services are in the test.** Lean: dog walking first, maybe daycare. Overnight likely out. | Jeff / bookings |
| 4 | **Form scope** — collect service interest, or a bare sign-up CTA? | Undecided |
| 5 | **Guarantee coverage** for subscription bookings. Legal boundaries undocumented. | Kai / Legal |
| 6 | **Subsidy guardrails** — stop a flat low fee buying disproportionately expensive services. | Facilitator |
| 7 | **Stripe access provisioning** for Lauren to wire up the tiers. | Facilitator |
| 8 | **Success metric** — no target, baseline, or kill threshold defined. | Facilitator / Scott |
| 9 | **Notification channel** — new dedicated Teams channel, separate from the concierge order-form channel. | Jeff |
| 10 | Geography, page slug, National 2 font + official logo lockup | Webflow / brand |

## Running it

Open `index.html` directly, or serve it to exercise the JS:

```bash
python3 -m http.server 8137
```

To see the post-Stripe screens without a real payment, append `?checkout=success` or `?checkout=cancel` to the URL.

## Testing

```bash
npm install jsdom && node test/prototype.test.mjs
```

Covers tier switching, validation, phone/zip masking, the market gate, dry-run behavior, Stripe URL construction, out-of-market handling, webhook payload and failure, and both return-from-Stripe states. The suite stubs Mixpanel, Segment, and `fetch`, so **it never fires a real side effect** — keep it that way.

---
_Related: [Concierge Landing Page](../Concierge%20Landing%20Page) — the flat-rate test this page was seeded from._
