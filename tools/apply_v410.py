from pathlib import Path

idx=Path('index.html')
jsf=Path('script.js')
index=idx.read_text(encoding='utf-8')
js=jsf.read_text(encoding='utf-8')

def must_replace(text, old, new, label):
    if old not in text:
        raise SystemExit(f'MISSING {label}')
    return text.replace(old,new,1)

# Version/cache
index=index.replace('style.css?v=4.0.0','style.css?v=4.1.0',1)
index=index.replace('script.js?v=4.0.0','script.js?v=4.1.0',1)
index=index.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v4.0.0 |','ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v4.1.0 |',1)
js=js.replace('Frontend Controller API (v4.0.0 Procurement Planning & Accessibility)','Frontend Controller API (v4.1.0 Backup & Log Maintenance)',1)

# Schema UI version
index=index.replace('โครงสร้างข้อมูลระบบ v3.8.0','โครงสร้างข้อมูลระบบ v4.1.0',1)
index=index.replace('อัปเกรดโครงสร้าง v3.8.0','อัปเกรดโครงสร้าง v4.1.0',1)
index=index.replace('เพิ่มเฉพาะคอลัมน์/ชีตที่ขาดสำหรับ Role, Audit, VOID และ LINE โดยไม่ลบ ไม่ clear และไม่เขียนทับข้อมูลเดิม','เพิ่มเฉพาะคอลัมน์/ชีตที่ขาด รวม MaintenanceLog สำหรับ Backup/Archive/Cleanup โดยไม่ลบ ไม่ clear และไม่เขียนทับข้อมูลเดิม',1)

# Insert maintenance card after Audit Log card
anchor='''                <div class="admin-role-only bg-white border border-slate-100 rounded-2xl shadow-sm p-5 max-w-2xl"><div class="flex justify-between items-center"><div><h4 class="font-bold text-sm">Audit Log</h4><p class="text-[11px] text-gray-400">ประวัติการแก้ไข/VOID/คืน/ยืมต่อ/ตั้งค่าระบบ</p></div><button onclick="loadAuditLogSection()" class="bg-slate-100 px-3 py-2 rounded-xl text-xs font-bold">รีเฟรช</button></div><div id="audit-log-list" class="mt-3 max-h-64 overflow-auto text-[11px]">กำลังโหลด...</div></div>\n'''
maintenance=anchor+'''\n                <div class="admin-role-only bg-white border border-cyan-100 rounded-2xl shadow-sm p-5 max-w-2xl">\n                    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">\n                        <div>\n                            <h4 class="font-bold text-sm text-gray-800 flex items-center gap-2"><i class="fa-solid fa-database text-cyan-600"></i> สำรองข้อมูลและบำรุงรักษาระบบ</h4>\n                            <p class="text-[11px] text-gray-400 mt-1">Backup Spreadsheet, Archive Audit Log และตรวจไฟล์รูปที่ไม่มีรายการอ้างอิง โดยงานลบต้องยืนยันก่อนทุกครั้ง</p>\n                        </div>\n                        <button type="button" onclick="loadMaintenanceStatus()" class="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap"><i class="fa-solid fa-rotate mr-1"></i> รีเฟรชสถานะ</button>\n                    </div>\n\n                    <div id="maintenance-status" class="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600">กำลังตรวจสอบ...</div>\n\n                    <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">\n                        <div class="bg-slate-50 border border-slate-100 rounded-xl p-3"><div class="text-[10px] text-gray-400">BorrowLog</div><div id="maint-count-borrow" class="font-black text-lg text-slate-800">-</div></div>\n                        <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-3"><div class="text-[10px] text-indigo-500">AuditLog</div><div id="maint-count-audit" class="font-black text-lg text-indigo-800">-</div></div>\n                        <div class="bg-amber-50 border border-amber-100 rounded-xl p-3"><div class="text-[10px] text-amber-600">รูปหลักฐาน</div><div id="maint-count-images" class="font-black text-lg text-amber-800">-</div></div>\n                        <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-3"><div class="text-[10px] text-emerald-600">Backup</div><div id="maint-count-backups" class="font-black text-lg text-emerald-800">-</div></div>\n                    </div>\n\n                    <div class="mt-4 rounded-xl border border-cyan-100 bg-cyan-50/40 p-3">\n                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">\n                            <label class="flex items-center gap-2 text-xs font-semibold text-cyan-900"><input id="maint-backup-enabled" type="checkbox" class="accent-cyan-600 h-4 w-4"> สำรองข้อมูลอัตโนมัติทุกวัน</label>\n                            <div class="flex items-center gap-2"><span class="text-xs text-gray-500">ช่วงเวลา</span><input id="maint-backup-hour" type="number" min="0" max="23" value="2" class="w-20 border border-gray-200 bg-white px-2 py-2 rounded-xl text-xs text-center"><span class="text-xs text-gray-500">:00 น.</span></div>\n                        </div>\n                        <button type="button" onclick="saveBackupSchedule()" class="mt-3 w-full bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-clock mr-1"></i> บันทึกตารางสำรองอัตโนมัติ</button>\n                        <p class="text-[10px] text-cyan-800/70 mt-2">ค่ามาตรฐาน: Daily เก็บ 30 วัน และ Monthly เก็บ 12 ชุด</p>\n                    </div>\n\n                    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">\n                        <button type="button" onclick="createBackupNow()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-cloud-arrow-up mr-1"></i> สำรองข้อมูลทันที</button>\n                        <button type="button" onclick="archiveOldAuditLogUi()" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 px-4 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-box-archive mr-1"></i> Archive Audit Log เก่า</button>\n                        <button type="button" onclick="scanOrphanFilesUi()" class="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100 px-4 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-magnifying-glass mr-1"></i> ตรวจไฟล์รูป orphan</button>\n                        <button type="button" onclick="cleanupOrphanFilesUi()" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 px-4 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-trash-can mr-1"></i> ล้างไฟล์ orphan</button>\n                        <button type="button" onclick="cleanupArchiveLogsUi()" class="sm:col-span-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-broom mr-1"></i> ล้าง Audit Archive อายุเกิน 3 ปี</button>\n                    </div>\n\n                    <div class="mt-4 border-t border-gray-100 pt-4">\n                        <div class="flex items-center justify-between"><div><h5 class="font-bold text-xs text-gray-700">Maintenance Log</h5><p class="text-[10px] text-gray-400">ประวัติ Backup / Archive / Cleanup</p></div><button onclick="loadMaintenanceLog()" class="bg-gray-100 px-3 py-2 rounded-xl text-[11px] font-bold">รีเฟรช</button></div>\n                        <div id="maintenance-log-list" class="mt-2 max-h-52 overflow-auto text-[11px] text-gray-600">กำลังโหลด...</div>\n                    </div>\n                </div>\n'''
if 'maintenance-status' not in index:
    index=must_replace(index,anchor,maintenance,'maintenance card')

# Settings hooks
old="""    if (tabId === 'settings') {\n        loadAdminUsersSection();\n        checkSchemaStatus();\n        loadAuditLogSection();\n        loadLineConfigStatus();\n    }"""
new="""    if (tabId === 'settings') {\n        loadAdminUsersSection();\n        checkSchemaStatus();\n        loadAuditLogSection();\n        loadMaintenanceStatus();\n        loadMaintenanceLog();\n        loadLineConfigStatus();\n    }"""
js=must_replace(js,old,new,'settings hooks')

# Maintenance JS before Audit Log loader
anchor_js="async function loadAuditLogSection(){"
maint_js=r'''function maintenanceDateText(value){
    if(!value)return 'ยังไม่มี';
    const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);
    return d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
}

async function loadMaintenanceStatus(){
    const box=document.getElementById('maintenance-status');if(!box)return;
    box.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังตรวจสอบสถานะ...';
    const r=await run('getMaintenanceStatus',{});
    if(!r||!r.success){box.innerHTML=`<span class="text-rose-600">${escapeHtml((r&&r.error)||'โหลดสถานะไม่สำเร็จ')}${String(r&&r.error||'').includes('ไม่พบ Action')?'<br>กรุณา Deploy Backend v4.1.0 ก่อน':''}</span>`;return;}
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('maint-count-borrow',Number(r.borrowRows||0).toLocaleString('th-TH'));
    set('maint-count-audit',Number(r.auditRows||0).toLocaleString('th-TH'));
    set('maint-count-images',Number(r.imageFiles||0).toLocaleString('th-TH'));
    set('maint-count-backups',Number(r.dailyBackupCount||0)+Number(r.monthlyBackupCount||0));
    const en=document.getElementById('maint-backup-enabled');if(en)en.checked=!!r.backupEnabled;
    const hr=document.getElementById('maint-backup-hour');if(hr)hr.value=Number.isFinite(Number(r.backupHour))?Number(r.backupHour):2;
    const p=r.policy||{},latest=r.lastBackupUrl?`<a class="text-cyan-700 underline" href="${escapeHtml(r.lastBackupUrl)}" target="_blank" rel="noopener">${escapeHtml(r.lastBackupName||'เปิดไฟล์สำรองล่าสุด')}</a>`:escapeHtml(r.lastBackupName||'ยังไม่มี');
    box.innerHTML=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5"><div><b>สำรองล่าสุด:</b> ${maintenanceDateText(r.lastBackupAt)}<br>${latest}</div><div><b>อัตโนมัติ:</b> ${r.backupEnabled?'เปิด':'ปิด'} ${r.backupEnabled?'ช่วง '+String(r.backupHour).padStart(2,'0')+':00 น.':''}<br><b>Trigger:</b> ${r.backupTrigger?'พร้อม':r.triggerAuthorizationRequired?'ต้องอนุญาตสิทธิ์':'ยังไม่ตั้ง'}</div><div><b>Daily:</b> ${r.dailyBackupCount||0} ชุด / เก็บ ${p.dailyRetentionDays||30} วัน<br><b>Monthly:</b> ${r.monthlyBackupCount||0} ชุด / เก็บ ${p.monthlyRetentionCount||12} ชุด</div><div><b>Archive sheets:</b> ${r.archiveSheetCount||0}<br><b>MaintenanceLog:</b> ${r.maintenanceRows||0} รายการ</div></div>${r.triggerAuthorizationRequired?'<div class="mt-2 text-amber-700">ต้องรัน <b>authorizeMaintenanceServices</b> ใน Apps Script Editor 1 ครั้งก่อนเปิด Backup อัตโนมัติ</div>':''}`;
}

async function createBackupNow(){
    const ok=await Swal.fire({title:'สำรองข้อมูลทันที?',text:'ระบบจะทำสำเนา Spreadsheet ไปยังโฟลเดอร์ System Backups โดยไม่แก้ข้อมูลต้นฉบับ',icon:'question',showCancelButton:true,confirmButtonText:'สำรองข้อมูล',cancelButtonText:'ยกเลิก'});if(!ok.isConfirmed)return;
    Swal.fire({title:'กำลังสำรองข้อมูล...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
    const r=await run('createSystemBackup',{});if(r&&r.success){await Swal.fire('สำรองสำเร็จ',`สร้าง ${r.fileName||'ไฟล์สำรอง'} เรียบร้อย`,'success');await loadMaintenanceStatus();await loadMaintenanceLog();}else Swal.fire('สำรองไม่สำเร็จ',(r&&r.error)||'เกิดข้อผิดพลาด','error');
}

async function saveBackupSchedule(){
    const enabled=!!document.getElementById('maint-backup-enabled')?.checked;let hour=Number(document.getElementById('maint-backup-hour')?.value||2);hour=Math.min(23,Math.max(0,hour));
    const r=await run('setupBackupSchedule',{enabled,hour});
    if(r&&r.success){Swal.fire('บันทึกแล้ว',r.message||'อัปเดตตารางสำรองแล้ว','success');await loadMaintenanceStatus();await loadMaintenanceLog();return;}
    if(r&&r.authorizationRequired)Swal.fire('ต้องอนุญาตสิทธิ์','เปิด Apps Script → เลือก authorizeMaintenanceServices → Run → อนุญาตสิทธิ์ แล้วกลับมากดบันทึกอีกครั้ง','warning');else Swal.fire('ไม่สำเร็จ',(r&&r.error)||'ตั้งเวลาไม่สำเร็จ','error');
}

async function archiveOldAuditLogUi(){
    const q=await Swal.fire({title:'Archive Audit Log',text:'ย้าย Log เก่าออกจาก AuditLog หลัก โดยไม่ลบข้อมูล',input:'number',inputValue:365,inputAttributes:{min:30,step:1},showCancelButton:true,confirmButtonText:'Archive',cancelButtonText:'ยกเลิก',inputLabel:'เก็บใน AuditLog หลักย้อนหลังอย่างน้อยกี่วัน'});if(!q.isConfirmed)return;
    const days=Math.max(30,Number(q.value||365));Swal.fire({title:'กำลัง Archive...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});const r=await run('archiveAuditLog',{retentionDays:days});
    if(r&&r.success){Swal.fire('Archive สำเร็จ',`ย้าย ${Number(r.archived||0).toLocaleString('th-TH')} รายการ เหลือใน AuditLog ${Number(r.remaining||0).toLocaleString('th-TH')} รายการ`,'success');await loadAuditLogSection();await loadMaintenanceStatus();await loadMaintenanceLog();}else Swal.fire('ไม่สำเร็จ',(r&&r.error)||'Archive ไม่สำเร็จ','error');
}

async function scanOrphanFilesUi(){
    Swal.fire({title:'กำลังตรวจไฟล์รูป...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});const r=await run('scanOrphanFiles',{});if(!r||!r.success){Swal.fire('ตรวจไม่สำเร็จ',(r&&r.error)||'เกิดข้อผิดพลาด','error');return;}
    const sample=(r.candidates||[]).slice(0,10).map(x=>`<li class="text-left">${escapeHtml(x.name)}</li>`).join('');Swal.fire({title:`พบ orphan ${r.orphanCount||0} ไฟล์`,html:`<div class="text-xs text-gray-500 mb-2">ตรวจเฉพาะไฟล์ borrow_*.jpg อายุเกิน 7 วัน และไม่พบการอ้างอิงใน BorrowLog</div>${sample?'<ul class="list-disc pl-5 max-h-48 overflow-auto">'+sample+'</ul>':'<div>ไม่พบไฟล์ที่ต้องจัดการ</div>'}`,icon:r.orphanCount?'warning':'success'});await loadMaintenanceLog();
}

async function cleanupOrphanFilesUi(){
    const q=await Swal.fire({title:'ย้าย orphan files ลงถังขยะ?',html:'ระบบตรวจซ้ำก่อนลบ และจะจัดการเฉพาะ <b>borrow_*.jpg</b> อายุเกิน 7 วันที่ไม่ถูกอ้างอิง<br><br>พิมพ์ <b>TRASH ORPHANS</b> เพื่อยืนยัน',input:'text',showCancelButton:true,confirmButtonText:'ย้ายลงถังขยะ',confirmButtonColor:'#e11d48',cancelButtonText:'ยกเลิก'});if(!q.isConfirmed)return;if(String(q.value||'').trim()!=='TRASH ORPHANS'){Swal.fire('ยังไม่ดำเนินการ','ข้อความยืนยันไม่ถูกต้อง','warning');return;}
    const r=await run('cleanupOrphanFiles',{confirmText:'TRASH ORPHANS'});if(r&&r.success){Swal.fire('ดำเนินการแล้ว',`ย้ายลงถังขยะ ${r.trashed||0} ไฟล์${r.failed?' / ไม่สำเร็จ '+r.failed+' ไฟล์':''}`,'success');await loadMaintenanceStatus();await loadMaintenanceLog();}else Swal.fire('ไม่สำเร็จ',(r&&r.error)||'Cleanup ไม่สำเร็จ','error');
}

async function cleanupArchiveLogsUi(){
    const q=await Swal.fire({title:'ล้าง Audit Archive เก่ากว่า 3 ปี?',html:'ข้อมูลที่เก่ากว่า 1,095 วันจะถูกลบออกจากชีต Archive<br><b>ควรมี Backup ก่อนดำเนินการ</b><br><br>พิมพ์ <b>DELETE ARCHIVE</b> เพื่อยืนยัน',input:'text',showCancelButton:true,confirmButtonText:'ล้างข้อมูลเก่า',confirmButtonColor:'#475569',cancelButtonText:'ยกเลิก'});if(!q.isConfirmed)return;if(String(q.value||'').trim()!=='DELETE ARCHIVE'){Swal.fire('ยังไม่ดำเนินการ','ข้อความยืนยันไม่ถูกต้อง','warning');return;}
    const r=await run('cleanupArchivedAuditLogs',{confirmText:'DELETE ARCHIVE',retentionDays:1095});if(r&&r.success){Swal.fire('Cleanup สำเร็จ',`ลบ ${r.deletedRows||0} แถวจาก Archive เก่า`,'success');await loadMaintenanceStatus();await loadMaintenanceLog();}else Swal.fire('ไม่สำเร็จ',(r&&r.error)||'Cleanup ไม่สำเร็จ','error');
}

async function loadMaintenanceLog(){
    const box=document.getElementById('maintenance-log-list');if(!box)return;box.innerHTML='กำลังโหลด...';const r=await run('getMaintenanceLog',{limit:50});if(!r||!r.success){box.textContent=(r&&r.error)||'โหลดไม่สำเร็จ';return;}
    box.innerHTML=(r.data||[]).map(x=>`<div class="border-b border-gray-100 py-2"><b>${escapeHtml(x.Action||'-')}</b> • ${escapeHtml(x.AdminName||x.AdminID||'SYSTEM')}<br><span class="text-gray-400">${maintenanceDateText(x.Timestamp)} • ${escapeHtml(x.Result||'')}</span></div>`).join('')||'ยังไม่มี Maintenance Log';
}

'''
if 'async function loadMaintenanceStatus()' not in js:
    js=must_replace(js,anchor_js,maint_js+anchor_js,'maintenance JS')

# strip whitespace
index='\n'.join(line.rstrip() for line in index.splitlines())+'\n'
js='\n'.join(line.rstrip() for line in js.splitlines())+'\n'
idx.write_text(index,encoding='utf-8')
jsf.write_text(js,encoding='utf-8')
print('patched frontend to v4.1.0 backup maintenance')
