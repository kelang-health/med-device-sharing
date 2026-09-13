from pathlib import Path

idx=Path('index.html')
jsf=Path('script.js')
cssf=Path('style.css')
index=idx.read_text(encoding='utf-8')
js=jsf.read_text(encoding='utf-8')
css=cssf.read_text(encoding='utf-8')

def must_replace(text, old, new, label):
    if old not in text:
        raise SystemExit(f'MISSING {label}')
    return text.replace(old,new,1)

# Version/cache
index=index.replace('style.css?v=3.9.0','style.css?v=4.0.0',1)
index=index.replace('script.js?v=3.9.0','script.js?v=4.0.0',1)
index=index.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.9.0 |','ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v4.0.0 |',1)
js=js.replace('Frontend Controller API (v3.9.0 Management Analytics)','Frontend Controller API (v4.0.0 Procurement Planning & Accessibility)',1)

# Sidebar procurement menu after analytics
analytics_menu='''                <button onclick="switchTab('analytics')" id="btn-menu-analytics" class="admin-role-only menu-item w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all">\n                    <i class="fa-solid fa-chart-line text-lg text-violet-500 w-6 text-center"></i>\n                    <span class="menu-text transition-all duration-200">วิเคราะห์การใช้งาน</span>\n                </button>\n'''
proc_menu=analytics_menu+'''                <button onclick="switchTab('procurement')" id="btn-menu-procurement" class="admin-role-only menu-item w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all">\n                    <i class="fa-solid fa-cart-flatbed text-lg text-cyan-600 w-6 text-center"></i>\n                    <span class="menu-text transition-all duration-200">แผนจัดหา/ทดแทน</span>\n                </button>\n'''
if 'btn-menu-procurement' not in index:
    index=must_replace(index,analytics_menu,proc_menu,'procurement menu')

# Header font size controls before theme button
header_anchor='''                <button id="theme-toggle-btn" onclick="toggleThemeMode()" title="สลับโหมดมืด/สว่าง" class="theme-toggle-btn text-gray-500 hover:bg-gray-100 w-9 h-9 flex items-center justify-center rounded-xl transition flex-shrink-0">'''
font_control='''                <div id="font-scale-control" class="font-scale-control flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden flex-shrink-0" title="ปรับขนาดตัวอักษรทั้งระบบ">\n                    <button type="button" onclick="changeFontScale(-1)" class="font-scale-btn" aria-label="ลดขนาดตัวอักษร">A−</button>\n                    <button type="button" onclick="resetFontScale()" id="font-scale-label" class="font-scale-label" title="กลับขนาดมาตรฐาน">100%</button>\n                    <button type="button" onclick="changeFontScale(1)" class="font-scale-btn" aria-label="เพิ่มขนาดตัวอักษร">A+</button>\n                </div>\n'''
if 'font-scale-control' not in index:
    index=must_replace(index,header_anchor,font_control+header_anchor,'font scale header control')

# Procurement section before map
map_section='''            <section id="sec-map" class="app-view space-y-6 hidden">'''
proc_section='''            <section id="sec-procurement" class="app-view space-y-6 hidden">\n                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">\n                    <div>\n                        <h3 class="text-base font-bold text-gray-800 flex items-center gap-2"><i class="fa-solid fa-cart-flatbed text-cyan-600"></i> แผนจัดหาและทดแทนอุปกรณ์</h3>\n                        <p class="text-xs text-gray-400 mt-1">จัดลำดับจากความถี่การยืม สัดส่วนใช้งาน สถานะคลัง และประวัติซ่อม โดยไม่ใช้ข้อมูลส่วนบุคคลผู้รับบริการ</p>\n                    </div>\n                    <div class="flex flex-col sm:flex-row gap-2">\n                        <select id="procurement-period" onchange="loadProcurementPlan()" class="border border-gray-200 bg-white px-3 py-2 rounded-xl text-xs focus:outline-none">\n                            <option value="fy">ปีงบประมาณปัจจุบัน</option>\n                            <option value="12m">12 เดือนล่าสุด</option>\n                            <option value="90d">90 วันล่าสุด</option>\n                            <option value="all">ประวัติทั้งหมด</option>\n                        </select>\n                        <button onclick="loadProcurementPlan()" class="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 px-3 py-2 rounded-xl text-xs font-bold"><i class="fa-solid fa-rotate mr-1"></i> รีเฟรช</button>\n                        <button onclick="window.print()" class="bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold"><i class="fa-solid fa-print mr-1"></i> พิมพ์</button>\n                    </div>\n                </div>\n                <div id="procurement-period-label" class="text-[11px] text-gray-400"></div>\n\n                <div class="grid grid-cols-2 md:grid-cols-5 gap-3">\n                    <div class="bg-cyan-50/70 border border-cyan-100 rounded-2xl p-4"><p class="text-[10px] font-bold text-cyan-700">ประเภทอุปกรณ์</p><h4 id="proc-kpi-types" class="text-2xl font-black text-cyan-900 mt-1">-</h4></div>\n                    <div class="bg-rose-50/70 border border-rose-100 rounded-2xl p-4"><p class="text-[10px] font-bold text-rose-700">ประเภทเร่งด่วน</p><h4 id="proc-kpi-priority" class="text-2xl font-black text-rose-900 mt-1">-</h4></div>\n                    <div class="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4"><p class="text-[10px] font-bold text-emerald-700">เสนอจัดเพิ่ม</p><h4 id="proc-kpi-add" class="text-2xl font-black text-emerald-900 mt-1">-</h4></div>\n                    <div class="bg-amber-50/70 border border-amber-100 rounded-2xl p-4"><p class="text-[10px] font-bold text-amber-700">เสนอทดแทน</p><h4 id="proc-kpi-replace" class="text-2xl font-black text-amber-900 mt-1">-</h4></div>\n                    <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4"><p class="text-[10px] font-bold text-slate-600">ควรทบทวนสต็อก</p><h4 id="proc-kpi-underused" class="text-2xl font-black text-slate-800 mt-1">-</h4></div>\n                </div>\n\n                <div class="bg-cyan-50/50 border border-cyan-100 rounded-2xl p-5">\n                    <h4 class="font-bold text-sm text-cyan-900 mb-3"><i class="fa-solid fa-lightbulb mr-1"></i> ข้อเสนอจากข้อมูล</h4>\n                    <div id="procurement-recommendations" class="space-y-2 text-xs text-cyan-900"><div class="text-gray-400">กำลังโหลด...</div></div>\n                </div>\n\n                <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">\n                    <div class="p-5 border-b border-gray-100">\n                        <h4 class="font-bold text-sm text-gray-800"><i class="fa-solid fa-list-ol text-cyan-600 mr-1"></i> ลำดับความสำคัญการจัดหา</h4>\n                        <p class="text-[11px] text-gray-400 mt-1">คะแนนเป็นเครื่องมือช่วยคัดกรองเบื้องต้น ควรพิจารณาร่วมกับงบประมาณ อายุครุภัณฑ์ และการตรวจสภาพจริง</p>\n                    </div>\n                    <div class="overflow-x-auto">\n                        <table class="w-full text-xs table-report">\n                            <thead class="bg-gray-50 text-gray-600"><tr><th class="p-3 text-left">ประเภทอุปกรณ์</th><th class="p-3 text-right">คลัง</th><th class="p-3 text-right">ยืมในช่วง</th><th class="p-3 text-right">ใช้งานปัจจุบัน</th><th class="p-3 text-right">ซ่อม/ตรวจ</th><th class="p-3 text-right">จัดเพิ่ม</th><th class="p-3 text-right">ทดแทน</th><th class="p-3 text-center">คะแนน</th><th class="p-3 text-left">ข้อเสนอ</th></tr></thead>\n                            <tbody id="procurement-plan-body"></tbody>\n                        </table>\n                    </div>\n                </div>\n\n                <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">\n                    <div class="p-5 border-b border-gray-100"><h4 class="font-bold text-sm text-gray-800"><i class="fa-solid fa-screwdriver-wrench text-amber-600 mr-1"></i> รายการเข้าข่ายประเมินทดแทนรายชิ้น</h4></div>\n                    <div class="overflow-x-auto"><table class="w-full text-xs table-report"><thead class="bg-gray-50"><tr><th class="p-3 text-left">รหัส</th><th class="p-3 text-left">ประเภท</th><th class="p-3 text-center">สถานะ</th><th class="p-3 text-right">เหตุการณ์ซ่อม/ตรวจ</th><th class="p-3 text-left">เหตุผล</th></tr></thead><tbody id="procurement-replacement-body"></tbody></table></div>\n                </div>\n            </section>\n\n'''
if 'sec-procurement' not in index:
    index=must_replace(index,map_section,proc_section+map_section,'procurement section')

# State/storage/font scale
js=must_replace(js,"    theme: 'medDevice.themeMode',\n    role: 'medDevice.role'","    theme: 'medDevice.themeMode',\n    fontScale: 'medDevice.fontScale',\n    role: 'medDevice.role'",'font storage key')
js=must_replace(js,"    managementAnalytics: null,\n    currentTab: 'dashboard'","    managementAnalytics: null,\n    procurementPlan: null,\n    currentTab: 'dashboard'",'procurement state')
js=must_replace(js,"    migrateLegacyStorage();\n    initThemeMode();","    migrateLegacyStorage();\n    initFontScale();\n    initThemeMode();",'init font scale')

font_js=r'''// 🔎 ปรับขนาดตัวอักษรทั้งระบบ พร้อมจดจำค่าบนเครื่องผู้ใช้
const FONT_SCALE_STEPS = [0.9, 1.0, 1.1, 1.2, 1.3];
function normalizeFontScale(value){
    const n=Number(value);
    if(!Number.isFinite(n))return 1;
    return FONT_SCALE_STEPS.reduce((best,x)=>Math.abs(x-n)<Math.abs(best-n)?x:best,1);
}
function initFontScale(){
    applyFontScale(normalizeFontScale(localStorage.getItem(STORAGE_KEYS.fontScale)||1));
}
function applyFontScale(scale){
    const v=normalizeFontScale(scale);
    document.documentElement.style.setProperty('--font-scale',String(v));
    localStorage.setItem(STORAGE_KEYS.fontScale,String(v));
    const label=document.getElementById('font-scale-label');
    if(label)label.textContent=Math.round(v*100)+'%';
}
function changeFontScale(direction){
    const current=normalizeFontScale(localStorage.getItem(STORAGE_KEYS.fontScale)||1);
    let idx=FONT_SCALE_STEPS.indexOf(current);
    idx=Math.max(0,Math.min(FONT_SCALE_STEPS.length-1,idx+Number(direction||0)));
    applyFontScale(FONT_SCALE_STEPS[idx]);
}
function resetFontScale(){ applyFontScale(1); }

'''
theme_anchor='// 🌗 ระบบสลับโหมดมืด/สว่าง (Dark / Light Mode) พร้อมจดจำค่าที่เลือกไว้ล่าสุด\n'
if 'FONT_SCALE_STEPS' not in js:
    js=must_replace(js,theme_anchor,font_js+theme_anchor,'font functions')

# Permissions / tab hook
js=must_replace(js,"    if (state.isAdmin && ['settings','analytics'].includes(tabId) && state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','เมนูนี้ใช้ได้เฉพาะ ADMIN','warning'); return; }",
                "    if (state.isAdmin && ['settings','analytics','procurement'].includes(tabId) && state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','เมนูนี้ใช้ได้เฉพาะ ADMIN','warning'); return; }",'procurement permission')
js=must_replace(js,"    if (tabId === 'analytics') {\n        loadManagementAnalytics();\n    }",
                "    if (tabId === 'analytics') {\n        loadManagementAnalytics();\n    }\n    if (tabId === 'procurement') {\n        loadProcurementPlan();\n    }",'procurement tab hook')

# Procurement JS before CSV export
anchor='function exportToCSV(sheetName) {'
proc_js=r'''function procurementActionBadge(action){
    const a=String(action||'');
    let cls='bg-slate-100 text-slate-700';
    if(a.includes('จัดหาเพิ่ม'))cls='bg-emerald-50 text-emerald-700 border border-emerald-100';
    else if(a.includes('ทดแทน'))cls='bg-amber-50 text-amber-700 border border-amber-100';
    else if(a==='เฝ้าระวัง')cls='bg-rose-50 text-rose-700 border border-rose-100';
    else if(a==='ทบทวนสต็อก')cls='bg-slate-100 text-slate-600 border border-slate-200';
    return `<span class="inline-flex px-2 py-1 rounded-full text-[10px] font-bold ${cls}">${escapeHtml(a||'เพียงพอ')}</span>`;
}

async function loadProcurementPlan(){
    if(state.role!=='ADMIN')return;
    const period=document.getElementById('procurement-period')?.value||'fy';
    const body=document.getElementById('procurement-plan-body');
    const repl=document.getElementById('procurement-replacement-body');
    const rec=document.getElementById('procurement-recommendations');
    if(body)body.innerHTML='<tr><td colspan="9" class="p-6 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังจัดทำแผน...</td></tr>';
    if(repl)repl.innerHTML='<tr><td colspan="5" class="p-6 text-center text-gray-400">กำลังโหลด...</td></tr>';
    if(rec)rec.innerHTML='<div class="text-gray-400">กำลังวิเคราะห์...</div>';
    const r=await run('getProcurementPlan',{period});
    if(!r||!r.success){
        const msg=String((r&&r.error)||'ไม่สามารถโหลดแผนจัดหาได้');
        if(body)body.innerHTML=`<tr><td colspan="9" class="p-6 text-center text-rose-600">${escapeHtml(msg)}${msg.includes('ไม่พบ Action')?'<br>กรุณา Deploy Backend v4.0.0 ก่อน':''}</td></tr>`;
        return;
    }
    state.procurementPlan=r;
    const s=r.summary||{};
    analyticsSetText('proc-kpi-types',Number(s.equipmentTypes||0).toLocaleString('th-TH'));
    analyticsSetText('proc-kpi-priority',Number(s.highPriorityTypes||0).toLocaleString('th-TH'));
    analyticsSetText('proc-kpi-add',Number(s.recommendedAddUnits||0).toLocaleString('th-TH')+' ชิ้น');
    analyticsSetText('proc-kpi-replace',Number(s.replacementUnits||0).toLocaleString('th-TH')+' ชิ้น');
    analyticsSetText('proc-kpi-underused',Number(s.underusedTypes||0).toLocaleString('th-TH'));
    analyticsSetText('procurement-period-label',analyticsPeriodText(r.period));
    const rows=r.plan||[];
    if(body)body.innerHTML=rows.length?rows.map(x=>`<tr class="border-t border-gray-100 hover:bg-gray-50/60"><td class="p-3"><div class="font-bold text-gray-800">${escapeHtml(x.equipmentName||'-')}</div><div class="text-[10px] text-gray-400 mt-1">${escapeHtml(x.reason||'')}</div></td><td class="p-3 text-right">${Number(x.stock||0)}</td><td class="p-3 text-right font-bold text-indigo-700">${Number(x.borrowCount||0)}</td><td class="p-3 text-right">${Number(x.snapshotUtilization||0).toFixed(1)}%</td><td class="p-3 text-right">${Number(x.repairEvents||0)}</td><td class="p-3 text-right font-bold text-emerald-700">${Number(x.recommendedAdd||0)}</td><td class="p-3 text-right font-bold text-amber-700">${Number(x.replacementCandidates||0)}</td><td class="p-3 text-center"><span class="font-black ${Number(x.priorityScore||0)>=60?'text-rose-600':Number(x.priorityScore||0)>=40?'text-amber-600':'text-slate-600'}">${Number(x.priorityScore||0)}</span></td><td class="p-3">${procurementActionBadge(x.action)}</td></tr>`).join(''):'<tr><td colspan="9" class="p-6 text-center text-gray-400">ไม่มีข้อมูลสำหรับช่วงที่เลือก</td></tr>';
    const rr=r.replacementCandidates||[];
    if(repl)repl.innerHTML=rr.length?rr.map(x=>`<tr class="border-t border-gray-100"><td class="p-3 font-mono font-bold">${escapeHtml(x.equipmentId||'-')}</td><td class="p-3">${escapeHtml(x.equipmentName||'-')}</td><td class="p-3 text-center">${escapeHtml(getEquipmentLifecycleMeta(x.currentStatus||'Available').label)}</td><td class="p-3 text-right font-bold">${Number(x.eventCount||0)}</td><td class="p-3">${escapeHtml(x.reason||'-')}</td></tr>`).join(''):'<tr><td colspan="5" class="p-6 text-center text-gray-400">ยังไม่มีอุปกรณ์เข้าข่ายทดแทนจากข้อมูลที่บันทึก</td></tr>';
    if(rec)rec.innerHTML=(r.recommendations||[]).map((x,i)=>`<div class="flex gap-2"><span class="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold flex-shrink-0">${i+1}</span><span>${escapeHtml(x)}</span></div>`).join('')||'<div>ยังไม่มีข้อเสนอเพิ่มเติม</div>';
}

'''
if 'function loadProcurementPlan()' not in js:
    js=must_replace(js,anchor,proc_js+anchor,'procurement JS')

# CSS font scale + controls
css=css.replace('  --sidebar-w-collapsed:5rem;','  --sidebar-w-collapsed:5rem;\n  --font-scale:1;',1)
repls={
'.text-\\[9px\\]{ font-size:10px !important; }':'.text-\\[9px\\]{ font-size:calc(10px * var(--font-scale)) !important; }',
'.text-\\[10px\\]{ font-size:11.5px !important; }':'.text-\\[10px\\]{ font-size:calc(11.5px * var(--font-scale)) !important; }',
'.text-\\[11px\\]{ font-size:12.5px !important; }':'.text-\\[11px\\]{ font-size:calc(12.5px * var(--font-scale)) !important; }',
'.text-xs{ font-size:13.5px !important; line-height:1.55 !important; }':'.text-xs{ font-size:calc(13.5px * var(--font-scale)) !important; line-height:1.55 !important; }',
'.text-sm{ font-size:15px !important; line-height:1.6 !important; }':'.text-sm{ font-size:calc(15px * var(--font-scale)) !important; line-height:1.6 !important; }',
'.text-base{ font-size:16.5px !important; }':'.text-base{ font-size:calc(16.5px * var(--font-scale)) !important; }',
'.text-lg{ font-size:19px !important; }':'.text-lg{ font-size:calc(19px * var(--font-scale)) !important; }',
'.text-xl{ font-size:21px !important; }':'.text-xl{ font-size:calc(21px * var(--font-scale)) !important; }',
'.text-2xl{ font-size:25px !important; }':'.text-2xl{ font-size:calc(25px * var(--font-scale)) !important; }',
'.text-3xl{ font-size:31px !important; }':'.text-3xl{ font-size:calc(31px * var(--font-scale)) !important; }'
}
for a,b in repls.items(): css=must_replace(css,a,b,'font css '+a)
font_css='''\n/* ---------- accessibility font scale control ---------- */\nbody.font-sarabun{ font-size:calc(16px * var(--font-scale)); }\n.font-scale-control{ min-height:36px; box-shadow:0 1px 2px rgba(15,23,42,.04); }\n.font-scale-btn,.font-scale-label{ height:36px; display:flex; align-items:center; justify-content:center; border:0; background:#fff; color:#475569; font-weight:800; transition:background .15s ease,color .15s ease; }\n.font-scale-btn{ min-width:38px; padding:0 9px; font-size:13px; }\n.font-scale-label{ min-width:52px; padding:0 8px; font-size:11px; border-left:1px solid #e5e7eb; border-right:1px solid #e5e7eb; }\n.font-scale-btn:hover,.font-scale-label:hover{ background:#eef2ff; color:#4338ca; }\n@media (max-width:640px){ .font-scale-label{ display:none; } .font-scale-btn{ min-width:34px; padding:0 7px; } #font-scale-control{ border-radius:10px; } }\nhtml[data-theme="dark"] .font-scale-control,html[data-theme="dark"] .font-scale-btn,html[data-theme="dark"] .font-scale-label{ background:var(--app-surface-2); color:var(--app-text); border-color:var(--app-border); }\n'''
if 'accessibility font scale control' not in css:
    css=must_replace(css,'/* ---------- theme toggle ---------- */',font_css+'\n/* ---------- theme toggle ---------- */','font control css')

# strip trailing whitespace to satisfy CI
index='\n'.join(line.rstrip() for line in index.splitlines())+'\n'
js='\n'.join(line.rstrip() for line in js.splitlines())+'\n'
css='\n'.join(line.rstrip() for line in css.splitlines())+'\n'
idx.write_text(index,encoding='utf-8')
jsf.write_text(js,encoding='utf-8')
cssf.write_text(css,encoding='utf-8')
print('patched frontend to v4.0.0 procurement + accessibility')
