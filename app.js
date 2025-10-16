{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fmodern\fcharset0 Courier;}
{\colortbl;\red255\green255\blue255;\red0\green0\blue0;}
{\*\expandedcolortbl;;\cssrgb\c0\c0\c0;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs26 \cf0 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 // Client-side heuristic analysis based on Wellcome ECA & Discovery Research remit.\
// No external calls \'96 runs entirely in-browser.\
\
const el = id => document.getElementById(id);\
\
const analyzeBtn = el('analyzeBtn');\
const results = el('results');\
const exportBtn = el('exportBtn');\
const resetBtn = el('resetBtn');\
\
analyzeBtn.addEventListener('click', runAnalysis);\
exportBtn.addEventListener('click', () => window.print());\
resetBtn.addEventListener('click', () => \{\
  document.getElementById('checkerForm').reset();\
  results.classList.add('hidden');\
\});\
\
function runAnalysis() \{\
  const summary = el('summary').value.trim();\
  const discipline = el('discipline').value;\
  const involvesHumans = el('involvesHumans').checked;\
  const usesAnimals = el('usesAnimals').checked;\
\
  const training = el('training').value;\
  const postdocYears = parseFloat(el('postdocYears').value || '0');\
  const timePct = parseFloat(el('timePct').value || '0');\
  const orgLoc = el('orgLoc').value;\
  const coapps = el('coapplicants').value === 'yes';\
\
  const trialFocus = el('trialFocus').value === 'Yes';\
  const diagnosticFocus = el('diagnosticFocus').value === 'Yes';\
  const animalOut = el('animalOut').value === 'Yes';\
  const standalone = el('standalone').value === 'Yes';\
\
  // Eligibility score (0-100)\
  let elig = 100; const eligReasons = [];\
  if (training === 'none') \{ elig -= 50; eligReasons.push('Needs PhD or \uc0\u8805 4 years equivalent research experience.'); \}\
  if (postdocYears > 3)   \{ elig -= 10; eligReasons.push('Postdoctoral experience >3 years \'96 add context (breaks, part\uc0\u8209 time, discipline change).'); \}\
  if (timePct < 80)       \{ elig -= 25; eligReasons.push('Commit at least 80% of research time to the project (\uc0\u8804 20% other duties).'); \}\
  if (orgLoc === 'india' || orgLoc === 'china') \{\
    elig -= 100; eligReasons.push('Administering organisation location is ineligible for ECA.');\
  \}\
  if (coapps) \{ elig -= 25; eligReasons.push('Co\uc0\u8209 applicants are not accepted for the Early\u8209 Career Award.'); \}\
  elig = clamp(elig);\
\
  // Remit fit (0-100)\
  let remit = 100; const remitReasons = [];\
  if (trialFocus || /randomi(s|z)ed|phase\\s?(I\{1,3\}|iv|2|3)/i.test(summary)) \{\
    remit -= 35; remitReasons.push('Large clinical trial / efficacy\uc0\u8209 testing focus \'96 Discovery remit prioritises understanding/mechanism.');\
  \}\
  if (diagnosticFocus || /(diagnostic|screening|clinical decision support|triage)\\b/i.test(summary)) \{\
    remit -= 25; remitReasons.push('Primary aim appears diagnostic/clinical\uc0\u8209 care oriented \'96 emphasise benefits to research understanding or methods.');\
  \}\
  if (animalOut) \{\
    remit -= 40; remitReasons.push('Animal disease not relevant to humans \'96 out of remit unless zoonotic or a model for human biology.');\
  \}\
  if (standalone || (/(database|registry|repository)\\b/i.test(summary) && !/(research question|hypothes|aim)/i.test(summary))) \{\
    remit -= 20; remitReasons.push('Stand\uc0\u8209 alone resource without clear research questions \'96 only in remit if integral to answering them.');\
  \}\
  const posTerms = /(mechanism|causal|pathophysiology|fundamental|novel method|framework|tool|conceptual|theoretical|insight|understanding|hypothesis|explor(e|atory))/i;\
  if (posTerms.test(summary)) remit += 5;\
  remit = clamp(remit);\
\
  // Assessment heuristics\
  const len = summary.split(/\\s+/).filter(Boolean).length;\
  const hasAims    = /(aim|objective|we propose|we will)/i.test(summary);\
  const hasMethods = /(method|approach|data|model|experiment|fieldwork|analysis|sample|cohort|interview|ethnograph|survey)/i.test(summary);\
  const hasRisks   = /(risk|limitation|challenge|mitigat)/i.test(summary);\
  const hasTeam    = /(mentor|sponsor|collaborat|training|skills|develop)/i.test(summary);\
  const hasEnv     = /(environment|host|facilit(y|ies)|infrastructure|culture|inclusive|open|data sharing)/i.test(summary);\
  const novelty    = /(novel|first|innovative|creative|new|advance)/i.test(summary);\
\
  let prop = 10;\
  prop += hasAims ? 25 : 0;\
  prop += hasMethods ? 25 : 0;\
  prop += novelty ? 15 : 0;\
  prop += hasRisks ? 15 : 0;\
  prop += (len > 200 ? 10 : 0);\
  prop = Math.min(100, prop);\
\
  let skills = 10;\
  skills += hasTeam ? 40 : 0;\
  skills += (postdocYears <= 3 ? 10 : 5);\
  skills += (training !== 'none' ? 20 : 0);\
  skills = Math.min(100, skills);\
\
  let env = 10;\
  env += hasEnv ? 60 : 0;\
  env = Math.min(100, env);\
\
  // Strengths & risks\
  const strengths = [], risks = [];\
  if (novelty) strengths.push('Signals of novelty/creativity are present.');\
  if (hasMethods) strengths.push('Methods/approach described.');\
  if (hasRisks) strengths.push('Risks/mitigations acknowledged.');\
  if (hasTeam) strengths.push('Development/training/collaboration elements referenced.');\
  if (hasEnv) strengths.push('Positive research environment and culture cues.');\
\
  if (!hasAims)   risks.push('Make the aims/objectives explicit and succinct.');\
  if (!hasMethods) risks.push('Describe the methodology and why it\'92s the right approach.');\
  if (!hasRisks)  risks.push('Add key risks/uncertainties and mitigations.');\
  if (remit < 70) risks.push('Reframe to emphasise discovery\uc0\u8209 led understanding/mechanism.');\
  if (elig < 70)  risks.push('Address eligibility gaps (training, time commitment, co\uc0\u8209 applicants, admin org).');\
\
  // Render\
  results.classList.remove('hidden');\
  renderScore('elig', elig, eligReasons);\
  renderScore('remit', remit, remitReasons);\
  el('propProg').value = prop;\
  el('skillsProg').value = skills;\
  el('envProg').value = env;\
\
  el('assessNotes').innerHTML =\
    `<li>Proposal ~$\{len\} words; heuristic quality score $\{Math.round(prop)\}.</li>` +\
    `<li>Skills/experience proxy $\{Math.round(skills)\}; Environment proxy $\{Math.round(env)\}.</li>`;\
\
  el('strengths').innerHTML = strengths.map(li).join('') || '<li>\'97</li>';\
  el('risks').innerHTML     = risks.map(li).join('')     || '<li>\'97</li>';\
\
  const sugg = [];\
  if (!hasAims)    sugg.push('Add a short opening paragraph with a <strong>bold, discovery\uc0\u8209 led question</strong> and 2\'963 concise aims.');\
  if (!hasMethods) sugg.push('Outline key <strong>methods/approach</strong> and why they are the best way to answer the discovery question.');\
  if (!/insight|understanding|mechanism/i.test(summary)) sugg.push('State the <strong>new knowledge/insight</strong> expected and how it shifts understanding.');\
  if (!hasRisks)   sugg.push('List <strong>main risks/uncertainties</strong> and brief mitigations.');\
  if (!hasTeam)    sugg.push('Mention <strong>training/skills development</strong> and any collaborators\'92 contributions.');\
  if (!hasEnv)     sugg.push('Reference your <strong>research environment</strong> and an <strong>inclusive, open research culture</strong> (data sharing, engagement).');\
  if (trialFocus || diagnosticFocus) sugg.push('Clarify any trial/diagnostic work probes <strong>mechanism</strong> or <strong>proof\uc0\u8209 of\u8209 concept</strong> within a discovery programme.');\
\
  el('suggestions').innerHTML = sugg.map(s => `<li>$\{s\}</li>`).join('') ||\
    '<li>Looks good. Consider tightening for clarity and cohesion.</li>';\
\}\
\
function renderScore(prefix, score, reasons) \{\
  el(prefix + 'Score').textContent = score;\
  el(prefix + 'Reasons').innerHTML = reasons.length\
    ? reasons.map(li).join('')\
    : '<li>No major issues detected.</li>';\
\}\
\
function li(text) \{\
  return `<li>$\{escapeHtml(text)\}</li>`;\
\}\
\
function escapeHtml(str) \{\
  return str.replace(/[&<>"']/g, s => (\{\
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'\
  \}[s]));\
\}\
\
function clamp(n) \{ return Math.max(0, Math.min(100, n)); \}\
}