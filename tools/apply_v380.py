from pathlib import Path
import re

idx=Path('index.html')
jsf=Path('script.js')
index=idx.read_text(encoding='utf-8')
js=jsf.read_text(encoding='utf-8')

def must_replace(text, old, new, label):
    if old not in text:
        raise SystemExit(f'MISSING {label}')
    return text.replace(old,new,1)

# VERSION / CACHE
index=index.replace('style.css?v=3.7.0','style.css?v=3.8.0')
index=index.replace('script.js?v=3.7.0','script.js?v=3.8.0')
index=index.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.7.0','ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v3.8.0')
index=index.replace('โครงสร้างข้อมูลระบบ v3.6','โครงสร้างข้อมูลระบบ v3.8.0')
index=index.replace('อัปเกรดโครงสร้าง v3.6','อัปเกรดโครงสร้าง v3.8.0')
js=js.replace('Frontend Controller API (v3.7.0 LINE Automation & Event Alerts)','Frontend Controller API (v3.8.0 Equipment Lifecycle)')
js=js.replace('โครงสร้างข้อมูลพร้อมใช้งาน v3.6','โครงสร้างข้อมูลพร้อมใช้งาน v3.8.0')
js=js.replace('อัปเกรดโครงสร้างเป็น v3.6?','อัปเกรดโครงสร้างเป็น v3.8.0?')
js=js.replace('อัปเกรดโครงสร้าง v3.6','อัปเกรดโครงสร้าง v3.8.0')

# EQUIPMENT FILTER OPTIONS
old='''                        <option value="all">📁 แสดงสถานะทั้งหมด</option>\n                        <option value="available">🟢 พร้อมใช้งาน (ว่าง)</option>\n                        <option value="borrowed">🔴 ถูกยืมไปใช้งาน</option>'''
new='''                        <option value="all">📁 แสดงสถานะทั้งหมด</option>\n                        <option value="available">🟢 พร้อมใช้งาน</option>\n                        <option value="borrowed">🔴 กำลังถูกยืม</option>\n                        <option value="cleaning">🧼 รอทำความสะอาด</option>\n                        <option value="inspection">🔎 รอตรวจสอบ</option>\n                        <option value="maintenance">🛠️ ส่งซ่อม/บำรุงรักษา</option>\n                        <option value="damaged">⚠️ ชำรุด</option>\n                        <option value="lost">❗ สูญหาย</option>\n                        <option value="retired">⛔ ปลดระวาง</option>'''
index=must_replace(index,old,new,'equipment status filter')

# LINE EVENT - lifecycle status changes
old='''                            <label class="flex items-center gap-2 rounded-lg border border-white bg-white p-2.5 cursor-pointer"><input id="line-event-eq-inactive" type="checkbox" class="accent-emerald-600 h-4 w-4"> มีการปิดใช้งานอุปกรณ์</label>'''
new=old+'''\n                            <label class="flex items-center gap-2 rounded-lg border border-white bg-white p-2.5 cursor-pointer"><input id="line-event-eq-status" type="checkbox" class="accent-emerald-600 h-4 w-4"> เปลี่ยนสถานะ/ส่งซ่อมอุปกรณ์</label>'''
index=must_replace(index,old,new,'line lifecycle event checkbox')

# EQUIPMENT STATUS HELPER
old='''function getEquipmentStatus(eq, borrowedSet) {\n    const eqId = String(eq.EquipmentID || eq[0] || '').trim();\n    const set = borrowedSet || getBorrowedEquipmentIdSet();\n    return set.has(eqId) ? 'Borrowed' : 'Available';\n}'''
new='''function getEquipmentStatus(eq, borrowedSet) {\n    const eqId = String(eq.EquipmentID || eq[0] || '').trim();\n    const set = borrowedSet || getBorrowedEquipmentIdSet();\n    if (set.has(eqId)) return 'Borrowed';\n    const stored = String(eq.Status || eq[3] || 'Available').trim();\n    const allowed = ['Available','Cleaning','Inspection','Maintenance','Damaged','Lost','Retired'];\n    return allowed.includes(stored) ? stored : 'Available';\n}\n\nfunction getEquipmentLifecycleMeta(status) {\n    const map = {\n        Available:{label:'พร้อมใช้งาน',icon:'fa-circle-check',cls:'bg-emerald-50 text-emerald-700 border-emerald-100'},\n        Borrowed:{label:'กำลังยืม',icon:'fa-handshake',cls:'bg-rose-50 text-rose-700 border-rose-100'},\n        Cleaning:{label:'รอทำความสะอาด',icon:'fa-soap',cls:'bg-cyan-50 text-cyan-700 border-cyan-100'},\n        Inspection:{label:'รอตรวจสอบ',icon:'fa-magnifying-glass',cls:'bg-amber-50 text-amber-700 border-amber-100'},\n        Maintenance:{label:'ส่งซ่อม/บำรุง',icon:'fa-screwdriver-wrench',cls:'bg-orange-50 text-orange-700 border-orange-100'},\n        Damaged:{label:'ชำรุด',icon:'fa-triangle-exclamation',cls:'bg-red-50 text-red-700 border-red-100'},\n        Lost:{label:'สูญหาย',icon:'fa-circle-exclamation',cls:'bg-purple-50 text-purple-700 border-purple-100'},\n        Retired:{label:'ปลดระวาง',icon:'fa-ban',cls:'bg-gray-100 text-gray-600 border-gray-200'}\n    };\n    return map[status] || map.Available;\n}'''
js=must_replace(js,old,new,'getEquipmentStatus')

# EQUIPMENT FILTER LOGIC
old='''    const filtered = state.equipments.filter(item => {\n        const isAvailable = getEquipmentStatus(item, borrowedSet) === 'Available';\n\n        let statusMatch = true;\n        if (statusFilter === 'available') statusMatch = isAvailable;\n        if (statusFilter === 'borrowed') statusMatch = !isAvailable;'''
new='''    const filtered = state.equipments.filter(item => {\n        const lifecycleStatus = getEquipmentStatus(item, borrowedSet);\n\n        let statusMatch = true;\n        if (statusFilter !== 'all') statusMatch = lifecycleStatus.toLowerCase() === statusFilter;'''
js=must_replace(js,old,new,'equipment filter logic')

# EQUIPMENT BADGE
old='''            const status = getEquipmentStatus(item, borrowedSet);\n            let statusBadge = (status === 'Available') ?\n                `<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"><i class="fa-solid fa-check-circle mr-1"></i>ว่างพร้อมใช้</span>` :\n                `<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-100"><i class="fa-solid fa-handshake mr-1"></i>ถูกยืมไปคลัง</span>`;'''
new='''            const status = getEquipmentStatus(item, borrowedSet);\n            const meta = getEquipmentLifecycleMeta(status);\n            const statusBadge = `<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full border ${meta.cls}"><i class="fa-solid ${meta.icon} mr-1"></i>${meta.label}</span>`;'''
js=must_replace(js,old,new,'equipment lifecycle badge')

# EQUIPMENT ROW ACTION
old='''                <td class="p-3 print:hidden">\n                    <button onclick="deleteEquipmentRecord('${item.EquipmentID || item[0]}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-lg transition"><i class="fa-solid fa-trash-can text-xs"></i></button>\n                </td>'''
new='''                <td class="p-3 print:hidden">\n                    <div class="flex items-center gap-1">\n                        <button onclick="openEquipmentLifecyclePrompt('${escapeHtml(item.EquipmentID || item[0])}')" class="bg-amber-50 hover:bg-amber-100 text-amber-700 p-1.5 rounded-lg transition" title="เปลี่ยนสถานะ/ซ่อม"><i class="fa-solid fa-screwdriver-wrench text-xs"></i></button>\n                        <button onclick="deleteEquipmentRecord('${escapeHtml(item.EquipmentID || item[0])}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-lg transition" title="ปิดใช้งาน"><i class="fa-solid fa-ban text-xs"></i></button>\n                    </div>\n                </td>'''
js=must_replace(js,old,new,'equipment row actions')

# RETURN FLOW
pat=r"function processReturnItem\(id\) \{.*?\n\}\n\n(?=async function|function)"
new_return=r'''async function processReturnItem(id) {\n    const html = `\n      <div class="text-left text-sm">\n        <label class="block font-bold text-gray-700 mb-1">สภาพอุปกรณ์เมื่อรับคืน</label>\n        <select id="return-condition" class="swal2-select" style="display:flex;width:100%;margin:0 0 12px 0">\n          <option value="Available">พร้อมใช้งาน</option>\n          <option value="Cleaning">ต้องทำความสะอาด</option>\n          <option value="Inspection">รอตรวจสอบ</option>\n          <option value="Maintenance">ส่งซ่อม/บำรุงรักษา</option>\n          <option value="Damaged">ชำรุด</option>\n          <option value="Lost">สูญหาย</option>\n        </select>\n        <label class="block font-bold text-gray-700 mb-1">บันทึกสภาพ / การดำเนินการ</label>\n        <textarea id="return-condition-note" class="swal2-textarea" style="display:flex;width:100%;margin:0" placeholder="เช่น สภาพสมบูรณ์, ต้องเปลี่ยนลูกยาง, ส่งซ่อมล้อ..."></textarea>\n        <p class="text-xs text-gray-500 mt-2">ถ้าเลือกสถานะอื่นนอกจาก “พร้อมใช้งาน” ต้องระบุรายละเอียดอย่างน้อย 3 ตัวอักษร และอุปกรณ์จะยังไม่กลับเข้ารายการพร้อมยืม</p>\n      </div>`;\n    const result = await Swal.fire({\n        title:'รับคืนและตรวจสภาพอุปกรณ์', html, icon:'question', showCancelButton:true,\n        confirmButtonText:'ยืนยันรับคืน', cancelButtonText:'ยกเลิก',\n        preConfirm:()=>{\n            const condition=document.getElementById('return-condition').value;\n            const note=(document.getElementById('return-condition-note').value||'').trim();\n            if(condition!=='Available' && note.length<3){Swal.showValidationMessage('กรุณาระบุรายละเอียดสภาพอุปกรณ์อย่างน้อย 3 ตัวอักษร');return false;}\n            return {condition,note};\n        }\n    });\n    if(!result.isConfirmed)return;\n    Swal.fire({ title:'กำลังบันทึกรับคืนและสถานะอุปกรณ์...', allowOutsideClick:false, didOpen:()=>Swal.showLoading() });\n    const v=result.value||{};\n    const res=await run('returnBorrow',{EntryID:id,ReturnDate:new Date().toISOString(),ReturnCondition:v.condition,ReturnConditionNote:v.note,Note:v.note||'คืนสภาพปกติ'});\n    if(res.success){\n        await Swal.fire('รับคืนเสร็จสิ้น',`สถานะอุปกรณ์: ${escapeHtml(res.equipmentStatusLabel||getEquipmentLifecycleMeta(v.condition).label)}`,'success');\n        await loadSystemData();\n    }else{\n        Swal.fire('ไม่สำเร็จ',res.error||'เกิดข้อผิดพลาดในการบันทึกการคืนอุปกรณ์','error');\n    }\n}\n\n'''
js,n=re.subn(pat,new_return,js,count=1,flags=re.S)
if n!=1: raise SystemExit(f'processReturnItem replace count={n}')

needle='async function deleteEquipmentRecord(eqId) {'
if needle not in js: raise SystemExit('deleteEquipmentRecord needle missing')
lifecycle_func=r'''async function openEquipmentLifecyclePrompt(eqId) {\n    if(state.role!=='ADMIN'){Swal.fire('สงวนสิทธิ์ ADMIN','การเปลี่ยนสถานะคลังใช้ได้เฉพาะ ADMIN','warning');return;}\n    const item=state.equipments.find(e=>String(e.EquipmentID||e[0])===String(eqId));\n    const current=getEquipmentStatus(item||{},getBorrowedEquipmentIdSet());\n    if(current==='Borrowed'){Swal.fire('ยังเปลี่ยนไม่ได้','อุปกรณ์กำลังถูกยืม ต้องรับคืนก่อนจึงเปลี่ยนสถานะคลังได้','warning');return;}\n    const options={Available:'พร้อมใช้งาน',Cleaning:'รอทำความสะอาด',Inspection:'รอตรวจสอบ',Maintenance:'ส่งซ่อม/บำรุงรักษา',Damaged:'ชำรุด',Lost:'สูญหาย',Retired:'ปลดระวาง'};\n    const result=await Swal.fire({\n        title:`สถานะอุปกรณ์ ${escapeHtml(eqId)}`,\n        input:'select', inputOptions:options, inputValue:current, inputLabel:'เลือกสถานะใหม่',\n        html:'<p class="text-xs text-gray-500 mb-2">สถานะที่ไม่ใช่ “พร้อมใช้งาน” จะถูกกันออกจากรายการอุปกรณ์ที่สามารถยืมได้</p>',\n        showCancelButton:true, confirmButtonText:'ถัดไป', cancelButtonText:'ยกเลิก'\n    });\n    if(!result.isConfirmed)return;\n    const status=result.value;\n    let note='';\n    if(status!=='Available'){\n        const n=await Swal.fire({title:'รายละเอียดการดำเนินการ',input:'textarea',inputPlaceholder:'เช่น รอทำความสะอาด, ส่งร้านซ่อม, ชำรุดที่ล้อ...',showCancelButton:true,confirmButtonText:'บันทึกสถานะ',inputValidator:v=>String(v||'').trim().length<3?'กรุณาระบุอย่างน้อย 3 ตัวอักษร':undefined});\n        if(!n.isConfirmed)return; note=String(n.value||'').trim();\n    }\n    const res=await run('setEquipmentLifecycle',{EquipmentID:eqId,status,note});\n    if(res.success){await Swal.fire('อัปเดตสถานะแล้ว',res.label||getEquipmentLifecycleMeta(status).label,'success');await loadSystemData();}\n    else Swal.fire('ไม่สำเร็จ',res.error||'ไม่สามารถเปลี่ยนสถานะอุปกรณ์ได้','error');\n}\n\n'''
js=js.replace(needle,lifecycle_func+needle,1)

js=js.replace("'line-event-eq-add':'CREATE_EQUIPMENT','line-event-void':'VOID_BORROW','line-event-eq-inactive':'DEACTIVATE_EQUIPMENT'",
              "'line-event-eq-add':'CREATE_EQUIPMENT','line-event-void':'VOID_BORROW','line-event-eq-inactive':'DEACTIVATE_EQUIPMENT','line-event-eq-status':'EQUIPMENT_STATUS'")
js=js.replace("DEACTIVATE_EQUIPMENT:!!document.getElementById('line-event-eq-inactive')?.checked\n    };",
              "DEACTIVATE_EQUIPMENT:!!document.getElementById('line-event-eq-inactive')?.checked,\n        EQUIPMENT_STATUS:!!document.getElementById('line-event-eq-status')?.checked\n    };")
js=js.replace("`ปรับปรุงข้อมูล ${res.updatedCount} รายการ (กำลังยืม ${res.totalBorrowed} จากทั้งหมด ${res.totalEquipments} ชิ้น)`",
              "`ปรับปรุงข้อมูล ${res.updatedCount} รายการ (กำลังยืม ${res.totalBorrowed} จากทั้งหมด ${res.totalEquipments} ชิ้น; คงสถานะ lifecycle ${res.preservedLifecycle||0} ชิ้น)`")

idx.write_text(index,encoding='utf-8')
jsf.write_text(js,encoding='utf-8')
print('patched index/script to v3.8.0')
