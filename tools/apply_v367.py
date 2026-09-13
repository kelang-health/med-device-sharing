from pathlib import Path
import re

VERSION='3.6.7'

p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('style.css?v=3.6.6', f'style.css?v={VERSION}')
s=s.replace('script.js?v=3.6.6', f'script.js?v={VERSION}')
s=s.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.6.6 |', f'ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v{VERSION} |')
p.write_text(s,encoding='utf-8')

p=Path('script.js')
s=p.read_text(encoding='utf-8')
s=re.sub(r'Frontend Controller API \(v[^)]*\)', f'Frontend Controller API (v{VERSION} LINE Authorization Guidance)', s, count=1)
anchor="""async function testLineNotification(){
    let r=await run('testLineNotification',{});
    const err=String((r&&r.error)||'');
"""
insert="""async function testLineNotification(){
    let r=await run('testLineNotification',{});
    const err=String((r&&r.error)||'');
    if(!r.success && (r.authorizationRequired || /UrlFetchApp\\.fetch|script\\.external_request|permission to call UrlFetchApp|authorization is required/i.test(err))){
        await Swal.fire({
            title:'ต้องอนุญาตสิทธิ์ LINE API ก่อน',
            html:'<div class="text-left text-sm leading-7">เปิด <b>Apps Script Editor</b> → เลือกฟังก์ชัน <b>authorizeLineServices</b> → กด <b>Run</b> → อนุญาตสิทธิ์ Google ให้ครบ แล้วกลับมาหน้านี้กด <b>ทดสอบส่ง</b> อีกครั้ง</div>',
            icon:'warning',
            confirmButtonText:'เข้าใจแล้ว'
        });
        return;
    }
"""
if anchor not in s:
    raise SystemExit('testLineNotification anchor not found')
s=s.replace(anchor,insert,1)
p.write_text(s,encoding='utf-8')
print('patched v3.6.7')
