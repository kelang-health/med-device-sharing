from pathlib import Path
p=Path('script.js');s=p.read_text(encoding='utf-8')

def rep(a,b,label,count=1):
    global s
    if a not in s: raise SystemExit('MISSING '+label)
    s=s.replace(a,b,count)

# safe JS argument for inline handlers that still exist in legacy UI
anchor="function safeCsvCell(value) {"
helper="""function escapeJsSingleQuoted(value) {\n    return String(value ?? '').replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \\\"\\\\'\\\").replace(/\\r/g, '\\\\r').replace(/\\n/g, '\\\\n').replace(/</g, '\\\\x3C').replace(/>/g, '\\\\x3E');\n}\n"""
if 'function escapeJsSingleQuoted' not in s:s=s.replace(anchor,helper+anchor,1)

# Borrow admin buttons / tracking buttons
s=s.replace("viewBorrowImages('${entryId}')","viewBorrowImages('${escapeJsSingleQuoted(entryId)}')")
s=s.replace("printLoanReceipt('${entryId}')","printLoanReceipt('${escapeJsSingleQuoted(entryId)}')")
s=s.replace("editBorrowRecord('${entryId}')","editBorrowRecord('${escapeJsSingleQuoted(entryId)}')")
s=s.replace("processReturnItem('${entryId}')","processReturnItem('${escapeJsSingleQuoted(entryId)}')")
s=s.replace("deleteBorrowRecord('${entryId}')","deleteBorrowRecord('${escapeJsSingleQuoted(entryId)}')")
s=s.replace("openExtendBorrowPrompt('${entryId}')","openExtendBorrowPrompt('${escapeJsSingleQuoted(entryId)}')")

# Equipment/admin id inline handlers
s=s.replace("openEquipmentLifecyclePrompt('${escapeHtml(item.EquipmentID || item[0])}')","openEquipmentLifecyclePrompt('${escapeJsSingleQuoted(item.EquipmentID || item[0])}')")
s=s.replace("deleteEquipmentRecord('${escapeHtml(item.EquipmentID || item[0])}')","deleteEquipmentRecord('${escapeJsSingleQuoted(item.EquipmentID || item[0])}')")
s=s.replace("setAdminUserActivePrompt('${escapeHtml(u.adminId)}'","setAdminUserActivePrompt('${escapeJsSingleQuoted(u.adminId)}'")

# SweetAlert HTML must escape patient/equipment values
s=s.replace("<div><b>อุปกรณ์:</b> ${eqId}</div>","<div><b>อุปกรณ์:</b> ${escapeHtml(eqId)}</div>")
s=s.replace("<div><b>ผู้ยืม/ผู้ป่วย:</b> ${patient}</div>","<div><b>ผู้ยืม/ผู้ป่วย:</b> ${escapeHtml(patient)}</div>")

# Maintenance wording for full package backup
s=s.replace("text:'ระบบจะทำสำเนา Spreadsheet ไปยังโฟลเดอร์ System Backups โดยไม่แก้ข้อมูลต้นฉบับ'","text:'ระบบจะสร้างชุดสำรองแยก ประกอบด้วย Spreadsheet + รูปหลักฐาน + config snapshot ที่ตัด credential ออก โดยไม่แก้ข้อมูลต้นฉบับ'")

# map popup: ensure equipment ID escaped as well
s=s.replace("📌 รหัสพัสดุ: ${item.EquipmentID || item[5]}","📌 รหัสพัสดุ: ${escapeHtml(item.EquipmentID || item[5] || '-')}")

# normalize any remaining old backend hints
s=s.replace('Backend v4.0.0','Backend v4.1.1').replace('Backend v3.9.0','Backend v4.1.1')

s='\n'.join(x.rstrip() for x in s.splitlines())+'\n';p.write_text(s,encoding='utf-8');print('hardened v4.1.1 frontend')