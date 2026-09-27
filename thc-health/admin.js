(() => {
  "use strict";
  const cfg = window.HEALTH_CENTER_SITE_CONFIG || {};
  const endpoint = cfg.adminApiUrl || "";
  const tokenKey = "thcHealth.adminToken";
  let currentProfile = null;
  let contentRows = [];

  const $ = id => document.getElementById(id);
  const val = id => $(id)?.value?.trim() || "";
  const set = (id,v) => { if ($(id)) $(id).value = v ?? ""; };

  async function api(payload) {
    if (!endpoint) throw new Error("ยังไม่ได้ตั้งค่า Admin API");
    const response = await fetch(endpoint, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload),
      cache:"no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || "ไม่สามารถดำเนินการได้");
    return data;
  }

  function token() { return sessionStorage.getItem(tokenKey) || ""; }
  function canEdit() { return currentProfile?.role === "ADMIN"; }
  function showStatus(id,message,error=false) {
    const el=$(id); if(!el) return; el.textContent=message; el.style.color=error?"#b42318":"#0b684f";
  }
  function parseDates(text) {
    return [...new Set(String(text||"").split(/[\n,\s]+/).map(x=>x.trim()).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))];
  }
  function renderReadiness(readiness) {
    const checks = readiness?.checks || {};
    document.querySelectorAll("[data-ready]").forEach(el => {
      const ok = checks[el.dataset.ready] === true;
      el.classList.toggle("ready-pass", ok);
      el.classList.toggle("ready-wait", !ok);
      el.dataset.state = ok ? "ผ่าน" : "รอดำเนินการ";
    });
    const badge = $("productionBadge");
    const summary = $("productionSummary");
    if (badge) {
      badge.textContent = readiness?.readyToDeploy ? "พร้อม Deploy" : "ยังไม่พร้อม Deploy";
      badge.classList.toggle("warning", !readiness?.readyToDeploy);
    }
    if (summary) {
      summary.textContent = readiness?.readyToDeploy
        ? "เงื่อนไขทางเทคนิคครบแล้ว แต่ Production cutover ยังต้องได้รับการอนุมัติ"
        : "ระบบจะยังไม่เปิด Production จนกว่าเงื่อนไขที่ค้างอยู่จะผ่านทั้งหมด";
    }
  }

  function resetContentForm() {
    set("contentId",""); set("contentType","WebsiteNews"); set("contentSort","100"); set("contentTitle",""); set("contentSummary","");
    $("contentActive").checked=true; showStatus("contentStatus","");
  }

  function populate(data) {
    currentProfile=data.profile;
    $("who").textContent=`${data.profile.displayName} · ${data.profile.role}`;
    $("readOnlyNotice").classList.toggle("admin-hidden", canEdit());

    const site=data.site||{};
    set("siteUnit",site.unit_name); set("siteMunicipality",site.municipality); set("siteTagline",site.tagline);
    set("siteOneStop",site.one_stop_url); set("siteLine",site.line_contact_url); set("sitePhone",site.phone); set("siteMap",site.map_url); set("siteAddress",site.address);

    const hours=data.schedule||{};
    document.querySelectorAll("#weekdayGrid input").forEach(cb=>{cb.checked=(hours.weekdays||[]).includes(Number(cb.value));});
    set("hoursStart",hours.start||"08:30"); set("hoursEnd",hours.end||"16:30");
    set("hoursHolidays",(hours.holidays||[]).join("\n")); set("hoursClosures",(hours.closures||[]).join("\n"));
    $("hoursConfirmed").checked=hours.confirmed===true;
    renderReadiness(data.readiness || {});

    contentRows=data.content||[];
    renderContent();

    document.querySelectorAll("#adminPanel input,#adminPanel select,#adminPanel textarea,#adminPanel button[type=submit],#contentCancel").forEach(el=>{
      if (el.id==="logout") return;
      el.disabled=!canEdit();
    });
  }

  function renderContent() {
    const list=$("contentList"); list.replaceChildren();
    if(!contentRows.length){const p=document.createElement("p");p.textContent="ยังไม่มีข่าวหรือประกาศสำหรับเว็บไซต์";p.style.color="var(--muted)";list.append(p);return;}
    contentRows.forEach(item=>{
      const row=document.createElement("article"); row.className="admin-content-item";
      const main=document.createElement("div");
      const state=document.createElement("span"); state.className="admin-state"+(item.active?"":" off"); state.textContent=item.active?"เผยแพร่":"ซ่อน";
      const h=document.createElement("h3"); h.textContent=item.value1||"-";
      const p=document.createElement("p"); p.textContent=(item.content_type==="WebsiteAnnouncement"?"ประกาศ":"ข่าวสาร")+" · ลำดับ "+item.sort_order+(item.value2?" · "+item.value2:"");
      main.append(state,h,p);
      const actions=document.createElement("div"); actions.className="admin-content-actions";
      const edit=document.createElement("button"); edit.type="button"; edit.className="admin-mini"; edit.textContent="แก้ไข"; edit.disabled=!canEdit();
      edit.onclick=()=>{set("contentId",item.id);set("contentType",item.content_type);set("contentSort",item.sort_order);set("contentTitle",item.value1);set("contentSummary",item.value2);$("contentActive").checked=item.active;window.scrollTo({top:$("contentForm").offsetTop-100,behavior:"smooth"});};
      const toggle=document.createElement("button"); toggle.type="button"; toggle.className="admin-mini"; toggle.textContent=item.active?"ซ่อน":"เผยแพร่"; toggle.disabled=!canEdit();
      toggle.onclick=async()=>{try{await api({action:"set-content-active",token:token(),id:item.id,active:!item.active});await loadAdmin();}catch(e){showStatus("contentStatus",e.message,true);}};
      actions.append(edit,toggle); row.append(main,actions); list.append(row);
    });
  }

  async function loadAdmin() {
    const data=await api({action:"admin-load",token:token()});
    $("loginPanel").classList.add("admin-hidden"); $("adminPanel").classList.remove("admin-hidden");
    populate(data);
  }

  $("loginForm").addEventListener("submit",async e=>{
    e.preventDefault(); $("loginError").textContent="";
    const submit=e.submitter; submit.disabled=true;
    try{
      const data=await api({action:"login",username:val("username"),password:$("password").value});
      sessionStorage.setItem(tokenKey,data.token); $("password").value=""; await loadAdmin();
    }catch(err){$("loginError").textContent=err.message;}finally{submit.disabled=false;}
  });

  $("logout").onclick=()=>{sessionStorage.removeItem(tokenKey);currentProfile=null;$("adminPanel").classList.add("admin-hidden");$("loginPanel").classList.remove("admin-hidden");};

  $("siteForm").addEventListener("submit",async e=>{
    e.preventDefault(); if(!canEdit())return;
    try{
      await api({action:"save-site",token:token(),site:{
        unit_name:val("siteUnit"),municipality:val("siteMunicipality"),tagline:val("siteTagline"),
        one_stop_url:val("siteOneStop"),line_contact_url:val("siteLine"),phone:val("sitePhone"),map_url:val("siteMap"),address:val("siteAddress")
      }});
      showStatus("siteStatus","บันทึกแล้ว");
    }catch(err){showStatus("siteStatus",err.message,true);}
  });

  $("hoursForm").addEventListener("submit",async e=>{
    e.preventDefault(); if(!canEdit())return;
    try{
      const weekdays=[...document.querySelectorAll("#weekdayGrid input:checked")].map(x=>Number(x.value));
      await api({action:"save-hours",token:token(),schedule:{
        timezone:"Asia/Bangkok",weekdays,start:val("hoursStart"),end:val("hoursEnd"),
        holidays:parseDates(val("hoursHolidays")),closures:parseDates(val("hoursClosures")),confirmed:$("hoursConfirmed").checked
      }});
      showStatus("hoursStatus",$("hoursConfirmed").checked?"บันทึกและยืนยันแล้ว":"บันทึกร่างแล้ว");
    }catch(err){showStatus("hoursStatus",err.message,true);}
  });

  $("contentForm").addEventListener("submit",async e=>{
    e.preventDefault(); if(!canEdit())return;
    try{
      await api({action:"save-content",token:token(),item:{
        id:Number(val("contentId")||0),content_type:val("contentType"),sort_order:Number(val("contentSort")||100),
        value1:val("contentTitle"),value2:val("contentSummary"),active:$("contentActive").checked
      }});
      showStatus("contentStatus","บันทึกแล้ว"); resetContentForm(); await loadAdmin();
    }catch(err){showStatus("contentStatus",err.message,true);}
  });
  $("contentCancel").onclick=resetContentForm;

  if(token()) loadAdmin().catch(()=>sessionStorage.removeItem(tokenKey));
})();
