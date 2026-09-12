/**
 * ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ - Frontend Controller API (v3.6 Audit & Security)
 * พัฒนาโดย: ศบส.บ้านโทกหัวช้าง (James)
 */

const API_URL = "https://script.google.com/macros/s/AKfycbzPHiANxxUEHUoAKyK1hHfGWuZN_ihkI8xQ3WXkLyPFG5DDONW5limoB-h6egfOsNKgzA/exec"; 



const STORAGE_KEYS = {
    token: 'medDevice.adminToken',
    adminId: 'medDevice.adminId',
    adminName: 'medDevice.adminName',
    theme: 'medDevice.themeMode',
    role: 'medDevice.role'
};

function getSessionToken() {
    return localStorage.getItem(STORAGE_KEYS.token) || '';
}

function setSessionValue(key, value) {
    if (value === undefined || value === null) return;
    localStorage.setItem(STORAGE_KEYS[key], String(value));
}

function getSessionValue(key) {
    return localStorage.getItem(STORAGE_KEYS[key]) || '';
}

function migrateLegacyStorage() {
    const legacyMap = {
        adminToken: STORAGE_KEYS.token,
        adminId: STORAGE_KEYS.adminId,
        adminName: STORAGE_KEYS.adminName,
        themeMode: STORAGE_KEYS.theme
    };
    Object.entries(legacyMap).forEach(([legacy, target]) => {
        if (!localStorage.getItem(target) && localStorage.getItem(legacy)) {
            localStorage.setItem(target, localStorage.getItem(legacy));
        }
    });
    ['adminToken', 'adminId', 'adminName', 'themeMode'].forEach(k => localStorage.removeItem(k));
}

function clearAuthSession() {
    [STORAGE_KEYS.token, STORAGE_KEYS.adminId, STORAGE_KEYS.adminName, 'adminToken', 'adminId', 'adminName']
        .forEach(k => localStorage.removeItem(k));
    state.isAdmin = false;
    state.adminId = '';
    state.adminName = '';
    state.role = '';
    localStorage.removeItem(STORAGE_KEYS.role);
}


function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function safeCsvCell(value) {
    let cell = value === null || value === undefined ? '' : String(value);
    if (/^[=+@-]/.test(cell)) cell = "'" + cell;
    return `"${cell.replace(/"/g, '""')}"`;
}

const DEFAULT_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="30" fill="%23e0e7ff"/><circle cx="60" cy="60" r="40" fill="%234f46e5"/><path d="M60 42v36M42 60h36" stroke="white" stroke-width="10" stroke-linecap="round"/></svg>';

let state = {
    isAdmin: false,
    adminId: '',
    adminName: '',
    role: '',
    data: [],       
    publics: [],    
    equipments: [],
    publicSummary: null,
    currentTab: 'dashboard'
};
// ตัวแปรควบคุมระบบการแบ่งหน้าแสดงผลทั้ง 3 ส่วนหลัก (หน้าละ 20 แถว)
let publicCurrentPage = 1;
let equipCurrentPage = 1;
let trackingCurrentPage = 1;
const rowsPerPageLimit = 20; // ล็อกเป้าหมายการแสดงผลไว้ที่หน้าละ 20 แถวถ้วนตามกำหนด
// ตัวแปรควบคุมระบบการแบ่งหน้าแสดงผลพาร์ทแอดมิน (Pagination States)
let adminCurrentPage = 1;
const adminPageLimit = 10; // แสดงผลแถวข้อมูลรายการยืมเพจละ 10 รายการ

let mapInstance = null;
let communityLayers = {};
let mapLayerControl = null;
let borrowPhotos = []; // เก็บรูปหลักฐานที่แนบในฟอร์มยืม (base64 data URL) สูงสุด 3 รูป
let editingBorrowId = null; // ถ้าไม่ใช่ null แปลว่ากำลังอยู่ในโหมด "แก้ไขรายการยืมเดิม" (ไม่ใช่สร้างใหม่)
let existingBorrowImageIds = []; // รหัสไฟล์รูปภาพเดิมที่แนบไว้แล้ว (ตอนแก้ไขรายการ) ที่ผู้ใช้ยังต้องการเก็บไว้

async function run(action, payload = {}) {
    const sessionToken = getSessionToken();
    if (sessionToken) payload.token = sessionToken;
    if (!API_URL || API_URL === "YOUR_GAS_WEB_APP_URL") {
        console.error("ยังไม่ได้ระบุที่อยู่เว็บบริการ API_URL ของระบบ");
        return { success: false, error: 'ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์เชื่อมต่อ' };
    }
    // ⏱️ กันไม่ให้คำขอค้างรอตลอดไปแบบไม่มีกำหนด (โดยเฉพาะตอนอัปโหลดรูปภาพที่ Google Apps Script อาจใช้เวลานานผิดปกติ)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 วินาที
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: action, payload: payload }),
            signal: controller.signal
        });
        const result = await response.json();
        // 🔒 หาก Token หมดอายุ/ไม่ถูกต้อง (เช่น เกิน 6 ชม. หลังล็อกอิน) ให้แจ้งเตือนชัดเจนและพากลับไปหน้าล็อกอินใหม่
        // แทนที่จะปล่อยให้ทุกฟังก์ชันขึ้น "ไม่สำเร็จ" แบบไม่ทราบสาเหตุ
        if (result && result.needLogin) {
            if (!window.__sessionExpiredNotified) {
                window.__sessionExpiredNotified = true;
                clearAuthSession();
                Swal.fire('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่อีกครั้งเพื่อดำเนินการต่อ', 'warning').then(() => {
                    window.location.reload();
                });
            }
            return { success: false, error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง', needLogin: true };
        }
        return result;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error("คำขอใช้เวลานานเกินไป (เกิน 90 วินาที):", action);
            return { success: false, error: 'การเชื่อมต่อใช้เวลานานเกินไป (เกิน 90 วินาที) กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง' };
        }
        console.error("การเชื่อมต่อระบบเซิร์ฟเวอร์ API ล้มเหลว:", error);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    migrateLegacyStorage();
    initThemeMode();
    await checkAuthSession();
    await loadSystemData();
    const borrowDate = document.getElementById('borrow-date');
    if (borrowDate) borrowDate.valueAsDate = new Date();
});

// 🌗 ระบบสลับโหมดมืด/สว่าง (Dark / Light Mode) พร้อมจดจำค่าที่เลือกไว้ล่าสุด
function initThemeMode() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = saved || (prefersDark ? 'dark' : 'light');
    applyThemeMode(mode);
}

function applyThemeMode(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(STORAGE_KEYS.theme, mode);
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.className = mode === 'dark' ? 'fa-solid fa-sun text-sm' : 'fa-solid fa-moon text-sm';
}

function toggleThemeMode() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyThemeMode(current === 'dark' ? 'light' : 'dark');
}

// 🔧 สั่งให้เซิร์ฟเวอร์ซ่อมแซมสถานะครุภัณฑ์ในชีต Equipments ให้ตรงกับ BorrowLog จริงเสมอ
async function runEquipmentStatusSync() {
    Swal.fire({ title: 'กำลังตรวจสอบและซิงค์สถานะคลังพัสดุ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const res = await run('syncEquipmentStatus', {});
        if (res.success) {
            Swal.fire('ซิงค์สถานะสำเร็จ', `ปรับปรุงข้อมูล ${res.updatedCount} รายการ (กำลังยืม ${res.totalBorrowed} จากทั้งหมด ${res.totalEquipments} ชิ้น)`, 'success');
            await loadSystemData();
        } else {
            Swal.fire('ไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาดระหว่างซิงค์สถานะ', 'error');
        }
    } catch (e) {
        Swal.fire('ล้มเหลว', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    }
}

function applyAdminSessionUi() {
    const sidebar=document.getElementById('sidebar'),wrapper=document.getElementById('main-wrapper');
    if(sidebar)sidebar.classList.remove('hidden'); if(wrapper)wrapper.classList.add('md:pl-64');
    const brand=document.getElementById('public-header-brand'),loginBtn=document.getElementById('btn-login-trigger'),info=document.getElementById('logged-admin-info'),displayName=document.getElementById('display-admin-name'),pdpaBadge=document.getElementById('pdpa-badge'),borrowLog=document.getElementById('borrow-log-section');
    if(brand)brand.classList.add('md:hidden'); if(loginBtn)loginBtn.classList.add('hidden'); if(info)info.classList.remove('hidden');
    if(displayName)displayName.innerText=`${state.role==='ADMIN'?'ADMIN':'STAFF'}: ${state.adminName||'-'}`;
    if(pdpaBadge)pdpaBadge.classList.remove('hidden'); if(borrowLog)borrowLog.classList.remove('hidden');
    document.querySelectorAll('.admin-only').forEach(el=>el.classList.remove('hidden'));
    document.querySelectorAll('.admin-role-only').forEach(el=>el.classList.toggle('hidden',state.role!=='ADMIN'));
}

async function checkAuthSession() {
    const token = getSessionToken();
    if (!token) {
        state.isAdmin = false;
        return false;
    }

    try {
        let res = await run('validateSession', {});
        // รองรับ backend รุ่นเดิมชั่วคราวก่อนผู้ดูแลวาง Code.gs v3.2
        if (!res.success && !res.needLogin && String(res.error || '').includes('ไม่พบ Action')) {
            res = await run('getAdminUsers', {});
        }
        if (!res.success) {
            clearAuthSession();
            return false;
        }

        state.isAdmin = true;
        state.adminId = res.adminId || getSessionValue('adminId');
        state.adminName = res.adminName || getSessionValue('adminName') || state.adminId;
        state.role = res.role || getSessionValue('role') || 'ADMIN';
        setSessionValue('role', state.role);
        setSessionValue('adminId', state.adminId);
        setSessionValue('adminName', state.adminName);
        applyAdminSessionUi();
        return true;
    } catch (e) {
        console.error('ตรวจสอบ session ไม่สำเร็จ:', e);
        clearAuthSession();
        return false;
    }
}

async function loadSystemData() {
    try {
        const [resPub, resEq, resSummary] = await Promise.all([
            run('getData', { sheetName: 'Publics' }),
            run('getData', { sheetName: 'Equipments' }),
            run('getPublicDashboard', {})
        ]);

        state.publics = resPub.success ? (resPub.data || []) : [];
        state.equipments = resEq.success ? (resEq.data || []) : [];
        state.publicSummary = resSummary && resSummary.success ? (resSummary.data || null) : null;
        state.data = [];

        if (state.isAdmin) {
            const resLog = await run('getData', { sheetName: 'BorrowLog' });
            if (resLog.success) state.data = resLog.data || [];
        } else {
            state.data = state.equipments
                .filter(eq => ['Borrowed', 'ยืม'].includes(String(eq.Status || eq[3] || '').trim()))
                .map(eq => ({ EquipmentID: eq.EquipmentID || eq[0] || '', Status: 'Borrowed' }));
        }

        applySystemConfiguration();
        renderDashboardStats();
        renderEquipmentTypeGrid();

        if (state.isAdmin) {
            renderBorrowTable();
            renderAdminBorrowContainer();
            renderEquipmentTable();
            populateFormSelectors();
            if (state.currentTab === 'map') initLeafletGISMap();
        }
    } catch (e) {
        console.error('ข้อผิดพลาดในการดึงค่าชุดข้อมูลสรุปโครงสร้าง:', e);
    }
}

function applySystemConfiguration() {
    let logoUrl = DEFAULT_LOGO;
    let title1 = "ระบบบริหารจัดการ ยืมคืนอุปกรณ์การแพทย์";
    let title2 = "งานบริการศูนย์กายอุปกรณ์ทางการแพทย์สาธารณสุข";

    const logoItem = state.publics.find(item => item['ประเภท'] === 'Logo' || item[0] === 'Logo');
    const agencyItem = state.publics.find(item => item['ประเภท'] === 'Agency' || item[0] === 'Agency');

    if (logoItem) logoUrl = logoItem['ข้อมูล 1'] || logoItem[1] || DEFAULT_LOGO;
    if (agencyItem) {
        title1 = agencyItem['ข้อมูล 1'] || agencyItem[1] || title1;
        title2 = agencyItem['ข้อมูล 2'] || agencyItem[2] || title2;
    }

    document.getElementById('nav-logo').src = logoUrl;
    document.getElementById('side-logo').src = logoUrl;
    document.getElementById('nav-title').innerText = title1;
    document.getElementById('nav-subtitle').innerText = title2;
    document.getElementById('side-agency-title').innerText = title1;

    const setAgency1 = document.getElementById('set-agency1');
    if (setAgency1) {
        document.getElementById('set-logo-old').value = logoUrl;
        document.getElementById('set-agency1').value = title1;
        document.getElementById('set-agency2').value = title2;
        
        const commItems = state.publics.filter(item => item['ประเภท'] === 'Community' || item[0] === 'Community');
        let commText = commItems.map(item => `${item['ข้อมูล 1'] || item[1]},${item['ข้อมูล 2'] || item[2]}`).join('\n');
        document.getElementById('set-communities').value = commText;
    }
}

// คืนค่ารายการที่กำลังยืมใช้งานอยู่ทั้งหมด (ยังไม่ถูกส่งคืน)
function getActiveBorrows() {
    return state.data.filter(b => {
        const status = b.Status || b[8];
        return status === 'Borrowed' || status === 'ยืม';
    });
}

// ✅ คำนวณสถานะครุภัณฑ์จริงจากรายการยืม-คืน (BorrowLog) แทนการเชื่อค่า Status ในชีต Equipments ตรงๆ
// ป้องกันปัญหาข้อมูลไม่ตรงกัน (เช่น นำเข้าข้อมูลยืมเดิมโดยไม่ผ่าน API ทำให้ Equipments.Status ค้างเป็น Available)
function getBorrowedEquipmentIdSet() {
    const set = new Set();
    getActiveBorrows().forEach(r => {
        const eqId = String(r.EquipmentID || r[5] || '').trim();
        if (eqId) set.add(eqId);
    });
    return set;
}

function getEquipmentStatus(eq, borrowedSet) {
    const eqId = String(eq.EquipmentID || eq[0] || '').trim();
    const set = borrowedSet || getBorrowedEquipmentIdSet();
    return set.has(eqId) ? 'Borrowed' : 'Available';
}

function addMonthsClient(dateValue, months) {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return null;
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + Number(months || 0));
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
}

function getBorrowDueDate(row) {
    const explicit = row && (row.DueDate || row.dueDate);
    if (explicit) {
        const d = new Date(explicit);
        if (!Number.isNaN(d.getTime())) return d;
    }
    const rawDate = row && (row.BorrowDate || row[9]);
    return rawDate ? addMonthsClient(rawDate, 6) : null;
}

function getExtensionCount(row) {
    return Number((row && (row.ExtensionCount ?? row.extensionCount)) || 0) || 0;
}

function isOverdueBorrow(row) {
    const due = getBorrowDueDate(row);
    if (!due) return false;
    const end = new Date(due);
    end.setHours(23, 59, 59, 999);
    return end.getTime() < Date.now();
}

function isNearDueBorrow(row) {
    const due = getBorrowDueDate(row);
    if (!due) return false;
    const end = new Date(due);
    end.setHours(23, 59, 59, 999);
    const diff = end.getTime() - Date.now();
    return diff >= 0 && diff <= 30 * 86400000;
}

function renderDashboardStats() {
    const totalEq = state.equipments.length;
    const activeBorrows = getActiveBorrows();

    let borrowedCount;
    let availableCount;
    let overdueCount;
    let nearDueCount;
    let extendedCount;
    let totalLogs;

    if (state.isAdmin) {
        borrowedCount = activeBorrows.length;
        availableCount = Math.max(0, totalEq - borrowedCount);
        overdueCount = activeBorrows.filter(isOverdueBorrow).length;
        nearDueCount = activeBorrows.filter(r => !isOverdueBorrow(r) && isNearDueBorrow(r)).length;
        extendedCount = activeBorrows.filter(r => getExtensionCount(r) > 0).length;
        totalLogs = state.data.length;
    } else if (state.publicSummary) {
        borrowedCount = Number(state.publicSummary.borrowed || 0);
        availableCount = Number(state.publicSummary.available ?? Math.max(0, totalEq - borrowedCount));
        overdueCount = Number(state.publicSummary.overdue || 0);
        nearDueCount = Number(state.publicSummary.nearDue || 0);
        extendedCount = Number(state.publicSummary.extended || 0);
        totalLogs = Number(state.publicSummary.totalBorrowRecords || 0);
    } else {
        borrowedCount = activeBorrows.length;
        availableCount = Math.max(0, totalEq - borrowedCount);
        overdueCount = 0;
        nearDueCount = 0;
        extendedCount = 0;
        totalLogs = 0;
    }

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };
    setText('stat-total-eq', totalEq);
    setText('stat-borrow-eq', borrowedCount);
    setText('stat-avail-eq', availableCount);
    setText('stat-overdue-eq', overdueCount);
    setText('stat-near-due', nearDueCount);
    setText('stat-extended-eq', extendedCount);
    setText('stat-total-logs', totalLogs);

    renderUsageAllocationBar(totalEq, availableCount, borrowedCount, overdueCount);
    updateSidebarBorrowBadge(borrowedCount);
    updateSidebarTrackingBadge(overdueCount);
}

// 🎯 วาดแถบสัดส่วนสถานะการใช้งานครุภัณฑ์ (สรุปยืม-คืน หักลบ แบบเห็นภาพรวมทันที)
function renderUsageAllocationBar(totalEq, availableCount, borrowedCount, overdueCount) {
    const segAvail = document.getElementById('usage-seg-available');
    const segBorrow = document.getElementById('usage-seg-borrowed');
    const segOverdue = document.getElementById('usage-seg-overdue');
    const caption = document.getElementById('usage-bar-caption');
    if (!segAvail || !segBorrow || !segOverdue) return;

    const normalBorrowed = Math.max(borrowedCount - overdueCount, 0);
    const safeTotal = totalEq > 0 ? totalEq : 1;

    const pctAvail = (availableCount / safeTotal) * 100;
    const pctBorrow = (normalBorrowed / safeTotal) * 100;
    const pctOverdue = (overdueCount / safeTotal) * 100;

    segAvail.style.width = pctAvail + '%';
    segBorrow.style.width = pctBorrow + '%';
    segOverdue.style.width = pctOverdue + '%';

    document.getElementById('usage-legend-avail').innerText = availableCount;
    document.getElementById('usage-legend-borrow').innerText = borrowedCount;
    document.getElementById('usage-legend-overdue').innerText = overdueCount;

    if (totalEq === 0) {
        caption.innerText = 'ยังไม่มีข้อมูลครุภัณฑ์ในคลัง กรุณาลงทะเบียนอุปกรณ์เพื่อเริ่มใช้งานระบบ';
    } else {
        caption.innerText = `จากครุภัณฑ์ทั้งหมด ${totalEq} ชิ้น: พร้อมใช้งาน ${availableCount} ชิ้น (${pctAvail.toFixed(0)}%), อยู่ระหว่างยืมใช้งาน ${borrowedCount} ชิ้น (${(pctBorrow + pctOverdue).toFixed(0)}%) ในจำนวนนี้เกินกำหนดส่งคืน ${overdueCount} ชิ้น`;
    }
}

// 🔔 อัปเดตตัวเลขแจ้งเตือนจำนวนรายการยืมค้างอยู่บนเมนูข้างซ้าย
function updateSidebarBorrowBadge(borrowedCount) {
    const badge = document.getElementById('menu-badge-borrow');
    if (!badge) return;
    if (borrowedCount > 0) {
        badge.innerText = borrowedCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// 🎨 ตารางจับคู่หมวดหมู่อุปกรณ์ -> ไอคอน และโทนสี (พาสเทลอ่อนบนการ์ด + วงไอคอนสีเข้มสด โดดเด่นสะดุดตา)
// หมายเหตุ: ใช้ค่าสี HEX ตรงๆ (ไม่พึ่งคลาส Tailwind ที่สร้างจากตัวแปรแบบ bg-${hue}-500) เพราะ Tailwind CDN
// ไม่สามารถ generate คลาสที่ประกอบขึ้นจากตัวแปร JS ได้ครบทุกเฉดสี ทำให้ไอคอนบางหมวดไม่ขึ้นพื้นหลัง (โชว์เป็นวงว่างสีขาว)
const CATEGORY_VISUALS = [
    { test: n => n.includes('เตียง'), icon: 'fa-bed', solid: '#6366f1', pastel: '#eef2ff', border: '#c7d2fe', text: '#4338ca' },
    { test: n => n.includes('ที่นอน'), icon: 'fa-wind', solid: '#14b8a6', pastel: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
    { test: n => n.includes('รถนอน') || n.includes('เปลเข็น'), icon: 'fa-bed-pulse', solid: '#d946ef', pastel: '#fdf4ff', border: '#f5d0fe', text: '#a21caf' },
    { test: n => n.includes('เครื่องผลิตออกซิเจน'), icon: 'fa-lungs', solid: '#0ea5e9', pastel: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
    { test: n => n.includes('ออกซิเจน'), icon: 'fa-fire-extinguisher', solid: '#06b6d4', pastel: '#ecfeff', border: '#a5f3fc', text: '#0e7490' },
    { test: n => n.includes('ดูดเสมหะ'), icon: 'fa-pump-medical', solid: '#f43f5e', pastel: '#fff1f2', border: '#fecdd3', text: '#be123c' },
    { test: n => n.includes('รถเข็น'), icon: 'fa-wheelchair', solid: '#f59e0b', pastel: '#fffbeb', border: '#fde68a', text: '#b45309' },
    { test: n => n.includes('วอคเกอร์'), icon: 'fa-person-walking-with-cane', solid: '#a855f7', pastel: '#faf5ff', border: '#e9d5ff', text: '#7e22ce' },
    { test: n => n.includes('ไม้ค้ำ'), icon: 'fa-crutch', solid: '#8b5cf6', pastel: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
    { test: n => n.includes('ไม้เท้า'), icon: 'fa-crutch', solid: '#f97316', pastel: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
    { test: n => n.toLowerCase().includes('dtx') || n.includes('เจาะน้ำตาล'), icon: 'fa-droplet', solid: '#ef4444', pastel: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
];

const DEFAULT_CATEGORY_VISUAL = { icon: 'fa-kit-medical', solid: '#3b82f6', pastel: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' };

function getCategoryVisual(name) {
    const match = CATEGORY_VISUALS.find(r => r.test(name));
    return match || DEFAULT_CATEGORY_VISUAL;
}

function renderEquipmentTypeGrid() {
    const grid = document.getElementById('equipment-type-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const groups = {};
    
    state.equipments.forEach(eq => {
        let name = eq.EquipmentName || eq[1];
        name = name ? String(name).trim() : 'อุปกรณ์ทั่วไป';
        if (!groups[name]) groups[name] = { total: 0, available: 0, borrowed: 0 };
        groups[name].total++;
    });
    
    const activeBorrows = getActiveBorrows();
    
    activeBorrows.forEach(r => {
        const borrowEqId = String(r.EquipmentID || r[5]).trim();
        const matchedEq = state.equipments.find(e => String(e.EquipmentID || e[0]).trim() === borrowEqId);
        if (matchedEq) {
            let name = matchedEq.EquipmentName || matchedEq[1];
            name = name ? String(name).trim() : 'อุปกรณ์ทั่วไป';
            if (groups[name]) groups[name].borrowed++;
        }
    });
    
    for (let name in groups) {
        groups[name].available = groups[name].total - groups[name].borrowed;
    }

    if (Object.keys(groups).length === 0) {
        grid.innerHTML = `<div class="col-span-full empty-state"><i class="fa-solid fa-box-open text-3xl"></i><span>ยังไม่มีข้อมูลครุภัณฑ์ในคลัง</span></div>`;
        return;
    }
    
    for (let name in groups) {
        const { icon, solid, pastel, border, text } = getCategoryVisual(name);
        const g = groups[name];
        const card = document.createElement('div');
        card.className = `cat-card border p-4 rounded-2xl shadow-sm flex items-center justify-between transition-all hover:scale-[1.02] hover:shadow-lg`;
        card.style.backgroundColor = pastel;
        card.style.borderColor = border;
        card.style.color = text;
        card.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="cat-badge w-12 h-12 flex items-center justify-center rounded-2xl text-white flex-shrink-0" style="background-color:${solid}; box-shadow:0 6px 16px -6px ${solid}99, 0 0 0 4px ${solid}33;">
                    <i class="fa-solid ${icon} text-xl"></i>
                </div>
                <div class="overflow-hidden">
                    <h5 class="font-bold text-xs text-gray-700 truncate">${name}</h5>
                    <p class="text-[11px] text-gray-500 mt-0.5">ทั้งหมด: ${g.total} | คงเหลือว่าง: <span class="text-emerald-600 font-bold">${g.available}</span></p>
                </div>
            </div>
            <div class="text-right flex-shrink-0"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background-color:#ffe4e6; color:#be123c;">ยืมอยู่: ${g.borrowed}</span></div>
        `;
        grid.appendChild(card);
    }
}

// เรนเดอร์ตารางสรุปประวัติภาพรวม (แดชบอร์ดสาธารณะล่างสุด) พร้อมค้นหาและแบ่งหน้าจริง
function renderBorrowTable() {
    const tbody = document.getElementById('borrow-rows');
    if (!tbody) return;

    const searchBox = document.getElementById('search-borrow-table');
    const keyword = searchBox ? searchBox.value.toLowerCase().trim() : '';

    const filtered = state.data.filter(item => {
        if (!keyword) return true;
        const eqId = String(item.EquipmentID || item[5] || '').toLowerCase();
        const community = String(item.Community || item[4] || '').toLowerCase();
        const patient = String(item.PatientName || item.BorrowerName || item[13] || item[1] || '').toLowerCase();
        return eqId.includes(keyword) || community.includes(keyword) || patient.includes(keyword);
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / rowsPerPageLimit) || 1;
    if (publicCurrentPage > totalPages) publicCurrentPage = totalPages;
    const startIdx = (publicCurrentPage - 1) * rowsPerPageLimit;
    const pageItems = filtered.slice(startIdx, startIdx + rowsPerPageLimit);

    tbody.innerHTML = '';
    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-gray-400">❌ ไม่พบประวัติการทำรายการขอยืมครุภัณฑ์ที่ตรงกับการค้นหา</td></tr>`;
    } else {
        pageItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50/70 transition-all duration-100";
            const statusRaw = item.Status || item[8];
            let statusBadge = (statusRaw === 'Borrowed' || statusRaw === 'ยืม') ?
                `<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-100">กำลังยืม</span>` :
                `<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">คืนคลังแล้ว</span>`;
            const rawDate = item.BorrowDate || item[9];
            const borrowDateFormatted = rawDate ? new Date(rawDate).toLocaleDateString('th-TH') : '-';

            tr.innerHTML = `
                <td class="p-3 font-semibold text-gray-700">${item.EquipmentID || item[5] || '-'}</td>
                <td class="p-3 font-medium">${item.PatientName || item.BorrowerName || item[13] || item[1] || '-'}</td>
                <td class="p-3 font-mono text-gray-400">${item.CitizenID || item[2] || '-'}</td>
                <td class="p-3">${item.Community || item[4] || '-'}</td>
                <td class="p-3">${borrowDateFormatted}</td>
                <td class="p-3 font-mono text-gray-400">${item.Phone || item[12] || '-'}</td>
                <td class="p-3">${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    buildPaginationDashboardControls(
        'public-pagination-controls',
        'public-pagination-info',
        publicCurrentPage,
        totalItems,
        rowsPerPageLimit,
        'changePublicPage'
    );
}

// ✅ เพิ่มส่วนสำคัญ: ฟังก์ชันจัดทำระบบตารางแบบแบ่งเพจ สืบคัน คัดกรอง และประมวลผลคำสั่งพิมพ์หน้าแอดมินงานยืมคืน
function renderAdminBorrowContainer() {
    const container = document.getElementById('borrow-admin-container');
    if (!container) return;

    const searchKeyword = (document.getElementById('admin-search-input').value || '').toLowerCase().trim();
    const filterStatus = document.getElementById('admin-status-filter').value;

    // ประมวลผลทำการฟิลเตอร์ข้อมูลขั้นสูงลูกผสม
    const filteredList = state.data.filter(item => {
        const eqId = String(item.EquipmentID || item[5] || '').toLowerCase();
        const patient = String(item.PatientName || item[13] || '').toLowerCase();
        const borrower = String(item.BorrowerName || item[1] || '').toLowerCase();
        const status = String(item.Status || item[8] || '').trim().toLowerCase();

        // 1. ตรวจสอบเงื่อนไขตัวกรองสถานะ
        let statusMatch = true;
        if (filterStatus === 'borrowed') statusMatch = (status === 'borrowed' || status === 'ยืม');
        if (filterStatus === 'returned') statusMatch = (status === 'returned' || status === 'returned' || status === 'คืน');

        // ค้นหารายละเอียดชื่อประเภทพัสดุประกอบการสืบค้นคำค้นหาเพิ่มเติม
        const matchedEq = state.equipments.find(e => String(e.EquipmentID || e[0]).trim().toLowerCase() === eqId);
        const eqName = matchedEq ? String(matchedEq.EquipmentName || matchedEq[1] || '').toLowerCase() : '';

        // 2. ตรวจสอบเงื่อนไขคำค้นหาครอบจักรวาล
        const keywordMatch = eqId.includes(searchKeyword) || patient.includes(searchKeyword) || borrower.includes(searchKeyword) || eqName.includes(searchKeyword);

        return statusMatch && keywordMatch;
    });

    // คำนวณหาสถิติอัตราส่วนหน้าเพจทั้งหมด
    const totalItems = filteredList.length;
    const totalPages = Math.ceil(totalItems / adminPageLimit) || 1;
    if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;

    const startIndex = (adminCurrentPage - 1) * adminPageLimit;
    const endIndex = startIndex + adminPageLimit;
    const paginatedItems = filteredList.slice(startIndex, endIndex);

    // ประกอบสร้างตาราง HTML ชุดจัดการแอดมินตัวจริง
    let tableStructureHtml = `
        <div class="overflow-x-auto rounded-xl border border-gray-100">
            <table class="w-full text-left border-collapse table-report">
                <thead class="bg-gray-50 text-gray-600 text-xs font-bold uppercase">
                    <tr>
                        <th class="p-3">รหัสพัสดุ</th>
                        <th class="p-3">ชื่อผู้ป่วย / ผู้ยืม</th>
                        <th class="p-3">เลขบัตรประจำตัวประชาชน</th>
                        <th class="p-3">ชุมชน/หมู่บ้าน</th>
                        <th class="p-3">วันที่ยืม</th>
                        <th class="p-3">เบอร์โทรศัพท์</th>
                        <th class="p-3">สถานะ</th>
                        <th class="p-3 text-center print:hidden">การจัดการสิทธิ์</th>
                    </tr>
                </thead>
                <tbody class="text-xs divide-y divide-gray-100 text-gray-600">
    `;

    if (paginatedItems.length === 0) {
        tableStructureHtml += `<tr><td colspan="8" class="text-center p-6 text-gray-400">❌ ไม่พบประวัติผลลัพธ์ที่สอดคล้องกับตัวกรองหรือคำค้นหาของคุณ</td></tr>`;
    } else {
        paginatedItems.forEach(item => {
            const entryId = item.EntryID || item[0];
            const eqId = item.EquipmentID || item[5] || '-';
            const patientName = item.PatientName || item.BorrowerName || item[13] || item[1] || '-';
            const citizenId = item.CitizenID || item[2] || '-';
            const community = item.Community || item[4] || '-';
            const rawDate = item.BorrowDate || item[9];
            const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString('th-TH') : '-';
            const phone = item.Phone || item[12] || '-';
            const status = item.Status || item[8];

            let statusBadge = (status === 'Borrowed' || status === 'ยืม') ?
                `<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-100"><i class="fa-solid fa-clock mr-1"></i>กำลังยืม</span>` :
                `<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"><i class="fa-solid fa-circle-check mr-1"></i>คืนคลังแล้ว</span>`;

            const imagesRaw = item.Images || item[7] || '';
            const photoCount = imagesRaw ? String(imagesRaw).split(',').map(s => s.trim()).filter(Boolean).length : 0;

            // ออกปุ่มควบคุมการปริ้นท์ที่ผูกกับตรรกะตัดฟอร์แมตหน้าจอฉบับสมบูรณ์
            const actionButtons = `
                <div class="flex items-center justify-center gap-1.5">
                    ${photoCount > 0 ?
                        `<button onclick="viewBorrowImages('${entryId}')" class="relative bg-amber-50 hover:bg-amber-100 text-amber-700 p-1.5 rounded-lg transition" title="ดูรูปภาพหลักฐานแนบ (${photoCount} รูป)"><i class="fa-solid fa-camera text-xs"></i><span class="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full">${photoCount}</span></button>` :
                        `<span class="bg-gray-50 text-gray-300 p-1.5 rounded-lg" title="ไม่มีรูปภาพหลักฐานแนบ"><i class="fa-solid fa-camera text-xs"></i></span>`
                    }
                    <button onclick="printLoanReceipt('${entryId}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 p-1.5 rounded-lg transition" title="พิมพ์ใบอนุมัติสัญญาค้ำประกันคลัง"><i class="fa-solid fa-print text-xs"></i></button>
                    ${(status === 'Borrowed' || status === 'ยืม') ? 
                        `<button onclick="editBorrowRecord('${entryId}')" class="bg-amber-50 hover:bg-amber-100 text-amber-700 p-1.5 rounded-lg transition" title="แก้ไขรายการนี้ (กรณีบันทึกผิด)"><i class="fa-solid fa-pen text-xs"></i></button>` : ''
                    }
                    ${(status === 'Borrowed' || status === 'ยืม') ? 
                        `<button onclick="processReturnItem('${entryId}')" class="bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-[11px] px-2.5 py-1 rounded-lg transition">คืน</button>` : ''
                    }
                    <button onclick="deleteBorrowRecord('${entryId}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-lg transition"><i class="fa-solid fa-trash-can text-xs"></i></button>
                </div>
            `;

            tableStructureHtml += `
                <tr class="hover:bg-gray-50/70 transition-all duration-100">
                    <td class="p-3 font-semibold text-gray-700">${eqId}</td>
                    <td class="p-3 font-medium">${patientName}</td>
                    <td class="p-3 font-mono">${citizenId}</td>
                    <td class="p-3">${community}</td>
                    <td class="p-3">${dateFormatted}</td>
                    <td class="p-3 font-mono">${phone}</td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3 print:hidden">${actionButtons}</td>
                </tr>
            `;
        });
    }

    tableStructureHtml += `</tbody></table></div>`;
    container.innerHTML = tableStructureHtml;

    // เรนเดอร์จัดโครงสร้างชุดปุ่มเลขหน้าเพจควบคุม (Pagination Elements)
    renderPaginationControlsBar(totalPages);
}

function renderPaginationControlsBar(totalPages) {
    const paginationBox = document.getElementById('admin-table-pagination');
    if (!paginationBox) return;

    let html = `
        <button onclick="changeAdminPage(1)" ${adminCurrentPage === 1 ? 'disabled class="text-gray-300 cursor-not-allowed px-1.5"' : 'class="text-indigo-600 hover:bg-indigo-50 px-1.5 rounded-md"'}><i class="fa-solid fa-angles-left"></i></button>
        <button onclick="changeAdminPage(${adminCurrentPage - 1})" ${adminCurrentPage === 1 ? 'disabled class="text-gray-300 cursor-not-allowed px-2 py-1"' : 'class="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg"'}><i class="fa-solid fa-chevron-left"></i> ย้อนกลับ</button>
        <span class="px-3 py-1 font-bold text-gray-600 bg-gray-100/80 border rounded-xl">หน้า ${adminCurrentPage} / ${totalPages}</span>
        <button onclick="changeAdminPage(${adminCurrentPage + 1})" ${adminCurrentPage === totalPages ? 'disabled class="text-gray-300 cursor-not-allowed px-2 py-1"' : 'class="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg"'} class="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg">ถัดไป <i class="fa-solid fa-chevron-right"></i></button>
        <button onclick="changeAdminPage(${totalPages})" ${adminCurrentPage === totalPages ? 'disabled class="text-gray-300 cursor-not-allowed px-1.5"' : 'class="text-indigo-600 hover:bg-indigo-50 px-1.5 rounded-md"'}><i class="fa-solid fa-angles-right"></i></button>
    `;
    paginationBox.innerHTML = html;
}

function changeAdminPage(target) {
    adminCurrentPage = target;
    renderAdminBorrowContainer();
}

// ✅ แก้ไขปัญหาปริ้นท์หลุดฟอร์แมต: ล็อกระดับ Body Class ปิดหน้าเว็บอื่นเพื่อพิมพ์ใบยืมแบบโบราณดั้งเดิมตามสัญญาจริง
function printLoanReceipt(entryId) {
    // 🔍 ค้นหาเรคคอร์ดแถวข้อมูลสัญญาใน State ด้วย EntryID หรือดัชนีแรก
    const row = state.data.find(r => (r.EntryID || r[0]) === entryId);
    if (!row) {
        Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลแถวสัญญานี้ในคลังระบบ', 'error');
        return;
    }
    
    // 🗓️ ถอดค่าและจัดรูปแบบวันที่เริ่มต้นสัญญา และวันครบกำหนดส่งคืนรับประกันมัดจำ (บวก 6 เดือน)
    const rawDate = row.BorrowDate || row[9];
    const bDate = rawDate ? new Date(rawDate) : new Date();
    const dateFormatted = bDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const dDate = getBorrowDueDate(row) || addMonthsClient(bDate, 6) || bDate;
    const endDateFormatted = dDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    // 📦 ค้นหารหัสครุภัณฑ์และแมปข้อมูลชื่อรุ่นกายอุปกรณ์จากสต็อกพัสดุ
    const eqId = row.EquipmentID || row[5];
    const matchedEq = state.equipments.find(e => String(e.EquipmentID || e[0]).trim() === String(eqId).trim());
    
    // 📡 ดึงข้อมูลสัญญลักษณ์ Logo และชื่อต้นสังกัดจากแผ่นข้อมูลพับลิกส์ (Publics Sheet)
    const agencyText = state.publics.find(item => item['ประเภท'] === 'Agency' || item[0] === 'Agency');
    const logoText = state.publics.find(item => item['ประเภท'] === 'Logo' || item[0] === 'Logo');

    // 🖼️ ดึงรูปตราสัญลักษณ์ของหน่วยงานมาผูกเข้ากับ Element โครงสร้างรูปภาพตัวใหม่
    if (logoText && document.getElementById('print-logo')) {
        document.getElementById('print-logo').src = logoText['ข้อมูล 1'] || logoText[1] || '';
    }

    // 🏢 จัดสายอักษรชื่อหน่วยงานเทศบาล/ศูนย์แพทย์ เว้นบรรทัดแบบยืดหยุ่นตามเวอร์ชัน 2.1 ดั้งเดิมของคุณ
    if (agencyText && document.getElementById('print-agency-name')) {
        const title1 = agencyText['ข้อมูล 1'] || agencyText[1] || '';
        const title2 = agencyText['ข้อมูล 2'] || agencyText[2] || '';
        document.getElementById('print-agency-name').innerHTML = title2 ? `${title1}<br>${title2}` : title1;
    }

    // ✍️ รันคำสั่งกระจายข้อมูลลงสู่แผ่น ID ในชุดแบบฟอร์มตัวใหม่ที่กำหนดสไตล์สีน้ำเงินเข้มและตัวหนา
    if (document.getElementById('print-borrower')) {
        document.getElementById('print-borrower').innerText = row.BorrowerName || row.PatientName || row[1] || row[13] || '-';
    }
    if (document.getElementById('print-sign-borrower')) {
        document.getElementById('print-sign-borrower').innerText = row.BorrowerName || row.PatientName || row[1] || row[13] || '-';
    }
    if (document.getElementById('print-date')) {
        document.getElementById('print-date').innerText = dateFormatted;
    }
    if (document.getElementById('print-equipment')) {
        document.getElementById('print-equipment').innerText = matchedEq ? `${matchedEq[1] || matchedEq.EquipmentName} รหัส: ${matchedEq[0] || matchedEq.EquipmentID} (${matchedEq[2] || matchedEq.SerialNumber})` : eqId;
    }
    
    if (document.getElementById('print-start-date')) {
        document.getElementById('print-start-date').innerText = dateFormatted;
    }
    if (document.getElementById('print-end-date')) {
        document.getElementById('print-end-date').innerText = endDateFormatted;
    }
    if (document.getElementById('print-phone')) {
        document.getElementById('print-phone').innerText = row.Phone || row[12] || '-';
    }
    if (document.getElementById('print-patient')) {
        document.getElementById('print-patient').innerText = row.PatientName || row[13] || '-';
    }
    if (document.getElementById('print-relation')) {
        document.getElementById('print-relation').innerText = row.Relationship || row[14] || 'ตนเอง';
    }
    if (document.getElementById('print-deposit')) {
        document.getElementById('print-deposit').innerText = row.Deposit || row[15] || '0';
    }
    
    // 🔒 ระบบความปลอดภัยอัตโนมัติ: ดึงชื่อบัญชีแอดมินผู้ที่เข้าสู่ระบบพิมพ์ในขณะนั้นหยอดลงช่องเจ้าหน้าที่ผู้ให้ยืมทันที
    if (document.getElementById('print-sign-staff')) {
        document.getElementById('print-sign-staff').innerText = state.adminName || 'เจ้าหน้าที่ผู้มอบ';
    }

    // 🖨️ บังคับเปลี่ยนสถานะโครงสร้างสไตล์ชีตคุมเลย์เอาต์เฉพาะเครื่องปริ้นท์ตามระเบียบเวอร์ชัน 2.1 ดั้งเดิมของคุณ
    document.body.classList.add('print-mode-receipt');
    window.print();
    document.body.classList.remove('print-mode-receipt');
}

// 🗃️ แคชรายการติดตามที่ผ่านการค้นหา/กรองล่าสุด ใช้ทั้งแสดงผลและพิมพ์รายงาน
let trackingFilteredCache = [];

function buildTrackingRows(rows, forPrint = false) {
    const colspan = forPrint ? 8 : 9;
    if (rows.length === 0) {
        return `<tr><td colspan="${colspan}" class="text-center p-6 text-gray-400">🎉 ไม่มีรายการกายอุปกรณ์ตรงกับเงื่อนไขที่ค้นหา</td></tr>`;
    }

    return rows.map(item => {
        const { entryId, eqId, borrowerDetails, borrowDateStr, dueDateStr, phone, overdue, nearDue, extended, extensionCount } = item;

        let signalBadge;
        if (overdue) {
            signalBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 border border-rose-200">⚠️ เกินกำหนด</span>`;
        } else if (extended) {
            signalBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200">🔵 ยืมต่อ</span>`;
        } else if (nearDue) {
            signalBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">⏳ ใกล้ครบกำหนด</span>`;
        } else {
            signalBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">ปกติ</span>`;
        }

        const extensionText = extensionCount > 0
            ? `<span class="font-bold text-blue-700">ต่อแล้ว ${extensionCount} ครั้ง</span>${extensionCount >= 3 ? '<br><span class="text-[9px] font-bold text-amber-700">⚠️ ติดตามพิเศษ</span>' : ''}`
            : '<span class="text-gray-400">ยังไม่เคยยืมต่อ</span>';

        const dueClass = overdue
            ? 'font-bold text-rose-700 bg-rose-50/60'
            : (nearDue ? 'font-bold text-amber-700 bg-amber-50/60' : 'font-semibold text-gray-700');

        const cells = `
            <td class="border border-gray-200 p-2 font-semibold text-orange-600">${eqId}</td>
            <td class="border border-gray-200 p-2 text-left">${borrowerDetails}</td>
            <td class="border border-gray-200 p-2 text-gray-500">กำลังยืมใช้งาน</td>
            <td class="border border-gray-200 p-2">${extensionText}</td>
            <td class="border border-gray-200 p-2 text-emerald-600">${borrowDateStr}</td>
            <td class="border border-gray-200 p-2 ${dueClass}">${dueDateStr}</td>
            <td class="border border-gray-200 p-2 font-mono">${phone}</td>
            <td class="border border-gray-200 p-2">${signalBadge}</td>`;

        const actionCell = forPrint ? '' : `
            <td class="border border-gray-200 p-2 print:hidden">
                ${overdue
                    ? `<button onclick="openExtendBorrowPrompt('${entryId}')" class="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition whitespace-nowrap"><i class="fa-solid fa-calendar-plus mr-1"></i>ยืมต่อ</button>`
                    : '<span class="text-gray-300">—</span>'}
            </td>`;

        return `<tr class="hover:bg-gray-50/70 transition ${overdue ? 'bg-rose-50/30' : extended ? 'bg-blue-50/20' : ''}">${cells}${actionCell}</tr>`;
    }).join('');
}

function renderTrackingSection() {
    const tbody = document.getElementById('tracking-table-body');
    if (!tbody) return;

    const searchBox = document.getElementById('search-tracking-table');
    const statusFilterEl = document.getElementById('tracking-status-filter');
    const keyword = searchBox ? searchBox.value.toLowerCase().trim() : '';
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'all';

    const borrowedItems = getActiveBorrows();
    let overdueTally = 0;
    let nearDueTally = 0;
    let extendedTally = 0;

    const enriched = borrowedItems.map(row => {
        const entryId = row.EntryID || row[0] || '';
        const eqId = row.EquipmentID || row[5] || '';
        const patient = row.PatientName || row.BorrowerName || row[13] || row[1] || '-';
        const address = row.Address || row[3] || '';
        const community = row.Community || row[4] || '';
        const phone = row.Phone || row[12] || '-';
        const extensionCount = getExtensionCount(row);
        const overdue = isOverdueBorrow(row);
        const nearDue = !overdue && isNearDueBorrow(row);
        const extended = extensionCount > 0;

        if (overdue) overdueTally++;
        if (nearDue) nearDueTally++;
        if (extended) extendedTally++;

        const rawDate = row.BorrowDate || row[9];
        const dueDate = getBorrowDueDate(row);
        const borrowDateStr = rawDate ? new Date(rawDate).toLocaleDateString('th-TH') : '-';
        const dueDateStr = dueDate ? dueDate.toLocaleDateString('th-TH') : '-';

        return {
            entryId, eqId,
            borrowerDetails: `${patient} (${address} เขต ${community})`,
            searchBlob: `${eqId} ${patient} ${phone} ${community}`.toLowerCase(),
            borrowDateStr, dueDateStr, phone, overdue, nearDue, extended, extensionCount
        };
    });

    const filtered = enriched.filter(item => {
        if (statusFilter === 'overdue' && !item.overdue) return false;
        if (statusFilter === 'near' && !item.nearDue) return false;
        if (statusFilter === 'extended' && !item.extended) return false;
        if (statusFilter === 'normal' && (item.overdue || item.nearDue || item.extended)) return false;
        if (!keyword) return true;
        return item.searchBlob.includes(keyword);
    });

    trackingFilteredCache = filtered;
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / rowsPerPageLimit) || 1;
    if (trackingCurrentPage > totalPages) trackingCurrentPage = totalPages;
    const startIdx = (trackingCurrentPage - 1) * rowsPerPageLimit;
    const pageItems = filtered.slice(startIdx, startIdx + rowsPerPageLimit);

    tbody.innerHTML = buildTrackingRows(pageItems, false);

    const summaryEl = document.getElementById('tracking-summary-info');
    if (summaryEl) {
        summaryEl.innerText = `กำลังยืม ${borrowedItems.length} รายการ • เกินกำหนด ${overdueTally} • ใกล้ครบ ${nearDueTally} • เคยยืมต่อ ${extendedTally}${keyword || statusFilter !== 'all' ? ` — ตรงเงื่อนไข ${totalItems}` : ''}`;
    }

    buildPaginationDashboardControls('tracking-pagination-controls', 'tracking-pagination-info', trackingCurrentPage, totalItems, rowsPerPageLimit, 'changeTrackingPage');
    updateSidebarTrackingBadge(overdueTally);
}

async function openExtendBorrowPrompt(entryId) {
    const row = state.data.find(r => String(r.EntryID || r[0] || '') === String(entryId));
    if (!row) {
        Swal.fire('ไม่พบข้อมูล', 'ไม่พบรายการยืมที่ต้องการยืมต่อ', 'error');
        return;
    }
    if (!isOverdueBorrow(row)) {
        Swal.fire('ยังไม่เกินกำหนด', 'ระบบอนุญาตให้ยืมต่อจากหน้าติดตามเมื่อรายการเกินกำหนดแล้วเท่านั้น', 'info');
        return;
    }

    const eqId = row.EquipmentID || row[5] || '-';
    const patient = row.PatientName || row.BorrowerName || row[13] || row[1] || '-';
    const dueDate = getBorrowDueDate(row);
    const dueText = dueDate ? dueDate.toLocaleDateString('th-TH') : '-';

    const result = await Swal.fire({
        title: 'ยืนยันการยืมต่อ',
        html: `
            <div class="text-left text-xs space-y-3">
                <div class="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <div><b>อุปกรณ์:</b> ${eqId}</div>
                    <div><b>ผู้ยืม/ผู้ป่วย:</b> ${patient}</div>
                    <div><b>กำหนดเดิม:</b> <span class="text-rose-600 font-bold">${dueText}</span></div>
                    <div><b>เคยยืมต่อ:</b> ${getExtensionCount(row)} ครั้ง</div>
                </div>
                <div>
                    <label class="block font-bold text-gray-600 mb-1">ระยะเวลายืมต่อ</label>
                    <select id="extend-months" class="swal2-select" style="display:block;width:100%;margin:0;">
                        <option value="1">1 เดือน</option>
                        <option value="2">2 เดือน</option>
                        <option value="3">3 เดือน</option>
                    </select>
                </div>
                <div>
                    <label class="block font-bold text-gray-600 mb-1">ผลการติดตาม / เหตุผลการยืมต่อ</label>
                    <textarea id="extend-reason" class="swal2-textarea" style="display:block;width:100%;margin:0;min-height:85px;" placeholder="เช่น ผู้ป่วยยังมีความจำเป็นต้องใช้อุปกรณ์ต่อเนื่อง"></textarea>
                </div>
                <label class="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 cursor-pointer">
                    <input type="checkbox" id="extend-confirm-followup" class="mt-0.5">
                    <span>ยืนยันว่าเจ้าหน้าที่ได้ติดตามและตรวจสอบว่ายังมีการใช้อุปกรณ์อยู่จริง</span>
                </label>
            </div>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันยืมต่อ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#2563eb',
        focusConfirm: false,
        preConfirm: () => {
            const months = Number(document.getElementById('extend-months').value);
            const reason = document.getElementById('extend-reason').value.trim();
            const confirmed = document.getElementById('extend-confirm-followup').checked;
            if (![1, 2, 3].includes(months)) {
                Swal.showValidationMessage('กรุณาเลือกระยะเวลายืมต่อ 1–3 เดือน');
                return false;
            }
            if (reason.length < 3) {
                Swal.showValidationMessage('กรุณาระบุผลการติดตามหรือเหตุผลการยืมต่อ');
                return false;
            }
            if (!confirmed) {
                Swal.showValidationMessage('กรุณายืนยันว่าได้ติดตามการใช้อุปกรณ์แล้ว');
                return false;
            }
            return { months, reason };
        }
    });

    if (!result.isConfirmed || !result.value) return;
    Swal.fire({ title: 'กำลังบันทึกการยืมต่อ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const res = await run('extendBorrow', { EntryID: entryId, months: result.value.months, reason: result.value.reason });

    if (res.success) {
        const newDue = res.newDueDate ? new Date(res.newDueDate).toLocaleDateString('th-TH') : '-';
        await Swal.fire('ยืมต่อสำเร็จ', `ต่ออายุ ${res.months} เดือน • กำหนดใหม่ ${newDue} • ครั้งที่ ${res.extensionCount}`, 'success');
        await loadSystemData();
        renderTrackingSection();
    } else if (res.schemaUpgradeRequired) {
        Swal.fire({
            title: 'ต้องอัปเกรดโครงสร้างก่อน',
            text: res.error || 'กรุณาไปที่เมนูตั้งค่าแล้วกดอัปเกรดโครงสร้าง v3.6',
            icon: 'warning',
            confirmButtonText: 'ไปหน้าตั้งค่า'
        }).then(r => { if (r.isConfirmed) switchTab('settings'); });
    } else {
        Swal.fire('ยืมต่อไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาด', 'error');
    }
}

function changeTrackingPage(targetPage) {
    trackingCurrentPage = targetPage;
    renderTrackingSection();
}

function updateSidebarTrackingBadge(overdueTally) {
    const badge = document.getElementById('menu-badge-tracking');
    if (!badge) return;
    if (overdueTally > 0) {
        badge.innerText = overdueTally;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function printTrackingReport() {
    // พิมพ์รายงานตามรายการที่ผ่านการค้นหา/กรองล่าสุดทั้งหมด (ไม่จำกัดเฉพาะหน้าที่กำลังแสดงอยู่บนจอ)
    document.getElementById('tracking-print-body').innerHTML = buildTrackingRows(trackingFilteredCache, true);
    document.body.classList.add('print-mode-tracking');
    window.print();
    document.body.classList.remove('print-mode-tracking');
}

function renderEquipmentTable() {
    const tbody = document.getElementById('equipment-rows');
    if (!tbody) return;

    const searchBox = document.getElementById('search-equip-table');
    const statusFilterEl = document.getElementById('equip-status-filter');
    const keyword = searchBox ? searchBox.value.toLowerCase().trim() : '';
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'all';
    const borrowedSet = getBorrowedEquipmentIdSet();

    const filtered = state.equipments.filter(item => {
        const isAvailable = getEquipmentStatus(item, borrowedSet) === 'Available';

        let statusMatch = true;
        if (statusFilter === 'available') statusMatch = isAvailable;
        if (statusFilter === 'borrowed') statusMatch = !isAvailable;
        if (!statusMatch) return false;

        if (!keyword) return true;
        const eqId = String(item.EquipmentID || item[0] || '').toLowerCase();
        const eqName = String(item.EquipmentName || item[1] || '').toLowerCase();
        const serial = String(item.SerialNumber || item[2] || '').toLowerCase();
        return eqId.includes(keyword) || eqName.includes(keyword) || serial.includes(keyword);
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / rowsPerPageLimit) || 1;
    if (equipCurrentPage > totalPages) equipCurrentPage = totalPages;
    const startIdx = (equipCurrentPage - 1) * rowsPerPageLimit;
    const pageItems = filtered.slice(startIdx, startIdx + rowsPerPageLimit);

    tbody.innerHTML = '';
    if (state.equipments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-gray-400">❌ ไม่พบชุดข้อมูลพัสดุอุปกรณ์ที่ลงทะเบียนในคลัง</td></tr>`;
    } else if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-gray-400">❌ ไม่พบรายการที่ตรงกับการค้นหาหรือตัวกรองสถานะ</td></tr>`;
    } else {
        pageItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50/70 transition-all duration-100";
            const status = getEquipmentStatus(item, borrowedSet);
            let statusBadge = (status === 'Available') ?
                `<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"><i class="fa-solid fa-check-circle mr-1"></i>ว่างพร้อมใช้</span>` :
                `<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-100"><i class="fa-solid fa-handshake mr-1"></i>ถูกยืมไปคลัง</span>`;

            tr.innerHTML = `
                <td class="p-3 font-semibold text-gray-700">${item.EquipmentID || item[0] || '-'}</td>
                <td class="p-3 font-medium text-gray-800">${item.EquipmentName || item[1] || '-'}</td>
                <td class="p-3 font-mono text-gray-400">${item.SerialNumber || item[2] || '-'}</td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 print:hidden">
                    <button onclick="deleteEquipmentRecord('${item.EquipmentID || item[0]}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-lg transition"><i class="fa-solid fa-trash-can text-xs"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    buildPaginationDashboardControls(
        'equip-pagination-controls',
        'equip-pagination-info',
        equipCurrentPage,
        totalItems,
        rowsPerPageLimit,
        'changeEquipPage'
    );
}

function populateFormSelectors(currentEquipmentId) {
    const selectEq = document.getElementById('borrow-eq-id');
    if (!selectEq) return;
    selectEq.innerHTML = '<option value="">-- กรุณาเลือกรายการอุปกรณ์พัสดุ --</option>';
    
    const borrowedSet = getBorrowedEquipmentIdSet();
    // ตอนแก้ไขรายการ อุปกรณ์ที่รายการนี้ถือครองอยู่แล้วจะถูกนับว่า "ถูกยืม" ไปด้วย ต้องดึงกลับมาแสดงในตัวเลือกด้วยเสมอ
    const availableEqs = state.equipments.filter(e => {
        const eqId = String(e.EquipmentID || e[0]);
        const isAvailable = getEquipmentStatus(e, borrowedSet) === 'Available';
        const isCurrentlyAssigned = currentEquipmentId && eqId === String(currentEquipmentId);
        return isAvailable || isCurrentlyAssigned;
    });
    availableEqs.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.EquipmentID || e[0];
        opt.text = `${e.EquipmentID || e[0]} : ${e.EquipmentName || e[1]}`;
        selectEq.appendChild(opt);
    });

    const selectComm = document.getElementById('borrow-community');
    selectComm.innerHTML = '<option value="">-- เลือกเขตชุมชนหมู่บ้านผู้รับบริการ --</option>';
    const commItems = state.publics.filter(item => item['ประเภท'] === 'Community' || item[0] === 'Community');
    commItems.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c['ข้อมูล 2'] || c[2];
        opt.text = `หมู่ ${c['ข้อมูล 1'] || c[1]} - ${c['ข้อมูล 2'] || c[2]}`;
        selectComm.appendChild(opt);
    });
}

function syncSerialNumber() {
    const eqId = document.getElementById('borrow-eq-id').value;
    const match = state.equipments.find(e => (e.EquipmentID || e[0]) === eqId);
    document.getElementById('borrow-serial').value = match ? (match.SerialNumber || match[2]) : '';
}

function switchTab(tabId) {
    if (state.isAdmin && tabId === 'settings' && state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','เมนูตั้งค่าระบบใช้ได้เฉพาะ ADMIN','warning'); return; }
    if (!state.isAdmin && tabId !== 'dashboard') {
        Swal.fire('สิทธิ์ไม่เพียงพอ', 'กรุณาเข้าสู่ระบบด้วยบัญชีแอดมินเจ้าหน้าที่ก่อน', 'warning');
        return;
    }
    state.currentTab = tabId;
    const views = document.querySelectorAll('.app-view');
    views.forEach(v => v.classList.add('hidden'));
    
    document.getElementById(`sec-${tabId}`).classList.remove('hidden');
    
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(m => m.classList.remove('active'));
    
    const targetMenu = document.getElementById(`btn-menu-${tabId}`);
    if (targetMenu) targetMenu.classList.add('active');

    if (tabId === 'map') {
        setTimeout(() => { initLeafletGISMap(); }, 200);
    }
    if (tabId === 'tracking') {
        renderTrackingSection();
    }
    if (tabId === 'settings') {
        loadAdminUsersSection();
        checkSchemaStatus();
        loadAuditLogSection();
        loadLineConfigStatus();
    }
}

function toggleSidebarMinimize() {
    const sidebar = document.getElementById('sidebar');
    const wrapper = document.getElementById('main-wrapper');
    const icon = document.getElementById('minimize-icon');
    
    sidebar.classList.toggle('collapsed');
    wrapper.classList.toggle('sidebar-collapsed');
    
    if (sidebar.classList.contains('collapsed')) {
        icon.className = "fa-solid fa-chevron-right";
    } else {
        icon.className = "fa-solid fa-chevron-left";
    }
    
    if (state.currentTab === 'map' && mapInstance) {
        setTimeout(() => { mapInstance.invalidateSize(); }, 300);
    }
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!state.isAdmin) {
        Swal.fire('ระงับการทำงาน', 'แถบข้างซ้ายถูกล็อกไว้เฉพาะเจ้าหน้าที่ที่ผ่านการล็อกอินแล้ว', 'info');
        return;
    }
    sidebar.classList.toggle('hidden');
    sidebar.classList.toggle('-translate-x-full');
}

function initLeafletGISMap() {
    const mapDiv = document.getElementById('map-canvas');
    if (!mapDiv) return;
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }

    mapInstance = L.map('map-canvas').setView([18.2743, 99.4124], 12);
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance);
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');

    const baseMaps = { "แผนที่ทั่วไป": osmLayer, "ภาพดาวเทียม": satelliteLayer };
    communityLayers = {};
    
    const activeBorrows = state.data.filter(item => {
        const s = item.Status || item[8];
        const g = item.GPS || item[16];
        return (s === 'Borrowed' || s === 'ยืม') && g;
    });

    activeBorrows.forEach(item => {
        const gpsStr = item.GPS || item[16];
        const coords = gpsStr.split(',');
        if (coords.length === 2) {
            const lat = parseFloat(coords[0].trim());
            const lng = parseFloat(coords[1].trim());
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const commName = item.Community || item[4] || "ทั่วไปนอกเขต";
                if (!communityLayers[commName]) communityLayers[commName] = L.layerGroup();

                const popupContent = `
                    <div style="font-family:'Sarabun'; font-size:12px;">
                        <strong style="color:#4f46e5;">📌 รหัสพัสดุ: ${item.EquipmentID || item[5]}</strong><br>
                        <b>ผู้ป่วย:</b> ${item.PatientName || item[13] || item[1]}<br>
                        <b>ชุมชน:</b> ${commName}<br>
                        <b>โทร:</b> ${item.Phone || item[12]}
                    </div>
                `;
                L.marker([lat, lng]).bindPopup(popupContent).addTo(communityLayers[commName]);
            }
        }
    });

    const overlayMaps = {};
    for (let key in communityLayers) {
        communityLayers[key].addTo(mapInstance);
        overlayMaps[`เขต: ${key}`] = communityLayers[key];
    }

    mapLayerControl = L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(mapInstance);
    setTimeout(() => { mapInstance.invalidateSize(); }, 200);
}

function getCurrentLocation() {
    if (!navigator.geolocation) { Swal.fire('ไม่รองรับ', 'อุปกรณ์ไม่เปิดสิทธิ์แชร์ระบบระบุพิกัดดาวเทียม', 'error'); return; }
    Swal.fire({ title: 'กำลังคำนวณหาตำแหน่ง...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    navigator.geolocation.getCurrentPosition((pos) => {
        document.getElementById('borrow-gps').value = `${pos.coords.latitude}, ${pos.coords.longitude}`;
        Swal.fire('สำเร็จ', 'ดึงตำแหน่งพิกัดภูมิศาสตร์เรียบร้อย', 'success');
    }, (err) => { Swal.fire('ขัดข้อง', 'สัญญาณดาวเทียมอับหรือยกเลิกสิทธิ์ส่งต่อพิกัด', 'error'); }, { enableHighAccuracy: true, timeout: 8000 });
}

function exportToCSV(sheetName) {
    let dataset = sheetName === 'BorrowLog' ? state.data : state.equipments;
    if (dataset.length === 0) { Swal.fire('ระงับสั่งงาน', 'ไม่มีชุดข้อมูลที่จะรายงานไฟล์', 'info'); return; }
    const columns = Object.keys(dataset[0]);
    let csvStr = "\uFEFF" + columns.join(",") + "\n";
    dataset.forEach(row => {
        let line = columns.map(c => {
            return safeCsvCell(row[c]);
        });
        csvStr += line.join(",") + "\n";
    });
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${sheetName}_Report.csv`;
    link.click();
}

async function submitBorrowForm(event) {
    event.preventDefault();
    const isEditing = !!editingBorrowId;
    const hasPhotos = borrowPhotos.length > 0;
    Swal.fire({
        title: isEditing ? 'กำลังอัปเดตข้อมูล...' : 'กำลังบันทึกเอกสาร...',
        html: hasPhotos ? `<span class="text-xs text-gray-400">กำลังอัปโหลดรูปภาพหลักฐาน ${borrowPhotos.length} รูป อาจใช้เวลาถึง 30-60 วินาที<br>กรุณาอย่าปิดหน้าต่างนี้ระหว่างดำเนินการ</span>` : '',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const payload = {
        EquipmentID: document.getElementById('borrow-eq-id').value,
        SerialNumber: document.getElementById('borrow-serial').value,
        PatientName: document.getElementById('borrow-patient').value,
        BorrowerName: document.getElementById('borrow-name').value || document.getElementById('borrow-patient').value,
        CitizenID: document.getElementById('borrow-citizen').value,
        Phone: document.getElementById('borrow-phone').value,
        Relationship: document.getElementById('borrow-relationship').value,
        Community: document.getElementById('borrow-community').value,
        Address: document.getElementById('borrow-address').value,
        GPS: document.getElementById('borrow-gps').value.trim(),
        BorrowDate: new Date(document.getElementById('borrow-date').value).toISOString(),
        Deposit: document.getElementById('borrow-deposit').value,
        Note: document.getElementById('borrow-note').value,
        imagesBase64: borrowPhotos
    };

    if (isEditing) {
        payload.EntryID = editingBorrowId;
        payload.keepImageIds = existingBorrowImageIds; // แจ้งรายการรูปเดิมที่ยังต้องการเก็บไว้ ให้เซิร์ฟเวอร์ลบรูปที่เอาออกทิ้งจริงจาก Drive
    }

    try {
        const res = await run(isEditing ? 'updateBorrow' : 'addBorrow', payload);
        if (res.success) {
            Swal.fire('บันทึกสำเร็จ', isEditing ? 'อัปเดตข้อมูลรายการยืมเรียบร้อยแล้ว' : 'ระบบลงทะเบียนอนุมัติพิมพ์สัญญาเรียบร้อย', 'success');
            cancelBorrowForm();
            await loadSystemData();
        } else {
            Swal.fire('ไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาดในการบันทึกเอกสาร กรุณาลองใหม่อีกครั้ง', 'error');
        }
    } catch (e) { Swal.fire('ล้มเหลว', 'เกิดข้อผิดพลาดเครือข่าย', 'error'); }
}

function processReturnItem(id) {
    Swal.fire({
        title: 'ยืนยันรับคืนอุปกรณ์แพทย์?',
        text: "กรอกบันทึกสภาพเพื่อตรวจสอบร่องรอยครุภัณฑ์รับคืนเข้าสู่คลังชิ้นงาน",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันรับคืน',
        input: 'text',
        inputPlaceholder: 'ตัวอย่าง: สภาพสมบูรณ์ดี, มีตำหนิบางส่วน...'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังตัดยอดคืนคลัง...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
            const res = await run('returnBorrow', { EntryID: id, ReturnDate: new Date().toISOString(), Note: result.value || 'คืนสภาพปกติ' });
            if (res.success) { Swal.fire('รับคืนเสร็จสิ้น', 'อัปเดตสถานะว่างพร้อมใช้งานในคลังแล้ว', 'success'); await loadSystemData(); }
            else { Swal.fire('ไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาดในการบันทึกการคืนอุปกรณ์', 'error'); }
        }
    });
}

async function deleteBorrowRecord(entryId) {
    if (state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','การ VOID รายการใช้ได้เฉพาะ ADMIN','warning'); return; }
    const result=await Swal.fire({title:'VOID รายการยืม?',text:'ข้อมูลจะไม่ถูกลบ และยังตรวจสอบย้อนหลังได้',icon:'warning',input:'textarea',inputLabel:'เหตุผลการ VOID',inputPlaceholder:'ระบุเหตุผล...',showCancelButton:true,confirmButtonText:'ยืนยัน VOID',cancelButtonText:'ยกเลิก',confirmButtonColor:'#e11d48',inputValidator:v=>String(v||'').trim().length<3?'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร':undefined});
    if(!result.isConfirmed)return;
    const res=await run('deleteBorrow',{id:entryId,reason:String(result.value||'').trim()});
    if(res.success){Swal.fire('VOID สำเร็จ','เก็บข้อมูลเดิมไว้ในระบบแล้ว','success');await loadSystemData();}
    else Swal.fire('ไม่สำเร็จ',res.error||'เกิดข้อผิดพลาด','error');
}

async function submitEquipmentForm(event) {
    event.preventDefault();
    Swal.fire({ title: 'กำลังบันทึกครุภัณฑ์...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    const payload = {
        EquipmentID: document.getElementById('eq-id').value.trim(),
        EquipmentName: document.getElementById('eq-name').value.trim(),
        SerialNumber: document.getElementById('eq-serial').value.trim()
    };
    const res = await run('addEquipment', payload);
    if (res.success) { Swal.fire('เพิ่มขึ้นคลังสำเร็จ', '', 'success'); closeEquipmentModal(); await loadSystemData(); }
    else { Swal.fire('ไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาดในการบันทึกครุภัณฑ์', 'error'); }
}

async function deleteEquipmentRecord(eqId) {
    if (state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','การปิดใช้งานอุปกรณ์ใช้ได้เฉพาะ ADMIN','warning'); return; }
    const result=await Swal.fire({title:'ปิดใช้งานอุปกรณ์?',text:'ระบบจะไม่ลบประวัติเดิม',icon:'warning',input:'textarea',inputLabel:'เหตุผลการปิดใช้งาน',showCancelButton:true,confirmButtonText:'ยืนยันปิดใช้งาน',cancelButtonText:'ยกเลิก',inputValidator:v=>String(v||'').trim().length<3?'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร':undefined});
    if(!result.isConfirmed)return;
    const res=await run('deleteEquipment',{id:eqId,reason:String(result.value||'').trim()});
    if(res.success){Swal.fire('ปิดใช้งานแล้ว','','success');await loadSystemData();}else Swal.fire('ไม่สำเร็จ',res.error||'เกิดข้อผิดพลาด','error');
}

async function saveSettingsForm(event) {
    event.preventDefault();
    Swal.fire({ title: 'กำลังปรับโครงสร้างระบบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    const rawComm = document.getElementById('set-communities').value.split('\n');
    const communities = [];
    rawComm.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) communities.push({ moo: parts[0].trim(), name: parts[1].trim() });
    });

    const payload = {
        agency1: document.getElementById('set-agency1').value.trim(),
        agency2: document.getElementById('set-agency2').value.trim(),
        oldLogoUrl: document.getElementById('set-logo-old').value,
        communities: communities
    };

    const file = document.getElementById('set-logo-file').files[0];
    if (file) {
        const rd = new FileReader();
        rd.readAsDataURL(file);
        rd.onload = async () => {
            payload.logoBase64 = rd.result;
            const res = await run('saveSettings', payload);
            if (res.success) { Swal.fire('อัปเดตระบบแล้ว', '', 'success'); await loadSystemData(); }
            else { Swal.fire('ไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า', 'error'); }
        };
    } else {
        const res = await run('saveSettings', payload);
        if (res.success) { Swal.fire('อัปเดตระบบแล้ว', '', 'success'); await loadSystemData(); }
        else { Swal.fire('ไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า', 'error'); }
    }
}

async function submitLogin(event) {
    event.preventDefault();
    Swal.fire({ title: 'กำลังพิสูจน์สิทธิ์...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    const uid = document.getElementById('login-uid').value;
    const pwd = document.getElementById('login-pwd').value;

    const res = await run('login', { adminId: uid, password: pwd });
    if (res.success) {
        setSessionValue('token', res.token);
        setSessionValue('adminId', res.adminId);
        setSessionValue('adminName', res.adminName);
        setSessionValue('role', res.role || 'ADMIN');
        Swal.fire('สิทธิ์ล็อกอินผ่านสำเร็จ', 'ยินดีต้อนรับเข้าใช้งานหน้าต่างควบคุม', 'success').then(() => { window.location.reload(); });
    } else {
        Swal.fire('เข้าสู่ระบบล้มเหลว', res.error || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง', 'error');
    }
}

async function logout() {
    try { await run('logout', {}); } catch (e) { console.warn('backend logout ไม่สำเร็จ:', e); }
    clearAuthSession();
    window.location.reload();
}
function openLoginModal() { document.getElementById('modal-login').classList.add('active'); }
function closeLoginModal() { document.getElementById('modal-login').classList.remove('active'); }
function openBorrowForm() {
    editingBorrowId = null;
    existingBorrowImageIds = [];
    borrowPhotos = [];
    document.getElementById('form-borrow').reset();
    document.getElementById('borrow-date').valueAsDate = new Date();
    document.getElementById('borrow-modal-title').innerText = 'บันทึกเอกสารสัญญายืมพัสดุชิ้นใหม่';
    setBorrowSubmitButtonMode(false);
    populateFormSelectors();
    renderBorrowPhotoPreviews();
    switchTab('borrow-form');
}
function cancelBorrowForm() {
    editingBorrowId = null;
    existingBorrowImageIds = [];
    borrowPhotos = [];
    renderBorrowPhotoPreviews();
    switchTab('borrow');
}

// ✏️ เปิดฟอร์มเดิมขึ้นมาแก้ไข พร้อมดึงข้อมูล/รูปภาพเดิมมาแสดงไว้ล่วงหน้า สำหรับกรณีบันทึกผิดแล้วต้องการแก้ไข
function editBorrowRecord(entryId) {
    const record = state.data.find(r => (r.EntryID || r[0]) === entryId);
    if (!record) return;

    editingBorrowId = entryId;
    borrowPhotos = [];
    const imagesRaw = record.Images || record[7] || '';
    existingBorrowImageIds = String(imagesRaw).split(',').map(s => s.trim()).filter(Boolean);

    populateFormSelectors(record.EquipmentID || record[5]);

    document.getElementById('borrow-eq-id').value = record.EquipmentID || record[5] || '';
    document.getElementById('borrow-serial').value = record.SerialNumber || record[6] || '';
    document.getElementById('borrow-patient').value = record.PatientName || record[13] || '';
    document.getElementById('borrow-name').value = record.BorrowerName || record[1] || '';
    document.getElementById('borrow-citizen').value = record.CitizenID || record[2] || '';
    document.getElementById('borrow-phone').value = record.Phone || record[12] || '';
    document.getElementById('borrow-relationship').value = record.Relationship || record[14] || '';
    document.getElementById('borrow-address').value = record.Address || record[3] || '';
    document.getElementById('borrow-gps').value = record.GPS || record[16] || '';
    document.getElementById('borrow-deposit').value = record.Deposit || record[15] || 0;
    document.getElementById('borrow-note').value = record.Note || record[11] || '';

    const rawDate = record.BorrowDate || record[9];
    if (rawDate) {
        const d = new Date(rawDate);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        document.getElementById('borrow-date').value = d.toISOString().split('T')[0];
    }

    // ตั้งค่าเขตชุมชนหลังจากสร้าง dropdown แล้วเท่านั้น (populateFormSelectors สร้าง option ใหม่ไปแล้วด้านบน)
    document.getElementById('borrow-community').value = record.Community || record[4] || '';

    document.getElementById('borrow-modal-title').innerText = `แก้ไขรายการยืม (${record.EquipmentID || record[5] || ''})`;
    setBorrowSubmitButtonMode(true);
    renderBorrowPhotoPreviews();
    switchTab('borrow-form');
}

function setBorrowSubmitButtonMode(isEditing) {
    const btn = document.getElementById('borrow-submit-btn');
    const label = document.getElementById('borrow-submit-label');
    if (!btn || !label) return;
    if (isEditing) {
        label.innerText = 'อัปเดตข้อมูลรายการยืม';
        btn.style.backgroundColor = '#d97706';
        btn.classList.remove('btn-cta-teal');
        btn.classList.add('btn-cta-amber');
    } else {
        label.innerText = 'บันทึกเอกสารสัญญา';
        btn.style.backgroundColor = '#0d9488';
        btn.classList.remove('btn-cta-amber');
        btn.classList.add('btn-cta-teal');
    }
}

// 📷 ระบบแนบรูปภาพหลักฐานการยืม (ถ่ายจากกล้องหรือเลือกจากคลังภาพ) สูงสุด 3 รูป
function handleBorrowPhotoSelect(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // เคลียร์ค่า input เพื่อให้เลือกไฟล์เดิมซ้ำได้ในครั้งถัดไป
    if (!file) return;

    if (existingBorrowImageIds.length + borrowPhotos.length >= 3) {
        Swal.fire('แนบรูปครบแล้ว', 'สามารถแนบรูปหลักฐานได้สูงสุด 3 รูปต่อรายการยืม', 'warning');
        return;
    }
    if (!file.type.startsWith('image/')) {
        Swal.fire('ไฟล์ไม่ถูกต้อง', 'กรุณาเลือกเฉพาะไฟล์รูปภาพเท่านั้น', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        compressImageDataUrl(e.target.result, 1000, 0.65).then(compressed => {
            borrowPhotos.push(compressed);
            renderBorrowPhotoPreviews();
        });
    };
    reader.readAsDataURL(file);
}

// 🗜️ ย่อขนาด/บีบอัดรูปภาพก่อนแนบส่งขึ้นเซิร์ฟเวอร์ เพื่อให้อัปโหลดเร็วและเสถียร (รูปจากกล้องมือถือมักมีขนาดหลาย MB)
function compressImageDataUrl(dataUrl, maxDimension, quality) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round(height * (maxDimension / width));
                    width = maxDimension;
                } else {
                    width = Math.round(width * (maxDimension / height));
                    height = maxDimension;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl); // ถ้าย่อไม่สำเร็จ ใช้ไฟล์ต้นฉบับแทน
        img.src = dataUrl;
    });
}

function removeBorrowPhoto(index) {
    borrowPhotos.splice(index, 1);
    renderBorrowPhotoPreviews();
}

function removeExistingBorrowImage(index) {
    existingBorrowImageIds.splice(index, 1);
    renderBorrowPhotoPreviews();
}

function renderBorrowPhotoPreviews() {
    const wrap = document.getElementById('borrow-photo-previews');
    const trigger = document.getElementById('borrow-photo-trigger');
    const triggerLabel = document.getElementById('borrow-photo-trigger-label');
    if (!wrap) return;

    const existingHtml = existingBorrowImageIds.map((id, idx) => `
        <div class="photo-preview-item">
            <img src="${driveImageUrl(id)}" alt="รูปหลักฐานเดิม ${idx + 1}" />
            <div class="photo-preview-remove" onclick="removeExistingBorrowImage(${idx})" title="เอารูปนี้ออก"><i class="fa-solid fa-xmark"></i></div>
        </div>
    `).join('');
    const newHtml = borrowPhotos.map((src, idx) => `
        <div class="photo-preview-item">
            <img src="${src}" alt="รูปหลักฐานใหม่ ${idx + 1}" />
            <span class="absolute top-1 left-1 bg-teal-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">ใหม่</span>
            <div class="photo-preview-remove" onclick="removeBorrowPhoto(${idx})" title="เอารูปนี้ออก"><i class="fa-solid fa-xmark"></i></div>
        </div>
    `).join('');

    const totalCount = existingBorrowImageIds.length + borrowPhotos.length;
    if (totalCount === 0) {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
    } else {
        wrap.classList.remove('hidden');
        wrap.innerHTML = existingHtml + newHtml;
    }

    if (!trigger || !triggerLabel) return;
    if (totalCount >= 3) {
        trigger.classList.add('hidden');
    } else {
        trigger.classList.remove('hidden');
        triggerLabel.innerText = `ถ่ายรูปหลักฐาน (${totalCount}/3)`;
    }
}

// 🖼️ เปิดดูรูปภาพหลักฐานที่แนบไว้กับรายการยืมจากตารางแอดมิน
// 🖼️ ประกอบ URL รูปภาพจากค่าที่เก็บในคอลัมน์ Images ซึ่งอาจเป็น "รหัสไฟล์ Drive ล้วนๆ" (รูปแบบปัจจุบัน)
// หรือ "URL เต็ม" (รูปแบบเก่าที่เคยบันทึกไว้ก่อนหน้านี้) ให้รองรับได้ทั้งสองแบบ
function driveImageUrl(idOrUrl) {
    const val = String(idOrUrl).trim();
    if (val.startsWith('http')) return val; // เดิมเคยเก็บเป็น URL เต็มไว้แล้ว ใช้ตรงๆ ได้เลย
    return `https://drive.google.com/thumbnail?id=${val}&sz=w800`; // เก็บเป็นรหัสไฟล์ล้วนๆ ให้ประกอบ URL เอง
}

function viewBorrowImages(entryId) {
    const record = state.data.find(r => (r.EntryID || r[0]) === entryId);
    if (!record) return;
    const imagesRaw = record.Images || record[7] || '';
    const urls = String(imagesRaw).split(',').map(s => s.trim()).filter(Boolean).map(driveImageUrl);

    const body = document.getElementById('image-gallery-body');
    if (urls.length === 0) {
        body.innerHTML = `<div class="col-span-full empty-state"><i class="fa-solid fa-image text-3xl"></i><span>ไม่มีรูปภาพหลักฐานแนบสำหรับรายการนี้</span></div>`;
    } else {
        body.innerHTML = urls.map(url => `
            <div class="gallery-photo-item">
                <img src="${url}" alt="รูปหลักฐานการยืม" onclick="window.open('${url}', '_blank')" />
            </div>
        `).join('');
    }
    document.getElementById('modal-image-gallery').classList.add('active');
}
function closeImageGallery() {
    document.getElementById('modal-image-gallery').classList.remove('active');
}
function openEquipmentModal() { document.getElementById('modal-equipment').classList.add('active'); }
function closeEquipmentModal() { document.getElementById('modal-equipment').classList.remove('active'); }

async function checkSchemaStatus() {
    const box = document.getElementById('schema-status');
    if (!box) return;
    box.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังตรวจสอบโครงสร้างข้อมูล...';
    try {
        const res = await run('getSchemaStatus', {});
        if (res.success && res.ready) {
            box.className = 'text-[11px] text-emerald-700 mt-2';
            box.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> โครงสร้างข้อมูลพร้อมใช้งาน v3.6';
        } else if (res.success) {
            const missing = [...(res.missingColumns || []), ...(res.missingSheets || [])].join(', ');
            box.className = 'text-[11px] text-amber-700 mt-2';
            box.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> ต้องอัปเกรด: ${missing || 'โครงสร้างยังไม่ครบ'}`;
        } else {
            box.className = 'text-[11px] text-rose-600 mt-2';
            box.textContent = res.error || 'ตรวจสอบโครงสร้างไม่สำเร็จ';
        }
    } catch (e) {
        box.className = 'text-[11px] text-rose-600 mt-2';
        box.textContent = 'ไม่สามารถตรวจสอบ backend ได้';
    }
}

async function upgradeSchemaV35() {
    const confirm = await Swal.fire({
        title: 'อัปเกรดโครงสร้างเป็น v3.6?',
        html: '<div class="text-xs text-left">ระบบจะ <b>เพิ่มเฉพาะ</b> คอลัมน์ คอลัมน์สำหรับ Role/Audit/VOID/Inactive และสร้างชีต AuditLog/BorrowExtensionLog เฉพาะเมื่อยังไม่มี<br><br><b>จะไม่ลบ ไม่ clear และไม่เขียนทับข้อมูลเดิม</b></div>',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันอัปเกรด',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#4f46e5'
    });
    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังตรวจและอัปเกรดโครงสร้าง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const res = await run('upgradeSchema', {});
    if (res.success) {
        const additions = [
            ...(res.addedColumns || []).map(x => `คอลัมน์ ${x}`),
            ...(res.createdSheets || []).map(x => `ชีต ${x}`)
        ];
        await Swal.fire('อัปเกรดสำเร็จ', additions.length ? `${res.message}<br><br>เพิ่ม: ${additions.join(', ')}` : res.message, 'success');
        await checkSchemaStatus();
        await loadSystemData();
    } else {
        Swal.fire('อัปเกรดไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาด', 'error');
    }
}

// 👥 โหลดรายชื่อผู้ใช้งานสิทธิ์ Admin ทั้งหมดมาแสดงในหน้าตั้งค่า

async function loadAuditLogSection(){const box=document.getElementById('audit-log-list');if(!box)return;box.innerHTML='กำลังโหลด...';const res=await run('getAuditLog',{limit:50});if(!res.success){box.textContent=res.error||'โหลดไม่สำเร็จ';return;}box.innerHTML=(res.data||[]).map(x=>`<div class="border-b py-2"><b>${escapeHtml(x.Action)}</b> • ${escapeHtml(x.AdminName||x.AdminID)} • ${escapeHtml(x.Module)}<br><span class="text-gray-400">${escapeHtml(x.Timestamp)} ${escapeHtml(x.RecordID||'')}</span></div>`).join('')||'ยังไม่มี Audit Log';}
async function loadLineConfigStatus(){const el=document.getElementById('line-config-status');if(!el)return;const r=await run('getLineConfigStatus',{});el.textContent=r.success?`Token: ${r.tokenConfigured?'พร้อม':'ยังไม่มี'} | Target: ${r.targetConfigured?'พร้อม '+(r.targetMasked||''):'ยังไม่มี'} | แจ้งเตือน: ${r.enabled?'เปิด':'ปิด'} | Daily: ${r.dailyTrigger?'ตั้งแล้ว':'ยังไม่ตั้ง'}`:(r.error||'ตรวจสอบไม่ได้');}
async function saveLineConfigForm(){const token=(document.getElementById('line-token').value||'').trim(),targetId=(document.getElementById('line-target').value||'').trim(),enabled=document.getElementById('line-enabled').checked;const r=await run('saveLineConfig',{channelAccessToken:token,targetId,enabled});if(r.success){document.getElementById('line-token').value='';Swal.fire('บันทึก LINE OA แล้ว','','success');loadLineConfigStatus();}else Swal.fire('ไม่สำเร็จ',r.error||'','error');}
async function testLineNotification(){const r=await run('testLineNotification',{});Swal.fire(r.success?'ส่งทดสอบสำเร็จ':'ส่งไม่สำเร็จ',r.error||'ตรวจสอบ LINE OA ได้แล้ว',r.success?'success':'error');}
async function setupLineDailyTrigger(){const r=await run('setupLineDailyTrigger',{});Swal.fire(r.success?'ตั้งเวลาแล้ว':'ไม่สำเร็จ',r.message||r.error||'',r.success?'success':'error');loadLineConfigStatus();}

async function loadAdminUsersSection() {
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    list.innerHTML = `<div class="empty-state py-6"><i class="fa-solid fa-spinner fa-spin text-lg"></i><span>กำลังโหลดรายชื่อผู้ใช้งาน...</span></div>`;
    try {
        const res = await run('getAdminUsers', {});
        if (res.needLogin) { list.innerHTML = `<div class="empty-state py-6"><i class="fa-solid fa-lock text-lg"></i><span>กรุณาเข้าสู่ระบบใหม่อีกครั้ง</span></div>`; return; }
        if (!res.success) { list.innerHTML = `<div class="empty-state py-6 text-rose-500"><i class="fa-solid fa-triangle-exclamation text-lg"></i><span>${res.error || 'โหลดข้อมูลไม่สำเร็จ'}</span></div>`; return; }
        renderAdminUsersTable(res.data || []);
    } catch (e) {
        list.innerHTML = `<div class="empty-state py-6 text-rose-500"><i class="fa-solid fa-triangle-exclamation text-lg"></i><span>เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</span></div>`;
    }
}

function renderAdminUsersTable(users) {
    const list=document.getElementById('admin-users-list'); if(!list)return;
    if(!users.length){list.innerHTML='<div class="empty-state py-6">ยังไม่มีบัญชีผู้ใช้งาน</div>';return;}
    const me=getSessionValue('adminId')||'';
    list.innerHTML=users.map(u=>{
      const isMe=String(u.adminId).toLowerCase()===String(me).toLowerCase();
      const status=u.active!==false?'เปิดใช้งาน':'ปิดใช้งาน';
      return `<div class="flex items-center justify-between bg-gray-50 border rounded-xl px-3 py-2.5"><div><p class="font-bold">${escapeHtml(u.adminName)} <span class="text-[10px] text-indigo-600">${escapeHtml(u.role||'STAFF')}</span></p><p class="text-[11px] text-gray-400">${escapeHtml(u.adminId)} • ${status}</p></div><button ${isMe?'disabled':''} onclick="setAdminUserActivePrompt('${escapeHtml(u.adminId)}',${u.active===false?'true':'false'})" class="px-3 py-1.5 rounded-lg text-xs font-bold ${u.active===false?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}">${u.active===false?'เปิดใช้':'ปิดใช้'}</button></div>`;
    }).join('');
}
function setAdminUserActivePrompt(adminId,active){Swal.fire({title:active?'เปิดใช้งานบัญชี?':'ปิดใช้งานบัญชี?',icon:'question',showCancelButton:true,confirmButtonText:'ยืนยัน'}).then(async r=>{if(!r.isConfirmed)return;const res=await run('setAdminUserActive',{adminId,active});if(res.success){Swal.fire('สำเร็จ','','success');loadAdminUsersSection();}else Swal.fire('ไม่สำเร็จ',res.error||'','error');});}

function openAddAdminUserModal() {
    document.getElementById('form-admin-user').reset();
    document.getElementById('modal-admin-user').classList.add('active');
}
function closeAddAdminUserModal() { document.getElementById('modal-admin-user').classList.remove('active'); }

async function submitAddAdminUserForm(event) {
    event.preventDefault();
    const adminId = document.getElementById('new-admin-id').value.trim();
    const adminName = document.getElementById('new-admin-name').value.trim();
    const password = document.getElementById('new-admin-password').value.trim();
    const role = document.getElementById('new-admin-role') ? document.getElementById('new-admin-role').value : 'STAFF';

    Swal.fire({ title: 'กำลังเพิ่มผู้ใช้งาน...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const res = await run('addAdminUser', { adminId, adminName, password, role });
        if (res.success) {
            Swal.fire('เพิ่มผู้ใช้งานสำเร็จ', `เพิ่มบัญชี "${adminId}" เข้าสู่ระบบเรียบร้อยแล้ว`, 'success');
            closeAddAdminUserModal();
            loadAdminUsersSection();
        } else {
            Swal.fire('ไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาดในการเพิ่มผู้ใช้งาน', 'error');
        }
    } catch (e) {
        Swal.fire('ล้มเหลว', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    }
}

function deleteAdminUserPrompt(adminId) {
    Swal.fire({
        title: 'ยืนยันการลบผู้ใช้งาน?',
        text: `ต้องการลบบัญชี "${adminId}" ออกจากระบบใช่หรือไม่ บัญชีนี้จะไม่สามารถเข้าสู่ระบบได้อีก`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันลบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#e11d48'
    }).then(async (result) => {
        if (!result.isConfirmed) return;
        Swal.fire({ title: 'กำลังลบผู้ใช้งาน...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        try {
            const res = await run('deleteAdminUser', { adminId });
            if (res.success) {
                Swal.fire('ลบสำเร็จ', 'ลบบัญชีผู้ใช้งานเรียบร้อยแล้ว', 'success');
                loadAdminUsersSection();
            } else {
                Swal.fire('ไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน', 'error');
            }
        } catch (e) {
            Swal.fire('ล้มเหลว', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    });
}

// ฟังก์ชันสากลสำหรับสร้างชุดปุ่มกดพลิกหน้าเพจตารางข้อมูลสไตล์ Premium Soft UI
function buildPaginationDashboardControls(controlsContainerId, infoLabelId, currentPageNumber, totalItemsCount, rowsLimit, pageChangeFunctionName) {
    const containerElement = document.getElementById(controlsContainerId);
    const infoLabelElement = document.getElementById(infoLabelId);
    if (!containerElement) return;

    const totalPagesCount = Math.ceil(totalItemsCount / rowsLimit) || 1;
    const startRecordIndex = totalItemsCount === 0 ? 0 : (currentPageNumber - 1) * rowsLimit + 1;
    const endRecordIndex = Math.min(currentPageNumber * rowsLimit, totalItemsCount);

    if (infoLabelElement) {
        infoLabelElement.innerText = `แสดงรายการที่ ${startRecordIndex} - ${endRecordIndex} จากทั้งหมด ${totalItemsCount} รายการ (หน้า ${currentPageNumber} / ${totalPagesCount})`;
    }

    // ดีไซน์ปุ่มย้อนกลับแบบตรวจสอบสิทธิ์ Disabled สวยงาม
    let controlsHtmlStructure = `
        <button onclick="${pageChangeFunctionName}(${currentPageNumber - 1})" ${currentPageNumber === 1 ? 'disabled class="text-gray-300 cursor-not-allowed px-2.5 py-1 font-bold text-xs"' : 'class="text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg font-bold text-xs transition-all"'}>◀ ย้อนกลับ</button>
    `;

    // วาดเม็ดกระดุมตัวเลขหน้าเพจแบบยืดหยุ่น (Smart Page Numbers)
    for (let pageIdx = 1; pageIdx <= totalPagesCount; pageIdx++) {
        if (pageIdx === currentPageNumber) {
            controlsHtmlStructure += `<span class="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-black shadow-sm">${pageIdx}</span>`;
        } else if (pageIdx === 1 || pageIdx === totalPagesCount || Math.abs(pageIdx - currentPageNumber) <= 1) {
            controlsHtmlStructure += `<button onclick="${pageChangeFunctionName}(${pageIdx})" class="text-gray-600 hover:bg-gray-100 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all">${pageIdx}</button>`;
        } else if (pageIdx === currentPageNumber - 2 || pageIdx === currentPageNumber + 2) {
            controlsHtmlStructure += `<span class="text-gray-400 px-1 text-xs">...</span>`;
        }
    }

    // ดีไซน์ปุ่มหน้าถัดไป
    controlsHtmlStructure += `
        <button onclick="${pageChangeFunctionName}(${currentPageNumber + 1})" ${currentPageNumber === totalPagesCount ? 'disabled class="text-gray-300 cursor-not-allowed px-2.5 py-1 font-bold text-xs"' : 'class="text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg font-bold text-xs transition-all"'}>ถัดไป ▶</button>
    `;

    containerElement.innerHTML = controlsHtmlStructure;
}

// 🔀 ฟังก์ชันรับช่วงคำสั่งคลิกเปลี่ยนหน้าของแต่ละตารางแยกจากกันอิสระ
function changePublicPage(targetPage) {
    publicCurrentPage = targetPage;
    renderBorrowTable(); // เรียกฟังก์ชันวาดตารางสาธารณะอีกครั้งพร้อมหน้าใหม่
}

function changeEquipPage(targetPage) {
    equipCurrentPage = targetPage;
    renderEquipmentTable(); // เรียกฟังก์ชันวาดตารางคลังพัสดุอีกครั้งพร้อมหน้าใหม่
}
