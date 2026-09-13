from pathlib import Path
import re

VERSION='3.7.0'

# ---------- index.html ----------
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('style.css?v=3.6.7', f'style.css?v={VERSION}')
s=s.replace('script.js?v=3.6.7', f'script.js?v={VERSION}')
s=s.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.6.7 |', f'ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v{VERSION} |')

anchor='''                    <div class="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-[11px] text-emerald-800 leading-5">\n                        <b>ตั้งค่าครั้งแรก 2 ระยะ:</b>'''
if anchor not in s:
    raise SystemExit('LINE guide anchor not found')

event_html='''                    <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">\n                        <div class="flex items-center justify-between gap-3 mb-3">\n                            <div>\n                                <div class="text-xs font-bold text-gray-700"><i class="fa-solid fa-bell mr-1 text-emerald-600"></i> แจ้งเตือนเหตุการณ์ทันที</div>\n                                <p class="text-[10px] text-gray-400 mt-0.5">เลือกเหตุการณ์ที่ต้องการให้ LINE OA แจ้งทันที โดยไม่ส่งชื่อผู้ป่วยหรือข้อมูลส่วนบุคคล</p>\n                            </div>\n                        </div>\n                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">\n                            <label class="flex items-center gap-2 rounded-lg border border-white bg-white p-2.5 cursor-pointer"><input id="line-event-borrow" type="checkbox" class="accent-emerald-600 h-4 w-4"> มีการยืมใหม่</label>\n                            <label class="flex items-center gap-2 rounded-lg border border-white bg-white p-2.5 cursor-pointer"><input id="line-event-return" type="checkbox" class="accent-emerald-600 h-4 w-4"> มีการคืน</label>\n                            <label class="flex items-center gap-2 rounded-lg border border-white bg-white p-2.5 cursor-pointer"><input id="line-event-extend" type="checkbox" class="accent-emerald-600 h-4 w-4"> มีการยืมต่อ</label>\n                            <label class="flex items-center gap-2 rounded-lg border border-white bg-white p-2.5 cursor-pointer"><input id="line-event-eq-add" type="checkbox" class="accent-emerald-600 h-4 w-4"> มีการเพิ่มอุปกรณ์</label>\n                            <label class="flex items-center gap-2 rounded-lg border border-white bg-white p-2.5 cursor-pointer"><input id="line-event-void" type="checkbox" class="accent-emerald-600 h-4 w-4"> มีการ VOID รายการยืม</label>\n                            <label class="flex items-center gap-2 rounded-lg border border-white bg-white p-2.5 cursor-pointer"><input id="line-event-eq-inactive" type="checkbox" class="accent-emerald-600 h-4 w-4"> มีการปิดใช้งานอุปกรณ์</label>\n                        </div>\n                    </div>\n\n'''
s=s.replace(anchor,event_html+anchor,1)

old_auto=re.compile(r'''                    <div class="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-3">.*?                    </div>\n                </div>''',re.S)
new_auto='''                    <div class="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4">\n                        <div class="text-[11px] font-bold text-gray-700 mb-2"><i class="fa-solid fa-clock mr-1 text-amber-600"></i> สรุปติดตามอัตโนมัติรายวัน</div>\n                        <p class="text-[10px] text-gray-400 mb-3">สรุป: เกินกำหนด, ครบใน 0–7 / 8–14 / 15–30 วัน และรายการยืมต่อ ≥3 ครั้ง</p>\n                        <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">\n                            <label class="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 cursor-pointer">\n                                <input id="line-daily-enabled" type="checkbox" class="accent-amber-600 h-4 w-4"> เปิดสรุปรายวัน\n                            </label>\n                            <select id="line-daily-hour" class="border border-gray-200 bg-white px-3 py-2.5 rounded-xl text-xs font-bold"></select>\n                            <select id="line-daily-minute" class="border border-gray-200 bg-white px-3 py-2.5 rounded-xl text-xs font-bold">\n                                <option value="0">:00</option><option value="15">:15</option><option value="30">:30</option><option value="45">:45</option>\n                            </select>\n                        </div>\n                        <p class="text-[10px] text-gray-400 mt-2">Google Apps Script อาจรันใกล้เวลาที่เลือกประมาณ ±15 นาที</p>\n                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">\n                            <button type="button" onclick="testLineNotification()" class="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-paper-plane mr-1"></i> ทดสอบส่ง</button>\n                            <button id="btn-line-daily-save" type="button" onclick="setupLineDailyTrigger()" class="bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-clock mr-1"></i> บันทึกตารางเวลา</button>\n                        </div>\n                    </div>\n                </div>'''
s,n=old_auto.subn(new_auto,s,count=1)
if n!=1:
    raise SystemExit(f'auto block replacement count={n}')

s=s.replace('ปุ่มนี้ใช้บันทึก Token, Channel Secret, Target ID และสถานะเปิด/ปิดการแจ้งเตือน','ปุ่มนี้ใช้บันทึก Token, Channel Secret, Target ID, สถานะเปิด/ปิด และประเภทเหตุการณ์ที่ต้องการแจ้งเตือน')
p.write_text(s,encoding='utf-8')

# ---------- script.js ----------
p=Path('script.js')
s=p.read_text(encoding='utf-8')
s=re.sub(r'Frontend Controller API \(v[^)]*\)', f'Frontend Controller API (v{VERSION} LINE Automation & Event Alerts)', s, count=1)

start=s.index('async function loadLineConfigStatus() {')
end=s.index('\nasync function loadAdminUsersSection()',start)
new_block=r'''async function loadLineConfigStatus() {
    const el=document.getElementById('line-config-status');
    const urlEl=document.getElementById('line-webhook-url');
    if(urlEl)urlEl.value='https://tgeezbwbrovfyjbeykrj.supabase.co/functions/v1/line-webhook-gateway';
    const hourEl=document.getElementById('line-daily-hour');
    if(hourEl && !hourEl.options.length){
        for(let h=0;h<24;h++){
            const o=document.createElement('option');
            o.value=String(h);o.textContent=String(h).padStart(2,'0')+' น.';hourEl.appendChild(o);
        }
    }
    if(!el)return;
    el.className='mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600';
    el.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังตรวจสอบสถานะ LINE OA...';
    const r=await run('getLineConfigStatus',{});
    if(!r.success){
        el.className='mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[11px] text-rose-700';
        el.textContent=r.error||'ตรวจสอบสถานะ LINE OA ไม่สำเร็จ';
        return;
    }
    const enabledEl=document.getElementById('line-enabled');
    if(enabledEl)enabledEl.checked=!!r.enabled;
    const prefs=r.eventPreferences||{};
    const map={
        'line-event-borrow':'CREATE_BORROW','line-event-return':'RETURN_BORROW','line-event-extend':'EXTEND_BORROW',
        'line-event-eq-add':'CREATE_EQUIPMENT','line-event-void':'VOID_BORROW','line-event-eq-inactive':'DEACTIVATE_EQUIPMENT'
    };
    Object.entries(map).forEach(([id,key])=>{const x=document.getElementById(id);if(x)x.checked=!!prefs[key];});
    const dailyEl=document.getElementById('line-daily-enabled');if(dailyEl)dailyEl.checked=!!r.dailyEnabled;
    if(hourEl)hourEl.value=String(Number(r.dailyHour||8));
    const minuteEl=document.getElementById('line-daily-minute');if(minuteEl)minuteEl.value=String(Number(r.dailyMinute||0));
    const targetText=!r.targetConfigured?'ยังไม่มี':(r.targetValid===false?'ไม่ถูกต้อง':`พร้อม ${escapeHtml(r.targetMasked||'')}`);
    const dailyText=r.triggerAuthorizationRequired?'ต้องอนุญาตสิทธิ์':(r.dailyTrigger?`เปิด ${escapeHtml(r.dailyTime||'08:00')}`:'ปิด');
    const eventCount=Object.values(prefs).filter(Boolean).length;
    const badge=(ok,label)=>`<span class="inline-flex items-center px-2 py-1 rounded-full border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-100':'bg-amber-50 text-amber-700 border-amber-100'}">${label}</span>`;
    el.innerHTML=`<div class="flex flex-wrap gap-1.5">
        ${badge(!!r.tokenConfigured,'Token: '+(r.tokenConfigured?'พร้อม':'ยังไม่มี'))}
        ${badge(!!r.channelSecretConfigured,'Secret: '+(r.channelSecretConfigured?'พร้อม':'ยังไม่มี'))}
        ${badge(!!r.targetConfigured && r.targetValid!==false,'Target: '+targetText)}
        ${badge(!!r.webhookConfigured,'Webhook: '+(r.webhookConfigured?'พร้อม':'ยังไม่พร้อม'))}
        ${badge(!!r.enabled,'แจ้งเตือนหลัก: '+(r.enabled?'เปิด':'ปิด'))}
        ${badge(eventCount>0,'เหตุการณ์ทันที: '+eventCount+'/6')}
        ${badge(!!r.dailyTrigger,'สรุปรายวัน: '+dailyText)}
    </div>
    ${r.targetValid===false?'<div class="mt-2 text-rose-600"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Target ที่บันทึกไว้ไม่ใช่ LINE User/Group ID กรุณากรอกค่า U... หรือ C... แล้วกด “บันทึกการตั้งค่า LINE OA”</div>':''}
    ${r.triggerAuthorizationRequired?'<div class="mt-2 text-amber-700"><i class="fa-solid fa-key mr-1"></i>การส่ง LINE ใช้งานได้ แต่การตั้งเวลารายวันต้องอนุญาต Script Trigger โดยรัน authorizeLineServices ใน Apps Script 1 ครั้ง</div>':''}`;
}

function collectLineEventPreferences(){
    return {
        CREATE_BORROW:!!document.getElementById('line-event-borrow')?.checked,
        RETURN_BORROW:!!document.getElementById('line-event-return')?.checked,
        EXTEND_BORROW:!!document.getElementById('line-event-extend')?.checked,
        CREATE_EQUIPMENT:!!document.getElementById('line-event-eq-add')?.checked,
        VOID_BORROW:!!document.getElementById('line-event-void')?.checked,
        DEACTIVATE_EQUIPMENT:!!document.getElementById('line-event-eq-inactive')?.checked
    };
}

async function saveLineConfigForm(){
    const token=(document.getElementById('line-token').value||'').trim();
    const targetId=(document.getElementById('line-target').value||'').trim();
    const channelSecret=(document.getElementById('line-channel-secret').value||'').trim();
    const requestedEnabled=!!document.getElementById('line-enabled').checked;
    if(targetId && !/^[UCR][0-9a-fA-F]{32}$/.test(targetId)){
        Swal.fire('Target ID ไม่ถูกต้อง','ต้องเป็น LINE User/Group/Room ID เช่น U... / C... / R... ตามด้วยรหัส 32 ตัว','warning');return;
    }
    const current=await run('getLineConfigStatus',{});
    if(!current || !current.success){Swal.fire('ตรวจสอบสถานะไม่สำเร็จ',String((current&&current.error)||'ไม่สามารถอ่านสถานะ LINE OA ได้'),'error');return;}
    const tokenReady=!!token || !!current.tokenConfigured;
    const secretReady=!!channelSecret || !!current.channelSecretConfigured;
    const targetReady=!!targetId || !!current.targetConfigured;
    if(!tokenReady || !secretReady){
        const missing=[];if(!tokenReady)missing.push('Channel access token');if(!secretReady)missing.push('Channel secret');
        Swal.fire('กรอกข้อมูลระยะแรกให้ครบ','กรุณากรอก '+missing.join(' และ ')+' แล้วกดบันทึกก่อน โดย Target ID สามารถเว้นว่างในครั้งแรกได้','warning');return;
    }
    const enabled=requestedEnabled && targetReady;
    const btn=document.getElementById('btn-line-save'),oldHtml=btn?btn.innerHTML:'';
    if(btn){btn.disabled=true;btn.style.opacity='0.7';btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';}
    try{
        const r=await run('saveLineConfig',{channelAccessToken:token,targetId,channelSecret,enabled,eventPreferences:collectLineEventPreferences()});
        if(!r.success){Swal.fire('บันทึกไม่สำเร็จ',r.error||'ไม่สามารถบันทึกการตั้งค่า LINE OA ได้','error');return;}
        document.getElementById('line-token').value='';document.getElementById('line-channel-secret').value='';document.getElementById('line-target').value='';
        await loadLineConfigStatus();
        if(!targetReady){
            await Swal.fire({title:'บันทึก Token + Secret แล้ว',html:'<div class="text-left text-sm leading-7">ขั้นต่อไป: Verify Webhook → เปิด Use webhook → ส่งคำว่า <b>ไอดี</b> หา LINE OA → นำ U.../C... มาใส่ Target แล้วเปิดการแจ้งเตือน</div>',icon:'success'});
        }else{
            await Swal.fire('บันทึกการตั้งค่าแล้ว',enabled?'บันทึกการเชื่อมต่อและประเภทเหตุการณ์แจ้งเตือนแล้ว':'บันทึกค่าแล้ว แต่การแจ้งเตือนหลักยังปิดอยู่','success');
        }
    }finally{if(btn){btn.disabled=false;btn.style.opacity='1';btn.innerHTML=oldHtml||'<i class="fa-solid fa-floppy-disk"></i> บันทึกการตั้งค่า LINE OA';}}
}

async function copyLineWebhookUrl(){
    const el=document.getElementById('line-webhook-url');if(!el)return;
    try{await navigator.clipboard.writeText(el.value);Swal.fire('คัดลอก Webhook URL แล้ว','','success');}
    catch(e){el.select();document.execCommand('copy');Swal.fire('คัดลอก Webhook URL แล้ว','','success');}
}

async function testLineNotification(){
    let r=await run('testLineNotification',{});const err=String((r&&r.error)||'');
    if(!r.success && (r.authorizationRequired || /UrlFetchApp\.fetch|script\.external_request|permission to call UrlFetchApp|authorization is required/i.test(err))){
        await Swal.fire({title:'ต้องอนุญาตสิทธิ์ LINE API ก่อน',html:'<div class="text-left text-sm leading-7">เปิด <b>Apps Script Editor</b> → เลือก <b>authorizeLineServices</b> → Run → อนุญาตสิทธิ์ แล้วกลับมาทดสอบส่งอีกครั้ง</div>',icon:'warning'});return;
    }
    if(!r.success && err.includes('LINE notification ยังปิดอยู่')){
        const ask=await Swal.fire({title:'LINE OA ยังปิดการแจ้งเตือน',text:'ต้องการเปิดการแจ้งเตือนและบันทึกสถานะตอนนี้หรือไม่?',icon:'question',showCancelButton:true,confirmButtonText:'เปิดและบันทึก',cancelButtonText:'ยังไม่เปิด',confirmButtonColor:'#059669'});
        if(!ask.isConfirmed)return;
        const enabledBox=document.getElementById('line-enabled');if(enabledBox)enabledBox.checked=true;
        const save=await run('saveLineConfig',{channelAccessToken:'',targetId:'',channelSecret:'',enabled:true,eventPreferences:collectLineEventPreferences()});
        if(!save.success){Swal.fire('เปิดการแจ้งเตือนไม่สำเร็จ',save.error||'ไม่สามารถบันทึกสถานะ LINE OA ได้','error');return;}
        r=await run('testLineNotification',{});
    }
    Swal.fire(r.success?'ส่งทดสอบสำเร็จ':'ส่งไม่สำเร็จ',String((r&&r.error)||'')||'ตรวจสอบ LINE OA ได้แล้ว',r.success?'success':'error');
}

async function setupLineDailyTrigger(){
    const enabled=!!document.getElementById('line-daily-enabled')?.checked;
    const hour=Number(document.getElementById('line-daily-hour')?.value||8);
    const minute=Number(document.getElementById('line-daily-minute')?.value||0);
    const btn=document.getElementById('btn-line-daily-save'),old=btn?btn.innerHTML:'';
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังบันทึก...';}
    try{
        const r=await run('setupLineDailyTrigger',{enabled,hour,minute});
        if(r.success){await Swal.fire(enabled?'ตั้งเวลาแล้ว':'ปิดสรุปรายวันแล้ว',r.message||'บันทึกตารางเวลาเรียบร้อย','success');await loadLineConfigStatus();return;}
        if(r.authorizationRequired){await Swal.fire({title:'ต้องอนุญาตสิทธิ์ Trigger 1 ครั้ง',html:'<div class="text-left text-xs leading-6">เปิด <b>Apps Script</b> → เลือก <code>authorizeLineServices</code> → Run → อนุญาตสิทธิ์ แล้วกลับมากด <b>บันทึกตารางเวลา</b> อีกครั้ง</div>',icon:'info'});}
        else Swal.fire('ตั้งเวลาไม่สำเร็จ',r.error||'เกิดข้อผิดพลาด','error');
    }finally{if(btn){btn.disabled=false;btn.innerHTML=old||'<i class="fa-solid fa-clock mr-1"></i> บันทึกตารางเวลา';}}
    await loadLineConfigStatus();
}
'''
s=s[:start]+new_block+s[end:]
p.write_text(s,encoding='utf-8')
print('patched v3.7.0')
