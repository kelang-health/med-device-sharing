from pathlib import Path
import re

idx=Path('index.html'); jsf=Path('script.js'); cssf=Path('style.css')
index=idx.read_text(encoding='utf-8'); js=jsf.read_text(encoding='utf-8'); css=cssf.read_text(encoding='utf-8')

def must_replace(text, old, new, label, count=1):
    if old not in text: raise SystemExit('MISSING '+label)
    return text.replace(old,new,count)

def must_sub(text, pattern, repl, label, count=1):
    out,n=re.subn(pattern,repl,text,count=count,flags=re.S)
    if n!=count: raise SystemExit(f'MISSING {label}: {n}')
    return out

# version/cache
index=index.replace('style.css?v=4.1.0','style.css?v=4.1.1',1).replace('script.js?v=4.1.0','script.js?v=4.1.1',1)
index=index.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v4.1.0 |','ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v4.1.1 |',1)
js=js.replace('Frontend Controller API (v4.1.0 Backup & Log Maintenance)','Frontend Controller API (v4.1.1 Stabilization & Safety Fix)',1)
js=js.replace('v3.8.0','v4.1.1')

# Dashboard lifecycle: add unavailable segment/legend
old='''                            <span><span class="usage-legend-dot bg-emerald-500"></span>ว่าง <span id="usage-legend-avail">0</span></span>\n                            <span><span class="usage-legend-dot bg-rose-600"></span>ถูกยืม <span id="usage-legend-borrow">0</span></span>\n                            <span><span class="usage-legend-dot bg-amber-600"></span>เกินกำหนด <span id="usage-legend-overdue">0</span></span>'''
new='''                            <span><span class="usage-legend-dot bg-emerald-500"></span>พร้อมใช้ <span id="usage-legend-avail">0</span></span>\n                            <span><span class="usage-legend-dot bg-rose-600"></span>ถูกยืม <span id="usage-legend-borrow">0</span></span>\n                            <span><span class="usage-legend-dot bg-slate-400"></span>ไม่พร้อมใช้ <span id="usage-legend-unavailable">0</span></span>\n                            <span><span class="usage-legend-dot bg-amber-600"></span>เกินกำหนด <span id="usage-legend-overdue">0</span></span>'''
index=must_replace(index,old,new,'usage legend')
index=must_replace(index,'<div class="usage-bar-seg seg-borrowed" id="usage-seg-borrowed" style="width:0%"></div>\n                        <div class="usage-bar-seg seg-overdue" id="usage-seg-overdue" style="width:0%"></div>',
'''<div class="usage-bar-seg seg-borrowed" id="usage-seg-borrowed" style="width:0%"></div>\n                        <div class="usage-bar-seg seg-unavailable" id="usage-seg-unavailable" style="width:0%"></div>\n                        <div class="usage-bar-seg seg-overdue" id="usage-seg-overdue" style="width:0%"></div>''','usage unavailable segment')

# Maintenance copy + secure images button
index=index.replace('Backup Spreadsheet, Archive Audit Log และตรวจไฟล์รูปที่ไม่มีรายการอ้างอิง โดยงานลบต้องยืนยันก่อนทุกครั้ง',
                    'Backup Spreadsheet + รูปหลักฐาน แยกโฟลเดอร์สำรอง, Archive Audit Log แบบปลอดภัย และตรวจสิทธิ์รูปหลักฐาน โดยงานลบต้องยืนยันก่อนทุกครั้ง',1)
anchor='''                        <button type="button" onclick="scanOrphanFilesUi()" class="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100 px-4 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-magnifying-glass mr-1"></i> ตรวจไฟล์รูป orphan</button>'''
insert=anchor+'''\n                        <button type="button" onclick="secureBorrowImagesUi()" class="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-100 px-4 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-lock mr-1"></i> ปิด Public Link รูปหลักฐาน</button>'''
if 'secureBorrowImagesUi()' not in index:index=must_replace(index,anchor,insert,'secure images button')

# dashboard functions lifecycle-aware
js=must_sub(js,r"function renderDashboardStats\(\) \{.*?\n\}\n\n// 🎯",'''function renderDashboardStats() {
    const totalEq = state.equipments.length;
    const activeBorrows = getActiveBorrows();
    const borrowedSet = getBorrowedEquipmentIdSet();
    const lifecycleCounts = { Available:0, Borrowed:0, Cleaning:0, Inspection:0, Maintenance:0, Damaged:0, Lost:0, Retired:0 };
    state.equipments.forEach(eq => { const s=getEquipmentStatus(eq,borrowedSet); lifecycleCounts[s]=(lifecycleCounts[s]||0)+1; });

    let borrowedCount, availableCount, overdueCount, nearDueCount, extendedCount, totalLogs;
    borrowedCount = activeBorrows.length;
    availableCount = lifecycleCounts.Available || 0;
    const unavailableCount = Math.max(0,totalEq-availableCount-borrowedCount);

    if (state.isAdmin) {
        overdueCount = activeBorrows.filter(isOverdueBorrow).length;
        nearDueCount = activeBorrows.filter(r => !isOverdueBorrow(r) && isNearDueBorrow(r)).length;
        extendedCount = activeBorrows.filter(r => getExtensionCount(r) > 0).length;
        totalLogs = state.data.length;
    } else if (state.publicSummary) {
        borrowedCount = Number(state.publicSummary.borrowed || borrowedCount);
        availableCount = Number(state.publicSummary.available ?? availableCount);
        overdueCount = Number(state.publicSummary.overdue || 0);
        nearDueCount = Number(state.publicSummary.nearDue || 0);
        extendedCount = Number(state.publicSummary.extended || 0);
        totalLogs = Number(state.publicSummary.totalBorrowRecords || 0);
    } else { overdueCount=0;nearDueCount=0;extendedCount=0;totalLogs=0; }

    const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.innerText=value;};
    setText('stat-total-eq',totalEq);setText('stat-borrow-eq',borrowedCount);setText('stat-avail-eq',availableCount);setText('stat-overdue-eq',overdueCount);setText('stat-near-due',nearDueCount);setText('stat-extended-eq',extendedCount);setText('stat-total-logs',totalLogs);
    renderUsageAllocationBar(totalEq,availableCount,borrowedCount,overdueCount,Math.max(0,totalEq-availableCount-borrowedCount));
    updateSidebarBorrowBadge(borrowedCount);updateSidebarTrackingBadge(overdueCount);
}

// 🎯''','renderDashboardStats')

js=must_sub(js,r"function renderUsageAllocationBar\(totalEq, availableCount, borrowedCount, overdueCount\) \{.*?\n\}\n\n// 🔔",'''function renderUsageAllocationBar(totalEq, availableCount, borrowedCount, overdueCount, unavailableCount) {
    const segAvail=document.getElementById('usage-seg-available'),segBorrow=document.getElementById('usage-seg-borrowed'),segOverdue=document.getElementById('usage-seg-overdue'),segUnavailable=document.getElementById('usage-seg-unavailable'),caption=document.getElementById('usage-bar-caption');
    if(!segAvail||!segBorrow||!segOverdue)return;
    const normalBorrowed=Math.max(borrowedCount-overdueCount,0),safeTotal=totalEq>0?totalEq:1,unavailable=Math.max(0,Number(unavailableCount||0));
    const pctAvail=availableCount/safeTotal*100,pctBorrow=normalBorrowed/safeTotal*100,pctOverdue=overdueCount/safeTotal*100,pctUnavailable=unavailable/safeTotal*100;
    segAvail.style.width=pctAvail+'%';segBorrow.style.width=pctBorrow+'%';segOverdue.style.width=pctOverdue+'%';if(segUnavailable)segUnavailable.style.width=pctUnavailable+'%';
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.innerText=v;};set('usage-legend-avail',availableCount);set('usage-legend-borrow',borrowedCount);set('usage-legend-overdue',overdueCount);set('usage-legend-unavailable',unavailable);
    if(totalEq===0)caption.innerText='ยังไม่มีข้อมูลครุภัณฑ์ในคลัง กรุณาลงทะเบียนอุปกรณ์เพื่อเริ่มใช้งานระบบ';
    else caption.innerText=`จากครุภัณฑ์ทั้งหมด ${totalEq} ชิ้น: พร้อมใช้งาน ${availableCount} ชิ้น (${pctAvail.toFixed(0)}%), กำลังยืม ${borrowedCount} ชิ้น (${((borrowedCount/safeTotal)*100).toFixed(0)}%), ไม่พร้อมใช้/ซ่อม/ตรวจ ${unavailable} ชิ้น (${pctUnavailable.toFixed(0)}%), เกินกำหนด ${overdueCount} ชิ้น`;
}

// 🔔''','renderUsageAllocationBar')

# equipment category cards: use lifecycle not total-borrowed
js=must_sub(js,r"function renderEquipmentTypeGrid\(\) \{.*?\n\}\n\n// เรนเดอร์ตารางสรุปประวัติ",'''function renderEquipmentTypeGrid() {
    const grid=document.getElementById('equipment-type-grid');if(!grid)return;grid.innerHTML='';const groups={},borrowedSet=getBorrowedEquipmentIdSet();
    state.equipments.forEach(eq=>{let name=eq.EquipmentName||eq[1];name=name?String(name).trim():'อุปกรณ์ทั่วไป';if(!groups[name])groups[name]={total:0,available:0,borrowed:0,attention:0};groups[name].total++;const s=getEquipmentStatus(eq,borrowedSet);if(s==='Available')groups[name].available++;else if(s==='Borrowed')groups[name].borrowed++;else groups[name].attention++;});
    if(!Object.keys(groups).length){grid.innerHTML=`<div class="col-span-full empty-state"><i class="fa-solid fa-box-open text-3xl"></i><span>ยังไม่มีข้อมูลครุภัณฑ์ในคลัง</span></div>`;return;}
    for(const name in groups){const {icon,solid,pastel,border,text}=getCategoryVisual(name),g=groups[name],card=document.createElement('div');card.className='cat-card border p-4 rounded-2xl shadow-sm flex items-center justify-between transition-all hover:scale-[1.02] hover:shadow-lg';card.style.backgroundColor=pastel;card.style.borderColor=border;card.style.color=text;card.innerHTML=`<div class="flex items-center gap-3 overflow-hidden"><div class="cat-badge w-12 h-12 flex items-center justify-center rounded-2xl text-white flex-shrink-0" style="background-color:${solid}; box-shadow:0 6px 16px -6px ${solid}99, 0 0 0 4px ${solid}33;"><i class="fa-solid ${icon} text-xl"></i></div><div class="overflow-hidden"><h5 class="font-bold text-xs text-gray-700 truncate">${escapeHtml(name)}</h5><p class="text-[11px] text-gray-500 mt-0.5">ทั้งหมด: ${g.total} | พร้อมใช้: <span class="text-emerald-600 font-bold">${g.available}</span>${g.attention?` | ไม่พร้อม: <span class="text-slate-500 font-bold">${g.attention}</span>`:''}</p></div></div><div class="text-right flex-shrink-0"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background-color:#ffe4e6; color:#be123c;">ยืมอยู่: ${g.borrowed}</span></div>`;grid.appendChild(card);}
}

// เรนเดอร์ตารางสรุปประวัติ''','renderEquipmentTypeGrid')

# XSS hardening in recurring render paths
repls={
"${item.EquipmentID || item[5] || '-'}":"${escapeHtml(item.EquipmentID || item[5] || '-')}",
"${item.PatientName || item.BorrowerName || item[13] || item[1] || '-'}":"${escapeHtml(item.PatientName || item.BorrowerName || item[13] || item[1] || '-')}",
"${item.CitizenID || item[2] || '-'}":"${escapeHtml(item.CitizenID || item[2] || '-')}",
"${item.Community || item[4] || '-'}":"${escapeHtml(item.Community || item[4] || '-')}",
"${item.Phone || item[12] || '-'}":"${escapeHtml(item.Phone || item[12] || '-')}",
"${patientName}</td>":"${escapeHtml(patientName)}</td>",
"${citizenId}</td>":"${escapeHtml(citizenId)}</td>",
"${community}</td>":"${escapeHtml(community)}</td>",
"${phone}</td>":"${escapeHtml(phone)}</td>",
"${borrowerDetails}</td>":"${escapeHtml(borrowerDetails)}</td>",
"${eqId}</td>":"${escapeHtml(eqId)}</td>",
"${commName}<br>":"${escapeHtml(commName)}<br>",
"${item.EquipmentID || item[0] || '-'}</td>":"${escapeHtml(item.EquipmentID || item[0] || '-')}</td>",
"${item.EquipmentName || item[1] || '-'}</td>":"${escapeHtml(item.EquipmentName || item[1] || '-')}</td>",
"${item.SerialNumber || item[2] || '-'}</td>":"${escapeHtml(item.SerialNumber || item[2] || '-')}</td>"
}
for a,b in repls.items(): js=js.replace(a,b)
js=js.replace("document.getElementById('print-agency-name').innerHTML = title2 ? `${title1}<br>${title2}` : title1;","document.getElementById('print-agency-name').innerHTML = title2 ? `${escapeHtml(title1)}<br>${escapeHtml(title2)}` : escapeHtml(title1);")

# Map popup hardening (remaining direct patient/phone expressions)
js=js.replace("<b>ผู้ป่วย:</b> ${item.PatientName || item[13] || item[1]}<br>","<b>ผู้ป่วย:</b> ${escapeHtml(item.PatientName || item[13] || item[1] || '-')}<br>")
js=js.replace("<b>โทร:</b> ${item.Phone || item[12]}","<b>โทร:</b> ${escapeHtml(item.Phone || item[12] || '-')}")

# Secure image transport - authenticated API, no direct public Drive thumbnails
js=js.replace("let existingBorrowImageIds = []; // รหัสไฟล์รูปภาพเดิมที่แนบไว้แล้ว (ตอนแก้ไขรายการ) ที่ผู้ใช้ยังต้องการเก็บไว้","let existingBorrowImageIds = []; // รหัสไฟล์รูปภาพเดิมที่แนบไว้แล้ว (ตอนแก้ไขรายการ) ที่ผู้ใช้ยังต้องการเก็บไว้\nconst borrowImageCache = new Map();")

js=must_sub(js,r"function renderBorrowPhotoPreviews\(\) \{.*?\n\}\n\n// 🖼️ เปิดดูรูปภาพหลักฐาน",'''function normalizeBorrowImageId(value){
    const v=String(value||'').trim();if(!v)return '';if(!v.startsWith('http'))return v;
    const m=v.match(/[?&]id=([^&]+)/)||v.match(/\/d\/([A-Za-z0-9_-]+)/);return m?decodeURIComponent(m[1]):'';
}
async function getBorrowImageDataUrl(value){
    const id=normalizeBorrowImageId(value);if(!id)return '';if(borrowImageCache.has(id))return borrowImageCache.get(id);
    const r=await run('getBorrowImage',{fileId:id});if(!r||!r.success||!r.dataUrl)return '';borrowImageCache.set(id,r.dataUrl);return r.dataUrl;
}
async function hydrateSecureBorrowImages(root=document){
    const imgs=[...root.querySelectorAll('img[data-borrow-file-id]')];await Promise.all(imgs.map(async img=>{const u=await getBorrowImageDataUrl(img.dataset.borrowFileId);if(u)img.src=u;else{img.alt='ไม่สามารถโหลดรูปหลักฐาน';img.classList.add('opacity-40');}}));
}
function renderBorrowPhotoPreviews() {
    const wrap=document.getElementById('borrow-photo-previews'),trigger=document.getElementById('borrow-photo-trigger'),triggerLabel=document.getElementById('borrow-photo-trigger-label');if(!wrap)return;
    const placeholder='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect width="100%" height="100%" fill="%23f1f5f9"/><text x="50%" y="52%" text-anchor="middle" fill="%2394a3b8" font-size="14">loading...</text></svg>';
    const existingHtml=existingBorrowImageIds.map((id,idx)=>`<div class="photo-preview-item"><img src="${placeholder}" data-borrow-file-id="${escapeHtml(normalizeBorrowImageId(id))}" alt="รูปหลักฐานเดิม ${idx+1}" /><div class="photo-preview-remove" onclick="removeExistingBorrowImage(${idx})" title="เอารูปนี้ออก"><i class="fa-solid fa-xmark"></i></div></div>`).join('');
    const newHtml=borrowPhotos.map((src,idx)=>`<div class="photo-preview-item"><img src="${src}" alt="รูปหลักฐานใหม่ ${idx+1}" /><span class="absolute top-1 left-1 bg-teal-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">ใหม่</span><div class="photo-preview-remove" onclick="removeBorrowPhoto(${idx})" title="เอารูปนี้ออก"><i class="fa-solid fa-xmark"></i></div></div>`).join('');
    const totalCount=existingBorrowImageIds.length+borrowPhotos.length;if(totalCount===0){wrap.classList.add('hidden');wrap.innerHTML='';}else{wrap.classList.remove('hidden');wrap.innerHTML=existingHtml+newHtml;hydrateSecureBorrowImages(wrap);}
    if(!trigger||!triggerLabel)return;if(totalCount>=3)trigger.classList.add('hidden');else{trigger.classList.remove('hidden');triggerLabel.innerText=`ถ่ายรูปหลักฐาน (${totalCount}/3)`;}
}

// 🖼️ เปิดดูรูปภาพหลักฐาน''','secure preview')

js=must_sub(js,r"function driveImageUrl\(idOrUrl\) \{.*?function closeImageGallery\(\) \{\n    document.getElementById\('modal-image-gallery'\)\.classList.remove\('active'\);\n\}",'''function driveImageUrl(idOrUrl) { return String(idOrUrl||'').trim(); }

async function viewBorrowImages(entryId) {
    const record=state.data.find(r=>(r.EntryID||r[0])===entryId);if(!record)return;
    const imagesRaw=record.Images||record[7]||'',ids=String(imagesRaw).split(',').map(s=>s.trim()).filter(Boolean),body=document.getElementById('image-gallery-body');
    document.getElementById('modal-image-gallery').classList.add('active');
    if(!ids.length){body.innerHTML=`<div class="col-span-full empty-state"><i class="fa-solid fa-image text-3xl"></i><span>ไม่มีรูปภาพหลักฐานแนบสำหรับรายการนี้</span></div>`;return;}
    body.innerHTML='<div class="col-span-full text-center text-gray-400 py-6"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังโหลดรูปอย่างปลอดภัย...</div>';
    const urls=await Promise.all(ids.map(getBorrowImageDataUrl)),valid=urls.filter(Boolean);
    if(!valid.length){body.innerHTML='<div class="col-span-full empty-state text-rose-500">ไม่สามารถอ่านรูปหลักฐานได้ กรุณาตรวจสิทธิ์ไฟล์หรือ Backend v4.1.1</div>';return;}
    body.innerHTML=valid.map((url,i)=>`<div class="gallery-photo-item"><img src="${url}" data-secure-gallery-index="${i}" alt="รูปหลักฐานการยืม" /></div>`).join('');
    [...body.querySelectorAll('img[data-secure-gallery-index]')].forEach(img=>{img.onclick=()=>window.open(valid[Number(img.dataset.secureGalleryIndex)],'_blank');});
}
function closeImageGallery(){document.getElementById('modal-image-gallery').classList.remove('active');}''','secure gallery')

# schema UI current version
js=js.replace('โครงสร้างข้อมูลพร้อมใช้งาน v4.1.1','โครงสร้างข้อมูลพร้อมใช้งาน v4.1.1')
js=js.replace('อัปเกรดโครงสร้างเป็น v4.1.1?','อัปเกรดโครงสร้างเป็น v4.1.1?')

# Maintenance status v4.1.1
js=must_sub(js,r"async function loadMaintenanceStatus\(\)\{.*?\n\}",'''async function loadMaintenanceStatus(){
    const box=document.getElementById('maintenance-status');if(!box)return;box.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังตรวจสอบสถานะ...';
    const r=await run('getMaintenanceStatus',{});if(!r||!r.success){box.innerHTML=`<span class="text-rose-600">${escapeHtml((r&&r.error)||'โหลดสถานะไม่สำเร็จ')}${String(r&&r.error||'').includes('ไม่พบ Action')?'<br>กรุณา Deploy Backend v4.1.1 ก่อน':''}</span>`;return;}
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('maint-count-borrow',Number(r.borrowRows||0).toLocaleString('th-TH'));set('maint-count-audit',Number(r.auditRows||0).toLocaleString('th-TH'));set('maint-count-images',Number(r.imageFiles||0).toLocaleString('th-TH'));set('maint-count-backups',Number(r.dailyBackupCount||0)+Number(r.monthlyBackupCount||0));
    const en=document.getElementById('maint-backup-enabled');if(en)en.checked=!!r.backupEnabled;const hr=document.getElementById('maint-backup-hour');if(hr)hr.value=Number.isFinite(Number(r.backupHour))?Number(r.backupHour):2;
    const p=r.policy||{},latest=r.lastBackupUrl?`<a class="text-cyan-700 underline" href="${escapeHtml(r.lastBackupUrl)}" target="_blank" rel="noopener">${escapeHtml(r.lastBackupName||'เปิดชุดสำรองล่าสุด')}</a>`:escapeHtml(r.lastBackupName||'ยังไม่มี'),root=r.backupRootUrl?`<a class="text-cyan-700 underline" href="${escapeHtml(r.backupRootUrl)}" target="_blank" rel="noopener">เปิดโฟลเดอร์ Backup แยก</a>`:'ยังไม่ได้สร้าง';
    const imgRisk=Number(r.publicImageFiles||0)>0?`<span class="text-rose-600 font-bold">ยัง Public ${Number(r.publicImageFiles).toLocaleString('th-TH')} ไฟล์</span>`:'<span class="text-emerald-700 font-bold">Private ทั้งหมด</span>';
    box.innerHTML=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5"><div><b>สำรองล่าสุด:</b> ${maintenanceDateText(r.lastBackupAt)}<br>${latest}<br>${root}</div><div><b>อัตโนมัติ:</b> ${r.backupEnabled?'เปิด':'ปิด'} ${r.backupEnabled?'ช่วง '+String(r.backupHour).padStart(2,'0')+':00 น.':''}<br><b>Trigger:</b> ${r.backupTrigger?'พร้อม':r.triggerAuthorizationRequired?'ต้องอนุญาตสิทธิ์':'ยังไม่ตั้ง'}</div><div><b>Daily:</b> ${r.dailyBackupCount||0} ชุด / เก็บ ${p.dailyRetentionDays||30} วัน<br><b>Monthly:</b> ${r.monthlyBackupCount||0} ชุด / เก็บ ${p.monthlyRetentionCount||12} ชุด</div><div><b>รูปหลักฐาน:</b> ${Number(r.imageFiles||0).toLocaleString('th-TH')} • ${imgRisk}<br><b>Archive sheets:</b> ${r.archiveSheetCount||0}<br><b>MaintenanceLog:</b> ${r.maintenanceRows||0} รายการ / ${p.maintenanceLogDays||730} วัน</div></div>${r.triggerAuthorizationRequired?'<div class="mt-2 text-amber-700">ต้องรัน <b>authorizeMaintenanceServices</b> ใน Apps Script Editor 1 ครั้งก่อนเปิด Backup อัตโนมัติ</div>':''}`;
}''','loadMaintenanceStatus')

# Backup feedback include images
js=js.replace("await Swal.fire('สำรองสำเร็จ',`สร้าง ${r.fileName||'ไฟล์สำรอง'} เรียบร้อย`,'success')","await Swal.fire('สำรองสำเร็จ',`สร้าง ${r.fileName||'ชุดสำรอง'} เรียบร้อย • รูปหลักฐาน ${Number(r.imageCopied||0)} ไฟล์${r.imageFailed?' • คัดลอกรูปไม่สำเร็จ '+r.imageFailed+' ไฟล์':''}`,'success')")

# Secure image permission UI
maint_anchor='async function scanOrphanFilesUi(){'
secure_ui='''async function secureBorrowImagesUi(){
    const q=await Swal.fire({title:'ปิด Public Link ของรูปหลักฐาน?',html:'รูปที่ถูกอ้างอิงใน BorrowLog จะเปลี่ยนเป็น <b>Private</b> และหน้าเว็บจะอ่านผ่าน Session ที่ล็อกอินเท่านั้น',icon:'question',showCancelButton:true,confirmButtonText:'ดำเนินการ',cancelButtonText:'ยกเลิก',confirmButtonColor:'#0891b2'});if(!q.isConfirmed)return;
    Swal.fire({title:'กำลังปรับสิทธิ์รูปหลักฐาน...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});const r=await run('secureBorrowImages',{});if(r&&r.success){await Swal.fire('ปรับสิทธิ์แล้ว',`Private เพิ่ม ${r.secured||0} ไฟล์ • Private อยู่แล้ว ${r.alreadyPrivate||0}${r.failed?' • ไม่สำเร็จ '+r.failed:''}`,'success');borrowImageCache.clear();await loadMaintenanceStatus();await loadMaintenanceLog();}else Swal.fire('ไม่สำเร็จ',(r&&r.error)||'ไม่สามารถปรับสิทธิ์รูปได้','error');
}

'''
if 'async function secureBorrowImagesUi()' not in js: js=must_replace(js,maint_anchor,secure_ui+maint_anchor,'secure images UI')

# cleanup/archive text says prebackup
js=js.replace("text:'ย้าย Log เก่าออกจาก AuditLog หลัก โดยไม่ลบข้อมูล'","text:'ระบบจะสำรองข้อมูลก่อน แล้วจึงย้าย Log เก่าออกจาก AuditLog หลักแบบไม่ clear ทั้งชีต'")
js=js.replace("html:'ข้อมูลที่เก่ากว่า 1,095 วันจะถูกลบออกจากชีต Archive<br><b>ควรมี Backup ก่อนดำเนินการ</b>","html:'ระบบจะสร้าง Backup ก่อนอัตโนมัติ แล้วลบเฉพาะแถวที่เก่ากว่า 1,095 วันจากชีต Archive")
js=js.replace("html:'ระบบตรวจซ้ำก่อนลบ และจะจัดการเฉพาะ <b>borrow_*.jpg</b>","html:'ระบบจะ Backup ก่อนอัตโนมัติ ตรวจซ้ำก่อนลบ และจะจัดการเฉพาะ <b>borrow_*.jpg</b>")

# CSS unavailable lifecycle segment
if '.seg-unavailable' not in css:
    css += '\n/* v4.1.1 lifecycle unavailable segment */\n.seg-unavailable{background:#94a3b8;}\n'

# trim
index='\n'.join(x.rstrip() for x in index.splitlines())+'\n';js='\n'.join(x.rstrip() for x in js.splitlines())+'\n';css='\n'.join(x.rstrip() for x in css.splitlines())+'\n'
idx.write_text(index,encoding='utf-8');jsf.write_text(js,encoding='utf-8');cssf.write_text(css,encoding='utf-8')
print('patched frontend v4.1.1')