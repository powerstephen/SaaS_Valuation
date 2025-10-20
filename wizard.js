// ---------- Build stamp ----------
const $ = (id) => document.getElementById(id);
const setTxt = (id, v) => { const el = $(id); if (el) el.textContent = v; };
setTxt('build', new Date().toISOString());

// ---------- Helpers ----------
const fmt = (n, cur='€') => cur + Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const chip = (id, val, current) =>
  `<span class="chip ${val===current?'on':''}" data-id="${id}" data-val="${val}">${val}</span>`;

// ---------- State ----------
const state = {
  step: 1,
  preset: null, // 'log' | 'sust' | null (for highlight)
  inputs: {
    currency: '€',
    stage: 'Series A',            // Seed / Pre-A, Series A, Series B, Growth
    sector: 'Logistics SaaS',     // Logistics SaaS, Sustainability SaaS, Other
    // CORE (Step 2)
    arr: 5000000, growth: 80, nrr: 115,
    // EFFICIENCY (Step 3)
    grossMargin: 75, ebitMargin: -20, cacPayback: 14, burnMultiple: 1.6, customers: 120,
  },
  levers: { sectorPremiumPct: 0, ruleOf40AdjPct: 0, burnAdjPct: 0, qualityAdjPct: 0 }
};

// ---------- Multiples + logic ----------
function baseMultipleForStage(stage){
  switch(stage){
    case 'Seed / Pre-A': return 7;
    case 'Series A':     return 10;
    case 'Series B':     return 12.5;
    case 'Growth':       return 8;
    default:             return 9;
  }
}
function sectorPremium(sector){
  if (sector === 'Sustainability SaaS') return 0.18;
  if (sector === 'Logistics SaaS')      return 0.12;
  return 0.00;
}
const ruleOf40 = (g,p)=> Number(g||0)+Number(p||0);
function ruleOf40Adj(r40){ if(r40>=40) return 0.20; if(r40>=20) return 0.10; if(r40<0) return -0.10; return 0; }
function burnAdj(b){ if(b<=1.0) return 0.15; if(b<=1.5) return 0.10; if(b<=2.0) return 0.00; if(b<=3.0) return -0.10; return -0.20; }
function bands(nrr, gm, pb){
  const nrrBand=(nrr>=120)?'Excellent':(nrr>=110)?'Strong':(nrr>=100)?'OK':'At-risk';
  const gmBand=(gm>=80)?'Elite':(gm>=70)?'Healthy':(gm>=60)?'OK':'Thin';
  const pbBand=(pb<=12)?'Fast':(pb<=18)?'Reasonable':'Slow';
  return {nrrBand,gmBand,pbBand};
}

function compute(i, l){
  const base=baseMultipleForStage(i.stage);
  const sec=sectorPremium(i.sector);         l.sectorPremiumPct=sec*100;
  const r40=ruleOf40(i.growth,i.ebitMargin); l.ruleOf40AdjPct=ruleOf40Adj(r40)*100;
  const bA =burnAdj(i.burnMultiple);         l.burnAdjPct=bA*100;
  const manual=clamp(Number(l.qualityAdjPct||0),-30,30)/100;

  const mult = base*(1+sec)*(1+ruleOf40Adj(r40))*(1+bA)*(1+manual);
  const adjMult = clamp(mult, base*0.6, base*1.8);

  const val = i.arr*adjMult, low= i.arr*adjMult*0.85, high= i.arr*adjMult*1.15;

  return {baseMultiple:base, adjMultiple:adjMult, impliedVal:val, lowVal:low, highVal:high,
          lowMultiple:adjMult*0.85, highMultiple:adjMult*1.15, r40, bands:bands(i.nrr,i.grossMargin,i.cacPayback)};
}

// ---------- Screens (4 steps) ----------
function screenBasics(i){
  return `
    <section class="card">
      <h2>Step 1 — Basics</h2>
      <div class="grid3">
        <div>
          <label>Currency</label>
          <div class="group" id="grp-currency">
            ${['€','£','$'].map(c=>chip('currency',c,i.currency)).join('')}
          </div>
          <div class="hint">Click to choose. This only changes display symbol.</div>
        </div>
        <div>
          <label>Industry</label>
          <div class="group" id="grp-sector">
            ${['Logistics SaaS','Sustainability SaaS','Other'].map(s=>chip('sector',s,i.sector)).join('')}
          </div>
        </div>
        <div>
          <label>Stage</label>
          <select id="stage">
            <option ${i.stage==='Seed / Pre-A'?'selected':''}>Seed / Pre-A</option>
            <option ${i.stage==='Series A'?'selected':''}>Series A</option>
            <option ${i.stage==='Series B'?'selected':''}>Series B</option>
            <option ${i.stage==='Growth'?'selected':''}>Growth</option>
          </select>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Presets (optional)</h2>
      <div class="grid2">
        <div>
          <button class="btn preset ${state.preset==='log'?'on':''}" id="presetLog">Logistics — Efficient Growth</button>
          <p class="hint" style="margin-top:6px">ARR €5–10M, Growth 60–90%, NRR 115–125%, Burn ≤1.5×</p>
        </div>
        <div>
          <button class="btn preset ${state.preset==='sust'?'on':''}" id="presetSust">Sustainability — Premium Retention</button>
          <p class="hint" style="margin-top:6px">ARR €3–8M, Growth 70–100%, NRR 120–130%, Burn ≤1.2×</p>
        </div>
      </div>
      <div class="hint" style="margin-top:8px">Selecting a preset fills in Steps 2–3, but you stay on this page until you press Continue.</div>
    </section>

    <div class="rowbtn">
      <span></span>
      <button class="btn" id="continue1">Continue</button>
    </div>
  `;
}

function screenCore(i){
  return `
    <section class="card">
      <h2>Step 2 — Core Growth & Scale</h2>
      <div class="grid3">
        <div><label>ARR</label><input id="arr" type="number" min="0" step="50000" value="${i.arr}"></div>
        <div><label>YoY Growth %</label><input id="growth" type="number" step="1" value="${i.growth}"></div>
        <div><label>NRR %</label><input id="nrr" type="number" step="1" value="${i.nrr}"></div>
      </div>
    </section>
    <div class="rowbtn">
      <button class="btn" id="back2">Back</button>
      <button class="btn" id="continue2">Continue</button>
    </div>
  `;
}

function screenEfficiency(i, l){
  return `
    <section class="card">
      <h2>Step 3 — Efficiency & Quality</h2>
      <div class="grid3">
        <div><label>Gross Margin %</label><input id="grossMargin" type="number" step="1" value="${i.grossMargin}"></div>
        <div><label>EBIT Margin %</label><input id="ebitMargin" type="number" step="1" value="${i.ebitMargin}"></div>
        <div><label>CAC Payback (months)</label><input id="cacPayback" type="number" step="1" value="${i.cacPayback}"></div>
      </div>
      <div class="grid3" style="margin-top:6px">
        <div><label>Burn Multiple</label><input id="burnMultiple" type="number" step="0.1" value="${i.burnMultiple}"></div>
        <div><label>Customers (context)</label><input id="customers" type="number" step="1" value="${i.customers}"></div>
        <div>
          <label>Manual Quality Adj (+/- %)</label>
          <input id="qualityAdjPct" type="number" step="1" value="${l.qualityAdjPct}">
          <div class="hint">Use sparingly for moats, compliance edge, team quality, etc. (±30% capped)</div>
        </div>
      </div>
    </section>
    <div class="rowbtn">
      <button class="btn" id="back3">Back</button>
      <button class="btn" id="continue3">See Valuation</button>
    </div>
  `;
}

function screenResults(i, l){
  const o = compute(i,l);
  return `
    <section class="card">
      <h2>Step 4 — Valuation</h2>
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
        <button class="btn" id="back4">Back</button>
        <button class="btn" id="restart">Start Over</button>
      </div>
      <button class="btn" id="download">Download CSV</button>
    </div>
  `;
}

// ---------- Wiring ----------
function wireChips(){
  document.querySelectorAll('.chip').forEach(c=>{
    c.addEventListener('click', ()=>{
      const id=c.getAttribute('data-id');
      const val=c.getAttribute('data-val');
      if (id in state.inputs) state.inputs[id]=val;
      // toggle visuals within the same group
      c.parentElement.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));
      c.classList.add('on');
    });
  });
}

function bindInputs(){
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
  // Step transitions
  const c1=$('continue1'); if(c1) c1.addEventListener('click', ()=>setStep(2));
  const b2=$('back2');     if(b2) b2.addEventListener('click', ()=>setStep(1));
  const c2=$('continue2'); if(c2) c2.addEventListener('click', ()=>setStep(3));
  const b3=$('back3');     if(b3) b3.addEventListener('click', ()=>setStep(2));
  const c3=$('continue3'); if(c3) c3.addEventListener('click', ()=>setStep(4));
  const b4=$('back4');     if(b4) b4.addEventListener('click', ()=>setStep(3));

  const rs=$('restart');   if(rs) rs.addEventListener('click', ()=>{ state.step=1; state.preset=null; render(); });

  // Presets — now *do not* auto-advance; they fill values + highlight and stay on Step 1
  const log=$('presetLog');
  if (log) log.addEventListener('click', ()=>{
    Object.assign(state.inputs,{
      sector:'Logistics SaaS', stage: state.inputs.stage,
      arr:7000000, growth:75, nrr:118,
      grossMargin:72, ebitMargin:-15, cacPayback:14, burnMultiple:1.4, customers:150
    });
    state.preset='log';
    render(); // re-render to show highlight; user will click Continue
  });

  const sus=$('presetSust');
  if (sus) sus.addEventListener('click', ()=>{
    Object.assign(state.inputs,{
      sector:'Sustainability SaaS', stage: state.inputs.stage,
      arr:5000000, growth:90, nrr:125,
      grossMargin:78, ebitMargin:-10, cacPayback:12, burnMultiple:1.1, customers:90
    });
    state.preset='sust';
    render(); // re-render to show highlight; user will click Continue
  });

  // CSV
  const dl=$('download');
  if (dl) dl.addEventListener('click', ()=>{
    const i=state.inputs,l=state.levers,o=compute(i,l);
    const rows=[
      ['Field','Value'],
      ['Currency',i.currency],['Stage',i.stage],['Sector',i.sector],
      ['ARR',i.arr],['YoY Growth %',i.growth],['NRR %',i.nrr],
      ['Gross Margin %',i.grossMargin],['EBIT Margin %',i.ebitMargin],['CAC Payback (months)',i.cacPayback],['Burn Multiple',i.burnMultiple],
      ['Base Multiple',o.baseMultiple.toFixed(2)],['Adjusted Multiple',o.adjMultiple.toFixed(2)],
      ['Implied Valuation',Math.round(o.impliedVal)],['Low Valuation',Math.round(o.lowVal)],['High Valuation',Math.round(o.highVal)]
    ];
    const csv=rows.map(r=>r.join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='saas-valuation-dn.csv';
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},400);
  });
}

function setStep(n){
  state.step = n;
  ['s1','s2','s3','s4'].forEach((id,idx)=>{ const el=$(id); if(el) el.className=(idx<n)?'on':''; });
  render();
}

function render(){
  const app=$('app'); if(!app) return;

  if (state.step===1) app.innerHTML = screenBasics(state.inputs);
  if (state.step===2) app.innerHTML = screenCore(state.inputs);
  if (state.step===3) app.innerHTML = screenEfficiency(state.inputs, state.levers);
  if (state.step===4) app.innerHTML = screenResults(state.inputs, state.levers);

  bindInputs();
  bindNav();
  wireChips();
}

// Init
window.addEventListener('DOMContentLoaded', render);
