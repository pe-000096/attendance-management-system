const KEY = 'timeflow.records.v1';
const NAME_KEY = 'timeflow.name.v1';
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const timeText = (value) => value ? new Date(value).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'}) : '—';
const load = () => JSON.parse(localStorage.getItem(KEY) || '{}');
const save = (data) => localStorage.setItem(KEY, JSON.stringify(data));
const minutesBetween = (a,b) => Math.max(0, Math.floor((new Date(b)-new Date(a))/60000));
const workMinutes = (r) => r.clockIn && r.clockOut ? Math.max(0, minutesBetween(r.clockIn,r.clockOut)-(r.breakMinutes||0)) : 0;
const duration = (mins) => `${Math.floor(mins/60)}:${pad(mins%60)}`;
const toast = (message) => { $('toast').textContent=message; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),2200); };
const DOW = ['日','月','火','水','木','金','土'];
const kanjiNum = (n) => { const d=['','一','二','三','四','五','六','七','八','九'], t=Math.floor(n/10), o=n%10; return (t?(t>1?d[t]:'')+'十':'')+d[o] || '〇'; };
const eraYear = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('ja-JP-u-ca-japanese',{era:'long',year:'numeric'});
// 認印の傾き: 日付から決まる擬似乱数（描画のたびに揺れないように）
const sealTilt = (s) => [...s].reduce((a,c)=>a+c.charCodeAt(0),0) % 17 - 8;
const userName = () => localStorage.getItem(NAME_KEY) || '';
const esc = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sealChars = () => esc(userName().split(/[\s　]+/)[0].slice(0,2));
const nowJp = () => { const d=new Date(); return `${d.getHours()}時${pad(d.getMinutes())}分`; };
const monthShift = (ym,delta) => { const [y,m]=ym.split('-').map(Number), t=new Date(y, m-1+delta, 1); return `${t.getFullYear()}-${pad(t.getMonth()+1)}`; };

function current() { return load()[dateKey()] || {}; }
function setToday(patch) { const all=load(); all[dateKey()]={...(all[dateKey()]||{}),...patch,date:dateKey()}; save(all); render(); }
function updateClock() {
  const now=new Date();
  $('clock').innerHTML=`${now.getHours()}:${pad(now.getMinutes())}<small>:${pad(now.getSeconds())}</small>`;
  $('today').textContent=`${now.toLocaleDateString('ja-JP-u-ca-japanese',{era:'long',year:'numeric',month:'long',day:'numeric'})} ${DOW[now.getDay()]}曜日`;
}
function slamStamp() {
  const st=$('status');
  st.style.setProperty('--rot', `${-11+Math.random()*9}deg`);
  st.classList.remove('slam'); void st.offsetWidth; st.classList.add('slam');
}
function punch(type) {
  const r=current(), now=new Date().toISOString();
  if(type==='clockIn') setToday({clockIn:now});
  if(type==='breakStart') setToday({breakStart:now});
  if(type==='breakEnd') setToday({breakMinutes:(r.breakMinutes||0)+minutesBetween(r.breakStart,now),breakStart:null});
  if(type==='clockOut') setToday({clockOut:now});
  slamStamp();
  toast({clockIn:`出勤 ${nowJp()} 記帳`,breakStart:`休憩入 ${nowJp()} 記帳`,breakEnd:`休憩戻 ${nowJp()} 記帳`,clockOut:`退勤 ${nowJp()} 記帳　お疲れさまでした`}[type]);
}
let curMonth = dateKey().slice(0,7), flipping = false;
function renderFor(ym) { curMonth=ym; $('monthFilter').value=ym; render(); }
// 現在のシートの静的な複製（捲れていく紙の表面になる）
function snapshotSheet() {
  const sheet=document.querySelector('main.sheet'), mv=$('monthFilter').value;
  const c=sheet.cloneNode(true);
  c.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
  const mi=c.querySelector('input[type="month"]'); if(mi) mi.setAttribute('value',mv), mi.value=mv;
  return c;
}
function flipTo(newYm) {
  if (newYm===curMonth) return;
  if (flipping || matchMedia('(prefers-reduced-motion: reduce)').matches) { renderFor(newYm); return; }
  flipping=true;
  const book=document.querySelector('.book'), sheet=document.querySelector('main.sheet');
  const dir=newYm>curMonth?'fwd':'back', oldYm=curMonth;
  book.style.minHeight=`${sheet.offsetHeight}px`;
  // 進む: 下を先に新しい月へ差し替え、古いページの複製が捲れて去る。
  // 戻る: 新しい月の複製が左から降りてきて、着地の瞬間に下を差し替える。
  let frontSnap;
  if (dir==='fwd') { frontSnap=snapshotSheet(); renderFor(newYm); }
  else { renderFor(newYm); frontSnap=snapshotSheet(); renderFor(oldYm); }
  frontSnap.classList.add('face','face-front');
  const ghost=frontSnap.cloneNode(true);
  ghost.classList.remove('face','face-front'); ghost.classList.add('ghost');
  const back=document.createElement('div'); back.className='face page-back'; back.appendChild(ghost);
  const turn=document.createElement('div'); turn.className='turn-page'; turn.append(frontSnap, back);
  const shadow=document.createElement('div'); shadow.className=`turn-shadow ${dir}`;
  if (dir==='back') turn.style.transform='rotateY(-178deg)';
  book.append(shadow, turn);
  requestAnimationFrame(()=>requestAnimationFrame(()=>turn.classList.add(`turn-${dir}`)));
  turn.addEventListener('animationend', () => {
    if (dir==='back') renderFor(newYm);
    turn.remove(); shadow.remove(); book.style.minHeight=''; flipping=false;
  }, {once:true});
}
function renderName() {
  const name=userName();
  $('userName').textContent=name||'（未記入）';
  $('userName').classList.toggle('unset',!name);
}
function render() {
  const r=current(), working=!!r.clockIn&&!r.clockOut, breaking=working&&!!r.breakStart;
  $('clockIn').disabled=!!r.clockIn; $('breakStart').disabled=!working||breaking; $('breakEnd').disabled=!breaking; $('clockOut').disabled=!working||breaking;
  $('status').className='stamp'+(breaking?' break':working?' active':r.clockOut?' done':'');
  $('status').innerHTML=`<span>${breaking?'休憩中':working?'勤務中':r.clockOut?'退勤済':'未出勤'}</span>`;
  const month=$('monthFilter').value, rows=Object.values(load()).filter(x=>x.date?.startsWith(month)).sort((a,b)=>b.date.localeCompare(a.date));
  $('ledgerTitle').textContent=`${kanjiNum(Number(month.slice(5)))}月度 記録`;
  $('tateLabel').textContent=`${eraYear(month).replace(/(\d+)/,m=>kanjiNum(Number(m)))}${kanjiNum(Number(month.slice(5)))}月度`;
  const seal=sealChars();
  $('recordsBody').innerHTML=rows.map(x=>{
    const d=new Date(`${x.date}T00:00:00`), dow=d.getDay();
    const sealMark=x.clockOut&&seal?`<span class="mini" style="--rot:${sealTilt(x.date)}deg"><i>${seal}</i></span>`:'';
    return `<tr><td>${d.getMonth()+1}月${d.getDate()}日${x.edited?'<span class="fix-seal">訂</span>':''}</td><td class="dow"><span class="${dow===0?'sun':dow===6?'sat':''}">${DOW[dow]}</span></td><td class="t">${timeText(x.clockIn)}</td><td class="t">${timeText(x.clockOut)}</td><td class="t">${duration(x.breakMinutes||0)}</td><td class="t">${x.clockOut?duration(workMinutes(x)):'—'}</td><td><span class="state ${x.clockOut?'done':'open'}">${x.clockOut?'退勤済':'勤務中'}</span></td><td class="seal">${sealMark}</td><td><button class="edit" data-date="${x.date}">修正</button></td></tr>`;
  }).join('');
  $('empty').hidden=rows.length>0;
  const completed=rows.filter(x=>x.clockOut), total=completed.reduce((s,x)=>s+workMinutes(x),0), overtime=completed.reduce((s,x)=>s+Math.max(0,workMinutes(x)-480),0);
  $('recordsFoot').hidden=rows.length===0;
  $('workDays').textContent=`${rows.length}日`; $('totalHours').textContent=duration(total); $('averageHours').textContent=duration(completed.length?Math.round(total/completed.length):0); $('overtimeHours').textContent=duration(overtime);
  document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>openEdit(b.dataset.date));
}
function openEdit(date) { const r=load()[date]; $('editDate').value=date; $('editIn').value=r.clockIn?.slice(11,16)||''; $('editOut').value=r.clockOut?.slice(11,16)||''; $('editBreak').value=r.breakMinutes||0; $('editDialog').showModal(); }
function localIso(date,time) { return new Date(`${date}T${time}:00`).toISOString(); }
function exportCsv() { const month=$('monthFilter').value, rows=Object.values(load()).filter(x=>x.date?.startsWith(month)); const csv=['日付,出勤,退勤,休憩(分),実働(分)',...rows.map(r=>[r.date,timeText(r.clockIn),timeText(r.clockOut),r.breakMinutes||0,workMinutes(r)].join(','))].join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'})); a.download=`attendance-${month}.csv`; a.click(); URL.revokeObjectURL(a.href); }

['clockIn','breakStart','breakEnd','clockOut'].forEach(id=>$(id).onclick=()=>punch(id));
$('monthFilter').value=curMonth;
$('monthFilter').onchange=()=>{ const v=$('monthFilter').value; $('monthFilter').value=curMonth; if(v) flipTo(v); };
$('prevMonth').onclick=()=>flipTo(monthShift(curMonth,-1));
$('nextMonth').onclick=()=>flipTo(monthShift(curMonth,1));
$('exportCsv').onclick=exportCsv;
$('userName').onclick=()=>{ const name=prompt('氏名を記入してください（認印にも使われます）', userName()); if(name!==null){ localStorage.setItem(NAME_KEY,name.trim()); renderName(); render(); } };
$('saveEdit').onclick=(e)=>{ e.preventDefault(); const date=$('editDate').value; const all=load(); all[date]={...all[date],clockIn:localIso(date,$('editIn').value),clockOut:localIso(date,$('editOut').value),breakMinutes:Number($('editBreak').value),edited:true}; save(all); $('editDialog').close(); render(); toast('修正を記帳しました'); };
updateClock(); setInterval(updateClock,1000); renderName(); render();
