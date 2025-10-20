// ---------- Build stamp ----------
const $ = (id) => document.getElementById(id);
const setTxt = (id, v) => { const el = $(id); if (el) el.textContent = v; };
setTxt('build', new Date().toISOString());

// ---------- Helpers ----------
const chip = (id, val, current) =>
  `<span class="chip ${val===current?'on':''}" data-id="${id}" data-val="${val}">${val}</span>`;
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const fmt = (n, cur='€') => cur + Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
const toNum = (v)=> Number.isFinite(+v) ? +v : 0;

// ---------- State ----------
const state = {
  step: 1,
  inputs: {
    // Step 1 — Basics
    currency:'€',
    sector:'Logistics SaaS', // or Sustainability SaaS / Other
    stage:'Series A',        // Seed / Pre-A, Series A, Series B, Growth
    arr: 5000000,

    // Step 2 — Growth & Scale
    arrGrowth: 80,           // %
    customers: 120,
    customerGrowth: 60,      // %

    // Step 3 — Efficiency & CAC payback
    grossMargin: 75,         // %
    ebitMargin: -20,         // %
    burnMultiple: 1.6,       // x

    // ARPA input mode
    arpaMode: 'direct',      // 'direct' | 'acv' | 'seats'
    // Direct
    arpaMonthly: 500,        // €/$ per account per month
    // From ACV
    acvAnnual: 6000,         // annual contract value
    // From seats × price
    seats: 20,
    pricePerSeatMonthly: 50,

    // CAC & payback
    cacPerCustomer: 6000,    // acquisition cost per new logo
    onboardingLag: 1,        // months before revenue starts

    // Manual override (optional)
    cacPaybackManualMode: false,
    cacPaybackManual: 14
  }
};

// ---------- Core logic ----------
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
  if (sector==='Sustainability SaaS') return 0.18;
  if (sector==='Logistics SaaS')      return 0.12;
  return 0.00;
}
const ruleOf40 = (g,p)=> Number(g||0) + Number(p||0);
function ruleOf40Adj(r40){ if(r40>=40) return 0.20; if(r40>=20) return 0.10; if(r40<0) return -0.10; return 0; }
function burnAdj(b){ if(b<=1.0) return 0.15; if(b<=1.5) return 0.10; if(b<=2.0) return 0.00; if(b<=3.0) return -0.10; return -0.20; }

// --- ARPA (monthly) effective value from chosen mode ---
function effectiveARPA(i){
  if (i.arpaMode === 'acv'){
    return Math.max(0, toNum(i.acvAnnual) / 12);
  }
  if (i.arpaMode === 'seats'){
    return Math.max(0, toNum(i.seats) * toNum(i.pricePerSeatMonthly));
  }
  // direct
  return Math.max(0, toNum(i.arpaMonthly));
}

// --- CAC Payback computed from inputs ---
function computeCacPaybackMonths(i){
  const gm = clamp(toNum(i.grossMargin)/100, 0, 1);
  const arpa = effectiveARPA(i);
  const cac  = Math.max(0, toNum(i.cacPerCustomer));
  const lag  = Math.max(0, toNum(i.onboardingLag));
  if (gm <= 0 || arpa <= 0) return lag; // avoid divide by zero; show at least lag
  const grossProfitPerMonth = arpa * gm; // contribution margin per customer per month
  return (cac / grossProfitPerMonth) + lag;
}
const effectiveCacPayback = (i)=> i.cacPaybackManualMode ? toNum(i.cacPaybackManual) : computeCacPaybackMonths(i);

// --- Main valuation compute (Model A only) ---
function compute(i){
  const base = baseMultipleForStage(i.stage);
  const sec  = sectorPremium(i.sector);
  const r40  = ruleOf40(i.arrGrowth, i.ebitMargin);
  const mult = base * (1+sec) * (1+ruleOf40Adj(r40)) * (1+burnAdj(i.burnMultiple));
  const adj  = clamp(mult, base*0.6, base*1.8);

  const val  = i.arr * adj;
  return {
    baseMultiple: base,
    adjMultiple: adj,
    impliedVal: val,
    lowMultiple: adj*0.85, highMultiple: adj*1.15,
    lowVal: i.arr*adj*0.85, highVal: i.arr*adj*1.15,
    r40,
    arpaEff: effectiveARPA(i),
    payback: effectiveCacPayback(i)
  };
}

// ---------- Screens ----------
function screen1(i){
  return `
    <section class="card">
      <h2>Step 1 — Basics</h2>
      <div class="grid3">
        <div>
          <label>Currency</label>
          <div class="group" id="grp-currency">
            ${['€','£','$'].map(c=>chip('currency',c,i.currency)).join('')}
          </div>
          <div class="hint">Changes the symbol only.</div>
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
      <div class="grid3" style="margin-top:6px">
        <div><label>ARR</label><input id="arr" type="number" min="0" step="50000" value="${i.arr}"></div>
        <div></div><div></div>
      </div>
    </section>
    <div class="rowbtn">
      <span></span>
      <button class="btn" id="continue1">Continue</button>
    </div>`;
}

function screen2(i){
  return `
    <section class="card">
      <h2>Step 2 — Growth & Scale</h2>
      <div class="grid3">
        <div><label>ARR Growth % (YoY)</label><input id="arrGrowth" type="number" step="1" value="${i.arrGrowth}"></div>
        <div><label>Customers</label><input id="customers" type="number" step="1" value="${i.customers}"></div>
        <div><label>Customer Growth % (YoY)</label><input id="customerGrowth" type="number" step="1" value="${i.customerGrowth}"></div>
      </div>
      <div class="hint" style="margin-top:6px">Growth is a key multiple driver (also shows up in Rule of 40).</div>
    </section>
    <div class="rowbtn">
      <button class="btn" id="back2">Back</button>
      <button class="btn" id="continue2">Continue</button>
    </div>`;
}

function screen3(i){
  const arpaEff = effectiveARPA(i).toFixed(0);
  const computedPayback = computeCacPaybackMonths(i).toFixed(1);
  return `
    <section class="card">
      <h2>Step 3 — Efficiency & CAC Payback</h2>

      <div class="grid3">
        <div><label>Gross Margin %</label><input id="grossMargin" type="number" step="1" value="${i.grossMargin}"></div>
        <div><label>EBIT Margin %</label><input id="ebitMargin" type="number" step="1" value="${i.ebitMargin}"></div>
        <div><label>Burn Multiple (x)</label><input id="burnMultiple" type="number" step="0.1" value="${i.burnMultiple}"></div>
      </div>

      <div class="grid3" style="margin-top:10px">
        <div>
          <label>ARPA Input Mode</label>
          <select id="arpaMode">
            <option value="direct" ${i.arpaMode==='direct'?'selected':''}>Direct (enter ARPA monthly)</option>
            <option value="acv" ${i.arpaMode==='acv'?'selected':''}>From ACV (ACV / 12)</option>
            <option value="seats" ${i.arpaMode==='seats'?'selected':''}>From seats × price</option>
          </select>
        </div>
        <div></div><div></div>
      </div>

      ${
        i.arpaMode==='direct'
        ? `
        <div class="grid3" style="margin-top:8px">
          <div><label>ARPA (monthly)</label><input id="arpaMonthly" type="number" step="10" value="${i.arpaMonthly}"></div>
          <div><label>Effective ARPA (monthly)</label><input value="${arpaEff}" disabled></div>
          <div></div>
        </div>`
        : i.arpaMode==='acv'
        ? `
        <div class="grid3" style="margin-top:8px">
          <div><label>ACV (annual)</label><input id="acvAnnual" type="number" step="100" value="${i.acvAnnual}"></div>
          <div><label>Effective ARPA = ACV / 12</label><input value="${arpaEff}" disabled></div>
          <div></div>
        </div>`
        : `
        <div class="grid3" style="margin-top:8px">
          <div><label>Seats</label><input id="seats" type="number" step="1" value="${i.seats}"></div>
          <div><label>Price per seat (monthly)</label><input id="pricePerSeatMonthly" type="number" step="1" value="${i.pricePerSeatMonthly}"></div>
          <div><label>Effective ARPA = Seats × Price</label><input value="${arpaEff}" disabled></div>
        </div>`
      }

      <div class="grid3" style="margin-top:10px">
        <div><label>CAC per Customer</label><input id="cacPerCustomer" type="number" step="50" value="${i.cacPerCustomer}"></div>
        <div><label>Onboarding Lag (months)</label><input id="onboardingLag" type="number" step="1" value="${i.onboardingLag}"></div>
        <div>
          <label>Computed CAC Payback (months)</label>
          <input value="${computedPayback}" disabled>
          <div class="hint">= CAC / (Effective ARPA × GrossMargin) + Lag</div>
        </div>
      </div>

      <div class="grid3" style="margin-top:8px">
        <div>
          <label><input id="cacPaybackManualMode" type="checkbox" ${i.cacPaybackManualMode?'checked':''}> Use manual payback</label>
          <input id="cacPaybackManual" type="number" step="0.5" value="${i.cacPaybackManual}" ${i.cacPaybackManualMode?'':'disabled'}>
          <div class="hint">Tick to override computed payback with a known figure.</div>
        </div>
        <div></div><div></div>
      </div>
    </section>

    <div class="rowbtn">
      <button class="btn" id="back3">Back</button>
      <button class="btn" id="continue3">See Valuation</button>
    </div>`;
}

function screen4(i){
  const o = compute(i);
  const r40Class = o.r40>=40?'good':(o.r40<0?'warn':'');
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
      <div class="kpi"><div class="lab">Rule of 40 (ARR Growth + EBIT Margin)</div><div class="val ${r40Class}">${o.r40.toFixed(0)}%</div></div>
      <div class="kpi"><div class="lab">Effective ARPA (monthly)</div><div class="val">${fmt(o.arpaEff, i.currency)}</div></div>
      <div class="kpi"><div class="lab">Computed CAC Payback</div><div class="val">${o.payback.toFixed(1)} mo ${state.inputs.cacPaybackManualMode?'(manual override)':''}</div></div>
      <div class="kpi"><div class="lab">Gross Margin</div><div class="val">${state.inputs.grossMargin}%</div></div>
      <div class="kpi"><div class="lab">Burn Multiple</div><div class="val">${state.inputs.burnMultiple.toFixed(1)}×</div></div>
      <div class="kpi"><div class="lab">Customers</div><div class="val">${state.inputs.customers.toLocaleString()}</div></div>
      <div class="kpi"><div class="lab">ARR Growth</div><div class="val">${state.inputs.arrGrowth}%</div></div>
    </section>

    <div class="rowbtn">
      <div>
        <button class="btn" id="back4">Back</button>
        <button class="btn" id="restart">Start Over</button>
      </div>
      <button class="btn" id="download">Download CSV</button>
    </div>`;
}

// ---------- Wiring ----------
function wireChips(){
  document.querySelectorAll('.chip').forEach(c=>{
    c.addEventListener('click', ()=>{
      const id=c.getAttribute('data-id'); const val=c.getAttribute('data-val');
      if (id in state.inputs) state.inputs[id]=val;
      c.parentElement.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));
      c.classList.add('on');
    });
  });
}

function bindInputs(){
  document.querySelectorAll('input,select').forEach(el=>{
    el.addEventListener('input', e=>{
      const id=e.target.id;
      let val=(e.target.type==='number') ? +e.target.value : e.target.value;
      if (e.target.type === 'checkbox') val = e.target.checked;

      if (id in state.inputs) state.inputs[id]=val;

      // special: toggling manual payback enables/disables the number input
      if (id==='cacPaybackManualMode'){
        const manualBox = document.getElementById('cacPaybackManual');
        if (manualBox) manualBox.disabled = !e.target.checked;
      }

      // if ARPA mode changes, re-render to show the relevant fields
      if (id==='arpaMode'){ render(); }
    });
  });
}

function bindNav(){
  const c1=$('continue1'); if(c1) c1.addEventListener('click', ()=>setStep(2));
  const b2=$('back2');     if(b2) b2.addEventListener('click', ()=>setStep(1));
  const c2=$('continue2'); if(c2) c2.addEventListener('click', ()=>setStep(3));
  const b3=$('back3');     if(b3) b3.addEventListener('click', ()=>setStep(2));
  const c3=$('continue3'); if(c3) c3.addEventListener('click', ()=>setStep(4));
  const b4=$('back4');     if(b4) b4.addEventListener('click', ()=>setStep(3));
  const rs=$('restart');   if(rs) rs.addEventListener('click', ()=>{ state.step=1; render(); });

  const dl=$('download');
  if (dl) dl.addEventListener('click', ()=>{
    const i=state.inputs, o=compute(i);
    const rows=[
      ['Field','Value'],
      ['Currency',i.currency],['Sector',i.sector],['Stage',i.stage],['ARR',i.arr],
      ['ARR Growth %',i.arrGrowth],['Customers',i.customers],['Customer Growth %',i.customerGrowth],
      ['Gross Margin %',i.grossMargin],['EBIT Margin %',i.ebitMargin],
      ['ARPA Mode',i.arpaMode],['ARPA Monthly (effective)',Math.round(o.arpaEff)],
      ['ACV Annual',i.acvAnnual],['Seats',i.seats],['Price/Seat Monthly',i.pricePerSeatMonthly],
      ['CAC per Customer',i.cacPerCustomer],['Onboarding Lag (mo)',i.onboardingLag],
      ['CAC Payback (mo)',o.payback.toFixed(1)],['Burn Multiple',i.burnMultiple],
      ['Base Multiple',o.baseMultiple.toFixed(2)],['Adjusted Multiple',o.adjMultiple.toFixed(2)],
      ['Implied Valuation',Math.round(o.impliedVal)],['Low Valuation',Math.round(o.lowVal)],['High Valuation',Math.round(o.highVal)],
      ['Rule of 40',Math.round(o.r40)]
    ];
    const csv=rows.map(r=>r.join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='saas-valuation-dn.csv';
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},400);
  });
}

function setStep(n){
  state.step=n;
  ['s1','s2','s3','s4'].forEach((id,idx)=>{ const el=$(id); if(el) el.className=(idx<n)?'on':''; });
  render();
}

function render(){
  const app=$('app'); if(!app) return;
  if (state.step===1) app.innerHTML = screen1(state.inputs);
  if (state.step===2) app.innerHTML = screen2(state.inputs);
  if (state.step===3) app.innerHTML = screen3(state.inputs);
  if (state.step===4) app.innerHTML = screen4(state.inputs);
  wireChips(); bindInputs(); bindNav();
}

// Init
window.addEventListener('DOMContentLoaded', render);
