from pathlib import Path

p=Path('script.js'); s=p.read_text(encoding='utf-8')
s=s.replace("state.role = res.role || 'STAFF';", "state.role = res.role || getSessionValue('role') || 'ADMIN';", 1)
s=s.replace("setSessionValue('role', res.role || 'STAFF');", "setSessionValue('role', res.role || 'ADMIN');", 1)
p.write_text(s,encoding='utf-8')

p=Path('index.html'); h=p.read_text(encoding='utf-8')
h=h.replace('เข้าสู่ระบบ Admin','เข้าสู่ระบบเจ้าหน้าที่')
h=h.replace('เข้าสู่ระบบสิทธิ์แอดมิน (Admin Login)','เข้าสู่ระบบเจ้าหน้าที่')
h=h.replace('เพิ่มผู้ใช้งานสิทธิ์ Admin ใหม่','เพิ่มผู้ใช้งานระบบ')
h=h.replace('เพิ่มเฉพาะคอลัมน์/ชีตที่ขาดสำหรับระบบยืมต่อ โดยไม่ลบ ไม่ clear และไม่เขียนทับข้อมูลเดิม','เพิ่มเฉพาะคอลัมน์/ชีตที่ขาดสำหรับ Role, Audit, VOID และ LINE โดยไม่ลบ ไม่ clear และไม่เขียนทับข้อมูลเดิม')
needle='''                    <input type="password" id="new-admin-password" placeholder="อย่างน้อย 8 ตัวอักษร" minlength="8" class="w-full border border-gray-200 px-3 py-2 rounded-xl focus:outline-none" required />\n                </div>'''
role='''                    <input type="password" id="new-admin-password" placeholder="อย่างน้อย 8 ตัวอักษร" minlength="8" class="w-full border border-gray-200 px-3 py-2 rounded-xl focus:outline-none" required />\n                </div>\n                <div>\n                    <label class="block font-bold text-gray-500 mb-1">สิทธิ์ใช้งาน</label>\n                    <select id="new-admin-role" class="w-full border border-gray-200 px-3 py-2 rounded-xl bg-white focus:outline-none">\n                        <option value="STAFF">STAFF — ยืม/คืน/ติดตาม</option>\n                        <option value="ADMIN">ADMIN — จัดการระบบทั้งหมด</option>\n                    </select>\n                </div>'''
if 'id="new-admin-role"' not in h:
    if needle not in h: raise SystemExit('password anchor missing')
    h=h.replace(needle,role,1)
p.write_text(h,encoding='utf-8')
