from pathlib import Path
import re

VERSION='3.6.4'

# index.html
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('style.css?v=3.6.2', f'style.css?v={VERSION}')
s=s.replace('style.css?v=3.6.3', f'style.css?v={VERSION}')
s=s.replace('script.js?v=3.6.2', f'script.js?v={VERSION}')
s=s.replace('script.js?v=3.6.3', f'script.js?v={VERSION}')
s=s.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ 3.6.3 |', f'ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v{VERSION} |')
s=s.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.6.3 |', f'ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v{VERSION} |')
p.write_text(s,encoding='utf-8')

# script.js
p=Path('script.js')
s=p.read_text(encoding='utf-8')
s=re.sub(r'Frontend Controller API \(v[^)]*\)', f'Frontend Controller API (v{VERSION} LINE POST Cache Hotfix)', s, count=1)

pat=r"async function testLineNotification\(\)\{.*?\}\nasync function setupLineDailyTrigger"
new="""async function testLineNotification(){
    const r=await run('testLineNotification',{});
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
    Swal.fire(r.success?'ส่งทดสอบสำเร็จ':'ส่งไม่สำเร็จ',err||'ตรวจสอบ LINE OA ได้แล้ว',r.success?'success':'error');
}
async function setupLineDailyTrigger"""
s2,n=re.subn(pat,new,s,flags=re.S)
if n!=1:
    raise SystemExit(f'testLineNotification replacement count={n}')
s=s2
p.write_text(s,encoding='utf-8')
print('patched v3.6.4')
