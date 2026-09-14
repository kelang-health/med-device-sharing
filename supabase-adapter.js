/*
 * med-device-sharing Supabase adapter (staging)
 * Not wired into production UI yet.
 * Uses only the publishable key; all data access remains protected by Supabase Auth + RLS.
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://txjuiaiwffsxfcrxpkvd.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fXbWt4Wdn6sjxdACf5ZYfQ_kfQcdKGk';
  const SESSION_KEY = 'medDevice.supabaseSession';

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function setSession(session) {
    if (!session) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async function api(path, options = {}, requireAuth = false) {
    const headers = new Headers(options.headers || {});
    headers.set('apikey', SUPABASE_PUBLISHABLE_KEY);
    if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');

    const session = getSession();
    if (requireAuth) {
      if (!session?.access_token) throw new Error('AUTH_REQUIRED');
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }

    const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!res.ok) {
      const err = new Error((data && (data.message || data.error_description || data.error)) || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function signIn(email, password) {
    const data = await api('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setSession(data);
    const profile = await getMyProfile();
    if (!profile?.active || !['ADMIN', 'STAFF'].includes(profile.role)) {
      await signOut().catch(() => {});
      throw new Error('ACCOUNT_NOT_ACTIVE');
    }
    return { session: data, profile };
  }

  async function refreshSession() {
    const current = getSession();
    if (!current?.refresh_token) throw new Error('NO_REFRESH_TOKEN');
    const data = await api('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: current.refresh_token })
    });
    setSession(data);
    return data;
  }

  async function signOut() {
    const current = getSession();
    try {
      if (current?.access_token) {
        await api('/auth/v1/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${current.access_token}` }
        });
      }
    } finally {
      setSession(null);
    }
  }

  async function getMyProfile() {
    const current = getSession();
    if (!current?.user?.id) throw new Error('AUTH_REQUIRED');
    const rows = await api(`/rest/v1/profiles?id=eq.${encodeURIComponent(current.user.id)}&select=id,admin_id,display_name,role,active`, {}, true);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  function getPublicDashboard() {
    return api('/rest/v1/rpc/get_public_dashboard', { method: 'POST', body: '{}' }, false);
  }

  function listEquipments() {
    return api('/rest/v1/equipments?select=id,equipment_id,equipment_name,serial_number,status,active,condition_note&order=equipment_id.asc', {}, true);
  }

  function listBorrowLogs(limit = 200) {
    const n = Math.max(1, Math.min(500, Number(limit) || 200));
    return api(`/rest/v1/borrow_logs?select=id,entry_id,borrower_name_snapshot,community_snapshot,phone_snapshot,patient_name_snapshot,equipment_id,equipment_code_snapshot,serial_number_snapshot,status,borrow_date,return_date,due_date,extension_count,record_status,return_condition,return_condition_note&order=borrow_date.desc.nullslast&limit=${n}`, {}, true);
  }

  function listBorrowers(limit = 200) {
    const n = Math.max(1, Math.min(500, Number(limit) || 200));
    return api(`/rest/v1/borrowers?select=id,full_name,citizen_id_last4,citizen_id_present,address,community,phone,patient_name,relationship,gps_lat,gps_lng&order=full_name.asc&limit=${n}`, {}, true);
  }

  function listEvidence(borrowLogId) {
    return api(`/rest/v1/borrow_evidence?borrow_log_id=eq.${encodeURIComponent(borrowLogId)}&select=id,borrow_log_id,storage_bucket,storage_path,original_filename,mime_type,file_size,sha256,migrated_from_legacy,created_at&order=id.asc`, {}, true);
  }

  async function createSignedEvidenceUrl(storagePath, expiresIn = 600) {
    const seconds = Math.max(60, Math.min(3600, Number(expiresIn) || 600));
    const encoded = String(storagePath || '').split('/').map(encodeURIComponent).join('/');
    const data = await api(`/storage/v1/object/sign/borrow-evidence/${encoded}`, {
      method: 'POST',
      body: JSON.stringify({ expiresIn: seconds })
    }, true);
    const signed = data?.signedURL || data?.signedUrl || data?.signed_url;
    if (!signed) throw new Error('SIGNED_URL_NOT_RETURNED');
    return signed.startsWith('http') ? signed : `${SUPABASE_URL}/storage/v1${signed}`;
  }

  window.MedDeviceSupabase = Object.freeze({
    SUPABASE_URL,
    getSession,
    signIn,
    refreshSession,
    signOut,
    getMyProfile,
    getPublicDashboard,
    listEquipments,
    listBorrowLogs,
    listBorrowers,
    listEvidence,
    createSignedEvidenceUrl
  });
})();
