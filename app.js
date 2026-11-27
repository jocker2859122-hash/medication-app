
const $=id=>document.getElementById(id), labels=UI_TEXT.slots;const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const day=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const time=x=>new Date(x).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});const qty=n=>{let v=Math.round((+n)*1000)/1000;return Number.isInteger(v)?String(v):String(v)};const unitLabel=m=>{let u=String(m?.unitName??'').trim();return !u||/^\d+(?:\.\d+)?$/.test(u)?'份':u};const qtyText=(n,m)=>`${qty(n)} ${esc(unitLabel(m))}`;let data={meds:[],logs:[],settings:{morning:'09:00',night:'23:00',interval:5}};try{const raw=localStorage.getItem('med-v1');if(raw)data=JSON.parse(raw)}catch(e){alert('無法讀取資料，請先備份或重新載入。')}let tab='today',edit=null,selectedDay=day();function save(){try{localStorage.setItem('med-v1',JSON.stringify(data));setTimeout(()=>cloud.run(),0);return true}catch(e){alert('儲存失敗，請勿依賴本次紀錄。');return false}}

function go(t){tab=t;edit=null;render()}

function remaining(m){if(m.stock==null)return null;return Math.round((m.stock-data.logs.filter(l=>l.id===m.id&&l.stockGen===m.stockGen).reduce((a,l)=>a+(l.units||0),0))*1000)/1000}

function active(m,d){return m.active&&!m.resume&&(!m.start||m.start<=d)&&(!m.end||m.end>=d)}

function eligible(m,s,d){return active(m,d)&&m.slots.includes(s)&&!(d===m.start&&s<(m.firstSlot??0))&&(remaining(m)==null||remaining(m)>=(m.units||1))}

function medsFor(s,d){return data.meds.filter(m=>logFor(m.id,s,d)||eligible(m,s,d))}

function estimateLast(m, r, from=day(), skip=(s,d)=>logFor(m.id,s,d)) {
  if(r==null || !Number.isFinite(r) || !(m.units>0) || !m.slots.length) return '';
  let n=Math.floor((r+1e-9)/m.units);
  if(n<1)return '';
  let d=new Date((m.start && m.start>from?m.start:from)+'T00:00:00');
  for(let i=0;i<3660;i++,d.setDate(d.getDate()+1)){
    let date=day(d);
    if(m.end && date>m.end)return '超過設定療程期限';
    for(let s of [...m.slots].sort((a,b)=>a-b)){
      if((date===m.start && s<(m.firstSlot??0))||skip(s,date))continue;
      if(--n===0)return date+' '+labels[s];
    }
  }
  return '超出估算範圍';
}
function projection(m){return !m.active||m.resume?'':estimateLast(m,remaining(m));}
function quantityFromDays(days, slots, units){return Math.round(days*slots.length*units*1000)/1000;}
function refreshStockForm(){
  const byDays=$('quantityMode').value==='days';
  $('daysRow').hidden=!byDays;
  $('daysSupply').required=byDays;
  $('stock').readOnly=byDays;
  const slots=[...document.querySelectorAll('[name=slot]:checked')].map(x=>+x.value);
  const days=+$('daysSupply').value, units=+$('units').value;
  if(byDays){$('stock').value=Number.isInteger(days)&&days>0&&slots.length&&units>0?quantityFromDays(days,slots,units):'';}
  const stock=$('stock').value===''?null:+$('stock').value;
  const old=data.meds.find(x=>x.id===edit);
  const m={id:old?.id,slots,units,start:$('start').value,firstSlot:+$('firstSlot').value,end:$('end').value};
  const last=estimateLast(m,stock,old?day():m.start||day(),(s,d)=>!!old&&!!logFor(old.id,s,d));
  $('quantityPreview').textContent=stock==null?'':UI_TEXT.estimatedQuantity+'：'+qty(stock)+' '+($('unitName').value||'份')+(last?'；'+UI_TEXT.estimatedLast+'：'+last:'');
}
function stockInfo(m){let r=remaining(m);return r==null?'不追蹤藥量':`剩餘：${qtyText(r,m)} ／ 本輪總量：${qtyText(m.stock,m)}；${r<(m.units||1)?'不足一次用量，待確認':projection(m)?'預計最後一份：'+projection(m):'暫停估算'}`}

function stockActions(m){return `<p><button class=secondary onclick="refill(${m.id})">補充／開始新一輪</button> ${m.mode==='cycle'?`<button class=secondary onclick="pauseCycle(${m.id})">設定休藥／暫停</button>`:''}</p>${m.resume?`<p class=warn>預計確認日期：${esc(m.resume)}。${day()>=m.resume?'已到確認日，請依醫囑確認是否恢復。':''}</p><button class=secondary onclick="resumeMed(${m.id})">確認恢復剩餘藥量</button>`:''}`}

function refill(id){let m=data.meds.find(x=>x.id===id);if(!confirm('已依醫囑確認補充藥量或開始下一輪？'))return;let v=prompt('輸入新增藥量（'+unitLabel(m)+'）；會加上尚未用完的藥量','');if(v===null||!v.trim()||!Number.isFinite(+v)||+v<=0)return;let r=Math.max(0,remaining(m)||0);m.stock=r+(+v);m.stockGen=Date.now();m.active=true;m.resume='';save();render()}

function pauseCycle(id){let m=data.meds.find(x=>x.id===id);let d=new Date();d.setDate(d.getDate()+(m.restDays||7));let v=prompt('依醫囑輸入預計確認恢復日期（YYYY-MM-DD）；不會自動恢復',day(d));if(v===null||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<day()||!Number.isFinite(Date.parse(v)))return;m.resume=v;m.active=false;save();render()}

function resumeMed(id){let m=data.meds.find(x=>x.id===id);if(confirm('已向醫師或藥師確認恢復方式？保留剩餘藥量，不會自動補吃。')){m.resume='';m.active=true;save();render()}}

function logFor(id,s,d){return data.logs.find(l=>l.id===id&&l.slot===s&&l.day===d)}

function planned(s,d){if(s===0||s===3)return new Date(`${d}T${s===0?data.settings.morning:data.settings.night}:00`);let prev=medsFor(s-1,d);if(!prev.length){let base=planned(s-1,d);return base?new Date(base.getTime()+data.settings.interval*3600000):null;}let logs=prev.map(m=>logFor(m.id,s-1,d));if(logs.some(l=>!l))return null;return new Date(Math.max(...logs.map(l=>l.at))+data.settings.interval*3600000)}

function latest(id){return data.logs.filter(l=>l.id===id).sort((a,b)=>b.at-a.at)[0]}

function record(ids,s){let now=Date.now(),d=selectedDay;if(d!==day()&&!confirm('正在記錄非今日的用藥時段，實際時間仍為現在。確定？'))return;let pending=ids.filter(id=>!logFor(id,s,d)&&eligible(data.meds.find(m=>m.id===id),s,d));if(!pending.length)return;let warnings=pending.map(id=>{let m=data.meds.find(m=>m.id===id),l=latest(id);return l&&m.min>0&&now-l.at<m.min*3600000?m.name+'：距上次紀錄不足設定間隔':null}).filter(Boolean);if(warnings.length&&!confirm(warnings.join('\n')+'\n請確認醫囑。只有已實際服用才記錄，確定記錄？'))return;if(!confirm('確認已實際服用所選藥物？'))return;for(let id of pending){let m=data.meds.find(m=>m.id===id);data.logs.push({id,name:m.name,dose:m.dose,slot:s,day:d,at:now,units:m.units||1,stockGen:m.stockGen})}save();render()}

function markTaken(box,id,s){if(!box.checked)return;record([id],s);render()}

function undo(id,s){if(confirm('取消這筆服藥紀錄？這不代表沒有服藥，請先確認。')){data.logs=data.logs.filter(l=>!(l.id===id&&l.slot===s&&l.day===selectedDay));save();render()}}

function render(){ $('nav').innerHTML=[['today',UI_TEXT.today],['meds',UI_TEXT.medications],['history',UI_TEXT.history],['settings',UI_TEXT.settings]].map(([k,v])=>`<button class="${tab===k?'':'secondary'}" onclick="go('${k}')">${v}</button>`).join('');let h='';if(tab==='today'){h=`<label>用藥日期<input type=date value="${selectedDay}" onchange="selectedDay=this.value;render()"></label>`;for(let m of data.meds.filter(m=>m.resume||m.active&&remaining(m)!=null&&remaining(m)<(m.units||1)))h+=`<section><h2>${esc(m.name)}・待確認</h2><small>${stockInfo(m)}</small>${stockActions(m)}</section>`;if(!data.meds.length)h+='<section>尚未新增藥物。請先到「藥物管理」新增。</section>';labels.forEach((label,s)=>{let ms=medsFor(s,selectedDay),p=planned(s,selectedDay),all=ms.length&&ms.every(m=>logFor(m.id,s,selectedDay));h+=`<section><h2>${label} ${all?'・已完成':''}</h2><small>${p?'預定提醒：'+time(p):'等待上一時段完成；若無上一時段用藥，請依醫囑自行確認'}</small>${p&&day(p)!==selectedDay?'<p class=warn>提醒已跨日，請確認醫囑，不自動補吃。</p>':''}`;for(let m of ms){let l=logFor(m.id,s,selectedDay),last=latest(m.id);h+=`<div class="line${l?' taken':''}"><div class=row><span>${esc(m.name)} ${esc(m.dose)}</span><div class=action-group>${l?`<span class=status-pill>✓ ${esc(UI_TEXT.taken)}</span><button class=secondary onclick="undo(${m.id},${s})">${esc(UI_TEXT.undo)}</button>`:`<label class=check-action><input type=checkbox onchange="markTaken(this,${m.id},${s})"> ${esc(UI_TEXT.confirmTaken)}</label>`}</div></div><small>${l?'已記錄 '+time(l.at):last?'上次紀錄 '+time(last.at):'尚未記錄'}</small><div><small>${stockInfo(m)}</small></div>${!l&&last&&m.min>0&&Date.now()-last.at<m.min*3600000?`<div class=warn>設定間隔未滿，最早間隔時間 ${time(last.at+m.min*3600000)}（非服藥許可）</div>`:''}</div>`}h+=ms.length?`<p><button ${all?'disabled':''} onclick="record([${ms.map(m=>m.id)}],${s})">${esc(UI_TEXT.allTaken)}</button></p>`:`<p class=muted>${esc(UI_TEXT.noMeds)}</p>`;if(p&&!all&&ms.some(m=>eligible(m,s,selectedDay)&&!logFor(m.id,s,selectedDay)))h+=`<button class=secondary onclick="shortcut(${s},${p.getTime()})">${esc(UI_TEXT.reminderButton)}</button>`;h+='</section>'})}else if(tab==='meds'){if(edit===null){h=`<button onclick="edit=-1;render()">${esc(UI_TEXT.addMed)}</button>`;for(let m of data.meds)h+=`<section><h2>${esc(m.name)}</h2><p>${esc(m.dose)}・${m.slots.map(s=>labels[s]).join('、')}</p><small>${m.active?'啟用':'暫停'} ${esc(m.start||'')} ${m.end?'至 '+esc(m.end):''}</small><p><button class=secondary onclick="edit=${m.id};render()">${esc(UI_TEXT.edit)}</button> <button class=secondary onclick="toggle(${m.id})">${m.active?'暫停':'恢復'}</button></p><small>${stockInfo(m)}</small>${stockActions(m)}</section>`}else{let m=data.meds.find(m=>m.id===edit)||{name:'',dose:'',slots:[],start:day(),end:'',min:0};h=`<section><h2>${edit===-1?'新增':UI_TEXT.edit}藥物</h2><form onsubmit="submitMed(event)" oninput="refreshStockForm()" onchange="refreshStockForm()"><label>${esc(UI_TEXT.name)}<input id=name required value="${esc(m.name)}"></label><label>${esc(UI_TEXT.dose)}<input id=dose value="${esc(m.dose)}"></label>${labels.map((l,i)=>`<label><input type=checkbox name=slot value=${i} ${m.slots.includes(i)?'checked':''}> ${l}</label>`).join('')}<label>${esc(UI_TEXT.start)}<input type=date id=start value="${esc(m.start)}"></label><label>${esc(UI_TEXT.firstSlot)}<select id=firstSlot>${labels.map((l,i)=>`<option value=${i} ${(m.firstSlot??0)===i?'selected':''}>${l}</option>`).join('')}</select></label><label>${esc(UI_TEXT.mode)}<select id=mode>${[['long','長期用藥'],['finite','定量療程'],['cycle','週期用藥']].map(([v,l])=>`<option value=${v} ${(m.mode||'long')===v?'selected':''}>${l}</option>`).join('')}</select></label><label>${esc(UI_TEXT.quantityMode)}<select id=quantityMode><option value=direct>${esc(UI_TEXT.directQuantity)}</option><option value=days>${esc(UI_TEXT.daysQuantity)}</option></select></label><label id=daysRow hidden>${esc(UI_TEXT.daysSupply)}<input type=number min=1 max=3650 step=1 id=daysSupply placeholder="3"></label><label>${esc(UI_TEXT.stock)}<input type=number min=0 step=0.001 id=stock value="${remaining(m)??''}"></label><label>${esc(UI_TEXT.units)}<input type=number min=0.001 step=0.001 id=units required value="${m.units||1}"></label><label>${esc(UI_TEXT.unitName)}<input id=unitName value="${esc(unitLabel(m))}" placeholder="顆、包"></label><p id=quantityPreview class=muted aria-live="polite"></p><small>${esc(UI_TEXT.quantityHint)}</small><label>預設休藥天數（僅週期模式確認用）<input type=number min=0 max=365 id=restDays value="${m.restDays??7}"></label><small>修改剩餘量會重新建立庫存基準，保留舊紀錄。休藥與恢復須依醫囑確認。</small><label>${esc(UI_TEXT.end)}<input type=date id=end value="${esc(m.end)}"></label><label>${esc(UI_TEXT.min)}<input type=number id=min min=0 max=168 step=0.5 value="${m.min}"></label><button>${esc(UI_TEXT.save)}</button> <button type=button class=secondary onclick="edit=null;render()">${esc(UI_TEXT.cancel)}</button></form></section>`}}else if(tab==='history'){h=data.logs.slice().sort((a,b)=>b.at-a.at).map(l=>`<section><b>${esc(l.name)}</b> ${esc(l.dose)}<p>${esc(l.day)}・${labels[l.slot]}<br>實際紀錄：${time(l.at)}</p></section>`).join('')||'<section>尚無紀錄</section>'}else{h=`<section><h2>${esc(UI_TEXT.reminderSettings)}</h2><form onsubmit="settings(event)"><label>早餐提醒<input type=time id=morning required value="${data.settings.morning}"></label><label>睡前提醒<input type=time id=night required value="${data.settings.night}"></label><label>三餐提醒間隔（小時）<input type=number id=interval min=0.5 max=24 step=0.5 required value="${data.settings.interval}"></label><button>${esc(UI_TEXT.save)}</button></form></section><section><h2>${esc(UI_TEXT.backup)}</h2><button onclick="backup()">匯出 JSON</button><label>匯入備份<input type=file accept=".json,application/json" onchange="restore(this)"></label><small>匯入會取代目前資料。請定期備份至檔案或 Google Drive；瀏覽器清除資料可能造成紀錄遺失。</small></section>`} $('view').innerHTML=h+(tab==='settings'?cloud.ui():'');if(tab==='meds'&&edit!==null)refreshStockForm();}

function submitMed(e){e.preventDefault();let slots=[...document.querySelectorAll('[name=slot]:checked')].map(x=>+x.value);if(!slots.length)return alert('請選擇時段');if($('quantityMode').value==='days'){refreshStockForm();if(!$('stock').value)return alert('請確認天數、時段及每次消耗量');}if($('end').value&&$('start').value>$('end').value)return alert('日期順序錯誤');let old=data.meds.find(m=>m.id===edit),m={id:old?.id||Date.now(),name:$('name').value.trim(),dose:$('dose').value,slots,start:$('start').value,end:$('end').value,min:+$('min').value,active:old?.active??true,firstSlot:+$('firstSlot').value,mode:$('mode').value,stock:$('stock').value===''?null:+$('stock').value,units:+$('units').value,unitName:(() => {let u=$('unitName').value.trim();return !u||/^\d+(?:\.\d+)?$/.test(u)?'份':u})(),restDays:+$('restDays').value,resume:old?.resume||'',stockGen:Date.now()};if(m.mode!=='long'&&m.stock==null)return alert('請輸入剩餘藥量');if(old&&m.stock===remaining(old)){m.stock=old.stock??null;m.stockGen=old.stockGen}if(!m.name)return;if(old)data.meds=data.meds.map(x=>x.id===edit?m:x);else data.meds.push(m);save();edit=null;render()}

function toggle(id){let m=data.meds.find(x=>x.id===id);if(confirm((m.active?'暫停':'恢復')+'顯示此用藥？請依醫囑。')){if(m.resume&&!m.active)return resumeMed(id);m.active=!m.active;save();render()}}

function settings(e){e.preventDefault();data.settings={morning:$('morning').value,night:$('night').value,interval:+$('interval').value};save();render()}

function backup(){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='medication-'+day()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

async function restore(el){try{let x=JSON.parse(await el.files[0].text());if(!Array.isArray(x.meds)||!Array.isArray(x.logs)||!x.settings||!x.meds.every(m=>Number.isFinite(m.id)&&typeof m.name==='string'&&Array.isArray(m.slots)&&m.slots.every(s=>Number.isInteger(s)&&s>=0&&s<4))||!x.logs.every(l=>Number.isFinite(l.at)&&Number.isFinite(l.id))||!/^\d\d:\d\d$/.test(x.settings.morning)||!/^\d\d:\d\d$/.test(x.settings.night)||!(x.settings.interval>0))throw Error();if(confirm('取代目前所有資料？')){data=x;save();render()}}catch(e){alert('備份格式無效')}}$('app-title').textContent=UI_TEXT.appTitle;document.title=UI_TEXT.appTitle;render();if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
