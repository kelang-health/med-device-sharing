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
index=index.replace('style.css?v=3.8.0','style.css?v=3.9.0',1)
index=index.replace('script.js?v=3.8.0','script.js?v=3.9.0',1)
index=index.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.8.0 |','ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.9.0 |',1)
js=js.replace('Frontend Controller API (v3.8.0 Equipment Lifecycle)','Frontend Controller API (v3.9.0 Management Analytics)',1)
js=js.replace("${badge(eventCount>0,'เหตุการณ์ทันที: '+eventCount+'/6')}","${badge(eventCount>0,'เหตุการณ์ทันที: '+eventCount+'/7')}",1)

# Sidebar analytics menu
map_anchor='''                <button onclick="switchTab('map')" id="btn-menu-map" class="menu-item w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all">'''
analytics_menu='''                <button onclick="switchTab('analytics')" id="btn-menu-analytics" class="admin-role-only menu-item w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all">\n                    <i class="fa-solid fa-chart-line text-lg text-violet-500 w-6 text-center"></i> \n                    <span class="menu-text transition-all duration-200">วิเคราะห์การใช้งาน</span>\n                </button>\n'''
if 'btn-menu-analytics' not in index:
    index=must_replace(index,map_anchor,analytics_menu+map_anchor,'analytics menu anchor')

# Analytics section before map
map_section='''            <section id="sec-map" class="app-view space-y-6 hidden">'''
analytics_section='''            <section id="sec-analytics" class="app-view space-y-6 hidden">\n                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">\n                    <div>\n                        <h3 class="text-base font-bold text-gray-800 flex items-center gap-2"><i class="fa-solid fa-chart-line text-violet-500"></i> วิเคราะห์การใช้งานและบริหารอุปกรณ์</h3>\n                        <p class="text-xs text-gray-400 mt-1">สรุปจาก BorrowLog, Equipments และ AuditLog โดยไม่แสดงข้อมูลส่วนบุคคลของผู้รับบริการ</p>\n                    </div>\n                    <div class="flex flex-col sm:flex-row gap-2">\n                        <select id="analytics-period" onchange="loadManagementAnalytics()" class="border border-gray-200 bg-white px-3 py-2 rounded-xl text-xs focus:outline-none">\n                            <option value="fy">ปีงบประมาณปัจจุบัน</option>\n                            <option value="12m">12 เดือนล่าสุด</option>\n                            <option value="90d">90 วันล่าสุด</option>\n                            <option value="all">ประวัติทั้งหมด</option>\n                        </select>\n                        <button onclick="loadManagementAnalytics()" class="bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-2 rounded-xl text-xs font-bold"><i class="fa-solid fa-rotate mr-1"></i> รีเฟรช</button>\n                        <button onclick="window.print()" class="bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold"><i class="fa-solid fa-print mr-1"></i> พิมพ์</button>\n                    </div>\n                </div>\n                <div id="analytics-period-label" class="text-[11px] text-gray-400"></div>\n\n                <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">\n                    <div class="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4"><p class="text-[10px] font-bold text-indigo-600">รายการยืมในช่วง</p><h4 id="analytics-kpi-records" class="text-2xl font-black text-indigo-900 mt-1">-</h4></div>\n                    <div class="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4"><p class="text-[10px] font-bold text-emerald-600">อัตราใช้งานปัจจุบัน</p><h4 id="analytics-kpi-util" class="text-2xl font-black text-emerald-900 mt-1">-</h4></div>\n                    <div class="bg-rose-50/70 border border-rose-100 rounded-2xl p-4"><p class="text-[10px] font-bold text-rose-600">เกินกำหนดปัจจุบัน</p><h4 id="analytics-kpi-overdue" class="text-2xl font-black text-rose-900 mt-1">-</h4></div>\n                    <div class="bg-sky-50/70 border border-sky-100 rounded-2xl p-4"><p class="text-[10px] font-bold text-sky-600">ระยะยืมเฉลี่ย</p><h4 id="analytics-kpi-days" class="text-2xl font-black text-sky-900 mt-1">-</h4></div>\n                    <div class="bg-amber-50/70 border border-amber-100 rounded-2xl p-4"><p class="text-[10px] font-bold text-amber-600">อุปกรณ์ถูกใช้งาน</p><h4 id="analytics-kpi-reach" class="text-2xl font-black text-amber-900 mt-1">-</h4></div>\n                    <div class="bg-violet-50/70 border border-violet-100 rounded-2xl p-4"><p class="text-[10px] font-bold text-violet-600">อัตรายืมต่อ</p><h4 id="analytics-kpi-extension" class="text-2xl font-black text-violet-900 mt-1">-</h4></div>\n                </div>\n\n                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">\n                    <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">\n                        <h4 class="font-bold text-sm text-gray-800 mb-3"><i class="fa-solid fa-chart-column text-indigo-500 mr-1"></i> แนวโน้มยืม-คืนรายเดือน</h4>\n                        <div id="analytics-monthly" class="space-y-2 text-xs"><div class="text-gray-400">กำลังโหลด...</div></div>\n                    </div>\n                    <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">\n                        <h4 class="font-bold text-sm text-gray-800 mb-3"><i class="fa-solid fa-boxes-stacked text-emerald-500 mr-1"></i> สถานะอุปกรณ์ปัจจุบัน</h4>\n                        <div id="analytics-lifecycle" class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs"><div class="text-gray-400">กำลังโหลด...</div></div>\n                    </div>\n                </div>\n\n                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">\n                    <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 overflow-hidden">\n                        <h4 class="font-bold text-sm text-gray-800 mb-3"><i class="fa-solid fa-ranking-star text-amber-500 mr-1"></i> Top อุปกรณ์ที่ถูกยืม</h4>\n                        <div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-gray-50"><tr><th class="p-2 text-left">อุปกรณ์</th><th class="p-2 text-right">ครั้ง</th><th class="p-2 text-right">เฉลี่ยวัน/ครั้ง</th></tr></thead><tbody id="analytics-top-equipment"></tbody></table></div>\n                    </div>\n                    <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">\n                        <h4 class="font-bold text-sm text-gray-800 mb-3"><i class="fa-solid fa-location-dot text-rose-500 mr-1"></i> ความต้องการตามชุมชน</h4>\n                        <div id="analytics-communities" class="space-y-2 text-xs"></div>\n                    </div>\n                </div>\n\n                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">\n                    <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 overflow-hidden">\n                        <h4 class="font-bold text-sm text-gray-800 mb-3"><i class="fa-solid fa-screwdriver-wrench text-orange-500 mr-1"></i> อุปกรณ์ที่มีเหตุการณ์ซ่อม/ตรวจสภาพ</h4>\n                        <div class="overflow-x-auto"><table class="w-full text-xs"><thead class="bg-gray-50"><tr><th class="p-2 text-left">อุปกรณ์</th><th class="p-2 text-right">เหตุการณ์</th><th class="p-2 text-right">ส่งซ่อม</th><th class="p-2 text-right">ชำรุด</th></tr></thead><tbody id="analytics-repairs"></tbody></table></div>\n                    </div>\n                    <div class="bg-violet-50/50 border border-violet-100 rounded-2xl shadow-sm p-5">\n                        <h4 class="font-bold text-sm text-violet-900 mb-3"><i class="fa-solid fa-lightbulb text-violet-600 mr-1"></i> ข้อเสนอเชิงบริหารจากข้อมูล</h4>\n                        <div id="analytics-recommendations" class="space-y-2 text-xs text-violet-900"></div>\n                    </div>\n                </div>\n            </section>\n\n'''
if 'sec-analytics' not in index:
    index=must_replace(index,map_section,analytics_section+map_section,'analytics section anchor')

# State + permissions + tab hook
js=must_replace(js,"    publicSummary: null,\n    currentTab: 'dashboard'","    publicSummary: null,\n    managementAnalytics: null,\n    currentTab: 'dashboard'",'analytics state')
js=must_replace(js,"    if (state.isAdmin && tabId === 'settings' && state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','เมนูตั้งค่าระบบใช้ได้เฉพาะ ADMIN','warning'); return; }",
                "    if (state.isAdmin && ['settings','analytics'].includes(tabId) && state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','เมนูนี้ใช้ได้เฉพาะ ADMIN','warning'); return; }",'analytics permission')
js=must_replace(js,"    if (tabId === 'settings') {\n        loadAdminUsersSection();",
                "    if (tabId === 'analytics') {\n        loadManagementAnalytics();\n    }\n    if (tabId === 'settings') {\n        loadAdminUsersSection();",'analytics tab hook')

# Analytics JS before CSV export
anchor='function exportToCSV(sheetName) {'
analytics_js=r'''function analyticsSetText(id,value){const el=document.getElementById(id);if(el)el.textContent=value;}

function analyticsMonthLabel(key){
    const p=String(key||'').split('-');
    if(p.length!==2)return key||'-';
    const d=new Date(Number(p[0]),Number(p[1])-1,1);
    return d.toLocaleDateString('th-TH',{month:'short',year:'2-digit'});
}

function analyticsPeriodText(period){
    if(!period)return '';
    if(!period.start)return 'ช่วงข้อมูล: ประวัติทั้งหมดจนถึงปัจจุบัน';
    const a=new Date(period.start),b=new Date(period.end);
    const f=d=>Number.isNaN(d.getTime())?'-':d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
    return `ช่วงข้อมูล: ${f(a)} – ${f(b)}`;
}

async function loadManagementAnalytics(){
    if(state.role!=='ADMIN')return;
    const period=document.getElementById('analytics-period')?.value||'fy';
    ['analytics-monthly','analytics-lifecycle','analytics-communities','analytics-recommendations'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='<div class="text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังวิเคราะห์ข้อมูล...</div>';});
    const top=document.getElementById('analytics-top-equipment');if(top)top.innerHTML='<tr><td colspan="3" class="p-4 text-center text-gray-400">กำลังโหลด...</td></tr>';
    const repairs=document.getElementById('analytics-repairs');if(repairs)repairs.innerHTML='<tr><td colspan="4" class="p-4 text-center text-gray-400">กำลังโหลด...</td></tr>';
    const r=await run('getManagementAnalytics',{period});
    if(!r||!r.success){
        const msg=String((r&&r.error)||'ไม่สามารถโหลด Management Analytics ได้');
        const box=document.getElementById('analytics-recommendations');if(box)box.innerHTML=`<div class="text-rose-600">${escapeHtml(msg)}${msg.includes('ไม่พบ Action')?'<br>กรุณา Deploy Backend v3.9.0 ก่อน':''}</div>`;
        return;
    }
    state.managementAnalytics=r;
    const k=r.kpi||{};
    analyticsSetText('analytics-kpi-records',Number(k.recordsInPeriod||0).toLocaleString('th-TH'));
    analyticsSetText('analytics-kpi-util',`${Number(k.currentUtilizationRate||0).toFixed(1)}%`);
    analyticsSetText('analytics-kpi-overdue',`${Number(k.currentOverdue||0)} (${Number(k.overdueRate||0).toFixed(1)}%)`);
    analyticsSetText('analytics-kpi-days',`${Number(k.avgLoanDays||0).toFixed(1)} วัน`);
    analyticsSetText('analytics-kpi-reach',`${Number(k.equipmentReachRate||0).toFixed(1)}%`);
    analyticsSetText('analytics-kpi-extension',`${Number(k.extensionRate||0).toFixed(1)}%`);
    analyticsSetText('analytics-period-label',analyticsPeriodText(r.period));
    renderManagementMonthly(r.monthlyTrend||[]);
    renderManagementLifecycle(r.lifecycleSummary||{});
    renderManagementTopEquipment(r.topEquipment||[]);
    renderManagementCommunities(r.topCommunities||[]);
    renderManagementRepairs(r.repairEquipment||[]);
    renderManagementRecommendations(r.recommendations||[]);
}

function renderManagementMonthly(rows){
    const box=document.getElementById('analytics-monthly');if(!box)return;
    if(!rows.length){box.innerHTML='<div class="text-gray-400">ยังไม่มีข้อมูลในช่วงที่เลือก</div>';return;}
    const max=Math.max(1,...rows.map(x=>Math.max(Number(x.borrowCount||0),Number(x.returnCount||0))));
    box.innerHTML=rows.map(x=>{const b=Number(x.borrowCount||0),r=Number(x.returnCount||0);return `<div class="grid grid-cols-12 gap-2 items-center"><div class="col-span-2 text-[10px] text-gray-500">${escapeHtml(analyticsMonthLabel(x.month))}</div><div class="col-span-8 space-y-1"><div class="h-2 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-indigo-400 rounded-full" style="width:${Math.max(2,b/max*100)}%"></div></div><div class="h-2 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-emerald-400 rounded-full" style="width:${Math.max(2,r/max*100)}%"></div></div></div><div class="col-span-2 text-right text-[10px]"><span class="text-indigo-600">ยืม ${b}</span><br><span class="text-emerald-600">คืน ${r}</span></div></div>`;}).join('');
}

function renderManagementLifecycle(data){
    const box=document.getElementById('analytics-lifecycle');if(!box)return;
    const order=['Available','Borrowed','Cleaning','Inspection','Maintenance','Damaged','Lost','Retired','Inactive'];
    const labels={Available:'พร้อมใช้',Borrowed:'กำลังยืม',Cleaning:'ทำความสะอาด',Inspection:'รอตรวจ',Maintenance:'ส่งซ่อม',Damaged:'ชำรุด',Lost:'สูญหาย',Retired:'ปลดระวาง',Inactive:'ปิดใช้งาน'};
    box.innerHTML=order.map(k=>`<div class="border border-gray-100 rounded-xl p-3 bg-gray-50/50"><div class="text-[10px] text-gray-500">${labels[k]}</div><div class="text-xl font-black text-gray-800">${Number(data[k]||0)}</div></div>`).join('');
}

function renderManagementTopEquipment(rows){
    const body=document.getElementById('analytics-top-equipment');if(!body)return;
    if(!rows.length){body.innerHTML='<tr><td colspan="3" class="p-4 text-center text-gray-400">ยังไม่มีข้อมูล</td></tr>';return;}
    body.innerHTML=rows.map((x,i)=>{const avg=Number(x.returnedCount||0)>0?Number(x.totalLoanDays||0)/Number(x.returnedCount):0;return `<tr class="border-t border-gray-100"><td class="p-2"><span class="font-bold text-gray-700">${i+1}. ${escapeHtml(x.equipmentName||x.equipmentId)}</span><br><span class="text-[10px] text-gray-400">${escapeHtml(x.equipmentId||'')}</span></td><td class="p-2 text-right font-bold">${Number(x.borrowCount||0)}</td><td class="p-2 text-right">${avg.toFixed(1)}</td></tr>`;}).join('');
}

function renderManagementCommunities(rows){
    const box=document.getElementById('analytics-communities');if(!box)return;
    if(!rows.length){box.innerHTML='<div class="text-gray-400">ยังไม่มีข้อมูล</div>';return;}
    const max=Math.max(1,...rows.map(x=>Number(x.borrowCount||0)));
    box.innerHTML=rows.map((x,i)=>{const n=Number(x.borrowCount||0);return `<div><div class="flex justify-between gap-2 mb-1"><span class="truncate text-gray-700">${i+1}. ${escapeHtml(x.community||'ไม่ระบุ')}</span><span class="font-bold">${n} ครั้ง</span></div><div class="h-2 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-rose-400 rounded-full" style="width:${Math.max(2,n/max*100)}%"></div></div></div>`;}).join('');
}

function renderManagementRepairs(rows){
    const body=document.getElementById('analytics-repairs');if(!body)return;
    if(!rows.length){body.innerHTML='<tr><td colspan="4" class="p-4 text-center text-gray-400">ยังไม่พบเหตุการณ์ซ่อม/ตรวจสภาพในช่วงที่เลือก</td></tr>';return;}
    body.innerHTML=rows.map(x=>`<tr class="border-t border-gray-100"><td class="p-2"><span class="font-bold text-gray-700">${escapeHtml(x.equipmentName||x.equipmentId)}</span><br><span class="text-[10px] text-gray-400">${escapeHtml(x.equipmentId||'')}</span></td><td class="p-2 text-right font-bold">${Number(x.eventCount||0)}</td><td class="p-2 text-right">${Number(x.maintenanceCount||0)}</td><td class="p-2 text-right">${Number(x.damagedCount||0)}</td></tr>`).join('');
}

function renderManagementRecommendations(rows){
    const box=document.getElementById('analytics-recommendations');if(!box)return;
    box.innerHTML=(rows.length?rows:['ยังไม่มีข้อเสนอจากข้อมูล']).map((x,i)=>`<div class="flex gap-2 bg-white/70 border border-violet-100 rounded-xl p-3"><span class="font-black text-violet-600">${i+1}</span><span>${escapeHtml(x)}</span></div>`).join('');
}

'''
if 'function loadManagementAnalytics()' not in js:
    js=must_replace(js,anchor,analytics_js+anchor,'analytics JS anchor')

idx.write_text(index,encoding='utf-8')
jsf.write_text(js,encoding='utf-8')
print('patched frontend to v3.9.0 management analytics')