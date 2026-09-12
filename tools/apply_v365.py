from pathlib import Path
import re

VERSION='3.6.5'

p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('style.css?v=3.6.4', f'style.css?v={VERSION}')
s=s.replace('script.js?v=3.6.4', f'script.js?v={VERSION}')
s=s.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.6.4 |', f'ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v{VERSION} |')
p.write_text(s,encoding='utf-8')

p=Path('script.js')
s=p.read_text(encoding='utf-8')
s=re.sub(r'Frontend Controller API \(v[^)]*\)', f'Frontend Controller API (v{VERSION} LINE Enabled State Sync)', s, count=1)

# Sync checkbox with persisted backend state whenever LINE status is loaded.
needle="const r=await run('getLineConfigStatus',{});"
if needle not in s:
    raise SystemExit('getLineConfigStatus call not found')
inject=needle+"\n    const enabledBox=document.getElementById('line-enabled');\n    if(enabledBox && r && r.success) enabledBox.checked=!!r.enabled;"
s=s.replace(needle,inject,1)

# Keep checkbox aligned with the value actually persisted after save.
needle2="const r=await run('saveLineConfig',{channelAccessToken:token,targetId,channelSecret,enabled});"
if needle2 not in s:
    raise SystemExit('saveLineConfig call not found')
inject2=needle2+"\n        const enabledBox=document.getElementById('line-enabled');\n        if(enabledBox && r && r.success) enabledBox.checked=!!r.enabled;"
s=s.replace(needle2,inject2,1)

# Improve test behavior: if notifications are disabled, offer a one-click enable and retry.
pat=r"async function testLineNotification\(\)\{.*?\n\}\nasync function setupLineDailyTrigger"
new="""async function testLineNotification(){
    let r=await run('testLineNotification',{});
    const err=String((r&&r.error)||'');
    if(!r.success && err.includes('GET ใช้ได้เฉพาะ action=health')){
        await Swal.fire({
            title:'พบไฟล์หน้าเว็บรุ่นเก่าใน Cache',
            html:'<div class=\"text-left text-xs leading-6\">ระบบ Backend รับ API ผ่าน POST ถูกต้อง แต่เบราว์เซอร์ยังใช้ไฟล์หน้าเว็บเก่าอยู่<br><br>กรุณากด <b>Ctrl + F5</b> หรือปิดหน้าเว็บแล้วเปิดใหม่ จากนั้นทดสอบส่งอีกครั้ง</div>',
            icon:'warning',
            confirmButtonText:'รับทราบ'
        });
        return;
    }
    if(!r.success && err.includes('LINE notification ยังปิดอยู่')){
        const ask=await Swal.fire({
            title:'LINE OA ยังปิดการแจ้งเตือน',
            text:'ต้องการเปิดการแจ้งเตือนและบันทึกสถานะตอนนี้หรือไม่?',
            icon:'question',
            showCancelButton:true,
            confirmButtonText:'เปิดและบันทึก',
            cancelButtonText:'ยังไม่เปิด',
            confirmButtonColor:'#059669'
        });
        if(ask.isConfirmed){
            const enabledBox=document.getElementById('line-enabled');
            if(enabledBox) enabledBox.checked=true;
            const save=await run('saveLineConfig',{channelAccessToken:'',targetId:'',channelSecret:'',enabled:true});
            if(!save.success){
                Swal.fire('เปิดการแจ้งเตือนไม่สำเร็จ',save.error||'ไม่สามารถบันทึกสถานะ LINE OA ได้','error');
                return;
            }
            r=await run('testLineNotification',{});
        }else{
            return;
        }
    }
    Swal.fire(r.success?'ส่งทดสอบสำเร็จ':'ส่งไม่สำเร็จ',String((r&&r.error)||'')||'ตรวจสอบ LINE OA ได้แล้ว',r.success?'success':'error');
}
async function setupLineDailyTrigger"""
s2,n=re.subn(pat,new,s,flags=re.S)
if n!=1:
    raise SystemExit(f'testLineNotification replacement count={n}')
s=s2
p.write_text(s,encoding='utf-8')
print('patched v3.6.5')
