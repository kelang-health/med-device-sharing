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

# Sync checkbox with persisted backend state whenever status is loaded.
marker="async function loadLineConfigStatus(){"
idx=s.find(marker)
if idx < 0:
    raise SystemExit('loadLineConfigStatus not found')
# Find the success/status rendering block and inject once after successful response is available.
needle="if(!r.success){el.innerHTML=`<span class=\"text-rose-600\">${escapeHtml(r.error||'ตรวจสอบ LINE ไม่สำเร็จ')}</span>`;return;}"
if needle not in s:
    raise SystemExit('loadLineConfigStatus success guard not found')
replacement=needle+"\n    const enabledBox=document.getElementById('line-enabled');\n    if(enabledBox) enabledBox.checked=!!r.enabled;"
s=s.replace(needle,replacement,1)

# Refresh persisted state after a successful save so checkbox and badges stay consistent.
needle2="await Swal.fire('บันทึกการตั้งค่าแล้ว','Token และ Channel Secret ถูกเก็บใน Apps Script Script Properties เรียบร้อย','success');"
if needle2 not in s:
    raise SystemExit('save success marker not found')
s=s.replace(needle2, needle2+"\n            await loadLineConfigStatus();",1)

# Improve test behavior: when notification is disabled, offer to enable + persist without requiring secrets again.
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
            await loadLineConfigStatus();
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
