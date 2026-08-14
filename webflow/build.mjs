#!/usr/bin/env node
/* Extracts the paste-ready Webflow blocks from index.html.
   ============================================================================================
   WHY THIS IS A SCRIPT AND NOT A FOLDER OF FILES SOMEONE MAINTAINS.

   This repo has already paid for the alternative once. `deploy/index.html` was a hand-kept copy
   of the page, it drifted, and it was deleted on 12 Aug 2026 — three tests existed purely to
   assert the copy still matched, and a comment telling people to sync it survived the deletion by
   two days. A second hand-maintained copy of the same page, this time cut into four pieces for
   Webflow, would drift the same way and be harder to check.

   So: index.html stays the single source of truth, and everything under dist/ is generated and
   gitignored. If a Webflow block looks wrong, fix index.html and re-run this. Never edit dist/.

   WHAT IT DOES
     - pulls the <style> block, the main behaviour <script>, the two analytics blocks, and the
       comparison-table shell out of index.html
     - strips comments from the CSS and JS builds, because the annotated JS is 50,608 characters
       against Webflow's 50,000 limit — 101%, so it does not fit in the field at all any more, for
       a limit that has already moved once (it was 10,000 until 2025). Stripping is load-bearing,
       not tidiness. The comments are the most valuable documentation in this project and they
       belong in git, not in a Webflow text field.
     - reports every block against the limit so a size problem is visible before someone pastes.

   Run:  node webflow/build.mjs
         node webflow/build.mjs --no-analytics

   --no-analytics ships the page with NO Mixpanel and NO Segment. It replaces both analytics blocks
   with no-op stubs of trackEvent() and sendToSegment(), so the 15 call sites in the behaviour
   script keep working and the page behaves identically minus the tracking. Added 14 Aug 2026:
   Lauren's call was that analytics for the Webflow page is Emily's to wire up later, and shipping
   no tracking is safer than shipping half of it. It also sidesteps the double-count trap described
   below, which is real rather than theoretical — see the FOOTER comment.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'index.html');
const DIST = path.join(HERE, 'dist');

/* Webflow's per-field / per-embed ceiling. Sources disagree on whether it is per-field or an
   aggregate across the site: the announcement says "up to 50,000 characters of custom code across
   Site settings, Page settings, Code Embed elements and CMS Rich text fields", which reads as a
   total, while the Help Center says "Custom code in a Code Embed element cannot exceed 50,000
   characters" and advises splitting long code "into multiple Code Embed elements" — advice that
   only helps if the limit is per-element. Treated as per-field here, and every block is reported
   with its share of the total as well, so the plan holds either way. Paid site plans only. */
const LIMIT = 50000;

/* Ship the page with no Mixpanel and no Segment. See the header comment. */
const NO_ANALYTICS = process.argv.includes('--no-analytics');

const src = fs.readFileSync(PAGE, 'utf8');

/* Comment stripping is deliberately conservative. It walks the source character by character
   tracking string and regex-literal context rather than running a regex over the whole file,
   because this page's own content contains sequences that look like comment delimiters — the
   Mixpanel loader carries `//cdn.mxpnl.com` inside a string, LIST_RATES comments discuss `/*`,
   and a naive strip silently corrupted the analytics loader the first time this was tried. */
function stripComments(code, { js }) {
  let out = '';
  let i = 0;
  const n = code.length;
  // Tracks whether a `/` can legally begin a regex literal here, which decides `/` vs division.
  let prevSignificant = '';
  while (i < n) {
    const c = code[i];
    const next = code[i + 1];

    // string literals — copied verbatim, escapes respected
    if (c === '"' || c === "'" || (js && c === '`')) {
      const quote = c;
      out += c; i++;
      while (i < n) {
        if (code[i] === '\\') { out += code[i] + (code[i + 1] ?? ''); i += 2; continue; }
        out += code[i];
        if (code[i] === quote) { i++; break; }
        i++;
      }
      prevSignificant = quote;
      continue;
    }

    // regex literal — only where a regex may legally start, else it is division
    if (js && c === '/' && next !== '/' && next !== '*' && /^$|[(,=:[!&|?{};+\-*%~^<>]/.test(prevSignificant)) {
      out += c; i++;
      let inClass = false;
      while (i < n) {
        if (code[i] === '\\') { out += code[i] + (code[i + 1] ?? ''); i += 2; continue; }
        if (code[i] === '[') inClass = true;
        else if (code[i] === ']') inClass = false;
        out += code[i];
        if (code[i] === '/' && !inClass) { i++; break; }
        i++;
      }
      while (i < n && /[a-z]/.test(code[i])) { out += code[i]; i++; }   // flags
      prevSignificant = '/';
      continue;
    }

    // block comment
    if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }

    // line comment (JS only — CSS has none, and `//` appears inside CSS urls)
    if (js && c === '/' && next === '/') {
      const end = code.indexOf('\n', i);
      i = end === -1 ? n : end;
      continue;
    }

    out += c;
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }
  // collapse the blank lines the comments left behind, keep single blank lines for readability
  return out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

function must(re, label) {
  const m = src.match(re);
  if (!m) {
    console.error(`\n  ERROR: could not find ${label} in index.html.`);
    console.error('  The page structure changed. Fix the pattern in webflow/build.mjs — do not');
    console.error('  hand-write the output file, or dist/ stops tracking the page.\n');
    process.exit(1);
  }
  return m;
}

/* ---- extract ------------------------------------------------------------------------------ */

const cssRaw = must(/<style>\n?([\s\S]*?)<\/style>/, 'the <style> block')[1];
const fontLink = must(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, 'the Archivo font link')[0];
const mixpanel = must(/<script type="text\/javascript">\n?([\s\S]*?)<\/script>/, 'the Mixpanel block')[1];

const allPlainScripts = [...src.matchAll(/<script>\n?([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (allPlainScripts.length < 2) {
  console.error('\n  ERROR: expected at least two <script> blocks (Segment, behaviours).\n');
  process.exit(1);
}
const segment = allPlainScripts[0];
const behaviour = allPlainScripts[allPlainScripts.length - 1];

const compareShell = must(/(<div class="compare-card">[\s\S]*?<\/table>\s*<\/div>\s*<\/div>)/, 'the comparison-table shell')[1];

/* ---- build -------------------------------------------------------------------------------- */

const css = stripComments(cssRaw, { js: false });
const js = stripComments(behaviour, { js: true });

const HEAD = `<!-- YOURGI PLUS — page <head> custom code.
     GENERATED by node webflow/build.mjs from index.html. Do not edit; edit the page and re-run.

     Webflow: Page settings > Custom code > Inside <head> tag.

     KEEP THE @font-face RULES. Checked against the live site 14 Aug 2026: National 2 (400, 700) and
     National 2 Condensed ARE uploaded under Site settings > Fonts — and they point at the exact
     same three CDN files these rules do, so this is not a second copy of the face. Same URL, same
     cache entry, no extra download. The rules are kept because they make the page render correctly
     without depending on a Designer-applied font class, which matters while the markup is not built
     from Designer styles. One wrinkle: Webflow registers the Condensed face at weight 700 while the
     rule below declares 800. Same file, so it renders identically — but do not "fix" one to match
     the other without checking the h1/h2 weight on a published page first.

     Also on that site: Klim's \`-test-\` TRIAL builds of both faces are uploaded as separate custom
     fonts ("National 2 Test", "National 2 Condensed Test"). This page does not touch them and a
     test in test/prototype.test.mjs asserts the licensed builds ship instead. Do not apply the
     trial faces to anything — see webflow/assets.md. -->
${fontLink}
<style>
${css}
</style>`;

/* The analytics half of the footer field. Either the real Mixpanel + Segment blocks, or no-op
   stubs standing in for them. The behaviour script is byte-identical either way — it only ever
   calls trackEvent() and sendToSegment(), never mixpanel.* or analytics.* directly, which is what
   makes stubbing them safe. If that stops being true, this flag starts lying: check with
   `grep -nE 'mixpanel\.|analytics\.' index.html` before trusting a --no-analytics build. */
const ANALYTICS = NO_ANALYTICS
  ? `<script>
/* ANALYTICS DELIBERATELY OMITTED — generated with --no-analytics.

   This page ships NO Mixpanel and NO Segment. Lauren's call, 14 Aug 2026: wiring the Webflow
   page's analytics is Emily's, later, and shipping no tracking beats shipping half of it.

   trackEvent() and sendToSegment() are stubbed below so the behaviour script's 15 call sites keep
   working untouched. Everything the page actually DOES — plan selection, validation, the ZIP
   market gate, the Stripe hand-off, the confirmation screen — is unaffected. What you lose is
   every event and every Segment identify(), which is the point.

   To restore: re-run without the flag, and read the double-count and host-gate notes in that
   build's output BEFORE pasting, because the fallback loader does not no-op the way the older
   comment claimed. */
function trackEvent(){}
function sendToSegment(){}
</script>`
  : `<script type="text/javascript">
${stripComments(mixpanel, { js: true })}
</script>
<script>
${stripComments(segment, { js: true })}
</script>`;

const ANALYTICS_NOTES = NO_ANALYTICS
  ? `     ANALYTICS IS NOT IN THIS BUILD. Generated with --no-analytics: no Mixpanel, no Segment, and
     trackEvent()/sendToSegment() stubbed to no-ops. The stub block below says the rest. Nothing on
     this page reports to anything — do not read a signup count off it.`
  : `     ORDER MATTERS. The analytics block must run before the behaviour block: trackEvent() and
     sendToSegment() are defined there and called throughout the behaviours. Both are in this one
     field, in the right order, so keep them together.

     THE MIXPANEL FALLBACK DOES NOT NO-OP ON WEBFLOW. Measured 14 Aug 2026 against the live site:
     Webflow's SITE footer custom code already initialises Mixpanel on token 1542ee…d3d1 with
     track_pageview:false and then fires track_pageview() manually. This block's guard only skips
     its own init when \`mixpanel\` is already defined, so whichever of the two footer fields runs
     first wins — and if this one does, the page initialises with track_pageview:true and the
     site-wide block then fires a second pageview. That is two pageviews per visit on the one page
     whose entire output is a signup count. Verify the order in the published HTML before trusting
     it, or build with --no-analytics and let someone wire this deliberately.

     YG_IS_PROD gates on a yourgi.com host. The live page is served from www.yourgi.com (the site's
     webflow.yourgipet.com domain hard-redirects there in site head code), so the gate PASSES in
     production and events are not test-tagged. A webflow.io staging domain still tags every event
     test_mode:true and suppresses Segment identify() entirely, which is correct and deliberate —
     while testing on staging, check the console for '[preview] Segment suppressed' instead.`;

const FOOTER = `<!-- YOURGI PLUS — page footer custom code (before </body>).
     GENERATED by node webflow/build.mjs from index.html. Do not edit; edit the page and re-run.

     Webflow: Page settings > Custom code > Before </body> tag.

${ANALYTICS_NOTES} -->
${ANALYTICS}
<script>
${js}
</script>`;

const EMBED_COMPARE = `<!-- YOURGI PLUS — comparison table.
     GENERATED by node webflow/build.mjs from index.html. Do not edit; edit the page and re-run.

     Webflow: this must be an Embed element. Webflow Designer has no table element, so the whole
     table is markup — there is no Designer-native version of this section to build.

     <tbody id="cmp-body"> is left EMPTY on purpose: the footer behaviour script fills it from
     PLAN_UNITS, which is the same config the plan tiles read. That is why the tiles and the table
     can never disagree about a price. Do not type rows in here.

     Drop this inside a container capped at 820px to match the page. -->
${compareShell}`;

/* ---- write and report --------------------------------------------------------------------- */

fs.mkdirSync(DIST, { recursive: true });
const files = [
  ['head-code.html', HEAD, 'Page settings > Inside <head> tag'],
  ['footer-code.js', FOOTER, 'Page settings > Before </body> tag'],
  ['embed-compare-table.html', EMBED_COMPARE, 'Embed element, in the Compare section'],
];
for (const [name, body] of files) fs.writeFileSync(path.join(DIST, name), body + '\n');

console.log('\n  Generated webflow/dist/ from index.html');
console.log(NO_ANALYTICS
  ? '  ANALYTICS: OMITTED (--no-analytics). No Mixpanel, no Segment, trackEvent/sendToSegment stubbed.\n'
  : '  ANALYTICS: INCLUDED. Read the footer block comment about the double-count before pasting.\n');
const pad = (s, n) => String(s).padEnd(n);
console.log(`  ${pad('FILE', 28)}${pad('CHARS', 10)}${pad('OF 50k', 9)}WHERE IT GOES`);
console.log('  ' + '-'.repeat(96));
let total = 0;
for (const [name, body, where] of files) {
  total += body.length;
  const pct = Math.round((body.length / LIMIT) * 100);
  const flag = body.length > LIMIT ? '  ** OVER LIMIT **' : '';
  console.log(`  ${pad(name, 28)}${pad(body.length.toLocaleString(), 10)}${pad(pct + '%', 9)}${where}${flag}`);
}
console.log('  ' + '-'.repeat(96));
console.log(`  ${pad('TOTAL', 28)}${pad(total.toLocaleString(), 10)}${pad(Math.round((total / LIMIT) * 100) + '%', 9)}(if the 50k limit is an aggregate, this is the number that matters)`);

const savedJs = behaviour.length - js.length;
const savedCss = cssRaw.length - css.length;
console.log(`\n  Comments stripped: ${savedCss.toLocaleString()} chars of CSS, ${savedJs.toLocaleString()} of JS.`);
console.log(`  The annotated JS is ${behaviour.length.toLocaleString()} chars — ${Math.round((behaviour.length / LIMIT) * 100)}% of the limit on its own,`);
console.log('  which is why it is stripped here and kept in git. Read the reasoning in index.html.');

if (total > LIMIT) {
  console.log('\n  If the limit turns out to be an aggregate, split the behaviour script into a');
  console.log('  self-hosted file and reference it with <script src>. See webflow/README.md.');
}
console.log('');
