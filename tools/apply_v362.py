from pathlib import Path

WEBHOOK='https://tgeezbwbrovfyjbeykrj.supabase.co/functions/v1/line-webhook-gateway'

p=Path('script.js'); s=p.read_text(encoding='utf-8')
s=s.replace('v3.6 Audit & Security','v3.6.2 LINE Webhook',1)
old="async function loadLineConfigStatus(){const el=document.getElementById('line-config-status');if(!el)return;const r=await run('getLineConfigStatus',{});el.textContent=r.success?`Token: ${r.tokenConfigured?'พร้อม':'ยังไม่มี'} | Target: ${r.targetConfigured?'พร้อม '+(r.targetMasked||''):'ยังไม่มี'} | แจ้งเตือน: ${r.enabled?'เปิด':'ปิด'} | Daily: ${r.dailyTrigger?'ตั้งแล้ว':'ยังไม่ตั้ง'}`:(r.error||'ตรวจสอบไม่ได้');}"
new=f"""async function loadLineConfigStatus(){{
    const el=document.getElementById('line-config-status');
    const urlEl=document.getElementById('line-webhook-url');
    if(urlEl)urlEl.value='{WEBHOOK}';
    if(!el)return;
    const r=await run('getLineConfigStatus',{{}});
    el.textContent=r.success
      ? `Token: ${{r.tokenConfigured?'พร้อม':'ยังไม่มี'}} | Channel Secret: ${{r.channelSecretConfigured?'พร้อม':'ยังไม่มี'}} | Target: ${{r.targetConfigured?'พร้อม '+(r.targetMasked||''):'ยังไม่มี'}} | Webhook: ${{r.webhookConfigured?'พร้อม':'ยังไม่พร้อม'}} | แจ้งเตือน: ${{r.enabled?'เปิด':'ปิด'}} | Daily: ${{r.dailyTrigger?'ตั้งแล้ว':'ยังไม่ตั้ง'}}`
      : (r.error||'ตรวจสอบไม่ได้');
}}
"""
if old not in s: raise SystemExit('loadLineConfigStatus block not found')
s=s.replace(old,new,1)
old2="async function saveLineConfigForm(){const token=(document.getElementById('line-token').value||'').trim(),targetId=(document.getElementById('line-target').value||'').trim(),enabled=document.getElementById('line-enabled').checked;const r=await run('saveLineConfig',{channelAccessToken:token,targetId,enabled});if(r.success){document.getElementById('line-token').value='';Swal.fire('บันทึก LINE OA แล้ว','','success');loadLineConfigStatus();}else Swal.fire('ไม่สำเร็จ',r.error||'','error');}"
new2="""async function saveLineConfigForm(){
    const token=(document.getElementById('line-token').value||'').trim();
    const targetId=(document.getElementById('line-target').value||'').trim();
    const channelSecret=(document.getElementById('line-channel-secret').value||'').trim();
    const enabled=document.getElementById('line-enabled').checked;
    const r=await run('saveLineConfig',{channelAccessToken:token,targetId,channelSecret,enabled});
    if(r.success){
        document.getElementById('line-token').value='';
        document.getElementById('line-channel-secret').value='';
        Swal.fire('บันทึก LINE OA แล้ว','Token และ Channel Secret ถูกเก็บใน Apps Script Script Properties','success');
        loadLineConfigStatus();
    }else Swal.fire('ไม่สำเร็จ',r.error||'','error');
}

async function copyLineWebhookUrl(){
    const el=document.getElementById('line-webhook-url');
    if(!el)return;
    try{await navigator.clipboard.writeText(el.value);Swal.fire('คัดลอก Webhook URL แล้ว','','success');}
    catch(e){el.select();document.execCommand('copy');Swal.fire('คัดลอก Webhook URL แล้ว','','success');}
}
"""
if old2 not in s: raise SystemExit('saveLineConfigForm block not found')
s=s.replace(old2,new2,1)
p.write_text(s,encoding='utf-8')

p=Path('index.html'); h=p.read_text(encoding='utf-8')
h=h.replace('style.css?v=3.6','style.css?v=3.6.2',1)
h=h.replace('script.js?v=3.6','script.js?v=3.6.2',1)
h=h.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.6 | Design & Developed by Apiwat Meethong','ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.6.2 | Design & Developed by Apiwat Meethong')
needle='<input id="line-token" type="password" placeholder="Channel access token (เว้นว่างถ้าไม่เปลี่ยน)" class="border px-3 py-2 rounded-xl text-xs"><input id="line-target" type="text" placeholder="Target User ID / Group ID" class="border px-3 py-2 rounded-xl text-xs"><label class="text-xs"><input id="line-enabled" type="checkbox"> เปิดการแจ้งเตือน</label>'
replacement=f'''<input id="line-token" type="password" placeholder="Channel access token (เว้นว่างถ้าไม่เปลี่ยน)" class="border px-3 py-2 rounded-xl text-xs"><input id="line-channel-secret" type="password" placeholder="Channel secret (Basic settings)" class="border px-3 py-2 rounded-xl text-xs"><input id="line-target" type="text" placeholder="Target User ID / Group ID" class="border px-3 py-2 rounded-xl text-xs"><div class="flex gap-2"><input id="line-webhook-url" type="text" readonly value="{WEBHOOK}" class="border bg-gray-50 px-3 py-2 rounded-xl text-[10px] flex-1"><button type="button" onclick="copyLineWebhookUrl()" class="bg-gray-100 px-3 py-2 rounded-xl text-xs font-bold">คัดลอก URL</button></div><p class="text-[10px] text-gray-400">นำ URL นี้ไปวางที่ LINE Developers Console → Messaging API → Webhook URL แล้วกด Verify หลัง Deploy Code.gs v3.6.2</p><label class="text-xs"><input id="line-enabled" type="checkbox"> เปิดการแจ้งเตือน</label>'''
if needle not in h: raise SystemExit('LINE settings inputs not found')
h=h.replace(needle,replacement,1)
p.write_text(h,encoding='utf-8')
