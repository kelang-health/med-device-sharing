/* Phase 6.0.2 — PM baseline, checklist, meter history, plan editing */
(function(){
  if (typeof p6InitFromUrl === 'function') {
    document.removeEventListener('DOMContentLoaded', p6InitFromUrl);
  }

  const STATE_RANK={BASELINE_REQUIRED:6,OVERDUE:5,DUE_USAGE:4,DUE_SOON:3,OK:2,NO_PLAN:1};
  let phase6PlanCache=[];

  window.p6StateLabel=function(s){
    return ({BASELINE_REQUIRED:'ต้องบันทึก PM เริ่มต้น',OVERDUE:'เกินกำหนด PM',DUE_SOON:'ใกล้ครบกำหนด',DUE_USAGE:'ครบตามจำนวนครั้งใช้งาน',OK:'ปกติ',NO_PLAN:'ยังไม่มีแผน PM'})[s]||s||'-';
  };
  window.p6StateClass=function(s){
    return ({BASELINE_REQUIRED:'p6-badge p6-indigo',OVERDUE:'p6-badge p6-red',DUE_SOON:'p6-badge p6-orange',DUE_USAGE:'p6-badge p6-amber',OK:'p6-badge p6-green',NO_PLAN:'p6-badge p6-gray'})[s]||'p6-badge p6-gray';
  };

  window.loadPhase6Lifecycle=async function(force=false){
    const host=document.getElementById('phase6-equipment-list');
    if(!host)return;
    if(phase6Items.length&&!force){renderPhase6Lifecycle();return;}
    host.innerHTML='<div class="p6-loading"><i class="fa-solid fa-spinner fa-spin"></i> กำลังประมวลประวัติและรอบบำรุงรักษา...</div>';
    const r=await p6Run('getEquipmentLifecycleDashboard');
    if(!r?.success){host.innerHTML=`<div class="p6-error">${p6Esc(r?.error||'โหลดข้อมูลไม่สำเร็จ')}</div>`;return;}
    phase6Items=r.items||[];
    const s=r.summary||{};
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=String(val??0);};
    set('p6-kpi-total',s.total);
    set('p6-kpi-baseline',s.baselineRequired);
    set('p6-kpi-overdue',s.overdue);
    set('p6-kpi-soon',s.dueSoon);
    set('p6-kpi-usage',s.dueUsage);
    set('p6-kpi-noplan',s.noPlan);
    renderPhase6Lifecycle();
  };

  window.renderPhase6Lifecycle=function(){
    const host=document.getElementById('phase6-equipment-list');if(!host)return;
    const q=(document.getElementById('p6-search')?.value||'').trim().toLowerCase();
    const f=document.getElementById('p6-state-filter')?.value||'all';
    const rows=phase6Items.filter(x=>{
      const hit=!q||[x.equipmentCode,x.equipmentName,x.serialNumber].some(v=>String(v||'').toLowerCase().includes(q));
      return hit&&(f==='all'||x.maintenanceState===f);
    }).sort((a,b)=>(STATE_RANK[b.maintenanceState]||0)-(STATE_RANK[a.maintenanceState]||0)||String(a.nextMaintenanceDate||'9999-12-31').localeCompare(String(b.nextMaintenanceDate||'9999-12-31'))||String(a.equipmentCode||'').localeCompare(String(b.equipmentCode||'')));
    if(!rows.length){host.innerHTML='<div class="p6-empty">ไม่พบอุปกรณ์ตามเงื่อนไข</div>';return;}
    host.innerHTML=`<div class="p6-table-wrap"><table class="p6-table"><thead><tr><th>อุปกรณ์</th><th>สถานะคลัง</th><th>การใช้งาน</th><th>PM ล่าสุด / ถัดไป</th><th>สถานะ PM</th><th>ดำเนินการ</th></tr></thead><tbody>${rows.map(x=>`<tr>
      <td><div class="p6-eq-name">${p6Esc(x.equipmentName)}</div><div class="p6-muted">${p6Esc(x.equipmentCode)}${x.serialNumber?` · ${p6Esc(x.serialNumber)}`:''}</div></td>
      <td>${p6Esc(x.status||'-')}</td>
      <td>${Number(x.borrowCount||0)} ครั้ง</td>
      <td><div>${x.lastMaintenanceDate?p6Date(x.lastMaintenanceDate):'ยังไม่มี'}</div><div class="p6-muted">ถัดไป ${x.nextMaintenanceDate?p6Date(x.nextMaintenanceDate):'-'}</div></td>
      <td><span class="${p6StateClass(x.maintenanceState)}">${p6Esc(p6StateLabel(x.maintenanceState))}</span></td>
      <td><div class="p6-actions"><button onclick="openEquipmentHistory('${p6Esc(x.equipmentCode)}')"><i class="fa-solid fa-clock-rotate-left"></i> ประวัติ</button><button onclick="openMaintenanceForm('${p6Esc(x.equipmentCode)}')"><i class="fa-solid fa-screwdriver-wrench"></i> บำรุง</button><button onclick="openEquipmentLabel('${p6Esc(x.equipmentCode)}')"><i class="fa-solid fa-barcode"></i> สติ๊กเกอร์</button></div></td>
    </tr>`).join('')}</tbody></table></div>`;
  };

  window.openEquipmentHistory=async function(code){
    const r=await p6Run('getEquipmentProfile',{equipmentCode:code});
    if(!r?.success){Swal.fire('ไม่สำเร็จ',r?.error||'โหลดประวัติไม่สำเร็จ','error');return;}
    const p=r.data,eq=p.equipment,due=p.maintenanceDue||[],maint=p.maintenance||[],meters=p.meterReadings||[];
    const history=(p.history||[]).map(h=>`<div class="p6-timeline-item"><div class="p6-dot"></div><div><div class="p6-timeline-title">${p6Esc(h.title||h.event_type)}</div><div class="p6-muted">${p6DateTime(h.event_at)} · ${p6Esc(h.detail||'')}</div></div></div>`).join('')||'<div class="p6-empty">ยังไม่มีประวัติ</div>';
    const dueHtml=due.map(d=>`<div class="p6-due-row"><div><b>${p6Esc(d.planName)}</b><div class="p6-muted">ทุก ${d.intervalMonths} เดือน${d.intervalBorrowCount?` หรือ ${d.intervalBorrowCount} ครั้ง`:''}${d.borrowCountSinceService!=null?` · ใช้หลัง PM ${d.borrowCountSinceService} ครั้ง`:''}</div></div><div><span class="${p6StateClass(d.state)}">${p6Esc(p6StateLabel(d.state))}</span><div class="p6-muted">${p6Date(d.nextDueDate)}</div></div></div>`).join('')||'<div class="p6-empty">ยังไม่ได้กำหนดแผน PM</div>';
    const maintHtml=maint.length?`<div class="p6-mini-table"><table><thead><tr><th>วันที่</th><th>ประเภท</th><th>ผล</th><th>PM ถัดไป</th><th>ชั่วโมง</th></tr></thead><tbody>${maint.slice(0,20).map(m=>`<tr><td>${p6Date(m.performed_at)}</td><td>${p6Esc(m.maintenance_type||'-')}</td><td>${p6Esc(m.result||'-')}</td><td>${p6Date(m.next_due_date)}</td><td>${m.meter_hours==null?'-':p6Esc(m.meter_hours)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="p6-empty">ยังไม่มีประวัติบำรุงรักษา</div>';
    const latestMeter=meters[0];
    const meterLabel=latestMeter?`${p6Esc(latestMeter.reading_value)} ${p6Esc(latestMeter.meter_type||'')}`:'ยังไม่มี';
    const safeCode=p6Esc(code);
    Swal.fire({
      width:980,
      title:`${p6Esc(eq.equipmentName)} · ${p6Esc(eq.equipmentCode)}`,
      html:`<div class="p6-profile"><div class="p6-profile-grid"><div><span>Serial / เลขพัสดุ</span><b>${p6Esc(eq.serialNumber||'-')}</b></div><div><span>สถานะ</span><b>${p6Esc(eq.status)}</b></div><div><span>ยืมสะสม</span><b>${Number(p.borrowCount||0)} ครั้ง</b></div><div><span>PM ถัดไป</span><b>${p6Date(p.nextMaintenanceDate)}</b></div><div><span>ค่ามิเตอร์ล่าสุด</span><b>${meterLabel}</b></div><div><span>สถานะ PM</span><b>${p6Esc(p6StateLabel(p.maintenanceState))}</b></div></div><div class="p6-inline-actions"><button onclick="Swal.close();openMeterReadingForm('${safeCode}')"><i class="fa-solid fa-gauge"></i> บันทึกมิเตอร์</button><button onclick="Swal.close();openEquipmentLabel('${safeCode}')"><i class="fa-solid fa-barcode"></i> พิมพ์สติ๊กเกอร์</button></div><h4>รอบบำรุงรักษา</h4>${dueHtml}<h4>ประวัติบำรุงรักษา</h4>${maintHtml}<h4>Timeline ประวัติเครื่อง</h4><div class="p6-timeline">${history}</div></div>`,
      showCancelButton:true,confirmButtonText:'บันทึกบำรุงรักษา',cancelButtonText:'ปิด'
    }).then(x=>{if(x.isConfirmed)openMaintenanceForm(code);});
  };

  function planChecklistHtml(plans,planId){
    const p=plans.find(x=>String(x.id)===String(planId));
    const items=Array.isArray(p?.checklist)?p.checklist:[];
    if(!items.length)return '<div class="p6-muted">แผนนี้ไม่มี Checklist</div>';
    return `<div class="p6-checklist">${items.map((item,i)=>`<label><input type="checkbox" data-p6-check="${i}" data-label="${p6Esc(item)}"> <span>${p6Esc(item)}</span></label>`).join('')}</div>`;
  }

  window.openMaintenanceForm=async function(code){
    const r=await p6Run('getEquipmentProfile',{equipmentCode:code});
    if(!r?.success){Swal.fire('ไม่สำเร็จ',r?.error||'โหลดข้อมูลไม่สำเร็จ','error');return;}
    const p=r.data,plans=p.maintenancePlans||[];
    const opts=plans.map(x=>`<option value="${x.id}">${p6Esc(x.plan_name)} · ${x.interval_months} เดือน${x.interval_borrow_count?` / ${x.interval_borrow_count} ครั้ง`:''}</option>`).join('');
    const today=new Date().toISOString().slice(0,10);
    const html=`<div class="p6-form"><label>แผนบำรุงรักษา<select id="p6m-plan"><option value="">งานบำรุงทั่วไป</option>${opts}</select></label><label>วันที่ดำเนินการ<input id="p6m-date" type="date" value="${today}"></label><label>ผลการตรวจ<select id="p6m-result"><option value="PASS">ผ่าน / พร้อมใช้งาน</option><option value="FOLLOW_UP">ติดตามเพิ่มเติม</option><option value="REPAIR">ส่งซ่อม</option><option value="OUT_OF_SERVICE">งดใช้งาน</option></select></label><label>ผู้ดำเนินการ / ผู้ให้บริการ<input id="p6m-provider" placeholder="เช่น ช่าง รพ. / บริษัท"></label><label>ชั่วโมงมิเตอร์ (ถ้ามี)<input id="p6m-hours" type="number" min="0" step="0.1"></label><label>ค่าใช้จ่าย (บาท)<input id="p6m-cost" type="number" min="0" step="0.01"></label><label class="p6-span2">Checklist<div id="p6m-checklist" class="p6-checklist-wrap"><div class="p6-muted">เลือกแผน PM เพื่อแสดง Checklist</div></div></label><label class="p6-span2">หมายเหตุ<textarea id="p6m-note" rows="3" placeholder="สภาพเครื่อง, สิ่งที่เปลี่ยน/ซ่อม, ข้อเสนอแนะ"></textarea></label></div>`;
    const ans=await Swal.fire({
      title:`บำรุงรักษา ${p6Esc(p.equipment.equipmentName)} (${p6Esc(code)})`,html,width:800,showCancelButton:true,confirmButtonText:'บันทึก PM',cancelButtonText:'ยกเลิก',
      didOpen:()=>{
        const select=document.getElementById('p6m-plan');
        const render=()=>{document.getElementById('p6m-checklist').innerHTML=planChecklistHtml(plans,select.value);};
        select.addEventListener('change',render);render();
      },
      preConfirm:()=>{
        const planId=document.getElementById('p6m-plan').value||null;
        const result=document.getElementById('p6m-result').value;
        const checklistResult={};
        document.querySelectorAll('#p6m-checklist [data-p6-check]').forEach(el=>{checklistResult[el.dataset.label]=!!el.checked;});
        if(result==='PASS'&&Object.keys(checklistResult).length&&Object.values(checklistResult).some(v=>!v)){
          Swal.showValidationMessage('ผล “ผ่าน / พร้อมใช้งาน” ต้องตรวจ Checklist ให้ครบทุกข้อ');return false;
        }
        return {planId,performedAt:document.getElementById('p6m-date').value,result,provider:document.getElementById('p6m-provider').value,meterHours:document.getElementById('p6m-hours').value,cost:document.getElementById('p6m-cost').value,note:document.getElementById('p6m-note').value,checklistResult};
      }
    });
    if(!ans.isConfirmed)return;
    const save=await p6Run('recordEquipmentMaintenance',{equipmentCode:code,...ans.value});
    if(!save?.success){Swal.fire('บันทึกไม่สำเร็จ',save?.error||'เกิดข้อผิดพลาด','error');return;}
    await Swal.fire('บันทึกแล้ว',`PM ถัดไป: ${p6Date(save.nextDueDate)}`,'success');
    phase6Items=[];loadPhase6Lifecycle(true);
  };

  window.openMeterReadingForm=async function(code){
    const ans=await Swal.fire({title:`บันทึกค่ามิเตอร์ ${p6Esc(code)}`,html:`<div class="p6-form"><label>ประเภทมิเตอร์<select id="p6r-type"><option value="HOURS">ชั่วโมงใช้งาน</option><option value="CYCLE">จำนวนรอบ</option><option value="OTHER">อื่น ๆ</option></select></label><label>ค่าที่อ่านได้<input id="p6r-value" type="number" min="0" step="0.1" inputmode="decimal"></label><label class="p6-span2">หมายเหตุ<input id="p6r-note" placeholder="เช่น หลังคืนเครื่อง / ก่อนทำ PM"></label></div>`,showCancelButton:true,confirmButtonText:'บันทึก',cancelButtonText:'ยกเลิก',preConfirm:()=>{const value=Number(document.getElementById('p6r-value').value);if(!Number.isFinite(value)||value<0){Swal.showValidationMessage('กรุณาระบุค่ามิเตอร์ที่ถูกต้อง');return false;}return {meterType:document.getElementById('p6r-type').value,readingValue:value,note:document.getElementById('p6r-note').value};}});
    if(!ans.isConfirmed)return;
    const r=await p6Run('addEquipmentMeterReading',{equipmentCode:code,...ans.value});
    if(!r?.success){Swal.fire('บันทึกไม่สำเร็จ',r?.error||'เกิดข้อผิดพลาด','error');return;}
    Swal.fire('บันทึกแล้ว','ค่ามิเตอร์ถูกเพิ่มในประวัติเครื่องแล้ว','success');
  };

  async function refreshPlanCache(){const r=await p6Run('getMaintenancePlans');if(!r?.success)throw new Error(r?.error||'โหลดแผนไม่สำเร็จ');phase6PlanCache=r.data||[];return phase6PlanCache;}

  window.openMaintenancePlanManager=async function(){
    try{await refreshPlanCache();}catch(e){Swal.fire('ไม่สำเร็จ',String(e.message||e),'error');return;}
    const list=phase6PlanCache.map(p=>`<div class="p6-plan-row"><div><b>${p6Esc(p.plan_name)}</b><div class="p6-muted">${p6Esc(p.plan_code)} · ${p6Esc(p.equipment_name||'ใช้ได้ทุกประเภท')} · ทุก ${p.interval_months} เดือน${p.interval_borrow_count?` / ${p.interval_borrow_count} ครั้ง`:''} · ${p.active?'เปิดใช้':'ปิดใช้'}</div></div><button class="p6-edit-plan" onclick="Swal.close();setTimeout(()=>editMaintenancePlan(${Number(p.id)}),80)">แก้ไข</button></div>`).join('')||'<div class="p6-empty">ยังไม่มีแผน</div>';
    const ans=await Swal.fire({title:'แผนบำรุงรักษา',html:`<div class="p6-plan-list">${list}</div>`,width:820,showCancelButton:true,confirmButtonText:'เพิ่มแผนใหม่',cancelButtonText:'ปิด'});
    if(ans.isConfirmed)editMaintenancePlan(0);
  };

  window.editMaintenancePlan=async function(id=0){
    if(!phase6PlanCache.length){try{await refreshPlanCache();}catch(e){Swal.fire('ไม่สำเร็จ',String(e.message||e),'error');return;}}
    const p=phase6PlanCache.find(x=>Number(x.id)===Number(id))||{};
    const check=Array.isArray(p.checklist)?p.checklist.join('\n'):'';
    const ans=await Swal.fire({title:id?'แก้ไขแผน PM':'เพิ่มแผน PM',html:`<div class="p6-form"><label>รหัสแผน<input id="p6p-code" value="${p6Esc(p.plan_code||'')}" placeholder="OXYGEN_PM_6M"></label><label>ชื่อแผน<input id="p6p-name" value="${p6Esc(p.plan_name||'')}" placeholder="PM เครื่องผลิตออกซิเจน 6 เดือน"></label><label>ประเภทอุปกรณ์<input id="p6p-eq" value="${p6Esc(p.equipment_name||'')}" placeholder="เครื่องผลิตออกซิเจน"></label><label>รอบ (เดือน)<input id="p6p-month" type="number" min="1" max="120" value="${Number(p.interval_months||6)}"></label><label>รอบตามจำนวนยืม<input id="p6p-count" type="number" min="1" value="${p.interval_borrow_count||''}" placeholder="เช่น 10"></label><label>สถานะ<select id="p6p-active"><option value="true" ${p.active!==false?'selected':''}>เปิดใช้</option><option value="false" ${p.active===false?'selected':''}>ปิดใช้</option></select></label><label class="p6-span2">Checklist<textarea id="p6p-check" rows="6" placeholder="หนึ่งรายการต่อหนึ่งบรรทัด">${p6Esc(check)}</textarea></label></div>`,width:780,showCancelButton:true,confirmButtonText:'บันทึกแผน',cancelButtonText:'ยกเลิก',preConfirm:()=>{const planCode=document.getElementById('p6p-code').value.trim(),planName=document.getElementById('p6p-name').value.trim();if(!planCode||!planName){Swal.showValidationMessage('กรุณาระบุรหัสและชื่อแผน');return false;}return {id:id||undefined,planCode,planName,equipmentName:document.getElementById('p6p-eq').value.trim(),intervalMonths:Number(document.getElementById('p6p-month').value||6),intervalBorrowCount:document.getElementById('p6p-count').value||null,active:document.getElementById('p6p-active').value==='true',checklist:document.getElementById('p6p-check').value.split(/\n+/).map(x=>x.trim()).filter(Boolean)};}});
    if(!ans.isConfirmed)return;
    const save=await p6Run('saveMaintenancePlan',ans.value);
    if(!save?.success){Swal.fire('บันทึกไม่สำเร็จ',save?.error||'เกิดข้อผิดพลาด','error');return;}
    await Swal.fire('สำเร็จ','บันทึกแผน PM แล้ว','success');
    phase6Items=[];loadPhase6Lifecycle(true);
  };

  function injectEnhancements(){
    const kpis=document.querySelector('#sec-lifecycle .p6-kpis');
    if(kpis&&!document.getElementById('p6-kpi-baseline')){
      const card=document.createElement('div');card.className='p6-kpi p6-kpi-baseline';card.innerHTML='<span>ต้องตั้งค่า PM เริ่มต้น</span><b id="p6-kpi-baseline">0</b>';
      const noPlan=document.getElementById('p6-kpi-noplan')?.closest('.p6-kpi');
      if(noPlan)kpis.insertBefore(card,noPlan);else kpis.appendChild(card);
    }
    const filter=document.getElementById('p6-state-filter');
    if(filter&&![...filter.options].some(o=>o.value==='BASELINE_REQUIRED')){
      const opt=document.createElement('option');opt.value='BASELINE_REQUIRED';opt.textContent='ต้องบันทึก PM เริ่มต้น';filter.insertBefore(opt,filter.options[1]||null);
    }
  }
  document.addEventListener('DOMContentLoaded',injectEnhancements);
})();
