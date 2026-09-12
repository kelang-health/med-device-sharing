from pathlib import Path
import re

REPO_VERSION='3.6.3'
WEBHOOK='https://tgeezbwbrovfyjbeykrj.supabase.co/functions/v1/line-webhook-gateway'

def replace_func(src, name, new):
    m=re.search(rf'(?m)^(?:async\s+)?function\s+{re.escape(name)}\s*\(', src)
    if not m:
        raise SystemExit(f'missing function {name}')
    n=re.search(r'(?m)^(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(', src[m.end():])
    end=m.end()+n.start() if n else len(src)
    return src[:m.start()] + new.strip() + '\n\n' + src[end:]

# ---- index.html ----
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('v3.6.2', REPO_VERSION)
start='<div class="admin-role-only bg-white border border-emerald-100 rounded-2xl shadow-sm p-5 max-w-2xl"><h4 class="font-bold text-sm">LINE OA แจ้งเตือน</h4>'
end='\n\n                <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 max-w-2xl">'
i=s.find(start)
if i < 0:
    raise SystemExit('LINE OA card start not found')
j=s.find(end, i)
if j < 0:
    raise SystemExit('LINE OA card end not found')
card=f'''<div class="admin-role-only bg-white border border-emerald-100 rounded-2xl shadow-sm p-5 max-w-2xl">
                    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                            <h4 class="font-bold text-sm text-gray-800 flex items-center gap-2"><i class="fa-brands fa-line text-emerald-600"></i> LINE OA แจ้งเตือน</h4>
                            <p class="text-[11px] text-gray-400 mt-1">Token และ Channel Secret เก็บใน Apps Script Script Properties ไม่บันทึกใน GitHub</p>
                        </div>
                        <button type="button" onclick="loadLineConfigStatus()" class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap"><i class="fa-solid fa-rotate mr-1"></i> รีเฟรชสถานะ</button>
                    </div>

                    <div id="line-config-status" class="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600">กำลังตรวจสอบ...</div>

                    <div class="grid grid-cols-1 gap-3 mt-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-600 mb-1">1. Channel access token</label>
                            <input id="line-token" type="password" autocomplete="new-password" placeholder="วาง Channel access token — เว้นว่างถ้าไม่ต้องการเปลี่ยน" class="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-600 mb-1">2. Channel secret <span class="font-normal text-gray-400">(LINE Developers → Basic settings)</span></label>
                            <input id="line-channel-secret" type="password" autocomplete="new-password" placeholder="วาง Channel secret — เว้นว่างถ้าไม่ต้องการเปลี่ยน" class="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-600 mb-1">3. Target User ID / Group ID</label>
                            <input id="line-target" type="text" placeholder="ตัวอย่าง Uxxxxxxxx... หรือ Cxxxxxxxx..." class="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                            <p class="text-[10px] text-gray-400 mt-1">หากยังไม่มี ID ให้เปิด Webhook แล้วส่งคำว่า “ไอดี” หา LINE OA</p>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-600 mb-1">4. Webhook URL</label>
                            <div class="flex flex-col sm:flex-row gap-2">
                                <input id="line-webhook-url" type="text" readonly value="{WEBHOOK}" class="border bg-gray-50 px-3 py-2.5 rounded-xl text-[10px] font-mono flex-1">
                                <button type="button" onclick="copyLineWebhookUrl()" class="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap"><i class="fa-regular fa-copy mr-1"></i> คัดลอก URL</button>
                            </div>
                            <p class="text-[10px] text-gray-400 mt-1">นำ URL ไปวางที่ LINE Developers Console → Messaging API → Webhook URL แล้วกด Verify</p>
                        </div>
                        <label class="flex items-center gap-2 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-xs font-semibold text-emerald-800 cursor-pointer">
                            <input id="line-enabled" type="checkbox" class="accent-emerald-600 h-4 w-4"> เปิดการแจ้งเตือน LINE OA
                        </label>
                    </div>

                    <div class="mt-4 border-t border-gray-100 pt-4">
                        <button id="btn-line-save" type="button" onclick="saveLineConfigForm()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-sm transition flex items-center justify-center gap-2">
                            <i class="fa-solid fa-floppy-disk"></i> บันทึกการตั้งค่า LINE OA
                        </button>
                        <p class="text-[10px] text-gray-400 text-center mt-1.5">ปุ่มนี้ใช้บันทึก Token, Channel Secret, Target ID และสถานะเปิด/ปิดการแจ้งเตือน</p>
                    </div>

                    <div class="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <div class="text-[11px] font-bold text-gray-600 mb-2">ทดสอบและงานอัตโนมัติ</div>
                        <div class="flex flex-col sm:flex-row gap-2">
                            <button type="button" onclick="testLineNotification()" class="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-paper-plane mr-1"></i> ทดสอบส่ง</button>
                            <button type="button" onclick="setupLineDailyTrigger()" class="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2.5 rounded-xl text-xs font-bold"><i class="fa-solid fa-clock mr-1"></i> ตั้งสรุปทุกวัน 08:00</button>
                        </div>
                    </div>
                </div>'''
s=s[:i]+card+s[j:]
p.write_text(s,encoding='utf-8')

# ---- script.js ----
p=Path('script.js')
s=p.read_text(encoding='utf-8')
s=s.replace('v3.6.2', REPO_VERSION)

s=replace_func(s,'loadLineConfigStatus',f'''async function loadLineConfigStatus() {{
    const el=document.getElementById('line-config-status');
    const urlEl=document.getElementById('line-webhook-url');
    if(urlEl)urlEl.value='{WEBHOOK}';
    if(!el)return;
    el.className='mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600';
    el.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังตรวจสอบสถานะ LINE OA...';
    const r=await run('getLineConfigStatus',{{}});
    if(!r.success){{
        el.className='mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[11px] text-rose-700';
        el.textContent=r.error||'ตรวจสอบสถานะ LINE OA ไม่สำเร็จ';
        return;
    }}
    const enabledEl=document.getElementById('line-enabled');
    if(enabledEl)enabledEl.checked=!!r.enabled;
    const targetText=!r.targetConfigured?'ยังไม่มี':(r.targetValid===false?'ไม่ถูกต้อง':`พร้อม ${{escapeHtml(r.targetMasked||'')}}`);
    const dailyText=r.triggerAuthorizationRequired?'ต้องอนุญาตสิทธิ์':(r.dailyTrigger?'ตั้งแล้ว':'ยังไม่ตั้ง');
    const badge=(ok,label)=>`<span class="inline-flex items-center px-2 py-1 rounded-full border ${{ok?'bg-emerald-50 text-emerald-700 border-emerald-100':'bg-amber-50 text-amber-700 border-amber-100'}}">${{label}}</span>`;
    el.innerHTML=`<div class="flex flex-wrap gap-1.5">
        ${{badge(!!r.tokenConfigured,'Token: '+(r.tokenConfigured?'พร้อม':'ยังไม่มี'))}}
        ${{badge(!!r.channelSecretConfigured,'Secret: '+(r.channelSecretConfigured?'พร้อม':'ยังไม่มี'))}}
        ${{badge(!!r.targetConfigured && r.targetValid!==false,'Target: '+targetText)}}
        ${{badge(!!r.webhookConfigured,'Webhook: '+(r.webhookConfigured?'พร้อม':'ยังไม่พร้อม'))}}
        ${{badge(!!r.enabled,'แจ้งเตือน: '+(r.enabled?'เปิด':'ปิด'))}}
        ${{badge(!!r.dailyTrigger,'Daily 08:00: '+dailyText)}}
    </div>
    ${{r.targetValid===false?'<div class="mt-2 text-rose-600"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Target ที่บันทึกไว้ไม่ใช่ LINE User/Group ID กรุณากรอกค่า U... หรือ C... แล้วกด “บันทึกการตั้งค่า LINE OA”</div>':''}}
    ${{r.triggerAuthorizationRequired?'<div class="mt-2 text-amber-700"><i class="fa-solid fa-key mr-1"></i>การบันทึก LINE ใช้งานได้ตามปกติ แต่การตั้งสรุป 08:00 ต้องอนุญาตสิทธิ์ Script Trigger ใน Apps Script ก่อน 1 ครั้ง</div>':''}}`;
}}''')

s=replace_func(s,'saveLineConfigForm','''async function saveLineConfigForm(){
    const token=(document.getElementById('line-token').value||'').trim();
    const targetId=(document.getElementById('line-target').value||'').trim();
    const channelSecret=(document.getElementById('line-channel-secret').value||'').trim();
    const enabled=document.getElementById('line-enabled').checked;
    if(targetId && !/^[UCR][0-9a-fA-F]{32}$/.test(targetId)){
        Swal.fire('Target ID ไม่ถูกต้อง','LINE Target ID ต้องขึ้นต้นด้วย U, C หรือ R และตามด้วยรหัส 32 ตัว หากยังไม่มี ID ให้เปิด Webhook แล้วส่งคำว่า “ไอดี” หา LINE OA','warning');
        return;
    }
    const btn=document.getElementById('btn-line-save');
    const oldHtml=btn?btn.innerHTML:'';
    if(btn){btn.disabled=true;btn.classList.add('opacity-60','cursor-not-allowed');btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';}
    try{
        const r=await run('saveLineConfig',{channelAccessToken:token,targetId,channelSecret,enabled});
        if(r.success){
            document.getElementById('line-token').value='';
            document.getElementById('line-channel-secret').value='';
            document.getElementById('line-target').value='';
            await Swal.fire('บันทึกการตั้งค่าแล้ว','Token และ Channel Secret ถูกเก็บใน Apps Script Script Properties เรียบร้อย','success');
            await loadLineConfigStatus();
        }else{
            Swal.fire('บันทึกไม่สำเร็จ',r.error||'เกิดข้อผิดพลาด','error');
        }
    }finally{
        if(btn){btn.disabled=false;btn.classList.remove('opacity-60','cursor-not-allowed');btn.innerHTML=oldHtml;}
    }
}''')

s=replace_func(s,'setupLineDailyTrigger','''async function setupLineDailyTrigger(){
    const r=await run('setupLineDailyTrigger',{});
    if(r.success){
        await Swal.fire('ตั้งเวลาแล้ว',r.message||'ตั้งสรุปทุกวัน 08:00 เรียบร้อย','success');
        await loadLineConfigStatus();
        return;
    }
    if(r.authorizationRequired){
        await Swal.fire({
            title:'ต้องอนุญาตสิทธิ์ Trigger 1 ครั้ง',
            html:'<div class="text-left text-xs leading-6">เปิด <b>Apps Script</b> → เลือกฟังก์ชัน <code>authorizeLineDailyTrigger</code> → กด <b>Run</b> → อนุญาตสิทธิ์ Google ให้เรียบร้อย<br><br>จากนั้นกลับมาหน้านี้แล้วกด <b>ตั้งสรุปทุกวัน 08:00</b> อีกครั้ง</div>',
            icon:'info',
            confirmButtonText:'รับทราบ'
        });
    }else{
        Swal.fire('ตั้งเวลาไม่สำเร็จ',r.error||'เกิดข้อผิดพลาด','error');
    }
    await loadLineConfigStatus();
}''')

p.write_text(s,encoding='utf-8')
print('patched v3.6.3')
