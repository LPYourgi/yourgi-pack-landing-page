# Project Context: Subscription Experiment (working name "Yourgi Pack")
**Date:** 10 August 2026
**Source:** Team discussion — rough auto-transcribed meeting notes, synthesized. Form: verbal meeting transcript, not a written brief.
**Version:** 1.2

**Decisions since v1.0**
- **10 Aug 2026 — Name.** The offer is now **Yourgi Pack**. The working name in the source discussion was "Yourgi Prime"; renamed by Lauren. Still a working name, not a brand-approved one — Kai owns final naming (§7 q5).
- **12 Aug 2026 — Matching is to MULTIPLE Pros, not one.** A subscriber is matched to several local Pros who know their pet, not to a single assigned Pro with a named backup. Decided by Lauren. This **partially answers Gap 3** (provider-side mechanics) on the customer-facing half of the question; how those Pros are selected, paid, and told a booking is subscription-driven is still open. Note this is *closer* to the brand guide than the single-Pro model was — the Connection value prop there is "the best-matching 1–5 providers." The landing page has been corrected; it had been asserting one matched Pro, which was never in this document.
- **12 Aug 2026 — Pricing and tier structure settled** at **$49 / $99 / $399**, resolving §7 q1 and §7 q2. $49 buys five walks (walking only); $99 buys five days or nights of **any** service; $399 is **unlimited for the month**. This takes both of q1's live options — a capped package *and* a flat unlimited price — one per tier, and is q2's option (a), a service-level ladder. Decided by Lauren; David still owns final pricing sign-off.
  - **This reverses §7 q3's lean** that overnight and boarding be excluded: both are included on the top two tiers.
  - **This removes the only subsidy guardrail the experiment had.** §6 asks for guardrails so a flat low fee can't be spent on disproportionately expensive services, and a usage cap was serving as that guardrail. The $399 tier has no cap, so a month of nightly house-sitting is now the exact exposure §6 names, with Pros paid full rate throughout. **Unresolved and the highest-priority open risk** — see Gap 10.
  - **$49 also reverses q1's own rejection of $50 as too low.** Flagged and confirmed.

---

## 1. Problem Statement
Yourgi has no validated signal about whether pet parents will commit to a recurring monthly fee for pet-care services. The current model is entirely one-off bookings, which limits repeat demand and predictable, recurring revenue. The team wants to test — quickly and cheaply — whether there is any appetite to pay for a subscription before deciding whether to build it into the product for real. Why now is framed as a strategic desire to trial a new transaction model and drive sign-ups/repeat bookings; no specific metric trigger is stated in the source (see Gaps).

## 2. ICP (Ideal Customer Profile)
**Side:** Pet parents (primary), with concierge/match staff operationally involved.

Pet parents with a *recurring, repeatable* pet-care need — the person who needs daycare on the specific days they're in the office, or standing dog walks on a regular cadence. The framing in the discussion is that subscriptions appeal to customers who want a specific service repeated on a predictable schedule and who would treat Yourgi as the ongoing "one-stop shop" for their pet's care, rather than customers with ad-hoc, one-time needs. Overnight services (boarding, house-sitting) are seen as poor subscription fits because they're occasional and trip-driven. **Superseded 12 Aug 2026** — the tier decision includes overnight care on the top two tiers; this paragraph records what the source discussion believed, not the current offer. See Decisions.

**Cross-side impact (providers):** Subscription bookings would still be fulfilled by pros, and the source is explicit that pros are expected to be paid their normal/full rate while the customer's cost is zeroed out or heavily subsidized by Yourgi (the stated worry: a subscriber booking $200/night house-sitting every night for a $50 flat fee, leaving Yourgi to pay the pro the full amount). Beyond that subsidy concern, the input does not define how pros are matched to subscription bookings, whether pros know a booking is subscription-driven, or which pros participate — that silence is logged in Gaps.

**Cross-side impact (internal staff):** This is not a fully automated flow for the test. The concierge/match team absorbs real operational work — tracking who subscribed and manually issuing coupons for each free booking, and potentially following up to set up each subscriber's services. That operational load is real but not scoped (see Gaps).

## 3. Pain Points
The input frames a business hypothesis and a value proposition ("your animal's one-stop shop, building a relationship you keep coming back to") rather than documented, user-experienced friction. No specific current pain — support tickets, quotes, or observed behavior showing pet parents struggling with the one-off model — is present in the source. Documented pet-parent pain points: Not defined in source material (see Gaps).

## 4. Proposed Solution
- Users can sign up for a monthly subscription via a simple Webflow landing page that links out to a Stripe-hosted subscription checkout.
- Users can choose from a small number of tiers (roughly two to three; exact tiers undecided — see Open Questions).
- Users can (possibly) indicate which service(s) they want or describe their recurring needs via a form input on the landing page — simple radio selectors or a free-text box; whether to collect this at all is undecided (see Open Questions).
- Users can manage and cancel their subscription through Stripe's own hosted flow (Stripe handles billing notices and cancellation, so nothing custom is built for that).
- Staff can receive each new sign-up as a notification in a dedicated Teams channel, driven by a Stripe webhook.
- Staff can manually issue coupons to subscribers so their qualifying bookings are free/zeroed out.
- Staff can follow up with subscribers to set up their specific services one-on-one.

Build note from the source: the landing page reuses the existing "handy widget" landing-page framework with the offer swapped in, rather than being built from scratch. It is decoupled from the app (no authentication). The Stripe subscription page has already been prototyped and is connected to Yourgi's Stripe account but is unpublished.

## 5. Success Metrics
The stated goal is to see whether there is any willingness to pay — i.e., to drive and count subscription **sign-ups** (a demand-side signal). The team is explicit that this is *not* being optimized for profitability and that the experiment can run underwater/subsidized. No numeric target, baseline, or threshold for continuing vs. shutting the experiment down is defined. Target and baseline: Not defined in source material (see Gaps).

## 6. Design Constraints
**Platform:** Web — a Webflow landing page plus Stripe's hosted checkout. Decoupled from the core app; no user authentication for the test.
**Geography:** Not defined in source material (see Gaps).
**Accessibility:** Not defined in source material (see Gaps).
**Technical:** Webflow landing page (reusing the "handy widget" page framework); Stripe for subscription billing via its hosted checkout (already prototyped, connected to Yourgi's Stripe, unpublished); a Stripe webhook feeding a new dedicated Teams channel for concierge notifications. Not integrated into the core booking system for this test — fulfillment is manual (coupons). Noted constraint from Curtis: Stripe is acceptable for the experiment but has limitations, and a productionized subscription should eventually be brought in-house rather than run on Stripe. Lauren will need Stripe access/credentials to wire the tiers up (owner of provisioning unresolved — see Gaps).
**Brand:** Follows the yourgi-brand skill. Customer-facing copy is to be finessed separately, with Kai polishing the marketing text; the tier presentation is treated as the primary selling point and needs to feel appealing.
**Trust & liability:**
- *Subsidy/abuse exposure:* guardrails are needed so a flat low fee can't be used to book disproportionately high-cost services (the house-sitting example above). Flagged in source; specific guardrails not yet defined.
- *Beta framing / wind-down:* the subscription is understood to be a beta whose value may change or be discontinued; enrolled subscribers would need an off-ramp and honest comms. Raised in source but not specified (see Gaps).
- *The Guarantee:* whether subscription bookings are covered by Yourgi's make-it-right Guarantee on the same terms is not addressed in the source. Because the Guarantee is Yourgi's central claim with undocumented legal boundaries, this needs an explicit decision before design proceeds (see Gaps).
**Other:** Timeline — the deck lists "next Wednesday" as the go-live date, which the team assessed as aggressive; the working consensus is to get a test/shell page up "next week." The authoritative deadline is not reconciled (see Gaps).

## 7. Open Questions
1. ~~**Pricing model:**~~ **RESOLVED 12 Aug 2026 — $49 / $99 / $399, taking both options, one per tier. See Decisions.** Original question: all-you-can-eat flat fee vs. capped packages? $50/month was called too low; $100–$200/month was floated. Options on the table: a flat "unlimited" price per service, or packages that cap usage (e.g., pick from N services, up to 4–5 uses, then full price). Being actively worked (the facilitator is meeting David on pricing and pulling competitor comparisons via Claude).
2. ~~**Tier structure:**~~ **RESOLVED 12 Aug 2026 — three tiers on a service-level ladder, option (a). See Decisions.** Original question: how many tiers and organized how? Alternatives raised: (a) by service level — low = dog walking, medium = daycare, high = everything/overnight; (b) by package — pick from three services, up to a usage cap; (c) tiers specific to each service (e.g., three dog-walking tiers and three daycare tiers, per Jeff). Current lean is to keep it simple — one page, ~2–3 tiers — because over-tiering muddies the signal.
3. ~~**Which services to include in the test?**~~ **RESOLVED 12 Aug 2026, and REVERSED from the lean below — overnight and boarding are INCLUDED on the top two tiers.** Original lean: start with dog walking (repeatable, lower cost, best subscription fit), possibly plus daycare. Overnight services (boarding, house-sitting) likely excluded or handled differently. Pro services only — not vet clinic.
4. **Form scope:** should the landing page collect service interest (radio buttons / free-text recurring needs) so concierge can follow up, or be a bare "sign up" CTA? Leans on landing-page best practices and whether traffic comes from an ad. Undecided.
5. **Copy ownership / go-to-market:** Kai finesses the marketing copy; how much Emily and Lauren drive the tier/pricing recommendation vs. the facilitator making the call is still being negotiated (facilitator offered to drive the decision given the team's workload).
6. **Notification channel:** should sign-ups post to a new dedicated Teams channel separate from the existing concierge "order form" channel? Leaning toward a new, separate channel.

## 8. Gaps
1. **Success Metrics** — no target, baseline, or success/kill threshold for sign-ups is defined. Matters because the shape and investment of the experiment (and when to declare it working or dead) depend on what counts as a meaningful signal. Ask the facilitator/PM driving this, with Scott as the interested stakeholder.
2. **Pain Points** — no documented, validated pet-parent friction; the case rests on a business hypothesis and value prop. Matters because tier and service choices should be grounded in the recurring need customers actually have, not in an assumed one. Ask Emily / whoever owns customer research.
3. **Provider-side mechanics** — **partially answered 12 Aug 2026:** a subscriber is matched to several local Pros rather than one assigned Pro (see Decisions). Still open: how those Pros are selected, how they're paid for subscription bookings, whether they know a booking is subscription-driven, and which pros participate. Only the subsidy/full-payout concern was raised in the source. Matters for supply cost and provider experience. Ask Jeff / the bookings team. **The landing page now tells customers that whoever turns up has met their pet before — that is a service promise nobody has agreed to yet.** Confirm it or soften the copy (see also Gap 6).
4. **The Guarantee** — not addressed. Whether subscription bookings are covered on the same terms is undetermined. Matters because it is Yourgi's central claim with undocumented legal boundaries and is expensive to get wrong after launch. Ask Kai (marketing) and/or legal.
5. **Experiment duration & wind-down** — framed as a beta that "may go away," but with no defined runtime, decision date, or off-ramp for enrolled subscribers. Matters for customer trust and comms/legal. Ask the facilitator.
6. **Concierge operational capacity** — the manual coupon-issuing and service-setup load isn't scoped; there's no estimate of how many sign-ups the team can handle before the manual process breaks. Matters because the whole test depends on that team actualizing it. Ask the concierge/match team lead.
7. **Go-live date** — the deck says "next Wednesday" but team consensus is "next week" for a test page; the authoritative deadline isn't reconciled. Ask whoever owns the deck (Scott/Kai).
8. **Geography & Accessibility** — neither is defined in the source. Matters because launch market and any accessibility requirements bound the landing-page build. Owner unknown.
9. **Stripe access provisioning** — Lauren needs Stripe access/credentials to wire up the tiers; who provisions this is unresolved (the facilitator offered to handle it if access can't be granted). Operational; ask the facilitator.
10. **Abuse guardrails on the unlimited tier** — **opened 12 Aug 2026 by the pricing decision, and the highest-priority open risk on this experiment.** §6 asks for guardrails so a flat fee can't be spent on disproportionately expensive services; the usage cap was that guardrail, and the $399 tier no longer has one. A subscriber booking nightly house-sitting for a month is the exposure §6 names verbatim, with Pros paid full rate throughout, and nothing in the product or the copy currently limits it. §5 does permit running the experiment underwater, so this may be an accepted cost rather than a problem — but it has to be chosen deliberately and sized before the page takes money. A decision was taken on 12 Aug 2026 to leave the page silent on any limit for now. Ask David (cost exposure) and Jeff / the bookings team (what a Pro-side cap would even look like).

---
*Generated by yourgi-project-context. Update as decisions are made and questions are resolved.*
