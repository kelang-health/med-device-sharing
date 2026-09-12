from pathlib import Path
import re

p = Path('script.js')
s = p.read_text(encoding='utf-8')
original = s


def sub_once(pattern, repl, text, flags=0, label='pattern'):
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'Expected exactly 1 match for {label}, found {n}')
    return out

s = s.replace('Frontend Controller API (v2.2)', 'Frontend Controller API (v2.3 Security Hotfix)', 1)

# Session storage helpers (namespaced + migrate old keys)
helper = r'''
const STORAGE_KEYS = {
    token: 'medDevice.adminToken',
    adminId: 'medDevice.adminId',
    adminName: 'medDevice.adminName',
    theme: 'medDevice.themeMode'
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
}
'''
s = sub_once(r'(const API_URL\s*=\s*[^\n]+;\s*\n)', r'\1\n' + helper + '\n', s, label='API_URL insert')

s = s.replace("    if (localStorage.getItem('adminToken')) {\n        payload.token = localStorage.getItem('adminToken');\n    }", "    const sessionToken = getSessionToken();\n    if (sessionToken) payload.token = sessionToken;", 1)

s = s.replace("                localStorage.removeItem('adminToken');\n                localStorage.removeItem('adminId');\n                localStorage.removeItem('adminName');", "                clearAuthSession();", 1)

old_dom = """document.addEventListener('DOMContentLoaded', async () => {\n    initThemeMode();\n    checkAuthSession();\n    await loadSystemData();\n    document.getElementById('borrow-date').valueAsDate = new Date();\n});"""
new_dom = """document.addEventListener('DOMContentLoaded', async () => {\n    migrateLegacyStorage();\n    initThemeMode();\n    await checkAuthSession();\n    await loadSystemData();\n    const borrowDate = document.getElementById('borrow-date');\n    if (borrowDate) borrowDate.valueAsDate = new Date();\n});"""
if old_dom not in s:
    raise SystemExit('DOMContentLoaded block not found')
s = s.replace(old_dom, new_dom, 1)

s = s.replace("const saved = localStorage.getItem('themeMode');", "const saved = localStorage.getItem(STORAGE_KEYS.theme);", 1)
s = s.replace("localStorage.setItem('themeMode', mode);", "localStorage.setItem(STORAGE_KEYS.theme, mode);", 1)

new_auth_load = r'''function applyAdminSessionUi() {
    const sidebar = document.getElementById('sidebar');
    const wrapper = document.getElementById('main-wrapper');
    if (sidebar) sidebar.classList.remove('hidden');
    if (wrapper) wrapper.classList.add('md:pl-64');

    const brand = document.getElementById('public-header-brand');
    const loginBtn = document.getElementById('btn-login-trigger');
    const info = document.getElementById('logged-admin-info');
    const displayName = document.getElementById('display-admin-name');
    const pdpaBadge = document.getElementById('pdpa-badge');
    const borrowLog = document.getElementById('borrow-log-section');
    if (brand) brand.classList.add('md:hidden');
    if (loginBtn) loginBtn.classList.add('hidden');
    if (info) info.classList.remove('hidden');
    if (displayName) displayName.innerText = 'เจ้าหน้าที่: ' + (state.adminName || '-');
    if (pdpaBadge) pdpaBadge.classList.remove('hidden');
    if (borrowLog) borrowLog.classList.remove('hidden');
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
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
        // Public โหลดเฉพาะข้อมูลที่ไม่มี PII: Publics + Equipments
        const [resPub, resEq] = await Promise.all([
            run('getData', { sheetName: 'Publics' }),
            run('getData', { sheetName: 'Equipments' })
        ]);

        state.publics = resPub.success ? (resPub.data || []) : [];
        state.equipments = resEq.success ? (resEq.data || []) : [];
        state.data = [];

        if (state.isAdmin) {
            const resLog = await run('getData', { sheetName: 'BorrowLog' });
            if (resLog.success) state.data = resLog.data || [];
        } else {
            // Public ใช้เฉพาะสถานะอุปกรณ์เพื่อคำนวณสถิติ ไม่โหลดชื่อ/CID/โทร/GPS/รูป
            state.data = state.equipments
                .filter(eq => ['Borrowed', 'ยืม'].includes(String(eq.Status || eq[3] || '').trim()))
                .map(eq => ({
                    EquipmentID: eq.EquipmentID || eq[0] || '',
                    Status: 'Borrowed'
                }));
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

function applySystemConfiguration'''
s = sub_once(
    r'function checkAuthSession\(\) \{.*?\n\}\n\nasync function loadSystemData\(\) \{.*?\n\}\n\nfunction applySystemConfiguration',
    new_auth_load,
    s,
    flags=re.S,
    label='auth + loadSystemData blocks'
)

# Login/logout use namespaced storage and backend logout when available
new_login_logout = r'''async function submitLogin(event) {
    event.preventDefault();
    Swal.fire({ title: 'กำลังพิสูจน์สิทธิ์...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    const uid = document.getElementById('login-uid').value;
    const pwd = document.getElementById('login-pwd').value;

    const res = await run('login', { adminId: uid, password: pwd });
    if (res.success) {
        setSessionValue('token', res.token);
        setSessionValue('adminId', res.adminId);
        setSessionValue('adminName', res.adminName);
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
function openLoginModal'''
s = sub_once(
    r'async function submitLogin\(event\) \{.*?\n\}\n\nfunction logout\(\) \{.*?\}\nfunction openLoginModal',
    new_login_logout,
    s,
    flags=re.S,
    label='submitLogin + logout'
)

s = s.replace("const myAdminId = localStorage.getItem('adminId') || '';", "const myAdminId = getSessionValue('adminId') || '';", 1)

if s == original:
    raise SystemExit('No changes produced')

# Safety checks
required = [
    'medDevice.adminToken',
    "run('validateSession'",
    "sheetName: 'BorrowLog'",
    "filter(eq => ['Borrowed', 'ยืม']",
    'async function logout()'
]
for marker in required:
    if marker not in s:
        raise SystemExit(f'Missing required marker: {marker}')

p.write_text(s, encoding='utf-8')
print('Patched script.js successfully')
