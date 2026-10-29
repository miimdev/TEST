/* پنل محلی سایت استاتیک؛ این رابط جایگزین احراز هویت سمت سرور نیست. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const PF = window.PF;
  let data = null;
  let remoteHash = "";
  let dirty = false;
  let channel = null;
  try { if ("BroadcastChannel" in window) channel = new BroadcastChannel("pf:sync"); } catch { /* پیش‌نمایش بدون همگام‌سازی زنده */ }

  function message(id, text, error = false) {
    $(id).textContent = text;
    $(id).dataset.error = String(error);
  }
  function loginView() {
    $("dashboard").hidden = true;
    $("login-view").hidden = false;
    $("password").value = "";
    $("password").type = "password";
    $("toggle-password").textContent = "نمایش رمز";
    $("toggle-password").setAttribute("aria-pressed", "false");
  }
  function requireSession() {
    if (PF.isLoggedIn()) return true;
    loginView();
    message("login-error", "نشست شما پایان یافته است. برای ادامه دوباره وارد شوید.", true);
    $("username").focus();
    return false;
  }
  function field(parent, labelText, key, value, options = {}) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement(options.multiline ? "textarea" : "input");
    input.dataset.key = key;
    input.value = value || "";
    if (!options.multiline) input.type = options.type || "text";
    if (options.max) input.maxLength = options.max;
    if (options.required) input.required = true;
    if (options.ltr) input.dir = "ltr";
    label.append(input);
    parent.append(label);
  }
  function renderEditor() {
    const container = $("works-editor");
    container.replaceChildren();
    data.works.forEach((work, i) => {
      const group = document.createElement("fieldset");
      group.className = "work-editor";
      group.dataset.index = i;
      const legend = document.createElement("legend");
      legend.textContent = work.title || work.tag;
      group.append(legend);
      const grid = document.createElement("div");
      grid.className = "admin-grid";
      field(grid, "عنوان پروژه", "title", work.title, { max: 150, required: true });
      field(grid, "دسته‌بندی", "tag", work.tag, { max: 40, required: true });
      field(grid, "کارفرما / برند", "client", work.client, { max: 120 });
      field(grid, "سال اجرا", "year", work.year, { max: 10 });
      field(grid, "ابزارها", "tools", work.tools, { max: 200 });
      field(grid, "لینک سایت (اختیاری)", "url", work.url, { type: "url", ltr: true, max: 2048 });
      group.append(grid);
      field(group, "توضیحات", "description", work.description, { multiline: true, max: 400 });
      container.append(group);
    });
    for (const key of ["phone", "email", "id"]) $("contact-" + key).value = data.contact[key] || "";
  }
  function dashboard() {
    $("login-view").hidden = true;
    $("dashboard").hidden = false;
    $("password").value = "";
    $("dashboard-title").focus();
  }
  function collect() {
    const works = Array.from(document.querySelectorAll(".work-editor"), (group) => {
      const work = { ...data.works[Number(group.dataset.index)] };
      group.querySelectorAll("[data-key]").forEach((input) => { work[input.dataset.key] = input.value; });
      return work;
    });
    const contact = { ...data.contact };
    for (const key of ["phone", "email", "id"]) contact[key] = $("contact-" + key).value;
    const cleaned = PF.clean({ ...data, works, contact });
    return { ...data, ...cleaned, contact: { ...data.contact, ...cleaned.contact } };
  }
  function save() {
    if (!requireSession()) return null;
    if (!$("editor").reportValidity()) return null;
    const next = collect();
    if (!PF.writeLocal(next)) throw new Error("ذخیره ممکن نشد. فضای مرورگر یا مجوز ذخیره‌سازی را بررسی کنید.");
    data = next;
    dirty = false;
    channel?.postMessage("saved");
    return next;
  }
  async function load() {
    $("retry").hidden = true;
    message("status", "در حال دریافت اطلاعات…");
    try {
      if (!PF) throw new Error("فایل ذخیره‌سازی بارگذاری نشد؛ صفحه را بازخوانی کنید.");
      let remote = null;
      try {
        const response = await fetch("../data.json", { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error("دریافت فایل ناموفق بود.");
        remote = await response.json();
      } catch { /* در صورت قطع شبکه از نسخه‌ی محلی استفاده می‌شود. */ }
      const local = PF.readLocal();
      const chosen = local && (!remote || String(local.updatedAt || "") > String(remote.updatedAt || "")) ? local : remote;
      if (!chosen || !Array.isArray(chosen.works) || !chosen.contact) throw new Error("اطلاعات سایت دریافت نشد. اتصال را بررسی و دوباره تلاش کنید.");
      remoteHash = chosen.authHash || "";
      // نسخه‌های قدیمی محلی ممکن است اطلاعات تکمیلی آثار و سایت را نداشته باشند.
      data = { ...remote, ...chosen, contact: { ...remote?.contact, ...chosen.contact } };
      data.works = chosen.works.filter(w => (w.tag || "").trim() !== "رابط کاربری").map(w => ({ ...remote?.works?.find(item => item.file === w.file), ...w }));
      renderEditor();
      message("status", remote ? "اطلاعات سایت آماده است." : "حالت آفلاین: نسخهٔ محلی بارگذاری شد.");
      if (PF.isLoggedIn()) dashboard();
      else { loginView(); $("username").focus(); }
    } catch (error) {
      message("status", error.message, true);
      $("retry").hidden = false;
    }
  }
  $("retry").addEventListener("click", load);
  $("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const result = PF.login($("username").value, $("password").value, remoteHash);
    if (!result.ok) { message("login-error", result.error, true); return; }
    message("login-error", "");
    dashboard();
  });
  $("toggle-password").addEventListener("click", () => {
    const show = $("password").type === "password";
    $("password").type = show ? "text" : "password";
    $("toggle-password").textContent = show ? "پنهان کردن رمز" : "نمایش رمز";
    $("toggle-password").setAttribute("aria-pressed", String(show));
  });
  $("logout").addEventListener("click", () => {
    if (dirty && !confirm("تغییرات ذخیره‌نشده کنار گذاشته شوند؟")) return;
    PF.logout();
    dirty = false;
    renderEditor();
    $("credentials-form").reset();
    message("save-status", "");
    message("credentials-status", "");
    loginView();
    $("username").focus();
  });
  $("editor").addEventListener("input", () => { dirty = true; });
  $("editor").addEventListener("submit", (event) => {
    event.preventDefault();
    try { if (save()) message("save-status", "ذخیره شد؛ این تغییرات فقط در همین مرورگر قابل مشاهده است. برای انتشار عمومی، فایل خروجی را در ریپوزیتوری جایگزین کنید."); }
    catch (error) { message("save-status", error.message, true); }
  });
  $("download").addEventListener("click", () => {
    try {
      const next = save();
      if (!next) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(next, null, 2) + "\n"], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "data.json";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message("save-status", "خروجی دریافت شد. فایل data.json را در ریشهٔ ریپوزیتوری جایگزین کنید و منتشر کنید.");
    } catch (error) { message("save-status", error.message, true); }
  });
  $("credentials-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!requireSession()) return;
    try {
      if ($("new-password").value !== $("confirm-password").value) throw new Error("رمز جدید و تکرار آن یکسان نیستند.");
      data.authHash = PF.setCredentials($("new-username").value, $("new-password").value);
      $("credentials-form").reset();
      message("credentials-status", "مشخصات ورود این مرورگر تغییر کرد. برای انتقال به نسخهٔ عمومی، فایل انتشار را دریافت کنید.");
      dirty = true;
    } catch (error) { message("credentials-status", error.message, true); }
  });
  setInterval(() => { if (!$("dashboard").hidden) requireSession(); }, 30000);
  window.addEventListener("storage", (event) => {
    if (event.key === "pf:auth" || event.key === null) {
      if (!PF.isLoggedIn()) { loginView(); $("credentials-form").reset(); }
    }
  });
  window.addEventListener("beforeunload", (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
  load();
})();
