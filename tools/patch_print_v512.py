from pathlib import Path
import re

# index.html
p = Path('index.html')
s = p.read_text(encoding='utf-8')
new_section = r'''
    <div id="print-section" class="hidden">
        <div class="loan-print-sheet">
            <div class="loan-print-header">
                <div class="loan-print-logo-cell"><img id="print-logo" src="assets/logo.png?v=4.2.4" alt="ตราหน่วยงาน" class="loan-print-logo" /></div>
                <div class="loan-print-title-cell">
                    <div class="loan-print-form-title">แบบฟอร์มขอยืมอุปกรณ์เครื่องมือทางการแพทย์</div>
                    <div id="print-agency-name" class="loan-print-agency">กำลังโหลดข้อมูลหน่วยงาน...</div>
                </div>
                <div class="loan-print-logo-spacer" aria-hidden="true"></div>
            </div>
            <div class="loan-print-meta">
                <div>เลขที่รายการ <span id="print-entry-id" class="loan-print-fill loan-print-fill-short"></span></div>
                <div>วันที่ <span id="print-date" class="loan-print-fill loan-print-fill-date"></span></div>
            </div>
            <div class="loan-print-section-title">ข้อมูลผู้ยืมและผู้ป่วย</div>
            <div class="loan-print-grid loan-print-grid-2">
                <div class="loan-print-field loan-print-span-2"><span class="loan-print-label">ชื่อ - สกุลผู้ยืม</span><span id="print-borrower" class="loan-print-value"></span></div>
                <div class="loan-print-field"><span class="loan-print-label">เลขประจำตัวประชาชน</span><span id="print-citizen" class="loan-print-value"></span></div>
                <div class="loan-print-field"><span class="loan-print-label">เบอร์โทรศัพท์</span><span id="print-phone" class="loan-print-value"></span></div>
                <div class="loan-print-field"><span class="loan-print-label">ผู้ป่วย</span><span id="print-patient" class="loan-print-value"></span></div>
                <div class="loan-print-field"><span class="loan-print-label">ความสัมพันธ์กับผู้ป่วย</span><span id="print-relation" class="loan-print-value"></span></div>
                <div class="loan-print-field"><span class="loan-print-label">ชุมชน / หมู่บ้าน</span><span id="print-community" class="loan-print-value"></span></div>
                <div class="loan-print-field"><span class="loan-print-label">ที่อยู่</span><span id="print-address" class="loan-print-value"></span></div>
            </div>
            <div class="loan-print-section-title">ข้อมูลการยืมอุปกรณ์</div>
            <div class="loan-print-grid loan-print-grid-2">
                <div class="loan-print-field loan-print-span-2"><span class="loan-print-label">อุปกรณ์ที่ยืม</span><span id="print-equipment" class="loan-print-value"></span></div>
                <div class="loan-print-field"><span class="loan-print-label">วันที่เริ่มยืม</span><span id="print-start-date" class="loan-print-value"></span></div>
                <div class="loan-print-field"><span class="loan-print-label">กำหนดคืน</span><span id="print-end-date" class="loan-print-value"></span></div>
                <div class="loan-print-field"><span class="loan-print-label">เงินมัดจำ</span><span class="loan-print-value"><span id="print-deposit"></span> บาท</span></div>
                <div class="loan-print-field"><span class="loan-print-label">หมายเหตุ</span><span id="print-note" class="loan-print-value"></span></div>
            </div>
            <div class="loan-print-terms">
                <p>ข้าพเจ้ารับทราบว่า หากได้ยืมอุปกรณ์เกิน 6 เดือน จะมิได้เงินคืนค่ามัดจำอุปกรณ์ และหากไม่มีการนำส่งคืนภายในระยะเวลาที่กำหนด ยินยอมให้เจ้าหน้าที่ โทรติดตามสถานะการใช้งานได้ทุกๆ 3 เดือน จนกว่าจะมีการส่งคืนโดยเสร็จสมบูรณ์</p>
                <p>และข้าพเจ้าขอรับรองว่า จะดูแลรักษาอุปกรณ์ที่ยืมเป็นอย่างดี หากกรณีมีความเสียหายใดๆ หรือมีการสูญหายเกิดขึ้น ข้าพเจ้าจะขอรับผิดชอบทั้งหมดทุกกรณีโดยไม่มีเงื่อนไข</p>
                <p>กรณียืมถังออกซิเจนชนิดเติม เมื่อนำมาส่งคืน ข้าพเจ้าจะเติมออกซิเจนให้เต็ม โดยต้องได้รับการผนึกซิลจากร้านค้า เพื่อเป็นการยืนยันว่าออกซิเจนในถัง ได้รับการเติมจนเต็มถังเรียบร้อยแล้ว ซึ่งจะเป็นประโยชน์แก่ผู้รับบริการคนถัดไป ในต่อไปหลังจากนี้</p>
            </div>
            <div class="loan-print-signatures">
                <div><div>ลงชื่อ ......................................................... ผู้ยืม</div><div class="loan-print-sign-name">( <span id="print-sign-borrower"></span> )</div></div>
                <div><div>ลงชื่อ ......................................................... เจ้าหน้าที่ผู้ให้ยืม</div><div class="loan-print-sign-name">( <span id="print-sign-staff"></span> )</div></div>
            </div>
        </div>
    </div>

'''
pattern = r'\n    <div id="print-section".*?(?=\n    <div id="print-tracking-section")'
s, n = re.subn(pattern, '\n' + new_section, s, flags=re.S)
assert n == 1, f'print-section replacement count={n}'
s = s.replace('style.css?v=5.1.0', 'style.css?v=5.1.2')
s = s.replace('script.js?v=5.1.1', 'script.js?v=5.1.2')
p.write_text(s, encoding='utf-8')

# script.js
p = Path('script.js')
s = p.read_text(encoding='utf-8')
new_func = r'''async function printLoanReceipt(entryId) {
    const row = state.data.find(r => String(r.EntryID || r[0] || '') === String(entryId));
    if (!row) {
        Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลแถวสัญญานี้ในคลังระบบ', 'error');
        return;
    }

    const rawDate = row.BorrowDate || row[9];
    const parsedBorrowDate = rawDate ? new Date(rawDate) : new Date();
    const bDate = Number.isNaN(parsedBorrowDate.getTime()) ? new Date() : parsedBorrowDate;
    const dateFormatted = bDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const dueCandidate = getBorrowDueDate(row) || addMonthsClient(bDate, 6) || bDate;
    const dDate = dueCandidate instanceof Date && !Number.isNaN(dueCandidate.getTime()) ? dueCandidate : bDate;
    const endDateFormatted = dDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    const eqId = row.EquipmentID || row[5] || '-';
    const matchedEq = state.equipments.find(e => String(e.EquipmentID || e[0] || '').trim() === String(eqId).trim());
    const agencyText = state.publics.find(item => item['ประเภท'] === 'Agency' || item[0] === 'Agency');
    const logoText = state.publics.find(item => item['ประเภท'] === 'Logo' || item[0] === 'Logo');
    const setText = (id, value, fallback='-') => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value ?? '').trim() || fallback;
    };

    const borrowerName = row.BorrowerName || row.PatientName || row[1] || row[13] || '-';
    const patientName = row.PatientName || row[13] || borrowerName || '-';
    const serial = matchedEq ? (matchedEq.SerialNumber || matchedEq[2] || row.SerialNumber || row[6] || '-') : (row.SerialNumber || row[6] || '-');
    const eqName = matchedEq ? (matchedEq.EquipmentName || matchedEq[1] || '-') : '-';
    const equipmentText = `${eqName} | รหัส ${eqId}${serial && serial !== '-' ? ` | S/N ${serial}` : ''}`;

    setText('print-entry-id', row.EntryID || row[0] || entryId);
    setText('print-date', dateFormatted);
    setText('print-borrower', borrowerName);
    setText('print-citizen', row.CitizenID || row[2] || '-');
    setText('print-phone', row.Phone || row[12] || '-');
    setText('print-patient', patientName);
    setText('print-relation', row.Relationship || row[14] || 'ตนเอง');
    setText('print-community', row.Community || row[4] || '-');
    setText('print-address', row.Address || row[3] || '-');
    setText('print-equipment', equipmentText);
    setText('print-start-date', dateFormatted);
    setText('print-end-date', endDateFormatted);
    setText('print-deposit', row.Deposit || row[15] || '0', '0');
    setText('print-note', row.Note || row[11] || '-');
    setText('print-sign-borrower', borrowerName);
    setText('print-sign-staff', state.adminName || 'เจ้าหน้าที่ผู้มอบ');

    const agencyEl = document.getElementById('print-agency-name');
    if (agencyEl) {
        const title1 = agencyText ? (agencyText['ข้อมูล 1'] || agencyText[1] || '') : '';
        const title2 = agencyText ? (agencyText['ข้อมูล 2'] || agencyText[2] || '') : '';
        agencyEl.innerHTML = title2 ? `${escapeHtml(title1)}<br><span class="loan-print-agency-sub">${escapeHtml(title2)}</span>` : escapeHtml(title1 || 'ศูนย์ยืมคืนอุปกรณ์การแพทย์');
    }

    const printLogoEl = document.getElementById('print-logo');
    if (printLogoEl) {
        const configuredLogo = (logoText && (logoText['ข้อมูล 1'] || logoText[1])) || document.getElementById('nav-logo')?.src || DEFAULT_LOGO;
        const waitForLogo = async () => {
            if (!printLogoEl.complete) {
                await new Promise(resolve => {
                    let finished = false;
                    const done = () => { if (!finished) { finished = true; resolve(); } };
                    printLogoEl.addEventListener('load', done, { once: true });
                    printLogoEl.addEventListener('error', done, { once: true });
                    setTimeout(done, 2500);
                });
            }
            if (typeof printLogoEl.decode === 'function' && printLogoEl.naturalWidth > 0) {
                try { await printLogoEl.decode(); } catch (_) {}
            }
        };
        printLogoEl.src = configuredLogo || DEFAULT_LOGO;
        await waitForLogo();
        if (!printLogoEl.naturalWidth && configuredLogo !== DEFAULT_LOGO) {
            printLogoEl.src = DEFAULT_LOGO;
            await waitForLogo();
        }
    }

    document.body.classList.remove('print-mode-tracking');
    document.body.classList.add('print-mode-receipt');
    try {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.print();
    } finally {
        document.body.classList.remove('print-mode-receipt');
    }
}
'''
pattern = r'async function printLoanReceipt\(entryId\) \{.*?(?=\n// 🗃️ แคชรายการติดตาม)'
s, n = re.subn(pattern, new_func, s, flags=re.S)
assert n == 1, f'printLoanReceipt replacement count={n}'
s = s.replace('Frontend Controller API (v5.1.0 Supabase Full Parity)', 'Frontend Controller API (v5.1.2 Supabase Full Parity)')
p.write_text(s, encoding='utf-8')

# style.css
p = Path('style.css')
s = p.read_text(encoding='utf-8')
new_print = r'''@page{
  size:A4 portrait;
  margin:10mm 11mm;
}
@media print{
  html,body{ margin:0 !important; padding:0 !important; background:#fff !important; color:#000 !important; }
  body *{ visibility:hidden !important; }
  #print-section,#print-tracking-section{ display:none !important; visibility:hidden !important; }
  body.print-mode-receipt #print-section,
  body.print-mode-receipt #print-section *{ visibility:visible !important; }
  body.print-mode-receipt #print-section{ display:block !important; position:absolute; top:0; left:0; width:100%; }
  body.print-mode-receipt #print-tracking-section{ display:none !important; }
  body.print-mode-tracking #print-tracking-section,
  body.print-mode-tracking #print-tracking-section *{ visibility:visible !important; }
  body.print-mode-tracking #print-tracking-section{ display:block !important; position:absolute; top:0; left:0; width:100%; }
  body.print-mode-tracking #print-section{ display:none !important; }
  .loan-print-sheet{ width:100%; max-width:188mm; margin:0 auto; font-family:'Sarabun',sans-serif; font-size:11.5pt; line-height:1.42; color:#000; }
  .loan-print-header{ display:grid; grid-template-columns:27mm 1fr 27mm; align-items:center; column-gap:4mm; padding-bottom:3mm; border-bottom:1.2px solid #000; }
  .loan-print-logo-cell,.loan-print-logo-spacer{ width:27mm; min-height:24mm; display:flex; align-items:center; justify-content:center; }
  .loan-print-logo{ width:22mm; height:22mm; object-fit:contain; display:block; }
  .loan-print-title-cell{ text-align:center; }
  .loan-print-form-title{ font-size:14pt; font-weight:700; margin-bottom:1mm; }
  .loan-print-agency{ font-size:13pt; font-weight:700; line-height:1.35; }
  .loan-print-agency-sub{ font-size:11.5pt; font-weight:600; }
  .loan-print-meta{ display:flex; justify-content:space-between; align-items:flex-end; gap:8mm; margin:3mm 0; font-size:10.5pt; }
  .loan-print-fill{ display:inline-block; min-width:35mm; text-align:center; border-bottom:1px dotted #000; font-weight:600; }
  .loan-print-fill-short{ min-width:32mm; }
  .loan-print-fill-date{ min-width:42mm; }
  .loan-print-section-title{ font-size:11pt; font-weight:700; padding:1.2mm 2mm; border:1px solid #000; border-bottom:0; margin-top:2.5mm; }
  .loan-print-grid{ display:grid; border-top:1px solid #000; border-left:1px solid #000; }
  .loan-print-grid-2{ grid-template-columns:1fr 1fr; }
  .loan-print-field{ display:grid; grid-template-columns:37mm 1fr; min-height:9mm; border-right:1px solid #000; border-bottom:1px solid #000; align-items:stretch; break-inside:avoid; }
  .loan-print-span-2{ grid-column:1 / -1; }
  .loan-print-label{ padding:1.7mm 2mm; font-weight:600; border-right:1px solid #000; display:flex; align-items:center; }
  .loan-print-value{ padding:1.7mm 2mm; min-width:0; overflow-wrap:anywhere; display:flex; align-items:center; font-weight:500; }
  .loan-print-terms{ margin-top:3mm; font-size:10.3pt; line-height:1.42; text-align:justify; }
  .loan-print-terms p{ margin:0 0 1.5mm; text-indent:9mm; }
  .loan-print-signatures{ display:grid; grid-template-columns:1fr 1fr; gap:10mm; margin-top:8mm; text-align:center; font-size:10.5pt; break-inside:avoid; }
  .loan-print-sign-name{ margin-top:2.5mm; }
  .loan-print-sign-name span{ display:inline-block; min-width:48mm; border-bottom:1px dotted #000; font-weight:600; }
}
'''
pattern = r'@media print\{.*?\n\}'
s, n = re.subn(pattern, new_print.rstrip(), s, count=1, flags=re.S)
assert n == 1, f'print CSS replacement count={n}'
p.write_text(s, encoding='utf-8')

print('v5.1.2 print patch applied')
