/**
 * ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ - Frontend Controller API (v5.0.0 Supabase Core)
 * พัฒนาโดย: ศบส.บ้านโทกหัวช้าง (James)
 */

const API_URL = "https://txjuiaiwffsxfcrxpkvd.supabase.co/functions/v1/med-device-api";



const STORAGE_KEYS = {
    token: 'medDevice.adminToken',
    refreshToken: 'medDevice.refreshToken',
    adminId: 'medDevice.adminId',
    adminName: 'medDevice.adminName',
    theme: 'medDevice.themeMode',
    fontScale: 'medDevice.fontScale',
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
    [STORAGE_KEYS.token, STORAGE_KEYS.refreshToken, STORAGE_KEYS.adminId, STORAGE_KEYS.adminName, 'adminToken', 'adminId', 'adminName']
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
function escapeJsSingleQuoted(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/</g, '\\x3C').replace(/>/g, '\\x3E');
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
    managementAnalytics: null,
    procurementPlan: null,
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
const borrowImageCache = new Map();

async function run(action, payload = {}) {
    const sessionToken = getSessionToken();
    if (sessionToken) payload.token = sessionToken;
    if (!API_URL || API_URL === "YOUR_GAS_WEB_APP_URL") {
        console.error("ยังไม่ได้ระบุที่อยู่เว็บบริการ API_URL ของระบบ Supabase");
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
        const rawText = await response.text();
        const trimmed = String(rawText || '').trim();
        const looksHtml = /^<!doctype\s+html|^<html|^</i.test(trimmed);
        if (!response.ok || !trimmed || looksHtml) {
            const statusText = response.status ? `HTTP ${response.status}` : 'ไม่มี HTTP status';
            const detail = response.status === 404
                ? 'ไม่พบ Supabase Edge Function ที่ URL ปัจจุบัน กรุณาตรวจสอบ deployment ของ med-device-api'
                : 'Backend Supabase ตอบกลับไม่ใช่ JSON กรุณาตรวจสอบ Edge Function และการเชื่อมต่อ';
            console.error('Backend API ไม่พร้อมใช้งาน:', statusText, trimmed.slice(0, 180));
            if (!window.__backendUnavailableNotified && typeof Swal !== 'undefined') {
                window.__backendUnavailableNotified = true;
                Swal.fire({
                    title: 'Backend Supabase ไม่พร้อมใช้งาน',
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
            return { success: false, error: 'Backend Supabase ส่งข้อมูลที่ไม่ใช่ JSON กรุณาตรวจสอบ Edge Function', backendUnavailable: true, httpStatus: response.status || 0 };
        }
        // 🔒 หาก Token หมดอายุ/ไม่ถูกต้อง (เช่น เกิน 6 ชม. หลังล็อกอิน) ให้แจ้งเตือนชัดเจนและพากลับไปหน้าล็อกอินใหม่
        // แทนที่จะปล่อยให้ทุกฟังก์ชันขึ้น "ไม่สำเร็จ" แบบไม่ทราบสาเหตุ
        if (result && result.needLogin && action !== 'refreshSession' && !payload.__refreshAttempted) {
            const refreshToken = getSessionValue('refreshToken');
            if (refreshToken) {
                payload.__refreshAttempted = true;
                const refreshed = await run('refreshSession', { refreshToken, __refreshAttempted: true });
                if (refreshed && refreshed.success && refreshed.token) {
                    setSessionValue('token', refreshed.token);
                    setSessionValue('refreshToken', refreshed.refreshToken || refreshToken);
                    if (refreshed.adminId) setSessionValue('adminId', refreshed.adminId);
                    if (refreshed.adminName) setSessionValue('adminName', refreshed.adminName);
                    if (refreshed.role) setSessionValue('role', refreshed.role);
                    delete payload.token;
                    return run(action, payload);
                }
            }
        }
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
    initFontScale();
    initThemeMode();
    await checkAuthSession();
    await loadSystemData();
    if (state.role === 'ADMIN') loadLineRichMenuStatus();
    const borrowDate = document.getElementById('borrow-date');
    if (borrowDate) borrowDate.valueAsDate = new Date();
});

// 🔎 ปรับขนาดตัวอักษรทั้งระบบ พร้อมจดจำค่าบนเครื่องผู้ใช้
const FONT_SCALE_STEPS = [0.9, 1.0, 1.1, 1.2, 1.3];
function normalizeFontScale(value){
    const n=Number(value);
    if(!Number.isFinite(n))return 1;
    return FONT_SCALE_STEPS.reduce((best,x)=>Math.abs(x-n)<Math.abs(best-n)?x:best,1);
}
function initFontScale(){
    applyFontScale(normalizeFontScale(localStorage.getItem(STORAGE_KEYS.fontScale)||1));
}
function applyFontScale(scale){
    const v=normalizeFontScale(scale);
    document.documentElement.style.setProperty('--font-scale',String(v));
    localStorage.setItem(STORAGE_KEYS.fontScale,String(v));
    const label=document.getElementById('font-scale-label');
    if(label)label.textContent=Math.round(v*100)+'%';
}
function changeFontScale(direction){
    const current=normalizeFontScale(localStorage.getItem(STORAGE_KEYS.fontScale)||1);
    let idx=FONT_SCALE_STEPS.indexOf(current);
    idx=Math.max(0,Math.min(FONT_SCALE_STEPS.length-1,idx+Number(direction||0)));
    applyFontScale(FONT_SCALE_STEPS[idx]);
}
function resetFontScale(){ applyFontScale(1); }

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
            Swal.fire('ซิงค์สถานะสำเร็จ', `ปรับปรุงข้อมูล ${res.updatedCount} รายการ (กำลังยืม ${res.totalBorrowed} จากทั้งหมด ${res.totalEquipments} ชิ้น; คงสถานะ lifecycle ${res.preservedLifecycle||0} ชิ้น)`, 'success');
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
        state.role = res.role || getSessionValue('role') || 'STAFF';
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
            if (resLog.success) {
                state.data = resLog.data || [];
                if (state.role === 'ADMIN') {
                    const borrowedSet = getBorrowedEquipmentIdSet();
                    const mismatch = state.equipments.some(eq => {
                        const id = String(eq.EquipmentID || eq[0] || '').trim();
                        const stored = String(eq.Status || eq[3] || 'Available').trim();
                        return borrowedSet.has(id) !== ['Borrowed','ยืม'].includes(stored);
                    });
                    if (mismatch) {
                        const synced = await run('syncEquipmentStatus', {});
                        if (synced && synced.success) {
                            const refreshedEq = await run('getData', { sheetName: 'Equipments' });
                            if (refreshedEq && refreshedEq.success) state.equipments = refreshedEq.data || [];
                        } else {
                            console.warn('Data integrity auto-sync failed:', synced && synced.error ? synced.error : 'unknown');
                        }
                    }
                }
            }
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
    if (set.has(eqId)) return 'Borrowed';
    const stored = String(eq.Status || eq[3] || 'Available').trim();
    const allowed = ['Available','Cleaning','Inspection','Maintenance','Damaged','Lost','Retired'];
    return allowed.includes(stored) ? stored : 'Available';
}

function getEquipmentLifecycleMeta(status) {
    const map = {
        Available:{label:'พร้อมใช้งาน',icon:'fa-circle-check',cls:'bg-emerald-50 text-emerald-700 border-emerald-100'},
        Borrowed:{label:'กำลังยืม',icon:'fa-handshake',cls:'bg-rose-50 text-rose-700 border-rose-100'},
        Cleaning:{label:'รอทำความสะอาด',icon:'fa-soap',cls:'bg-cyan-50 text-cyan-700 border-cyan-100'},
        Inspection:{label:'รอตรวจสอบ',icon:'fa-magnifying-glass',cls:'bg-amber-50 text-amber-700 border-amber-100'},
        Maintenance:{label:'ส่งซ่อม/บำรุง',icon:'fa-screwdriver-wrench',cls:'bg-orange-50 text-orange-700 border-orange-100'},
        Damaged:{label:'ชำรุด',icon:'fa-triangle-exclamation',cls:'bg-red-50 text-red-700 border-red-100'},
        Lost:{label:'สูญหาย',icon:'fa-circle-exclamation',cls:'bg-purple-50 text-purple-700 border-purple-100'},
        Retired:{label:'ปลดระวาง',icon:'fa-ban',cls:'bg-gray-100 text-gray-600 border-gray-200'}
    };
    return map[status] || map.Available;
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
    const borrowedSet = getBorrowedEquipmentIdSet();
    const lifecycleCounts = { Available:0, Borrowed:0, Cleaning:0, Inspection:0, Maintenance:0, Damaged:0, Lost:0, Retired:0 };
    state.equipments.forEach(eq => { const s=getEquipmentStatus(eq,borrowedSet); lifecycleCounts[s]=(lifecycleCounts[s]||0)+1; });

    let borrowedCount, availableCount, overdueCount, nearDueCount, extendedCount, totalLogs;
    borrowedCount = activeBorrows.length;
    availableCount = lifecycleCounts.Available || 0;
    const unavailableCount = Math.max(0,totalEq-availableCount-borrowedCount);

    if (state.isAdmin) {
        overdueCount = activeBorrows.filter(isOverdueBorrow).length;
        nearDueCount = activeBorrows.filter(r => !isOverdueBorrow(r) && isNearDueBorrow(r)).length;
        extendedCount = activeBorrows.filter(r => getExtensionCount(r) > 0).length;
        totalLogs = state.data.length;
    } else if (state.publicSummary) {
        borrowedCount = Number(state.publicSummary.borrowed || borrowedCount);
        availableCount = Number(state.publicSummary.available ?? availableCount);
        overdueCount = Number(state.publicSummary.overdue || 0);
        nearDueCount = Number(state.publicSummary.nearDue || 0);
        extendedCount = Number(state.publicSummary.extended || 0);
        totalLogs = Number(state.publicSummary.totalBorrowRecords || 0);
    } else { overdueCount=0;nearDueCount=0;extendedCount=0;totalLogs=0; }

    const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.innerText=value;};
    setText('stat-total-eq',totalEq);setText('stat-borrow-eq',borrowedCount);setText('stat-avail-eq',availableCount);setText('stat-overdue-eq',overdueCount);setText('stat-near-due',nearDueCount);setText('stat-extended-eq',extendedCount);setText('stat-total-logs',totalLogs);
    renderUsageAllocationBar(totalEq,availableCount,borrowedCount,overdueCount,Math.max(0,totalEq-availableCount-borrowedCount));
    updateSidebarBorrowBadge(borrowedCount);updateSidebarTrackingBadge(overdueCount);
}

// 🎯 วาดแถบสัดส่วนสถานะการใช้งานครุภัณฑ์ (สรุปยืม-คืน หักลบ แบบเห็นภาพรวมทันที)
function renderUsageAllocationBar(totalEq, availableCount, borrowedCount, overdueCount, unavailableCount) {
    const segAvail=document.getElementById('usage-seg-available'),segBorrow=document.getElementById('usage-seg-borrowed'),segOverdue=document.getElementById('usage-seg-overdue'),segUnavailable=document.getElementById('usage-seg-unavailable'),caption=document.getElementById('usage-bar-caption');
    if(!segAvail||!segBorrow||!segOverdue)return;
    const normalBorrowed=Math.max(borrowedCount-overdueCount,0),safeTotal=totalEq>0?totalEq:1,unavailable=Math.max(0,Number(unavailableCount||0));
    const pctAvail=availableCount/safeTotal*100,pctBorrow=normalBorrowed/safeTotal*100,pctOverdue=overdueCount/safeTotal*100,pctUnavailable=unavailable/safeTotal*100;
    segAvail.style.width=pctAvail+'%';segBorrow.style.width=pctBorrow+'%';segOverdue.style.width=pctOverdue+'%';if(segUnavailable)segUnavailable.style.width=pctUnavailable+'%';
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.innerText=v;};set('usage-legend-avail',availableCount);set('usage-legend-borrow',borrowedCount);set('usage-legend-overdue',overdueCount);set('usage-legend-unavailable',unavailable);
    if(totalEq===0)caption.innerText='ยังไม่มีข้อมูลครุภัณฑ์ในคลัง กรุณาลงทะเบียนอุปกรณ์เพื่อเริ่มใช้งานระบบ';
    else caption.innerText=`จากครุภัณฑ์ทั้งหมด ${totalEq} ชิ้น: พร้อมใช้งาน ${availableCount} ชิ้น (${pctAvail.toFixed(0)}%), กำลังยืม ${borrowedCount} ชิ้น (${((borrowedCount/safeTotal)*100).toFixed(0)}%), ไม่พร้อมใช้/ซ่อม/ตรวจ ${unavailable} ชิ้น (${pctUnavailable.toFixed(0)}%), เกินกำหนด ${overdueCount} ชิ้น`;
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
    const grid=document.getElementById('equipment-type-grid');if(!grid)return;grid.innerHTML='';const groups={},borrowedSet=getBorrowedEquipmentIdSet();
    state.equipments.forEach(eq=>{let name=eq.EquipmentName||eq[1];name=name?String(name).trim():'อุปกรณ์ทั่วไป';if(!groups[name])groups[name]={total:0,available:0,borrowed:0,attention:0};groups[name].total++;const s=getEquipmentStatus(eq,borrowedSet);if(s==='Available')groups[name].available++;else if(s==='Borrowed')groups[name].borrowed++;else groups[name].attention++;});
    if(!Object.keys(groups).length){grid.innerHTML=`<div class="col-span-full empty-state"><i class="fa-solid fa-box-open text-3xl"></i><span>ยังไม่มีข้อมูลครุภัณฑ์ในคลัง</span></div>`;return;}
    for(const name in groups){const {icon,solid,pastel,border,text}=getCategoryVisual(name),g=groups[name],card=document.createElement('div');card.className='cat-card border p-4 rounded-2xl shadow-sm flex items-center justify-between transition-all hover:scale-[1.02] hover:shadow-lg';card.style.backgroundColor=pastel;card.style.borderColor=border;card.style.color=text;card.innerHTML=`<div class="flex items-center gap-3 overflow-hidden"><div class="cat-badge w-12 h-12 flex items-center justify-center rounded-2xl text-white flex-shrink-0" style="background-color:${solid}; box-shadow:0 6px 16px -6px ${solid}99, 0 0 0 4px ${solid}33;"><i class="fa-solid ${icon} text-xl"></i></div><div class="overflow-hidden"><h5 class="font-bold text-xs text-gray-700 truncate">${escapeHtml(name)}</h5><p class="text-[11px] text-gray-500 mt-0.5">ทั้งหมด: ${g.total} | พร้อมใช้: <span class="text-emerald-600 font-bold">${g.available}</span>${g.attention?` | ไม่พร้อม: <span class="text-slate-500 font-bold">${g.attention}</span>`:''}</p></div></div><div class="text-right flex-shrink-0"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background-color:#ffe4e6; color:#be123c;">ยืมอยู่: ${g.borrowed}</span></div>`;grid.appendChild(card);}
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
                <td class="p-3 font-semibold text-gray-700">${escapeHtml(item.EquipmentID || item[5] || '-')}</td>
                <td class="p-3 font-medium">${escapeHtml(item.PatientName || item.BorrowerName || item[13] || item[1] || '-')}</td>
                <td class="p-3 font-mono text-gray-400">${escapeHtml(item.CitizenID || item[2] || '-')}</td>
                <td class="p-3">${escapeHtml(item.Community || item[4] || '-')}</td>
                <td class="p-3">${borrowDateFormatted}</td>
                <td class="p-3 font-mono text-gray-400">${escapeHtml(item.Phone || item[12] || '-')}</td>
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
                        `<button onclick="viewBorrowImages('${escapeJsSingleQuoted(entryId)}')" class="relative bg-amber-50 hover:bg-amber-100 text-amber-700 p-1.5 rounded-lg transition" title="ดูรูปภาพหลักฐานแนบ (${photoCount} รูป)"><i class="fa-solid fa-camera text-xs"></i><span class="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full">${photoCount}</span></button>` :
                        `<span class="bg-gray-50 text-gray-300 p-1.5 rounded-lg" title="ไม่มีรูปภาพหลักฐานแนบ"><i class="fa-solid fa-camera text-xs"></i></span>`
                    }
                    <button onclick="printLoanReceipt('${escapeJsSingleQuoted(entryId)}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 p-1.5 rounded-lg transition" title="พิมพ์ใบอนุมัติสัญญาค้ำประกันคลัง"><i class="fa-solid fa-print text-xs"></i></button>
                    ${(status === 'Borrowed' || status === 'ยืม') ?
                        `<button onclick="editBorrowRecord('${escapeJsSingleQuoted(entryId)}')" class="bg-amber-50 hover:bg-amber-100 text-amber-700 p-1.5 rounded-lg transition" title="แก้ไขรายการนี้ (กรณีบันทึกผิด)"><i class="fa-solid fa-pen text-xs"></i></button>` : ''
                    }
                    ${(status === 'Borrowed' || status === 'ยืม') ?
                        `<button onclick="processReturnItem('${escapeJsSingleQuoted(entryId)}')" class="bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-[11px] px-2.5 py-1 rounded-lg transition">คืน</button>` : ''
                    }
                    <button onclick="deleteBorrowRecord('${escapeJsSingleQuoted(entryId)}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-lg transition"><i class="fa-solid fa-trash-can text-xs"></i></button>
                </div>
            `;

            tableStructureHtml += `
                <tr class="hover:bg-gray-50/70 transition-all duration-100">
                    <td class="p-3 font-semibold text-gray-700">${escapeHtml(eqId)}</td>
                    <td class="p-3 font-medium">${escapeHtml(patientName)}</td>
                    <td class="p-3 font-mono">${escapeHtml(citizenId)}</td>
                    <td class="p-3">${escapeHtml(community)}</td>
                    <td class="p-3">${dateFormatted}</td>
                    <td class="p-3 font-mono">${escapeHtml(phone)}</td>
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
async function printLoanReceipt(entryId) {
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
        document.getElementById('print-agency-name').innerHTML = title2 ? `${escapeHtml(title1)}<br>${escapeHtml(title2)}` : escapeHtml(title1);
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

    // 🖼️ รอให้โลโก้โหลดเสร็จก่อนเปิด Print Preview ป้องกันภาพหาย/ภาพแตก
    const printLogoEl = document.getElementById('print-logo');
    if (printLogoEl && !printLogoEl.complete) {
        await new Promise(resolve => {
            let finished = false;
            const done = () => { if (!finished) { finished = true; resolve(); } };
            printLogoEl.addEventListener('load', done, { once: true });
            printLogoEl.addEventListener('error', done, { once: true });
            setTimeout(done, 2000);
        });
    }
    if (printLogoEl && typeof printLogoEl.decode === 'function') {
        try { await printLogoEl.decode(); } catch (_) {}
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
            <td class="border border-gray-200 p-2 font-semibold text-orange-600">${escapeHtml(eqId)}</td>
            <td class="border border-gray-200 p-2 text-left">${escapeHtml(borrowerDetails)}</td>
            <td class="border border-gray-200 p-2 text-gray-500">กำลังยืมใช้งาน</td>
            <td class="border border-gray-200 p-2">${extensionText}</td>
            <td class="border border-gray-200 p-2 text-emerald-600">${borrowDateStr}</td>
            <td class="border border-gray-200 p-2 ${dueClass}">${dueDateStr}</td>
            <td class="border border-gray-200 p-2 font-mono">${escapeHtml(phone)}</td>
            <td class="border border-gray-200 p-2">${signalBadge}</td>`;

        const actionCell = forPrint ? '' : `
            <td class="border border-gray-200 p-2 print:hidden">
                ${overdue
                    ? `<button onclick="openExtendBorrowPrompt('${escapeJsSingleQuoted(entryId)}')" class="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition whitespace-nowrap"><i class="fa-solid fa-calendar-plus mr-1"></i>ยืมต่อ</button>`
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
                    <div><b>อุปกรณ์:</b> ${escapeHtml(eqId)}</div>
                    <div><b>ผู้ยืม/ผู้ป่วย:</b> ${escapeHtml(patient)}</div>
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
            text: res.error || 'กรุณาไปที่เมนูตั้งค่าแล้วกดอัปเกรดโครงสร้าง v4.1.1',
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
        const lifecycleStatus = getEquipmentStatus(item, borrowedSet);

        let statusMatch = true;
        if (statusFilter !== 'all') statusMatch = lifecycleStatus.toLowerCase() === statusFilter;
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
            const meta = getEquipmentLifecycleMeta(status);
            const statusBadge = `<span class="px-2 py-0.5 text-[10px] font-semibold rounded-full border ${meta.cls}"><i class="fa-solid ${meta.icon} mr-1"></i>${meta.label}</span>`;

            tr.innerHTML = `
                <td class="p-3 font-semibold text-gray-700">${escapeHtml(item.EquipmentID || item[0] || '-')}</td>
                <td class="p-3 font-medium text-gray-800">${escapeHtml(item.EquipmentName || item[1] || '-')}</td>
                <td class="p-3 font-mono text-gray-400">${escapeHtml(item.SerialNumber || item[2] || '-')}</td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 print:hidden">
                    <div class="flex items-center gap-1">
                        <button onclick="openEquipmentLifecyclePrompt('${escapeJsSingleQuoted(item.EquipmentID || item[0])}')" class="bg-amber-50 hover:bg-amber-100 text-amber-700 p-1.5 rounded-lg transition" title="เปลี่ยนสถานะ/ซ่อม"><i class="fa-solid fa-screwdriver-wrench text-xs"></i></button>
                        <button onclick="deleteEquipmentRecord('${escapeJsSingleQuoted(item.EquipmentID || item[0])}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-lg transition" title="ปิดใช้งาน"><i class="fa-solid fa-ban text-xs"></i></button>
                    </div>
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
    if (state.isAdmin && ['settings','analytics','procurement'].includes(tabId) && state.role !== 'ADMIN') { Swal.fire('สงวนสิทธิ์ ADMIN','เมนูนี้ใช้ได้เฉพาะ ADMIN','warning'); return; }
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
    if (tabId === 'analytics') {
        loadManagementAnalytics();
    }
    if (tabId === 'procurement') {
        loadProcurementPlan();
    }
    if (tabId === 'settings') {
        loadAdminUsersSection();
        checkSchemaStatus();
        loadAuditLogSection();
        loadMaintenanceStatus();
        loadMaintenanceLog();
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
                        <strong style="color:#4f46e5;">📌 รหัสพัสดุ: ${escapeHtml(item.EquipmentID || item[5] || '-')}</strong><br>
                        <b>ผู้ป่วย:</b> ${escapeHtml(item.PatientName || item[13] || item[1] || '-')}<br>
                        <b>ชุมชน:</b> ${escapeHtml(commName)}<br>
                        <b>โทร:</b> ${escapeHtml(item.Phone || item[12] || '-')}
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

function analyticsSetText(id,value){const el=document.getElementById(id);if(el)el.textContent=value;}

function analyticsMonthLabel(key){
    const p=String(key||'').split('-');
    if(p.length!==2)return key||'-';
    const d=new Date(Number(p[0]),Number(p[1])-1,1);
    return d.toLocaleDateString('th-TH',{month:'short',year:'2-digit'});
}

function analyticsPeriodText(period){
    if(!period)return '';
    if(!period.start)return 'ช่วงข้อมูล: ประวัติทั้งหมดจนถึงปัจจุบัน';
    const a=new Date(period.start),b=new Date(period.end);
    const f=d=>Number.isNaN(d.getTime())?'-':d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
    return `ช่วงข้อมูล: ${f(a)} – ${f(b)}`;
}

async function loadManagementAnalytics(){
    if(state.role!=='ADMIN')return;
    const period=document.getElementById('analytics-period')?.value||'fy';
    ['analytics-monthly','analytics-lifecycle','analytics-communities','analytics-recommendations'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='<div class="text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังวิเคราะห์ข้อมูล...</div>';});
    const top=document.getElementById('analytics-top-equipment');if(top)top.innerHTML='<tr><td colspan="3" class="p-4 text-center text-gray-400">กำลังโหลด...</td></tr>';
    const repairs=document.getElementById('analytics-repairs');if(repairs)repairs.innerHTML='<tr><td colspan="4" class="p-4 text-center text-gray-400">กำลังโหลด...</td></tr>';
    const r=await run('getManagementAnalytics',{period});
    if(!r||!r.success){
        const msg=String((r&&r.error)||'ไม่สามารถโหลด Management Analytics ได้');
        const box=document.getElementById('analytics-recommendations');if(box)box.innerHTML=`<div class="text-rose-600">${escapeHtml(msg)}${msg.includes('ไม่พบ Action')?'<br>กรุณา Deploy Backend v4.1.1 ก่อน':''}</div>`;
        return;
    }
    state.managementAnalytics=r;
    const k=r.kpi||{};
    analyticsSetText('analytics-kpi-records',Number(k.recordsInPeriod||0).toLocaleString('th-TH'));
    analyticsSetText('analytics-kpi-util',`${Number(k.currentUtilizationRate||0).toFixed(1)}%`);
    analyticsSetText('analytics-kpi-overdue',`${Number(k.currentOverdue||0)} (${Number(k.overdueRate||0).toFixed(1)}%)`);
    analyticsSetText('analytics-kpi-days',`${Number(k.avgLoanDays||0).toFixed(1)} วัน`);
    analyticsSetText('analytics-kpi-reach',`${Number(k.equipmentReachRate||0).toFixed(1)}%`);
    analyticsSetText('analytics-kpi-extension',`${Number(k.extensionRate||0).toFixed(1)}%`);
    analyticsSetText('analytics-period-label',analyticsPeriodText(r.period));
    renderManagementMonthly(r.monthlyTrend||[]);
    renderManagementLifecycle(r.lifecycleSummary||{});
    renderManagementTopEquipment(r.topEquipment||[]);
    renderManagementCommunities(r.topCommunities||[]);
    renderManagementRepairs(r.repairEquipment||[]);
    renderManagementRecommendations(r.recommendations||[]);
}

function renderManagementMonthly(rows){
    const box=document.getElementById('analytics-monthly');if(!box)return;
    if(!rows.length){box.innerHTML='<div class="text-gray-400">ยังไม่มีข้อมูลในช่วงที่เลือก</div>';return;}
    const max=Math.max(1,...rows.map(x=>Math.max(Number(x.borrowCount||0),Number(x.returnCount||0))));
    box.innerHTML=rows.map(x=>{const b=Number(x.borrowCount||0),r=Number(x.returnCount||0);return `<div class="grid grid-cols-12 gap-2 items-center"><div class="col-span-2 text-[10px] text-gray-500">${escapeHtml(analyticsMonthLabel(x.month))}</div><div class="col-span-8 space-y-1"><div class="h-2 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-indigo-400 rounded-full" style="width:${Math.max(2,b/max*100)}%"></div></div><div class="h-2 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-emerald-400 rounded-full" style="width:${Math.max(2,r/max*100)}%"></div></div></div><div class="col-span-2 text-right text-[10px]"><span class="text-indigo-600">ยืม ${b}</span><br><span class="text-emerald-600">คืน ${r}</span></div></div>`;}).join('');
}

function renderManagementLifecycle(data){
    const box=document.getElementById('analytics-lifecycle');if(!box)return;
    const order=['Available','Borrowed','Cleaning','Inspection','Maintenance','Damaged','Lost','Retired','Inactive'];
    const labels={Available:'พร้อมใช้',Borrowed:'กำลังยืม',Cleaning:'ทำความสะอาด',Inspection:'รอตรวจ',Maintenance:'ส่งซ่อม',Damaged:'ชำรุด',Lost:'สูญหาย',Retired:'ปลดระวาง',Inactive:'ปิดใช้งาน'};
    box.innerHTML=order.map(k=>`<div class="border border-gray-100 rounded-xl p-3 bg-gray-50/50"><div class="text-[10px] text-gray-500">${labels[k]}</div><div class="text-xl font-black text-gray-800">${Number(data[k]||0)}</div></div>`).join('');
}

function renderManagementTopEquipment(rows){
    const body=document.getElementById('analytics-top-equipment');if(!body)return;
    if(!rows.length){body.innerHTML='<tr><td colspan="3" class="p-4 text-center text-gray-400">ยังไม่มีข้อมูล</td></tr>';return;}
    body.innerHTML=rows.map((x,i)=>{const avg=Number(x.returnedCount||0)>0?Number(x.totalLoanDays||0)/Number(x.returnedCount):0;return `<tr class="border-t border-gray-100"><td class="p-2"><span class="font-bold text-gray-700">${i+1}. ${escapeHtml(x.equipmentName||x.equipmentId)}</span><br><span class="text-[10px] text-gray-400">${escapeHtml(x.equipmentId||'')}</span></td><td class="p-2 text-right font-bold">${Number(x.borrowCount||0)}</td><td class="p-2 text-right">${avg.toFixed(1)}</td></tr>`;}).join('');
}

function renderManagementCommunities(rows){
    const box=document.getElementById('analytics-communities');if(!box)return;
    if(!rows.length){box.innerHTML='<div class="text-gray-400">ยังไม่มีข้อมูล</div>';return;}
    const max=Math.max(1,...rows.map(x=>Number(x.borrowCount||0)));
    box.innerHTML=rows.map((x,i)=>{const n=Number(x.borrowCount||0);return `<div><div class="flex justify-between gap-2 mb-1"><span class="truncate text-gray-700">${i+1}. ${escapeHtml(x.community||'ไม่ระบุ')}</span><span class="font-bold">${n} ครั้ง</span></div><div class="h-2 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-rose-400 rounded-full" style="width:${Math.max(2,n/max*100)}%"></div></div></div>`;}).join('');
}

function renderManagementRepairs(rows){
    const body=document.getElementById('analytics-repairs');if(!body)return;
    if(!rows.length){body.innerHTML='<tr><td colspan="4" class="p-4 text-center text-gray-400">ยังไม่พบเหตุการณ์ซ่อม/ตรวจสภาพในช่วงที่เลือก</td></tr>';return;}
    body.innerHTML=rows.map(x=>`<tr class="border-t border-gray-100"><td class="p-2"><span class="font-bold text-gray-700">${escapeHtml(x.equipmentName||x.equipmentId)}</span><br><span class="text-[10px] text-gray-400">${escapeHtml(x.equipmentId||'')}</span></td><td class="p-2 text-right font-bold">${Number(x.eventCount||0)}</td><td class="p-2 text-right">${Number(x.maintenanceCount||0)}</td><td class="p-2 text-right">${Number(x.damagedCount||0)}</td></tr>`).join('');
}

function renderManagementRecommendations(rows){
    const box=document.getElementById('analytics-recommendations');if(!box)return;
    box.innerHTML=(rows.length?rows:['ยังไม่มีข้อเสนอจากข้อมูล']).map((x,i)=>`<div class="flex gap-2 bg-white/70 border border-violet-100 rounded-xl p-3"><span class="font-black text-violet-600">${i+1}</span><span>${escapeHtml(x)}</span></div>`).join('');
}

function procurementActionBadge(action){
    const a=String(action||'');
    let cls='bg-slate-100 text-slate-700';
    if(a.includes('จัดหาเพิ่ม'))cls='bg-emerald-50 text-emerald-700 border border-emerald-100';
    else if(a.includes('ทดแทน'))cls='bg-amber-50 text-amber-700 border border-amber-100';
    else if(a==='เฝ้าระวัง')cls='bg-rose-50 text-rose-700 border border-rose-100';
    else if(a==='ทบทวนสต็อก')cls='bg-slate-100 text-slate-600 border border-slate-200';
    return `<span class="inline-flex px-2 py-1 rounded-full text-[10px] font-bold ${cls}">${escapeHtml(a||'เพียงพอ')}</span>`;
}

async function loadProcurementPlan(){
    if(state.role!=='ADMIN')return;
    const period=document.getElementById('procurement-period')?.value||'fy';
    const body=document.getElementById('procurement-plan-body');
    const repl=document.getElementById('procurement-replacement-body');
    const rec=document.getElementById('procurement-recommendations');
    if(body)body.innerHTML='<tr><td colspan="9" class="p-6 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังจัดทำแผน...</td></tr>';
    if(repl)repl.innerHTML='<tr><td colspan="5" class="p-6 text-center text-gray-400">กำลังโหลด...</td></tr>';
    if(rec)rec.innerHTML='<div class="text-gray-400">กำลังวิเคราะห์...</div>';
    const r=await run('getProcurementPlan',{period});
    if(!r||!r.success){
        const msg=String((r&&r.error)||'ไม่สามารถโหลดแผนจัดหาได้');
        if(body)body.innerHTML=`<tr><td colspan="9" class="p-6 text-center text-rose-600">${escapeHtml(msg)}${msg.includes('ไม่พบ Action')?'<br>กรุณา Deploy Backend v4.1.1 ก่อน':''}</td></tr>`;
        return;
    }
    state.procurementPlan=r;
    const s=r.summary||{};
    analyticsSetText('proc-kpi-types',Number(s.equipmentTypes||0).toLocaleString('th-TH'));
    analyticsSetText('proc-kpi-priority',Number(s.highPriorityTypes||0).toLocaleString('th-TH'));
    analyticsSetText('proc-kpi-add',Number(s.recommendedAddUnits||0).toLocaleString('th-TH')+' ชิ้น');
    analyticsSetText('proc-kpi-replace',Number(s.replacementUnits||0).toLocaleString('th-TH')+' ชิ้น');
    analyticsSetText('proc-kpi-underused',Number(s.underusedTypes||0).toLocaleString('th-TH'));
    analyticsSetText('procurement-period-label',analyticsPeriodText(r.period));
    const rows=r.plan||[];
    if(body)body.innerHTML=rows.length?rows.map(x=>`<tr class="border-t border-gray-100 hover:bg-gray-50/60"><td class="p-3"><div class="font-bold text-gray-800">${escapeHtml(x.equipmentName||'-')}</div><div class="text-[10px] text-gray-400 mt-1">${escapeHtml(x.reason||'')}</div></td><td class="p-3 text-right">${Number(x.stock||0)}</td><td class="p-3 text-right font-bold text-indigo-700">${Number(x.borrowCount||0)}</td><td class="p-3 text-right">${Number(x.snapshotUtilization||0).toFixed(1)}%</td><td class="p-3 text-right">${Number(x.repairEvents||0)}</td><td class="p-3 text-right font-bold text-emerald-700">${Number(x.recommendedAdd||0)}</td><td class="p-3 text-right font-bold text-amber-700">${Number(x.replacementCandidates||0)}</td><td class="p-3 text-center"><span class="font-black ${Number(x.priorityScore||0)>=60?'text-rose-600':Number(x.priorityScore||0)>=40?'text-amber-600':'text-slate-600'}">${Number(x.priorityScore||0)}</span></td><td class="p-3">${procurementActionBadge(x.action)}</td></tr>`).join(''):'<tr><td colspan="9" class="p-6 text-center text-gray-400">ไม่มีข้อมูลสำหรับช่วงที่เลือก</td></tr>';
    const rr=r.replacementCandidates||[];
    if(repl)repl.innerHTML=rr.length?rr.map(x=>`<tr class="border-t border-gray-100"><td class="p-3 font-mono font-bold">${escapeHtml(x.equipmentId||'-')}</td><td class="p-3">${escapeHtml(x.equipmentName||'-')}</td><td class="p-3 text-center">${escapeHtml(getEquipmentLifecycleMeta(x.currentStatus||'Available').label)}</td><td class="p-3 text-right font-bold">${Number(x.eventCount||0)}</td><td class="p-3">${escapeHtml(x.reason||'-')}</td></tr>`).join(''):'<tr><td colspan="5" class="p-6 text-center text-gray-400">ยังไม่มีอุปกรณ์เข้าข่ายทดแทนจากข้อมูลที่บันทึก</td></tr>';
    if(rec)rec.innerHTML=(r.recommendations||[]).map((x,i)=>`<div class="flex gap-2"><span class="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold flex-shrink-0">${i+1}</span><span>${escapeHtml(x)}</span></div>`).join('')||'<div>ยังไม่มีข้อเสนอเพิ่มเติม</div>';
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
    const citizenDigits = String(document.getElementById('borrow-citizen')?.value || '').replace(/\D/g, '');
    if (!isEditing && citizenDigits.length !== 13) {
        Swal.fire('กรุณาตรวจเลขประชาชน', 'รายการใหม่ต้องกรอกเลขประจำตัวประชาชน 13 หลัก ระบบจะส่งไปประมวลผลแต่เก็บในฐานใหม่เฉพาะเลขท้าย 4 หลัก', 'warning');
        return;
    }
    if (isEditing && citizenDigits && citizenDigits.length !== 13) {
        Swal.fire('กรุณาตรวจเลขประชาชน', 'หากต้องการแก้เลขประชาชน กรุณากรอกให้ครบ 13 หลัก หรือเว้นว่างเพื่อคงข้อมูลเดิมแบบปกปิด', 'warning');
        return;
    }
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

async function processReturnItem(id) {
    const html = `
      <div class="text-left text-sm">
        <label class="block font-bold text-gray-700 mb-1">สภาพอุปกรณ์เมื่อรับคืน</label>
        <select id="return-condition" class="swal2-select" style="display:flex;width:100%;margin:0 0 12px 0">
          <option value="Available">พร้อมใช้งาน</option>
          <option value="Cleaning">ต้องทำความสะอาด</option>
          <option value="Inspection">รอตรวจสอบ</option>
          <option value="Maintenance">ส่งซ่อม/บำรุงรักษา</option>
          <option value="Damaged">ชำรุด</option>
          <option value="Lost">สูญหาย</option>
        </select>
        <label class="block font-bold text-gray-700 mb-1">บันทึกสภาพ / การดำเนินการ</label>
        <textarea id="return-condition-note" class="swal2-textarea" style="display:flex;width:100%;margin:0" placeholder="เช่น สภาพสมบูรณ์, ต้องเปลี่ยนลูกยาง, ส่งซ่อมล้อ..."></textarea>
        <p class="text-xs text-gray-500 mt-2">ถ้าเลือกสถานะอื่นนอกจาก “พร้อมใช้งาน” ต้องระบุรายละเอียดอย่างน้อย 3 ตัวอักษร และอุปกรณ์จะยังไม่กลับเข้ารายการพร้อมยืม</p>
      </div>`;
    const result = await Swal.fire({
        title:'รับคืนและตรวจสภาพอุปกรณ์', html, icon:'question', showCancelButton:true,
        confirmButtonText:'ยืนยันรับคืน', cancelButtonText:'ยกเลิก',
        preConfirm:()=>{
            const condition=document.getElementById('return-condition').value;
            const note=(document.getElementById('return-condition-note').value||'').trim();
            if(condition!=='Available' && note.length<3){Swal.showValidationMessage('กรุณาระบุรายละเอียดสภาพอุปกรณ์อย่างน้อย 3 ตัวอักษร');return false;}
            return {condition,note};
        }
    });
    if(!result.isConfirmed)return;
    Swal.fire({ title:'กำลังบันทึกรับคืนและสถานะอุปกรณ์...', allowOutsideClick:false, didOpen:()=>Swal.showLoading() });
    const v=result.value||{};
    const res=await run('returnBorrow',{EntryID:id,ReturnDate:new Date().toISOString(),ReturnCondition:v.condition,ReturnConditionNote:v.note,Note:v.note||'คืนสภาพปกติ'});
    if(res.success){
        await Swal.fire('รับคืนเสร็จสิ้น',`สถานะอุปกรณ์: ${escapeHtml(res.equipmentStatusLabel||getEquipmentLifecycleMeta(v.condition).label)}`,'success');
        await loadSystemData();
    }else{
        Swal.fire('ไม่สำเร็จ',res.error||'เกิดข้อผิดพลาดในการบันทึกการคืนอุปกรณ์','error');
    }
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

async function openEquipmentLifecyclePrompt(eqId) {
    if(state.role!=='ADMIN'){Swal.fire('สงวนสิทธิ์ ADMIN','การเปลี่ยนสถานะคลังใช้ได้เฉพาะ ADMIN','warning');return;}
    const item=state.equipments.find(e=>String(e.EquipmentID||e[0])===String(eqId));
    const current=getEquipmentStatus(item||{},getBorrowedEquipmentIdSet());
    if(current==='Borrowed'){Swal.fire('ยังเปลี่ยนไม่ได้','อุปกรณ์กำลังถูกยืม ต้องรับคืนก่อนจึงเปลี่ยนสถานะคลังได้','warning');return;}
    const options={Available:'พร้อมใช้งาน',Cleaning:'รอทำความสะอาด',Inspection:'รอตรวจสอบ',Maintenance:'ส่งซ่อม/บำรุงรักษา',Damaged:'ชำรุด',Lost:'สูญหาย',Retired:'ปลดระวาง'};
    const result=await Swal.fire({
        title:`สถานะอุปกรณ์ ${escapeHtml(eqId)}`,
        input:'select', inputOptions:options, inputValue:current, inputLabel:'เลือกสถานะใหม่',
        html:'<p class="text-xs text-gray-500 mb-2">สถานะที่ไม่ใช่ “พร้อมใช้งาน” จะถูกกันออกจากรายการอุปกรณ์ที่สามารถยืมได้</p>',
        showCancelButton:true, confirmButtonText:'ถัดไป', cancelButtonText:'ยกเลิก'
    });
    if(!result.isConfirmed)return;
    const status=result.value;
    let note='';
    if(status!=='Available'){
        const n=await Swal.fire({title:'รายละเอียดการดำเนินการ',input:'textarea',inputPlaceholder:'เช่น รอทำความสะอาด, ส่งร้านซ่อม, ชำรุดที่ล้อ...',showCancelButton:true,confirmButtonText:'บันทึกสถานะ',inputValidator:v=>String(v||'').trim().length<3?'กรุณาระบุอย่างน้อย 3 ตัวอักษร':undefined});
        if(!n.isConfirmed)return; note=String(n.value||'').trim();
    }
    const res=await run('setEquipmentLifecycle',{EquipmentID:eqId,status,note});
    if(res.success){await Swal.fire('อัปเดตสถานะแล้ว',res.label||getEquipmentLifecycleMeta(status).label,'success');await loadSystemData();}
    else Swal.fire('ไม่สำเร็จ',res.error||'ไม่สามารถเปลี่ยนสถานะอุปกรณ์ได้','error');
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
        if (res.refreshToken) setSessionValue('refreshToken', res.refreshToken);
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
    { const cv=String(record.CitizenID || record[2] || ''); document.getElementById('borrow-citizen').value = /^\d{13}$/.test(cv) ? cv : ''; }
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

function normalizeBorrowImageId(value){
    const v=String(value||'').trim();if(!v)return '';if(!v.startsWith('http'))return v;
    const m=v.match(/[?&]id=([^&]+)/)||v.match(/\/d\/([A-Za-z0-9_-]+)/);return m?decodeURIComponent(m[1]):'';
}
const borrowImageErrorCache = new Map();
async function getBorrowImageDataUrl(value){
    const id=normalizeBorrowImageId(value);
    if(!id)return '';
    if(borrowImageCache.has(id))return borrowImageCache.get(id);
    const r=await run('getBorrowImage',{fileId:id});
    if(!r||!r.success||!r.dataUrl){
        const msg=(r&&r.error)?String(r.error):'โหลดรูปหลักฐานไม่สำเร็จ';
        borrowImageErrorCache.set(id,msg);
        console.warn('โหลดรูปหลักฐานไม่สำเร็จ',{fileId:id,response:r});
        return '';
    }
    borrowImageErrorCache.delete(id);
    borrowImageCache.set(id,r.dataUrl);
    return r.dataUrl;
}
async function hydrateSecureBorrowImages(root=document){
    const imgs=[...root.querySelectorAll('img[data-borrow-file-id]')];
    await Promise.all(imgs.map(async img=>{
        const id=String(img.dataset.borrowFileId||'').trim();
        const u=await getBorrowImageDataUrl(id);
        if(u){
            img.src=u;
            img.alt='รูปหลักฐานการยืม';
            img.title='';
            img.classList.remove('opacity-40','opacity-60');
            return;
        }
        const err=borrowImageErrorCache.get(id)||'ไม่สามารถโหลดรูปหลักฐาน';
        const svg='<svg xmlns="http://www.w3.org/2000/svg" width="260" height="170"><rect width="100%" height="100%" fill="#f8fafc"/><text x="50%" y="46%" text-anchor="middle" fill="#64748b" font-size="15">โหลดรูปไม่ได้</text><text x="50%" y="60%" text-anchor="middle" fill="#94a3b8" font-size="11">กรุณาลองใหม่หรือตรวจสอบสิทธิ์ไฟล์</text></svg>';
        img.src='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
        img.alt='โหลดรูปหลักฐานไม่สำเร็จ';
        img.title=err;
        img.classList.add('opacity-60');
    }));
}
function renderBorrowPhotoPreviews() {
    const wrap=document.getElementById('borrow-photo-previews'),trigger=document.getElementById('borrow-photo-trigger'),triggerLabel=document.getElementById('borrow-photo-trigger-label');if(!wrap)return;
    const placeholder='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect width="100%" height="100%" fill="#f1f5f9"/><text x="50%" y="52%" text-anchor="middle" fill="#94a3b8" font-size="14">loading...</text></svg>');
    const existingHtml=existingBorrowImageIds.map((id,idx)=>`<div class="photo-preview-item"><img src="${placeholder}" data-borrow-file-id="${escapeHtml(normalizeBorrowImageId(id))}" alt="รูปหลักฐานเดิม ${idx+1}" /><div class="photo-preview-remove" onclick="removeExistingBorrowImage(${idx})" title="เอารูปนี้ออก"><i class="fa-solid fa-xmark"></i></div></div>`).join('');
    const newHtml=borrowPhotos.map((src,idx)=>`<div class="photo-preview-item"><img src="${src}" alt="รูปหลักฐานใหม่ ${idx+1}" /><span class="absolute top-1 left-1 bg-teal-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">ใหม่</span><div class="photo-preview-remove" onclick="removeBorrowPhoto(${idx})" title="เอารูปนี้ออก"><i class="fa-solid fa-xmark"></i></div></div>`).join('');
    const totalCount=existingBorrowImageIds.length+borrowPhotos.length;if(totalCount===0){wrap.classList.add('hidden');wrap.innerHTML='';}else{wrap.classList.remove('hidden');wrap.innerHTML=existingHtml+newHtml;hydrateSecureBorrowImages(wrap);}
    if(!trigger||!triggerLabel)return;if(totalCount>=3)trigger.classList.add('hidden');else{trigger.classList.remove('hidden');triggerLabel.innerText=`ถ่ายรูปหลักฐาน (${totalCount}/3)`;}
}

// 🖼️ เปิดดูรูปภาพหลักฐานที่แนบไว้กับรายการยืมจากตารางแอดมิน
// 🖼️ ประกอบ URL รูปภาพจากค่าที่เก็บในคอลัมน์ Images ซึ่งอาจเป็น "รหัสไฟล์ Drive ล้วนๆ" (รูปแบบปัจจุบัน)
// หรือ "URL เต็ม" (รูปแบบเก่าที่เคยบันทึกไว้ก่อนหน้านี้) ให้รองรับได้ทั้งสองแบบ
function driveImageUrl(idOrUrl) { return String(idOrUrl||'').trim(); }

async function viewBorrowImages(entryId) {
    const record=state.data.find(r=>(r.EntryID||r[0])===entryId);if(!record)return;
    const imagesRaw=record.Images||record[7]||'',ids=String(imagesRaw).split(',').map(s=>s.trim()).filter(Boolean),body=document.getElementById('image-gallery-body');
    document.getElementById('modal-image-gallery').classList.add('active');
    if(!ids.length){body.innerHTML=`<div class="col-span-full empty-state"><i class="fa-solid fa-image text-3xl"></i><span>ไม่มีรูปภาพหลักฐานแนบสำหรับรายการนี้</span></div>`;return;}
    body.innerHTML='<div class="col-span-full text-center text-gray-400 py-6"><i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังโหลดรูปอย่างปลอดภัย...</div>';
    const urls=await Promise.all(ids.map(getBorrowImageDataUrl)),valid=urls.filter(Boolean);
    if(!valid.length){body.innerHTML='<div class="col-span-full empty-state text-rose-500">ไม่สามารถอ่านรูปหลักฐานได้ กรุณาตรวจสิทธิ์ไฟล์หรือ Backend v4.1.1</div>';return;}
    body.innerHTML=valid.map((url,i)=>`<div class="gallery-photo-item"><img src="${url}" data-secure-gallery-index="${i}" alt="รูปหลักฐานการยืม" /></div>`).join('');
    [...body.querySelectorAll('img[data-secure-gallery-index]')].forEach(img=>{img.onclick=()=>window.open(valid[Number(img.dataset.secureGalleryIndex)],'_blank');});
}
function closeImageGallery(){document.getElementById('modal-image-gallery').classList.remove('active');}
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
            box.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> โครงสร้างข้อมูลพร้อมใช้งาน v4.1.1';
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
        title: 'อัปเกรดโครงสร้างเป็น v4.1.1?',
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

function maintenanceDateText(value){
    if(!value)return 'ยังไม่มี';
    const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);
    return d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
}

async function loadMaintenanceStatus(){
    const box=document.getElementById('maintenance-status');if(!box)return;box.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังตรวจสอบสถานะ...';
    const r=await run('getMaintenanceStatus',{});if(!r||!r.success){box.innerHTML=`<span class="text-rose-600">${escapeHtml((r&&r.error)||'โหลดสถานะไม่สำเร็จ')}${String(r&&r.error||'').includes('ไม่พบ Action')?'<br>กรุณา Deploy Backend v4.1.1 ก่อน':''}</span>`;return;}
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('maint-count-borrow',Number(r.borrowRows||0).toLocaleString('th-TH'));set('maint-count-audit',Number(r.auditRows||0).toLocaleString('th-TH'));set('maint-count-images',Number(r.imageFiles||0).toLocaleString('th-TH'));set('maint-count-backups',Number(r.dailyBackupCount||0)+Number(r.monthlyBackupCount||0));
    const en=document.getElementById('maint-backup-enabled');if(en)en.checked=!!r.backupEnabled;const hr=document.getElementById('maint-backup-hour');if(hr)hr.value=Number.isFinite(Number(r.backupHour))?Number(r.backupHour):2;
    const p=r.policy||{},latest=r.lastBackupUrl?`<a class="text-cyan-700 underline" href="${escapeHtml(r.lastBackupUrl)}" target="_blank" rel="noopener">${escapeHtml(r.lastBackupName||'เปิดชุดสำรองล่าสุด')}</a>`:escapeHtml(r.lastBackupName||'ยังไม่มี'),root=r.backupRootUrl?`<a class="text-cyan-700 underline" href="${escapeHtml(r.backupRootUrl)}" target="_blank" rel="noopener">เปิดโฟลเดอร์ Backup แยก</a>`:'ยังไม่ได้สร้าง';
    const imgRisk=Number(r.publicImageFiles||0)>0?`<span class="text-rose-600 font-bold">ยัง Public ${Number(r.publicImageFiles).toLocaleString('th-TH')} ไฟล์</span>`:'<span class="text-emerald-700 font-bold">Private ทั้งหมด</span>';
    box.innerHTML=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5"><div><b>สำรองล่าสุด:</b> ${maintenanceDateText(r.lastBackupAt)}<br>${latest}<br>${root}</div><div><b>อัตโนมัติ:</b> ${r.backupEnabled?'เปิด':'ปิด'} ${r.backupEnabled?'ช่วง '+String(r.backupHour).padStart(2,'0')+':00 น.':''}<br><b>Trigger:</b> ${r.backupTrigger?'พร้อม':r.triggerAuthorizationRequired?'ต้องอนุญาตสิทธิ์':'ยังไม่ตั้ง'}</div><div><b>Daily:</b> ${r.dailyBackupCount||0} ชุด / เก็บ ${p.dailyRetentionDays||30} วัน<br><b>Monthly:</b> ${r.monthlyBackupCount||0} ชุด / เก็บ ${p.monthlyRetentionCount||12} ชุด</div><div><b>รูปหลักฐาน:</b> ${Number(r.imageFiles||0).toLocaleString('th-TH')} • ${imgRisk}<br><b>Archive sheets:</b> ${r.archiveSheetCount||0}<br><b>MaintenanceLog:</b> ${r.maintenanceRows||0} รายการ / ${p.maintenanceLogDays||730} วัน</div></div>${r.triggerAuthorizationRequired?'<div class="mt-2 text-amber-700">ต้องรัน <b>authorizeMaintenanceServices</b> ใน Apps Script Editor 1 ครั้งก่อนเปิด Backup อัตโนมัติ</div>':''}`;
}

async function createBackupNow(){
    const ok=await Swal.fire({title:'สำรองข้อมูลทันที?',text:'ระบบจะสร้างชุดสำรองแยก ประกอบด้วย Spreadsheet + รูปหลักฐาน + config snapshot ที่ตัด credential ออก โดยไม่แก้ข้อมูลต้นฉบับ',icon:'question',showCancelButton:true,confirmButtonText:'สำรองข้อมูล',cancelButtonText:'ยกเลิก'});if(!ok.isConfirmed)return;
    Swal.fire({title:'กำลังสำรองข้อมูล...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
    const r=await run('createSystemBackup',{});if(r&&r.success){await Swal.fire('สำรองสำเร็จ',`สร้าง ${r.fileName||'ชุดสำรอง'} เรียบร้อย • รูปหลักฐาน ${Number(r.imageCopied||0)} ไฟล์${r.imageFailed?' • คัดลอกรูปไม่สำเร็จ '+r.imageFailed+' ไฟล์':''}`,'success');await loadMaintenanceStatus();await loadMaintenanceLog();}else Swal.fire('สำรองไม่สำเร็จ',(r&&r.error)||'เกิดข้อผิดพลาด','error');
}

async function saveBackupSchedule(){
    const enabled=!!document.getElementById('maint-backup-enabled')?.checked;let hour=Number(document.getElementById('maint-backup-hour')?.value||2);hour=Math.min(23,Math.max(0,hour));
    const r=await run('setupBackupSchedule',{enabled,hour});
    if(r&&r.success){Swal.fire('บันทึกแล้ว',r.message||'อัปเดตตารางสำรองแล้ว','success');await loadMaintenanceStatus();await loadMaintenanceLog();return;}
    if(r&&r.authorizationRequired)Swal.fire('ต้องอนุญาตสิทธิ์','เปิด Apps Script → เลือก authorizeMaintenanceServices → Run → อนุญาตสิทธิ์ แล้วกลับมากดบันทึกอีกครั้ง','warning');else Swal.fire('ไม่สำเร็จ',(r&&r.error)||'ตั้งเวลาไม่สำเร็จ','error');
}

async function archiveOldAuditLogUi(){
    const q=await Swal.fire({title:'Archive Audit Log',text:'ระบบจะสำรองข้อมูลก่อน แล้วจึงย้าย Log เก่าออกจาก AuditLog หลักแบบไม่ clear ทั้งชีต',input:'number',inputValue:365,inputAttributes:{min:30,step:1},showCancelButton:true,confirmButtonText:'Archive',cancelButtonText:'ยกเลิก',inputLabel:'เก็บใน AuditLog หลักย้อนหลังอย่างน้อยกี่วัน'});if(!q.isConfirmed)return;
    const days=Math.max(30,Number(q.value||365));Swal.fire({title:'กำลัง Archive...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});const r=await run('archiveAuditLog',{retentionDays:days});
    if(r&&r.success){Swal.fire('Archive สำเร็จ',`ย้าย ${Number(r.archived||0).toLocaleString('th-TH')} รายการ เหลือใน AuditLog ${Number(r.remaining||0).toLocaleString('th-TH')} รายการ`,'success');await loadAuditLogSection();await loadMaintenanceStatus();await loadMaintenanceLog();}else Swal.fire('ไม่สำเร็จ',(r&&r.error)||'Archive ไม่สำเร็จ','error');
}

async function secureBorrowImagesUi(){
    const q=await Swal.fire({title:'ปิด Public Link ของรูปหลักฐาน?',html:'รูปที่ถูกอ้างอิงใน BorrowLog จะเปลี่ยนเป็น <b>Private</b> และหน้าเว็บจะอ่านผ่าน Session ที่ล็อกอินเท่านั้น',icon:'question',showCancelButton:true,confirmButtonText:'ดำเนินการ',cancelButtonText:'ยกเลิก',confirmButtonColor:'#0891b2'});if(!q.isConfirmed)return;
    Swal.fire({title:'กำลังปรับสิทธิ์รูปหลักฐาน...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});const r=await run('secureBorrowImages',{});if(r&&r.success){await Swal.fire('ปรับสิทธิ์แล้ว',`Private เพิ่ม ${r.secured||0} ไฟล์ • Private อยู่แล้ว ${r.alreadyPrivate||0}${r.failed?' • ไม่สำเร็จ '+r.failed:''}`,'success');borrowImageCache.clear();await loadMaintenanceStatus();await loadMaintenanceLog();}else Swal.fire('ไม่สำเร็จ',(r&&r.error)||'ไม่สามารถปรับสิทธิ์รูปได้','error');
}

async function scanOrphanFilesUi(){
    Swal.fire({title:'กำลังตรวจไฟล์รูป...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});const r=await run('scanOrphanFiles',{});if(!r||!r.success){Swal.fire('ตรวจไม่สำเร็จ',(r&&r.error)||'เกิดข้อผิดพลาด','error');return;}
    const sample=(r.candidates||[]).slice(0,10).map(x=>`<li class="text-left">${escapeHtml(x.name)}</li>`).join('');Swal.fire({title:`พบ orphan ${r.orphanCount||0} ไฟล์`,html:`<div class="text-xs text-gray-500 mb-2">ตรวจเฉพาะไฟล์ borrow_*.jpg อายุเกิน 7 วัน และไม่พบการอ้างอิงใน BorrowLog</div>${sample?'<ul class="list-disc pl-5 max-h-48 overflow-auto">'+sample+'</ul>':'<div>ไม่พบไฟล์ที่ต้องจัดการ</div>'}`,icon:r.orphanCount?'warning':'success'});await loadMaintenanceLog();
}

async function cleanupOrphanFilesUi(){
    const q=await Swal.fire({title:'ย้าย orphan files ลงถังขยะ?',html:'ระบบจะ Backup ก่อนอัตโนมัติ ตรวจซ้ำก่อนลบ และจะจัดการเฉพาะ <b>borrow_*.jpg</b> อายุเกิน 7 วันที่ไม่ถูกอ้างอิง<br><br>พิมพ์ <b>TRASH ORPHANS</b> เพื่อยืนยัน',input:'text',showCancelButton:true,confirmButtonText:'ย้ายลงถังขยะ',confirmButtonColor:'#e11d48',cancelButtonText:'ยกเลิก'});if(!q.isConfirmed)return;if(String(q.value||'').trim()!=='TRASH ORPHANS'){Swal.fire('ยังไม่ดำเนินการ','ข้อความยืนยันไม่ถูกต้อง','warning');return;}
    const r=await run('cleanupOrphanFiles',{confirmText:'TRASH ORPHANS'});if(r&&r.success){Swal.fire('ดำเนินการแล้ว',`ย้ายลงถังขยะ ${r.trashed||0} ไฟล์${r.failed?' / ไม่สำเร็จ '+r.failed+' ไฟล์':''}`,'success');await loadMaintenanceStatus();await loadMaintenanceLog();}else Swal.fire('ไม่สำเร็จ',(r&&r.error)||'Cleanup ไม่สำเร็จ','error');
}

async function cleanupArchiveLogsUi(){
    const q=await Swal.fire({title:'ล้าง Audit Archive เก่ากว่า 3 ปี?',html:'ระบบจะสร้าง Backup ก่อนอัตโนมัติ แล้วลบเฉพาะแถวที่เก่ากว่า 1,095 วันจากชีต Archive<br><br>พิมพ์ <b>DELETE ARCHIVE</b> เพื่อยืนยัน',input:'text',showCancelButton:true,confirmButtonText:'ล้างข้อมูลเก่า',confirmButtonColor:'#475569',cancelButtonText:'ยกเลิก'});if(!q.isConfirmed)return;if(String(q.value||'').trim()!=='DELETE ARCHIVE'){Swal.fire('ยังไม่ดำเนินการ','ข้อความยืนยันไม่ถูกต้อง','warning');return;}
    const r=await run('cleanupArchivedAuditLogs',{confirmText:'DELETE ARCHIVE',retentionDays:1095});if(r&&r.success){Swal.fire('Cleanup สำเร็จ',`ลบ ${r.deletedRows||0} แถวจาก Archive เก่า`,'success');await loadMaintenanceStatus();await loadMaintenanceLog();}else Swal.fire('ไม่สำเร็จ',(r&&r.error)||'Cleanup ไม่สำเร็จ','error');
}

async function loadMaintenanceLog(){
    const box=document.getElementById('maintenance-log-list');if(!box)return;box.innerHTML='กำลังโหลด...';const r=await run('getMaintenanceLog',{limit:50});if(!r||!r.success){box.textContent=(r&&r.error)||'โหลดไม่สำเร็จ';return;}
    box.innerHTML=(r.data||[]).map(x=>`<div class="border-b border-gray-100 py-2"><b>${escapeHtml(x.Action||'-')}</b> • ${escapeHtml(x.AdminName||x.AdminID||'SYSTEM')}<br><span class="text-gray-400">${maintenanceDateText(x.Timestamp)} • ${escapeHtml(x.Result||'')}</span></div>`).join('')||'ยังไม่มี Maintenance Log';
}

async function loadAuditLogSection(){const box=document.getElementById('audit-log-list');if(!box)return;box.innerHTML='กำลังโหลด...';const res=await run('getAuditLog',{limit:50});if(!res.success){box.textContent=res.error||'โหลดไม่สำเร็จ';return;}box.innerHTML=(res.data||[]).map(x=>`<div class="border-b py-2"><b>${escapeHtml(x.Action)}</b> • ${escapeHtml(x.AdminName||x.AdminID)} • ${escapeHtml(x.Module)}<br><span class="text-gray-400">${escapeHtml(x.Timestamp)} ${escapeHtml(x.RecordID||'')}</span></div>`).join('')||'ยังไม่มี Audit Log';}
async function loadLineConfigStatus() {
    const el=document.getElementById('line-config-status');
    const urlEl=document.getElementById('line-webhook-url');
    if(urlEl)urlEl.value='https://tgeezbwbrovfyjbeykrj.supabase.co/functions/v1/line-webhook-gateway';
    const hourEl=document.getElementById('line-daily-hour');
    if(hourEl && !hourEl.options.length){
        for(let h=0;h<24;h++){
            const o=document.createElement('option');
            o.value=String(h);o.textContent=String(h).padStart(2,'0')+' น.';hourEl.appendChild(o);
        }
    }
    if(!el)return;
    el.className='mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600';
    el.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังตรวจสอบสถานะ LINE OA...';
    const r=await run('getLineConfigStatus',{});
    if(!r.success){
        el.className='mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[11px] text-rose-700';
        el.textContent=r.error||'ตรวจสอบสถานะ LINE OA ไม่สำเร็จ';
        return;
    }
    const enabledEl=document.getElementById('line-enabled');
    if(enabledEl)enabledEl.checked=!!r.enabled;
    const prefs=r.eventPreferences||{};
    const map={
        'line-event-borrow':'CREATE_BORROW','line-event-return':'RETURN_BORROW','line-event-extend':'EXTEND_BORROW',
        'line-event-eq-add':'CREATE_EQUIPMENT','line-event-void':'VOID_BORROW','line-event-eq-inactive':'DEACTIVATE_EQUIPMENT','line-event-eq-status':'EQUIPMENT_STATUS'
    };
    Object.entries(map).forEach(([id,key])=>{const x=document.getElementById(id);if(x)x.checked=!!prefs[key];});
    const dailyEl=document.getElementById('line-daily-enabled');if(dailyEl)dailyEl.checked=!!r.dailyEnabled;
    if(hourEl)hourEl.value=String(Number(r.dailyHour||8));
    const minuteEl=document.getElementById('line-daily-minute');if(minuteEl)minuteEl.value=String(Number(r.dailyMinute||0));
    const targetText=!r.targetConfigured?'ยังไม่มี':(r.targetValid===false?'ไม่ถูกต้อง':`พร้อม ${escapeHtml(r.targetMasked||'')}`);
    const dailyText=r.triggerAuthorizationRequired?'ต้องอนุญาตสิทธิ์':(r.dailyTrigger?`เปิด ${escapeHtml(r.dailyTime||'08:00')}`:'ปิด');
    const eventCount=Object.values(prefs).filter(Boolean).length;
    const badge=(ok,label)=>`<span class="inline-flex items-center px-2 py-1 rounded-full border ${ok?'bg-emerald-50 text-emerald-700 border-emerald-100':'bg-amber-50 text-amber-700 border-amber-100'}">${label}</span>`;
    el.innerHTML=`<div class="flex flex-wrap gap-1.5">
        ${badge(!!r.tokenConfigured,'Token: '+(r.tokenConfigured?'พร้อม':'ยังไม่มี'))}
        ${badge(!!r.channelSecretConfigured,'Secret: '+(r.channelSecretConfigured?'พร้อม':'ยังไม่มี'))}
        ${badge(!!r.targetConfigured && r.targetValid!==false,'Target: '+targetText)}
        ${badge(!!r.webhookConfigured,'Webhook: '+(r.webhookConfigured?'พร้อม':'ยังไม่พร้อม'))}
        ${badge(!!r.enabled,'แจ้งเตือนหลัก: '+(r.enabled?'เปิด':'ปิด'))}
        ${badge(eventCount>0,'เหตุการณ์ทันที: '+eventCount+'/7')}
        ${badge(!!r.dailyTrigger,'สรุปรายวัน: '+dailyText)}
    </div>
    ${r.targetValid===false?'<div class="mt-2 text-rose-600"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Target ที่บันทึกไว้ไม่ใช่ LINE User/Group ID กรุณากรอกค่า U... หรือ C... แล้วกด “บันทึกการตั้งค่า LINE OA”</div>':''}
    ${r.triggerAuthorizationRequired?'<div class="mt-2 text-amber-700"><i class="fa-solid fa-key mr-1"></i>การส่ง LINE ใช้งานได้ แต่การตั้งเวลารายวันต้องอนุญาต Script Trigger โดยรัน authorizeLineServices ใน Apps Script 1 ครั้ง</div>':''}`;
}

function collectLineEventPreferences(){
    return {
        CREATE_BORROW:!!document.getElementById('line-event-borrow')?.checked,
        RETURN_BORROW:!!document.getElementById('line-event-return')?.checked,
        EXTEND_BORROW:!!document.getElementById('line-event-extend')?.checked,
        CREATE_EQUIPMENT:!!document.getElementById('line-event-eq-add')?.checked,
        VOID_BORROW:!!document.getElementById('line-event-void')?.checked,
        DEACTIVATE_EQUIPMENT:!!document.getElementById('line-event-eq-inactive')?.checked,
        EQUIPMENT_STATUS:!!document.getElementById('line-event-eq-status')?.checked
    };
}

async function saveLineConfigForm(){
    const token=(document.getElementById('line-token').value||'').trim();
    const targetId=(document.getElementById('line-target').value||'').trim();
    const channelSecret=(document.getElementById('line-channel-secret').value||'').trim();
    const requestedEnabled=!!document.getElementById('line-enabled').checked;
    if(targetId && !/^[UCR][0-9a-fA-F]{32}$/.test(targetId)){
        Swal.fire('Target ID ไม่ถูกต้อง','ต้องเป็น LINE User/Group/Room ID เช่น U... / C... / R... ตามด้วยรหัส 32 ตัว','warning');return;
    }
    const current=await run('getLineConfigStatus',{});
    if(!current || !current.success){Swal.fire('ตรวจสอบสถานะไม่สำเร็จ',String((current&&current.error)||'ไม่สามารถอ่านสถานะ LINE OA ได้'),'error');return;}
    const tokenReady=!!token || !!current.tokenConfigured;
    const secretReady=!!channelSecret || !!current.channelSecretConfigured;
    const targetReady=!!targetId || !!current.targetConfigured;
    if(!tokenReady || !secretReady){
        const missing=[];if(!tokenReady)missing.push('Channel access token');if(!secretReady)missing.push('Channel secret');
        Swal.fire('กรอกข้อมูลระยะแรกให้ครบ','กรุณากรอก '+missing.join(' และ ')+' แล้วกดบันทึกก่อน โดย Target ID สามารถเว้นว่างในครั้งแรกได้','warning');return;
    }
    const enabled=requestedEnabled && targetReady;
    const btn=document.getElementById('btn-line-save'),oldHtml=btn?btn.innerHTML:'';
    if(btn){btn.disabled=true;btn.style.opacity='0.7';btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';}
    try{
        const r=await run('saveLineConfig',{channelAccessToken:token,targetId,channelSecret,enabled,eventPreferences:collectLineEventPreferences()});
        if(!r.success){Swal.fire('บันทึกไม่สำเร็จ',r.error||'ไม่สามารถบันทึกการตั้งค่า LINE OA ได้','error');return;}
        document.getElementById('line-token').value='';document.getElementById('line-channel-secret').value='';document.getElementById('line-target').value='';
        await loadLineConfigStatus();
        if(!targetReady){
            await Swal.fire({title:'บันทึก Token + Secret แล้ว',html:'<div class="text-left text-sm leading-7">ขั้นต่อไป: Verify Webhook → เปิด Use webhook → ส่งคำว่า <b>ไอดี</b> หา LINE OA → นำ U.../C... มาใส่ Target แล้วเปิดการแจ้งเตือน</div>',icon:'success'});
        }else{
            await Swal.fire('บันทึกการตั้งค่าแล้ว',enabled?'บันทึกการเชื่อมต่อและประเภทเหตุการณ์แจ้งเตือนแล้ว':'บันทึกค่าแล้ว แต่การแจ้งเตือนหลักยังปิดอยู่','success');
        }
    }finally{if(btn){btn.disabled=false;btn.style.opacity='1';btn.innerHTML=oldHtml||'<i class="fa-solid fa-floppy-disk"></i> บันทึกการตั้งค่า LINE OA';}}
}

async function copyLineWebhookUrl(){
    const el=document.getElementById('line-webhook-url');if(!el)return;
    try{await navigator.clipboard.writeText(el.value);Swal.fire('คัดลอก Webhook URL แล้ว','','success');}
    catch(e){el.select();document.execCommand('copy');Swal.fire('คัดลอก Webhook URL แล้ว','','success');}
}

async function testLineNotification(){
    let r=await run('testLineNotification',{});const err=String((r&&r.error)||'');
    if(!r.success && (r.authorizationRequired || /UrlFetchApp\.fetch|script\.external_request|permission to call UrlFetchApp|authorization is required/i.test(err))){
        await Swal.fire({title:'ต้องอนุญาตสิทธิ์ LINE API ก่อน',html:'<div class="text-left text-sm leading-7">เปิด <b>Apps Script Editor</b> → เลือก <b>authorizeLineServices</b> → Run → อนุญาตสิทธิ์ แล้วกลับมาทดสอบส่งอีกครั้ง</div>',icon:'warning'});return;
    }
    if(!r.success && err.includes('LINE notification ยังปิดอยู่')){
        const ask=await Swal.fire({title:'LINE OA ยังปิดการแจ้งเตือน',text:'ต้องการเปิดการแจ้งเตือนและบันทึกสถานะตอนนี้หรือไม่?',icon:'question',showCancelButton:true,confirmButtonText:'เปิดและบันทึก',cancelButtonText:'ยังไม่เปิด',confirmButtonColor:'#059669'});
        if(!ask.isConfirmed)return;
        const enabledBox=document.getElementById('line-enabled');if(enabledBox)enabledBox.checked=true;
        const save=await run('saveLineConfig',{channelAccessToken:'',targetId:'',channelSecret:'',enabled:true,eventPreferences:collectLineEventPreferences()});
        if(!save.success){Swal.fire('เปิดการแจ้งเตือนไม่สำเร็จ',save.error||'ไม่สามารถบันทึกสถานะ LINE OA ได้','error');return;}
        r=await run('testLineNotification',{});
    }
    Swal.fire(r.success?'ส่งทดสอบสำเร็จ':'ส่งไม่สำเร็จ',String((r&&r.error)||'')||'ตรวจสอบ LINE OA ได้แล้ว',r.success?'success':'error');
}

async function setupLineDailyTrigger(){
    const enabled=!!document.getElementById('line-daily-enabled')?.checked;
    const hour=Number(document.getElementById('line-daily-hour')?.value||8);
    const minute=Number(document.getElementById('line-daily-minute')?.value||0);
    const btn=document.getElementById('btn-line-daily-save'),old=btn?btn.innerHTML:'';
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังบันทึก...';}
    try{
        const r=await run('setupLineDailyTrigger',{enabled,hour,minute});
        if(r.success){await Swal.fire(enabled?'ตั้งเวลาแล้ว':'ปิดสรุปรายวันแล้ว',r.message||'บันทึกตารางเวลาเรียบร้อย','success');await loadLineConfigStatus();return;}
        if(r.authorizationRequired){await Swal.fire({title:'ต้องอนุญาตสิทธิ์ Trigger 1 ครั้ง',html:'<div class="text-left text-xs leading-6">เปิด <b>Apps Script</b> → เลือก <code>authorizeLineServices</code> → Run → อนุญาตสิทธิ์ แล้วกลับมากด <b>บันทึกตารางเวลา</b> อีกครั้ง</div>',icon:'info'});}
        else Swal.fire('ตั้งเวลาไม่สำเร็จ',r.error||'เกิดข้อผิดพลาด','error');
    }finally{if(btn){btn.disabled=false;btn.innerHTML=old||'<i class="fa-solid fa-clock mr-1"></i> บันทึกตารางเวลา';}}
    await loadLineConfigStatus();
}

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
      return `<div class="flex items-center justify-between bg-gray-50 border rounded-xl px-3 py-2.5"><div><p class="font-bold">${escapeHtml(u.adminName)} <span class="text-[10px] text-indigo-600">${escapeHtml(u.role||'STAFF')}</span></p><p class="text-[11px] text-gray-400">${escapeHtml(u.adminId)} • ${status}</p></div><button ${isMe?'disabled':''} onclick="setAdminUserActivePrompt('${escapeJsSingleQuoted(u.adminId)}',${u.active===false?'true':'false'})" class="px-3 py-1.5 rounded-lg text-xs font-bold ${u.active===false?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}">${u.active===false?'เปิดใช้':'ปิดใช้'}</button></div>`;
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


// ================================================================
// LINE Rich Menu Manager v4.2.0 — ADMIN only
// ================================================================
let lineRichMenuImageBase64 = '';
let lineRichMenuImageMeta = null;
let lineRichMenuStatusCache = null;

function lineRichMenuDefaults(layout){
    const base='https://kelang-health.github.io/med-device-sharing/';
    if(String(layout)==='6') return [
        {label:'ยืมอุปกรณ์',type:'uri',value:base},
        {label:'คืนอุปกรณ์',type:'message',value:'คืนอุปกรณ์'},
        {label:'ตรวจสถานะ',type:'message',value:'สถานะ'},
        {label:'คู่มือใช้งาน',type:'message',value:'ช่วยเหลือ'},
        {label:'แจ้งปัญหา',type:'message',value:'แจ้งปัญหา'},
        {label:'ติดต่อเจ้าหน้าที่',type:'message',value:'ติดต่อเจ้าหน้าที่'}
    ];
    return [
        {label:'ตรวจสถานะ',type:'message',value:'สถานะ'},
        {label:'ยืมอุปกรณ์',type:'uri',value:base},
        {label:'คืนอุปกรณ์',type:'message',value:'คืนอุปกรณ์'},
        {label:'แจ้งปัญหา',type:'message',value:'แจ้งปัญหา'},
        {label:'เปิดระบบ',type:'uri',value:base},
        {label:'คู่มือ / วิธีใช้',type:'message',value:'ช่วยเหลือ'},
        {label:'ติดต่อเจ้าหน้าที่',type:'message',value:'ติดต่อเจ้าหน้าที่'},
        {label:'เมนูบริการ',type:'message',value:'เมนู'}
    ];
}

function renderLineRichMenuActionEditor(){
    const host=document.getElementById('line-rm-actions'); if(!host)return;
    const layout=document.getElementById('line-rm-layout')?.value||'8';
    const defaults=lineRichMenuDefaults(layout);
    host.innerHTML=defaults.map((x,i)=>`
        <div class="line-rm-action-row grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-2" data-index="${i}">
            <div class="sm:col-span-1 flex items-center justify-center"><span class="line-rm-index">${i+1}</span></div>
            <div class="sm:col-span-3"><label class="text-[9px] text-gray-400">ชื่อช่อง</label><input class="line-rm-label w-full border border-gray-200 bg-white px-2 py-2 rounded-lg text-xs" maxlength="20" value="${escapeHtml(x.label)}"></div>
            <div class="sm:col-span-3"><label class="text-[9px] text-gray-400">Action</label><select class="line-rm-type w-full border border-gray-200 bg-white px-2 py-2 rounded-lg text-xs" onchange="updateLineRichMenuActionHint(this)"><option value="message" ${x.type==='message'?'selected':''}>Message</option><option value="uri" ${x.type==='uri'?'selected':''}>Link / URL</option><option value="postback" ${x.type==='postback'?'selected':''}>Postback</option></select></div>
            <div class="sm:col-span-5"><label class="line-rm-value-label text-[9px] text-gray-400">${x.type==='uri'?'URL':'ข้อความ / ค่า'}</label><input class="line-rm-value w-full border border-gray-200 bg-white px-2 py-2 rounded-lg text-xs" value="${escapeHtml(x.value)}"></div>
        </div>`).join('');
}

function updateLineRichMenuActionHint(sel){
    const row=sel.closest('.line-rm-action-row'); if(!row)return;
    const lab=row.querySelector('.line-rm-value-label');
    if(lab) lab.textContent=sel.value==='uri'?'URL (https://...)':sel.value==='postback'?'Postback data':'ข้อความที่จะส่งเข้า LINE OA';
}

async function handleLineRichMenuImage(event){
    lineRichMenuImageBase64=''; lineRichMenuImageMeta=null;
    const file=event.target.files&&event.target.files[0], info=document.getElementById('line-rm-image-info'), preview=document.getElementById('line-rm-preview');
    if(!file){ if(info)info.textContent='ยังไม่ได้เลือกรูป'; if(preview)preview.classList.add('hidden'); return; }
    if(!['image/png','image/jpeg'].includes(file.type)){ Swal.fire('ชนิดไฟล์ไม่ถูกต้อง','ใช้ PNG หรือ JPEG เท่านั้น','warning'); event.target.value=''; return; }
    if(file.size>1024*1024){ Swal.fire('ไฟล์ใหญ่เกินไป','LINE กำหนด Rich Menu image ไม่เกิน 1 MB','warning'); event.target.value=''; return; }
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
    const size=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=reject;img.src=data;});
    lineRichMenuImageBase64=String(data); lineRichMenuImageMeta={name:file.name,size:file.size,type:file.type,width:size.width,height:size.height};
    const exact=size.width===2500&&size.height===1686;
    if(info){info.innerHTML=`${escapeHtml(file.name)} • ${(file.size/1024).toFixed(0)} KB • ${size.width}×${size.height}px ${exact?'<span class="text-emerald-600 font-bold">✓ ขนาดแนะนำ</span>':'<span class="text-amber-600 font-bold">⚠ ควรปรับเป็น 2500×1686</span>'}`;}
    if(preview){preview.src=data;preview.classList.remove('hidden');}
}

function collectLineRichMenuActions(){
    return Array.from(document.querySelectorAll('#line-rm-actions .line-rm-action-row')).map(row=>({
        label:row.querySelector('.line-rm-label')?.value.trim()||'',
        type:row.querySelector('.line-rm-type')?.value||'message',
        value:row.querySelector('.line-rm-value')?.value.trim()||''
    }));
}

async function loadLineRichMenuStatus(){
    const box=document.getElementById('line-rm-status')||document.getElementById('line-richmenu-status'), list=document.getElementById('line-rm-list');
    if(state.role!=='ADMIN'||!box)return;
    box.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังอ่าน Rich Menu จาก LINE...';
    const r=await run('getLineRichMenuStatus',{});
    if(!r||!r.success){
        const msg=String(r?.error||'อ่านสถานะไม่ได้');
        box.innerHTML=`<span class="text-rose-600 font-bold">ไม่พร้อม:</span> ${escapeHtml(msg)}${msg.includes('ไม่พบ Action')?'<br><span class="text-amber-700">กรุณา Deploy Backend v4.2.0 ก่อน</span>':''}`;
        if(list)list.innerHTML='<div class="text-gray-400">ยังอ่านรายการไม่ได้</div>'; return;
    }
    lineRichMenuStatusCache=r;
    if(!r.configured){box.innerHTML='<span class="text-amber-700 font-bold">ยังไม่ได้ตั้ง Channel access token</span> — บันทึกการตั้งค่า LINE OA ก่อนสร้าง Rich Menu';if(list)list.innerHTML='<div class="text-gray-400">ไม่มีข้อมูล</div>';return;}
    const count=(r.menus||[]).length, def=r.defaultRichMenuId||'';
    box.innerHTML=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-1"><div><b>Rich Menu:</b> ${count} รายการ</div><div><b>Default:</b> ${def?'<span class="text-emerald-700">'+escapeHtml(def)+'</span>':'ยังไม่ได้ตั้ง'}</div></div>`;
    renderLineRichMenuList(r);
}

function renderLineRichMenuList(r){
    const list=document.getElementById('line-rm-list'); if(!list)return;
    const menus=r?.menus||[];
    if(!menus.length){list.innerHTML='<div class="rounded-xl border border-dashed border-gray-200 p-4 text-center text-gray-400">ยังไม่มี Rich Menu ที่สร้างผ่าน Messaging API</div>';return;}
    list.innerHTML=menus.map(m=>`<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border ${m.isDefault?'border-emerald-200 bg-emerald-50/40':'border-gray-100 bg-gray-50/50'} p-3"><div class="min-w-0"><div class="font-bold text-gray-700 truncate">${escapeHtml(m.name||'-')} ${m.isDefault?'<span class="ml-1 text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">DEFAULT</span>':''}</div><div class="text-[9px] text-gray-400 font-mono break-all">${escapeHtml(m.richMenuId||'')}</div><div class="text-[9px] text-gray-400">${Number(m.areaCount||0)} ช่อง • แถบ: ${escapeHtml(m.chatBarText||'-')}</div></div><div class="flex gap-1 flex-shrink-0">${m.isDefault?'':`<button type="button" onclick="setDefaultLineRichMenuUi('${escapeJsSingleQuoted(m.richMenuId)}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-2 rounded-lg font-bold">ตั้ง Default</button>`}<button type="button" onclick="deleteLineRichMenuUi('${escapeJsSingleQuoted(m.richMenuId)}','${escapeJsSingleQuoted(m.name||'Rich Menu')}')" class="bg-rose-50 hover:bg-rose-100 text-rose-700 px-2.5 py-2 rounded-lg font-bold"><i class="fa-solid fa-trash-can"></i></button></div></div>`).join('');
}

async function createLineRichMenuFromUi(){
    if(state.role!=='ADMIN')return;
    const layout=document.getElementById('line-rm-layout')?.value||'8', actions=collectLineRichMenuActions();
    if(!lineRichMenuImageBase64){Swal.fire('ยังไม่มีภาพ Rich Menu','กรุณาเลือก PNG/JPEG ก่อนสร้าง','warning');return;}
    if(!lineRichMenuImageMeta||lineRichMenuImageMeta.width!==2500||lineRichMenuImageMeta.height!==1686){
        const q=await Swal.fire({title:'ขนาดภาพไม่ใช่ 2500 × 1686',text:'พื้นที่กดอาจไม่ตรงกับภาพ ต้องการสร้างต่อหรือไม่?',icon:'warning',showCancelButton:true,confirmButtonText:'สร้างต่อ',cancelButtonText:'ยกเลิก'});if(!q.isConfirmed)return;
    }
    if(actions.some(x=>!x.label||!x.value)){Swal.fire('ข้อมูล Action ไม่ครบ','กรุณากรอกชื่อและค่าให้ครบทุกช่อง','warning');return;}
    const ok=await Swal.fire({title:'Publish Rich Menu?',html:`สร้าง Rich Menu <b>${actions.length} ช่อง</b> และอัปโหลดภาพไปยัง LINE OA${document.getElementById('line-rm-set-default')?.checked?'<br>จากนั้นตั้งเป็น <b>Default</b>':''}`,icon:'question',showCancelButton:true,confirmButtonText:'สร้างและ Publish',cancelButtonText:'ยกเลิก'});
    if(!ok.isConfirmed)return;
    Swal.fire({title:'กำลังสร้าง Rich Menu...',html:'ตรวจ Action → สร้างเมนู → อัปโหลดภาพ → ตั้ง Default',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
    const r=await run('createLineRichMenu',{layout,name:document.getElementById('line-rm-name')?.value||'',chatBarText:document.getElementById('line-rm-chatbar')?.value||'เมนูยืม-คืน',selected:!!document.getElementById('line-rm-selected')?.checked,setDefault:!!document.getElementById('line-rm-set-default')?.checked,actions,imageBase64:lineRichMenuImageBase64});
    if(r?.success){Swal.fire('สร้าง Rich Menu สำเร็จ',`Rich Menu ID: ${escapeHtml(r.createdRichMenuId||'')}`,'success');lineRichMenuStatusCache=r;renderLineRichMenuList(r);await loadLineRichMenuStatus();}
    else Swal.fire('สร้างไม่สำเร็จ',r?.error||'LINE API error','error');
}

async function setDefaultLineRichMenuUi(id){
    const q=await Swal.fire({title:'ตั้งเป็น Default?',text:id,icon:'question',showCancelButton:true,confirmButtonText:'ตั้ง Default'});if(!q.isConfirmed)return;
    const r=await run('setDefaultLineRichMenu',{richMenuId:id});if(r?.success){Swal.fire('เรียบร้อย','ตั้ง Default Rich Menu แล้ว','success');lineRichMenuStatusCache=r;renderLineRichMenuList(r);await loadLineRichMenuStatus();}else Swal.fire('ไม่สำเร็จ',r?.error||'LINE API error','error');
}

async function clearDefaultLineRichMenuUi(){
    const q=await Swal.fire({title:'ยกเลิก Default Rich Menu?',text:'ผู้ใช้ที่ไม่มี Per-user Rich Menu จะไม่เห็น Default จาก Messaging API',icon:'warning',showCancelButton:true,confirmButtonText:'ยกเลิก Default',confirmButtonColor:'#dc2626'});if(!q.isConfirmed)return;
    const r=await run('clearDefaultLineRichMenu',{});if(r?.success){Swal.fire('เรียบร้อย','ยกเลิก Default แล้ว','success');await loadLineRichMenuStatus();}else Swal.fire('ไม่สำเร็จ',r?.error||'LINE API error','error');
}

async function deleteLineRichMenuUi(id,name){
    const q=await Swal.fire({title:'ลบ Rich Menu?',html:`<b>${escapeHtml(name)}</b><br><span class="text-xs">${escapeHtml(id)}</span><br><br>การลบจาก LINE ย้อนกลับไม่ได้`,icon:'warning',showCancelButton:true,confirmButtonText:'ลบ Rich Menu',cancelButtonText:'ยกเลิก',confirmButtonColor:'#dc2626'});if(!q.isConfirmed)return;
    const r=await run('deleteLineRichMenu',{richMenuId:id});if(r?.success){Swal.fire('ลบแล้ว','Rich Menu ถูกลบจาก LINE OA','success');await loadLineRichMenuStatus();}else Swal.fire('ลบไม่สำเร็จ',r?.error||'LINE API error','error');
}

// สร้าง editor ค่าเริ่มต้นทันทีหลัง DOM พร้อม
document.addEventListener('DOMContentLoaded',()=>setTimeout(renderLineRichMenuActionEditor,0));
