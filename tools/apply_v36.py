from pathlib import Path
import re

def replace_func(src,name,new):
    m=re.search(rf'(?m)^function\s+{re.escape(name)}\s*\(',src)
    if not m: raise SystemExit(f'missing function {name}')
    m2=re.search(r'(?m)^function\s+[A-Za-z0-9_]+\s*\(',src[m.end():])
    end=m.end()+m2.start() if m2 else len(src)
    return src[:m.start()]+new.strip()+"\n\n"+src[end:]

p=Path('script.js'); s=p.read_text()
s=s.replace('v3.5 Renewal & Tracking','v3.6 Audit & Security')
s=s.replace("theme: 'medDevice.themeMode'", "theme: 'medDevice.themeMode',\n    role: 'medDevice.role'")
s=s.replace("state.adminName = '';\n}", "state.adminName = '';\n    state.role = '';\n    localStorage.removeItem(STORAGE_KEYS.role);\n}",1)
s=s.replace("adminName: '',\n    data:", "adminName: '',\n    role: '',\n    data:",1)
insert="""
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[ch]));
}
function safeCsvCell(value) {
    let cell = value === null || value === undefined ? '' : String(value);
    if (/^[=+@-]/.test(cell)) cell = "'" + cell;
    return `\"${cell.replace(/\"/g, '\"\"')}\"`;
}
"""
s=s.replace("const DEFAULT_LOGO =",insert+"\nconst DEFAULT_LOGO =",1)

s=replace_func(s,'applyAdminSessionUi',r'''
function applyAdminSessionUi() {
    const sidebar=document.getElementById('sidebar'),wrapper=document.getElementById('main-wrapper');
    if(sidebar)sidebar.classList.remove('hidden'); if(wrapper)wrapper.classList.add('md:pl-64');
    const brand=document.getElementById('public-header-brand'),loginBtn=document.getElementById('btn-login-trigger'),info=document.getElementById('logged-admin-info'),displayName=document.getElementById('display-admin-name'),pdpaBadge=document.getElementById('pdpa-badge'),borrowLog=document.getElementById('borrow-log-section');
    if(brand)brand.classList.add('md:hidden'); if(loginBtn)loginBtn.classList.add('hidden'); if(info)info.classList.remove('hidden');
    if(displayName)displayName.innerText=`${state.role==='ADMIN'?'ADMIN':'STAFF'}: ${state.adminName||'-'}`;
    if(pdpaBadge)pdpaBadge.classList.remove('hidden'); if(borrowLog)borrowLog.classList.remove('hidden');
    document.querySelectorAll('.admin-only').forEach(el=>el.classList.remove('hidden'));
    document.querySelectorAll('.admin-role-only').forEach(el=>el.classList.toggle('hidden',state.role!=='ADMIN'));
}
''')
s=s.replace("state.adminName = res.adminName || getSessionValue('adminName') || state.adminId;\n        setSessionValue('adminId', state.adminId);", "state.adminName = res.adminName || getSessionValue('adminName') || state.adminId;\n        state.role = res.role || 'STAFF';\n        setSessionValue('role', state.role);\n        setSessionValue('adminId', state.adminId);",1)
s=s.replace("setSessionValue('adminName', res.adminName);", "setSessionValue('adminName', res.adminName);\n        setSessionValue('role', res.role || 'STAFF');",1)
s=s.replace("function switchTab(tabId) {\n    if (!state.isAdmin && tabId !== 'dashboard') {", "function switchTab(tabId) {\n    if (state.isAdmin && tabId === 'settings' && state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','เมนูตั้งค่าระบบใช้ได้เฉพาะ ADMIN','warning'); return; }\n    if (!state.isAdmin && tabId !== 'dashboard') {",1)
s=s.replace("let cell = row[c] === null || row[c] === undefined ? '' : String(row[c]);\n            return `\"${cell.replace(/\"/g, '\"\"')}\"`;", "return safeCsvCell(row[c]);",1)
s=replace_func(s,'deleteBorrowRecord',r'''
async function deleteBorrowRecord(entryId) {
    if (state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','การ VOID รายการใช้ได้เฉพาะ ADMIN','warning'); return; }
    const result=await Swal.fire({title:'VOID รายการยืม?',text:'ข้อมูลจะไม่ถูกลบ และยังตรวจสอบย้อนหลังได้',icon:'warning',input:'textarea',inputLabel:'เหตุผลการ VOID',inputPlaceholder:'ระบุเหตุผล...',showCancelButton:true,confirmButtonText:'ยืนยัน VOID',cancelButtonText:'ยกเลิก',confirmButtonColor:'#e11d48',inputValidator:v=>String(v||'').trim().length<3?'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร':undefined});
    if(!result.isConfirmed)return;
    const res=await run('deleteBorrow',{id:entryId,reason:String(result.value||'').trim()});
    if(res.success){Swal.fire('VOID สำเร็จ','เก็บข้อมูลเดิมไว้ในระบบแล้ว','success');await loadSystemData();}
    else Swal.fire('ไม่สำเร็จ',res.error||'เกิดข้อผิดพลาด','error');
}
''')
s=replace_func(s,'deleteEquipmentRecord',r'''
async function deleteEquipmentRecord(eqId) {
    if (state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','การปิดใช้งานอุปกรณ์ใช้ได้เฉพาะ ADMIN','warning'); return; }
    const result=await Swal.fire({title:'ปิดใช้งานอุปกรณ์?',text:'ระบบจะไม่ลบประวัติเดิม',icon:'warning',input:'textarea',inputLabel:'เหตุผลการปิดใช้งาน',showCancelButton:true,confirmButtonText:'ยืนยันปิดใช้งาน',cancelButtonText:'ยกเลิก',inputValidator:v=>String(v||'').trim().length<3?'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร':undefined});
    if(!result.isConfirmed)return;
    const res=await run('deleteEquipment',{id:eqId,reason:String(result.value||'').trim()});
    if(res.success){Swal.fire('ปิดใช้งานแล้ว','','success');await loadSystemData();}else Swal.fire('ไม่สำเร็จ',res.error||'เกิดข้อผิดพลาด','error');
}
''')
s=s.replace("const password = document.getElementById('new-admin-password').value.trim();", "const password = document.getElementById('new-admin-password').value.trim();\n    const role = document.getElementById('new-admin-role') ? document.getElementById('new-admin-role').value : 'STAFF';",1)
s=s.replace("run('addAdminUser', { adminId, adminName, password })", "run('addAdminUser', { adminId, adminName, password, role })",1)
s=replace_func(s,'renderAdminUsersTable',r'''
function renderAdminUsersTable(users) {
    const list=document.getElementById('admin-users-list'); if(!list)return;
    if(!users.length){list.innerHTML='<div class="empty-state py-6">ยังไม่มีบัญชีผู้ใช้งาน</div>';return;}
    const me=getSessionValue('adminId')||'';
    list.innerHTML=users.map(u=>{
      const isMe=String(u.adminId).toLowerCase()===String(me).toLowerCase();
      const status=u.active!==false?'เปิดใช้งาน':'ปิดใช้งาน';
      return `<div class="flex items-center justify-between bg-gray-50 border rounded-xl px-3 py-2.5"><div><p class="font-bold">${escapeHtml(u.adminName)} <span class="text-[10px] text-indigo-600">${escapeHtml(u.role||'STAFF')}</span></p><p class="text-[11px] text-gray-400">${escapeHtml(u.adminId)} • ${status}</p></div><button ${isMe?'disabled':''} onclick="setAdminUserActivePrompt('${escapeHtml(u.adminId)}',${u.active===false?'true':'false'})" class="px-3 py-1.5 rounded-lg text-xs font-bold ${u.active===false?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}">${u.active===false?'เปิดใช้':'ปิดใช้'}</button></div>`;
    }).join('');
}
function setAdminUserActivePrompt(adminId,active){Swal.fire({title:active?'เปิดใช้งานบัญชี?':'ปิดใช้งานบัญชี?',icon:'question',showCancelButton:true,confirmButtonText:'ยืนยัน'}).then(async r=>{if(!r.isConfirmed)return;const res=await run('setAdminUserActive',{adminId,active});if(res.success){Swal.fire('สำเร็จ','','success');loadAdminUsersSection();}else Swal.fire('ไม่สำเร็จ',res.error||'','error');});}
''')
s=s.replace('v3.5','v3.6')
s=s.replace("DueDate, ExtensionCount, LastExtensionDate และสร้างชีต BorrowExtensionLog", "คอลัมน์สำหรับ Role/Audit/VOID/Inactive และสร้างชีต AuditLog/BorrowExtensionLog")
marker='async function loadAdminUsersSection()'
extra=r'''
async function loadAuditLogSection(){const box=document.getElementById('audit-log-list');if(!box)return;box.innerHTML='กำลังโหลด...';const res=await run('getAuditLog',{limit:50});if(!res.success){box.textContent=res.error||'โหลดไม่สำเร็จ';return;}box.innerHTML=(res.data||[]).map(x=>`<div class="border-b py-2"><b>${escapeHtml(x.Action)}</b> • ${escapeHtml(x.AdminName||x.AdminID)} • ${escapeHtml(x.Module)}<br><span class="text-gray-400">${escapeHtml(x.Timestamp)} ${escapeHtml(x.RecordID||'')}</span></div>`).join('')||'ยังไม่มี Audit Log';}
async function loadLineConfigStatus(){const el=document.getElementById('line-config-status');if(!el)return;const r=await run('getLineConfigStatus',{});el.textContent=r.success?`Token: ${r.tokenConfigured?'พร้อม':'ยังไม่มี'} | Target: ${r.targetConfigured?'พร้อม '+(r.targetMasked||''):'ยังไม่มี'} | แจ้งเตือน: ${r.enabled?'เปิด':'ปิด'} | Daily: ${r.dailyTrigger?'ตั้งแล้ว':'ยังไม่ตั้ง'}`:(r.error||'ตรวจสอบไม่ได้');}
async function saveLineConfigForm(){const token=(document.getElementById('line-token').value||'').trim(),targetId=(document.getElementById('line-target').value||'').trim(),enabled=document.getElementById('line-enabled').checked;const r=await run('saveLineConfig',{channelAccessToken:token,targetId,enabled});if(r.success){document.getElementById('line-token').value='';Swal.fire('บันทึก LINE OA แล้ว','','success');loadLineConfigStatus();}else Swal.fire('ไม่สำเร็จ',r.error||'','error');}
async function testLineNotification(){const r=await run('testLineNotification',{});Swal.fire(r.success?'ส่งทดสอบสำเร็จ':'ส่งไม่สำเร็จ',r.error||'ตรวจสอบ LINE OA ได้แล้ว',r.success?'success':'error');}
async function setupLineDailyTrigger(){const r=await run('setupLineDailyTrigger',{});Swal.fire(r.success?'ตั้งเวลาแล้ว':'ไม่สำเร็จ',r.message||r.error||'',r.success?'success':'error');loadLineConfigStatus();}

'''
if marker not in s: raise SystemExit('missing admin section marker')
s=s.replace(marker,extra+marker,1)
s=s.replace("loadAdminUsersSection();\n        checkSchemaStatus();", "loadAdminUsersSection();\n        checkSchemaStatus();\n        loadAuditLogSection();\n        loadLineConfigStatus();",1)
p.write_text(s)

p=Path('index.html'); h=p.read_text()
h=h.replace('style.css?v=3.5','style.css?v=3.6').replace('script.js?v=3.5','script.js?v=3.6').replace(' v3.5 |',' v3.6 |')
h=h.replace('id="btn-menu-settings" class="menu-item ', 'id="btn-menu-settings" class="admin-role-only menu-item ',1)
h=h.replace('โครงสร้างข้อมูลระบบ v3.5','โครงสร้างข้อมูลระบบ v3.6').replace('อัปเกรดโครงสร้าง v3.5','อัปเกรดโครงสร้าง v3.6')
needle='''<input type="password" id="new-admin-password" placeholder="อย่างน้อย 4 ตัวอักษร" minlength="4" class="w-full border border-gray-200 px-3 py-2 rounded-xl focus:outline-none" required />\n                </div>'''
rep=needle+'''\n                <div><label class="block font-bold text-gray-500 mb-1">สิทธิ์ใช้งาน</label><select id="new-admin-role" class="w-full border border-gray-200 px-3 py-2 rounded-xl bg-white"><option value="STAFF">STAFF — งานยืม/คืน/ติดตาม</option><option value="ADMIN">ADMIN — จัดการระบบทั้งหมด</option></select></div>'''
if needle in h: h=h.replace(needle,rep,1)
anchor='<div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 max-w-2xl">\n                    <div class="flex items-center justify-between mb-4">'
cards='''<div class="admin-role-only bg-white border border-slate-100 rounded-2xl shadow-sm p-5 max-w-2xl"><div class="flex justify-between items-center"><div><h4 class="font-bold text-sm">Audit Log</h4><p class="text-[11px] text-gray-400">ประวัติการแก้ไข/VOID/คืน/ยืมต่อ/ตั้งค่าระบบ</p></div><button onclick="loadAuditLogSection()" class="bg-slate-100 px-3 py-2 rounded-xl text-xs font-bold">รีเฟรช</button></div><div id="audit-log-list" class="mt-3 max-h-64 overflow-auto text-[11px]">กำลังโหลด...</div></div>\n\n                <div class="admin-role-only bg-white border border-emerald-100 rounded-2xl shadow-sm p-5 max-w-2xl"><h4 class="font-bold text-sm">LINE OA แจ้งเตือน</h4><p class="text-[11px] text-gray-400 mt-1">Token เก็บใน Apps Script Script Properties ไม่บันทึกใน GitHub</p><div id="line-config-status" class="text-[11px] mt-2 text-gray-600">กำลังตรวจสอบ...</div><div class="grid grid-cols-1 gap-2 mt-3"><input id="line-token" type="password" placeholder="Channel access token (เว้นว่างถ้าไม่เปลี่ยน)" class="border px-3 py-2 rounded-xl text-xs"><input id="line-target" type="text" placeholder="Target User ID / Group ID" class="border px-3 py-2 rounded-xl text-xs"><label class="text-xs"><input id="line-enabled" type="checkbox"> เปิดการแจ้งเตือน</label></div><div class="flex flex-wrap gap-2 mt-3"><button onclick="saveLineConfigForm()" class="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold">บันทึก</button><button onclick="testLineNotification()" class="bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-xs font-bold">ทดสอบส่ง</button><button onclick="setupLineDailyTrigger()" class="bg-amber-50 text-amber-700 px-3 py-2 rounded-xl text-xs font-bold">ตั้งสรุปทุกวัน 08:00</button></div></div>\n\n                '''
if anchor not in h: raise SystemExit('missing settings admin card anchor')
h=h.replace(anchor,cards+anchor,1)
p.write_text(h)
