from pathlib import Path

idx=Path('index.html')
jsf=Path('script.js')
index=idx.read_text(encoding='utf-8')
js=jsf.read_text(encoding='utf-8')

index=index.replace('v4.2.0','v4.2.2')
js=js.replace('Frontend Controller API (v4.2.0 LINE Rich Menu Manager)','Frontend Controller API (v4.2.2 Backend Deployment Guard)',1)

old="""        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: action, payload: payload }),
            signal: controller.signal
        });
        const result = await response.json();
"""
new="""        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: action, payload: payload }),
            signal: controller.signal
        });
        const rawText = await response.text();
        const trimmed = String(rawText || '').trim();
        const looksHtml = /^<!doctype\\s+html|^<html|^</i.test(trimmed);
        if (!response.ok || !trimmed || looksHtml) {
            const statusText = response.status ? `HTTP ${response.status}` : 'ไม่มี HTTP status';
            const detail = response.status === 404
                ? 'ไม่พบ Apps Script Web App deployment ที่ URL ปัจจุบัน กรุณา Deploy Web app ใหม่/อัปเดต deployment เดิม แล้วใช้ URL ที่ลงท้ายด้วย /exec'
                : 'Backend Apps Script ตอบกลับไม่ใช่ JSON กรุณาตรวจสอบ Web App deployment และสิทธิ์การเข้าถึง';
            console.error('Backend API ไม่พร้อมใช้งาน:', statusText, trimmed.slice(0, 180));
            if (!window.__backendUnavailableNotified && typeof Swal !== 'undefined') {
                window.__backendUnavailableNotified = true;
                Swal.fire({
                    title: 'Backend Apps Script ไม่พร้อมใช้งาน',
                    html: `<div class="text-left text-sm leading-6"><b>${statusText}</b><br>${detail}<br><br><span class="text-gray-500">API: ${escapeHtml(API_URL)}</span></div>`,
                    icon: 'error',
                    confirmButtonText: 'รับทราบ'
                }).then(() => { window.__backendUnavailableNotified = false; });
            }
            return { success: false, error: `${detail} (${statusText})`, backendUnavailable: true, httpStatus: response.status || 0 };
        }
        let result;
        try {
            result = JSON.parse(trimmed);
        } catch (parseError) {
            console.error('Backend API ส่งข้อมูลที่ไม่ใช่ JSON:', parseError, trimmed.slice(0, 180));
            return { success: false, error: 'Backend Apps Script ส่งข้อมูลที่ไม่ใช่ JSON กรุณาตรวจสอบ deployment', backendUnavailable: true, httpStatus: response.status || 0 };
        }
"""
if old not in js:
    raise SystemExit('run() response block not found')
js=js.replace(old,new,1)

# keep production free of trailing whitespace
index='\n'.join(line.rstrip() for line in index.splitlines())+'\n'
js='\n'.join(line.rstrip() for line in js.splitlines())+'\n'
idx.write_text(index,encoding='utf-8')
jsf.write_text(js,encoding='utf-8')
print('patched v4.2.2 backend deployment guard')
