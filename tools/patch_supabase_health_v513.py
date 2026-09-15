from pathlib import Path

idx = Path('index.html')
html = idx.read_text(encoding='utf-8')
marker = '<div id="maintenance-status" class="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600">กำลังตรวจสอบ...</div>'
panel = marker + r'''

                    <div class="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h5 class="font-bold text-xs text-emerald-800 flex items-center gap-2"><i class="fa-solid fa-heart-pulse"></i> Supabase System Health</h5>
                                <p class="text-[10px] text-emerald-700/70 mt-1">ตรวจฐานข้อมูล, Auth, Storage, ความสอดคล้องของรายการยืม, รูปหลักฐาน และ Backup โดยไม่แสดงข้อมูลส่วนบุคคล</p>
                            </div>
                            <button type="button" onclick="loadSupabaseHealthStatus(true)" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap"><i class="fa-solid fa-stethoscope mr-1"></i> ตรวจ Supabase</button>
                        </div>
                        <div id="supabase-health-overall" class="mt-3 rounded-xl border border-emerald-100 bg-white p-3 text-[11px] text-gray-600">รอตรวจสอบ...</div>
                        <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                            <div class="bg-white border border-gray-100 rounded-xl p-2"><div class="text-[9px] text-gray-400">Database</div><div id="health-db" class="font-bold text-xs">-</div></div>
                            <div class="bg-white border border-gray-100 rounded-xl p-2"><div class="text-[9px] text-gray-400">Storage</div><div id="health-storage" class="font-bold text-xs">-</div></div>
                            <div class="bg-white border border-gray-100 rounded-xl p-2"><div class="text-[9px] text-gray-400">Auth</div><div id="health-auth" class="font-bold text-xs">-</div></div>
                            <div class="bg-white border border-gray-100 rounded-xl p-2"><div class="text-[9px] text-gray-400">รายการยืมค้าง</div><div id="health-active-borrows" class="font-black text-base">-</div></div>
                            <div class="bg-white border border-gray-100 rounded-xl p-2"><div class="text-[9px] text-gray-400">รูปใน Storage</div><div id="health-images" class="font-black text-base">-</div></div>
                            <div class="bg-white border border-gray-100 rounded-xl p-2"><div class="text-[9px] text-gray-400">Response</div><div id="health-latency" class="font-black text-base">-</div></div>
                        </div>
                        <div id="supabase-health-issues" class="mt-3 text-[10px] text-gray-600"></div>
                        <div id="supabase-health-history" class="mt-3 border-t border-emerald-100 pt-3 text-[10px] text-gray-500"></div>
                    </div>'''
if marker not in html:
    raise SystemExit('maintenance marker not found')
if 'id="supabase-health-overall"' not in html:
    html = html.replace(marker, panel, 1)
html = html.replace('script.js?v=5.1.2', 'script.js?v=5.1.3')
idx.write_text(html, encoding='utf-8')

jsf = Path('script.js')
js = jsf.read_text(encoding='utf-8')
js = js.replace('v5.1.2 Supabase Full Parity', 'v5.1.3 Supabase Health Monitoring')
needle = 'const ANALYTICS_API_URL = "https://txjuiaiwffsxfcrxpkvd.supabase.co/functions/v1/med-device-analytics-v51";'
if 'SUPABASE_HEALTH_API_URL' not in js:
    js = js.replace(needle, needle + '\nconst SUPABASE_HEALTH_API_URL = "https://txjuiaiwffsxfcrxpkvd.supabase.co/functions/v1/med-device-health-v512";', 1)
settings_old = "        loadMaintenanceStatus();\n        loadMaintenanceLog();\n        loadLineConfigStatus();"
settings_new = "        loadMaintenanceStatus();\n        loadSupabaseHealthStatus(false);\n        loadMaintenanceLog();\n        loadLineConfigStatus();"
if 'loadSupabaseHealthStatus(false);' not in js:
    if settings_old not in js:
        raise SystemExit('settings hook not found')
    js = js.replace(settings_old, settings_new, 1)

health_code = r'''
let __supabaseHealthLastAt = 0;
let __supabaseHealthLoading = false;

async function requestSupabaseHealth(retry=true){
    const token=getSessionToken();
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),45000);
    try{
        const response=await fetch(SUPABASE_HEALTH_API_URL,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({payload:{token}}),signal:controller.signal});
        const text=await response.text();
        let data={};try{data=JSON.parse(text||'{}');}catch(_){return {success:false,error:'Health API ตอบกลับไม่ใช่ JSON'};}
        if((response.status===401||data.needLogin)&&retry){
            await run('getMaintenanceStatus',{});
            return requestSupabaseHealth(false);
        }
        return data;
    }catch(e){
        return {success:false,error:e&&e.name==='AbortError'?'ตรวจ Supabase ใช้เวลานานเกิน 45 วินาที':String(e&&e.message||e)};
    }finally{clearTimeout(timeout);}
}

function healthDateText(v){
    if(!v)return '-';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);
    return d.toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'});
}

async function loadSupabaseHealthStatus(force=false){
    if(state.role!=='ADMIN')return;
    const box=document.getElementById('supabase-health-overall');if(!box)return;
    const now=Date.now();if(!force&&__supabaseHealthLastAt&&now-__supabaseHealthLastAt<60000)return;
    if(__supabaseHealthLoading)return;__supabaseHealthLoading=true;
    box.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังตรวจ Database / Auth / Storage / Integrity...';
    try{
        const r=await requestSupabaseHealth();
        if(!r||!r.success){box.innerHTML=`<span class="text-rose-700"><i class="fa-solid fa-circle-xmark mr-1"></i>${escapeHtml((r&&r.error)||'ตรวจ Supabase ไม่สำเร็จ')}</span>`;return;}
        __supabaseHealthLastAt=Date.now();
        const status=String(r.overallStatus||'WARNING').toUpperCase();
        const meta=status==='HEALTHY'?['ปกติ','text-emerald-700','bg-emerald-50 border-emerald-200','fa-circle-check']:status==='CRITICAL'?['ผิดปกติรุนแรง','text-rose-700','bg-rose-50 border-rose-200','fa-circle-xmark']:['ควรตรวจสอบ','text-amber-700','bg-amber-50 border-amber-200','fa-triangle-exclamation'];
        box.className=`mt-3 rounded-xl border p-3 text-[11px] ${meta[2]} ${meta[1]}`;
        box.innerHTML=`<div class="font-bold"><i class="fa-solid ${meta[3]} mr-1"></i>Supabase: ${meta[0]}</div><div class="mt-1 text-[10px] opacity-80">ตรวจล่าสุด ${healthDateText(r.checkedAt)} • ใช้เวลา ${Number(r.latencyMs||0).toLocaleString('th-TH')} ms • Health v${escapeHtml(r.version||'-')}</div>`;
        const set=(id,txt,cls='')=>{const e=document.getElementById(id);if(e){e.textContent=txt;e.className='font-bold text-xs '+cls;}};
        set('health-db',r.database&&r.database.writeTest?'อ่าน/เขียน OK':'ตรวจเขียนไม่ผ่าน',r.database&&r.database.writeTest?'text-emerald-700':'text-rose-700');
        set('health-storage',r.storage&&r.storage.evidenceBucketPrivate&&r.storage.backupBucketPrivate?'Private OK':'ตรวจสิทธิ์','text-emerald-700');
        set('health-auth',`${Number(r.auth&&r.auth.activeUsers||0)} ผู้ใช้ / ADMIN ${Number(r.auth&&r.auth.activeAdmins||0)}`,'text-indigo-700');
        const c=r.counts||{};
        const ab=document.getElementById('health-active-borrows');if(ab)ab.textContent=Number(c.activeBorrows||0).toLocaleString('th-TH');
        const im=document.getElementById('health-images');if(im)im.textContent=`${Number(c.evidenceFiles||0).toLocaleString('th-TH')} (${(Number(c.evidenceBytes||0)/1048576).toFixed(1)} MB)`;
        const lt=document.getElementById('health-latency');if(lt)lt.textContent=`${Number(r.latencyMs||0).toLocaleString('th-TH')} ms`;
        const issues=document.getElementById('supabase-health-issues');
        const rows=Array.isArray(r.issues)?r.issues:[];
        if(issues)issues.innerHTML=rows.length?`<div class="font-bold mb-1">ข้อที่ต้องตรวจ ${rows.length} จุด</div>`+rows.map(x=>`<div class="py-1 border-b border-gray-100"><span class="font-bold ${x.level==='CRITICAL'?'text-rose-600':'text-amber-600'}">${escapeHtml(x.level)}</span> • ${escapeHtml(x.message)}${x.value!==null&&x.value!==undefined?` <span class="text-gray-400">(${escapeHtml(typeof x.value==='object'?JSON.stringify(x.value):x.value)})</span>`:''}</div>`).join(''):'<div class="text-emerald-700 font-bold"><i class="fa-solid fa-shield-check mr-1"></i>ไม่พบความผิดปกติของข้อมูลและ Storage</div>';
        const hist=document.getElementById('supabase-health-history');
        if(hist){const h=Array.isArray(r.recent)?r.recent:[];hist.innerHTML='<div class="font-bold text-gray-600 mb-1">ประวัติ Health Check ล่าสุด</div>'+h.slice(0,5).map(x=>`<div class="flex justify-between gap-2 py-0.5"><span>${healthDateText(x.checked_at)}</span><span class="font-bold ${x.overall_status==='HEALTHY'?'text-emerald-600':x.overall_status==='CRITICAL'?'text-rose-600':'text-amber-600'}">${escapeHtml(x.overall_status)} • ${Number(x.latency_ms||0)} ms</span></div>`).join('');}
    }finally{__supabaseHealthLoading=false;}
}

'''
if 'async function requestSupabaseHealth' not in js:
    marker_js = 'async function loadMaintenanceStatus(){'
    if marker_js not in js:
        raise SystemExit('maintenance function marker not found')
    js = js.replace(marker_js, health_code + marker_js, 1)
jsf.write_text(js, encoding='utf-8')
print('patched v5.1.3 Supabase health monitoring')
