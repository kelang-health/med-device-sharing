/* Phase 6 — Equipment Lifecycle / PM / Barcode Label UI */
const PHASE6_API_URL = 'https://txjuiaiwffsxfcrxpkvd.supabase.co/functions/v1/med-device-api-v60';
const P6_TOKEN_KEY = 'medDevice.adminToken';
let phase6Items = [];

async function p6Run(action, payload = {}) {
  const token = localStorage.getItem(P6_TOKEN_KEY) || '';
  if (token) payload.token = token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const r = await fetch(PHASE6_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { return { success:false, error:'Phase 6 backend ตอบกลับไม่ใช่ JSON' }; }
    if (data?.needLogin && typeof Swal !== 'undefined') {
      Swal.fire('เซสชันหมดอายุ','กรุณาเข้าสู่ระบบใหม่','warning');
    }
    return data;
  } catch (e) {
    return { success:false, error:e?.name === 'AbortError' ? 'การเชื่อมต่อ Phase 6 ใช้เวลานานเกินไป' : String(e?.message || e) };
  } finally { clearTimeout(timer); }
}

function p6Date(v) {
  if (!v) return '-';
  const d = new Date(String(v).length <= 10 ? v + 'T12:00:00' : v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function p6DateTime(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('th-TH', { dateStyle:'short', timeStyle:'short' });
}
function p6Esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function p6StateLabel(s) {
  return ({OVERDUE:'เกินกำหนด PM',DUE_SOON:'ใกล้ครบกำหนด',DUE_USAGE:'ครบตามจำนวนครั้งใช้งาน',OK:'ปกติ',NO_PLAN:'ยังไม่มีแผน PM'})[s] || s || '-';
}
function p6StateClass(s) {
  return ({OVERDUE:'p6-badge p6-red',DUE_SOON:'p6-badge p6-orange',DUE_USAGE:'p6-badge p6-amber',OK:'p6-badge p6-green',NO_PLAN:'p6-badge p6-gray'})[s] || 'p6-badge p6-gray';
}

async function openLifecycleTab() {
  if (typeof switchTab === 'function') switchTab('lifecycle');
  await loadPhase6Lifecycle(true);
}

async function loadPhase6Lifecycle(force=false) {
  const host = document.getElementById('phase6-equipment-list');
  if (!host) return;
  if (phase6Items.length && !force) { renderPhase6Lifecycle(); return; }
  host.innerHTML = '<div class="p6-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังประมวลประวัติและรอบบำรุงรักษา...</div>';
  const r = await p6Run('getEquipmentLifecycleDashboard');
  if (!r?.success) { host.innerHTML = `<div class="p6-error">${p6Esc(r?.error || 'โหลดข้อมูลไม่สำเร็จ')}</div>`; return; }
  phase6Items = r.items || [];
  const s = r.summary || {};
  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=String(val ?? 0); };
  set('p6-kpi-total',s.total); set('p6-kpi-overdue',s.overdue); set('p6-kpi-soon',s.dueSoon); set('p6-kpi-usage',s.dueUsage); set('p6-kpi-noplan',s.noPlan);
  renderPhase6Lifecycle();
}

function renderPhase6Lifecycle() {
  const host=document.getElementById('phase6-equipment-list'); if(!host)return;
  const q=(document.getElementById('p6-search')?.value||'').trim().toLowerCase();
  const f=document.getElementById('p6-state-filter')?.value||'all';
  const rows=phase6Items.filter(x=>{
    const hit=!q || [x.equipmentCode,x.equipmentName,x.serialNumber].some(v=>String(v||'').toLowerCase().includes(q));
    return hit && (f==='all'||x.maintenanceState===f);
  });
  if(!rows.length){ host.innerHTML='<div class="p6-empty">ไม่พบอุปกรณ์ตามเงื่อนไข</div>'; return; }
  host.innerHTML = `<div class="p6-table-wrap"><table class="p6-table"><thead><tr><th>อุปกรณ์</th><th>สถานะคลัง</th><th>การใช้งาน</th><th>PM ล่าสุด / ถัดไป</th><th>สถานะ PM</th><th>ดำเนินการ</th></tr></thead><tbody>${rows.map(x=>`<tr>
    <td><div class="p6-eq-name">${p6Esc(x.equipmentName)}</div><div class="p6-muted">${p6Esc(x.equipmentCode)}${x.serialNumber?` · ${p6Esc(x.serialNumber)}`:''}</div></td>
    <td>${p6Esc(x.status||'-')}</td>
    <td>${Number(x.borrowCount||0)} ครั้ง</td>
    <td><div>${x.lastMaintenanceDate?p6Date(x.lastMaintenanceDate):'ยังไม่มี'}</div><div class="p6-muted">ถัดไป ${x.nextMaintenanceDate?p6Date(x.nextMaintenanceDate):'-'}</div></td>
    <td><span class="${p6StateClass(x.maintenanceState)}">${p6Esc(p6StateLabel(x.maintenanceState))}</span></td>
    <td><div class="p6-actions"><button onclick="openEquipmentHistory('${p6Esc(x.equipmentCode)}')"><i class="fa-solid fa-clock-rotate-left"></i> ประวัติ</button><button onclick="openMaintenanceForm('${p6Esc(x.equipmentCode)}')"><i class="fa-solid fa-screwdriver-wrench"></i> บำรุง</button><button onclick="openEquipmentLabel('${p6Esc(x.equipmentCode)}')"><i class="fa-solid fa-barcode"></i> สติ๊กเกอร์</button></div></td>
  </tr>`).join('')}</tbody></table></div>`;
}

async function openEquipmentHistory(code) {
  const r=await p6Run('getEquipmentProfile',{equipmentCode:code});
  if(!r?.success){ Swal.fire('ไม่สำเร็จ',r?.error||'โหลดประวัติไม่สำเร็จ','error'); return; }
  const p=r.data, eq=p.equipment, due=(p.maintenanceDue||[]);
  const history=(p.history||[]).map(h=>`<div class="p6-timeline-item"><div class="p6-dot"></div><div><div class="p6-timeline-title">${p6Esc(h.title||h.event_type)}</div><div class="p6-muted">${p6DateTime(h.event_at)} · ${p6Esc(h.detail||'')}</div></div></div>`).join('') || '<div class="p6-empty">ยังไม่มีประวัติ</div>';
  const dueHtml=due.map(d=>`<div class="p6-due-row"><div><b>${p6Esc(d.planName)}</b><div class="p6-muted">ทุก ${d.intervalMonths} เดือน${d.intervalBorrowCount?` หรือ ${d.intervalBorrowCount} ครั้ง`:''}</div></div><div><span class="${p6StateClass(d.state)}">${p6Esc(p6StateLabel(d.state))}</span><div class="p6-muted">${p6Date(d.nextDueDate)}</div></div></div>`).join('') || '<div class="p6-empty">ยังไม่ได้กำหนดแผน PM</div>';
  Swal.fire({
    width:900,
    title:`${p6Esc(eq.equipmentName)} · ${p6Esc(eq.equipmentCode)}`,
    html:`<div class="p6-profile"><div class="p6-profile-grid"><div><span>Serial</span><b>${p6Esc(eq.serialNumber||'-')}</b></div><div><span>สถานะ</span><b>${p6Esc(eq.status)}</b></div><div><span>ยืมสะสม</span><b>${Number(p.borrowCount||0)} ครั้ง</b></div><div><span>PM ถัดไป</span><b>${p6Date(p.nextMaintenanceDate)}</b></div></div><h4>รอบบำรุงรักษา</h4>${dueHtml}<h4>Timeline ประวัติเครื่อง</h4><div class="p6-timeline">${history}</div></div>`,
    showCancelButton:true, confirmButtonText:'บันทึกบำรุงรักษา', cancelButtonText:'ปิด'
  }).then(x=>{ if(x.isConfirmed) openMaintenanceForm(code); });
}

async function openMaintenanceForm(code) {
  const r=await p6Run('getEquipmentProfile',{equipmentCode:code});
  if(!r?.success){ Swal.fire('ไม่สำเร็จ',r?.error||'โหลดข้อมูลไม่สำเร็จ','error'); return; }
  const p=r.data, plans=p.maintenancePlans||[];
  const opts=plans.map(x=>`<option value="${x.id}">${p6Esc(x.plan_name)} · ${x.interval_months} เดือน</option>`).join('');
  const today=new Date().toISOString().slice(0,10);
  const html=`<div class="p6-form"><label>แผนบำรุงรักษา<select id="p6m-plan"><option value="">งานบำรุงทั่วไป</option>${opts}</select></label><label>วันที่ดำเนินการ<input id="p6m-date" type="date" value="${today}"></label><label>ผลการตรวจ<select id="p6m-result"><option value="PASS">ผ่าน / พร้อมใช้งาน</option><option value="FOLLOW_UP">ติดตามเพิ่มเติม</option><option value="REPAIR">ส่งซ่อม</option><option value="OUT_OF_SERVICE">งดใช้งาน</option></select></label><label>ผู้ดำเนินการ / ผู้ให้บริการ<input id="p6m-provider" placeholder="เช่น ช่าง รพ. / บริษัท"></label><label>ชั่วโมงมิเตอร์ (ถ้ามี)<input id="p6m-hours" type="number" min="0" step="0.1"></label><label>ค่าใช้จ่าย (บาท)<input id="p6m-cost" type="number" min="0" step="0.01"></label><label class="p6-span2">หมายเหตุ<textarea id="p6m-note" rows="3" placeholder="สภาพเครื่อง, สิ่งที่เปลี่ยน/ซ่อม, ข้อเสนอแนะ"></textarea></label></div>`;
  const ans=await Swal.fire({title:`บำรุงรักษา ${p6Esc(p.equipment.equipmentName)} (${p6Esc(code)})`,html,width:760,showCancelButton:true,confirmButtonText:'บันทึก PM',cancelButtonText:'ยกเลิก',preConfirm:()=>({planId:document.getElementById('p6m-plan').value||null,performedAt:document.getElementById('p6m-date').value,result:document.getElementById('p6m-result').value,provider:document.getElementById('p6m-provider').value,meterHours:document.getElementById('p6m-hours').value,cost:document.getElementById('p6m-cost').value,note:document.getElementById('p6m-note').value})});
  if(!ans.isConfirmed)return;
  const save=await p6Run('recordEquipmentMaintenance',{equipmentCode:code,...ans.value});
  if(!save?.success){Swal.fire('บันทึกไม่สำเร็จ',save?.error||'เกิดข้อผิดพลาด','error');return;}
  Swal.fire('บันทึกแล้ว',`PM ถัดไป: ${p6Date(save.nextDueDate)}`,'success');
  phase6Items=[]; loadPhase6Lifecycle(true);
}

async function openMaintenancePlanManager() {
  const r=await p6Run('getMaintenancePlans'); if(!r?.success){Swal.fire('ไม่สำเร็จ',r?.error||'โหลดแผนไม่สำเร็จ','error');return;}
  const plans=r.data||[];
  const list=plans.map(p=>`<div class="p6-plan-row"><div><b>${p6Esc(p.plan_name)}</b><div class="p6-muted">${p6Esc(p.equipment_name||'ใช้ได้ทุกประเภท')} · ทุก ${p.interval_months} เดือน${p.interval_borrow_count?` / ${p.interval_borrow_count} ครั้ง`:''}</div></div></div>`).join('')||'<div class="p6-empty">ยังไม่มีแผน</div>';
  const ans=await Swal.fire({title:'แผนบำรุงรักษา',html:`<div>${list}</div><hr class="my-3"><div class="p6-form"><label>รหัสแผน<input id="p6p-code" placeholder="OXYGEN_PM_6M"></label><label>ชื่อแผน<input id="p6p-name" placeholder="PM เครื่องผลิตออกซิเจน 6 เดือน"></label><label>ประเภทอุปกรณ์<input id="p6p-eq" placeholder="เครื่องผลิตออกซิเจน"></label><label>รอบ (เดือน)<input id="p6p-month" type="number" min="1" max="120" value="6"></label><label>รอบตามจำนวนยืม<input id="p6p-count" type="number" min="1" placeholder="เช่น 10"></label><label class="p6-span2">Checklist<textarea id="p6p-check" rows="4" placeholder="หนึ่งรายการต่อหนึ่งบรรทัด"></textarea></label></div>`,width:760,showCancelButton:true,confirmButtonText:'เพิ่มแผน',cancelButtonText:'ปิด',preConfirm:()=>({planCode:document.getElementById('p6p-code').value,planName:document.getElementById('p6p-name').value,equipmentName:document.getElementById('p6p-eq').value,intervalMonths:Number(document.getElementById('p6p-month').value||6),intervalBorrowCount:document.getElementById('p6p-count').value||null,checklist:document.getElementById('p6p-check').value.split(/\n+/).map(x=>x.trim()).filter(Boolean)})});
  if(!ans.isConfirmed)return;
  const save=await p6Run('saveMaintenancePlan',ans.value); if(!save?.success){Swal.fire('บันทึกไม่สำเร็จ',save?.error||'เกิดข้อผิดพลาด','error');return;} Swal.fire('สำเร็จ','เพิ่มแผน PM แล้ว','success'); phase6Items=[];loadPhase6Lifecycle(true);
}

function openEquipmentLabel(code){ window.open(`equipment-label.html?code=${encodeURIComponent(code)}`,'_blank','noopener'); }

async function showPublicEquipmentProfile(code){
  let r;
  const token=localStorage.getItem(P6_TOKEN_KEY)||'';
  if(token) r=await p6Run('getEquipmentProfile',{equipmentCode:code});
  if(!r?.success) r=await p6Run('getPublicEquipmentProfile',{equipmentCode:code});
  if(!r?.success){ Swal.fire('ไม่พบอุปกรณ์',r?.error||'QR/Barcode นี้ไม่อยู่ในระบบ','error'); return; }
  const p=r.data, eq=p.equipment || p;
  const full=!!p.history;
  const history=full?(p.history||[]).slice(0,30).map(h=>`<div class="p6-timeline-item"><div class="p6-dot"></div><div><div class="p6-timeline-title">${p6Esc(h.title||h.event_type)}</div><div class="p6-muted">${p6DateTime(h.event_at)} · ${p6Esc(h.detail||'')}</div></div></div>`).join(''):'';
  Swal.fire({width:820,title:`${p6Esc(eq.equipmentName)} · ${p6Esc(eq.equipmentCode)}`,html:`<div class="p6-public-card"><div class="p6-profile-grid"><div><span>Serial</span><b>${p6Esc(eq.serialNumber||'-')}</b></div><div><span>สถานะ</span><b>${p6Esc(eq.status||'-')}</b></div><div><span>PM ล่าสุด</span><b>${p6Date(p.lastMaintenanceDate)}</b></div><div><span>PM ถัดไป</span><b>${p6Date(p.nextMaintenanceDate)}</b></div></div><div class="mt-3"><span class="${p6StateClass(p.maintenanceState)}">${p6Esc(p6StateLabel(p.maintenanceState))}</span></div>${full?`<h4>ประวัติเครื่อง</h4><div class="p6-timeline">${history}</div>`:'<div class="p6-info">เข้าสู่ระบบเจ้าหน้าที่เพื่อดู Timeline การใช้งานและบำรุงรักษาฉบับเต็ม โดยไม่เปิดเผยข้อมูลผู้ยืมต่อสาธารณะ</div>'}</div>`,confirmButtonText:'ปิด'});
}

function p6InitFromUrl(){const code=new URLSearchParams(location.search).get('equipment');if(code)setTimeout(()=>showPublicEquipmentProfile(code),400);}
document.addEventListener('DOMContentLoaded',p6InitFromUrl);
