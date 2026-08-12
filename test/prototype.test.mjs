import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolved relative to this file so the suite travels with the project.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'index.html');
const DEPLOY = path.join(HERE, '..', 'deploy', 'index.html');
const NAV_LINE = 'target.location.href=url;';
// The whole Stripe config object, so the harness can seed per-plan links or blank them out.
const LINKS_BLOCK = /var STRIPE_PAYMENT_LINKS = \{[\s\S]*?\n  \};/;
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  ok  ', name)) : (fail++, console.log('  FAIL', name, extra ?? '')); };

// Fresh page per scenario so state never leaks between tests.
// No `webhook` option any more: the page posts to nothing. fetch is still stubbed below so the
// suite can assert that — a silent outbound POST from this page is exactly what we're guarding
// against, and you can only catch it by watching for a call that should never come.
async function boot({ search = '', links = null } = {}) {
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
  // jsdom's location.href is unforgeable, so swap the redirect for a recorder.
  // The "redirect line intact" assertion below guards against this stub drifting from the source.
  if (!html.includes(NAV_LINE)) throw new Error('redirect line changed — update NAV_LINE in the harness');
  html = html.replace(NAV_LINE, 'window.__nav.push(url);');

  const dom = new JSDOM(html, {
    url: 'https://www.yourgi.com/pack' + search,
    runScripts: 'dangerously', pretendToBeVisual: true,
    // Must exist before parse: the return-from-Stripe handler runs during load.
    beforeParse(w) { w.HTMLElement.prototype.scrollIntoView = () => {}; },
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
  ok('title is the Pack page', w.document.title === 'Yourgi Pack | Yourgi', w.document.title);
  ok('three plans rendered', w.document.querySelectorAll('#tiers .tier').length === 3);
  ok('Twice a Week is the default selection', $(w, 'tiers').querySelector('[data-tier="twice"]').getAttribute('aria-checked') === 'true');
  ok('exactly one plan is checked', w.document.querySelectorAll('#tiers .tier[aria-checked="true"]').length === 1);
  ok('benefits list rendered for default plan', w.document.querySelectorAll('#incl li').length === 3);
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
     of explicit decision, and re-open §7 q1 with David when you do. */
  ok('prices are the Figma set: $49 / $99 / $399 (§7 q1 overridden — see comment)',
    JSON.stringify(prices) === JSON.stringify([49, 99, 399]), prices);
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
  ok('the top plan is unlimited — §6 cap guardrail deliberately given up',
    /unlimited/i.test(benefitText), benefitText);
  ok('the unguarded §6 subsidy exposure is written down in the page',
    /WHAT IS NOW UNGUARDED/.test(src) && /§6/.test(src),
    'head comment must keep naming the unlimited-plan exposure');
  ok('overnight care is included on the two plans that cover any service, per the FAQ',
    /a night away comes out of your plan/i.test($(w, 'faq').textContent));
  // The page must not sell a rollover it hasn't decided on — the FAQ still calls it open (§7 q1).
  ok('no plan promises rollover while the FAQ says rollover is undecided',
    !/roll(over| a day| your day| forward)|carry over/.test(benefitText), benefitText);
  ok('the FAQ still flags rollover as an open decision',
    /walks I don't use/i.test($(w, 'faq').textContent) && $(w, 'faq').textContent.includes('PLACEHOLDER'));
  /* Was "every plan states a numeric walk cap". Two plans no longer have a walk cap to state: the
     $99 plan counts days or nights of anything, and the $399 plan counts nothing. What still has
     to hold is that each plan says plainly what you get, in words a buyer can check. */
  ok('every plan states what it holds, in countable words or as unlimited',
    [...w.document.querySelectorAll('#tiers .tier')].length === 3 &&
    allBenefits.every(b => /five walks|five days or nights|unlimited/i.test(b)), allBenefits);

  // The hero previously carried an asterisked Guarantee claim. It must not come back.
  const hero = w.document.querySelector('.hero').textContent;
  ok('hero makes no Guarantee claim', !hero.includes('Guarantee'), hero.slice(0, 200));
  // Rendered text only — the source comments discuss the Guarantee at length on purpose.
  // With the site nav gone, the only place a visitor reads it is the site-wide footer.
  const visibleGuarantee = (w.document.body.textContent.match(/Yourgi Guarantee/g) || []).length;
  ok('the only Guarantee mention a visitor sees is the site-wide footer',
    visibleGuarantee === 1, visibleGuarantee);
  ok('no Guarantee claim inside the signup card', !$(w, 'signup').textContent.includes('Guarantee'));

  // Brand: "pet parent" is internal shorthand, never customer-facing (yourgi-brand skill).
  const bodyText = w.document.body.textContent;
  ok('no "pet parent" in customer-facing copy', !/pet parent/i.test(bodyText));
  ok('no "fur baby" in Yourgi-authored copy (the one instance is inside a real review quote)',
    (bodyText.match(/fur bab/gi) || []).length === 1);
}

// Borrowed from operators who sell capped usage well: show the unit price, show the saving,
// let people compare all plans at once, and repeat the CTA at the bottom.
console.log('\n— subscription-page conventions —');
{
  const w = await boot();

  // Unit price on every card, so nobody has to divide $99 by 9 in their head.
  const units = [...w.document.querySelectorAll('#tiers [data-unit]')].map(e => e.textContent);
  /* Only the two capped plans have a per-use price. The unlimited plan has no denominator, so its
     slot is deliberately BLANK — a number there would be invented. That blank is the assertion. */
  ok('the two capped plans show a per-use price', /^\$\d+(\.\d\d)? a (walk|visit)$/.test(units[0]) && /^\$\d+(\.\d\d)? a (walk|visit)$/.test(units[1]), units);
  ok('the unlimited plan shows no per-use price at all', units[2] === '', units[2]);
  ok('per-use price is right for Walks ($49 / 5 walks)', units[0] === '$9.80 a walk', units[0]);
  ok('per-use price is right for Any Five ($99 / 5 uses)', units[1] === '$19.80 a visit', units[1]);

  /* THE VALUE LADDER STILL DOES NOT REWARD BUYING MORE. This used to assert the per-walk price
     falls as the plan grows, which the old $99/$149/$199 ladder did ($19.80 > $16.56 > $14.21).
     Under $49/$99/$399 the entry plan is the cheapest per use ($9.80) and the middle plan costs
     twice that ($19.80) for the same count, bought back only by being spendable on a night away
     rather than a walk. The top plan can't be compared at all — no cap, no unit price.
     Pinned so the shape of the ladder stays a recorded decision. */
  const perUse = [parseFloat(units[0].slice(1)), parseFloat(units[1].slice(1))];
  ok('per-use price rises from the entry plan to the middle plan — see comment',
    perUse[0] < perUse[1], units);

  // Savings vs. booking one at a time — the reason to subscribe at all.
  const save = $(w, 'save-line').textContent;
  ok('savings callout names a per-use price and a monthly saving', /\$[\d.]+ a (walk|visit)/.test(save) && /\$\d+ less a month/.test(save), save);
  /* The default plan is spendable on any service, so its saving is a FLOOR priced at the cheapest
     known rate, not a figure: 5 uses x $25 = $125 list against $99. It must say "at least", and it
     must never quote a number that assumes the expensive services. See economics() in the page. */
  ok('default plan saving is floored at $26 and hedged, not overstated',
    save.includes('at least') && save.includes('$26 less a month'), save);
  ok('the floored saving points at the upside instead of inventing it',
    save.includes('more if you spend it on a night away'), save);

  // Comparison table: all three plans visible at once without clicking.
  const rows = [...w.document.querySelectorAll('#cmp-body tr')];
  ok('comparison table rendered', rows.length >= 6, rows.length);
  ok('table headers carry each price',
    $(w, 'cmp-p-weekly').textContent === '$49/mo' && $(w, 'cmp-p-twice').textContent === '$99/mo' && $(w, 'cmp-p-weekdays').textContent === '$399/mo');
  const rowByLabel = l => rows.find(r => r.querySelector('th')?.textContent.includes(l));
  const cells = l => [...rowByLabel(l).querySelectorAll('td')].map(td => td.textContent.trim());
  /* The "Walks a month" and "Daycare days a month" rows are gone — only one plan counts walks now.
     The table reports a common denominator (days or nights) plus what each plan may be spent on. */
  ok('counts match the plans, with the top one uncapped',
    JSON.stringify(cells('Days or nights a month')) === JSON.stringify(['5', '5', 'Unlimited']), cells('Days or nights a month'));
  ok('coverage widens across the three plans',
    JSON.stringify(cells('What it covers')) === JSON.stringify(['Walks only', 'Any service', 'Everything we do']), cells('What it covers'));
  ok('overnight is booked separately only on the walks-only plan',
    cells('Overnight')[0].includes('Booked separately') && cells('Overnight')[1].includes('Included'), cells('Overnight'));
  ok('the uncapped plan quotes no per-use price and no saving',
    cells('Works out at')[2] === '—' && cells('You save')[2] === '—', [cells('Works out at')[2], cells('You save')[2]]);
  ok('table and card agree on the per-use price', cells('Works out at')[1] === units[1], [cells('Works out at')[1], units[1]]);
  ok('the mixed plan hedges its saving in the table too', cells('You save')[1].startsWith('at least'), cells('You save')[1]);
  ok('middle plan is highlighted in the table', rowByLabel('Days or nights a month').querySelectorAll('td.best').length === 1);

  // A long page needs a second door.
  ok('closing CTA exists', !!$(w, 'closer-cta'));
  ok('Stripe is named before the handoff', $(w, 'signup').textContent.includes('Stripe'));
  ok('page says the card never touches Yourgi', $(w, 'signup').textContent.includes('never touches Yourgi'));
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
  ok('signup no longer promises a concierge callback',
    !planStep.textContent.toLowerCase().includes('calls to set up your days'));
  ok('zip is explained as a coverage check', planStep.textContent.includes('before you pay'));
}

console.log('\n— plan switching —');
{
  const w = await boot();
  $(w, 'tiers').querySelector('[data-tier="weekdays"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('weekdays becomes checked', $(w, 'tiers').querySelector('[data-tier="weekdays"]').getAttribute('aria-checked') === 'true');
  ok('twice is deselected', $(w, 'tiers').querySelector('[data-tier="twice"]').getAttribute('aria-checked') === 'false');
  /* "daycare" used to be the sentinel for top-plan-only content. No plan enumerates daycare now,
     so the sentinel is "unlimited" — the thing only the top plan may say. */
  ok('benefits swapped to top-plan content', /unlimited/i.test($(w, 'incl').textContent), $(w, 'incl').textContent);
  $(w, 'tiers').querySelector('[data-tier="weekly"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('benefits swapped again to weekly (2 items)', w.document.querySelectorAll('#incl li').length === 2);
  ok('no top-plan copy left behind', !/unlimited/i.test($(w, 'incl').textContent), $(w, 'incl').textContent);
  ok('only the top plan says unlimited — the entry plan is walks only',
    /five walks/i.test($(w, 'incl').textContent) && !/unlimited/i.test($(w, 'incl').textContent), $(w, 'incl').textContent);
  ok('Plan Selected tracked', w.__mp.some(([n, p]) => n === 'Plan Selected' && p.plan_tier === 'weekdays' && p.plan_price === 399));
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
    $(w, 'to-checkout').textContent === 'Continue to payment' && !$(w, 'to-checkout').hasAttribute('disabled'),
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
    $(w, 'to-checkout').textContent === 'Continue to payment' && !$(w, 'to-checkout').hasAttribute('disabled'),
    $(w, 'to-checkout').textContent);
}

console.log('\n— market gate coverage —');
{
  const cases = [['80202', true, 'Denver'], ['75201', true, 'Dallas'], ['76102', true, 'Fort Worth'],
                 ['77002', true, 'Houston'], ['02108', true, 'Boston'], ['97205', true, 'Portland'],
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

  // Every dead-end screen offers a way back.
  for (const id of ['restart', 'restart2', 'restart3']) ok(`${id} exists`, !!$(w, id));
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

  // The audited values must actually be the ones the page uses.
  ok('page defines the darkened sky token', src.includes('--sky-ink:#41709B'));
  ok('brand Sky is no longer used as small text', !/color:var\(--sky\)/.test(src), 'still using --sky for text');
  // Declarations only — the source comments name the old values on purpose, to explain why they went.
  const declared = (src.match(/color:\s*#[0-9a-f]{3,6}/gi) || []).map(d => d.split(':')[1].trim().toLowerCase());
  ok('no low-contrast grey is declared any more',
    !declared.some(c => ['#777777', '#777', '#999999', '#999', '#f1b942'].includes(c)),
    declared.filter(c => ['#777777', '#777', '#999999', '#999', '#f1b942'].includes(c)));
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
  ok('star glyphs are hidden from assistive tech',
    [...w.document.querySelectorAll('.review-stars')].every(s => s.getAttribute('aria-hidden') === 'true'));
  ok('each review states its rating as text',
    (w.document.body.textContent.match(/Rated 5 out of 5/g) || []).length === 3);

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
  /* Only the two capped plans get a unit price — the unlimited plan's slot is meant to stay empty,
     so "every slot filled" is no longer the smoke test. Two filled is. */
  ok('the script actually ran (prices computed)',
    [...w.document.querySelectorAll('#tiers [data-unit]')].filter(e => e.textContent.trim() !== '').length === 2);
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
console.log('\n— the shipped Stripe link is a flagged placeholder —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  const urls = [...new Set(src.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+/g) || [])];
  ok('exactly one Stripe link in the source', urls.length === 1, urls);
  ok('it is declared once and reused, not pasted three times',
    /var STRIPE_PLACEHOLDER_LINK = 'https:\/\/buy\.stripe\.com\//.test(src)
    && (src.match(/STRIPE_PLACEHOLDER_LINK,?\s*\/\/ TODO/g) || []).length === 3);
  ok('the source says out loud that it is live mode, not test mode',
    /THIS IS A LIVE-MODE LINK/.test(src) && !/buy\.stripe\.com\/test_/.test(src));
  ok('the source says out loud that the billed price is not the advertised price',
    /EVERY PLAN CHARGES WHATEVER THIS LINK CHARGES/.test(src));
  /* The observed price is recorded because it is the whole problem: $50/mo is not one of the three
     plans. This got WORSE with the $49/$99/$399 pricing — the entry plan is now $49, a dollar off
     what the placeholder actually charges, so a wrong charge would pass a glance at a receipt.
     If the link is repointed, re-check this. */
  ok('the observed $50/mo charge is written down, with the $49 near-collision named',
    /\$50\.00 every month/.test(src) && /within a dollar of what this placeholder charges/.test(src));
  ok('the head comment warns a reader before they open the config',
    /LIVE-mode\s+link[\s\S]{0,300}must be fixed before\s+this page sees traffic/.test(src));
  ok('every plan still carries a TODO for its own link',
    ['Once a Week', 'Twice a Week', 'Weekdays'].every(p => new RegExp(`TODO — real ${p} link`).test(src)));

  // The handoff must still be per-plan-aware even while the link is shared, or the mismatch is
  // unrecoverable: client_reference_id is the only record of what the visitor actually picked.
  const w = await boot();                 // the real, shipping config
  $(w, 'tiers').querySelector('[data-tier="weekdays"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  fill(w, { zip: '80202', email: 'placeholder@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('the CTA reaches the placeholder link', (w.__nav[0] || '').startsWith(urls[0]), w.__nav[0]);
  ok('the chosen plan still rides along for reconciliation',
    /client_reference_id=yg_weekdays_80202_\d+/.test(w.__nav[0] || ''), w.__nav[0]);
}

// Stripe Checkout refuses to render inside a third-party iframe — it hangs on its loading skeleton.
// preview.html frames this page, so without a breakout the CTA looks broken to every reviewer.
console.log('\n— the Stripe handoff escapes the review iframe —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  ok('handoff goes through one helper, not a bare assignment',
    /function handOffToStripe\(url\)\{/.test(src) && (src.match(/location\.href=url;/g) || []).length === 1);
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
  ok('harness is not in deploy/ (only index.html ships)',
    !fs.existsSync(path.join(HERE, '..', 'deploy', 'preview.html')));
}

console.log('\n— deploy copy is in sync —');
{
  const canonical = fs.readFileSync(PAGE, 'utf8');
  const deployed = fs.existsSync(DEPLOY) ? fs.readFileSync(DEPLOY, 'utf8') : null;
  ok('deploy/index.html exists', deployed !== null);
  ok('deploy/index.html matches index.html', deployed === canonical);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
