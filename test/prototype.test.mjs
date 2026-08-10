import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolved relative to this file so the suite travels with the project.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'index.html');
const DEPLOY = path.join(HERE, '..', 'deploy', 'index.html');
const NAV_LINE = 'window.location.href=url;';
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  ok  ', name)) : (fail++, console.log('  FAIL', name, extra ?? '')); };

// Fresh page per scenario so state never leaks between tests.
async function boot({ search = '', links = null, webhook = null } = {}) {
  let html = fs.readFileSync(PAGE, 'utf8');
  // Strip the Mixpanel + Segment loader blocks; we install stubs instead so nothing real fires.
  html = html.replace(/<script type="text\/javascript">[\s\S]*?<\/script>/, `<script>
    window.__mp=[]; window.__nav=[]; window.trackEvent=function(n,p){window.__mp.push([n,p||{}]);};
  </script>`);
  html = html.replace(/<script>\s*!function\(\)\{var i="analytics"[\s\S]*?<\/script>/, `<script>
    window.__seg=[];
    window.sendToSegment=function(email,traits,ev,props){window.__seg.push({email,traits,ev,props});};
  </script>`);
  if (links) {
    const before = html;
    html = html.replace(/weekly:   '',   \/\/ TODO\n    twice:    '',   \/\/ TODO\n    weekdays: ''    \/\/ TODO/,
      `weekly: '${links}w', twice: '${links}t', weekdays: '${links}d'`);
    if (html === before) throw new Error('STRIPE_PAYMENT_LINKS block changed — update the harness');
  }
  if (webhook) html = html.replace("var TEAMS_WEBHOOK_URL = '';", `var TEAMS_WEBHOOK_URL = '${webhook}';`);
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
const fill = (w, { zip, phone, email, schedule }) => {
  const vals = [['q-zip', zip], ['q-phone', phone], ['q-email', email]];
  if (schedule !== undefined) vals.push(['q-schedule', schedule]);
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
  ok('Twice a Week is the default selection', $(w, 'tiers').querySelector('[data-tier="twice"]').getAttribute('aria-pressed') === 'true');
  ok('exactly one plan is pressed', w.document.querySelectorAll('#tiers .tier[aria-pressed="true"]').length === 1);
  ok('benefits list rendered for default plan', w.document.querySelectorAll('#incl li').length === 4);
  ok('plan step visible, others hidden', vis(w, 'step-plan') && !vis(w, 'step-confirm') && !vis(w, 'step-oom') && !vis(w, 'step-cancel'));
  ok('dogs starts at 1', $(w, 'pets-val').textContent === '1');
  ok('optional schedule field present and empty', $(w, 'q-schedule').value === '');
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

  ok('every price is inside the $100–$200 band the team floated (§7 q1)',
    prices.every(p => p >= 99 && p <= 200), prices);
  ok('no $50-class plan (§7 q1 called $50 too low)', prices.every(p => p > 50), prices);

  // Walk the rendered benefits for every plan, not just the default.
  const allBenefits = [];
  for (const t of [...w.document.querySelectorAll('#tiers .tier')]) {
    t.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    allBenefits.push($(w, 'incl').textContent);
  }
  const benefitText = allBenefits.join(' ').toLowerCase();

  ok('no plan claims the Yourgi Guarantee (§8 gap 4 — coverage undetermined)',
    !benefitText.includes('guarantee'));
  ok('no plan promises overnight, boarding, or house-sitting (§7 q3 — poor fit, excluded)',
    !/overnight|boarding|house.?sit/.test(benefitText), benefitText);
  ok('no plan is unlimited (§6 — caps are the subsidy guardrail)',
    !benefitText.includes('unlimited'), benefitText);
  // The page must not sell a rollover it hasn't decided on — the FAQ still calls it open (§7 q1).
  ok('no plan promises rollover while the FAQ says rollover is undecided',
    !/roll(over| a day| your day| forward)|carry over/.test(benefitText), benefitText);
  ok('the FAQ still flags rollover as an open decision',
    /walks I don't use/i.test($(w, 'faq').textContent) && $(w, 'faq').textContent.includes('PLACEHOLDER'));
  ok('every plan states a numeric walk cap',
    [...w.document.querySelectorAll('#tiers .tier')].length === 3 &&
    allBenefits.every(b => /\d+\s+walks/i.test(b)), allBenefits);

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

  // Unit price on every card, so nobody has to divide $149 by 9 in their head.
  const units = [...w.document.querySelectorAll('#tiers [data-unit]')].map(e => e.textContent);
  ok('every plan card shows a per-walk price', units.every(u => /^\$\d+(\.\d\d)? a walk$/.test(u)), units);
  ok('per-walk price is right for Once a Week ($99 / 5)', units[0] === '$19.80 a walk', units[0]);
  ok('per-walk price is right for Twice a Week ($149 / 9)', units[1] === '$16.56 a walk', units[1]);
  ok('per-walk price falls as the plan gets bigger (a real value ladder)',
    parseFloat(units[0].slice(1)) > parseFloat(units[1].slice(1)) && parseFloat(units[1].slice(1)) > parseFloat(units[2].slice(1)), units);

  // Savings vs. booking one at a time — the reason to subscribe at all.
  const save = $(w, 'save-line').textContent;
  ok('savings callout names a per-walk price and a monthly saving', /\$[\d.]+ a walk/.test(save) && /\$\d+ less a month/.test(save), save);
  ok('default plan saving is $76 ($225 list − $149)', save.includes('$76 less a month'), save);

  // Comparison table: all three plans visible at once without clicking.
  const rows = [...w.document.querySelectorAll('#cmp-body tr')];
  ok('comparison table rendered', rows.length >= 6, rows.length);
  ok('table headers carry each price',
    $(w, 'cmp-p-weekly').textContent === '$99/mo' && $(w, 'cmp-p-twice').textContent === '$149/mo' && $(w, 'cmp-p-weekdays').textContent === '$199/mo');
  const rowByLabel = l => rows.find(r => r.querySelector('th')?.textContent.includes(l));
  const cells = l => [...rowByLabel(l).querySelectorAll('td')].map(td => td.textContent.trim());
  ok('walk counts match the plans', JSON.stringify(cells('Walks a month')) === JSON.stringify(['5', '9', '14']), cells('Walks a month'));
  ok('daycare shown only on the top plan', cells('Daycare days a month')[2] === '2' && cells('Daycare days a month')[0] === '—');
  ok('table states overnight is booked separately', cells('Overnight').every(c => c.includes('Booked separately')));
  ok('table and card agree on the per-walk price', cells('Works out at')[1] === units[1], [cells('Works out at')[1], units[1]]);
  ok('middle plan is highlighted in the table', rowByLabel('Walks a month').querySelectorAll('td.best').length === 1);

  // A long page needs a second door.
  ok('closing CTA exists', !!$(w, 'closer-cta'));
  ok('Stripe is named before the handoff', $(w, 'signup').textContent.includes('handled by Stripe'));
  ok('page says the card never touches Yourgi', $(w, 'signup').textContent.includes('never touches Yourgi'));
}

console.log('\n— phone is optional —');
{
  const w = await boot({ webhook: 'https://example.test/hook' });
  fill(w, { zip: '80202', phone: '', email: 'nophone@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('signup completes with no phone', vis(w, 'step-confirm'));
  ok('lead still captured', w.__seg.some(s => s.ev === 'Lead Captured'));
  const facts = w.__fetches[0]?.body.attachments[0].content.body.find(b => b.type === 'FactSet').facts;
  ok('Teams card tells concierge how to reach them instead',
    facts.find(f => f.title === 'Phone')?.value.includes('Not given'), facts.find(f => f.title === 'Phone')?.value);

  const w2 = await boot();
  fill(w2, { zip: '80202', phone: '303555', email: 'half@example.com' });
  $(w2, 'to-checkout').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('a half-typed phone still blocks (no junk capture)', vis(w2, 'step-plan') && $(w2, 'e-qphone').style.display === 'block');
}

console.log('\n— plan switching —');
{
  const w = await boot();
  $(w, 'tiers').querySelector('[data-tier="weekdays"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('weekdays becomes pressed', $(w, 'tiers').querySelector('[data-tier="weekdays"]').getAttribute('aria-pressed') === 'true');
  ok('twice is deselected', $(w, 'tiers').querySelector('[data-tier="twice"]').getAttribute('aria-pressed') === 'false');
  ok('benefits swapped to weekdays content', $(w, 'incl').textContent.includes('daycare'));
  $(w, 'tiers').querySelector('[data-tier="weekly"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('benefits swapped again to weekly (3 items)', w.document.querySelectorAll('#incl li').length === 3);
  ok('no weekdays copy left behind', !$(w, 'incl').textContent.includes('daycare'));
  ok('daycare appears only on the top plan (§7 q3)',
    !$(w, 'incl').textContent.includes('daycare'));
  ok('Plan Selected tracked', w.__mp.some(([n, p]) => n === 'Plan Selected' && p.plan_tier === 'weekdays' && p.plan_price === 199));
}

console.log('\n— dogs stepper bounds —');
{
  const w = await boot();
  for (let i = 0; i < 12; i++) $(w, 'pplus').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('caps at 8', $(w, 'pets-val').textContent === '8');
  for (let i = 0; i < 12; i++) $(w, 'pminus').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('floors at 1', $(w, 'pets-val').textContent === '1');
}

console.log('\n— validation —');
{
  const w = await boot();
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('empty form blocks submit', vis(w, 'step-plan'));
  ok('the two required fields error', ['e-zip', 'e-email'].every(id => $(w, id).style.display === 'block'));
  ok('blank optional phone does NOT error', $(w, 'e-qphone').style.display !== 'block');
  ok('Validation Failed lists the 2 required fields', w.__mp.some(([n, p]) => n === 'Validation Failed' && p.fields.length === 2));
  ok('nothing sent to Segment', w.__seg.length === 0);

  fill(w, { zip: '80202', phone: '3035550142', email: 'not-an-email' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('bad email still blocks', vis(w, 'step-plan') && $(w, 'e-email').style.display === 'block');

  fill(w, { zip: '80202', phone: '1234567890', email: 'a@b.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('phone starting with 1 area code rejected', vis(w, 'step-plan') && $(w, 'e-qphone').style.display === 'block');
}

console.log('\n— the schedule field is optional —');
{
  const w = await boot();
  fill(w, { zip: '80202', phone: '3035550142', email: 'noschedule@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('empty schedule does not block submit', vis(w, 'step-confirm'));
  ok('schedule_given false when left blank', w.__seg.some(s => s.ev === 'Lead Captured' && s.props.schedule_given === false));

  const w2 = await boot();
  fill(w2, { zip: '80202', phone: '3035550142', email: 'sched@example.com', schedule: 'Tues + Thurs, lunchtime' });
  $(w2, 'to-checkout').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('schedule_given true when filled', w2.__seg.some(s => s.ev === 'Lead Captured' && s.props.schedule_given === true));
  ok('schedule text is NOT sent to Segment as a trait', !JSON.stringify(w2.__seg).includes('Tues + Thurs'));
}

console.log('\n— phone formatting + zip masking —');
{
  const w = await boot();
  const p = $(w, 'q-phone');
  p.value = '3035550142'; p.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('formats to (303) 555-0142', p.value === '(303) 555-0142', p.value);
  p.value = '13035550142'; p.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('strips leading country code 1', p.value === '(303) 555-0142', p.value);
  const z = $(w, 'q-zip');
  z.value = 'abc80202999'; z.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('zip strips letters and caps at 5', z.value === '80202', z.value);
}

console.log('\n— dry run (no Stripe links configured) —');
{
  const w = await boot();
  fill(w, { zip: '80202', phone: '3035550142', email: 'test@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('lands on confirmation', vis(w, 'step-confirm'));
  ok('confirmation says DRY RUN', $(w, 'confirm-body').textContent.includes('DRY RUN'));
  ok('no navigation to Stripe', w.__nav.length === 0);
  ok('no Teams post (webhook unset)', w.__fetches.length === 0);
  ok('Lead Captured sent to Segment', w.__seg.some(s => s.ev === 'Lead Captured' && s.props.plan_tier === 'twice' && s.props.out_of_market === false));
  ok('Segment identify uses email', w.__seg[0].email === 'test@example.com');
  ok('Checkout Dry Run tracked, not Checkout Started', w.__mp.some(([n]) => n === 'Checkout Dry Run') && !w.__mp.some(([n]) => n === 'Checkout Started'));
  ok('button re-enabled after submit', !$(w, 'to-checkout').hasAttribute('disabled'));
}

console.log('\n— in-market with Stripe links configured —');
{
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  $(w, 'tiers').querySelector('[data-tier="weekly"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  fill(w, { zip: '75201', phone: '2145550188', email: 'dallas@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('navigates to Stripe', w.__nav.length === 1, w.__nav);
  const url = w.__nav[0] || '';
  ok('uses the weekly link', url.startsWith('https://buy.stripe.com/test_w'), url);
  ok('email prefilled', url.includes('prefilled_email=dallas%40example.com'), url);
  ok('client_reference_id carries the plan', /client_reference_id=yg_weekly_75201_\d+/.test(url), url);
  ok('Checkout Started tracked', w.__mp.some(([n, p]) => n === 'Checkout Started' && p.plan_tier === 'weekly'));
  ok('plan stashed in sessionStorage', JSON.parse(w.sessionStorage.getItem('yg_plan')).tier === 'weekly');
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
  fill(w, { zip: '90210', phone: '3105550111', email: 'la@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('shows out-of-market step', vis(w, 'step-oom'));
  ok('NEVER navigates to Stripe', w.__nav.length === 0, w.__nav);
  ok('lead still captured with out_of_market flag', w.__seg.some(s => s.ev === 'Lead Captured' && s.props.out_of_market === true));
  ok('Out-of-Market Lead Captured tracked', w.__mp.some(([n]) => n === 'Out-of-Market Lead Captured'));
  ok('out-of-market copy says no charge was made', $(w, 'step-oom').textContent.includes('not been charged'));
}

console.log('\n— market gate coverage —');
{
  const cases = [['80202', true, 'Denver'], ['75201', true, 'Dallas'], ['76102', true, 'Fort Worth'],
                 ['77002', true, 'Houston'], ['02108', true, 'Boston'], ['97205', true, 'Portland'],
                 ['90210', false, 'Beverly Hills'], ['10001', false, 'NYC'], ['60601', false, 'Chicago']];
  for (const [zip, expected, name] of cases) {
    const w2 = await boot();
    fill(w2, { zip, phone: '3035550142', email: 'a@b.com' });
    $(w2, 'to-checkout').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
    await settle();
    ok(`${name} ${zip} -> ${expected ? 'in' : 'out of'} market`, vis(w2, expected ? 'step-confirm' : 'step-oom'));
  }
}

console.log('\n— Teams webhook payload —');
{
  const w = await boot({ webhook: 'https://example.test/hook' });
  fill(w, { zip: '80202', phone: '3035550142', email: 'hook@example.com', schedule: 'Mon + Wed mornings' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('posts once to the webhook', w.__fetches.length === 1);
  const facts = w.__fetches[0]?.body.attachments[0].content.body.find(b => b.type === 'FactSet').facts;
  const get = t => facts.find(f => f.title === t)?.value;
  ok('card carries plan', get('Plan') === 'Twice a Week ($149/mo)', get('Plan'));
  ok('card carries email', get('Email') === 'hook@example.com');
  ok('card carries formatted phone', get('Phone') === '(303) 555-0142', get('Phone'));
  ok('card carries zip', get('ZIP') === '80202');
  ok('card carries the days concierge needs for setup', get('Days wanted') === 'Mon + Wed mornings', get('Days wanted'));
  ok('card tells concierge to verify in Stripe before onboarding', /Confirm the subscription exists in Stripe/.test(get('Status')), get('Status'));

  const w2 = await boot({ webhook: 'https://example.test/hook' });
  fill(w2, { zip: '80202', phone: '3035550142', email: 'hook2@example.com' });
  $(w2, 'to-checkout').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
  await settle();
  const facts2 = w2.__fetches[0]?.body.attachments[0].content.body.find(b => b.type === 'FactSet').facts;
  ok('blank schedule tells concierge to ask on the call',
    facts2.find(f => f.title === 'Days wanted')?.value.includes('ask on the setup call'));
}

console.log('\n— webhook failure surfaces an error —');
{
  const w = await boot({ webhook: 'https://example.test/hook' });
  w.fetch = () => Promise.resolve({ ok: false });
  fill(w, { zip: '80202', phone: '3035550142', email: 'fail@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('stays on the plan step', vis(w, 'step-plan'));
  ok('no Segment lead on failure', w.__seg.length === 0);
  ok('Submission Failed tracked', w.__mp.some(([n, p]) => n === 'Submission Failed' && p.reason === 'response_not_ok'));
  ok('button re-enabled after failure', !$(w, 'to-checkout').hasAttribute('disabled'));
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
  const w = await boot();
  $(w, 'tiers').querySelector('[data-tier="weekdays"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  $(w, 'pplus').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  fill(w, { zip: '80202', phone: '3035550142', email: 'reset@example.com', schedule: 'Fridays' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  $(w, 'restart').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('back on the plan step', vis(w, 'step-plan'));
  ok('plan reset to Twice a Week', $(w, 'tiers').querySelector('[data-tier="twice"]').getAttribute('aria-pressed') === 'true');
  ok('dogs reset to 1', $(w, 'pets-val').textContent === '1');
  ok('fields cleared, including the schedule box',
    ['q-zip', 'q-phone', 'q-email', 'q-schedule'].every(id => $(w, id).value === ''));
}

console.log('\n— no secrets in page source —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  ok('no Stripe secret key', !/sk_(live|test)_/.test(src));
  ok('no live Payment Link committed', !/buy\.stripe\.com/.test(src));
  ok('concierge webhook NOT reused', !src.includes('powerplatform.com'));
  ok('Teams webhook still unset', /var TEAMS_WEBHOOK_URL = '';/.test(src));
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
  ok('preview can reach both post-Stripe states',
    prev.includes('?checkout=success') && prev.includes('?checkout=cancel'));
  ok('the device toggle is NOT in the landing page itself', !src.includes('data-device'));
  ok('the landing page does not reference the harness', !src.includes('preview.html'));
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
