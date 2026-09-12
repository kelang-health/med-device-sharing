from pathlib import Path
import re

VERSION='3.6.6'

# index.html
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('style.css?v=3.6.5', f'style.css?v={VERSION}')
s=s.replace('script.js?v=3.6.5', f'script.js?v={VERSION}')
s=s.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.6.5 |', f'ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v{VERSION} |')

# Make the primary save button impossible to disappear because of utility/custom CSS conflicts.
pat_btn=r'(<button id="btn-line-save" type="button" onclick="saveLineConfigForm\(\)" class="[^"]*")([^>]*>)'
repl_btn=r'\1 style="background:#059669;color:#ffffff;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;opacity:1;visibility:visible;width:100%;font-weight:700;border-radius:12px;"\2'
s,n=re.subn(pat_btn,repl_btn,s,count=1)
if n!=1:
    raise SystemExit(f'btn-line-save patch count={n}')

# Add a compact guided setup sequence above the save button.
anchor='''                    <div class="mt-4 border-t border-gray-100 pt-4">\n                        <button id="btn-line-save"'''
if anchor not in s:
    raise SystemExit('LINE save anchor not found')
guide='''                    <div class="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-[11px] text-emerald-800 leading-5">\n                        <b>ตั้งค่าครั้งแรก 2 ระยะ:</b> ① กรอก Channel access token + Channel secret แล้วบันทึกก่อน ② Verify Webhook → ส่งคำว่า “ไอดี” หา LINE OA → นำ U.../C... มาใส่ Target → เปิดการแจ้งเตือนแล้วบันทึกอีกครั้ง\n                    </div>\n\n'''
s=s.replace(anchor,guide+anchor,1)
p.write_text(s,encoding='utf-8')

# script.js
p=Path('script.js')
s=p.read_text(encoding='utf-8')
s=re.sub(r'Frontend Controller API \(v[^)]*\)', f'Frontend Controller API (v{VERSION} Guided LINE Setup)', s, count=1)

pat=r"async function saveLineConfigForm\(\)\{.*?\n\}\nasync function testLineNotification"
new="""async function saveLineConfigForm(){
    const token=(document.getElementById('line-token').value||'').trim();
    const targetId=(document.getElementById('line-target').value||'').trim();
    const channelSecret=(document.getElementById('line-channel-secret').value||'').trim();
    const requestedEnabled=!!document.getElementById('line-enabled').checked;

    if(targetId && !/^[UCR][0-9a-fA-F]{32}$/.test(targetId)){
        Swal.fire('Target ID ไม่ถูกต้อง','ต้องเป็น LINE User/Group/Room ID เช่น U... / C... / R... ตามด้วยรหัส 32 ตัว','warning');
        return;
    }

    const current=await run('getLineConfigStatus',{});
    if(!current || !current.success){
        Swal.fire('ตรวจสอบสถานะไม่สำเร็จ',String((current&&current.error)||'ไม่สามารถอ่านสถานะ LINE OA ได้'),'error');
        return;
    }

    const tokenReady=!!token || !!current.tokenConfigured;
    const secretReady=!!channelSecret || !!current.channelSecretConfigured;
    const targetReady=!!targetId || !!current.targetConfigured;

    if(!tokenReady || !secretReady){
        const missing=[];
        if(!tokenReady) missing.push('Channel access token');
        if(!secretReady) missing.push('Channel secret');
        Swal.fire('กรอกข้อมูลระยะแรกให้ครบ','กรุณากรอก '+missing.join(' และ ')+' แล้วกดบันทึกก่อน โดย Target ID สามารถเว้นว่างในครั้งแรกได้','warning');
        return;
    }

    // Do not enable push notifications until a valid Target exists. Token + Secret can be saved first.
    const enabled=requestedEnabled && targetReady;
    const btn=document.getElementById('btn-line-save');
    const oldHtml=btn?btn.innerHTML:'';
    if(btn){
        btn.disabled=true;
        btn.style.opacity='0.7';
        btn.innerHTML='<i class=\"fa-solid fa-spinner fa-spin\"></i> กำลังบันทึก...';
    }
    try{
        const r=await run('saveLineConfig',{channelAccessToken:token,targetId,channelSecret,enabled});
        if(!r.success){
            Swal.fire('บันทึกไม่สำเร็จ',r.error||'ไม่สามารถบันทึกการตั้งค่า LINE OA ได้','error');
            return;
        }

        document.getElementById('line-token').value='';
        document.getElementById('line-channel-secret').value='';
        document.getElementById('line-target').value='';
        const enabledBox=document.getElementById('line-enabled');
        if(enabledBox) enabledBox.checked=!!r.enabled;
        await loadLineConfigStatus();

        if(!targetReady){
            await Swal.fire({
                title:'บันทึก Token + Secret แล้ว',
                html:'<div class=\"text-left text-sm leading-7\">ขั้นต่อไป:<br>1. นำ Webhook URL ไปกด <b>Verify</b> ใน LINE Developers<br>2. เปิด <b>Use webhook</b><br>3. ส่งคำว่า <b>ไอดี</b> หา LINE OA<br>4. นำค่า <b>U...</b> หรือ <b>C...</b> กลับมาใส่ Target แล้วติ๊ก “เปิดการแจ้งเตือน LINE OA” และบันทึกอีกครั้ง</div>',
                icon:'success',
                confirmButtonText:'เข้าใจแล้ว'
            });
        }else{
            await Swal.fire('บันทึกการตั้งค่าแล้ว',enabled?'LINE OA พร้อมสำหรับทดสอบส่งแล้ว':'Token / Secret / Target ถูกบันทึกแล้ว หากต้องการส่งแจ้งเตือนให้ติ๊กเปิดการแจ้งเตือนแล้วบันทึกอีกครั้ง','success');
        }
    }finally{
        if(btn){
            btn.disabled=false;
            btn.style.opacity='1';
            btn.innerHTML=oldHtml||'<i class=\"fa-solid fa-floppy-disk\"></i> บันทึกการตั้งค่า LINE OA';
        }
    }
}
async function testLineNotification"""
s2,n=re.subn(pat,new,s,flags=re.S)
if n!=1:
    raise SystemExit(f'saveLineConfigForm replacement count={n}')
s=s2
p.write_text(s,encoding='utf-8')
print('patched v3.6.6')
