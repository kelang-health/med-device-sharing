from pathlib import Path

idx = Path('index.html')
css = Path('style.css')
js = Path('script.js')

s = idx.read_text(encoding='utf-8')

# cache bust / visible frontend version only
s = s.replace('style.css?v=4.1.1', 'style.css?v=4.1.2')
s = s.replace('script.js?v=4.1.1', 'script.js?v=4.1.2')
s = s.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v4.1.1 |', 'ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v4.1.2 |')

# schema label must reflect the actual schema level, not old v4.1.0 text
s = s.replace('โครงสร้างข้อมูลระบบ v4.1.0', 'โครงสร้างข้อมูลระบบ v4.1.1')
s = s.replace('อัปเกรดโครงสร้าง v4.1.0', 'อัปเกรดโครงสร้าง v4.1.1')

# Maintenance buttons: use dedicated classes so visibility does not depend on Tailwind palette availability.
repls = {
'''<button type="button" onclick="saveBackupSchedule()" class="mt-3 w-full bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold">''':
'''<button type="button" onclick="saveBackupSchedule()" class="maintenance-action maintenance-action-primary-cyan mt-3 w-full text-xs">''',
'''<button type="button" onclick="createBackupNow()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold">''':
'''<button type="button" onclick="createBackupNow()" class="maintenance-action maintenance-action-primary-emerald text-xs">''',
'''<button type="button" onclick="archiveOldAuditLogUi()" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 px-4 py-2.5 rounded-xl text-xs font-bold">''':
'''<button type="button" onclick="archiveOldAuditLogUi()" class="maintenance-action maintenance-action-indigo text-xs">''',
'''<button type="button" onclick="scanOrphanFilesUi()" class="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100 px-4 py-2.5 rounded-xl text-xs font-bold">''':
'''<button type="button" onclick="scanOrphanFilesUi()" class="maintenance-action maintenance-action-amber text-xs">''',
'''<button type="button" onclick="secureBorrowImagesUi()" class="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-100 px-4 py-2.5 rounded-xl text-xs font-bold">''':
'''<button type="button" onclick="secureBorrowImagesUi()" class="maintenance-action maintenance-action-cyan text-xs">''',
'''<button type="button" onclick="cleanupOrphanFilesUi()" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 px-4 py-2.5 rounded-xl text-xs font-bold">''':
'''<button type="button" onclick="cleanupOrphanFilesUi()" class="maintenance-action maintenance-action-rose text-xs">''',
'''<button type="button" onclick="cleanupArchiveLogsUi()" class="sm:col-span-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold">''':
'''<button type="button" onclick="cleanupArchiveLogsUi()" class="maintenance-action maintenance-action-slate sm:col-span-2 text-xs">'''
}
for old, new in repls.items():
    if old not in s:
        raise SystemExit('missing maintenance button marker: ' + old[:80])
    s = s.replace(old, new, 1)

idx.write_text(s, encoding='utf-8')

c = css.read_text(encoding='utf-8')
block = r'''

/* v4.1.2 — Maintenance actions use explicit colors so controls stay visible even when
   the legacy Tailwind 2 CDN does not provide every newer palette utility. */
.maintenance-action{
  width:100%; min-height:44px; padding:10px 16px;
  display:flex; align-items:center; justify-content:center; gap:6px;
  border-radius:12px; border:1px solid transparent;
  font-weight:700; line-height:1.35; cursor:pointer;
  transition:background-color .15s ease,border-color .15s ease,box-shadow .15s ease,transform .08s ease;
  box-shadow:0 1px 2px rgba(15,23,42,.04);
}
.maintenance-action:hover{ box-shadow:0 4px 12px -7px rgba(15,23,42,.28); }
.maintenance-action:active{ transform:translateY(1px); }
.maintenance-action-primary-cyan{ background:#0891b2 !important; color:#fff !important; border-color:#0e7490 !important; }
.maintenance-action-primary-cyan:hover{ background:#0e7490 !important; }
.maintenance-action-primary-emerald{ background:#059669 !important; color:#fff !important; border-color:#047857 !important; }
.maintenance-action-primary-emerald:hover{ background:#047857 !important; }
.maintenance-action-indigo{ background:#eef2ff !important; color:#4338ca !important; border-color:#c7d2fe !important; }
.maintenance-action-indigo:hover{ background:#e0e7ff !important; }
.maintenance-action-amber{ background:#fffbeb !important; color:#b45309 !important; border-color:#fde68a !important; }
.maintenance-action-amber:hover{ background:#fef3c7 !important; }
.maintenance-action-cyan{ background:#ecfeff !important; color:#0e7490 !important; border-color:#a5f3fc !important; }
.maintenance-action-cyan:hover{ background:#cffafe !important; }
.maintenance-action-rose{ background:#fff1f2 !important; color:#be123c !important; border-color:#fecdd3 !important; }
.maintenance-action-rose:hover{ background:#ffe4e6 !important; }
.maintenance-action-slate{ background:#f1f5f9 !important; color:#334155 !important; border-color:#cbd5e1 !important; }
.maintenance-action-slate:hover{ background:#e2e8f0 !important; }
html[data-theme="dark"] .maintenance-action-indigo{ background:#25234a !important; color:#c7d2fe !important; border-color:#4338ca !important; }
html[data-theme="dark"] .maintenance-action-amber{ background:#3a2a13 !important; color:#fcd34d !important; border-color:#92400e !important; }
html[data-theme="dark"] .maintenance-action-cyan{ background:#12343d !important; color:#67e8f9 !important; border-color:#155e75 !important; }
html[data-theme="dark"] .maintenance-action-rose{ background:#3b1722 !important; color:#fda4af !important; border-color:#9f1239 !important; }
html[data-theme="dark"] .maintenance-action-slate{ background:#1e293b !important; color:#cbd5e1 !important; border-color:#475569 !important; }
'''
if 'v4.1.2 — Maintenance actions' not in c:
    c += block
css.write_text(c, encoding='utf-8')

j = js.read_text(encoding='utf-8')
j = j.replace('(v4.1.1 Stabilization & Safety Fix)', '(v4.1.2 Maintenance UI Visibility Hotfix)', 1)
js.write_text(j, encoding='utf-8')

print('patched v4.1.2 maintenance UI')
