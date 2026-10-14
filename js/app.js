const $=s=>document.querySelector(s);
const TODAY=new Date().toISOString().slice(0,10),TILES='https://map-init.gallimap.com/styles/light/{z}/{x}/{y}.png';
const nf=n=>Math.round(n).toLocaleString('en-IN');
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const getJSON=async u=>{const r=await fetch(u);if(!r.ok)throw new Error(u+' '+r.status);return r.json()};

/* ---------- reference data ---------- */
const POIT={ // real health layer sub-types (health.geojson)
 hospital:{l:'Hospitals',c:'#D6453D',g:'H'},health_post:{l:'Health posts',c:'#C0702B',g:'+'},clinic:{l:'Clinics',c:'#E0703A',g:'C'},
 pharmacy:{l:'Pharmacies',c:'#1F8A70',g:'Rx'},dentist:{l:'Dental',c:'#3B7DD8',g:'D'},ayurvedic:{l:'Ayurvedic',c:'#7A8F2E',g:'Ay'},
 ambulance:{l:'Ambulance',c:'#B02A5B',g:'A'},blood_bank:{l:'Blood banks',c:'#A12B2B',g:'B'},optician:{l:'Opticians',c:'#6B7680',g:'O'},'physiotherapy/chiropractor':{l:'Physiotherapy',c:'#6B7680',g:'Ph'}};
const PEND=['Schools','Religious sites','Government offices','Community centers','Banks / financial','Markets / commercial'];

/* ---------- state ---------- */
const S={prov:null,dist:null,mun:null,ward:null,filter:'all',showPoi:false,cats:new Set(Object.keys(POIT)),sel:null,type:null,ey:'22',layer:'win22',poiOpen:false,tab:'res',showB:true,lasso:false,pick:new Set(),route:[],legs:[],legTok:0,showRoads:false};
let H,BND,P={},D={},M={},MD={},map,adm,wardL,ctxL,bldL,selL,poiL,routeL,lassoL,BR=null,W=null,MF=null,MFP=null,SP=null,ext=null,bl=[],pm=[],busy=0;
const mcache={},wcache={};
const mname=m=>m.n+' '+m.ty;

/* ---------- logo ---------- */
function logo(h){return `<svg width="${h*.8}" height="${h}" viewBox="0 0 80 100" aria-hidden="true"><path d="M2 22 22 36V82L2 86Z" fill="#7A2916"/><path d="M48 14 70 0V84L48 80Z" fill="#7A2916"/><path d="M40 36a16 16 0 0 0-16 16c0 12 16 32 16 32s16-20 16-32a16 16 0 0 0-16-16Z" fill="#FFFBE8"/><path d="M40 41a11 11 0 0 0-11 11c0 8 11 22 11 22s11-14 11-22a11 11 0 0 0-11-11Z" fill="#E2784A"/><circle cx="40" cy="51" r="5" fill="#FFFBE8"/></svg>`}
const wordmark=`<div class="logo"><div><b>galli</b><small>MAPS</small></div></div>`;

/* ---------- login ---------- */
const otpEl=$('#otp');
otpEl.innerHTML=[0,1,2,3,4,5].map(i=>`<input id="o${i}" inputmode="numeric" maxlength="1" aria-label="Digit ${i+1}">`).join('');
$('#artlogo').innerHTML=logo(96)+`<div style="margin-top:6px">${wordmark}</div>`;
$('#hdrlogo').innerHTML=logo(44);

$('#mobile').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'');$('#sendOtp').disabled=!/^9\d{9}$/.test(e.target.value)});
$('#sendOtp').onclick=()=>{$('#sentTo').textContent='+977 '+$('#mobile').value;$('#otpBlock').hidden=false;$('#sendOtp').hidden=true;$('#mobile').disabled=true;$('#o0').focus()};
$('#chg').onclick=()=>{$('#otpBlock').hidden=true;$('#sendOtp').hidden=false;$('#mobile').disabled=false;$('#mobile').focus()};
otpEl.addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'');const i=+e.target.id.slice(1);if(e.target.value&&i<5)$('#o'+(i+1)).focus();$('#verify').disabled=![...otpEl.children].every(x=>x.value)});
otpEl.addEventListener('keydown',e=>{const i=+e.target.id.slice(1);if(e.key==='Backspace'&&!e.target.value&&i>0)$('#o'+(i-1)).focus()});
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();enter(true)});
$('#skip').onclick=()=>enter(false);
function enter(show){$('#login').hidden=true;$('#app').hidden=false;init();if(show)toast('Signed in. Any other device on this number was logged out.')}
$('#userbtn').onclick=()=>{$('#menu').hidden=!$('#menu').hidden};
$('#logout').onclick=()=>{$('#menu').hidden=true;$('#app').hidden=true;$('#login').hidden=false;$('#chg').click();[...otpEl.children].forEach(x=>x.value='');$('#verify').disabled=true;$('#mobile').value='';$('#sendOtp').disabled=true};
document.addEventListener('click',e=>{if(!e.target.closest('.user'))$('#menu').hidden=true;if(!e.target.closest('.search'))$('#results').hidden=true});
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>e.hidden=true,3200)}

/* ---------- geography helpers ---------- */
const cur=()=>S.ward!=null?{k:'ward',e:M[S.mun].w.find(w=>w.no===S.ward),m:M[S.mun]}:S.mun!=null?{k:'mun',e:M[S.mun]}:S.dist!=null?{k:'dist',e:D[S.dist]}:S.prov!=null?{k:'prov',e:P[S.prov]}:{k:'nat',e:H.nation};
function levelName(){
  const c=cur();
  if(c.k==='ward')return `Ward ${c.e.no} · ${mname(c.m)}`;
  if(c.k==='mun')return mname(c.e);
  if(c.k==='dist')return c.e.n+' District';
  if(c.k==='prov')return c.e.n+' Province';
  return 'Nepal';
}
const toB=bb=>[[bb[1],bb[0]],[bb[3],bb[2]]];
function fitTo(bb,pad){map.fitBounds(toB(bb),{padding:pad||[30,30],animate:true})}
const MIN=0;

/* ---------- filters ---------- */
function opts(arr,sel,ph){return `<option value="">${ph}</option>`+arr.map(([v,t])=>`<option value="${v}"${v===sel?' selected':''}>${t}</option>`).join('')}
function renderTop(){
  const ds=S.prov!=null?H.dist.filter(d=>d.p===S.prov):[],ms=S.dist!=null?MD[S.dist]||[]:[],m=S.mun!=null?M[S.mun]:null;
  $('#filters').innerHTML=`
   <label class="ctl">Province <select id="fp">${opts(H.prov.map(p=>[p.c,p.n]),S.prov,'All of Nepal')}</select></label>
   <label class="ctl">District <select id="fd" ${S.prov!=null?'':'disabled'}>${opts(ds.map(d=>[d.c,d.n]),S.dist,'All districts')}</select></label>
   <label class="ctl">Municipality <select id="fm" ${S.dist!=null?'':'disabled'}>${opts(ms.map(x=>[x.id,mname(x)]),S.mun,'All municipalities')}</select></label>
   <label class="ctl">Ward <select id="fw" ${m?'':'disabled'}>${opts(m?m.w.map(w=>[w.no,'Ward '+w.no]):[],S.ward,'All wards')}</select></label>`;
  $('#fp').onchange=e=>setSel(e.target.value===''?null:+e.target.value);
  $('#fd').onchange=e=>setSel(S.prov,e.target.value===''?null:+e.target.value);
  $('#fm').onchange=e=>setSel(S.prov,S.dist,e.target.value===''?null:+e.target.value);
  $('#fw').onchange=e=>setSel(S.prov,S.dist,S.mun,e.target.value===''?null:+e.target.value);
  $('#scopetag').textContent=levelName();
}
$('#reset').onclick=()=>setSel();
async function setSel(p=null,d=null,m=null,w=null){
  S.prov=p;S.dist=p==null?null:d;S.mun=S.dist==null?null:m;S.ward=S.mun==null?null:w;S.sel=null;S.type=null;S.filter='all';
  $('#card').hidden=true;
  renderTop();await drawGeo();renderSide();
}

/* ---------- map ---------- */
const THIN={color:'#16202a',weight:.8,opacity:.55,fillColor:'#16202a',fillOpacity:0};
const SELSTYLE={color:'#16202a',weight:3,opacity:1,fill:false,interactive:false};
const PL=()=>W?W.pois:(MFP||SP||[]);
function clearLayers(){adm.clearLayers();wardL.clearLayers();ctxL.clearLayers();bldL.clearLayers();selL.clearLayers();poiL.clearLayers();routeL.clearLayers();lassoL.clearLayers();if(BR){map.removeLayer(BR);BR=null}ctxDone.clear();ctxCount=0;bl=[];pm=[];W=null;S.pick=new Set();S.route=[];S.legs=[];S.undo=null;S.lasso=false;lassoMode(false);MFP=null;SP=null;admGeo=null}
/* the current selection is shown by a dark outline only, no fill */
function drawSelected(){
  let g=null;const f=(k,c)=>(BND.features.find(x=>x.properties.k===k&&x.properties.c===c)||{}).geometry;
  if(S.ward!=null)g=MF.wards.find(x=>x.properties.no===S.ward).geometry;
  else if(S.mun!=null)g=MF.outline;
  else if(S.dist!=null)g=f('d',S.dist);
  else if(S.prov!=null)g=f('p',S.prov);
  if(g)L.geoJSON({type:'Feature',geometry:g},{style:()=>SELSTYLE,interactive:false}).addTo(selL);
}
function decoratePois(mf,id){
  return mf._d||(mf._d=mf.pois.map((p,i)=>({...p,i,mid:id,t:POIT[p.s]?p.s:'optician',name:p.n||(POIT[p.s]?POIT[p.s].l.replace(/s$/,''):'Health facility')+' (unnamed)'})));
}
function makeMarkers(){
  pm=PL().map((p,i)=>{const t=POIT[p.t];let mk;
    if(W)mk=L.marker([p.y,p.x],{icon:L.divIcon({className:'',html:`<div class="pm" style="background:${t.c}">${t.g}</div>`,iconSize:[26,26]}),title:p.name});
    else{mk=L.circleMarker([p.y,p.x],{radius:6,weight:2,color:'#fff',fillColor:t.c,fillOpacity:1,bubblingMouseEvents:false});mk.bindTooltip(p.name)}
    mk.on('click',()=>selectP(i));return mk});
}
async function loadScopePois(my){
  const ms=munsIn(),out=[];let k=0;
  const work=async()=>{while(k<ms.length){const m=ms[k++];
    try{const mf=mcache[m.id]||(mcache[m.id]=await getJSON(`data/mun/${m.id}.json`));out.push(...decoratePois(mf,m.id))}catch(e){}}};
  await Promise.all([1,2,3,4,5,6].map(work));
  if(my!==busy)return;
  SP=out;makeMarkers();syncAll();renderSide();renderPoiPanel();
}
async function drawGeo(){
  const my=++busy;$('#loading').textContent='Loading…';$('#loading').hidden=false;
  try{
  clearLayers();
  const hint=$('#hint');let hs='';
  const hover=(l,f)=>{l.on('mouseover',()=>l.setStyle({weight:1.6,color:'#16202a',opacity:1,fillOpacity:f&&S.layer!=='off'?.9:.08}));l.on('mouseout',()=>l.setStyle(f?styleFor(f):THIN))};
  if(S.mun==null){
    let fs;
    if(S.dist!=null){const dj=await getJSON(`data/dist/${S.dist}.json`);if(my!==busy)return;fs=dj.features.map(f=>({...f,properties:{k:'m',id:f.properties.id,n:f.properties.n}}))}
    else fs=BND.features.filter(f=>S.prov==null&&S.layer==='off'?f.properties.k==='p':(f.properties.k==='d'&&(S.prov==null||f.properties.p===S.prov)));
    admGeo=L.geoJSON({type:'FeatureCollection',features:fs},{style:styleFor,onEachFeature:(f,l)=>{
      const pr=f.properties,e=pr.k==='p'?P[pr.c]:pr.k==='d'?D[pr.c]:M[pr.id];
      l.bindTooltip(()=>{const v=lvOf(pr);return `<span class="admtip">${pr.k==='m'?mname(e):pr.n}</span><br>${nf(e.t)} people${v?`<br><i class="sw" style="background:${v.c}"></i> ${esc(v.t)}`:''}`},{sticky:true});
      hover(l,f);
      l.on('click',()=>pr.k==='p'?setSel(pr.c):pr.k==='d'?setSel(S.prov??pr.p,pr.c):setSel(S.prov,S.dist,pr.id));
    }}).addTo(adm);
    if(S.prov==null&&S.layer!=='off')L.geoJSON({type:'FeatureCollection',features:BND.features.filter(f=>f.properties.k==='p')},{style:()=>({color:'#16202a',weight:1.6,opacity:.9,fill:false}),interactive:false}).addTo(adm);
    drawSelected();
    if(S.prov!=null)loadScopePois(my);
    ext=S.dist!=null?D[S.dist].bb:S.prov!=null?P[S.prov].bb:[80.0,26.3,88.3,30.5];
    hs=S.prov==null?'Click a district or choose a province above':S.dist==null?'Click a district':'Click a municipality';
  }else{
    MF=mcache[S.mun]||(mcache[S.mun]=await getJSON(`data/mun/${S.mun}.json`));if(my!==busy)return;
    const m=M[S.mun];
    wardGeo=L.geoJSON(MF.wards,{style:f=>wardStyle(f.properties.no),onEachFeature:(f,l)=>{const w=m.w.find(x=>x.no===f.properties.no);
        l.bindTooltip(`<span class="admtip">Ward ${w.no}</span><br>${nf(w.t)} people`,{sticky:true});
        if(S.ward==null)l.bindTooltip(String(w.no),{permanent:true,direction:'center',className:'wlbl'});
        l.on('mouseover',()=>l.setStyle({weight:1.8,color:'#16202a',opacity:1}));l.on('mouseout',()=>l.setStyle(wardStyle(f.properties.no)));
        l.on('click',()=>{if(f.properties.no!==S.ward)setSel(S.prov,S.dist,S.mun,f.properties.no)});}}).addTo(wardL);
    drawSelected();
    MFP=decoratePois(MF,S.mun);
    if(S.ward==null){ext=m.bb;hs='Click a ward to load households';makeMarkers()}
    else{
      const w=m.w.find(x=>x.no===S.ward);ext=w.bb;
      W=wcache[w.id]||(wcache[w.id]=await loadWard(w,m));if(my!==busy)return;
      drawWard();
    }
  }
  if(S.ward==null&&S.showB)hs=(hs?hs+' · ':'')+'zoom in to see buildings';
  hint.hidden=!hs;hint.textContent=hs;
  syncAll();
  fitTo(ext,S.ward!=null?[40,40]:[30,30]);
  renderLegend();renderPoiPanel();updateContext();renderLayers();renderMapBtns();
  }catch(err){console.error(err);toast('Could not load data. Serve this folder over http (see README).')}
  finally{if(my===busy)$('#loading').hidden=true}
}

/* ---------- households: real building footprints from data/bld/<wardId>.json ---------- */
// Footprints are real. Visit status is a demo placeholder until real visits are recorded; no owner details are kept.
async function loadWard(w,m){
  let raw=[];
  try{const r=await fetch(`data/bld/${w.id}.json`);if(r.ok)raw=await r.json()}catch(e){}
  const r=rng(hash('w'+w.id)),[W0,,E0]=w.bb;
  const b=raw.map((q,i)=>{
    const x0=q[0],y0=q[1],d=q[2],pts=[[y0/1e6,x0/1e6]];
    for(let k=0;k<d.length;k+=2)pts.push([(y0+d[k+1])/1e6,(x0+d[k])/1e6]);
    let sx=0,sy=0;pts.forEach(p=>{sx+=p[1];sy+=p[0]});const cx=sx/pts.length,cy=sy/pts.length;
    const vis=r()<.7-.45*((cx-W0)/((E0-W0)||1));
    return{id:`B-${w.no}-${String(i+1).padStart(5,'0')}`,cx,cy,pts,bname:q[3]||'',
      v:vis,date:vis?`2026-${r()<.5?'09':'10'}-${String(r()<.5?20+Math.floor(r()*10):1+Math.floor(r()*6)).padStart(2,'0')}`:null,rem:''}});
  const sv=loadSaved(w.id);b.forEach(x=>{const o=sv[x.id];if(o){x.v=o.v;x.date=o.date;x.rem=o.rem||'';x.by=o.by||'';x.vby=o.vby||'';x.touched=1}});
  const mx=111320*Math.cos(w.bb[1]*Math.PI/180);
  const pois=decoratePois(MF,S.mun).filter(p=>p.w===w.no).map(p=>({...p}));
  pois.forEach((p,i)=>{p.i=i;p.near=b.filter(o=>Math.hypot((o.cx-p.x)*mx,(o.cy-p.y)*111320)<100).length});
  return{w,m,b,pois,est:Math.round(w.t/4.4)};
}
/* Buildings of every ward in view, in any municipality, are loaded as you zoom and pan. Click one to switch to its ward. */
let ALLW=null,ctxDone=new Set(),ctxCount=0,ctxBusy=false,ctxTimer=null;
const getBR=()=>BR||(BR=L.canvas({padding:.3,tolerance:6}));
function updateContext(){clearTimeout(ctxTimer);ctxTimer=setTimeout(()=>{loadContext();updateGP()},250)}
async function loadContext(){
  if(!map||ctxBusy||!S.showB||map.getZoom()<13)return;
  if(!ALLW)ALLW=H.mun.flatMap(m=>m.w.map(w=>({w,m})));
  const my=busy,b=map.getBounds().pad(.15),c=b.getCenter(),[W0,S0,E0,N0]=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
  const skip=W?W.w.id:null;
  const need=ALLW.filter(x=>x.w.id!==skip&&!ctxDone.has(x.w.id)&&x.w.nb&&x.w.bb[0]<E0&&x.w.bb[2]>W0&&x.w.bb[1]<N0&&x.w.bb[3]>S0)
    .sort((a,z)=>Math.hypot((a.w.bb[0]+a.w.bb[2])/2-c.lng,(a.w.bb[1]+a.w.bb[3])/2-c.lat)-Math.hypot((z.w.bb[0]+z.w.bb[2])/2-c.lng,(z.w.bb[1]+z.w.bb[3])/2-c.lat)).slice(0,40);
  if(!need.length)return;
  if(ctxCount>250000){ctxL.clearLayers();ctxDone.clear();ctxCount=0}
  ctxBusy=true;
  try{
    for(const x of need){
      let raw=[];try{const r=await fetch(`data/bld/${x.w.id}.json`);if(r.ok)raw=await r.json()}catch(e){}
      if(my!==busy)return;
      const cv=getBR();
      raw.forEach(q=>{const d=q[2],pts=[[q[1]/1e6,q[0]/1e6]];for(let k=0;k<d.length;k+=2)pts.push([(q[1]+d[k+1])/1e6,(q[0]+d[k])/1e6]);
        L.polygon(pts,{renderer:cv,weight:.5,color:'#C4693D',opacity:.55,fillColor:'#EDAA86',fillOpacity:.4,bubblingMouseEvents:false}).on('click',()=>setSel(x.m.p,x.m.d,x.m.id,x.w.no)).addTo(ctxL)});
      ctxDone.add(x.w.id);ctxCount+=raw.length;
    }
  }finally{ctxBusy=false}
  loadContext();
}
function drawWard(){
  // one shared canvas for every building, so clicks reach the polygon under the pointer (a second canvas would sit on top and swallow them)
  const cv=getBR();
  bl=W.b.map((b,i)=>{const p=L.polygon(b.pts,{renderer:cv,weight:.8,fillOpacity:.9,bubblingMouseEvents:false});p.on('click',()=>{if(!S.lasso)selectB(i)});p.addTo(bldL);return p});
  makeMarkers();
}
function syncAll(){
  if(W)W.b.forEach((b,i)=>{const sel=S.type==='b'&&S.sel===i,show=S.filter==='all'||(S.filter==='v')===b.v;
    const pk=S.pick.has(i),inr=S.route.includes(i);
    bl[i].setStyle({fillColor:b.v?'#2E9D6A':'#EDAA86',color:sel?'#3B0F05':pk?'#0B5FFF':inr?'#1F4E79':b.v?'#1F7A50':'#C4693D',weight:sel?3:pk?2.6:inr?2:.8,fillOpacity:show?.9:.1,opacity:show?1:.15});
    if(sel||pk)bl[i].bringToFront()});

}
function renderLegend(){
  if(!W||!W.b.length||!S.showB){$('#legend').hidden=true;return}
  const st=stats(),f=S.filter;
  $('#legend').hidden=false;
  $('#legend').innerHTML=`<button data-f="all" class="${f==='all'?'on':''}">All</button>
   <button data-f="v" class="${f==='v'?'on':''}"><i class="sw" style="background:var(--visited)"></i>Visited <span class="num">${nf(st.v)}</span></button>
   <button data-f="n" class="${f==='n'?'on':''}"><i class="sw" style="background:var(--pending)"></i>Not visited <span class="num">${nf(st.r)}</span></button>`;
  $('#legend').querySelectorAll('button').forEach(b=>b.onclick=()=>{S.filter=b.dataset.f;syncAll();renderLegend()});
}
const stats=()=>{const l=W?W.b:[],t=l.length,v=l.filter(x=>x.v).length;return{t,v,r:t-v,c:t?v/t*100:0}};
$('#zi').onclick=()=>map.zoomIn();$('#zo').onclick=()=>map.zoomOut();$('#zr').onclick=()=>ext&&fitTo(ext);
$('#tp').onclick=e=>{S.showPoi=!S.showPoi;e.currentTarget.classList.toggle('on',S.showPoi);if(S.showPoi&&map.getZoom()<14)toast('Zoom in to street level to see places');updateGP()};
$('#tl').onclick=()=>togglePoiPanel();

/* ---------- selection / card ---------- */
function selectB(i,go){S.sel=i;S.type='b';if(go)map.setView([W.b[i].cy,W.b[i].cx],Math.max(map.getZoom(),18));syncAll();renderCard()}
function selectP(i,go){const p=PL()[i];S.sel=i;S.type='p';S.showPoi=true;$('#tp').classList.add('on');if(go)map.setView([p.y,p.x],Math.max(map.getZoom(),17));syncAll();renderCard()}
function closeCard(){S.sel=null;S.type=null;S.gsel=null;syncAll();renderCard()}
function setVisited(i,v){const b=W.b[i];mark(b,v);persist();syncAll();renderSide();renderCard();renderLegend();toast(v?`${b.id} marked as visited`:`${b.id} marked as not visited`)}
function saveRem(i){const b=W.b[i],t=$('#rem').value.trim();if(t!==b.rem){b.rem=t;b.by=t?who().name:'';b.touched=1}persist();renderSide();toast('Note saved')}
function renderCard(){
  const c=$('#card'),ok=S.sel!=null&&((S.type==='b'&&W)||(S.type==='p'&&PL()[S.sel])||(S.type==='g'&&S.gsel));
  if(!ok){c.hidden=true;return}c.hidden=false;
  if(S.type==='b'){const b=W.b[S.sel];
    c.innerHTML=`<div class="row"><div><h3>${b.id}</h3><span class="pill ${b.v?'v':'n'}">${b.v?'Visited':'Not visited'}</span></div><button class="x" aria-label="Close" onclick="closeCard()">×</button></div>
     <dl class="kv"><dt>Ward</dt><dd>${W.w.no} · ${W.m.n}</dd><dt>Last visit</dt><dd>${b.date||'Never'}</dd>${b.rem&&b.by?`<dt>Note by</dt><dd>${esc(b.by)}</dd>`:''}</dl>
     <div class="seg"><button class="nv ${b.v?'':'on'}" onclick="setVisited(${S.sel},false)">Not visited</button><button class="vv ${b.v?'on':''}" onclick="setVisited(${S.sel},true)">Visited</button></div>
     <div><label class="lbl" for="rem">Note (optional)</label><textarea id="rem" placeholder="Anything worth remembering about this building">${b.rem}</textarea></div>
     <div class="btnrow"><button class="btn sm" onclick="saveRem(${S.sel})">Save note</button><button class="btn ghost sm" onclick="routeAdd(${S.sel})">${S.route.includes(S.sel)?'In route':'Add to route'}</button></div>`;
  }else if(S.type==='g'){const o=S.gsel,k=GG[o.g];
    c.innerHTML=`<div class="row"><div><h3>${esc(o.n)}</h3><span class="pill" style="background:${k[1]};color:#fff">${k[0]}</span></div><button class="x" aria-label="Close" onclick="closeCard()">×</button></div>
     <dl class="kv"><dt>Type</dt><dd>${esc(o.s||o.c||'—')}</dd><dt>Address</dt><dd>${esc(o.a||'—')}</dd></dl><div class="src">Source: Galli Maps places</div>`;
  }else{const p=PL()[S.sel],k=POIT[p.t];
    c.innerHTML=`<div class="row"><div><h3>${p.name}</h3><span class="pill" style="background:${k.c};color:#fff">${k.l.replace(/s$/,'')}</span></div><button class="x" aria-label="Close" onclick="closeCard()">×</button></div>
     <dl class="kv"><dt>Address</dt><dd>${p.a||'—'}</dd><dt>Contact</dt><dd class="num">${p.c||'—'}</dd><dt>Ward</dt><dd>${p.w} · ${M[p.mid||S.mun].n}</dd>${p.near!=null?`<dt>Nearby homes</dt><dd>${p.near} mapped households within 100 m</dd>`:''}</dl>
     <div class="src">Source: Galli Maps health layer</div>`;
  }
}

/* ---------- search ---------- */
$('#q').addEventListener('input',e=>{
  const q=e.target.value.trim().toLowerCase(),box=$('#results');if(q.length<2){box.hidden=true;return}
  const r=[...H.mun.filter(m=>mname(m).toLowerCase().includes(q)).slice(0,5).map(m=>({t:'m',m,a:mname(m),b:D[m.d].n+' · '+P[m.p].n})),
    ...PL().map((p,i)=>({t:'p',i,a:p.name,b:POIT[p.t].l})).filter(x=>x.a.toLowerCase().includes(q)).slice(0,4),
    ...(W?W.b.map((b,i)=>({t:'b',i,a:b.id,b:'Ward '+W.w.no})).filter(x=>(x.a+x.b).toLowerCase().includes(q)).slice(0,4):[])];
  box.hidden=false;box.innerHTML=r.length?r.map((x,k)=>`<button data-k="${k}"><span>${x.a}<br><small>${x.b}</small></span></button>`).join(''):'<button disabled><small>No match</small></button>';
  box.querySelectorAll('button[data-k]').forEach(btn=>btn.onclick=()=>{const x=r[+btn.dataset.k];box.hidden=true;
    x.t==='m'?setSel(x.m.p,x.m.d,x.m.id):x.t==='p'?selectP(x.i,true):selectB(x.i,true)});
});

/* ---------- sidebar ---------- */
/* right-hand panel: points of interest for the current ward (or municipality) */
function togglePoiPanel(){S.tab='places';if(!S.showPoi)$('#tp').click();else updateGP();if(mobile()&&S.sheet==='peek')setSheet('half');renderSide()}
function renderPoiPanel(){if(S.tab==='places'&&!(document.activeElement&&document.activeElement.id==='pq'))renderSide()}

/* real counts per level (data/hier.json: nb = building footprints, np = health facilities) */
function wardsIn(){const c=cur();return c.k==='ward'?[c.e]:(c.k==='mun'?[c.e]:c.k==='dist'?MD[c.e.c]:c.k==='prov'?H.mun.filter(m=>m.p===c.e.c):H.mun).flatMap(m=>m.w||[m])}
const sumW=key=>wardsIn().reduce((a,w)=>a+(w[key]||0),0);
function munsIn(){const c=cur();return c.k==='mun'||c.k==='ward'?[M[S.mun]]:c.k==='dist'?MD[c.e.c]:c.k==='prov'?H.mun.filter(m=>m.p===c.e.c):H.mun}

/* ---------- election atlas: real results from data/elections.json (built by tools/build_elections.py) ---------- */
let R22=null,PNAME=null,wardGeo=null,EL=null,EM={},ED={},PT={},CI={},admGeo=null;
const SUCC={FSFN:['JSP','LSP'],RJPN:['JSP','LSP'],NSP:['JSP','LSP'],UML:['US']}; // splits and mergers: a win by the successor is not a flip
const isSucc=(a,b)=>(SUCC[a]||[]).includes(b);
const pcol=k=>(PT[k]||PT.OTH||[0,0,'#8a8f98'])[2], psh=(k,raw)=>k==='OTH'&&raw?raw:(PT[k]||PT.OTH||['Other'])[0];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct0=v=>(v*100).toFixed(v<.1?1:0)+'%';
const win=cs=>!cs||!cs.length?null:(cs.find(c=>c[4])||cs[0]);
function marg(cs){const w=win(cs);if(!w||w[3]==null)return null;const o=cs.filter(c=>c!==w&&c[3]!=null);if(!o.length)return null;
  const r=o.reduce((a,b)=>b[3]>a[3]?b:a);if(w[3]<r[3])return null;return{votes:w[3]-r[3],pct:(w[3]-r[3])/(w[3]+r[3]),ru:r,w}}
const Cn=(r,k)=>r&&r.cen&&CI[k]!=null?r.cen[CI[k]]:null;
const postN=(r,dep)=>r.t==='R'?(dep?'Vice-chair':'Chair'):(dep?'Deputy mayor':'Mayor');
function mix(a,b,t){const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),x=p(a),y=p(b);return'#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')}
const NEUTRAL='#cfd5db';

/* map layers */
const LAYERS=[['off','Outlines only'],['win22','2022 winner'],['win17','2017 winner'],['swing','Held or flipped'],['margin','Close races'],['s26','2026 House'],['reg','Voters per 100 adults']];
const LNOTE={off:'Boundaries only.',
  win22:'Party of the 2022 mayor / chair. Districts and provinces show the party that won the most local governments.',
  win17:'Party of the 2017 mayor / chair. Districts and provinces show the party that won the most local governments.',
  swing:'Did the 2022 mayor / chair come from the same party as in 2017? Successor parties after splits and mergers do not count as flips. Districts and provinces show the share that flipped.',
  margin:'Lead of the 2022 winner over the runner-up, as a share of their two votes. Districts and provinces show the share of local governments decided by under 5%.',
  s26:'2026 House of Representatives proportional vote leader. Constituencies do not follow local-level boundaries, so the colour is the whole district.',
  reg:'2022 registered voters per 100 resident adults (Census 2021). Under 100 can mean voters registered elsewhere; over 100 often means voters living abroad.'};
const RAMP=['#F6E7DC','#EDBE9E','#DF8B5E','#C4501F','#7A2916'];
const BINS={
  margin:{b:[.02,.05,.1,.2,9],l:['Under 2%','2–5%','5–10%','10–20%','20% or more'],c:['#7A2916','#C4501F','#DF8B5E','#EDBE9E','#F6E7DC']},
  reg:{b:[.8,.95,1.05,1.2,99],l:['Under 80','80–95','95–105','105–120','Over 120'],c:['#C4501F','#E9A36F',NEUTRAL,'#8FB7D9','#2F6DA6']},
  aswing:{b:[.15,.3,.45,.6,9],l:['Under 15% flipped','15–30%','30–45%','45–60%','60% or more'],c:RAMP},
  amargin:{b:[.05,.1,.2,.3,9],l:['Under 5% close','5–10%','10–20%','20–30%','30% or more'],c:RAMP}};
const bin=(B,v)=>{const i=B.b.findIndex(x=>v<x);return{k:B.l[i],c:B.c[i],l:B.l[i]}};

function lvM(L,r){
  if(!r)return null;
  if(L==='win22'||L==='win17'){const w=win(L==='win22'?r.h22:r.h17);return w&&{k:w[1],c:pcol(w[1]),l:psh(w[1],w[2]),t:`${postN(r)} ${L==='win22'?2022:2017}: ${psh(w[1],w[2])}`}}
  if(L==='swing'){const a=win(r.h17),b=win(r.h22);if(!a||!b)return null;
    if(a[1]===b[1])return{k:'held',c:NEUTRAL,l:'Held by same party',t:`${psh(b[1],b[2])} held the ${postN(r).toLowerCase()} post`};
    if(isSucc(a[1],b[1]))return{k:'succ',c:mix(NEUTRAL,pcol(b[1]),.45),l:'Passed to successor party',t:`${psh(a[1],a[2])} → ${psh(b[1],b[2])} (successor party)`};
    return{k:b[1],c:pcol(b[1]),l:'Flipped to '+psh(b[1],b[2]),t:`${psh(a[1],a[2])} → ${psh(b[1],b[2])}`}}
  if(L==='margin'){const m=marg(r.h22||[]);if(!m)return null;const b=bin(BINS.margin,m.pct);return{...b,t:`${psh(m.w[1],m.w[2])} won by ${nf(m.votes)} votes (${pct0(m.pct)} of the top two)`}}
  if(L==='reg'){const a=Cn(r,'a18');if(!(r.v22&&r.v22[0]&&a))return null;const v=r.v22[0]/a,b=bin(BINS.reg,v);return{...b,t:`${Math.round(v*100)} registered voters per 100 resident adults`}}
  return null;
}
function lv26(d,p){
  const pr={};(d!=null?[d]:H.dist.filter(x=>x.p===p).map(x=>x.c)).forEach(c=>{const x=ED[c];if(x)for(const k in x.pr)pr[k]=(pr[k]||0)+x.pr[k]});
  const tot=Object.values(pr).reduce((a,b)=>a+b,0);if(!tot)return null;
  const [k,v]=Object.entries(pr).sort((a,b)=>b[1]-a[1])[0];
  return{k,c:pcol(k),l:psh(k),t:`2026 PR vote: ${psh(k)} ${pct0(v/tot)}`};
}
function lvA(L,rs){
  if(L==='win22'||L==='win17'){const c=seatCount(rs,L==='win22'?'h22':'h17'),e=Object.entries(c).sort((a,b)=>b[1]-a[1]);if(!e.length)return null;
    const n=e.reduce((a,b)=>a+b[1],0);return{k:e[0][0],c:pcol(e[0][0]),l:psh(e[0][0]),t:`${psh(e[0][0])} won ${e[0][1]} of ${n} local governments`}}
  if(L==='swing'){const s=swingStats(rs);if(!s.both)return null;const b=bin(BINS.aswing,s.fl/s.both);return{...b,t:`${s.fl} of ${s.both} changed party`}}
  if(L==='margin'){let n=0,k=0;rs.forEach(r=>{const m=marg(r.h22||[]);if(m){n++;if(m.pct<.05)k++}});if(!n)return null;const b=bin(BINS.amargin,k/n);return{...b,t:`${k} of ${n} races decided by under 5%`}}
  if(L==='reg'){let v=0,a=0;rs.forEach(r=>{const x=Cn(r,'a18');if(r.v22&&r.v22[0]&&x){v+=r.v22[0];a+=x}});if(!a)return null;const b=bin(BINS.reg,v/a);return{...b,t:`${Math.round(v/a*100)} registered voters per 100 resident adults`}}
  return null;
}
const recsOf=pr=>pr.k==='m'?[EM[pr.id]]:(pr.k==='d'?(MD[pr.c]||[]):H.mun.filter(m=>m.p===pr.c)).map(m=>EM[m.id]).filter(Boolean);
function lvOf(pr){
  const L=S.layer;if(L==='off'||!EL)return null;
  if(L==='s26')return pr.k==='m'?lv26(M[pr.id].d):pr.k==='d'?lv26(pr.c):lv26(null,pr.c);
  if(pr.k==='m')return lvM(L,EM[pr.id]);
  const rs=recsOf(pr);return rs.length?lvA(L,rs):null;
}
function styleFor(f){
  if(S.layer==='off')return THIN;
  const v=lvOf(f.properties);
  return v?{...THIN,fillColor:v.c,fillOpacity:.72,color:'#ffffff',weight:.7,opacity:.9}:{...THIN,fillColor:'#cfd5db',fillOpacity:.35};
}
function restyle(){if(S.prov==null&&S.mun==null&&S.dist==null&&(S.layer==='off')!==(admGeo&&admGeo.getLayers()[0]&&admGeo.getLayers()[0].feature.properties.k==='p'))return drawGeo().then(renderSide);if(admGeo)admGeo.setStyle(styleFor);renderLayers()}
function renderLayers(){
  const sel=$('#layerSel');if(!sel)return;
  const inMun=S.mun!=null,dis=inMun||!EL;
  sel.innerHTML=LAYERS.map(([k,l])=>`<option value="${k}"${S.layer===k?' selected':''}>${l}</option>`).join('');
  sel.disabled=dis;sel.title=dis?'Pick a district, province or all of Nepal to colour the map':'';
  sel.onchange=()=>setLayer(sel.value);
  const lg=$('#maplegend'),nt=$('#layernote');
  if(!EL||!admGeo){lg.innerHTML='';nt.textContent=inMun?'Ward boundaries. Election results are for the whole municipality; ward-level results are not in the data yet.':'';return}
  const cnt=new Map();let none=0;
  if(S.layer!=='off')admGeo.eachLayer(l=>{const v=lvOf(l.feature.properties);if(!v){none++;return}const o=cnt.get(v.k)||{...v,n:0};o.n++;cnt.set(v.k,o)});
  const ord=[...BINS.margin.l,...BINS.reg.l,...BINS.aswing.l,...BINS.amargin.l],rows=[...cnt.values()];
  rows.sort((x,y)=>ord.includes(x.l)&&ord.includes(y.l)?ord.indexOf(x.l)-ord.indexOf(y.l):y.n-x.n);
  const unit=S.dist!=null?'municipalities':S.prov!=null?'districts':(admGeo.getLayers()[0]&&admGeo.getLayers()[0].feature.properties.k==='p'?'provinces':'districts');
  lg.innerHTML=S.layer==='off'?'':`<span class="lt">${(LAYERS.find(x=>x[0]===S.layer)||[])[1]} · ${unit}</span>${rows.map(r=>`<span class="lp"><i class="sw" style="background:${r.c}"></i>${esc(r.l)} <span class="n">${r.n}</span></span>`).join('')}${none?`<span class="lp"><i class="sw" style="background:#cfd5db"></i>No data <span class="n">${none}</span></span>`:''}`;
  nt.textContent=LNOTE[S.layer];
}
const LAYER_YEAR={win17:'17',win22:'22',swing:'22',margin:'22',s26:'26'},YEAR_LAYER={'17':'win17','22':'win22','26':'s26'};
function setLayer(k){S.layer=k;if(LAYER_YEAR[k])S.ey=LAYER_YEAR[k];restyle();renderSide()}
function setYear(k){S.ey=k;S.layer=YEAR_LAYER[k];restyle();renderSide()}

/* ---------- aggregates ---------- */
const scopeRecs=()=>munsIn().map(m=>EM[m.id]).filter(Boolean);
function seatCount(rs,key){const c={};rs.forEach(r=>{const w=win(r[key]);if(w)c[w[1]]=(c[w[1]]||0)+1});return c}
function swingStats(rs){let both=0,fl=0,su=0;rs.forEach(r=>{const a=win(r.h17),b=win(r.h22);if(a&&b){both++;if(isSucc(a[1],b[1]))su++;else if(a[1]!==b[1])fl++}});return{both,fl,su}}
const sumC=(rs,k)=>rs.reduce((a,r)=>a+(Cn(r,k)||0),0);
function scopeD26(){ // district-level 2026 House data for the current scope
  const c=cur();const ds=c.k==='ward'||c.k==='mun'?[M[S.mun].d]:c.k==='dist'?[c.e.c]:c.k==='prov'?H.dist.filter(d=>d.p===c.e.c).map(d=>d.c):H.dist.map(d=>d.c);
  const pr={},seats={},cons=[];ds.forEach(d=>{const x=ED[d];if(!x)return;for(const k in x.pr)pr[k]=(pr[k]||0)+x.pr[k];for(const k in x.seats)seats[k]=(seats[k]||0)+x.seats[k];x.cons.forEach(q=>cons.push({...q,d}))});
  return{pr,seats,cons,n:ds.length};
}

/* ---------- sidebar pieces ---------- */
const EY=[['17','2017'],['22','2022'],['26','2026 House']];
const tlTabs=()=>`<div class="tabs tl" role="tablist" aria-label="Election year">${EY.map(([k,l])=>`<button data-ey="${k}" class="${S.ey===k?'on':''}" role="tab" aria-selected="${S.ey===k}">${l}</button>`).join('')}</div>`;
function raceRows(cs,tot,ne,lim){
  const mx=Math.max(...cs.map(c=>c[3]||0),1),list=lim?cs.slice(0,lim):cs;
  return list.map(c=>`<div class="res"><div class="nm"><span ${ne?'lang="ne"':''}>${esc(c[0])}</span>${c[4]===1?'<span class="win">WON</span>':''}</div><div class="vt num">${c[3]!=null?nf(c[3]):'–'}</div>
   <div class="meta"><span class="src" style="display:flex;align-items:center;gap:6px"><i class="dot" style="background:${pcol(c[1])}"></i>${esc(psh(c[1],c[2]))}${c[3]!=null&&tot?' · '+(c[3]/tot*100).toFixed(1)+'%':''}</span><div class="bar"><i style="width:${(c[3]||0)/mx*100}%;background:${pcol(c[1])}"></i></div></div></div>`).join('')
   +(lim&&cs.length>lim?`<div class="src">+ ${cs.length-lim} more candidates</div>`:'');
}
function partyBars(cnt,unit){
  const e=Object.entries(cnt).sort((a,b)=>b[1]-a[1]),mx=e.length?e[0][1]:1;
  return e.map(([k,v])=>`<div class="res"><div class="nm">${esc(psh(k))}</div><div class="vt num">${nf(v)}</div><div class="meta"><div class="bar"><i style="width:${v/mx*100}%;background:${pcol(k)}"></i></div></div></div>`).join('')||`<div class="src">No ${unit||'results'} in this selection.</div>`;
}
function shareBars(pr,n){
  const tot=Object.values(pr).reduce((a,b)=>a+b,0),e=Object.entries(pr).sort((a,b)=>b[1]-a[1]).slice(0,n||6);if(!tot)return'';
  return e.map(([k,v])=>`<div class="hb" style="grid-template-columns:96px 1fr 62px"><span>${esc(psh(k))}</span><div class="bar"><i style="width:${v/e[0][1]*100}%;background:${pcol(k)}"></i></div><span class="num">${pct0(v/tot)}</span></div>`).join('');
}
const realTag='<div class="src"><span class="tag real">Real</span> Election Commission and Kantipur results, via the Nepal Local Election Atlas. Party tallies can differ by one or two from official totals.</div>';


/* ---------- saved visits and contributor (kept in this browser only) ---------- */
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const who=()=>S.who||(S.who=LS.get('gm_who',{name:'Sample Candidate',role:'Candidate'}));
const loadSaved=id=>LS.get('gm_visits_'+id,{});
function persist(){if(!W)return;const o={};W.b.forEach(b=>{if(b.touched)o[b.id]={v:b.v,date:b.date,rem:b.rem,by:b.by,vby:b.vby}});LS.set('gm_visits_'+W.w.id,o)}
function mark(b,v){b.v=v;b.date=v?TODAY:null;b.touched=1;b.vby=v?who().name:''}

/* ---------- map buttons: buildings on/off, freehand select ---------- */
function renderMapBtns(){
  const tb=$('#tb'),ts=$('#ts');if(!tb)return;
  tb.classList.toggle('on',S.showB);tb.title=S.showB?'Hide buildings':'Show buildings';tb.setAttribute('aria-pressed',S.showB);const tr=$('#tr');if(tr){tr.classList.toggle('on',!!S.showRoads);tr.title=S.showRoads?'Hide roads':'Show roads'}
  ts.classList.toggle('on',S.lasso);ts.disabled=!W||!S.showB;ts.title=W?(S.lasso?'Stop selecting':'Select houses by drawing around them'):'Open a ward to select houses';
}
$('#tb').onclick=()=>{
  S.showB=!S.showB;
  [bldL,ctxL].forEach(g=>S.showB?map.addLayer(g):map.removeLayer(g));
  if(S.showB)updateContext();else lassoMode(false);
  renderLegend();renderSelbar();renderMapBtns();
};
$('#ts').onclick=()=>lassoMode(!S.lasso);
$('#tr').onclick=()=>toggleRoads();
$('#tg').onclick=()=>{
  if(!navigator.geolocation){toast('Location is not available on this device');return}
  navigator.geolocation.getCurrentPosition(p=>{
    S.me={lat:p.coords.latitude,lng:p.coords.longitude};
    if(S.meMk)map.removeLayer(S.meMk);
    S.meMk=L.circleMarker([S.me.lat,S.me.lng],{radius:8,weight:3,color:'#fff',fillColor:'#0B5FFF',fillOpacity:1,interactive:false}).addTo(map);
    map.setView([S.me.lat,S.me.lng],Math.max(map.getZoom(),17));toast('Routes will start from your location');
  },()=>toast('Could not get your location'),{enableHighAccuracy:true,timeout:12000});
};
function lassoMode(on){
  S.lasso=on&&!!W&&S.showB;const c=map&&map.getContainer();if(!c)return;
  if(S.lasso){map.dragging.disable();c.classList.add('lassoing');closeCard();if(mobile()){S.sheetBefore=S.sheet;setSheet('peek')}}
  else{map.dragging.enable();c.classList.remove('lassoing');lassoL&&lassoL.clearLayers();if(S.sheetBefore){setSheet(S.sheetBefore);S.sheetBefore=null}}
  renderMapBtns();renderSelbar();
}
function inPoly(x,y,P){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const[xi,yi]=P[i],[xj,yj]=P[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c}
function initLasso(){
  const c=map.getContainer();let pts=null,shape=null;
  c.addEventListener('pointerdown',e=>{
    if(!S.lasso||!W||e.button>0)return;
    pts=[map.mouseEventToLatLng(e)];try{c.setPointerCapture(e.pointerId)}catch(_){}
    shape=L.polygon(pts,{color:'#0B5FFF',weight:2,dashArray:'6 4',fillColor:'#0B5FFF',fillOpacity:.12,interactive:false}).addTo(lassoL);e.preventDefault();
  });
  c.addEventListener('pointermove',e=>{if(!pts)return;pts.push(map.mouseEventToLatLng(e));shape.setLatLngs(pts)});
  const end=()=>{
    if(!pts)return;const P=pts.map(p=>[p.lng,p.lat]);pts=null;shape=null;lassoL.clearLayers();
    if(P.length<3)return;
    let n=0;W.b.forEach((b,i)=>{if((S.filter==='all'||(S.filter==='v')===b.v)&&inPoly(b.cx,b.cy,P)&&!S.pick.has(i)){S.pick.add(i);n++}});
    if(!n)toast('No houses inside that outline');
    syncAll();renderSelbar();
  };
  c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);
}
function renderSelbar(){
  const el=$('#selbar');if(!el)return;
  const n=S.pick.size;
  if(!W||!S.showB||(!S.lasso&&!n&&!S.undo)){el.hidden=true;return}
  el.hidden=false;
  const done=S.lasso?'<button class="btn ghost sm" id="sbDone">Done</button>':'';
  if(!n){
    el.innerHTML=`<span>${S.undo?`Updated ${S.undo.length} houses`:'Draw around the houses you want'}</span>${S.undo?'<button class="btn ghost sm" id="sbUndo">Undo</button>':''}${done}`;
  }else{
    let v=0;S.pick.forEach(i=>{if(W.b[i].v)v++});
    el.innerHTML=`<span><b class="num">${nf(n)}</b> selected <small>(${nf(v)} visited)</small></span>
      <button class="btn sm" id="sbV">Mark visited</button><button class="btn ghost sm" id="sbN">Not visited</button><button class="btn ghost sm" id="sbR">Plan route</button><button class="btn ghost sm" id="sbC">Clear</button>${done}`;
  }
  const on=(id,f)=>{const b=$(id);if(b)b.onclick=f};
  on('#sbV',()=>bulk(true));on('#sbN',()=>bulk(false));on('#sbR',()=>routeFromPick());
  on('#sbC',()=>{S.pick.clear();S.undo=null;syncAll();renderSelbar()});on('#sbDone',()=>{S.undo=null;lassoMode(false)});on('#sbUndo',undoBulk);
}
function bulk(v){
  S.undo=[...S.pick].map(i=>({i,v:W.b[i].v,date:W.b[i].date,t:W.b[i].touched,by:W.b[i].vby}));
  const k=S.pick.size;S.pick.forEach(i=>mark(W.b[i],v));S.pick.clear();persist();
  syncAll();renderSide();renderSelbar();renderCard();toast(`${nf(k)} houses marked as ${v?'visited':'not visited'}`);
}
function undoBulk(){
  if(!S.undo)return;S.undo.forEach(u=>{const b=W.b[u.i];b.v=u.v;b.date=u.date;b.touched=u.t;b.vby=u.by});
  S.undo=null;persist();syncAll();renderSide();renderSelbar();renderCard();toast('Undone');
}

/* ---------- route planning ---------- */
/* Road network: Galli Maps road-line vector tiles (protobuf). Decoded here, turned into a graph, and used to order and draw routes along real roads. */
const ROAD_URL='https://gtiles.gallimap.com/api/v1/mapdisplay/map/roadline_roadline/{z}/{x}/{y}',ROAD_LAYER='roadline_roadline';
const RG={};
function pbVar(b,p){let r=0,s=0,x;do{x=b[p.i++];r+=(x&127)*2**s;s+=7}while(x&128);return r}
function pbSkip(b,p,t){if(t===0)pbVar(b,p);else if(t===1)p.i+=8;else if(t===2){const n=pbVar(b,p);p.i+=n}else if(t===5)p.i+=4;else throw new Error('bad tile')}
function mvtLines(buf,z,tx,ty){
  const b=new Uint8Array(buf),p={i:0},out=[];
  while(p.i<b.length){
    const tag=pbVar(b,p),f=tag>>3,t=tag&7;
    if(f!==3||t!==2){pbSkip(b,p,t);continue}
    const end=pbVar(b,p)+p.i,feats=[];let name='',ext=4096;
    while(p.i<end){const g=pbVar(b,p),gf=g>>3,gt=g&7;
      if(gf===1&&gt===2){const n=pbVar(b,p);name=new TextDecoder().decode(b.subarray(p.i,p.i+n));p.i+=n}
      else if(gf===2&&gt===2){const n=pbVar(b,p);feats.push([p.i,p.i+n]);p.i+=n}
      else if(gf===5&&gt===0)ext=pbVar(b,p);
      else pbSkip(b,p,gt)}
    if(name!==ROAD_LAYER)continue;
    const n2=2**z,ll=(x,y)=>[(tx+x/ext)/n2*360-180,Math.atan(Math.sinh(Math.PI-2*Math.PI*(ty+y/ext)/n2))*180/Math.PI];
    feats.forEach(([s,e])=>{
      const q={i:s};let type=0,geo=null;
      while(q.i<e){const g=pbVar(b,q),gf=g>>3,gt=g&7;
        if(gf===3&&gt===0)type=pbVar(b,q);
        else if(gf===4&&gt===2){const n=pbVar(b,q);geo=[q.i,q.i+n];q.i+=n}
        else pbSkip(b,q,gt)}
      if(type!==2||!geo)return;
      const r={i:geo[0]};let x=0,y=0,line=null;
      const zz=v=>(v>>>1)^-(v&1);
      while(r.i<geo[1]){const c=pbVar(b,r),id=c&7,cnt=c>>3;
        if(id===1||id===2)for(let k=0;k<cnt;k++){x+=zz(pbVar(b,r));y+=zz(pbVar(b,r));if(id===1){line=[ll(x,y)];out.push(line)}else line.push(ll(x,y))}}
    });
  }
  return out;
}
async function loadRoadGraph(w){
  if(w.id in RG)return RG[w.id];
  try{
    const pad=.003,[W0,S0,E0,N0]=[w.bb[0]-pad,w.bb[1]-pad,w.bb[2]+pad,w.bb[3]+pad];
    const tx=(lon,z)=>Math.floor((lon+180)/360*2**z),ty=(lat,z)=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**z);
    let z=16;
    for(;z>13;z--){if((tx(E0,z)-tx(W0,z)+1)*(ty(S0,z)-ty(N0,z)+1)<=16)break}
    const x0=tx(W0,z),x1=tx(E0,z),y0=ty(N0,z),y1=ty(S0,z),jobs=[];
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)jobs.push([x,y]);
    const lines=[];
    await Promise.all(jobs.map(async([x,y])=>{const r=await fetch(ROAD_URL.replace('{z}',z).replace('{x}',x).replace('{y}',y));if(!r.ok)throw new Error('tile '+r.status);const buf=await r.arrayBuffer();if(buf.byteLength)lines.push(...mvtLines(buf,z,x,y))}));
    const ids=new Map(),nodes=[],adj=[],segs=[],K=3e4,seen=new Set();
    const nid=([lo,la])=>{const k=Math.round(lo*K)+','+Math.round(la*K);let i=ids.get(k);if(i==null){i=nodes.length;ids.set(k,i);nodes.push([lo,la]);adj.push([])}return i};
    const dm=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos(a[1]*Math.PI/180),(a[1]-b[1])*111320);
    lines.forEach(l=>{let prev=null;l.forEach(pt=>{const i=nid(pt);if(prev!=null&&prev!==i){const k=prev<i?prev+'_'+i:i+'_'+prev;if(!seen.has(k)){seen.add(k);const d=dm(nodes[prev],nodes[i]);adj[prev].push([i,d]);adj[i].push([prev,d]);segs.push([prev,i])}}prev=i})});
    return RG[w.id]=segs.length?{nodes,adj,segs,dm}:null;
  }catch(e){console.warn('roads unavailable',e);return RG[w.id]=null}
}
/* snap a building to the nearest road segment: foot point, distance to it, and the two segment ends with their distances along the segment */
function snapTo(g,b){
  const mx=111320*Math.cos(b.cy*Math.PI/180);let best=null;
  for(const [a,c] of g.segs){
    const A=g.nodes[a],C=g.nodes[c],ax=(A[0]-b.cx)*mx,ay=(A[1]-b.cy)*111320,cx=(C[0]-b.cx)*mx,cy=(C[1]-b.cy)*111320;
    const dx=cx-ax,dy=cy-ay,L2=dx*dx+dy*dy,t=L2?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/L2)):0,px=ax+t*dx,py=ay+t*dy,d=Math.hypot(px,py);
    if(!best||d<best.d)best={d,a,c,t,pt:[b.cx+px/mx,b.cy+py/111320],la:Math.hypot(px-ax,py-ay),lc:Math.hypot(px-cx,py-cy)};
  }
  return best;
}
function dijkstra(g,src,targets){
  const n=g.nodes.length,dist=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1);
  const heap=[],push=(d,u)=>{heap.push([d,u]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p}};
  const pop=()=>{const t=heap[0],l=heap.pop();if(heap.length){heap[0]=l;let i=0;for(;;){let m=i,a=2*i+1,c=a+1;if(a<heap.length&&heap[a][0]<heap[m][0])m=a;if(c<heap.length&&heap[c][0]<heap[m][0])m=c;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m}}return t};
  dist[src.a]=src.la;prev[src.a]=-2;push(src.la,src.a);
  if(src.lc<dist[src.c]){dist[src.c]=src.lc;prev[src.c]=-2;push(src.lc,src.c)}
  const need=new Set();targets.forEach(t=>{need.add(t.a);need.add(t.c)});
  while(heap.length){const [d,u]=pop();if(d>dist[u])continue;if(need.delete(u)&&!need.size)break;
    for(const [v,w] of g.adj[u]){const nd=d+w;if(nd<dist[v]){dist[v]=nd;prev[v]=u;push(nd,v)}}}
  return{dist,prev};
}
function roadDist(g,sa,sb,run){
  let best=Math.min(run.dist[sb.a]+sb.la,run.dist[sb.c]+sb.lc);
  if((sa.a===sb.a&&sa.c===sb.c)||(sa.a===sb.c&&sa.c===sb.a)){const L=g.dm(g.nodes[sa.a],g.nodes[sa.c]),ta=sa.a===sb.a?sa.t:1-sa.t;best=Math.min(best,Math.abs(ta-sb.t)*L)}
  return best+sa.d+sb.d;
}
function roadPath(g,sa,sb,run,A,B){
  const viaA=run.dist[sb.a]+sb.la,viaC=run.dist[sb.c]+sb.lc,end=viaA<=viaC?sb.a:sb.c;
  const seq=[];for(let u=end;u>=0;u=run.prev[u])seq.push(g.nodes[u]);seq.reverse();
  return{pts:[[A.cy,A.cx],[sa.pt[1],sa.pt[0]],...seq.map(p=>[p[1],p[0]]),[sb.pt[1],sb.pt[0]],[B.cy,B.cx]],d:Math.min(viaA,viaC)+sa.d+sb.d};
}
const MAXSTOP=80,WALK_KMH=4.5,MIN_PER_STOP=3;
const metres=(a,b)=>{const mx=111320*Math.cos(a.cy*Math.PI/180);return Math.hypot((a.cx-b.cx)*mx,(a.cy-b.cy)*111320)};
/* distance between every pair of stops: along roads where the network connects them, else straight line x 1.3 */
function distMatrix(idxs,g){
  const B=W.b,n=idxs.length,D=Array.from({length:n},()=>new Float64Array(n));
  const sn=g?idxs.map(i=>snapTo(g,B[i])):null;
  for(let a=0;a<n;a++){
    const run=g?dijkstra(g,sn[a],sn):null;
    for(let c=0;c<n;c++){if(a===c)continue;let d=metres(B[idxs[a]],B[idxs[c]])*1.3;
      if(g){const r=roadDist(g,sn[a],sn[c],run);if(isFinite(r))d=r}D[a][c]=d}
  }
  return D;
}
/* nearest-neighbour order improved by 2-opt; the first stop stays first */
function orderStops(idxs,firstIdx,D){
  const n=idxs.length,first=idxs.indexOf(firstIdx),left=[...Array(n).keys()].filter(i=>i!==first),path=[first];
  while(left.length){const last=path[path.length-1];let bi=0,bd=Infinity;left.forEach((j,k)=>{if(D[last][j]<bd){bd=D[last][j];bi=k}});path.push(left.splice(bi,1)[0])}
  for(let pass=0,imp=true;imp&&pass<40;pass++){
    imp=false;
    for(let i=1;i<n-1;i++)for(let j=i+1;j<n;j++){
      const before=D[path[i-1]][path[i]]+(j<n-1?D[path[j]][path[j+1]]:0),after=D[path[i-1]][path[j]]+(j<n-1?D[path[i]][path[j+1]]:0);
      if(after<before-1){path.splice(i,j-i+1,...path.slice(i,j+1).reverse());imp=true}
    }
  }
  return path.map(k=>idxs[k]);
}
/* legs between consecutive stops: road polylines where the network connects them, else a straight line */
async function buildLegs(){
  const my=++S.legTok,r=S.route.slice();
  if(r.length<2){S.legs=[];drawRoute();renderSide();return}
  const g=await loadRoadGraph(W.w);if(my!==S.legTok)return;
  const B=W.b,sn=g?r.map(i=>snapTo(g,B[i])):null,legs=[];
  for(let k=1;k<r.length;k++){
    let leg=null;
    if(g){const run=dijkstra(g,sn[k-1],[sn[k]]),d=roadDist(g,sn[k-1],sn[k],run);
      if(isFinite(d)&&(isFinite(run.dist[sn[k].a])||isFinite(run.dist[sn[k].c]))){const p=roadPath(g,sn[k-1],sn[k],run,B[r[k-1]],B[r[k]]);leg={d:p.d,pts:p.pts,road:true}}}
    legs.push(leg||{d:metres(B[r[k-1]],B[r[k]])*1.3,pts:[[B[r[k-1]].cy,B[r[k-1]].cx],[B[r[k]].cy,B[r[k]].cx]],road:false});
  }
  S.legs=legs;drawRoute();renderSide();
}
async function planRoute(idxs,start){
  if(!W||!idxs.length){toast('No houses to route');return}
  toast('Planning route…');S.tab='visits';
  const B=W.b,ref=refPoint();
  const a0=start!=null?start:idxs.reduce((m,i)=>metres(B[i],ref)<metres(B[m],ref)?i:m,idxs[0]);
  const pool=[a0,...idxs.filter(i=>i!==a0).sort((a,z)=>metres(B[a],B[a0])-metres(B[z],B[a0])).slice(0,MAXSTOP-1)];
  const g=await loadRoadGraph(W.w);
  S.route=orderStops(pool,a0,distMatrix(pool,g));
  await buildLegs();syncAll();
  const pts=S.route.map(i=>[B[i].cy,B[i].cx]);if(pts.length)map.fitBounds(pts,{padding:[60,60],maxZoom:19});
  if(g&&!S.showRoads)toggleRoads(true);
  toast(idxs.length>MAXSTOP?`Route limited to the ${MAXSTOP} houses nearest the start`:g?`Route planned along roads: ${S.route.length} stops`:`Route planned: ${S.route.length} stops (no road data for this ward, straight lines used)`);
}
const refPoint=()=>S.me?{cx:S.me.lng,cy:S.me.lat}:{cx:map.getCenter().lng,cy:map.getCenter().lat};
function routeFromPick(){
  const all=[...S.pick],todo=all.filter(i=>!W.b[i].v);
  S.pick.clear();renderSelbar();planRoute(todo.length?todo:all);
}
function routeNearest(n){
  const ref=refPoint();
  const todo=W.b.map((b,i)=>i).filter(i=>!W.b[i].v).sort((a,z)=>metres(W.b[a],ref)-metres(W.b[z],ref)).slice(0,n);
  if(!todo.length){toast('Every house in this ward is visited');return}
  planRoute(todo);
}
function routeAdd(i){if(S.route.includes(i)){toast('Already in the route');return}S.route.push(i);renderCard();syncAll();buildLegs();toast(`Added as stop ${S.route.length}`)}
function routeStats(){const m=S.legs.reduce((a,l)=>a+l.d,0);return{m,min:m/1000/WALK_KMH*60+MIN_PER_STOP*S.route.length,road:S.legs.length>0&&S.legs.every(l=>l.road)}}
const fmtDist=m=>m<1000?Math.round(m)+' m':(m/1000).toFixed(1)+' km';
const fmtMin=m=>m<60?Math.round(m)+' min':Math.floor(m/60)+' h '+String(Math.round(m%60)).padStart(2,'0')+' min';
function drawRoute(){
  routeL.clearLayers();if(!W||!S.route.length)return;
  S.legs.forEach(l=>L.polyline(l.pts,{color:'#0B5FFF',weight:l.road?4:3,opacity:.9,dashArray:l.road?null:'7 6',lineJoin:'round',interactive:false}).addTo(routeL));
  S.route.forEach((i,k)=>{const b=W.b[i];
    L.marker([b.cy,b.cx],{icon:L.divIcon({className:'',html:`<div class="rn${b.v?' done':''}">${k+1}</div>`,iconSize:[22,22]}),title:b.id}).on('click',()=>selectB(i)).addTo(routeL)});
}
function routeStop(k,act){
  const i=S.route[k];
  if(act==='dir'){routeLeg(k);return}
  if(act==='go'){map.setView([W.b[i].cy,W.b[i].cx],Math.max(map.getZoom(),18));return}
  if(act==='start'){planRoute(S.route.slice(),i);return}
  if(act==='rm'){S.route.splice(k,1);buildLegs()}
  else if(act==='vis'){mark(W.b[i],!W.b[i].v);persist();renderLegend();drawRoute();renderSide()}
  syncAll();renderCard();
}
function routeClear(){S.route=[];S.legs=[];S.legTok++;drawRoute();syncAll();renderSide()}
function routeReverse(){S.route.reverse();buildLegs()}
/* road layer on the map: Galli Maps road-line tiles */
function roadLayer(){
  if(S.roadVG)return S.roadVG;
  if(!(L.vectorGrid&&L.vectorGrid.protobuf))return null;
  S.roadVG=L.vectorGrid.protobuf(ROAD_URL,{vectorTileLayerStyles:{[ROAD_LAYER]:{color:'#7a5c3e',weight:2,opacity:.8}},maxNativeZoom:16,minZoom:13,interactive:false});
  return S.roadVG;
}
function toggleRoads(on){
  S.showRoads=on===undefined?!S.showRoads:on;const v=roadLayer();
  if(v){S.showRoads?map.addLayer(v):map.removeLayer(v)}
  renderMapBtns();
}
/* ---------- Galli Maps places (vector tiles: map-init.gallimap.com/data/galli-poi) ---------- */
const POI_URL='https://map-init.gallimap.com/data/galli-poi/{z}/{x}/{y}.pbf';
const GG={health:['Health','#D6453D'],education:['Education','#3B7DD8'],worship:['Worship','#8E44AD'],gov:['Offices','#1F4E79'],food:['Food','#E0703A'],stay:['Hotels','#B02A5B'],shops:['Shops','#1F8A70'],money:['Banks','#7A8F2E'],other:['Other','#6B7680']};
const GCLASS={hospital:'health',pharmacy:'health',clinic:'health',health_care:'health',dentist:'health',school:'education',college:'education',education_centre:'education',place_of_worship:'worship',public_office:'gov',organization:'gov',ngo_ingo:'gov',restaurant:'food',cafe:'food',fast_food:'food',khaja_ghar:'food',bakery:'food',lodging:'stay',bank:'money',atm:'money',grocery:'shops',shop:'shops',clothing_store:'shops'};
const GAMEN={hospitals:'health',pharmacy:'health','food and drinks':'food',hotels:'stay',shopping:'shops',bank:'money',atm:'money'};
const grp=p=>GCLASS[p.c]||GAMEN[p.t]||'other';
const GPC={};let gpBusy=0,GV=[],GA=[],PLs=[];
S.gcats=new Set(['health','education','worship','gov']);
function mvtPois(buf,z,tx,ty){
  const b=new Uint8Array(buf),p={i:0},out=[],dec=new TextDecoder();
  while(p.i<b.length){
    const tag=pbVar(b,p),f=tag>>3,t=tag&7;
    if(f!==3||t!==2){pbSkip(b,p,t);continue}
    const len=pbVar(b,p),end=p.i+len,feats=[],keys=[],vals=[];let name='',ext=4096;
    while(p.i<end){const g=pbVar(b,p),gf=g>>3,gt=g&7;
      if(gt===2){const n=pbVar(b,p),s=p.i;p.i+=n;
        if(gf===1)name=dec.decode(b.subarray(s,p.i));
        else if(gf===2)feats.push([s,p.i]);
        else if(gf===3)keys.push(dec.decode(b.subarray(s,p.i)));
        else if(gf===4){const q={i:s};let v=null;
          while(q.i<p.i){const h=pbVar(b,q),hf=h>>3,ht=h&7;
            if(hf===1&&ht===2){const m=pbVar(b,q);v=dec.decode(b.subarray(q.i,q.i+m));q.i+=m}
            else if(ht===0){const x=pbVar(b,q);v=hf===6?(x>>>1)^-(x&1):hf===7?!!x:x}
            else pbSkip(b,q,ht)}
          vals.push(v)}}
      else if(gf===5&&gt===0)ext=pbVar(b,p);
      else pbSkip(b,p,gt)}
    if(name!=='poi')continue;
    const n2=2**z;
    feats.forEach(([s,e])=>{
      const q={i:s};let type=0,geo=null;const tags=[];
      while(q.i<e){const g=pbVar(b,q),gf=g>>3,gt=g&7;
        if(gf===3&&gt===0)type=pbVar(b,q);
        else if(gf===2&&gt===2){const n=pbVar(b,q),stop=q.i+n;while(q.i<stop)tags.push(pbVar(b,q))}
        else if(gf===4&&gt===2){const n=pbVar(b,q);geo=[q.i,q.i+n];q.i+=n}
        else pbSkip(b,q,gt)}
      if(type!==1||!geo)return;
      const r={i:geo[0]};pbVar(b,r);const zz=v=>(v>>>1)^-(v&1),px=zz(pbVar(b,r)),py=zz(pbVar(b,r));
      const pr={};for(let k=0;k<tags.length;k+=2)pr[keys[tags[k]]]=vals[tags[k+1]];
      out.push({x:(tx+px/ext)/n2*360-180,y:Math.atan(Math.sinh(Math.PI-2*Math.PI*(ty+py/ext)/n2))*180/Math.PI,n:pr.name||pr.name_en||'',c:pr.class||'',s:pr.subclass||'',a:pr.address||'',t:pr.type_amenity||'',r:pr.rank||18});
    });
  }
  out.forEach(o=>o.g=grp(o));
  return out;
}
function gpTile(x,y){
  const k=x+'/'+y;if(GPC[k])return GPC[k];
  return GPC[k]=(async()=>{try{const r=await fetch(POI_URL.replace('{z}',14).replace('{x}',x).replace('{y}',y));if(!r.ok)return[];const buf=await r.arrayBuffer();return buf.byteLength?mvtPois(buf,14,x,y):[]}catch(e){delete GPC[k];return[]}})();
}
const tileXY=(lng,lat)=>[Math.floor((lng+180)/360*16384),Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*16384)];
/* places in the current view; finer ranks only appear as you zoom in, like the Galli Maps style */
async function updateGP(){
  const my=++gpBusy;
  if(!S.showPoi||map.getZoom()<14){poiL.clearLayers();GV=[];GA=[];renderPoiPanel();return}
  const bd=map.getBounds(),[x0,y0]=tileXY(bd.getWest(),bd.getNorth()),[x1,y1]=tileXY(bd.getEast(),bd.getSouth());
  if((x1-x0+1)*(y1-y0+1)>9){poiL.clearLayers();GV=[];GA=[];renderPoiPanel();return}
  const ts=[];for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)ts.push(gpTile(x,y));
  const seen=new Set(),all=(await Promise.all(ts)).flat().filter(o=>{const k=o.n+o.x.toFixed(5)+o.y.toFixed(5);if(seen.has(k))return false;seen.add(k);return true});if(my!==gpBusy)return;
  const z=map.getZoom();
  GA=all.filter(o=>o.n&&o.x>=bd.getWest()&&o.x<=bd.getEast()&&o.y>=bd.getSouth()&&o.y<=bd.getNorth());
  GV=GA.filter(o=>o.r<=z+1);
  drawGP();renderPoiPanel();
}
const gpCanvas=()=>S.gcv||(S.gcv=L.canvas({padding:.3,tolerance:6}));
function drawGP(){
  poiL.clearLayers();const cv=gpCanvas();
  GV.filter(o=>S.gcats.has(o.g)).slice(0,2500).forEach(o=>{
    L.circleMarker([o.y,o.x],{renderer:cv,radius:S.gsel===o?8:5.5,weight:S.gsel===o?3:1.5,color:S.gsel===o?'#16202a':'#fff',fillColor:GG[o.g][1],fillOpacity:.95,bubblingMouseEvents:false}).bindTooltip(o.n).on('click',()=>selectG(o)).addTo(poiL)});
}
function selectG(o,go){S.gsel=o;S.type='g';S.sel=0;if(go)map.setView([o.y,o.x],Math.max(map.getZoom(),17));drawGP();renderCard()}

/* Galli Maps share links carry two points: ?data=base64url({t:"l", l:polyline(start,end), sa, ea}) */
function polyEnc(pts){let la0=0,ln0=0,o='';const e=v=>{v=v<0?~(v<<1):v<<1;let t='';while(v>=32){t+=String.fromCharCode((32|(v&31))+63);v>>=5}return t+String.fromCharCode(v+63)};
  for(const [a,b] of pts){const la=Math.round(a*1e5),ln=Math.round(b*1e5);o+=e(la-la0)+e(ln-ln0);la0=la;ln0=ln}return o}
function galliLink(a,b,sa,ea){
  const j=JSON.stringify({t:'l',l:polyEnc([[a.cy,a.cx],[b.cy,b.cx]]),sa,ea});
  return 'https://map.gallimap.com/?data='+btoa(j).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function routeLeg(k){ // directions in Galli Maps from stop k-1 to stop k
  if(k<1||k>=S.route.length)return;
  const a=W.b[S.route[k-1]],b=W.b[S.route[k]];
  window.open(galliLink(a,b,`Stop ${k} ${a.id}`,`Stop ${k+1} ${b.id}`),'_blank','noopener');
}
const routeMaps=()=>routeLeg(1);
function routeCSV(){
  const st=routeStats(),rows=[['Route'],[],...contribRows(),['Route for',levelName()],['Stops',S.route.length],['Walking distance',fmtDist(st.m)],['Estimated time',fmtMin(st.min)],[],['Stop','Building ID','Latitude','Longitude','Status','Note']];
  S.route.forEach((i,k)=>{const b=W.b[i];rows.push([k+1,b.id,b.cy.toFixed(6),b.cx.toFixed(6),b.v?'Visited':'Not visited',b.rem||''])});
  download(`route-ward-${W.w.no}.csv`,toCSV(rows),'text/csv');
}
function routeHTML(){
  if(!S.route.length){
    return `<div class="lbl">Plan a route</div>
     <div class="hint2">Select houses with the <b>Select</b> button on the map, then press Plan route. Or let the dashboard pick the nearest houses still to visit.</div>
     <div class="btnrow"><select class="field sm" id="rN" aria-label="Number of houses"><option>10</option><option selected>20</option><option>30</option><option>50</option></select><button class="btn sm" id="rNear">Route nearest not-visited</button></div>`;
  }
  const st=routeStats();
  return `<div class="lbl">Route</div>
   <div class="mini"><div><small>Stops</small><b class="num">${S.route.length}</b></div><div><small>${st.road?'By road':'Walk'} · est. time</small><b class="num">${fmtDist(st.m)} · ${fmtMin(st.min)}</b></div></div>
   <div class="btnrow"><button class="btn ghost sm" id="rRev">Reverse</button><button class="btn ghost sm" id="rCsv">Download</button><button class="btn ghost sm" id="rMap" ${S.route.length<2?'disabled':''} title="Opens Galli Maps directions from stop 1 to stop 2. Use the arrow on any stop for the leg to it.">Galli Maps</button><button class="btn ghost sm" id="rClr">Clear</button></div>
   <ol class="stops">${S.route.map((i,k)=>{const b=W.b[i];return `<li><button class="sn${b.v?' done':''}" data-rs="${k}" data-act="go" title="Show on map">${k+1}</button>
     <span class="stxt"><b>${b.id}</b><small>${b.v?'Visited '+(b.date||''):'Not visited'}${b.rem?' · '+esc(b.rem.slice(0,40)):''}</small></span>
     <span class="sact"><button data-rs="${k}" data-act="vis" title="${b.v?'Mark not visited':'Mark visited'}" aria-label="Toggle visited">${b.v?'↺':'✓'}</button>${k?`<button data-rs="${k}" data-act="dir" title="Directions from the previous stop in Galli Maps" aria-label="Directions">➜</button><button data-rs="${k}" data-act="start" title="Start the route here" aria-label="Start here">⚑</button>`:''}<button data-rs="${k}" data-act="rm" title="Remove" aria-label="Remove stop">×</button></span></li>`}).join('')}</ol>`;
}


/* ---------- 2022 ward-level results (data/results22.json, scraped from Kantipur's results pages) ---------- */
const PALIAS={'CPN-UML':'UML','CPN (Unified Socialist)':'US','Maoist Centre':'MC','Janata Samajwadi Party':'JSP','Loktantrik Samajwadi Party':'LSP',"Nepal Workers' and Peasants' Party":'NWPP','Rastriya Janamorcha':'RJM','Rastriya Prajatantra Party Nepal':'RPP','Nepali Congress (BP)':'OTH'};
function pcode(name){
  if(!PNAME){PNAME={};Object.entries(PT).forEach(([k,v])=>{PNAME[v[1].toLowerCase()]=k;PNAME[v[0].toLowerCase()]=k})}
  return PALIAS[name]||PNAME[(name||'').toLowerCase()]||'OTH';
}
const toRow=c=>[c[0],pcode(c[1]),c[1],c[2],c[3]]; // name, party code, party name, votes, won
const wardWinner=(mid,no)=>{const w=R22&&R22[mid]&&R22[mid].w[no],p=w&&w.p&&w.p.find(c=>c[3]);return p||null};
function wardStyle(no){
  const w=S.layer!=='off'&&wardWinner(S.mun,no);
  return w?{...THIN,fillColor:pcol(pcode(w[1])),fillOpacity:S.ward==null?.62:.18,color:'#ffffff',weight:.9,opacity:.95}:THIN;
}
const WPOSTS=[['p','Ward chair'],['m','Ward members'],['f','Women members'],['d','Dalit women members']];
function wardResultsHTML(mid,no){
  const r=R22&&R22[mid],w=r&&r.w[no];
  if(!w)return'<div class="warnbox">Ward-level 2022 results are not available for this ward.</div>';
  const blk=([k,l])=>{const cs=(w[k]||[]);if(!cs.length)return'';const tot=cs.reduce((a,c)=>a+(c[2]||0),0);
    const body=raceRows(cs.map(toRow),k==='p'?tot:0,false);
    return k==='p'?`<div><div class="lbl">${l} · ${cs.length} candidates${tot?` · ${nf(tot)} votes`:''}</div>${body}</div>`:`<details class="more"><summary>${l} · ${cs.length} candidates</summary>${body}</details>`};
  return WPOSTS.map(blk).join('');
}
function wardChairBar(mid){
  const r=R22&&R22[mid];if(!r)return'';const c={};let n=0;
  Object.values(r.w).forEach(w=>{const p=w.p&&w.p.find(x=>x[3]);if(p){const k=pcode(p[1]);c[k]=(c[k]||0)+1;n++}});
  if(!n)return'';const e=Object.entries(c).sort((a,b)=>b[1]-a[1]);
  return `<div><div class="lbl">Ward chairs won, 2022 (${n} wards)</div><div class="stack">${e.map(([k,v])=>`<i style="width:${v/n*100}%;background:${pcol(k)}" title="${esc(psh(k))}: ${v}"></i>`).join('')}</div><div class="legendrow" style="margin-top:8px">${e.map(([k,v])=>`<span><i class="sw" style="background:${pcol(k)}"></i> ${esc(psh(k))} ${v}</span>`).join('')}</div></div>`;
}

/* ---------- results ---------- */
function resultsHTML(){
  if(!EL)return'<div class="src">Election data (data/elections.json) did not load.</div>';
  const c=cur();
  if(c.k==='ward'||c.k==='mun'){const r=EM[S.mun];return tlTabs()+(r?llHTML(r,c):'<div class="warnbox">No election data for this area (park, reserve or unmatched boundary).</div>')}
  return tlTabs()+aggHTML(c);
}
/* one post (mayor/chair or deputy/vice-chair): every candidate the data holds, then the rest as a single line */
function postBlock(r,ey,dep){
  const key=(dep?'d':'h')+ey,cs=r[key],lab=postN(r,dep);
  if(!cs||!cs.length)return `<div><div class="lbl">${lab}</div><div class="warnbox">No result in the source.</div></div>`;
  const g=marg(cs);let rows,extra='';
  if(ey==='17'){
    const tot=r[key+'t'],n=r[key+'n'],listed=cs.reduce((a,x)=>a+(x[3]||0),0),more=(n||cs.length)-cs.length;
    rows=raceRows(cs,tot,true);
    const bits=[];if(tot)bits.push(`${nf(tot)} votes cast`);if(more>0&&tot>listed)bits.push(`${more} other candidate${more>1?'s':''} had ${nf(tot-listed)} votes`);
    if(bits.length)extra=`<div class="src">${bits.join(' · ')}</div>`;
  }else rows=raceRows(cs,0,false);
  return `<div><div class="lbl">${lab}${g?` <span class="lead">won by ${nf(g.votes)}</span>`:''}</div>${rows}${extra}</div>`;
}
function llHTML(r,c){
  const m=M[S.mun],ey=S.ey;
  const where=`<div class="src">${esc(mname(m))}${c.k==='ward'&&!(ey==='22'&&R22&&R22[S.mun])?` · results are for the whole local level; ward-level results are not in the data`:''}</div>`;
  if(ey==='26')return d26HTML(scopeD26(),`${esc(D[m.d].n)} district`)+'<div class="src">House constituencies do not follow local boundaries, so this is the whole district.</div>';
  let ex='';
  if(ey==='17'&&r.wc17){const e=Object.entries(r.wc17).sort((a,b)=>b[1]-a[1]),n=e.reduce((a,b)=>a+b[1],0);
    ex=`<div><div class="lbl">Ward chairs won, 2017 (${n} wards)</div><div class="stack">${e.map(([k,v])=>`<i style="width:${v/n*100}%;background:${pcol(k)}" title="${esc(psh(k))}: ${v}"></i>`).join('')}</div><div class="legendrow" style="margin-top:8px">${e.map(([k,v])=>`<span><i class="sw" style="background:${pcol(k)}"></i> ${esc(psh(k))} ${v}</span>`).join('')}</div></div>`}
  if(ey==='22'&&r.by22)ex=`<div><div class="lbl">By-election · ${esc(r.by22.date)}</div>${raceRows(r.by22.c,0,false)}</div>`;
  const flags=(r.f22||[]).map(f=>FLAGS[f]).filter(Boolean);
  const warn=ey==='22'&&(flags.length||r.note22)?`<div class="warnbox"><b>Check before use</b><br>${[r.note22,...flags].filter(Boolean).map(esc).join('<br>')}</div>`:'';
  if(ey==='22'&&R22&&R22[S.mun]){
    if(c.k==='ward')return `${where}<div class="lbl" style="font-size:.9rem;color:var(--ink)">Ward ${S.ward} · 2022</div>${wardResultsHTML(S.mun,S.ward)}<hr class="sep">${postBlock(r,ey,0)}${postBlock(r,ey,1)}${warn}<div class="src">Mayor/chair and deputy are published for the top two candidates only. Ward posts list every candidate.</div>`;
    return `${where}${postBlock(r,ey,0)}${postBlock(r,ey,1)}${wardChairBar(S.mun)}${warn}<div class="src">Click a ward on the map for its chair and member results. Mayor/chair and deputy are published for the top two candidates only.</div>`;
  }
  return `${where}${postBlock(r,ey,0)}${postBlock(r,ey,1)}${ex}${warn}${ey==='22'?'<div class="src">The 2022 source lists the top two candidates for each post.</div>':''}`;
}
const FLAGS={voters_fixed_to_m_plus_f:'Voter total did not match male + female; male + female used.',voters_duplicated_across_pages:'Source repeats another local level’s voter figures, so voters are blank.',head_elected_not_top_votes:'Mayor/chair winner is not the top vote-getter in the source; vote figures may be mis-entered.',deputy_elected_not_top_votes:'Deputy winner is not the top vote-getter in the source; vote figures may be mis-entered.',head_votes_missing:'Mayor/chair vote counts are missing in the source.',deputy_votes_missing:'Deputy vote counts are missing in the source.',head_tied_votes_suspect:'Mayor/chair candidates show identical votes in the source.',deputy_tied_votes_suspect:'Deputy candidates show identical votes in the source.',head_deputy_scale_mismatch:'Mayor/chair and deputy vote totals differ a lot in the source.',votes_exceed_voters:'Votes exceed registered voters in the source, so voters are blank.'};
function d26HTML(x,where){
  const seats=Object.values(x.seats).reduce((a,b)=>a+b,0);
  return `<div class="src"><b style="color:var(--ink)">House of Representatives, March 2026</b> · ${where||''}</div>
   ${seats?`<div class="legendrow">${Object.entries(x.seats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span><i class="sw" style="background:${pcol(k)}"></i> ${esc(psh(k))} ${v}</span>`).join('')}<span>constituency seats</span></div>`:''}
   <div><div class="lbl">Proportional vote</div>${shareBars(x.pr,6)}</div>
   ${x.cons.length&&x.cons.length<=14?`<div><div class="lbl">Constituencies</div><div class="list">${x.cons.map(q=>{const w=q.c[0];return `<div style="padding:8px 10px;border-bottom:1px solid var(--line);font-size:12.5px"><b>${esc(D[q.d].n)}-${q.no}</b> <span style="color:var(--muted)">· ${nf(q.t)} votes</span><br><i class="dot" style="background:${pcol(q.w)}"></i> <span lang="ne">${esc(w[0])}</span> <span class="src">${esc(psh(w[1],w[2]))}, ${nf(w[3])}</span></div>`}).join('')}</div></div>`:`<div class="src">${x.cons.length} constituencies in this selection. Pick a district to list them.</div>`}`;
}
/* district: the mayor / chair and deputy of every local level */
function mayorList(ey){
  const rows=munsIn().map(m=>({m,r:EM[m.id]})).filter(x=>x.r).sort((a,b)=>a.m.n.localeCompare(b.m.n));
  if(!rows.length)return'';
  const line=(r,dep)=>{const w=win(r[(dep?'d':'h')+ey]);return w?`<span class="ml"><i class="dot" style="background:${pcol(w[1])}"></i><span>${postN(r,dep)}: <b lang="ne">${esc(w[0])}</b> · ${esc(psh(w[1],w[2]))}${w[3]!=null?' · '+nf(w[3]):''}</span></span>`:`<span class="ml">${postN(r,dep)}: no result</span>`};
  return `<div><div class="lbl">Every local level · tap one for the full result</div><div class="list tall">${rows.map(({m,r})=>`<button data-bt="${m.id}" class="mrow"><span><b>${esc(mname(m))}</b>${line(r,0)}${line(r,1)}</span></button>`).join('')}</div></div>`;
}
function aggHTML(c){
  const ey=S.ey,rs=scopeRecs(),where=levelName(),n=rs.length;
  if(ey==='26'){
    if(c.k==='nat'){const x={pr:EL.nat26.pr,seats:EL.nat26.seats,cons:[]};return d26HTML(x,'all of Nepal')+'<div class="src">Choose a province or district for constituency detail.</div>'}
    return d26HTML(scopeD26(),where);
  }
  const key='h'+ey,cnt=seatCount(rs,key),tot=Object.values(cnt).reduce((a,b)=>a+b,0);
  let sw='';
  if(ey==='22'){const s=swingStats(rs);sw=`<div class="src">${s.fl} of ${s.both} local governments changed party since 2017; ${s.su} passed to a successor party.</div>`}
  return `<div class="src"><b style="color:var(--ink)">Mayor / chair seats won</b> · ${ey==='17'?'2017':'2022'} · ${nf(tot)} of ${nf(n)} local governments in ${where}</div>${partyBars(cnt,'seats')}${sw}
   ${c.k==='dist'?mayorList(ey):'<div class="src">Choose a district to list the mayor and deputy of each local level.</div>'}`;
}

/* ---------- voters: registered voters, then voting-age people by gender and age group ---------- */
const AGE=[['18–29',[[3,.4],[4,1],[5,1]]],['30–39',[[6,1],[7,1]]],['40–49',[[8,1],[9,1]]],['50–59',[[10,1],[11,1]]],['60+',[12,13,14,15,16,17,18,19].map(i=>[i,1])]];
const ageSum=(a,d)=>d.reduce((s,[i,f])=>s+a[i]*f,0);
function votersHTML(){
  const c=cur(),e=c.e,rs=c.k==='ward'||!EL?[]:scopeRecs();
  const rows=AGE.map(([l,d])=>({l,m:ageSum(e.am,d),f:ageSum(e.af,d)})),tm=rows.reduce((a,r)=>a+r.m,0),tf=rows.reduce((a,r)=>a+r.f,0),adults=tm+tf,mx=Math.max(...rows.map(r=>Math.max(r.m,r.f)),1);
  let v=0,vm=0,vf=0;rs.forEach(r=>{if(r.v22&&r.v22[0]){v+=r.v22[0];vm+=r.v22[1]||0;vf+=r.v22[2]||0}});
  const reg=c.k==='ward'?`<div class="src">Registered voters are published per local level, not per ward. Showing residents of voting age below.</div>`
    :`<div class="lbl" style="margin:0">Registered voters, 2022</div><div><div class="big num">${v?nf(v):'–'}</div>${vm&&vf?`<div class="stack" style="margin-top:8px"><i style="width:${vm/(vm+vf)*100}%;background:var(--male)"></i><i style="width:${vf/(vm+vf)*100}%;background:var(--female)"></i></div><div class="legendrow" style="margin-top:6px"><span><i class="sw" style="background:var(--male)"></i>Male ${nf(vm)} (${pct0(vm/(vm+vf))})</span><span><i class="sw" style="background:var(--female)"></i>Female ${nf(vf)} (${pct0(vf/(vm+vf))})</span></div>`:''}</div>`;
  const real=rs.length&&sumC(rs,'a18')>0;
  const age=`<div class="lbl" style="margin:0">People of voting age (18+)</div>
   <div class="mini"><div><small>Adults 18+${real?'':' (est.)'}</small><b class="num">${nf(real?sumC(rs,'a18'):adults)}</b></div><div><small>Women · men</small><b class="num">${pct0(tf/adults)} · ${pct0(tm/adults)}</b></div></div>
   <div class="ages">${rows.map(r=>`<div class="age"><span>${r.l}</span><div><div class="bar m"><i style="width:${r.m/mx*100}%"></i></div><div class="bar f"><i style="width:${r.f/mx*100}%"></i></div></div><span class="num">${nf(r.m+r.f)}<small>${pct0((r.m+r.f)/adults)}</small></span></div>`).join('')}</div>
   <div class="legendrow"><span><i class="sw" style="background:var(--male)"></i>Male</span><span><i class="sw" style="background:var(--female)"></i>Female</span></div>`;
  let more='';
  if(rs.length){
    const pop=sumC(rs,'pop'),hh=sumC(rs,'hh'),abs=sumC(rs,'abs'),n27=sumC(rs,'n27'),am=rs.reduce((a,r)=>a+(Cn(r,'hh_am')||Cn(r,'hh')||0),0);
    const lit=sumC(rs,'lit')/(sumC(rs,'lit_den')||1);
    more=`<div class="mini"><div><small>People abroad</small><b class="num">${nf(abs)}</b></div><div><small>New voters by 2027</small><b class="num">${nf(n27)}</b></div><div><small>Households</small><b class="num">${nf(hh)}</b></div><div><small>Smartphone homes</small><b class="num">${pct0(sumC(rs,'smart')/(am||1))}</b></div><div><small>Internet homes</small><b class="num">${pct0(sumC(rs,'net')/(am||1))}</b></div><div><small>Can read and write</small><b class="num">${pct0(lit)}</b></div></div>`;
  }else more=`<div class="mini"><div><small>Population</small><b class="num">${nf(e.t)}</b></div><div><small>Males per 100 females</small><b class="num">${Math.round(e.m/e.f*100)}</b></div></div>`;
  return `${reg}${age}<details class="more" ${S.more?'open':''} ontoggle="S.more=this.open"><summary>More census detail</summary>${more}</details>
   <div class="src">${c.k==='ward'||!real?'Age groups are estimated from Census 2021 five-year bands (18–19 is 2/5 of the 15–19 band).':'Census 2021 resident adults; age groups are from its five-year bands.'} Voter rolls are from 2022.</div>`;
}

/* ---------- visits tab ---------- */
function visitsHTML(){
  const c=cur();
  if(!(W&&W.b.length)){
    return `<div class="stats" style="width:100%"><div class="stat"><small>Buildings mapped</small><b class="num">${nf(sumW('nb'))}</b></div><div class="stat"><small>Wards</small><b class="num">${nf(wardsIn().length)}</b></div></div>
      <div class="hint2">${c.k==='ward'?'No building footprints for this ward.':'Pick a ward to track household visits, select houses and plan a route.'}</div>`;
  }
  const st=stats(),circ=2*Math.PI*34;
  return `<div class="prog-top"><div class="ring"><svg viewBox="0 0 84 84" width="84" height="84"><circle class="t" cx="42" cy="42" r="34"/><circle class="f" cx="42" cy="42" r="34" stroke-dasharray="${circ}" stroke-dashoffset="${circ*(1-st.c/100)}"/></svg><b class="num">${st.c.toFixed(0)}%</b></div>
     <div class="stats"><div class="stat"><small>Houses</small><b class="num">${nf(st.t)}</b></div><div class="stat"><small>Visited</small><b class="num" style="color:var(--visited)">${nf(st.v)}</b></div><div class="stat"><small>Remaining</small><b class="num">${nf(st.r)}</b></div></div></div>
   <div class="btnrow"><button class="btn sm ${S.lasso?'':'ghost'}" id="vSel" ${S.showB?'':'disabled title="Show buildings first"'}>${S.lasso?'Stop selecting':'Select houses'}</button><button class="btn ghost sm" id="exp">Export field notes</button></div>
   ${routeHTML()}`;
}

/* ---------- sidebar ---------- */

/* ---------- places tab: stats by type, filters and a clickable list ---------- */
const gDist=o=>{const r=refPoint(),mx=111320*Math.cos(o.y*Math.PI/180);return Math.hypot((o.x-r.cx)*mx,(o.y-r.cy)*111320)};
const fmtM=m=>m<1000?Math.round(m/10)*10+' m':(m/1000).toFixed(1)+' km';
function pFiltered(){
  const q=(S.gq||'').toLowerCase();
  return GA.filter(o=>S.gcats.has(o.g)&&(!S.gtype||(o.s||o.c)===S.gtype)&&(!q||o.n.toLowerCase().includes(q)||(o.a||'').toLowerCase().includes(q)));
}
function pListHTML(){
  PLs=pFiltered().map(o=>({o,d:gDist(o)})).sort((a,z)=>a.d-z.d);
  const rows=PLs.slice(0,150).map(({o,d},i)=>`<button data-g="${i}"><span class="g" style="background:${GG[o.g][1]}"></span><span class="pn">${esc(o.n)}<small>${esc(o.s||o.c)}${o.a?' · '+esc(o.a):''}</small></span><span class="pd">${fmtM(d)}</span></button>`).join('');
  return (rows?`<div class="plist2">${rows}</div>`:'<div class="src" style="padding:8px 0">No places match.</div>')+(PLs.length>150?`<div class="src">Nearest 150 of ${nf(PLs.length)}. Use the filters to narrow.</div>`:'');
}
function placesHTML(){
  if(!S.showPoi)return `<div class="hint2">See schools, health facilities, places of worship, offices and shops from Galli Maps around the area you are looking at.</div><div class="btnrow"><button class="btn sm" id="pOn">Show places on the map</button></div>`;
  if(map.getZoom()<14)return `<div class="hint2">Zoom in to street level to load places.</div><div class="btnrow"><button class="btn sm" id="pZoom">Zoom in</button></div>`;
  if(!GA.length)return '<div class="src">Loading places…</div>';
  const cnt={},types={};GA.forEach(o=>{cnt[o.g]=(cnt[o.g]||0)+1});
  GA.filter(o=>S.gcats.has(o.g)).forEach(o=>{const t=o.s||o.c;if(t)types[t]=(types[t]||0)+1});
  const gk=Object.keys(GG).filter(k=>cnt[k]).sort((a,z)=>cnt[z]-cnt[a]),mx=Math.max(...gk.map(k=>cnt[k]),1);
  const tk=Object.entries(types).sort((a,z)=>z[1]-a[1]).slice(0,14);
  return `<div class="mini"><div><small>Places in view</small><b class="num">${nf(GA.length)}</b></div><div><small>Selected types</small><b class="num">${nf(GA.filter(o=>S.gcats.has(o.g)).length)}</b></div></div>
   <div><div class="lbl">By group · tap to show or hide</div>${gk.map(k=>`<button class="gbar ${S.gcats.has(k)?'':'off'}" data-cat="${k}"><span class="gn"><i style="background:${GG[k][1]}"></i>${GG[k][0]}</span><span class="bar"><i style="width:${cnt[k]/mx*100}%;background:${GG[k][1]}"></i></span><span class="num">${nf(cnt[k])}<small>${pct0(cnt[k]/GA.length)}</small></span></button>`).join('')}</div>
   ${tk.length?`<div><div class="lbl">Types${S.gtype?` · <button class="linkbtn" id="gtClear">clear “${esc(S.gtype)}”</button>`:''}</div><div class="chips">${tk.map(([t,n])=>`<button class="chip ${S.gtype===t?'on':''}" data-gt="${esc(t)}">${esc(t.replace(/_/g,' '))} <span class="num">${nf(n)}</span></button>`).join('')}</div></div>`:''}
   <div><div class="lbl">List · nearest first · tap to see on the map</div><input class="field" id="pq" type="search" placeholder="Filter by name or address" value="${esc(S.gq||'')}" autocomplete="off"><div id="plist">${pListHTML()}</div></div>
   <div class="btnrow"><button class="btn ghost sm" id="pCsv">Download list</button></div>`;
}
function placesCSV(){
  const rows=[['Places in the map view'],[],...contribRows(),['Area',levelName()],['Name','Group','Type','Address','Latitude','Longitude']];
  pFiltered().sort((a,z)=>gDist(a)-gDist(z)).forEach(o=>rows.push([o.n,GG[o.g][0],o.s||o.c,o.a,o.y.toFixed(6),o.x.toFixed(6)]));
  download('places.csv',toCSV(rows),'text/csv');
}
function placesBind(){
  const on=(id,f)=>{const b=$(id);if(b)b.onclick=f};
  on('#pOn',()=>$('#tp').click());on('#pZoom',()=>map.setView(map.getCenter(),14));on('#pCsv',placesCSV);on('#gtClear',()=>{S.gtype=null;renderSide()});
  document.querySelectorAll('#side [data-cat]').forEach(b=>b.onclick=()=>{const k=b.dataset.cat;S.gcats.has(k)?S.gcats.delete(k):S.gcats.add(k);S.gtype=null;drawGP();renderSide()});
  document.querySelectorAll('#side [data-gt]').forEach(b=>b.onclick=()=>{S.gtype=S.gtype===b.dataset.gt?null:b.dataset.gt;renderSide()});
  const bindList=()=>document.querySelectorAll('#plist [data-g]').forEach(b=>b.onclick=()=>{selectG(PLs[+b.dataset.g].o,true);if(mobile())setSheet('peek')});
  bindList();
  const q=$('#pq');if(q)q.oninput=()=>{S.gq=q.value;$('#plist').innerHTML=pListHTML();bindList()};
}

const TABS=[['res','Results'],['vot','Voters'],['visits','Visits'],['places','Places']];
function renderSide(){
  const side=$('#side'),y=side.scrollTop,c=cur();
  const body=S.tab==='res'?resultsHTML():S.tab==='vot'?votersHTML():S.tab==='places'?placesHTML():visitsHTML();
  side.innerHTML=`<button class="grab" id="grab" aria-label="Resize panel"></button><div><h2>${levelName()}</h2><span class="kick">${c.k==='ward'?'Ward':c.k==='mun'?'Local government':c.k==='dist'?'District':c.k==='prov'?'Province':'Whole country'}${S.mun!=null?' · '+esc(D[M[S.mun].d].n)+' district':''} · ${nf(c.e.t)} people</span></div>
   <div class="tabs main" role="tablist">${TABS.map(([k,l])=>`<button data-tab="${k}" class="${S.tab===k?'on':''}" role="tab" aria-selected="${S.tab===k}">${l}</button>`).join('')}</div>
   <div class="pane">${body}</div>`;
  side.scrollTop=y;$('#scopetag').textContent=levelName();
  side.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;renderSide()});
  side.querySelectorAll('[data-ey]').forEach(b=>b.onclick=()=>setYear(b.dataset.ey));
  side.querySelectorAll('[data-bt]').forEach(b=>b.onclick=()=>{const m=M[+b.dataset.bt];setSel(m.p,m.d,m.id)});
  side.querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>routeStop(+b.dataset.rs,b.dataset.act));
  const on=(id,f)=>{const b=$(id);if(b)b.onclick=f};
  on('#exp',openReport);on('#vSel',()=>lassoMode(!S.lasso));on('#rNear',()=>routeNearest(+$('#rN').value));
  on('#rRev',routeReverse);on('#rClr',routeClear);on('#rCsv',routeCSV);on('#rMap',routeMaps);
  grabInit();renderLegend();if(S.tab==='places')placesBind();const tl=$('#tl');if(tl)tl.classList.toggle('on',S.tab==='places');
}
const SHEETS=['peek','half','full'];
function setSheet(k){document.body.dataset.sheet=k;S.sheet=k;if(map)setTimeout(()=>map.invalidateSize(),230)}
function grabInit(){
  const g=$('#grab');if(!g)return;let y0=null;
  g.onpointerdown=e=>{y0=e.clientY;g.setPointerCapture(e.pointerId)};
  g.onpointerup=e=>{if(y0==null)return;const dy=e.clientY-y0,i=SHEETS.indexOf(S.sheet||'half');y0=null;
    if(dy<-24)setSheet(SHEETS[Math.min(2,i+1)]);else if(dy>24)setSheet(SHEETS[Math.max(0,i-1)]);else setSheet(SHEETS[(i+1)%3])};
}
function layoutTop(){const t=$('.top'),c=$('.controls');if(t&&c)document.documentElement.style.setProperty('--top',(t.offsetHeight+c.offsetHeight)+'px')}
addEventListener('resize',()=>{layoutTop();if(map)map.invalidateSize()});
const mobile=()=>matchMedia('(max-width:768px)').matches;

/* ---------- field notes export ---------- */
const contribRows=()=>{const w=who();return [['Contributed by'],['Name',w.name||''],['Role / organisation',w.role||''],['Exported on',new Date().toLocaleString('en-GB')],[]]};
function toCSV(rows){return '﻿'+rows.map(r=>r.map(x=>{x=String(x==null?'':x);return /[",\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x}).join(',')).join('\r\n')}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type+';charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
const RCOLS=['Building ID','Ward','Status','Visit date','Note','Contributed by'];
const rrow=b=>[b.id,W.w.no,b.v?'Visited':'Not visited',b.date||'',b.rem||'',(b.rem||b.v)?(b.rem?b.by:b.vby)||who().name:''];
function reportRows(){const sc=$('#rscope').value;return W.b.filter(b=>sc==='all'||(sc==='v'&&b.v)||(sc==='n'&&!b.v))}
function contributors(rows){const m={};rows.forEach(b=>{const n=b.rem?b.by:b.v?b.vby:'';if(n)m[n]=(m[n]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function renderReport(){
  const rows=reportRows(),st=stats();
  $('#mscope').textContent=`${levelName()} · ${nf(rows.length)} households · ${st.c.toFixed(1)}% visited`;
  $('#prev').innerHTML=`<table><thead><tr>${RCOLS.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,5).map(b=>`<tr>${rrow(b).map((v,i)=>`<td class="${i===4?'rem':''}">${esc(v)||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function openReport(){const w=who();$('#cname').value=w.name;$('#crole').value=w.role;$('#modal').hidden=false;renderReport()}
$('#rscope').onchange=renderReport;
['#mclose','#mcancel'].forEach(s=>$(s).onclick=()=>$('#modal').hidden=true);
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')$('#modal').hidden=true});
$('#mgen').onclick=()=>{
  const name=$('#cname').value.trim();if(!name){$('#cname').focus();toast('Add the name of the person contributing');return}
  S.who={name,role:$('#crole').value.trim()};LS.set('gm_who',S.who);
  const rows=reportRows(),st=stats(),when=new Date().toLocaleString('en-GB'),by=contributors(rows),fmt=$('#rfmt').value;
  const meta=[['Area',levelName()],['Households in this report',rows.length],['Visited',`${st.v} of ${st.t} (${st.c.toFixed(1)}%)`],['Generated',when]];
  const cb=[['Name',name],['Role / organisation',S.who.role||'—'],...by.map(([n,k])=>['Entries by '+n,k])];
  if(fmt==='CSV'){
    download(`field-notes-ward-${W.w.no}.csv`,toCSV([['Field notes'],[],['Contributed by'],...cb,[],...meta,[],RCOLS,...rows.map(rrow)]),'text/csv');
    toast('Field notes downloaded');
  }else{
    const w=window.open('','_blank');if(!w){toast('Allow pop-ups to print the report');return}
    const kv=a=>a.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Field notes · ${esc(levelName())}</title><style>body{font:13px/1.4 system-ui,sans-serif;margin:28px;color:#16202a}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 6px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ccd;padding:5px 8px;text-align:left;vertical-align:top}.kv th{width:210px;color:#5a6673;font-weight:600}.t th{background:#f2f4f6;font-size:11px;text-transform:uppercase}</style>
      <h1>Field notes</h1><h2>Contributed by</h2><table class="kv">${kv(cb)}</table><h2>Report</h2><table class="kv">${kv(meta)}</table>
      <h2>Households</h2><table class="t"><thead><tr>${RCOLS.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(b=>`<tr>${rrow(b).map(v=>`<td>${esc(v)||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),300);
  }
  $('#modal').hidden=true;
};

/* ---------- boot ---------- */
async function init(){
  if(init.done)return;init.done=true;
  try{
    [H,BND,EL]=await Promise.all([getJSON('data/hier.json'),getJSON('data/bounds.json'),getJSON('data/elections.json').catch(()=>null)]);
    getJSON('data/results22.json').then(j=>{R22=j;renderSide();if(S.mun!=null&&wardGeo)wardGeo.setStyle(f=>wardStyle(f.properties.no))}).catch(()=>{});
  }catch(e){$('#loading').textContent='Could not load ./data. Start a local server in this folder (see README.md) and open http://localhost:8080.';return}
  H.prov.forEach(p=>P[p.c]=p);H.dist.forEach(d=>D[d.c]=d);H.mun.forEach(m=>{M[m.id]=m;(MD[m.d]=MD[m.d]||[]).push(m)});
  map=L.map('map',{zoomControl:false,attributionControl:true,preferCanvas:true,zoomSnap:.5});
  L.tileLayer(TILES,{maxZoom:19,attribution:'© Galli Maps'}).addTo(map);
  adm=L.layerGroup().addTo(map);wardL=L.layerGroup().addTo(map);ctxL=L.layerGroup().addTo(map);bldL=L.layerGroup().addTo(map);selL=L.layerGroup().addTo(map);poiL=L.layerGroup().addTo(map);routeL=L.layerGroup().addTo(map);lassoL=L.layerGroup().addTo(map);initLasso();
  map.on('moveend',updateContext);
  map.on('click',e=>{if(S.sel!=null&&!e.originalEvent._b)closeCard()});
  map.fitBounds([[26.3,80],[30.5,88.3]]);
  if(EL){PT=EL.parties;EL.ck.forEach((k,i)=>CI[k]=i);Object.entries(EL.mun).forEach(([id,r])=>EM[+id]=r);Object.entries(EL.d26).forEach(([c,x])=>ED[+c]=x)}
  else{S.layer='off';toast('Election data (data/elections.json) did not load.')}
  setSheet('half');layoutTop();setTimeout(layoutTop,400);
  renderTop();await drawGeo();renderSide();layoutTop();
}
