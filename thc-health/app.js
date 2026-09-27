(() => {
  "use strict";

  const cfg = window.HEALTH_CENTER_SITE_CONFIG || {};
  const fallback = cfg.fallback || {};

  function minutes(hhmm) {
    const [h,m] = String(hhmm || "00:00").split(":").map(Number);
    return h * 60 + m;
  }

  function nowIn(timezone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "Asia/Bangkok",
      weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    const get = t => parts.find(p => p.type === t)?.value || "";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      weekday: {Sun:7,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[get("weekday")],
      minuteOfDay: Number(get("hour")) * 60 + Number(get("minute"))
    };
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(el => { el.textContent = value; });
  }

  function openEquipmentDialog(event) {
    if (event) event.preventDefault();
    const dialog = document.getElementById("equipmentDialog");
    const result = document.getElementById("equipmentResult");
    if (result) { result.textContent = ""; result.className = "dialog-result"; }
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function setServiceLinks(site) {
    const oneStop = site?.one_stop_url || fallback.oneStopUrl || "#";
    const line = site?.line_contact_url || fallback.lineContactUrl || oneStop;
    const hero = document.getElementById("oneStopHero");
    if (hero) { hero.href = "#services"; }
    const appointment = document.getElementById("appointmentLink");
    if (appointment) { appointment.href = line; appointment.rel = "noopener noreferrer"; }
    const equipment = document.getElementById("equipmentLink");
    if (equipment) { equipment.href = "#equipment-request"; equipment.onclick = openEquipmentDialog; }
    const contact = document.getElementById("contactLink");
    if (contact) { contact.href = line; contact.rel = "noopener noreferrer"; }
  }

  function paintSite(site) {
    const unit = site?.unit_name || fallback.unitName || "";
    const municipality = site?.municipality || fallback.municipality || "";
    const tagline = site?.tagline || fallback.tagline || "";
    setText("[data-site-unit]", unit);
    setText("[data-site-municipality]", municipality);
    setText("[data-site-tagline]", tagline);
    const lineTest = site?.line_mode === "test";
    const lineStatus = document.getElementById("lineTestStatus");
    if (lineStatus) lineStatus.hidden = !lineTest;
    document.querySelectorAll("[data-line-test-badge]").forEach(el => { el.hidden = !lineTest; });
    const lineDetail = document.getElementById("lineTestDetail");
    if (lineDetail && lineTest) {
      lineDetail.textContent = (site?.line_display_name || "LINE OA TEST") + " · " + (site?.line_basic_id || "") + " · ใช้เพื่อทดสอบก่อนสลับ OA จริง";
    }
    setServiceLinks(site || {});
  }

  function paintSchedule(schedule) {
    const title = document.getElementById("officeStatus");
    const detail = document.getElementById("officeDetail");
    if (!title || !detail) return;
    const s = schedule || fallback.officeHours || {};

    if (!s.confirmed) {
      title.textContent = "เวลาทำการรอยืนยัน";
      detail.textContent = "อยู่ระหว่างยืนยันเวลาบริการจากหน่วยงาน";
      return;
    }

    const current = nowIn(s.timezone || "Asia/Bangkok");
    if ((s.closures || []).includes(current.date)) {
      title.textContent = "ปิดบริการเฉพาะกิจ";
      detail.textContent = "ระบบออนไลน์ยังใช้งานได้ เจ้าหน้าที่จะดำเนินการในวันทำการถัดไป";
      return;
    }
    if ((s.holidays || []).includes(current.date)) {
      title.textContent = "วันหยุดราชการ";
      detail.textContent = "ระบบออนไลน์ยังใช้งานได้ เจ้าหน้าที่จะดำเนินการในวันทำการถัดไป";
      return;
    }

    const open = (s.weekdays || []).includes(current.weekday)
      && current.minuteOfDay >= minutes(s.start)
      && current.minuteOfDay < minutes(s.end);

    title.textContent = open ? "เวลาทำการ" : "นอกเวลาทำการ";
    detail.textContent = open
      ? "เจ้าหน้าที่พร้อมให้บริการ"
      : "ส่งคำขอออนไลน์ได้ เจ้าหน้าที่จะดำเนินการในวันทำการ";
  }

  function newsCard(item) {
    const article = document.createElement("article");
    article.className = "content-card";
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = item.content_type === "WebsiteAnnouncement" ? "ประกาศ" : "ข่าวสาร";
    const title = document.createElement("h3");
    title.textContent = item.value1 || "ข่าวประชาสัมพันธ์";
    const summary = document.createElement("p");
    summary.textContent = item.value2 || "";
    article.append(tag,title,summary);
    return article;
  }

  function paintNews(news, error = false) {
    const grid = document.getElementById("newsGrid");
    if (!grid) return;
    grid.replaceChildren();
    if (!Array.isArray(news) || !news.length) {
      const item = document.createElement("article");
      item.className = "content-card";
      item.innerHTML = `<span class="tag">ข่าวสาร</span><h3>${error ? "ไม่สามารถโหลดข่าวล่าสุดได้" : "ขณะนี้ยังไม่มีข่าวหรือประกาศใหม่"}</h3><p>จะแสดงเฉพาะรายการที่เจ้าหน้าที่เผยแพร่สำหรับเว็บไซต์</p>`;
      grid.append(item);
      return;
    }
    news.slice(0,3).forEach(row => grid.append(newsCard(row)));
  }

  function paintSystem(ok) {
    const title = document.getElementById("systemStatus");
    const detail = document.getElementById("systemDetail");
    const panel = title?.closest(".status-row");
    if (!title || !detail) return;
    title.textContent = ok ? "ระบบออนไลน์ปกติ" : "ระบบบางบริการขัดข้อง";
    detail.textContent = ok ? "One Stop Service พร้อมให้บริการ" : "เว็บไซต์ยังเปิดได้ กรุณาติดต่อเจ้าหน้าที่หากใช้บริการไม่ได้";
    if (panel) panel.classList.toggle("system-error", !ok);
  }

  function setupEquipmentRequest() {
    const dialog = document.getElementById("equipmentDialog");
    const form = document.getElementById("equipmentForm");
    const close = document.getElementById("equipmentClose");
    const result = document.getElementById("equipmentResult");
    const submit = document.getElementById("equipmentSubmit");
    if (!dialog || !form) return;

    if (close) close.onclick = () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };

    if (location.hash === "#equipment-request") queueMicrotask(() => openEquipmentDialog());

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!cfg.lineHubApiUrl) {
        result.textContent = "ยังไม่สามารถรับคำขอได้ กรุณาติดต่อเจ้าหน้าที่ผ่าน LINE";
        result.className = "dialog-result error";
        return;
      }
      submit.disabled = true;
      result.textContent = "กำลังส่งคำขอ…";
      result.className = "dialog-result";
      try {
        const response = await fetch(cfg.lineHubApiUrl, {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({
            action: "equipment-request",
            equipment_type: document.getElementById("equipmentType").value,
            quantity: Number(document.getElementById("equipmentQty").value),
            short_reason: document.getElementById("equipmentReason").value,
            contact_phone: document.getElementById("equipmentPhone").value
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.success !== true) throw new Error(data?.error || "ไม่สามารถส่งคำขอได้");
        result.textContent = "รับคำขอแล้ว เลขอ้างอิง " + data.reference + " เจ้าหน้าที่จะตรวจสอบและติดต่อกลับ การส่งคำขอยังไม่ใช่การยืนยันว่ามีอุปกรณ์พร้อมยืม";
        result.className = "dialog-result ok";
        form.reset();
        document.getElementById("equipmentQty").value = "1";
      } catch (error) {
        result.textContent = error.message || "ไม่สามารถส่งคำขอได้ กรุณาติดต่อเจ้าหน้าที่ผ่าน LINE";
        result.className = "dialog-result error";
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function load() {
    paintSite({});
    paintSchedule(fallback.officeHours || {});
    paintNews([]);

    try {
      const response = await fetch(cfg.publicApiUrl, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data?.success !== true) throw new Error("public api unavailable");
      paintSystem(data.systemStatus === "ok");
      paintSite(data.site || {});
      paintSchedule(data.schedule || {});
      paintNews(data.news || []);
    } catch (_) {
      paintSystem(false);
      paintNews([], true);
    }
  }

  setupEquipmentRequest();
  load();
})();
