# med-device-sharing

ระบบบริหารจัดการศูนย์ยืมคืนกายอุปกรณ์ทางการแพทย์เพื่อชุมชน

- Production: https://kelang-health.github.io/med-device-sharing/
- Frontend: GitHub Pages (`index.html`, `script.js`, `style.css`)
- Backend: Google Apps Script (`Code.gs` ไฟล์เดียว)
- Data: Google Sheets + Google Drive
- Current version: **v3.6**

## v3.6
- Role: `ADMIN` / `STAFF`
- Audit Log สำหรับตรวจสอบย้อนหลัง
- รายการยืมใช้ `VOID` แทนการลบจริง
- อุปกรณ์ใช้ `Inactive` แทนการลบจริง
- ป้องกัน CSV Formula Injection
- เตรียม LINE OA Push Notification และสรุปติดตามรายวัน
- LINE Channel Access Token เก็บใน Apps Script Script Properties เท่านั้น

## Safe Schema Upgrade
การอัปเกรดโครงสร้างเป็นแบบ non-destructive: ระบบเพิ่มเฉพาะชีต/คอลัมน์ที่ขาด โดยไม่ `clear`, ไม่ลบแถว และไม่เขียนทับค่าข้อมูลเดิม

## Deploy Backend
1. นำ `Code.gs` รุ่นเดียวกับ frontend ไปแทน backend เดิม
2. Deploy ผ่าน Apps Script Web App deployment เดิม เพื่อคง API URL
3. Login ด้วย ADMIN
4. ไปที่ Settings แล้วกดอัปเกรดโครงสร้าง

## Rollback
ก่อนการอัปเกรดหลักจะสร้าง branch `backup/...` จาก `main` เพื่อใช้ย้อนกลับเมื่อจำเป็น

## Security
ห้าม commit รหัสผ่าน, LINE Channel Access Token หรือ secret ใด ๆ ลง repository
