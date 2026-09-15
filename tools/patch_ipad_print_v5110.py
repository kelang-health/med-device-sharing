from pathlib import Path

p = Path('script.js')
s = p.read_text(encoding='utf-8')
s = s.replace('v5.1.9 Smartphone Responsive UX', 'v5.1.10 iPad Safari Print Fix', 1)

old = """    document.body.classList.remove('print-mode-tracking');
    document.body.classList.add('print-mode-receipt');
    try {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.print();
    } finally {
        document.body.classList.remove('print-mode-receipt');
    }
}"""
new = """    document.body.classList.remove('print-mode-tracking');
    document.body.classList.add('print-mode-receipt');
    // iPad/iPhone Safari may return from window.print() before the native preview
    // has finished taking its print snapshot. Keep the print-mode class alive so
    // #print-section remains visible to WebKit while the preview is generated.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 120));
    window.print();
}"""
if old not in s:
    raise SystemExit('printLoanReceipt lifecycle block not found')
s = s.replace(old, new, 1)

old2 = """function printTrackingReport() {
    // พิมพ์รายงานตามรายการที่ผ่านการค้นหา/กรองล่าสุดทั้งหมด (ไม่จำกัดเฉพาะหน้าที่กำลังแสดงอยู่บนจอ)
    document.getElementById('tracking-print-body').innerHTML = buildTrackingRows(trackingFilteredCache, true);
    document.body.classList.add('print-mode-tracking');
    window.print();
    document.body.classList.remove('print-mode-tracking');
}"""
new2 = """function printTrackingReport() {
    // พิมพ์รายงานตามรายการที่ผ่านการค้นหา/กรองล่าสุดทั้งหมด (ไม่จำกัดเฉพาะหน้าที่กำลังแสดงอยู่บนจอ)
    document.getElementById('tracking-print-body').innerHTML = buildTrackingRows(trackingFilteredCache, true);
    document.body.classList.remove('print-mode-receipt');
    document.body.classList.add('print-mode-tracking');
    // Do not remove the class immediately after print(); iOS/iPadOS Safari can
    // return before the native print preview has captured the DOM.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}"""
if old2 not in s:
    raise SystemExit('printTrackingReport lifecycle block not found')
s = s.replace(old2, new2, 1)
p.write_text(s, encoding='utf-8')

p = Path('index.html')
h = p.read_text(encoding='utf-8')
h = h.replace('assets/logo.png?v=5.1.9', 'assets/logo.png?v=5.1.10')
h = h.replace('style.css?v=5.1.9', 'style.css?v=5.1.10')
h = h.replace('script.js?v=5.1.9', 'script.js?v=5.1.10')
h = h.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v5.1.9 |', 'ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v5.1.10 |')
p.write_text(h, encoding='utf-8')
print('patched v5.1.10 iPad Safari print lifecycle')
