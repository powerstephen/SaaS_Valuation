// ---------- Build stamp ----------
const $ = (id) => document.getElementById(id);
const setTxt = (id, v) => { const el = $(id); if (el) el.textContent = v; };
setTxt('build', new Date().toISOString());

// ---------- Helpers ----------
const fmt = (n, cur='€') => cur + Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

// ---------- State (defaults tuned to Series A/B) ----------
const state = {
  step: 1,
  inputs: {
    currency: '€',
    stage: 'Series A',          // Seed/Pre-A, Series A, Series B, Growth
    sector: 'Logistics SaaS',   // Logistics SaaS, Sustainability SaaS, Other
    arr: 5000000,               // Annual Recurring Revenue
    growth: 80,                 // YoY growth %
    nrr: 115,                   // Net Revenue Retention %
    grossMargin: 75,            // %
    ebitMargin: -20,            // %
    cacPayback: 14,             // months
    burnMultiple: 1.6,          // Net Burn / Net New ARR
    customers: 120              // count (contextual)
  },
  levers: {
    sectorPremiumPct: 0,        // auto-set from sector
    ruleOf40AdjPct: 0,          // auto-set from Rule of 40
    burnAdjPct: 0,              // auto-set from burn multiple
    qualityAdjPct: 0,           // manual extra (+/-)
  }
};

// ---------- Core scoring / multiples ----------
function baseMultipleForStage(stage){
  switch(stage){
    case 'Seed / Pre-A': return 7;        // mid of 5–8×
    case 'Series A':     return 10;       // mid of 8–12×
    case 'Series B':     return 12.5;     // mid of 10–15×
    case 'Growth':       return 8;        // mid of 6–10×
    default:             return 9;
  }
}

function sectorPremium(sector){
  if (sector === 'Sustainability SaaS') return 0.18; // +18%
  if (sector === 'Logistics SaaS')      return 0.12; // +12%
  return 0.00;
}

function ruleOf40(growth, ebitMargin){
  return Number(growth||0) + Number(ebitMargin||0);
}

function ruleOf40Adj(r40){
  if (r40 >= 40) return 0.20;  // +20%
  if (r40 >= 20) return 0.10;  // +10%
  if (r40 < 0)   return -0.10; // -10%
  return 0.00;
}

function burnAdj(burnMultiple){
  if (burnMultiple <= 1.0) return 0.15;     // +15% (excellent efficiency)
  if (burnMultiple <= 1.5) return 0.10;     // +10%
  if (burnMultiple <= 2.0) return 0.00;
  if (burnMultiple <= 3.0) return -0.10;
  return -0.20;
}

function qualityBand(nrr, gm, payback){
  // Simple health descriptors for context in UI
  const nrrBand = (nrr>=120)?'Excellent':(nrr>=110)?'Strong':(nrr>=100)?'OK':'At-risk';
  const gmBand  = (gm>=80)?'Elite':(gm>=70)?'Healthy':(gm>=60)?'OK':'Thin';
  const pbBand  = (payback<=12)?'Fast':(payback<=18)?'Reasonable':'Slow';
  return {nrrBand, gmBand, pbBand};
}

// ---------- Compute valuation ----------
function compute(i, l){
  const base = baseMultipleForStage(i.stage);

  // Auto-dials
  const sec = sectorPremium(i.sector);                 l.sectorPremiumPct = sec*100;
  const r40 = ruleOf40(i.growth, i.ebitMargin);        l.ruleOf40AdjPct   = ruleOf40Adj(r40)*100;
  const bAdj= burnAdj(i.burnMultiple);                 l.burnAdjPct       = bAdj*100;

  // Manual quality adj (entered as +/- % in UI, but stored here as fraction)
  const manual = clamp(Number(l.qualityAdjPct||0), -30, 30)/100;

  // Combined multiple
  const multiplier =
    base *
    (1 + sec) *
    (1 + ruleOf40Adj(r40)) *
    (1 + bAdj) *
    (1 + manual);

  // Guardrails
  const minMult = base * 0.6;
  const maxMult = base * 1.8;
  const adjMult = clamp(multiplier, minMult, maxMult);

  const impliedVal = i.arr * adjMult;

  // Bands (±15% around adj multiple)
  const lowMult  = adjMult * 0.85;
  const highMult = adjMult * 1.15;

  return {
    baseMultiple: base,
    adjMultiple: adjMult,
    lowMultiple: lowMult,
    highMultiple: highMult,
    impliedVal,
    lowVal:  i.arr * lowMult,
    highVal: i.arr * highMult,
    r40,
    bands: qualityBand(i.nrr, i.grossMargin, i.cacPayback)
  };
}

// ---------- Views ----------
function screenInputs(i){
  return `
    <section class="card">
      <h2>Company Profile</h2>
      <div class="grid3">
        <div><label>Currency symbol</label><input id="currency" value="${i.currency}" maxlength="3"></div>
        <div>
          <label>Stage</label>
          <select id="stage">
            <option ${i.stage==='Seed / Pre-A'?'selected':''}>Seed / Pre-A</option>
            <option ${i.stage==='Series A'?'selected':''}>Series A</option>
            <option ${i.stage==='Series B'?'selected':''}>Series B</option>
            <option ${i.stage==='Growth'?'selected':''}>Growth</option>
          </select>
        </div>
        <div>
          <label>Sector</label>
          <select id="sector">
            <option ${i.sector==='Logistics SaaS'?'selected':''}>Logistics SaaS</option>
            <option ${i.sector==='Sustainability SaaS'?'selected':''}>Sustainability SaaS</option>
            <option ${i.sector==='Other'?'selected':''}>Other</option>
          </select>
        </div>
      </div>
      <div class="grid3" style="margin-top:6px">
        <div><label>ARR</label><input id="arr" type="number" min="0" step="50000" value="${i.arr}"></div>
        <div><label>YoY Growth %</label><input id="growth" type="number" step="1" value="${i.growth}"></div>
        <div><label>NRR %</label><input id="nrr" type="number" step="1" value="${i.nrr}"></div>
      </div>
      <div class="grid3" style="margin-top:6px">
        <div><label>Gross Margin %</label><input id="grossMargin" type="number" step="1" value="${i.grossMargin}"></div>
        <div><label>EBIT Margin %</label><input id="ebitMargin" type="number" step="1" value="${i.ebitMargin}"></div>
        <div><label>CAC Payback (months)</label><input id="cacPayback" type="number" step="1" value="${i.cacPayback}"></div>
      </div>
      <div class="grid3" style="margin-top:6px">
        <div><label>Burn Multiple</label><input id="burnMultiple" type="number" step="0.1" value="${i.burnMultiple}"></div>
        <div><label>Customers (context)</label><input id="customers" type="number" step="1" value="${i.customers}"></div>
        <div></div>
      </div>
    </section>
    <div class="rowbtn">
      <span></span>
      <button class="btn" id="continue1">Continue</button>
    </div>
  `;
}

function screenLevers(i, l){
  // Show auto-adjustments + allow manual tweak
  return `
    <section class="card">
      <h2>Adjustments & Presets</h2>
      <div class="grid2">
        <div>
          <label>Sector Premium (auto)</label>
          <input id="sectorPremiumPct" type="number" step="1" value="${l.sectorPremiumPct}" disabled>
        </div>
        <div>
          <label>Rule of 40 Adjustment (auto)</label>
          <input id="ruleOf40AdjPct" type="number" step="1" value="${l.ruleOf40AdjPct}" disabled>
        </div>
      </div>
      <div class="grid2" style="margin-top:6px">
        <div>
          <label>Burn Efficiency Adjustment (auto)</label>
          <input id="burnAdjPct" type="number" step="1" value="${l.burnAdjPct}" disabled>
        </div>
        <div>
          <label>Manual Quality Adjustment (+/- %)</label>
          <input id="qualityAdjPct" type="number" step="1" value="${l.qualityAdjPct}">
        </div>
      </div>

      <div class="card" style="margin-top:12px">
        <h2>Presets</h2>
        <div class="grid2">
          <div>
            <button class="btn" id="presetLog">Logistics — Efficient Growth</button>
            <p class="subtitle" style="margin:6px 0 0;opacity:.8">ARR €5–10M, Growth 60–90%, NRR 115–125%, Burn ≤1.5×</p>
          </div>
          <div>
            <button class="btn" id="presetSust">Sustainability — Premium Retention</button>
            <p class="subtitle" style="margin:6px 0 0;opacity:.8">ARR €3–8M, Growth 70–100%, NRR 120–130%, Burn ≤1.2×</p>
          </div>
        </div>
      </div>
    </section>

    <div class="rowbtn">
      <button class="btn" id="back2">Back</button>
      <button class="btn" id="continue2">Continue</button>
    </div>
  `;
}

function screenResults(i, l){
  const o = compute(i, l);
  return `
    <section class="card">
      <h2>Valuation</h2>
      <div class="kpi"><div class="lab">Base ARR Multiple (${i.stage})</div><div class="val">${o.baseMultiple.toFixed(1)}×</div></div>
      <div class="kpi"><div class="lab">Adjusted Multiple</div><div class="val big good">${o.adjMultiple.toFixed(2)}×</div></div>
      <div class="kpi"><div class="lab">Implied Valuation</div><div class="val big">${fmt(o.impliedVal, i.currency)}</div></div>
      <div class="kpi"><div class="lab">Valuation Band</div><div class="val">${o.lowMultiple.toFixed(1)}× – ${o.highMultiple.toFixed(1)}×</div></div>
      <div class="kpi"><div class="lab">Band (Low → High)</div><div class="val">${fmt(o.lowVal,i.currency)} → ${fmt(o.highVal,i.currency)}</div></div>
    </section>

    <section class="card">
      <h2>Health Snapshot</h2>
      <div class="kpi"><div class="lab">Rule of 40</div><div class="val ${o.r40>=40?'good':(o.r40<0?'warn':'')}">${o.r40.toFixed(0)}%</div></div>
      <div class="kpi"><div class="lab">NRR</div><div class="val">${i.nrr}% <span class="muted">(${o.bands.nrrBand})</span></div></div>
      <div class="kpi"><div class="lab">Gross Margin</div><div class="val">${i.grossMargin}% <span class="muted">(${o.bands.gmBand})</span></div></div>
      <div class="kpi"><div class="lab">CAC Payback</div><div class="val">${i.cacPayback} mo <span class="muted">(${o.bands.pbBand})</span></div></div>
      <div class="kpi"><div class="lab">Burn Multiple</div><div class="val">${i.burnMultiple.toFixed(1)}×</div></div>
    </section>

    <div class="rowbtn">
      <div>
        <button class="btn" id="back3">Back</button>
        <button class="btn" id="restart">Start Over</button>
      </div>
      <button class="btn" id="download">Download CSV</button>
    </div>
  `;
}

// ---------- Wiring ----------
function bindInputs(){
  // Any input / select change → state
  document.querySelectorAll('input,select').forEach(el=>{
    el.addEventListener('input', e=>{
      const id = e.target.id;
      const val = (e.target.type === 'number') ? +e.target.value : e.target.value;
      if (id in state.inputs) state.inputs[id] = val;
      if (id in state.levers) state.levers[id] = val;
    });
  });
}

function bindNav(){
  const c1 = $('continue1'); if (c1) c1.addEventListener('click', ()=>setStep(2));
  const b2 = $('back2');     if (b2) b2.addEventListener('click', ()=>setStep(1));
  const c2 = $('continue2'); if (c2) c2.addEventListener('click', ()=>setStep(3));
  const b3 = $('back3');     if (b3) b3.addEventListener('click', ()=>setStep(2));
  const rs = $('restart');   if (rs) rs.addEventListener('click', ()=>{ /* reset to defaults */; });

  // Download CSV
  const dl = $('download');
  if (dl) dl.addEventListener('click', ()=>{
    const i = state.inputs, l = state.levers, o = compute(i,l);
    const rows = [
      ['Field','Value'],
      ['Currency', i.currency],
      ['Stage', i.stage],
      ['Sector', i.sector],
      ['ARR', i.arr],
      ['YoY Growth %', i.growth],
      ['NRR %', i.nrr],
      ['Gross Margin %', i.grossMargin],
      ['EBIT Margin %', i.ebitMargin],
      ['CAC Payback (months)', i.cacPayback],
      ['Burn Multiple', i.burnMultiple],
      ['Base Multiple', o.baseMultiple.toFixed(2)],
      ['Adjusted Multiple', o.adjMultiple.toFixed(2)],
      ['Implied Valuation', Math.round(o.impliedVal)],
      ['Low Valuation', Math.round(o.lowVal)],
      ['High Valuation', Math.round(o.highVal)]
    ];
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'saas-valuation-dn.csv';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 400);
  });
}

function bindPresets(){
  const log = $('presetLog');
  if (log) log.addEventListener('click', ()=>{
    Object.assign(state.inputs, {
      sector:'Logistics SaaS', stage:'Series A',
      arr: 7000000, growth: 75, nrr: 118, grossMargin: 72, ebitMargin:-15,
      cacPayback: 14, burnMultiple: 1.4, customers: 150
    });
    render();
  });

  const sus = $('presetSust');
  if (sus) sus.addEventListener('click', ()=>{
    Object.assign(state.inputs, {
      sector:'Sustainability SaaS', stage:'Series A',
      arr: 5000000, growth: 90, nrr: 125, grossMargin: 78, ebitMargin:-10,
      cacPayback: 12, burnMultiple: 1.1, customers: 90
    });
    render();
  });
}

function setStep(n){
  state.step = n;
  ['s1','s2','s3'].forEach((id,idx)=>{ const el=$(id); if(el) el.className = (idx < n) ? 'on' : ''; });
  render();
}

function render(){
  const app = $('app');
  if (!app) return;

  if (state.step === 1) app.innerHTML = screenInputs(state.inputs);
  if (state.step === 2) app.innerHTML = screenLevers(state.inputs, state.levers);
  if (state.step === 3) app.innerHTML = screenResults(state.inputs, state.levers);

  bindInputs();
  bindNav();
  bindPresets();
}

// Init
window.addEventListener('DOMContentLoaded', render);
