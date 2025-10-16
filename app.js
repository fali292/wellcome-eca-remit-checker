/* ========= ECA Remit Checker — robust external JS ========= */

const RULES = {
  version: "Wellcome ECA · 2025-10",
  eligibility: {
    training: { needOneOf: ["phd","equiv"], weightFail: 50 },
    minTimePct: { value: 80, weightFail: 25 },
    coApplicants: { accepted:false, weightFail: 25 },
    admin: { allow:["uk","roi","lmics"], ban:["india","china"], weightFail:100 },
    transferBanChina: { active:true, weightFail:100 },
    maxPostdocYears: { value:3, weightCaution:10 }
  },
  remit: {
    base: 80,
    positives: [
      { p:"mechanism", w:+5 },{ p:"causal", w:+4 },{ p:"pathophysiology", w:+4 },
      { p:"fundamental", w:+3 },{ p:"novel method", w:+3 },{ p:"conceptual framework", w:+3 },
      { p:"tool", w:+2 },{ p:"theoretical", w:+2 },{ p:"insight", w:+2 },
      { p:"understanding", w:+3 },{ p:"hypothesis", w:+2 },{ p:"exploratory", w:+2 },
      { p:"needs of communities", w:+2 },{ p:"social context", w:+2 },{ p:"historical context", w:+2 },{ p:"ethical context", w:+2 }
    ],
    negatives: [
      { n:"randomized", w:-15 },{ n:"randomised", w:-15 },
      { n:"phase ii", w:-15 },{ n:"phase iii", w:-15 },{ n:"multicentre trial", w:-12 },
      { n:"clinical decision support", w:-12 },{ n:"diagnostic", w:-12 },{ n:"screening", w:-10 },
      { n:"standalone database", w:-10 },{ n:"stand-alone database", w:-10 },{ n:"registry", w:-8 },{ n:"repository", w:-8 },
      { n:"veterinary-only", w:-15 },{ n:"animal disease not relevant to humans", w:-15 }
    ]
  }
};

// ---------- tiny utilities ----------
const $ = (id) => document.getElementById(id);
const clamp = (n) => Math.max(0, Math.min(100, n));
const unique = (arr) => [...new Set(arr)];
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const list = (arr, allowEmpty=false) => (!arr||!arr.length) ? (allowEmpty?'<li>—</li>':'<li>No major issues detected.</li>') : arr.map(s=>`<li>${escapeHtml(s)}</li>`).join('');
const parseMaybe = (v) => { const n = parseFloat(v); return Number.isFinite(n)?n:NaN; };
const toast = (msg) => { const t=$('toast'); if(!t) return; t.textContent=msg; t.style.display='block'; clearTimeout(t._h); t._h=setTimeout(()=>t.style.display='none', 2500); };

// ---------- text inference to avoid “always eligible” defaults ----------
function inferFromText(text){
  const timeMatch = text.match(/\b([1-9]\d)\s*%(\s*(fte|time|effort))?\b/i);
  const timeUnder80 = !!(timeMatch && parseInt(timeMatch[1],10) < 80);
  return {
    coApplicantsLikely: /(co[-\s]?applicant|co[-\s]?investigator|co[-\s]?pi|consortium|multi[-\s]centre|multi[-\s]center|team of (investigators|applicants))/i.test(text),
    adminIndia: /\b(administer|host|affiliat\w*)\b/i.test(text) && /\bindia\b/i.test(text),
    adminChina: /\b(administer|host|affiliat\w*|transfer)\b/i.test(text) && /\b(mainland china|people'?s republic of china|prc)\b/i.test(text),
    transferToChina: /\btransfer( of)? (grant )?funds (to|into) (mainland )?china\b/i.test(text),
    postdocOver3: /\b(postdoc(toral)? (experience )?(over|more than|> ?)?3 (years|yrs))\b/i.test(text),
    timeUnder80
  };
}

// ---------- wire up after DOM is ready ----------
document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = $('analyzeBtn');
  const exportBtn  = $('exportBtn');
  const resetBtn   = $('resetBtn');
  const results    = $('results');
  const badge      = $('rulesBadge');

  if (!analyzeBtn || !exportBtn || !resetBtn || !results) {
    console.error('[ECA] Missing DOM nodes. Check element ids.');
    toast('Script loaded, but some elements were missing. Hard-refresh (Cmd/Ctrl+Shift+R)?');
    return;
  }

  if (badge) badge.textContent = `Ruleset: ${RULES.version}`;
  analyzeBtn.addEventListener('click', runAnalysis);
  exportBtn.addEventListener('click', () => window.print());
  resetBtn.addEventListener('click', () => { $('checkerForm')?.reset(); results.classList.add('hidden'); });

  console.log('[ECA] Handlers attached.');
});

// ---------- main analysis ----------
function runAnalysis(){
  const results = $('results');
  const analyzeBtn = $('analyzeBtn');
  const sEl = $('summary');
  const s = (sEl?.value || '').trim();

  if (!s) { sEl?.focus(); toast('Please paste a short proposal summary first.'); return; }

  const prev = analyzeBtn.textContent;
  analyzeBtn.disabled = true; analyzeBtn.textContent = 'Analysing…';

  try {
    const training     = $('training')?.value || 'unknown';
    const postdocYears = parseMaybe($('postdocYears')?.value || '');
    const timePct      = parseMaybe($('timePct')?.value || '');
    const orgLoc       = $('orgLoc')?.value || 'unknown';
    const coapps       = $('coapplicants')?.value || 'unknown';
    const inf          = inferFromText(s);

    // --- Eligibility
    let elig = 100; const eNotes = []; const need = [];
    if (training === 'unknown') need.push('Career training');
    else if (training === 'none'){ elig -= RULES.eligibility.training.weightFail; eNotes.push('Needs PhD or ≥4 years’ equivalent research experience.'); }

    if (!isFinite(postdocYears)){
      if (inf.postdocOver3){ elig -= RULES.eligibility.maxPostdocYears.weightCaution; eNotes.push('Text suggests >3y postdoc – add context.'); }
      else need.push('Postdoctoral experience (years)');
    } else if (postdocYears > RULES.eligibility.maxPostdocYears.value){
      elig -= RULES.eligibility.maxPostdocYears.weightCaution; eNotes.push('>3y postdoc – add context (breaks, part‑time, discipline change).');
    }

    if (!isFinite(timePct)){
      if (inf.timeUnder80){ elig -= RULES.eligibility.minTimePct.weightFail; eNotes.push('Text implies <80% time — ECA expects ≥80%.'); }
      else need.push('Time on project (%)');
    } else if (timePct < RULES.eligibility.minTimePct.value){
      elig -= RULES.eligibility.minTimePct.weightFail; eNotes.push('Commit at least 80% research time (≤20% other duties).');
    }

    const allow = RULES.eligibility.admin.allow, ban = RULES.eligibility.admin.ban;
    if (orgLoc === 'unknown'){
      need.push('Administering organisation');
      if (inf.adminIndia){ elig -= RULES.eligibility.admin.weightFail; eNotes.push('Admin org appears in India — ineligible.'); }
      if (inf.adminChina){ elig -= RULES.eligibility.admin.weightFail; eNotes.push('Admin org appears in mainland China — ineligible.'); }
    } else {
      if (ban.includes(orgLoc)){ elig -= RULES.eligibility.admin.weightFail; eNotes.push('Admin org in restricted location (India or mainland China).'); }
      else if (!allow.includes(orgLoc)){ eNotes.push('Admin org location unclear — ECA typically UK/ROI/LMICs.'); }
    }

    if (inf.transferToChina){ elig -= RULES.eligibility.transferBanChina.weightFail; eNotes.push('Transfer of grant funds into mainland China — ineligible.'); }

    if (coapps === 'unknown'){
      need.push('Co‑applicants (ECA)');
      if (inf.coApplicantsLikely){ elig -= RULES.eligibility.coApplicants.weightFail; eNotes.push('Text suggests co‑applicants/consortium — ECA is for a single lead applicant.'); }
    } else if (coapps === 'yes'){
      elig -= RULES.eligibility.coApplicants.weightFail; eNotes.push('Co‑applicants are not accepted for the Early‑Career Award.');
    }

    if (need.length && elig > 0) eNotes.unshift(`Eligibility is provisional — please provide: ${need.join(', ')}.`);
    elig = clamp(elig);

    // --- Remit
    let remit = RULES.remit.base;
    const rNotes = []; const lower = s.toLowerCase();

    for (const p of RULES.remit.positives) if (lower.includes(p.p)){ remit += p.w; rNotes.push(`Positive remit cue: “${p.p}”.`); }
    const negHit = [];
    for (const n of RULES.remit.negatives) if (lower.includes(n.n)){ remit += n.w; negHit.push(n); rNotes.push(`Out‑of‑remit cue: “${n.n}”.`); }
    if (negHit.length && /(mechanism|mechanistic|proof[- ]of[- ]concept)/i.test(s)){ remit += 6; rNotes.push('Mechanistic/PoC framing detected — softened penalty.'); }

    remit = clamp(remit);

    // --- Assessment heuristics
    const len        = s.split(/\s+/).filter(Boolean).length;
    const hasAims    = /(aim|objective|we propose|we will)/i.test(s);
    const hasMethods = /(method|approach|data|model|experiment|fieldwork|analysis|sample|cohort|interview|ethnograph|survey)/i.test(s);
    const hasRisks   = /(risk|limitation|challenge|mitigat)/i.test(s);
    const hasTeam    = /(mentor|sponsor|collaborat|training|skills|develop)/i.test(s);
    const hasEnv     = /(environment|host|facilit(y|ies)|infrastructure|culture|inclusive|open|data sharing)/i.test(s);
    const novelty    = /(novel|first|innovative|creative|new|advance)/i.test(s);

    let prop=10; prop+=hasAims?25:0; prop+=hasMethods?25:0; prop+=novelty?15:0; prop+=hasRisks?15:0; prop+=(len>200?10:0); prop=Math.min(100,prop);
    let skills=10; skills+=hasTeam?40:0; skills+=(!isFinite(postdocYears)||postdocYears<=3?10:5); skills+=(training!=='none'&&training!=='unknown'?20:0); skills=Math.min(100,skills);
    let env=10; env+=hasEnv?60:0; env=Math.min(100,env);

    // --- Render
    results.classList.remove('hidden');
    $('eligScore').textContent  = Math.round(elig);
    $('eligReasons').innerHTML  = list(unique(eNotes), false);
    $('remitScore').textContent = Math.round(remit);
    $('remitReasons').innerHTML = list(unique(rNotes), false);
    $('propProg').value = prop; $('skillsProg').value = skills; $('envProg').value = env;
    $('assessNotes').innerHTML =
      `<li>Proposal ~${len} words; heuristic quality score ${Math.round(prop)}.</li>`+
      `<li>Skills/experience proxy ${Math.round(skills)}; Environment proxy ${Math.round(env)}.</li>`;

    const strengths=[], risks=[];
    if(novelty) strengths.push('Signals of novelty/creativity are present.');
    if(hasMethods) strengths.push('Methods/approach described.');
    if(hasRisks) strengths.push('Risks/mitigations acknowledged.');
    if(hasTeam) strengths.push('Development/training/collaboration elements referenced.');
    if(hasEnv) strengths.push('Positive research environment and culture cues.');
    if(!hasAims)   risks.push('Make the aims/objectives explicit and succinct.');
    if(!hasMethods) risks.push('Describe the methodology and why it’s the right approach.');
    if(!hasRisks)  risks.push('Add key risks/uncertainties and mitigations.');
    if(remit<70)   risks.push('Reframe to emphasise discovery‑led understanding/mechanism.');
    if(elig<70)    risks.push('Address eligibility gaps (training, time commitment, co‑applicants, admin org).');
    $('strengths').innerHTML = list(strengths,true);
    $('risks').innerHTML     = list(risks,true);

    const sugg=[];
    if(!hasAims)    sugg.push('Open with a <strong>bold, discovery‑led question</strong> and 2–3 concise aims.');
    if(!hasMethods) sugg.push('Outline key <strong>methods/approach</strong> and why they best answer the question.');
    if(!/insight|understanding|mechanism/i.test(s)) sugg.push('State the <strong>new knowledge/insight</strong> expected and how it shifts understanding.');
    if(!hasRisks)   sugg.push('List <strong>main risks/uncertainties</strong> and brief mitigations.');
    if(!hasTeam)    sugg.push('Mention <strong>training/skills development</strong> and any collaborators’ roles.');
    if(!hasEnv)     sugg.push('Reference your <strong>research environment</strong> and an <strong>inclusive, open culture</strong>.');
    if(/(randomi[sz]ed|phase\s?(I{1,3}|iv|2|3)\b|trial|efficacy|diagnostic|screening)/i.test(s))
      sugg.push('If any trial/diagnostic elements exist, position them to probe <strong>mechanism</strong> or early <strong>proof‑of‑concept</strong> within a discovery‑led programme.');
    $('suggestions').innerHTML = sugg.length ? sugg.map(x=>`<li>${x}</li>`).join('') : '<li>Looks good. Consider minor tightening for clarity.</li>';

    results.scrollIntoView({behavior:'smooth', block:'start'});
  } catch (e){
    console.error(e);
    toast('Something went wrong while analysing. See console for details.');
  } finally {
    analyzeBtn.disabled = false; analyzeBtn.textContent = prev;
  }
}

// Expose for quick console diagnostics (optional)
window.runAnalysis = runAnalysis;
