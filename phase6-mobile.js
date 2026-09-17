/* Phase 6.0.1 — Smartphone QR/Barcode scan + public equipment landing */
(function(){
  const API='https://txjuiaiwffsxfcrxpkvd.supabase.co/functions/v1/med-device-api-v60';
  const TOKEN_KEY='medDevice.adminToken';
  let scanner=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function normalizeCode(v){
    const raw=String(v||'').trim();
    try{
      const u=new URL(raw,location.href);
      const q=u.searchParams.get('equipment')||u.searchParams.get('code');
      if(q)return normalizeCode(q);
    }catch{}
    const m=raw.toUpperCase().replace(/\s+/g,'').match(/EQ-?0*(\d+)/);
    return m?'EQ-'+String(Number(m[1])):'';
  }
  function stateLabel(s){return ({BASELINE_REQUIRED:'ต้องบันทึก PM เริ่มต้น',OVERDUE:'เกินกำหนด PM',DUE_SOON:'ใกล้ครบกำหนด',DUE_USAGE:'ถึงรอบตามจำนวนใช้งาน',OK:'ปกติ',NO_PLAN:'ยังไม่มีแผน PM'})[s]||s||'-';}
  function statusLabel(s){return ({Available:'พร้อมยืม',Borrowed:'กำลังยืม',Cleaning:'รอทำความสะอาด',Inspection:'รอตรวจสอบ',Maintenance:'กำลังบำรุง/ซ่อม',Damaged:'ชำรุด',Lost:'สูญหาย',Retired:'ปลดระวาง'})[s]||s||'-';}
  function thDate(v){if(!v)return '-';const d=new Date(String(v).length<=10?v+'T12:00:00':v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});}
  async function publicProfile(code){
    const r=await fetch(API+'?action=getPublicEquipmentProfile&equipmentCode='+encodeURIComponent(code));
    return await r.json();
  }
  async function showEquipment(code){
    code=normalizeCode(code);
    if(!code){if(window.Swal)Swal.fire('ไม่พบรหัสอุปกรณ์','กรุณาสแกน QR/Barcode หรือกรอกรหัส เช่น EQ-28','warning');return;}
    if(localStorage.getItem(TOKEN_KEY) && typeof window.openEquipmentHistory==='function'){
      return window.openEquipmentHistory(code);
    }
    const r=await publicProfile(code);
    if(!r?.success){if(window.Swal)Swal.fire('ไม่พบอุปกรณ์',r?.error||code,'error');return;}
    const p=r.data;
    if(window.Swal)Swal.fire({
      title:`${esc(p.equipmentName)} · ${esc(p.equipmentCode)}`,
      width:620,
      html:`<div style="text-align:left;line-height:1.8;font-size:14px">
        <div><b>สถานะ:</b> ${esc(statusLabel(p.status))}</div>
        ${p.serialNumber?`<div><b>Serial/เลขพัสดุ:</b> ${esc(p.serialNumber)}</div>`:''}
        <div><b>สถานะบำรุง:</b> ${esc(stateLabel(p.maintenanceState))}</div>
        <div><b>PM ล่าสุด:</b> ${esc(thDate(p.lastMaintenanceDate))}</div>
        <div><b>PM ถัดไป:</b> ${esc(thDate(p.nextMaintenanceDate))}</div>
        <div style="margin-top:10px;padding:10px;background:#f8fafc;border-radius:10px;color:#64748b;font-size:12px">หน้าสาธารณะไม่แสดงชื่อผู้ยืม ที่อยู่ เบอร์โทร หรือข้อมูลผู้ป่วย</div>
      </div>`,
      confirmButtonText:'ปิด'
    });
  }
  function loadQrLib(){
    if(window.Html5Qrcode)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      s.onload=resolve;s.onerror=()=>reject(new Error('โหลดตัวสแกนไม่สำเร็จ'));
      document.head.appendChild(s);
    });
  }
  async function stopScanner(){
    if(scanner){try{await scanner.stop();}catch{}try{await scanner.clear();}catch{}scanner=null;}
  }
  async function openPhase6Scanner(){
    const ans=await Swal.fire({
      title:'สแกน QR / Barcode อุปกรณ์',
      width:680,
      html:`<div id="p6-camera-reader" style="width:100%;min-height:260px;border-radius:14px;overflow:hidden;background:#0f172a"></div>
        <div style="margin-top:12px;text-align:left">
          <label style="font-size:12px;font-weight:700;color:#64748b">หรือกรอกรหัสอุปกรณ์</label>
          <input id="p6-manual-code" inputmode="text" autocomplete="off" placeholder="เช่น EQ-28" style="width:100%;margin-top:6px;padding:12px;border:1px solid #dbe1e8;border-radius:12px;font-size:16px;text-transform:uppercase">
          <div style="font-size:11px;color:#94a3b8;margin-top:6px">อนุญาตใช้กล้องหลังเมื่อระบบถามสิทธิ์กล้อง</div>
        </div>`,
      showCancelButton:true,
      confirmButtonText:'เปิดรหัสนี้',
      cancelButtonText:'ยกเลิก',
      didOpen:async()=>{
        try{
          await loadQrLib();
          scanner=new Html5Qrcode('p6-camera-reader');
          const onDecoded=async text=>{const code=normalizeCode(text);if(!code)return;await stopScanner();Swal.close();setTimeout(()=>showEquipment(code),120);};
          try{
            await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:160},aspectRatio:1.333},onDecoded,()=>{});
          }catch{
            const cams=await Html5Qrcode.getCameras();
            if(cams?.length)await scanner.start(cams[cams.length-1].id,{fps:10,qrbox:{width:240,height:160}},onDecoded,()=>{});
          }
        }catch(e){
          const host=document.getElementById('p6-camera-reader');
          if(host)host.innerHTML='<div style="padding:30px;color:white;text-align:center">เปิดกล้องไม่ได้ กรุณากรอกรหัสอุปกรณ์ด้านล่าง</div>';
        }
      },
      willClose:()=>{stopScanner();},
      preConfirm:()=>{
        const code=normalizeCode(document.getElementById('p6-manual-code')?.value||'');
        if(!code){Swal.showValidationMessage('กรุณาระบุรหัส เช่น EQ-28');return false;}
        return code;
      }
    });
    if(ans.isConfirmed&&ans.value)showEquipment(ans.value);
  }
  window.openPhase6Scanner=openPhase6Scanner;
  window.showPhase6Equipment=showEquipment;

  function injectUi(){
    const sec=document.getElementById('sec-lifecycle');
    if(sec&&!document.getElementById('p6-scan-toolbar')){
      const bar=document.createElement('div');bar.id='p6-scan-toolbar';bar.className='print:hidden';
      bar.style.cssText='display:flex;justify-content:flex-end;margin-top:-8px;margin-bottom:8px';
      bar.innerHTML='<button type="button" onclick="openPhase6Scanner()" style="min-height:44px;padding:10px 14px;border:0;border-radius:12px;background:#0f766e;color:white;font-weight:700;box-shadow:0 5px 14px rgba(15,118,110,.18)"><i class="fa-solid fa-qrcode" style="margin-right:6px"></i>สแกน QR / Barcode</button>';
      sec.prepend(bar);
    }
    if(localStorage.getItem(TOKEN_KEY)&&!document.getElementById('p6-scan-fab')){
      const b=document.createElement('button');b.id='p6-scan-fab';b.type='button';b.onclick=openPhase6Scanner;
      b.innerHTML='<i class="fa-solid fa-qrcode"></i>';
      b.setAttribute('aria-label','สแกนรหัสอุปกรณ์');b.title='สแกน QR / Barcode';
      b.style.cssText='position:fixed;right:18px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:45;width:56px;height:56px;border-radius:50%;border:0;background:#0f766e;color:white;font-size:22px;box-shadow:0 10px 24px rgba(15,23,42,.28);display:none';
      document.body.appendChild(b);
      const mq=matchMedia('(max-width: 767px)');const sync=()=>b.style.display=mq.matches?'block':'none';sync();mq.addEventListener?.('change',sync);
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    injectUi();
    const code=new URLSearchParams(location.search).get('equipment')||new URLSearchParams(location.search).get('code');
    if(code)setTimeout(()=>window.showPublicEquipmentProfileV61?window.showPublicEquipmentProfileV61(code):showEquipment(code),650);
  });
})();
