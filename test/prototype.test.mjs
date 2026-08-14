import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolved relative to this file so the suite travels with the project.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'index.html');
const NAV_LINE = 'target.location.href=url;';
// The whole Stripe config object, so the harness can seed per-plan links or blank them out.
const LINKS_BLOCK = /var STRIPE_PAYMENT_LINKS = \{[\s\S]*?\n  \};/;
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  ok  ', name)) : (fail++, console.log('  FAIL', name, extra ?? '')); };

// Fresh page per scenario so state never leaks between tests.
// No `webhook` option any more: the page posts to nothing. fetch is still stubbed below so the
// suite can assert that — a silent outbound POST from this page is exactly what we're guarding
// against, and you can only catch it by watching for a call that should never come.
/* `plan` seeds sessionStorage.yg_plan BEFORE the page's scripts run, which is the only way to
   exercise the real return-from-Stripe path: the page writes that key immediately before handing
   off, so anyone coming back from an actual payment has it set. Booting without it takes the
   fallback branch instead — and that gap is exactly how a retired promise survived on the
   post-payment screen until 14 Aug 2026. See the guard in the return-from-Stripe block. */
async function boot({ search = '', links = null, plan = null } = {}) {
  let html = fs.readFileSync(PAGE, 'utf8');
  // Strip the Mixpanel + Segment loader blocks; we install stubs instead so nothing real fires.
  html = html.replace(/<script type="text\/javascript">[\s\S]*?<\/script>/, `<script>
    window.__mp=[]; window.__nav=[]; window.trackEvent=function(n,p){window.__mp.push([n,p||{}]);};
  </script>`);
  html = html.replace(/<script>\s*!function\(\)\{var i="analytics"[\s\S]*?<\/script>/, `<script>
    window.__seg=[];
    window.sendToSegment=function(email,traits,ev,props){window.__seg.push({email,traits,ev,props});};
  </script>`);
  // links: a URL prefix gives each plan its own distinguishable link; '' blanks all three, which
  // is how the inert-CTA state is exercised now that the page ships with a placeholder link.
  if (links !== null) {
    if (!LINKS_BLOCK.test(html)) throw new Error('STRIPE_PAYMENT_LINKS block changed — update LINKS_BLOCK in the harness');
    const seeded = links === ''
      ? `weekly: '', twice: '', weekdays: ''`
      : `weekly: '${links}w', twice: '${links}t', weekdays: '${links}d'`;
    html = html.replace(LINKS_BLOCK, `var STRIPE_PAYMENT_LINKS = { ${seeded} };`);
  }
  /* jsdom's location.href is unforgeable, so swap the redirects for a recorder.
     BOTH of them, which is why this is replaceAll: handOffToStripe() and goToMap() each carry this
     line. It used to be a single replace, and when goToMap arrived on 14 Aug 2026 that silently
     stubbed only the Stripe handoff — the map button then performed a real assignment jsdom drops on
     the floor, so three map assertions failed with an empty __nav and no hint why.
     The count is asserted rather than assumed: a third navigation should break the harness loudly
     here rather than go untested. The "every navigation goes through a named helper" assertion
     further down guards the same number from the other direction. */
  const navHits = (html.match(new RegExp(NAV_LINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (navHits !== 2) throw new Error(`expected 2 redirect lines to stub, found ${navHits} — update NAV_LINE or the count in the harness`);
  html = html.replaceAll(NAV_LINE, 'window.__nav.push(url);');

  const dom = new JSDOM(html, {
    url: 'https://www.yourgi.com/pack' + search,
    runScripts: 'dangerously', pretendToBeVisual: true,
    // Must exist before parse: the return-from-Stripe handler runs during load.
    beforeParse(w) {
      w.HTMLElement.prototype.scrollIntoView = () => {};
      if (plan) w.sessionStorage.setItem('yg_plan', JSON.stringify(plan));
    },
  });
  const w = dom.window;
  w.__fetches = [];
  w.fetch = (u, o) => { w.__fetches.push({ u, body: JSON.parse(o.body) }); return Promise.resolve({ ok: true }); };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  await new Promise(r => w.addEventListener('load', r));
  return w;
}

const $ = (w, id) => w.document.getElementById(id);
const vis = (w, id) => !$(w, id).classList.contains('hidden');
// The form asks for email, phone and zip. Nothing else.
const fill = (w, { zip, email = 'test@example.com', phone = '3035550142' }) => {
  const vals = [['q-zip', zip], ['q-email', email], ['q-phone', phone]];
  for (const [id, val] of vals) {
    const el = $(w, id);
    el.value = val;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
  }
};
const settle = () => new Promise(r => setTimeout(r, 30));

console.log('\n— initial render —');
{
  const w = await boot();
  ok('title is the Plus page', w.document.title === 'Yourgi Plus | Yourgi', w.document.title);
  ok('three plans rendered', w.document.querySelectorAll('#tiers .tier').length === 3);
  ok('Twice a Week is the default selection', $(w, 'tiers').querySelector('[data-tier="twice"]').getAttribute('aria-checked') === 'true');
  ok('exactly one plan is checked', w.document.querySelectorAll('#tiers .tier[aria-checked="true"]').length === 1);
  // Two bullets, not three — the Figma hides "Spend them on whatever the month needs" on every tier.
  ok('benefits list rendered for default plan', w.document.querySelectorAll('#incl li').length === 2);
  ok('plan step visible, others hidden', vis(w, 'step-plan') && !vis(w, 'step-confirm') && !vis(w, 'step-oom') && !vis(w, 'step-cancel'));
  ok('beta framing is on the page', w.document.querySelector('.beta').textContent.includes('beta'));
}

// This page stands alone. Site nav would leak people out of the one thing it's measuring.
console.log('\n— nav is logo only —');
{
  const w = await boot();
  const navLinks = [...w.document.querySelectorAll('nav a')];
  ok('nav holds exactly one link', navLinks.length === 1, navLinks.map(a => a.textContent.trim()));
  ok('that link is the logo', !!navLinks[0]?.querySelector('img.logo-img'));
  ok('logo points at yourgi.com so a payer can check who they are paying',
    navLinks[0]?.getAttribute('href') === 'https://www.yourgi.com', navLinks[0]?.getAttribute('href'));
  ok('no nav buttons left (overflow menu removed)', w.document.querySelectorAll('nav button').length === 0);
  ok('no "Book now" escape hatch', !w.document.querySelector('nav').textContent.includes('Book now'));
  ok('overflow-menu markup is gone', !$(w, 'nav-more-btn') && !$(w, 'nav-more-menu'));
  // Dead CSS/JS for the removed nav shouldn't linger.
  const src = fs.readFileSync(PAGE, 'utf8');
  ok('no dead nav CSS or JS left behind', !/nav-more|navlinks|nav-right|nav-left/.test(src));
}

// These guard the reconciliation against docs/project-context.md. If one fails, the page has
// drifted back toward the pre-PRD scaffold — re-read the PRD before "fixing" the test.
console.log('\n— PRD reconciliation guards —');
{
  const w = await boot();
  const src = fs.readFileSync(PAGE, 'utf8');
  const prices = [...w.document.querySelectorAll('#tiers .tier')].map(t => +t.dataset.price);

  /* §7 q1 IS DELIBERATELY OVERRIDDEN — Lauren's call, 12 Aug 2026, applying the Figma pricing.
     These two guards used to assert prices sat in the $100–$200 band and that no plan was in the
     $50 class, because §7 q1 rejected $50 as too low and docs/handoff.md recorded "no $49 plan"
     as a resolved conflict. The Figma set $49 / $99 / $399 and that was confirmed over the flag.
     The guards are kept, inverted, so the override stays visible instead of vanishing: they now
     pin the exact prices the page is supposed to be serving. Change them only with the same kind
     of explicit decision, and re-open §7 q1 with David when you do.

     THE TOP PLAN MOVED AGAIN ON 13 AUG 2026, $399 -> $499, Lauren's call. Unlike the $49, that one
     resolves a conflict instead of creating one: Schedule 1 of the draft T&Cs already said $499 and
     docs/stripe-webhook.md §1.3b had the page logged as the side that was wrong. The number is
     pinned in four places that must move together — this assertion, data-price in index.html,
     stripe/plans.json, and the Stripe Price the weekdays Payment Link is built on. The first three
     are checked by this suite ("Stripe manifest matches the page"); the fourth is not checked by
     anything, which is how the page and Stripe sat a hundred dollars apart for part of that day. */
  ok('prices are $49 / $99 / $499 — top tier corrected to match the T&Cs, 13 Aug (§7 q1 overridden — see comment)',
    JSON.stringify(prices) === JSON.stringify([49, 99, 499]), prices);
  ok('the §7 q1 override is written down in the page itself',
    /THIS REOPENS A SETTLED DECISION/.test(src) && /§7 q1/.test(src), 'head comment missing the override note');

  // Walk the rendered benefits for every plan, not just the default.
  const allBenefits = [];
  for (const t of [...w.document.querySelectorAll('#tiers .tier')]) {
    t.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    allBenefits.push($(w, 'incl').textContent);
  }
  const benefitText = allBenefits.join(' ').toLowerCase();

  ok('no plan claims the Yourgi Guarantee (§8 gap 4 — coverage undetermined)',
    !benefitText.includes('guarantee'));
  /* §7 q3 AND §6 BOTH MOVED on Lauren's pricing note of 12 Aug 2026. $49 buys five walks, $99 buys
     five days or nights of ANY service, $399 buys the month outright. Two guards used to live here:
     "no plan promises overnight, boarding, or house-sitting" (§7 q3 leaned toward excluding them)
     and "no plan is unlimited" (§6 — the cap WAS the subsidy guardrail). Both are now false by
     design, so asserting them would just fail forever. They are replaced by assertions that pin
     the new shape and, more importantly, keep the unguarded exposure visible in the suite. */
  /* MOVED OFF THE BULLETS 13 Aug 2026. The top plan's bullet used to say "Unlimited days and
     nights"; the Figma replaced it with "All-you-need pet care, for one low monthly rate.", which
     never says the word. The uncapped shape is what §6 needs kept visible, so the guard follows it
     to the tile blurb — the one place the page still states it plainly. If "unlimited" leaves the
     tiles too, the page will be selling an uncapped plan without saying so, and that must fail. */
  const tileText = $(w, 'tiers').textContent;
  ok('the top plan is unlimited — §6 cap guardrail deliberately given up',
    /unlimited/i.test(tileText), tileText);
  ok('the unguarded §6 subsidy exposure is written down in the page',
    /WHAT IS NOW UNGUARDED/.test(src) && /§6/.test(src),
    'head comment must keep naming the unlimited-plan exposure');
  /* The boarding FAQ is gone — the Figma dropped it (13 Aug 2026). What the plans cover is now
     stated only in the comparison table, so that is where the guard points. */
  ok('the table names the services a plan covers',
    /Walks, house sitting, daycare, or boarding/i.test($(w, 'cmp-body').closest('table').textContent));

  /* MATCHING IS TO SEVERAL PROS, NOT ONE — Lauren, 12 Aug 2026, now recorded in the PRD's Decisions
     block. There was NO guard on this before, which is how the page carried "one matched Pro" in
     four places while the PRD never said it. It is the page's central promise, so it gets one now.
     A single-Pro claim is not a wording slip: it contradicts the offer and it is the kind of thing
     a well-meaning copy pass would put back. */
  /* Rendered text ONLY — body.textContent includes the inline <script>, and the source comments
     discuss the retired single-Pro model on purpose so the next reader knows what changed. */
  const body = w.document.body.cloneNode(true);
  body.querySelectorAll('script, style').forEach(n => n.remove());
  const visible = body.textContent;
  /* The FAQ still ASKS "Do I get the same Pro every time?" — that is the question customers actually
     ask, in their words, and dropping it would duck the objection instead of answering it. What must
     not appear is the page ASSERTING a single Pro, so the question is excluded and the rest checked. */
  const claims = visible.replace(/Do I get the same Pro every time\?/g, '');
  ok('the page never claims a single assigned Pro',
    !/one (matched |local )?Pro\b/i.test(claims) && !/the same Pro\b/i.test(claims),
    claims.match(/[^.?]*(\bone (matched|local)? ?Pro\b|the same Pro\b)[^.?]*/i)?.[0]);
  ok('no named-backup promise survives — cover is inherent to the group, not a top-plan feature',
    !/named backup/i.test(visible), visible.match(/[^.]*named backup[^.]*/i)?.[0]);
  /* The answer changed with the Concierge model: it used to be "Not necessarily", it is now "Up to
     you" — the customer picks. Still no promise that one Pro is assigned, which is what matters. */
  ok('the FAQ leaves the choice of Provider with the customer',
    /up to you/i.test($(w, 'faq').textContent));

  /* NO CONTINUITY OR FAMILIARITY CLAIM ANYWHERE IN THE BODY COPY. Three versions of this claim have
     now been wrong in a single day — "the same Pro every week", "the same Pro plus a named backup",
     and "Pros who already know your pet". A plan buys care; nothing establishes who turns up or that
     they have met the pet (Gap 3). This is the guard that stops a fourth version appearing, because
     every one of them read like good copy and none of them was true.
     THE H1 EXEMPTION IS RETIRED (12 Aug 2026). It used to sit here because the headline still said
     STOP RE-HIRING A STRANGER — knowingly unsupported, parked pending a positioning decision from
     Kai. The headline has now been changed to claim the arranging rather than the person, so there
     is nothing left to exempt and the H1 is checked like everything else. The dedicated guard lives
     in "the hero does not claim a Pro the plan cannot promise" below.
     NOTE: Kai owns the final positioning call (§7 q5). This change removes a false claim rather than
     settling the positioning — if Kai wants a different headline, that is still open. */
  const heroH1 = w.document.querySelector('.hero h1').textContent;
  const bodyMinusH1 = claims.replace(heroH1, '');
  /* NARROWED 13 Aug 2026, not dropped. The Figma copy says "a Concierge who knows your pet and your
     standards" — that is a claim about the Concierge, who genuinely does take a brief, not about the
     Pro who turns up. The guard still forbids the claim it was built for: that a PRO knows or has
     met the pet. Sentences about the Concierge are excluded before checking. */
  const proClaims = bodyMinusH1.replace(/[^.?]*Concierge[^.?]*[.?]/g, '');
  ok('no claim that a Pro knows or has met the pet',
    !/(already )?know(s)? your (pet|dog)|has met your (pet|dog)|learns? the routine/i.test(proClaims),
    proClaims.match(/[^.?]*(know your (pet|dog)|met your (pet|dog)|learns? the routine)[^.?]*/i)?.[0]);
  ok('no claim that the customer never has to rebook — Step 2 has them booking',
    !/nothing to rebook/i.test(claims), claims.match(/[^.?]*nothing to rebook[^.?]*/i)?.[0]);
  // The H1 is no longer exempt from the continuity rule — it is held to it like the rest of the copy.
  ok('the H1 makes no continuity claim either', !/stranger|same pro/i.test(heroH1), heroH1);
  ok('plan bullets state only mechanics and billing',
    allBenefits.every(b => /one charge a month, cancel any month/i.test(b)), allBenefits);
  /* ROLLOVER WAS DECIDED 12 Aug 2026 — use it or lose it. These two guards are inverted rather
     than deleted, so the decision stays visible in the tests the way the pricing override did.
     They used to assert the FAQ still called rollover open; they now assert it answers, and that
     the answer is the restrictive one. If someone later softens this to "your days roll over",
     that is a change to what the company owes every subscriber every month — it should break a
     test, not slip through as a copy tweak. */
  const faqText = $(w, 'faq').textContent;
  ok('no plan bullet promises rollover (there is none to promise)',
    !/roll(over| a day| your day| forward)|carry over/.test(benefitText), benefitText);
  /* INVERTED A THIRD TIME, 14 Aug 2026 — and this one goes back to asking the FAQ, because the
     rollover question RETURNED to the Figma (node 4191:1095) and therefore to the page. The 13 Aug
     version of this guard could only check the comparison table, since the frame had dropped the
     question; it now checks both, which is stronger than either.
     Read the three inversions as one story: the term was undecided, then decided and disclosed only
     in a table, and is now answered in the place people actually go looking for it. What must never
     happen is the page promising rollover, and that is pinned above on the bullets and below on the
     answer's own wording. */
  const cmpText = $(w, 'cmp-body').textContent;
  ok('the page still discloses use-it-or-lose-it somewhere',
    /expire monthly/i.test(cmpText), 'no expiry disclosure left on the page');
  ok('the FAQ answers the rollover question again',
    /What happens to services I don’t use\?/.test(faqText), 'the restored rollover question is missing');
  ok('and answers it restrictively, in the T&Cs\' own terms',
    /do not accrue or rollover/i.test(faqText) && /limits reset every month/i.test(faqText),
    faqText.match(/[^.]*accrue[^.]*/i)?.[0]);
  /* The table and the FAQ now both state the term. They must not contradict each other — that pairing
     is what made the old "$9.80 a walk on a 2-service plan" mismatch possible in the frame. */
  ok('the table and the FAQ agree that nothing carries over',
    /expire monthly/i.test(cmpText) && !/roll(s)? over|carries over/i.test(faqText),
    faqText.match(/[^.]*(rolls over|carries over)[^.]*/i)?.[0]);
  // Cancelling and switching are now real, self-service Stripe behaviour — the copy has to match
  // what the customer portal was actually configured to allow (see docs/stripe-webhook.md §1.4).
  ok('cancel answer no longer defers to a placeholder',
    /Can I cancel\?/i.test(faqText) && !/PLACEHOLDER — confirm against the live Stripe/.test(faqText));
  ok('plan-change answer no longer defers to a placeholder',
    /Can I change plans\?/i.test(faqText) && !/confirm upgrade\/downgrade timing/.test(faqText));
  /* Was "every plan states a numeric walk cap". Two plans no longer have a walk cap to state: the
     $99 plan counts days or nights of anything, and the $399 plan counts nothing. What still has
     to hold is that each plan says plainly what you get, in words a buyer can check. */
  /* All three plans are any-service as of 13 Aug 2026, so the entry plan no longer states a walk
     count — it states a use count like the others. What still has to hold is that every plan says
     plainly what you get, in words a buyer can check against a receipt. */
  /* THE BULLETS STOPPED SAYING IT (13 Aug 2026), SO THE GUARD FOLLOWED THE CLAIM. The Figma's new
     first bullets state no quantity on two plans and a relative one on the third ("just more"),
     so allBenefits can no longer answer "what does this plan hold". The tile blurb directly above
     the bullets can, on all three — 2 / 5 / unlimited services per month — so that is what is
     pinned. This is a WEAKER guard than the one it replaces and it should be read that way: it
     checks the count is stated somewhere on the card, not that the bullets a buyer reads state it.
     Point it back at the bullets the day they carry a number again. */
  const tiles = [...w.document.querySelectorAll('#tiers .tier')];
  ok('every plan states what it holds, in countable words or as unlimited',
    tiles.length === 3 &&
    tiles.every(t => /(two|three|four|five|\d+) services|unlimited/i.test(t.textContent)),
    tiles.map(t => t.querySelector('.tier-blurb')?.textContent));

  // The hero previously carried an asterisked Guarantee claim. It must not come back.
  const hero = w.document.querySelector('.hero').textContent;
  /* OVERRIDDEN 13 Aug 2026, deliberately and against this guard's original purpose. The Figma hero
     carries "Guaranteed coverage within 48-hours", and the Figma is the source of truth for copy
     (Lauren). That is a Guarantee-shaped promise WITH a timeframe, which is exactly what §8 gap 4
     and the brand guide say not to publish while the Guarantee's legal boundaries are undocumented.
     The guard is inverted rather than deleted so the override cannot be mistaken for an accident:
     it now pins the claim's presence, and it will fail the day someone removes it without also
     removing this note. David/Kai/Legal own the decision. */
  ok('the hero carries the 48-hour coverage claim, pending legal review',
    /Guaranteed coverage within 48-hours/i.test(hero), hero.slice(0, 200));
  // Rendered text only — the source comments discuss the Guarantee at length on purpose.
  // With the site nav gone, the only place a visitor reads it is the site-wide footer.
  const visibleGuarantee = (w.document.body.textContent.match(/Yourgi Guarantee/g) || []).length;
  ok('the only Guarantee mention a visitor sees is the site-wide footer',
    visibleGuarantee === 1, visibleGuarantee);
  ok('no Guarantee claim inside the signup card', !$(w, 'signup').textContent.includes('Guarantee'));

  // Brand: "pet parent" is internal shorthand, never customer-facing (yourgi-brand skill).
  const bodyText = w.document.body.textContent;
  /* OVERRIDDEN 13 Aug 2026. "Most pet parents have a system that works until it does not" is the
     opening line of the Why Yourgi Plus band in the Figma. "pet parent" is on the brand's
     never-ship list (internal shorthand, reads as category jargon to the person it describes), but
     the Figma is the source of truth for copy. Inverted so the exception stays visible; if the
     phrase is ever removed, delete this guard with it. */
  ok('the one "pet parents" use is the Why band, carried from the Figma',
    (bodyText.match(/pet parent/gi) || []).length === 1 && /Most pet parents have a system/i.test(bodyText),
    bodyText.match(/[^.]*pet parent[^.]*/i)?.[0]);
  /* Was: exactly one instance, inside a customer's own review quote. The reviews are gone, so the
     phrase is gone with them — the never-ship rule now holds outright. */
  ok('no "fur baby" anywhere on the page', (bodyText.match(/fur bab/gi) || []).length === 0);
}

// Borrowed from operators who sell capped usage well: show the unit price, show the saving,
// let people compare all plans at once, and repeat the CTA at the bottom.
console.log('\n— subscription-page conventions —');
{
  const w = await boot();

  /* ===== THE PER-VISIT LINE IS GONE FROM THE CARDS, SO THIS CHECKS THE CONFIG =================
     The Figma plan tile (4008:116, and every instance in frame 4077:237) carries a name, a price
     and a blurb — no per-visit line. The page was rendering one, so it was removed to match.

     The assertions that read it off the DOM go with it. The one that does NOT is the value-ladder
     guard below, because the property it protects is about the PRICES, not about a line of text:
     under the old shape moving up a tier cost you MORE per use ($9.80 entry vs $19.80 middle), and
     the README called it out as a ladder that punished buying more. Making all three plans
     any-service fixed it. That fix is still real and still worth defending, so the guard now
     derives per-use from the page's own config — data-price ÷ PLAN_UNITS.uses — instead of reading
     a rendered string.

     THIS IS THE WEAKER POSITION AND IT SHOULD BE SAID PLAINLY: the ladder is now correct but
     INVISIBLE. Nothing on the page shows a buyer that five uses at $99 is cheaper each than two at
     $49; they are left to divide. A test knows, and a customer does not. */
  const pageSrc0 = fs.readFileSync(PAGE, 'utf8');
  ok('no per-visit line is rendered on any card — the Figma tile has none',
    w.document.querySelectorAll('#tiers [data-unit]').length === 0);
  const usesOf = t => +((pageSrc0.match(new RegExp(`${t}:\\s*\\{ uses: (\\d+)`)) || [])[1]);
  const tierPrice = t => +w.document.querySelector(`#tiers [data-tier="${t}"]`).dataset.price;
  ok('the entry plan holds two uses and the middle plan five',
    usesOf('weekly') === 2 && usesOf('twice') === 5,
    { weekly: usesOf('weekly'), twice: usesOf('twice') });
  const perUseOf = t => tierPrice(t) / usesOf(t);
  ok('per-use price FALLS from the entry plan to the middle plan',
    perUseOf('weekly') > perUseOf('twice'),
    { weekly: perUseOf('weekly'), twice: perUseOf('twice') });

  /* ===== THE SAVINGS GUARDS ARE GONE, AND THAT IS THE FINDING ==================================
     Until 13 Aug 2026 this block held the page's money claims to arithmetic: the callout had to
     name a per-use price and a real monthly saving, the mixed plan had to say "at least", the
     figure had to be derived from LIST_RATES so it moved when David's rates moved, and the
     uncapped plan had to make a breakeven argument rather than print a dash.

     None of that can be asserted now. The Figma is the source of truth for copy (Lauren), and it
     replaces every computed cell with one fixed sentence: "Save more than 50% on pet care with
     Yourgi Plus subscriptions!". Against David's rates the plans save about 18% and 34% when spent
     on walks, so the claim is only true if a plan is spent on overnights — a basis the page does
     not state. The comparison table's "Works out at" and "You save" rows are gone with it, so the
     table can no longer contradict the callout, and nothing can check it either.

     THE 50% CLAIM IS GONE (14 Aug 2026) and the guards below changed shape with it. Kai's per-plan
     copy landed in Figma 4095:655, replacing the single sentence with three that state no number at
     all, so there is no longer a numeric claim on this page to hold to arithmetic OR to flag as
     unverified. The guard that asserted the claim was still flagged in the source has been INVERTED
     rather than deleted: it now asserts the claim is absent, because the failure worth catching
     flipped direction. A well-meaning "let's put the savings back" edit is exactly the thing that
     needs to fail loudly, and it would have passed the old guard.

     Restore the arithmetic guards the day a figure comes back WITH an approved basis — and derive it
     through economics() rather than from whatever the page happens to say then. */
  const save = $(w, 'save-line').textContent;
  const pageSrc = fs.readFileSync(PAGE, 'utf8');
  ok('the callout is this plan\'s own line, not one shared sentence',
    save === 'Our most popular Yourgi Plus subscription.', save);
  /* Every tier has its own, and switching plans switches it. This is the property that could not be
     asserted before Kai's copy existed — all three tiers rendered the same string. */
  {
    const expected = {
      weekly:   'The absolute best value in pet care, ever.',
      twice:    'Our most popular Yourgi Plus subscription.',
      weekdays: 'Overflowing toy basket, unlimited pet care for the pet who has it all.',
    };
    const seen = {};
    for (const tier of Object.keys(expected)) {
      $(w, 'tiers').querySelector(`[data-tier="${tier}"]`)
        .dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
      seen[tier] = $(w, 'save-line').textContent;
    }
    ok('each plan shows its own callout', JSON.stringify(seen) === JSON.stringify(expected), JSON.stringify(seen));
    ok('and the three are actually different', new Set(Object.values(seen)).size === 3);
    // back to the default so later assertions in this block see the preselected plan
    $(w, 'tiers').querySelector('[data-tier="twice"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  }
  /* INVERTED 14 Aug 2026 — was "the unverified 50% claim is flagged in the source". The claim it
     guarded no longer exists, so the guard now stops it coming back.
     RENDERED TEXT ONLY, with script and style stripped — the same care the single-Pro guards take,
     and for the same reason: the source comments discuss the retired claim at length on purpose, so
     body.textContent (which includes the inline <script>) matches its own documentation and reports a
     failure that is not there. This assertion caught exactly that on its first run. */
  const savePlain = (() => {
    const b = w.document.body.cloneNode(true);
    b.querySelectorAll('script, style').forEach(n => n.remove());
    return b.textContent;
  })();
  ok('no savings percentage is claimed anywhere on the page',
    !/\b\d{1,3}\s?%/.test(savePlain) && !/save more than/i.test(savePlain),
    savePlain.match(/[^.]*(save more than|\d{1,3}\s?%)[^.]*/i)?.[0]);
  ok('the retired 50% claim is not lurking in a hidden element',
    !/50% on pet care/.test(savePlain));
  ok('the resolved unit price is explained in the source',
    /weekly is now \{ uses: 2/.test(pageSrc),
    'the note must record that the plan definition was fixed rather than the number copied');

  // Comparison table: the four rows the Figma renders, and only those.
  const rows = [...w.document.querySelectorAll('#cmp-body tr')];
  ok('comparison table renders the four Figma rows', rows.length === 4, rows.length);
  ok('table headers carry each price',
    $(w, 'cmp-p-weekly').textContent === '$49/mo' && $(w, 'cmp-p-twice').textContent === '$99/mo' && $(w, 'cmp-p-weekdays').textContent === '$499/mo');
  const rowByLabel = l => rows.find(r => r.querySelector('th')?.textContent.includes(l));
  const cells = l => [...rowByLabel(l).querySelectorAll('td')].map(td => td.textContent.trim());
  ok('coverage counts services, not walks',
    JSON.stringify(cells('What it covers')) === JSON.stringify([
      '2 services per month for one pet.', '5 services per month for one pet.', 'Unlimited services per month for one pet.']),
    cells('What it covers'));
  /* All three plans expire monthly in the Figma, including the uncapped one — which previously
     printed a dash on the grounds that there is no allowance to lose. Verbatim. */
  ok('every plan states that unused days expire',
    cells('Unused days').every(c => /Expire monthly/i.test(c)), cells('Unused days'));
  ok('the Concierge row is included on all three plans',
    cells('Dedicated Concierge').every(c => /Included/i.test(c)), cells('Dedicated Concierge'));
  ok('add-ons are separate except on the top plan',
    cells('Add-On')[0].includes('Booked separately') && cells('Add-On')[2].includes('1 per month included'),
    cells('Add-On'));
  ok('middle plan is highlighted in the table', rowByLabel('Unused days').querySelectorAll('td.best').length === 1);

  // A long page needs a second door.
  ok('closing CTA exists', !!$(w, 'closer-cta'));
  /* BOTH INVERTED 13 Aug 2026. The Figma's single fineprint line replaced the two that named
     Stripe and said the card never touches Yourgi. Naming the destination before a mid-purchase
     domain jump is standard on hosted checkouts, so this is a real loss, recorded rather than
     quietly accepted. The CTA still hands off to Stripe; the page just no longer says so. */
  ok('the card copy no longer names Stripe before the handoff (Figma)',
    !$(w, 'signup').textContent.includes('Stripe'));
  ok('and no longer says the card never touches Yourgi (Figma)',
    !$(w, 'signup').textContent.includes('never touches Yourgi'));
}

// Field list derived from the PRD, not from landing-page habit. §4 puts the sign-up
// notification on a Stripe webhook and puts service setup on a 1:1 call, so this page has no
// business collecting email, phone, dog count, or schedule before payment.
console.log('\n— form scope —');
{
  const w = await boot();
  const planStep = $(w, 'step-plan');
  const inputs = [...planStep.querySelectorAll('input, textarea, select')].map(i => i.id);
  ok('the form asks for exactly three fields', inputs.length === 3, inputs);
  ok('email, phone and zip — in that order', JSON.stringify(inputs) === JSON.stringify(['q-email', 'q-phone', 'q-zip']), inputs);
  ok('all three are marked required', ['q-email', 'q-phone', 'q-zip'].every(id => $(w, id).getAttribute('aria-required') === 'true'));

  // Days and dog count are still off this form — but as of the Figma pass they are self-serve at
  // booking, not questions for a concierge callback. See the Step 2 copy in #how.
  ok('no dog count — not asked at signup', !$(w, 'pets-val'));
  ok('no schedule box — not asked at signup', !$(w, 'q-schedule'));
  /* The Concierge IS the offer now, so the old "no callback promise" guard is obsolete: the Figma
     fineprint says the Concierge texts and/or calls to complete your profile. Pinned as the new
     truth — §8 gap 6 (can the team actually staff this?) is now load-bearing, not cosmetic. */
  ok('signup states the Concierge follow-up, per the Figma',
    /Concierge texts and\/or calls/i.test(planStep.textContent));
  ok('zip is explained as a coverage check', planStep.textContent.includes('before you pay'));
}

console.log('\n— plan switching —');
{
  const w = await boot();
  $(w, 'tiers').querySelector('[data-tier="weekdays"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('weekdays becomes checked', $(w, 'tiers').querySelector('[data-tier="weekdays"]').getAttribute('aria-checked') === 'true');
  ok('twice is deselected', $(w, 'tiers').querySelector('[data-tier="twice"]').getAttribute('aria-checked') === 'false');
  /* "daycare" used to be the sentinel for top-plan-only content, then "unlimited". The Figma's
     bullets (13 Aug 2026) use neither word, so the sentinel is now the top plan's own opening
     phrase. All this test needs is a string that appears on exactly one plan; what matters is that
     clicking a tier actually swaps the list and leaves nothing of the previous plan behind. */
  ok('benefits swapped to top-plan content', /all-you-need/i.test($(w, 'incl').textContent), $(w, 'incl').textContent);
  $(w, 'tiers').querySelector('[data-tier="weekly"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('benefits swapped again to the entry plan (2 items)', w.document.querySelectorAll('#incl li').length === 2);
  ok('no top-plan copy left behind', !/all-you-need/i.test($(w, 'incl').textContent), $(w, 'incl').textContent);
  /* The entry plan is no longer walks-only: it is "Two Anything", two of any service — and its
     bullet now enumerates the services rather than counting them. */
  ok('the entry plan shows its own bullet, not the top plan\'s',
    /walks, drop-ins, house sitting, daycare, or overnights/i.test($(w, 'incl').textContent) &&
    !/all-you-need|just more/i.test($(w, 'incl').textContent), $(w, 'incl').textContent);
  ok('Plan Selected tracked', w.__mp.some(([n, p]) => n === 'Plan Selected' && p.plan_tier === 'weekdays' && p.plan_price === 499));
}

// Validation only runs once there is a Stripe handoff to protect — with no links the CTA is inert
// by design (see the section below), so every one of these boots with links configured.
console.log('\n— validation —');
{
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('empty form blocks submit', vis(w, 'step-plan'));
  ok('all three errors shown', ['e-email', 'e-qphone', 'e-zip'].every(id => $(w, id).style.display === 'block'));
  ok('Validation Failed lists all three fields', w.__mp.some(([n, p]) => n === 'Validation Failed' && p.fields.length === 3));
  ok('nothing sent to Segment', w.__seg.length === 0);
  ok('no Stripe navigation', w.__nav.length === 0);

  fill(w, { zip: '80202', email: 'not-an-email' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('bad email blocks', vis(w, 'step-plan') && $(w, 'e-email').style.display === 'block');

  fill(w, { zip: '80202', phone: '1234567890' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('phone with a 1 area code rejected', vis(w, 'step-plan') && $(w, 'e-qphone').style.display === 'block');

  fill(w, { zip: '802' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('a short zip blocks', vis(w, 'step-plan') && $(w, 'e-zip').style.display === 'block');
}

// The lead is captured before the Stripe handoff so an abandoned checkout still tells us who was
// interested. It goes to Segment and Mixpanel ONLY — never to a staff channel. It is not a sale,
// and §4 keeps the staff notification on the Stripe webhook (docs/stripe-webhook.md).
console.log('\n— lead captured before the Stripe handoff —');
{
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  fill(w, { zip: '80202', email: 'lead@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('goes to Stripe', w.__nav.length === 1, w.__nav);
  ok('Segment identified by email', w.__seg.some(s => s.ev === 'Lead Captured' && s.email === 'lead@example.com'));
  ok('lead flagged in-market', w.__seg.some(s => s.ev === 'Lead Captured' && s.props.out_of_market === false));
  ok('lead carries the plan', w.__seg.some(s => s.ev === 'Lead Captured' && s.props.plan_tier === 'twice'));
  ok('captured BEFORE the jump, not after', w.__seg.length > 0 && w.__nav.length === 1);
  ok('nothing posted to any webhook', w.__fetches.length === 0, w.__fetches);
}

console.log('\n— phone formatting —');
{
  const w = await boot();
  const p = $(w, 'q-phone');
  p.value = '3035550142'; p.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('formats to (303) 555-0142', p.value === '(303) 555-0142', p.value);
  p.value = '13035550142'; p.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('strips leading country code 1', p.value === '(303) 555-0142', p.value);
}

console.log('\n— zip masking —');
{
  const w = await boot();
  const z = $(w, 'q-zip');
  z.value = 'abc80202999'; z.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('zip strips letters and caps at 5', z.value === '80202', z.value);
}

// The CTA connects to Stripe and nothing else — sign-up is completed on Stripe's page. Until the
// Payment Links exist, clicking it must do NOTHING. This replaces the dry-run success screen the
// page used to show: that screen said "You're in." when no subscription existed anywhere, and it
// fed invented conversions into the single number this experiment exists to measure.
// The page now ships with a placeholder link, so this state is reached by blanking the config —
// but the guard has to stay, because emptying the links is exactly what someone will do when the
// placeholder turns out to be wrong.
console.log('\n— CTA is inert when no Stripe link is configured —');
{
  const w = await boot({ links: '' });
  fill(w, { zip: '80202' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('stays on the plan step', vis(w, 'step-plan'));
  ok('no confirmation screen', !vis(w, 'step-confirm'));
  ok('no out-of-market screen', !vis(w, 'step-oom'));
  ok('no navigation to Stripe', w.__nav.length === 0);
  ok('nothing posted anywhere', w.__fetches.length === 0);
  ok('nothing sent to Segment', w.__seg.length === 0);
  ok('no checkout, lead or signup event tracked',
    !w.__mp.some(([n]) => /Checkout|Lead Captured|Subscription|Submission Failed/.test(n)),
    w.__mp.map(([n]) => n));
  ok('button is not left mid-submit',
    $(w, 'to-checkout').textContent === 'Get started' && !$(w, 'to-checkout').hasAttribute('disabled'),
    $(w, 'to-checkout').textContent);

  // "Do nothing" means nothing — an empty form must not even turn red.
  const w2 = await boot({ links: '' });
  $(w2, 'to-checkout').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('an empty form shows no errors either',
    ['e-email', 'e-qphone', 'e-zip'].every(id => $(w2, id).style.display !== 'block'));
  ok('no Validation Failed tracked', !w2.__mp.some(([n]) => n === 'Validation Failed'));

  // One flag, checked once, so wiring Stripe is a config edit and not a code edit.
  const src = fs.readFileSync(PAGE, 'utf8');
  ok('readiness is derived from the Stripe config, not a separate switch',
    /var STRIPE_READY = Object\.keys\(STRIPE_PAYMENT_LINKS\)\.every/.test(src));
  ok('all three links are required, not just one',
    /STRIPE_PAYMENT_LINKS\)\.every\(function\(k\)\{\s*return !!STRIPE_PAYMENT_LINKS\[k\];/.test(src));
  ok('the CTA returns early on that flag', /if\(!STRIPE_READY\) return;/.test(src));
  ok('no dry-run success path left anywhere', !/DRY RUN/.test(src) && !/Checkout Dry Run/.test(src));
}

console.log('\n— in-market with Stripe links configured —');
{
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  $(w, 'tiers').querySelector('[data-tier="weekly"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  fill(w, { zip: '75201', email: 'dallas@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('navigates to Stripe', w.__nav.length === 1, w.__nav);
  const url = w.__nav[0] || '';
  ok('uses the weekly link', url.startsWith('https://buy.stripe.com/test_w'), url);
  ok('client_reference_id carries plan and zip for the webhook', /client_reference_id=yg_weekly_75201_\d+/.test(url), url);
  ok('email prefilled into Stripe so they do not type it twice', url.includes('prefilled_email=dallas%40example.com'), url);
  ok('Checkout Started tracked', w.__mp.some(([n, p]) => n === 'Checkout Started' && p.plan_tier === 'weekly'));
  ok('plan stashed for the return trip', JSON.parse(w.sessionStorage.getItem('yg_plan')).tier === 'weekly');
}

// Each plan must hit its OWN Stripe link. A key typo here silently bills the wrong price.
console.log('\n— every plan routes to its own Stripe link —');
{
  for (const [tier, suffix] of [['weekly', 'w'], ['twice', 't'], ['weekdays', 'd']]) {
    const w = await boot({ links: 'https://buy.stripe.com/test_' });
    $(w, 'tiers').querySelector(`[data-tier="${tier}"]`).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    fill(w, { zip: '80202', phone: '3035550142', email: `${tier}@example.com` });
    $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await settle();
    ok(`${tier} -> ..._${suffix}`, (w.__nav[0] || '').startsWith(`https://buy.stripe.com/test_${suffix}`), w.__nav[0]);
  }
}

console.log('\n— out of market —');
{
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  fill(w, { zip: '90210', email: 'la@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('shows the out-of-market step', vis(w, 'step-oom'));
  ok('NEVER navigates to Stripe', w.__nav.length === 0, w.__nav);
  ok('copy says no charge was made', $(w, 'step-oom').textContent.includes('not been charged'));
  ok('lead still captured, flagged out_of_market', w.__seg.some(s => s.ev === 'Lead Captured' && s.props.out_of_market === true));
  ok('Out-of-Market Lead Captured tracked', w.__mp.some(([n]) => n === 'Out-of-Market Lead Captured'));
  ok('no webhook post for a refused sale', w.__fetches.length === 0, w.__fetches);
  // A refused sale is a dead end the visitor can come back from, so the CTA has to be usable again.
  // This used to be handled by a .finally() on the Teams post; now the button is only parked on the
  // one path that actually leaves the page.
  ok('CTA not left parked mid-submit',
    $(w, 'to-checkout').textContent === 'Get started' && !$(w, 'to-checkout').hasAttribute('disabled'),
    $(w, 'to-checkout').textContent);
}

console.log('\n— market gate coverage —');
{
  /* ALL SEVEN MARKET STATES ARE EXERCISED HERE, one zip each at minimum. Maine, New Hampshire
     and Washington were added 14 Aug 2026: the gate has always opened them, but nothing tested
     them and the page's copy named no city in any of the three, so a range could have been
     wrong — or removed — with every test still green. That is the same gap that let the copy
     and the gate disagree in the first place. Portland ME and Portland OR are both here on
     purpose; they sit in different ranges and the page used to name only "Portland". */
  const cases = [['80202', true, 'Denver CO'], ['75201', true, 'Dallas TX'], ['76102', true, 'Fort Worth TX'],
                 ['77002', true, 'Houston TX'], ['02108', true, 'Boston MA'], ['97205', true, 'Portland OR'],
                 ['04101', true, 'Portland ME'], ['03101', true, 'Manchester NH'], ['98101', true, 'Seattle WA'],
                 ['90210', false, 'Beverly Hills'], ['10001', false, 'NYC'], ['60601', false, 'Chicago']];
  for (const [zip, expected, name] of cases) {
    const w2 = await boot({ links: 'https://buy.stripe.com/test_' });
    fill(w2, { zip });
    $(w2, 'to-checkout').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
    await settle();
    // In market, the gate's only job is to let the Stripe handoff through; out of market it must
    // stop the handoff dead and say so.
    ok(`${name} ${zip} -> ${expected ? 'in' : 'out of'} market`,
      expected ? (w2.__nav.length === 1 && !vis(w2, 'step-oom')) : (vis(w2, 'step-oom') && w2.__nav.length === 0),
      { nav: w2.__nav.length, oom: vis(w2, 'step-oom') });
  }
}

// THE PAGE NOTIFIES NOBODY, AND THAT IS THE DESIGN.
//
// The staff notification lives on a Stripe webhook (docs/stripe-webhook.md), which fires only after
// Stripe has taken the money. This page fires before it, so the most it could ever say is "someone
// reached checkout" — and a channel mixing that with real payments is a channel where concierge
// onboards and coupons somebody who never paid.
//
// The second reason is a leak: a Power Automate URL carries its own SAS token and this file is
// public page source. Anyone holding it can post fake signups into the channel. So both the absence
// of the post and the absence of a URL are pinned here.
console.log('\n— the page posts to no channel of its own —');
{
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  $(w, 'tiers').querySelector('[data-tier="weekdays"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  fill(w, { zip: '80202', email: 'hook@example.com', phone: '3035550142' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('a completed submit posts nothing anywhere', w.__fetches.length === 0, w.__fetches);
  ok('but the lead is still recorded', w.__seg.some(s => s.ev === 'Lead Captured' && s.props.plan_tier === 'weekdays'));
  ok('and the visitor still reaches Stripe', w.__nav.length === 1, w.__nav);

  const src = fs.readFileSync(PAGE, 'utf8');
  ok('no TEAMS_WEBHOOK_URL config left in the page', !/TEAMS_WEBHOOK_URL/.test(src));
  ok('no notifyTeams function left in the page', !/notifyTeams/.test(src));
  ok('no Power Automate endpoint committed',
    !/powerplatform\.com|logic\.azure\.com|powerautomate\.com|webhook\.office\.com/.test(src));
  ok('no Adaptive Card built client-side', !/vnd\.microsoft\.card\.adaptive/.test(src));
  ok('the page makes no outbound POST at all', !/fetch\s*\(/.test(src));
  ok('the reason is written down where someone will find it',
    /STRIPE WEBHOOK/.test(src) && /docs\/stripe-webhook\.md/.test(src));
  // The lead signal must survive the removal — dropping the Teams post was not meant to cost us
  // the abandonment data, which for a willingness-to-pay test is most of the signal.
  ok('captureLead still feeds Segment', /function captureLead\(oom\)\{/.test(src) && /'Lead Captured'/.test(src));
}

// With the outbound POST gone, nothing in this handler can fail at runtime — so the error paths that
// existed to cover a failed post (response_not_ok, network_error) are gone too, rather than being
// left in place as unreachable branches that imply a failure mode the page no longer has.
// What remains is the missing-link hard stop. It is deliberately unreachable while STRIPE_READY
// demands all three links, so it is pinned at source level: it exists to make sure a future config
// slip can never be mistaken for a completed signup.
console.log('\n— the only failure path left is a missing Stripe link —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  ok('missing-link stop still present',
    /reason:'missing_payment_link'/.test(src) && /if\(!url\)\{/.test(src));
  ok('it shows the error instead of a confirmation screen',
    /reason:'missing_payment_link'\}\);\s*submitErr\.style\.display='block';/.test(src));
  ok('no dead post-failure branches left behind',
    !/response_not_ok/.test(src) && !/network_error/.test(src));
  ok('no promise chain left around a call that no longer exists',
    !/\.then\(function\(r\)\{/.test(src) && !/\.finally\(/.test(src));
  // The button is parked only on the path that leaves the page, and never un-parked, so a second
  // click cannot open a second checkout session while the navigation is in flight.
  ok('the CTA is parked only on the way to Stripe',
    /handOffToStripe\(url\);/.test(src) && !/btn\.removeAttribute\('disabled'\)/.test(src));
}

console.log('\n— return from Stripe —');
{
  const w = await boot({ search: '?checkout=success' });
  ok('success shows confirmation', vis(w, 'step-confirm'));
  ok('Subscription Started tracked as unverified', w.__mp.some(([n, p]) => n === 'Subscription Started' && p.verified === false));

  const w2 = await boot({ search: '?checkout=cancel' });
  ok('cancel shows the no-charge step', vis(w2, 'step-cancel'));
  ok('Checkout Abandoned tracked', w2.__mp.some(([n]) => n === 'Checkout Abandoned'));
  ok('cancel does NOT show confirmation', !vis(w2, 'step-confirm'));

  /* THE PATH A PAYING CUSTOMER ACTUALLY TAKES, which went unguarded until 14 Aug 2026.
     handleReturn() personalises #confirm-body only when sessionStorage.yg_plan is set, and the page
     writes that key immediately before the Stripe handoff — so plan.label is ALWAYS present on a
     return from real payment. Every assertion above boots without it and takes the fallback branch,
     which is why this screen could carry retired copy for a day without a single test going red.

     What it was carrying: "Someone from our team calls within a day to lock in your days and
     introduce your Pro." Both halves are claims the rest of the page had already retired — a
     concierge callback (Step 2 of #how has the customer booking) and a single assigned Pro (the FAQ
     answers that "Up to you"). The static paragraph was corrected on 13 Aug; this override was not,
     so the correction only ever reached people who typed the URL by hand.

     The rule this pins: the personalised branch may ADD facts checkable against a receipt — plan
     name, price — and may not introduce a promise. §8 gap 6 is still open on who issues the booking
     code and how fast, so no timing claim belongs here either. */
  const paid = await boot({ search: '?checkout=success', plan: { tier: 'twice', label: 'Five Anything', price: 99 } });
  const confirm = $(paid, 'confirm-body').textContent;
  ok('the paid screen names the plan just bought', /Five Anything plan is live at \$99\/mo/.test(confirm), confirm);
  /* RE-PINNED 14 Aug 2026 to the Figma's new paragraph (4086:396). The old anchors were "booking code
     comes next" and "concierge will find you someone", both of which that rewrite dropped. What this
     assertion is actually for has not changed: the JS must PREPEND to whatever the markup says, never
     replace it — replacing is how the retired copy survived a correction once already. So it anchors
     on the current paragraph's own tail rather than on any particular promise. */
  ok('and keeps the approved paragraph rather than replacing it',
    /in touch surprisingly fast\.$/.test(confirm), confirm);
  ok('no concierge-callback promise on the post-payment screen',
    !/calls within a day/i.test(confirm) && !/lock in your days/i.test(confirm), confirm);
  ok('no single-assigned-Pro promise on the post-payment screen',
    !/introduce your Pro/i.test(confirm), confirm);
  /* §8 gap 6: fulfilment is manual and nobody has committed to a turnaround. A timeframe here would
     be the one promise on this page made to someone who has already paid. */
  ok('and still promises no timing for the booking code',
    !/within (a|\d+) (day|days|hour|hours)/i.test(confirm), confirm);
}

console.log('\n— reset —');
{
  // Out of market is the one dead-end screen this page can still reach on its own, so it is the
  // one that has to hand people back a usable form.
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  $(w, 'tiers').querySelector('[data-tier="weekdays"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  fill(w, { zip: '90210' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('reached a dead-end screen to come back from', vis(w, 'step-oom'));
  $(w, 'restart2').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('back on the plan step', vis(w, 'step-plan'));
  ok('plan reset to Twice a Week', $(w, 'tiers').querySelector('[data-tier="twice"]').getAttribute('aria-checked') === 'true');
  ok('fields cleared', ['q-zip', 'q-email', 'q-phone'].every(id => $(w, id).value === ''));

  /* Every dead-end screen offers a way out — but only two of them offer a way BACK.
     #restart is gone (14 Aug 2026): the paid screen's button became "Browse providers" and navigates
     to the provider map instead of re-rendering the plan picker, so it is no longer a reset and no
     longer carries a reset id. The two screens below are the genuine dead ends — out of market and
     backed out — and both still have to hand someone a usable form. */
  for (const id of ['restart2', 'restart3']) ok(`${id} exists`, !!$(w, id));
  ok('the paid screen offers the map instead of a reset',
    !!$(w, 'browse-providers') && !$(w, 'restart'));
  ok('and its label says so', $(w, 'browse-providers').textContent === 'Browse providers');
}

/* The paid screen sends people into the live provider map, centred on the zip they typed.
   This is a real outbound navigation off a screen someone reaches after paying, so it gets the same
   treatment as the Stripe handoff: assert the URL, assert the frame breakout, and assert it degrades
   to something usable when the zip is missing. */
console.log('\n— browse providers drops into the map at their zip —');
{
  const w = await boot({ search: '?checkout=success', plan: { tier: 'twice', label: 'Five Anything', price: 99, zip: '80202' } });
  $(w, 'browse-providers').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('navigates to the provider map with the zip attached',
    w.__nav[0] === 'https://www.yourgi.com/app/search?zipcode=80202', w.__nav[0]);
  ok('Browse Providers Clicked tracked, with whether we had a zip',
    w.__mp.some(([n, p]) => n === 'Browse Providers Clicked' && p.has_zip === true));

  /* The zip only exists because checkout stashes it. Verified end to end rather than assumed, since
     the whole feature depends on that one key surviving the Stripe round trip. */
  const w2 = await boot({ links: 'https://buy.stripe.com/test_' });
  fill(w2, { zip: '80202' });
  $(w2, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('checkout stashes the zip for the return trip',
    JSON.parse(w2.sessionStorage.getItem('yg_plan')).zip === '80202');

  /* No stored zip — someone typing ?checkout=success, or returning in a new tab. The button must
     still go somewhere real; a dead button on the post-payment screen is the worst place for one. */
  const w3 = await boot({ search: '?checkout=success' });
  $(w3, 'browse-providers').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('without a zip it still reaches the map, unfiltered',
    w3.__nav[0] === 'https://www.yourgi.com/app/search', w3.__nav[0]);
  ok('and reports the missing zip rather than inventing one',
    w3.__mp.some(([n, p]) => n === 'Browse Providers Clicked' && p.has_zip === false));

  /* A malformed zip must not be passed through to the map as a query the app cannot geocode. */
  const w4 = await boot({ search: '?checkout=success', plan: { tier: 'twice', label: 'Five Anything', price: 99, zip: '8020' } });
  $(w4, 'browse-providers').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('a partial zip is dropped rather than sent', w4.__nav[0] === 'https://www.yourgi.com/app/search', w4.__nav[0]);

  const src = fs.readFileSync(PAGE, 'utf8');
  ok('the map helper breaks out of the review iframe, like the Stripe handoff does',
    /function goToMap\(zip\)\{[\s\S]*?if\(window\.top && window\.top!==window\) target=window\.top;/.test(src));
  ok('the zipcode parameter is documented as verified against the live app',
    /zipcode=80202 resolves to lat=39\.751907/.test(src));
}

// The public review link must not manufacture demand in the experiment's own numbers, and must
// never turn a reviewer into a Segment person record. Asserted at source level because the
// harness stubs both analytics libraries out.
// WCAG AA. The brand guide states its own contrast is unverified (references/visual.md), so this
// is the check that was missing. Update the table when a colour changes — a failure here means
// someone reintroduced text a low-vision user cannot read, on a page that takes money.
const srgb = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = h => { const v = h.replace('#', '').match(/../g).map(x => srgb(parseInt(x, 16))); return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2]; };
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((m, n) => n - m); return (hi + 0.05) / (lo + 0.05); };

console.log('\n— colour contrast (WCAG AA) —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  const WHITE = '#FFFFFF', BONE = '#FAF5EA', NAVY = '#09213C', YELLOW = '#FFBB45', SKY = '#7FAACD', FIELD = '#D9DFB6';
  // [what, foreground, background, minimum ratio]
  const pairs = [
    ['hero headline on yellow',      '#000000', YELLOW, 3.0],
    ['hero lede on yellow',          '#000000', YELLOW, 4.5],
    ['body on bone',                 '#000000', BONE,   4.5],
    ['field label on bone',          '#4a4a46', BONE,   4.5],
    ['plan blurb on white',          '#444444', WHITE,  4.5],
    ['per-month suffix on white',    '#666666', WHITE,  4.5],
    ['fineprint on bone',            '#666666', BONE,   4.5],
    ['per-walk price on white',      '#2f6b2b', WHITE,  4.5],
    ['savings text on field green',  '#2c3a1c', FIELD,  4.5],
    ['step eyebrow on white',        '#41709B', WHITE,  4.5],
    ['review label on white',        '#41709B', WHITE,  4.5],
    ['review stars on white',        '#B87D0A', WHITE,  3.0],
    ['error message on bone',        '#c0392b', BONE,   4.5],
    ['required asterisk on bone',    '#9a3b1e', BONE,   4.5],
    ['muted table cell on white',    '#767676', WHITE,  4.5],
    ['table body on white',          '#333333', WHITE,  4.5],
    ['closing CTA copy on sky',      '#000000', SKY,    4.5],
    ['footer legal on navy',         '#b7ae9e', NAVY,   4.5],
    ['footer body on navy',          BONE,      NAVY,   4.5],
  ];
  let worst = null;
  for (const [what, fg, bg, min] of pairs) {
    const r = contrast(fg, bg);
    if (!worst || r < worst[1]) worst = [what, r];
    ok(`${what} — ${r.toFixed(2)}:1 (needs ${min})`, r >= min);
  }
  console.log(`       tightest passing pair: ${worst[0]} at ${worst[1].toFixed(2)}:1`);

  // The audited values must actually be the ones the page uses. These guards replace the old
  // '--sky-ink' assertion: that token was a darkened Sky Blue invented so eyebrows could clear
  // AA, but p21 says text on Bone is never Sky Blue at all. The rule outranked the workaround,
  // so the guard is inverted rather than deleted — the token must now be ABSENT.
  // The audited values must actually be the ones the page uses.
  ok('page defines the darkened sky token', src.includes('--sky-ink:#41709B'));
  ok('brand Sky is no longer used as small text', !/color:var\(--sky\)/.test(src), 'still using --sky for text');
  // Declarations only — the source comments name the old values on purpose, to explain why they went.
  const declared = (src.match(/color:\s*#[0-9a-f]{3,6}/gi) || []).map(d => d.split(':')[1].trim().toLowerCase());
  ok('no low-contrast grey is declared any more',
    !declared.some(c => ['#777777', '#777', '#999999', '#999', '#f1b942'].includes(c)),
    declared.filter(c => ['#777777', '#777', '#999999', '#999', '#f1b942'].includes(c)));
}

/* ===== TYPOGRAPHY ==============================================================================
 * Two things, and the second is here because it already went wrong once.
 *
 * NATIONAL 2 is Yourgi's real typeface; Oswald and Archivo are stand-ins for it. The card's
 * benefit bullets are the first thing on this page set in the real face (Lauren, 13 Aug 2026), so
 * the guard is that they still are — and that the files behind it are Yourgi's licensed webfonts
 * rather than the `-test-` builds sitting next to them in the same Webflow stylesheet. Those are
 * Klim's trial fonts. Shipping one is a licensing problem, and the filenames differ by six
 * characters, which is exactly the kind of thing a test should be reading instead of a person.
 *
 * THE SELECTOR LEAK is the second. `.hero .incl` looks like it means "the hero's benefit list",
 * and it does not: the signup card sits inside <header class="hero">, so it also matched #incl and
 * set the card's bullets to 16px bold. It shipped. The fix was a dedicated .incl-hero class, and
 * the guard is that nobody reintroduces the descendant selector — including on the other elements
 * the card and the hero column have in common.
 */
console.log('\n— typography —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  ok('National 2 is loaded from Yourgi\'s own CDN', /@font-face\{font-family:'National 2'/.test(src));
  ok('the licensed builds are used, never Klim\'s -test- trial fonts',
    /national-2-regular\.woff2/.test(src) && !/national-2[a-z-]*-test-/.test(src),
    src.match(/national-2[a-z-]*-test-[a-z]+\.\w+/g));
  ok('the card\'s benefit bullets are National 2 Regular 14',
    /#incl li\{font-family:'National 2'[^}]*font-size:14px[^}]*font-weight:400/.test(src));
  /* NATIONAL 2 IS NOW THE PAGE DEFAULT, not a one-element exception. Frame 4077:222 was migrated
     off Oswald entirely on 13 Aug 2026, so the guard is that the stand-in has not crept back into
     the body or the display face. */
  ok('body text defaults to National 2', /body\{margin:0; font-family:'National 2'/.test(src));
  ok('h1/h2 are National 2 Condensed', /h1,h2,\.display\{font-family:'National 2 Condensed'/.test(src));
  ok('Oswald is no longer set on anything',
    !/font-family:'Oswald'/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
    src.match(/[^;{]*font-family:'Oswald'[^;}]*/g));
  /* Archivo survives in exactly three places in the frame, and they are easy to "tidy" away by
     someone finishing the migration: the comparison table's row labels (4077:310), the footer
     tagline (4077:422), and the bold lead-in of the footer Guarantee line (4077:424). Pinned so
     that removing them is a decision rather than a sweep. */
  const archivoHoldouts = (src.match(/font-family:'Archivo',(?:system-ui|sans-serif)/g) || []).length;
  ok('the three Archivo holdouts from the frame are still Archivo', archivoHoldouts === 3, archivoHoldouts);
  /* The hero list is scoped by class. `.hero .incl` reaches into the card because the card is
     inside the hero element — if this fails, the card's bullets have silently changed size.
     Comments are stripped first: the note explaining this bug necessarily quotes the selector
     that caused it, and a guard that its own explanation trips is a guard nobody keeps. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('the hero list is scoped by class, not by descending from .hero',
    /\.incl-hero\{/.test(code) && !/\.hero\s+\.incl/.test(code),
    code.match(/\.hero\s+\.incl[^{]*\{[^}]*\}/g));
  ok('the hero list carries that class in the markup', /<ul class="incl incl-hero">/.test(src));
}

console.log('\n— keyboard and screen-reader support —');
{
  // Links configured, so the error-handling assertions below have a live submit to exercise.
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  const src = fs.readFileSync(PAGE, 'utf8');

  // Choosing one of three plans is a radio group, not three independent toggles.
  ok('plan picker is a radiogroup', $(w, 'tiers').getAttribute('role') === 'radiogroup');
  const radios = [...w.document.querySelectorAll('#tiers .tier')];
  ok('each plan is a radio', radios.every(r => r.getAttribute('role') === 'radio'));
  ok('no stale aria-pressed left behind', !src.includes('aria-pressed'));
  ok('roving tabindex — only the checked plan is tabbable',
    radios.filter(r => r.tabIndex === 0).length === 1);
  ok('the tabbable one is the checked one',
    radios.find(r => r.tabIndex === 0)?.getAttribute('aria-checked') === 'true');

  // Arrow keys must move the selection, as aria-checked promises.
  radios[1].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  ok('ArrowRight moves to the next plan', radios[2].getAttribute('aria-checked') === 'true');
  radios[2].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  ok('and wraps around to the first', radios[0].getAttribute('aria-checked') === 'true');
  radios[0].dispatchEvent(new w.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  ok('End jumps to the last plan', radios[2].getAttribute('aria-checked') === 'true');
  ok('still exactly one checked after keyboard use',
    radios.filter(r => r.getAttribute('aria-checked') === 'true').length === 1);

  // Errors have to be announced, not just turn red.
  ok('every error message is a live region',
    ['e-email', 'e-qphone', 'e-zip'].every(id => $(w, id).getAttribute('role') === 'alert'));
  ok('every field points at its error text',
    [['q-email', 'e-email'], ['q-phone', 'e-qphone'], ['q-zip', 'e-zip']]
      .every(([f, e]) => $(w, f).getAttribute('aria-describedby') === e));

  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('invalid fields are marked aria-invalid',
    ['q-email', 'q-phone', 'q-zip'].every(id => $(w, id).getAttribute('aria-invalid') === 'true'));
  ok('focus lands on the first field needing a fix', w.document.activeElement?.id === 'q-email',
    w.document.activeElement?.id);

  fill(w, { zip: '80202', email: 'a@b.com' });
  ok('fixing a field clears aria-invalid', $(w, 'q-email').getAttribute('aria-invalid') === 'false');

  // Ratings are meaningful content, so they cannot live only in a gold glyph.
  /* THE TESTIMONIALS ARE GONE (13 Aug 2026). The Figma hides the review block and puts the "Why
     Yourgi Plus?" copy band in its place, so there are no star ratings left to make accessible.
     These two guards are inverted rather than deleted: if reviews come back, they must come back
     with the text equivalent, and this will fail until they do. README decision #10 (replace the
     boarding/cat reviews with dog-walking ones) is moot while the block is absent. */
  ok('no review stars remain to be hidden from assistive tech',
    w.document.querySelectorAll('.review-stars').length === 0);
  ok('and no orphaned rating text is left behind',
    (w.document.body.textContent.match(/Rated 5 out of 5/g) || []).length === 0);

  // iOS Safari zooms the page when focusing an input under 16px.
  ok('inputs are 16px so iOS does not zoom mid-form', /input,select,textarea\{[^}]*font-size:16px/.test(src));

  // Heading order: h1 then h2, no skipped level.
  const levels = [...w.document.querySelectorAll('h1,h2,h3')].map(h => +h.tagName[1]);
  ok('starts at a single h1', levels.filter(l => l === 1).length === 1);
  ok('no heading level is skipped', levels.every((l, i) => i === 0 || l - levels[i - 1] <= 1), levels.join(','));
}

console.log('\n— preview traffic is kept out of production analytics —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  ok('a production host gate exists', /YG_IS_PROD\s*=\s*\/\(\^\|\\\.\)yourgi\\\.com\$\/i\.test\(location\.hostname\)/.test(src));
  ok('test_mode is driven by that gate, not just localhost', /mpIsTestMode\s*=\s*!YG_IS_PROD/.test(src));
  ok('test_mode no longer hardcodes localhost only', !/mpIsTestMode\s*=\s*location\.hostname === 'localhost'/.test(src));
  ok('Segment is suppressed entirely off production', /if \(!YG_IS_PROD\) \{[\s\S]{0,220}?return;/.test(src));
  ok('the Segment guard sits BEFORE identify()',
    src.indexOf('if (!YG_IS_PROD)') < src.indexOf('window.analytics.identify(email, traits)'));

  // Sanity-check the regex itself against the hosts that actually matter.
  const isProd = h => /(^|\.)yourgi\.com$/i.test(h);
  ok('www.yourgi.com counts as production', isProd('www.yourgi.com'));
  ok('yourgi.com counts as production', isProd('yourgi.com'));
  ok('the GitHub Pages review link does NOT', !isProd('lpyourgi.github.io'));
  ok('localhost does NOT', !isProd('localhost'));
  ok('a lookalike domain does NOT', !isProd('notyourgi.com'));
}

// Copy edits touch JS string literals. An apostrophe in the wrong place takes the whole page
// down silently — the HTML still renders, the script just never runs. Catch it directly.
console.log('\n— page script is syntactically valid —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  const blocks = src.match(/<script>([\s\S]*?)<\/script>/g) || [];
  ok('found the page script blocks', blocks.length >= 1, blocks.length);
  let bad = null;
  for (const b of blocks) {
    const code = b.replace(/^<script>/, '').replace(/<\/script>$/, '');
    try { new Function(code); } catch (e) { bad = e.message; break; }
  }
  ok('every inline script parses', bad === null, bad);

  // An unescaped apostrophe inside a single-quoted JS string is the specific way this breaks.
  const w = await boot();
  ok('the script actually ran (benefits rendered)', w.document.querySelectorAll('#incl li').length > 0);
  /* The per-visit slots were this smoke test's subject until they were removed to match the Figma
     tile. The comparison table is the other thing the inline script builds from config, and it
     prints prices — so it still catches a script that parsed but threw partway through. */
  ok('the script actually ran (compare table built)',
    w.document.querySelectorAll('#cmp-body tr').length === 4 &&
    $(w, 'cmp-p-twice').textContent === '$99/mo');
}

// THE PAGE AND THE STRIPE MANIFEST MUST NOT DRIFT.
//
// stripe/plans.json is what gets created in Stripe. index.html is what the customer is told. If the
// two disagree, somebody is billed a price they were never shown — the most expensive failure this
// project has available, and one that looks like nothing at all until a receipt arrives. Neither
// file is allowed to move without the other.
// ONE SET OF PLAN NAMES, EVERYWHERE.
//
// The plans were renamed once already and the rename only landed on the cards: the comparison
// table still said "Once a Week / Twice a Week / Weekdays" — the table people actually use to
// choose — and `state` carried a hard-coded label, so anyone who accepted the pre-selected plan
// without clicking a card was told "Your Twice a Week plan is live" on the confirmation screen,
// after paying. Both are pinned here so the next rename can't half-land.
/* THE HERO MAY NOT PROMISE WHAT THE FAQ DENIES.
 *
 * A Pack booking does not guarantee a particular Pro — the FAQ says so, and the plan bullets were
 * stripped of that claim three separate times before it was finally left out. The headline made it
 * a fourth time ("Stop re-hiring a stranger every week") and went unnoticed for weeks, because
 * nothing checked the largest type on the page against its own fine print.
 *
 * This is the check. If the match model is ever documented and a plan really does hold someone to
 * your days (Gap 3), this test is what you update first — deliberately, with the FAQ in the same
 * commit — rather than discovering the two have drifted apart again.
 */
/* THE PAGE MAY NOT PROMISE WHAT THE T&Cs DON'T GIVE.
 *
 * Two claims were reconciled against Yourgi_Pack_Terms_and_Conditions_DRAFT_5 on 13 Aug 2026:
 *
 * 1. REFUNDS. The FAQ used to say that if you hadn't used the plan we'd "sort you out", and that if
 *    you'd used part of it we'd "work out what's fair". That was written from an intent before the
 *    T&Cs existed. §12.1 says the opposite — fees are non-refundable and part-months and unused
 *    allowance are not credited — with a closed list of exceptions in §12.2.
 *
 * 2. "THE LINK ON YOUR RECEIPT". Two places told people to cancel from a link in their Stripe
 *    receipt. Legal's own Annex A (row 11) states Stripe receipts do NOT contain one by default; it
 *    has to be deliberately surfaced, and a portal session link expires. So the page was directing
 *    people to something that isn't there — the kind of promise that fails on first contact.
 *
 * Both are the sentences a customer quotes back at us, so they're pinned rather than trusted. */
console.log('\n— money claims match the T&Cs —');
{
  const w = await boot();
  const faq = $(w, 'faq').textContent;
  const manifest = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'stripe', 'plans.json'), 'utf8'));
  const stripeTerms = manifest.shared.payment_link.custom_text.terms_of_service_acceptance.message;

  ok('the refund question is answered at all', /Can I get a refund\?/i.test(faq), 'refund FAQ missing');
  ok('and the answer leads with non-refundable, per §12.1',
    /aren.t refundable/i.test(faq) && /don.t refund part-months|days you didn.t use/i.test(faq), 'refund answer softened');
  ok('it does not promise a refund for an unused plan',
    !/(sort you out|work out what.s fair)/i.test(faq), 'the pre-T&C intent wording is back');
  ok('the §12.2 exceptions are still offered', /cover your area/i.test(faq) && /end the beta early/i.test(faq));

  // Neither the page nor the Stripe checkout may point at a receipt link that Stripe doesn't add.
  ok('the FAQ does not send people to a link on their receipt', !/link on your receipt/i.test(faq), faq.match(/[^.]*link on your receipt[^.]*/i)?.[0]);
  ok('the Stripe terms text does not either', !/link on your receipt/i.test(stripeTerms), stripeTerms);
  ok('and it still states cancellation takes effect at period end',
    /end of the month you.ve paid for/i.test(stripeTerms), stripeTerms);

  /* BOTH ROUTES FOR PLAN CHANGES (Lauren's call, 13 Aug 2026), so both have to stay described.
     The page previously sent everyone to the Concierge while the Stripe portal was configured for
     self-serve — the page and the billing system describing different products. It also described
     period-end downgrades while the portal is set to create_prorations, which lands changes
     immediately. If proration_behavior ever changes, the second assertion should fail. */
  ok('plan changes offer self-serve AND the Concierge',
    /Can I change plans\?/i.test(faq) && /billing page/i.test(faq) && /Concierge/i.test(faq), 'one of the two routes is missing');
  ok('and describe prorated, immediate changes rather than period-end ones',
    /straight away/i.test(faq) && /comes off your next bill/i.test(faq)
      && !/benefits until the end of your billing cycle/i.test(faq),
    faq.match(/Can I change plans\?[\s\S]{0,260}/i)?.[0]);
}

console.log('\n— the hero does not claim a Pro the plan cannot promise —');
{
  const w = await boot();
  const hero = w.document.querySelector('h1').textContent;
  const faq = $(w, 'faq').textContent;

  /* The wording moved from denial ("Not necessarily... not for one particular person") to choice
     ("Up to you. You can choose the same Provider everytime or try someone new"). Either way the
     page must not promise that ONE Pro is assigned to a plan, which is what the guard protects. */
  ok('the FAQ leaves Provider continuity as the customer\'s choice, not a promise',
    /up to you/i.test(faq) && /choose the same Provider/i.test(faq), 'FAQ no longer frames continuity as a choice');
  ok('so the hero claims no person, only the arranging',
    !/stranger|same pro|your pro|one pro|every week/i.test(hero), hero);
  ok('and the hero still names something the plan actually removes',
    /arrang|book|month|plan|care/i.test(hero), hero);
  // The lede was always honest — it sells prepaid coverage, never a named human. Guard it too, since
  // it sits directly under the headline and is the next place the claim would creep back in.
  const lede = w.document.querySelector('.lede').textContent;
  ok('the lede makes no continuity claim either',
    !/same (pro|person|walker)|your own pro|one pro/i.test(lede), lede);
}

console.log('\n— the plans are called the same thing everywhere —');
{
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  const cards = [...w.document.querySelectorAll('#tiers .tier')].map(t => t.dataset.label);
  const table = [...w.document.querySelectorAll('.compare thead .cmp-plan')].map(s => s.textContent.trim());
  ok('comparison table uses the plan cards\' names, in order',
    JSON.stringify(table) === JSON.stringify(cards), { table, cards });

  const src = fs.readFileSync(PAGE, 'utf8');
  // Visible copy only — textContent on <body> would include the inline script's own source, so a
  // developer comment mentioning an old name would fail this for no reason.
  const visible = (() => {
    const clone = w.document.body.cloneNode(true);
    clone.querySelectorAll('script,style').forEach(n => n.remove());
    return clone.textContent;
  })();
  ok('no pre-rename plan names left in customer-facing copy',
    !/(Once a Week|Twice a Week)/.test(visible),
    (visible.match(/Once a Week|Twice a Week/g) || []).slice(0, 3));

  // The "most picked" flag has to name the plan that is actually pre-selected, or the page is
  // recommending one thing and selecting another.
  const flagged = w.document.querySelector('.compare thead .best .cmp-plan')?.textContent.trim();
  const selected = w.document.querySelector('#tiers .tier[aria-checked="true"]')?.dataset.label;
  ok('the flagged plan is the one pre-selected', flagged === selected, { flagged, selected });
  ok('the flag reads the same on the card and in the table',
    w.document.querySelector('.tier-badge')?.textContent.trim() ===
    w.document.querySelector('.cmp-flag')?.textContent.trim(),
    { card: w.document.querySelector('.tier-badge')?.textContent.trim(),
      table: w.document.querySelector('.cmp-flag')?.textContent.trim() });

  // The default path: accept the pre-selected plan, never click a card, and pay.
  fill(w, { zip: '80202', email: 'default@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  const stashed = JSON.parse(w.sessionStorage.getItem('yg_plan') || '{}');
  ok('the plan stashed for the confirmation screen is the one on the card',
    stashed.label === selected, { stashed: stashed.label, card: selected });
  ok('and its price is the card\'s price', stashed.price === +w.document
    .querySelector('#tiers .tier[aria-checked="true"]').dataset.price, stashed.price);
  ok('state is seeded from the markup, not hard-coded',
    /label:el\.dataset\.label/.test(src) && !/label:'Twice a Week'/.test(src));
}

console.log('\n— Stripe manifest matches the page —');
{
  const w = await boot();
  const manifest = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'stripe', 'plans.json'), 'utf8'));
  const onPage = [...w.document.querySelectorAll('#tiers .tier')].map(t => ({
    tier: t.dataset.tier, price: +t.dataset.price, label: t.dataset.label,
  }));

  ok('manifest covers every plan on the page', manifest.plans.length === onPage.length,
    `manifest ${manifest.plans.length}, page ${onPage.length}`);
  ok('tier keys match, in order',
    JSON.stringify(manifest.plans.map(p => p.tier)) === JSON.stringify(onPage.map(p => p.tier)),
    { manifest: manifest.plans.map(p => p.tier), page: onPage.map(p => p.tier) });

  for (const [i, plan] of manifest.plans.entries()) {
    const page = onPage[i] || {};
    ok(`${plan.tier}: price matches the page ($${plan.price_usd})`, plan.price_usd === page.price,
      { manifest: plan.price_usd, page: page.price });
    ok(`${plan.tier}: label matches the page ("${plan.label}")`, plan.label === page.label,
      { manifest: plan.label, page: page.label });
    // Stripe takes cents. A dollars/cents slip here is a 100x billing error.
    ok(`${plan.tier}: unit_amount is the price in cents`, plan.unit_amount === plan.price_usd * 100,
      { unit_amount: plan.unit_amount, expected: plan.price_usd * 100 });
    ok(`${plan.tier}: product description is the page's own blurb`,
      w.document.body.textContent.includes(plan.product.description), plan.product.description);
    // The line above the Subscribe button is the last thing read before committing. A stale amount
    // here is a false statement at the exact moment money moves, so it has to name this plan's price
    // and no other — and both mentions of it, since it states the charge today and the renewal.
    const stated = (plan.submit_message.match(/\$[\d,]+(?:\.\d{2})?/g) || []);
    ok(`${plan.tier}: submit line names $${plan.price_usd} and nothing else`,
      stated.length === 2 && stated.every(s => s === `$${plan.price_usd}.00`),
      { message: plan.submit_message, found: stated });
  }

  // The default plan is the one most people buy, so the manifest has to agree with the page on which.
  const manifestDefault = manifest.plans.find(p => p.default_on_page)?.tier;
  const pageDefault = w.document.querySelector('#tiers .tier[aria-checked="true"]')?.dataset.tier;
  ok('manifest and page agree on the default plan', manifestDefault === pageDefault,
    { manifest: manifestDefault, page: pageDefault });

  // These are the two settings the runbook calls out as easy to forget and costly to miss.
  ok('phone collection is on (the page made phone optional)',
    manifest.shared.payment_link.phone_number_collection.enabled === true);
  ok('after-payment redirect carries ?checkout=success',
    /\?checkout=success$/.test(manifest.shared.payment_link.after_completion.redirect.url),
    manifest.shared.payment_link.after_completion.redirect.url);

  // Nothing in our manifest may point at Chris's feasibility-test objects.
  const raw = fs.readFileSync(path.join(HERE, '..', 'stripe', 'plans.json'), 'utf8');
  ok('does not reuse the membership-c-test objects',
    !/prod_V19cNesnBYgwPl|price_1U17JRIgv5bQybH7nXIy7G6O|plink_1U17Jm/.test(
      raw.replace(/"_readme"[\s\S]*?\],/, '')),
    'manifest references an object from Chris\'s test');
  // WAS 'manifest is flagged as unapproved pricing', matching /prices not approved/i. The prices were
  // approved by Lauren on 14 Aug 2026, so that string is gone and asserting it would fail on a fact
  // that is simply no longer true. The REASON for the test outlives the reason for the string: these
  // are sandbox objects, and approved pricing does not make them production ones. So the assertion now
  // guards what still needs guarding — that the status keeps saying DRAFT out loud.
  ok('manifest is flagged as a draft, not production',
    /draft/i.test(manifest.shared.metadata.status), manifest.shared.metadata.status);
}

console.log('\n— no secrets in page source —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  ok('no Stripe secret key', !/sk_(live|test)_/.test(src));
  // A Payment Link is public by design, so committing one is not a leak — but a publishable key
  // or a Stripe.js integration would mean this page had started handling cards itself.
  ok('no publishable key — card entry stays on Stripe', !/pk_(live|test)_/.test(src));
  ok('no Stripe.js on the page', !/js\.stripe\.com/.test(src));
  ok('concierge webhook NOT reused', !src.includes('powerplatform.com'));
  // The restricted key the Stripe webhook flow uses lives in Power Automate, never here.
  ok('no restricted Stripe key', !/rk_(live|test)_/.test(src));
  ok('no Stripe webhook signing secret', !/whsec_/.test(src));
}

// The page ships with ONE placeholder Payment Link reused for all three plans. Both facts are
// temporary and both are dangerous if they reach traffic, so they are pinned here: when the real
// per-plan links land, these assertions fail and force someone to look at this section.
/* WAS "the shipped Stripe link is a flagged placeholder" — retired 12 Aug 2026.
 *
 * That block pinned the details of a single shared LIVE $50/mo Payment Link the page used to ship
 * with: that exactly one URL existed in the source, that it was declared once and reused three
 * times, that the comments named its real charge and its live mode. All of it was correct and
 * useful while that link was there, and all of it became false the moment the link was blanked —
 * leaving four permanently red assertions that asserted the presence of something deliberately
 * deleted. Four standing failures are worse than none: they train everyone to skim the summary
 * line, and the next real regression hides among them.
 *
 * What replaces it guards the state that actually ships now — no link configured, CTA inert, and
 * nothing live in the source — plus the one property the old block was really protecting: that
 * whatever link is configured, the chosen plan still rides along for reconciliation.
 */
/* REWRITTEN 13 Aug 2026, when the real links landed — the event the note above anticipated.
 *
 * This block used to assert the shipped config was EMPTY: no URL in the source, three TODOs, a
 * dead CTA. All of that was the right guard for a page with nothing to link to, and all of it went
 * false the moment `stripe/create-plans.mjs --go` produced three Payment Links. Asserting the
 * absence of something now present would leave standing failures, which is the exact trap the
 * retired block above describes.
 *
 * What replaces it guards the property that actually matters now, and it is a sharper one than
 * "empty": THE COMMITTED LINKS MUST BE TEST MODE. gh-pages is served publicly. A live link here
 * would let anyone who finds the review URL be charged real money — on an uncapped top plan whose
 * exposure was accepted (14 Aug 2026) on the understanding that nobody could actually buy it yet.
 * Which has happened on this repo once already, with a shared live $50/mo link. Test-mode links
 * are safe to publish; that difference is one substring, so a test reads it rather than a person.
 *
 * This used to say "at prices nobody has approved". The prices were approved on 14 Aug 2026 and the
 * guard did not get one bit less necessary, which is the tell that the old reasoning was wrong: what
 * protects the money is the `test_` prefix, never the approval status of the number beside it.
 */
console.log('\n— the shipped Stripe links are real, per-plan, and test mode —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  const urls = [...new Set(src.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+/g) || [])];
  ok('three Payment Links are committed, one per plan', urls.length === 3, urls);
  /* THE GUARD THIS BLOCK EXISTS FOR. A live Payment Link is buy.stripe.com/<id>; a test-mode one
     carries test_. If this ever fails, the public review page is taking real payments — treat it
     as an incident, not a failing test. */
  /* NARROWED 14 AUG 2026, DELIBERATELY, AND IT IS WEAKER THAN WHAT IT REPLACED.
     Lauren swapped in live-mode links that day, after all three were opened against Stripe and read
     back the right product and price. So "every link is test mode" is now false on purpose, and a
     permanently-red suite would get ignored — which is worse than a narrower guard.

     What this still catches is the case that actually hurt this repo: someone pasting a live link in
     WITHOUT knowing. A deliberate swap comes with the block comment above STRIPE_PAYMENT_LINKS; an
     accidental one does not. That is a weaker signal than a URL substring and it is worth being
     honest about — it can be defeated by copying the comment along with the link.

     WHAT IS NO LONGER GUARDED AT ALL, and needs a human: gh-pages is served publicly, and this file
     now contains links that take real money. Nothing in this suite can see which branch it is on.
     If gh-pages is ever updated from main while these links are live, the review URL starts charging
     real people — the exact incident from 12 Aug 2026, with a bigger top-line number. That is a
     branch/publishing decision, not a test. */
  const liveDeliberate = /⚠️ THESE ARE LIVE-MODE LINKS AS OF 14 AUG 2026\. THEY TAKE REAL MONEY\./.test(src);
  ok('links are test mode, OR live mode is explicitly declared above the link map',
    urls.every(u => u.startsWith('https://buy.stripe.com/test_')) || liveDeliberate,
    urls.filter(u => !u.startsWith('https://buy.stripe.com/test_')));
  ok('a live-mode build says so where the links are, not only in a commit message',
    urls.every(u => u.startsWith('https://buy.stripe.com/test_')) || liveDeliberate,
    'live links present with no declaration above STRIPE_PAYMENT_LINKS');
  ok('a live-mode build records that public surfaces now charge real money',
    urls.every(u => u.startsWith('https://buy.stripe.com/test_'))
      || /ANYWHERE THIS PAGE IS REACHABLE NOW CHARGES REAL MONEY/.test(src),
    'live links present without the public-surface warning');
  /* One shared link across three plans is the specific failure that shipped before: all three
     cards handed off to a single $50/mo checkout, so two of the three charged the wrong price. */
  ok('no link is shared between plans — each plan has its own',
    new Set(['weekly', 'twice', 'weekdays'].map(t =>
      src.match(new RegExp(`${t}:\\s*'([^']+)'`))?.[1])).size === 3);
  /* The blank fallback stays, and stays blank. It is what parks the CTA when the sandbox expires
     or the links are pulled — the honest failure, rather than a button that 404s. */
  ok('the blank placeholder constant survives as the park-the-button fallback',
    /var STRIPE_PLACEHOLDER_LINK = '';/.test(src));
  /* The history is kept in the source on purpose — a live link reached a public review branch once,
     and the comment explaining how is the reason it will not happen twice. */
  ok('the source still records why it was blanked', /LIVE-mode Payment Link/.test(src));
  ok('and records how to tell a live link from a test one before pasting',
    /a test-mode link carries a test_ prefix/.test(src));
  /* WAS: an assertion that the source says "EXPIRES 19 AUG 2026". That expiry was real while the
     sandbox was unclaimed and it was cleared by claiming it on 13 Aug 2026, so the guard was
     pinning a date that had stopped being true — and pinning it in the one place a reader would
     trust. Replaced rather than deleted, because the thing it was protecting still matters: the
     source has to explain what happens when these links stop resolving, or they become a silent
     404 that nobody can diagnose from the page. Now it checks for that explanation instead of
     for a specific date, so it cannot rot the same way again. */
  // \s+ across the phrase: this lives in a wrapped block comment, so a reflow must not fail it.
  ok('the source explains what happens when these links stop resolving',
    /blank\s+the\s+links\s+and\s+STRIPE_READY\s+parks\s+the\s+button/.test(src));
  /* The trap that caused the contradiction, kept where the next person will hit it. */
  ok('and warns that stripe config --list cannot tell you if the sandbox is claimed',
    /DO NOT RE-DERIVE THIS FROM `stripe config --list`/.test(src));

  // With links configured the CTA does its one job: hand off to Stripe.
  const w = await boot();                 // the real, shipping config
  $(w, 'tiers').querySelector('[data-tier="weekdays"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  fill(w, { zip: '80202', email: 'placeholder@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  /* Mode-agnostic on purpose since the 14 Aug 2026 live swap. This assertion is about the CTA
     reaching a Stripe Payment Link at all; whether that link is test or live is the dedicated
     guard's job above, and asserting it twice meant a deliberate swap failed here for a reason
     this block was never about. */
  ok('the CTA now hands off to Stripe', /^https:\/\/buy\.stripe\.com\/(test_)?[A-Za-z0-9]+/.test(w.__nav[0] || ''), w.__nav[0]);
  ok('the handoff uses the chosen plan\'s own link',
    (w.__nav[0] || '').startsWith(src.match(/weekdays:\s*'([^']+)'/)[1]), w.__nav[0]);
  // The page still never invents a subscription of its own — Stripe's redirect is what shows that.
  ok('and shows no confirmation screen of its own', !vis(w, 'step-confirm'));

  /* The property the retired block existed to protect, kept and tested against a seeded config:
     whatever link is configured, the plan the visitor chose must ride along in client_reference_id.
     It is the only record of what they picked once they are on Stripe's side. */
  const w2 = await boot({ links: 'https://buy.stripe.com/test_' });
  $(w2, 'tiers').querySelector('[data-tier="weekdays"]').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
  fill(w2, { zip: '80202', email: 'placeholder@example.com' });
  $(w2, 'to-checkout').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('a configured link still carries the chosen plan for reconciliation',
    /client_reference_id=yg_weekdays_80202_\d+/.test(w2.__nav[0] || ''), w2.__nav[0]);
}

// Stripe Checkout refuses to render inside a third-party iframe — it hangs on its loading skeleton.
// preview.html frames this page, so without a breakout the CTA looks broken to every reviewer.
console.log('\n— the Stripe handoff escapes the review iframe —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  /* TWO NAVIGATION HELPERS NOW, NOT ONE (14 Aug 2026). goToMap() joined handOffToStripe() when the
     paid screen's button started sending people to the provider map. The point of this assertion is
     unchanged — no bare `location.href=` may bypass a named helper that handles the iframe breakout —
     so it counts the assignments and pins each one to its helper, rather than just expecting one.
     If this fails at 3, someone has added a third navigation without the breakout. */
  const hrefAssignments = (src.match(/location\.href=url;/g) || []).length;
  ok('every navigation goes through a named helper, none bare',
    /function handOffToStripe\(url\)\{/.test(src) && /function goToMap\(zip\)\{/.test(src)
      && hrefAssignments === 2, `${hrefAssignments} assignments`);
  ok('the helper retargets window.top when framed',
    /if\(window\.top && window\.top!==window\) target=window\.top;/.test(src));
  ok('a cross-origin embed cannot throw the handoff away',
    /try\{ if\(window\.top[\s\S]{0,60}\}catch\(e\)\{\}\s*\n\s*target\.location\.href=url;/.test(src));
  ok('the reason is written down where someone will find it', /WHY THE BREAKOUT/.test(src));

  // jsdom's window.top is non-configurable, so run the helper straight out of the source against
  // stand-in windows. This is the branch that decides whether a reviewer sees a checkout or a
  // grey rectangle, so it is worth testing directly rather than inferring from the regexes above.
  const fnSrc = src.match(/function handOffToStripe\(url\)\{[\s\S]*?\n  \}/)?.[0];
  ok('the helper source is extractable for direct testing', !!fnSrc);
  const runHelper = (topKind) => {
    const nav = { self: [], top: [] };
    const self = { location: { set href(v) { nav.self.push(v); } } };
    const parent = { location: { set href(v) { nav.top.push(v); } } };
    Object.defineProperty(self, 'top',
      topKind === 'throws' ? { get() { throw new Error('cross-origin'); } }
      : { value: topKind === 'framed' ? parent : self });
    new Function('window', fnSrc + '\nreturn handOffToStripe;')(self)('https://checkout.test/x');
    return nav;
  };
  const framed = runHelper('framed');
  ok('framed: the URL goes to the TOP window', framed.top.length === 1 && framed.self.length === 0, framed);
  const plain = runHelper('self');
  ok('unframed: the URL goes to this window', plain.self.length === 1 && plain.top.length === 0, plain);
  const blocked = runHelper('throws');
  ok('cross-origin embed: still navigates, does not throw the click away',
    blocked.self.length === 1 && blocked.top.length === 0, blocked);
}

// The review harness must never bleed into the thing that ships.
console.log('\n— review harness is separate from the product —');
{
  const PREVIEW = path.join(HERE, '..', 'preview.html');
  const src = fs.readFileSync(PAGE, 'utf8');
  ok('preview.html exists', fs.existsSync(PREVIEW));
  const prev = fs.readFileSync(PREVIEW, 'utf8');
  ok('preview frames the real page, not a copy of it', prev.includes('src="index.html"'));
  ok('preview offers all three device sizes',
    ['mobile', 'tablet', 'desktop'].every(d => prev.includes(`data-device="${d}"`)));
  // Sign-up completes on Stripe, so the harness no longer pretends to return from it. Nothing here
  // should reload the frame either — a device switch must not wipe what a reviewer typed.
  // Comments may explain what was removed and why; only live code counts as "still there".
  const prevCode = prev.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('the harness no longer simulates post-payment states',
    !/data-state/.test(prevCode) && !/\?checkout=/.test(prevCode));
  ok('no orphaned plan-seeding left behind', !/yg_plan|seedPlan|FALLBACK/.test(prevCode));
  ok('the frame is never reloaded, so typed input survives a device switch',
    !/frame\.src\s*=/.test(prev));
  // The harness must not promise safety it cannot deliver: the CTA now leaves it for a live
  // checkout. Reinstate a dry-run claim only alongside a test-mode Payment Link.
  ok('the harness does not claim no card is ever charged', !/no card is ever charged/.test(prev.replace(/<!--[\s\S]*?-->/g, '')));
  ok('the harness warns that the CTA is live',
    /Continue to payment&rdquo; is live/.test(prev) && /can take a real payment/.test(prev));
  ok('the device toggle is NOT in the landing page itself', !src.includes('data-device'));
  // Comments may name the harness — the breakout in handOffToStripe only makes sense if they can.
  // What must never exist is a real reference: a link, a script, a fetch, a frame.
  const srcNoComments = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('the landing page does not link to, load, or frame the harness', !srcNoComments.includes('preview.html'),
    srcNoComments.match(/.{0,40}preview\.html.{0,40}/)?.[0]);
}

/* The "deploy copy is in sync" block lived here — three checks that deploy/index.html existed and
   matched index.html byte for byte. deploy/ was deleted on 12 Aug 2026: it was a hand-maintained
   duplicate that nothing read. GitHub Pages serves index.html from the branch root, there is no CI
   or CNAME, and index.html is already the file that goes into Webflow. All the copy did was add a
   `cp` step to forget and a test to fail when you forgot it. index.html is the only page now. */

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
