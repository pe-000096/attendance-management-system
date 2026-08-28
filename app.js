const KEY = 'timeflow.records.v1';
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

function current() { return load()[dateKey()] || {}; }
function setToday(patch) { const all=load(); all[dateKey()]={...(all[dateKey()]||{}),...patch,date:dateKey()}; save(all); render(); }
function updateClock() { const now=new Date(); $('clock').textContent=now.toLocaleTimeString('ja-JP'); $('today').textContent=now.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'}); }
function punch(type) {
  const r=current(), now=new Date().toISOString();
  if(type==='clockIn') setToday({clockIn:now});
  if(type==='breakStart') setToday({breakStart:now});
  if(type==='breakEnd') setToday({breakMinutes:(r.breakMinutes||0)+minutesBetween(r.breakStart,now),breakStart:null});
  if(type==='clockOut') setToday({clockOut:now});
  toast({clockIn:'出勤しました',breakStart:'休憩を開始しました',breakEnd:'休憩を終了しました',clockOut:'お疲れさまでした'}[type]);
}
function render() {
  const r=current(), working=!!r.clockIn&&!r.clockOut, breaking=working&&!!r.breakStart;
  $('clockIn').disabled=!!r.clockIn; $('breakStart').disabled=!working||breaking; $('breakEnd').disabled=!breaking; $('clockOut').disabled=!working||breaking;
  $('status').className='status'+(working?' active':''); $('status').innerHTML=`<span></span>${breaking?'休憩中':working?'勤務中':r.clockOut?'退勤済み':'未出勤'}`;
  const month=$('monthFilter').value, rows=Object.values(load()).filter(x=>x.date?.startsWith(month)).sort((a,b)=>b.date.localeCompare(a.date));
  $('recordsBody').innerHTML=rows.map(x=>`<tr><td>${x.date.replaceAll('-','/')}</td><td>${timeText(x.clockIn)}</td><td>${timeText(x.clockOut)}</td><td>${duration(x.breakMinutes||0)}</td><td>${x.clockOut?duration(workMinutes(x)):'—'}</td><td><span class="badge ${x.clockOut?'':'open'}">${x.clockOut?'確定':'勤務中'}</span></td><td><button class="edit" data-date="${x.date}">修正</button></td></tr>`).join('');
  $('empty').hidden=rows.length>0;
  const completed=rows.filter(x=>x.clockOut), total=completed.reduce((s,x)=>s+workMinutes(x),0), overtime=completed.reduce((s,x)=>s+Math.max(0,workMinutes(x)-480),0);
  $('workDays').textContent=`${rows.length}日`; $('totalHours').textContent=duration(total); $('averageHours').textContent=duration(completed.length?Math.round(total/completed.length):0); $('overtimeHours').textContent=duration(overtime);
  document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>openEdit(b.dataset.date));
}
function openEdit(date) { const r=load()[date]; $('editDate').value=date; $('editIn').value=r.clockIn?.slice(11,16)||''; $('editOut').value=r.clockOut?.slice(11,16)||''; $('editBreak').value=r.breakMinutes||0; $('editDialog').showModal(); }
function localIso(date,time) { return new Date(`${date}T${time}:00`).toISOString(); }
function exportCsv() { const month=$('monthFilter').value, rows=Object.values(load()).filter(x=>x.date?.startsWith(month)); const csv=['日付,出勤,退勤,休憩(分),実働(分)',...rows.map(r=>[r.date,timeText(r.clockIn),timeText(r.clockOut),r.breakMinutes||0,workMinutes(r)].join(','))].join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'})); a.download=`attendance-${month}.csv`; a.click(); URL.revokeObjectURL(a.href); }

['clockIn','breakStart','breakEnd','clockOut'].forEach(id=>$(id).onclick=()=>punch(id));
$('monthFilter').value=dateKey().slice(0,7); $('monthFilter').onchange=render; $('exportCsv').onclick=exportCsv;
$('saveEdit').onclick=(e)=>{ e.preventDefault(); const date=$('editDate').value; const all=load(); all[date]={...all[date],clockIn:localIso(date,$('editIn').value),clockOut:localIso(date,$('editOut').value),breakMinutes:Number($('editBreak').value)}; save(all); $('editDialog').close(); render(); toast('勤怠を更新しました'); };
updateClock(); setInterval(updateClock,1000); render();
