/* Cloud-backed studio workspace. Database RLS is the authorization boundary. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cloud = window.MiimCloud;
  const PF = window.PF;
  let data = null;
  let revision = null;
  let dirty = false;
  let recovery = false;
  let currentUser = null;
  let busy = false;
  let channel = null;
  try { channel = new BroadcastChannel('pf:sync'); } catch { /* Optional local notification. */ }
  const fa = value => new Intl.NumberFormat('fa-IR').format(value);
  const safeUrl = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  function message(id, text, error = false) { $(id).textContent = text; $(id).dataset.error = String(error); }
  function friendly(error) {
    const text = String(error?.message || error);
    if (/Invalid login credentials/i.test(text)) return 'نام کاربری یا رمز عبور درست نیست.';
    if (/Email not confirmed/i.test(text)) return 'ابتدا ایمیل تأیید حساب را در صندوق ایمیلت باز کن.';
    if (/rate limit|too many|security purposes/i.test(text)) return 'تعداد درخواست‌ها زیاد است. چند دقیقه دیگر دوباره تلاش کن.';
    if (/fetch|network|timeout|abort/i.test(text)) return 'ارتباط با فضای ابری برقرار نشد. اینترنت را بررسی و دوباره تلاش کن.';
    if (/email address.*(not authorized|invalid)/i.test(text)) return 'ارسال ایمیل به این آدرس مجاز نیست؛ تنظیمات SMTP پروژهٔ Supabase را بررسی کن.';
    if (/password.*(weak|short|least)/i.test(text)) return 'رمز قوی‌تری با حداقل ۸ کاراکتر انتخاب کن.';
    return /[\u0600-\u06ff]/.test(text) ? text : 'عملیات انجام نشد. وضعیت اتصال و دسترسی حساب را بررسی کن.';
  }
  function setDirty(value) {
    dirty = value;
    document.querySelector('.publish-bar').classList.toggle('is-dirty', value);
    $('draft-state').textContent = value ? 'تغییرات منتشرنشده داری' : 'همه‌چیز به‌روز است';
  }
  function setBusy(value) {
    busy = value;
    for (const id of ['publish', 'download', 'refresh-content']) $(id).disabled = value;
    $('publish').textContent = value ? 'در حال ذخیره…' : 'ذخیره و انتشار ↗';
    // Prevent edits during a pending write from being accidentally marked as saved.
    $('works-editor').querySelectorAll('input,textarea').forEach(el => { el.disabled = value; });
    for (const key of ['phone', 'email', 'id']) $('contact-' + key).disabled = value;
  }
  function loginView() {
    document.body.classList.remove('is-dashboard');
    $('dashboard').hidden = true;
    $('recovery-view').hidden = true;
    $('login-view').hidden = false;
    $('login-footer').hidden = false;
    $('password').value = '';
    $('password').type = 'password';
    $('toggle-password').setAttribute('aria-pressed', 'false');
    $('toggle-password').setAttribute('aria-label', 'نمایش رمز عبور');
    $('credentials-form').reset();
    currentUser = null;
  }
  function showRecovery() {
    recovery = true;
    document.body.classList.remove('is-dashboard');
    $('dashboard').hidden = true;
    $('login-view').hidden = true;
    $('recovery-view').hidden = false;
    $('recovery-password').focus();
  }
  function field(parent, title, key, value, options = {}) {
    const label = document.createElement('label');
    if (options.full) label.className = 'full-field';
    label.textContent = title;
    const input = document.createElement(options.multiline ? 'textarea' : 'input');
    input.dataset.key = key;
    input.value = value || '';
    if (!options.multiline) input.type = options.type || 'text';
    if (options.max) input.maxLength = options.max;
    input.required = Boolean(options.required);
    if (options.ltr) input.dir = 'ltr';
    label.append(input); parent.append(label);
  }
  function renderEditor() {
    const container = $('works-editor');
    container.replaceChildren();
    data.works.forEach((work, i) => {
      const group = document.createElement('article');
      group.className = 'work-editor'; group.dataset.index = i;
      const cover = document.createElement('div'); cover.className = 'project-cover';
      const img = document.createElement('img'); img.src = '../Image/' + encodeURIComponent(work.file); img.alt = work.title || work.tag; img.loading = 'lazy';
      const tag = document.createElement('span'); tag.className = 'project-tag'; tag.textContent = work.tag;
      const index = document.createElement('span'); index.className = 'project-index'; index.textContent = String(i + 1).padStart(2, '0') + ' / SELECTED WORK';
      cover.append(img, tag, index);
      const fields = document.createElement('div'); fields.className = 'project-fields';
      const titleRow = document.createElement('div'); titleRow.className = 'project-title-row';
      const titleWrap = document.createElement('div'); const title = document.createElement('h3'); title.textContent = work.title || work.tag;
      const subtitle = document.createElement('small'); subtitle.textContent = [work.client, work.year].filter(Boolean).join(' / '); titleWrap.append(title, subtitle); titleRow.append(titleWrap);
      const link = safeUrl(work.url);
      if (link) { const a = document.createElement('a'); a.href = link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = '↗'; a.setAttribute('aria-label', 'مشاهده سایت ' + work.title); titleRow.append(a); }
      const grid = document.createElement('div'); grid.className = 'admin-grid';
      field(grid, 'عنوان پروژه', 'title', work.title, { max: 150, required: true, full: true });
      field(grid, 'دسته‌بندی', 'tag', work.tag, { max: 40, required: true });
      field(grid, 'سال اجرا', 'year', work.year, { max: 10 });
      field(grid, 'کارفرما / برند', 'client', work.client, { max: 120 });
      field(grid, 'ابزارها', 'tools', work.tools, { max: 200 });
      field(grid, 'لینک سایت (اختیاری)', 'url', work.url, { type: 'url', ltr: true, max: 2048, full: true });
      field(grid, 'داستان پروژه', 'description', work.description, { multiline: true, max: 400, full: true });
      fields.append(titleRow, grid); group.append(cover, fields); container.append(group);
    });
    for (const key of ['phone', 'email', 'id']) $('contact-' + key).value = data.contact[key] || '';
    $('work-count').textContent = fa(data.works.length);
    $('nav-count').textContent = fa(data.works.length);
    $('web-count').textContent = fa(data.works.filter(w => safeUrl(w.url)).length);
    $('cloud-status').textContent = 'دیتابیس متصل و آمادهٔ انتشار';
    $('revision-label').textContent = 'نسخهٔ ' + fa(revision) + ' محتوا';
    const date = new Date(data.updatedAt || '');
    $('last-update').textContent = Number.isNaN(date.getTime()) ? 'همین حالا' : new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }).format(date);
  }
  async function authorize() {
    const session = await cloud.session();
    if (!session) { loginView(); throw new Error('نشست پایان یافته است. دوباره وارد شو.'); }
    if (!await cloud.isAdmin()) { await cloud.logout(); loginView(); throw new Error('این حساب اجازهٔ مدیریت رسانه میم را ندارد.'); }
    currentUser = session.user;
    return session;
  }
  async function readContent() {
    const response = await fetch('../data.json', { cache: 'no-store', signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error('دریافت نسخهٔ پایهٔ محتوا ممکن نشد.');
    const snapshot = await response.json();
    const row = await cloud.read();
    data = { ...snapshot, ...row.data, contact: { ...snapshot.contact, ...row.data.contact } };
    delete data.authHash;
    data.works = data.works.filter(w => (w.tag || '').trim() !== 'رابط کاربری');
    revision = row.revision;
    renderEditor(); setDirty(false);
  }
  async function openDashboard(animate = false) {
    await authorize();
    await readContent();
    if (animate) {
      document.querySelector('.login-layout').classList.add('is-unlocked');
      message('login-error', 'احراز هویت موفق؛ به استودیو خوش آمدی.');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise(resolve => setTimeout(resolve, 700));
    }
    document.body.classList.add('is-dashboard');
    document.querySelector('.login-layout').classList.remove('is-unlocked');
    $('login-view').hidden = true; $('recovery-view').hidden = true; $('dashboard').hidden = false;
    $('password').value = ''; $('account-email').textContent = currentUser.email;
    $('dashboard-title').focus();
    message('status', 'متصل به Supabase');
  }
  function collect() {
    const works = Array.from(document.querySelectorAll('.work-editor'), group => {
      const work = { ...data.works[Number(group.dataset.index)] };
      group.querySelectorAll('[data-key]').forEach(input => { work[input.dataset.key] = input.value; });
      if (work.tag.trim() === 'رابط کاربری') throw new Error('دستهٔ رابط کاربری از ویترین حذف شده است. دستهٔ سایت یا گرافیک انتخاب کن.');
      return work;
    });
    const contact = { ...data.contact };
    for (const key of ['phone', 'email', 'id']) contact[key] = $('contact-' + key).value;
    const cleaned = PF.clean({ ...data, works, contact });
    const next = { ...data, ...cleaned, contact: { ...data.contact, ...cleaned.contact } };
    delete next.authHash;
    return next;
  }
  async function save() {
    if (busy || !$('editor').reportValidity()) return;
    const next = collect();
    setBusy(true);
    try {
      await authorize();
      const row = await cloud.save(next, revision);
      data = row.data; revision = row.revision; setDirty(false); renderEditor();
      channel?.postMessage('saved');
      message('save-status', 'ذخیره و منتشر شد؛ محتوای جدید برای همهٔ بازدیدکننده‌ها نمایش داده می‌شود.');
    } finally { setBusy(false); }
  }
  async function load() {
    $('retry').hidden = true;
    message('status', 'در حال بررسی اتصال امن…');
    try {
      if (!cloud || !PF) throw new Error('فایل‌های پنل بارگذاری نشدند. صفحه را بازخوانی کن.');
      const session = await cloud.session();
      if (recovery) { showRecovery(); return; }
      if (session) await openDashboard();
      else { loginView(); $('username').focus(); message('status', 'ورود با حساب تأییدشدهٔ مدیر'); }
    } catch (error) {
      loginView(); message('status', friendly(error), true); $('retry').hidden = false;
    }
  }
  $('retry').addEventListener('click', load);
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    $('login-submit').disabled = true;
    document.body.classList.add('is-signing-in');
    $('login-submit-label').textContent = 'در حال ورود…';
    message('login-error', 'در حال ارتباط با حساب شما…');
    try {
      const email = $('username').value.trim();
      const password = $('password').value;
      await cloud.login(email, password); await openDashboard(true); message('login-error', '');
    } catch (error) {
      message('login-error', friendly(error), true);
      const panel = document.querySelector('.login-form-panel');
      panel.classList.remove('is-rejected'); void panel.offsetWidth; panel.classList.add('is-rejected');
    }
    finally {
      $('login-submit').disabled = false; document.body.classList.remove('is-signing-in');
      $('login-submit-label').textContent = 'ورود به اتاق فرمان';
    }
  });
  $('forgot-password').addEventListener('click', async () => {
    if (!$('username').reportValidity()) return;
    $('forgot-password').disabled = true;
    try { await cloud.recover($('username').value.trim()); message('login-error', 'اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی ارسال می‌شود. صندوق ایمیل و Spam را بررسی کن.'); }
    catch (error) { message('login-error', friendly(error), true); }
    finally { $('forgot-password').disabled = false; }
  });
  $('toggle-password').addEventListener('click', () => {
    const show = $('password').type === 'password';
    $('password').type = show ? 'text' : 'password';
    $('toggle-password').setAttribute('aria-pressed', String(show));
    $('toggle-password').setAttribute('aria-label', show ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور');
  });
  $('logout').addEventListener('click', async () => {
    if (busy || (dirty && !confirm('تغییرات منتشرنشده کنار گذاشته شوند؟'))) return;
    try { await cloud.logout(); setDirty(false); loginView(); message('status', 'از حساب خارج شدی.'); }
    catch (error) { message('status', friendly(error), true); }
  });
  $('editor').addEventListener('input', () => setDirty(true));
  $('editor').addEventListener('submit', async event => { event.preventDefault(); try { await save(); } catch (error) { message('save-status', friendly(error), true); } });
  $('refresh-content').addEventListener('click', async () => {
    if (busy || (dirty && !confirm('تغییرات منتشرنشده با نسخهٔ ابری جایگزین شوند؟'))) return;
    setBusy(true);
    try { await authorize(); await readContent(); message('save-status', 'آخرین نسخهٔ ابری دریافت شد.'); }
    catch (error) { message('save-status', friendly(error), true); }
    finally { setBusy(false); }
  });
  $('download').addEventListener('click', async () => {
    try {
      await authorize();
      if (!$('editor').reportValidity()) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(collect(), null, 2) + '\n'], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'data.json'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message('save-status', 'نسخهٔ پشتیبان دریافت شد؛ دریافت فایل، تغییرات را منتشر نمی‌کند.');
    } catch (error) { message('save-status', friendly(error), true); }
  });
  $('credentials-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      await authorize();
      if ($('new-password').value !== $('confirm-password').value) throw new Error('رمز جدید و تکرار آن یکسان نیستند.');
      await cloud.login(currentUser.email, $('current-password').value);
      await cloud.password($('new-password').value);
      $('credentials-form').reset(); message('credentials-status', 'رمز عبور حساب ابری به‌روزرسانی شد.');
    } catch (error) { message('credentials-status', friendly(error), true); }
    finally { button.disabled = false; }
  });
  $('recovery-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      if ($('recovery-password').value !== $('recovery-confirm').value) throw new Error('رمز جدید و تکرار آن یکسان نیستند.');
      await cloud.password($('recovery-password').value);
      recovery = false; $('recovery-form').reset();
      await openDashboard();
    } catch (error) { message('recovery-status', friendly(error), true); }
    finally { button.disabled = false; }
  });
  document.querySelectorAll('.side-nav a').forEach(a => a.addEventListener('click', () => {
    document.querySelectorAll('.side-nav a').forEach(link => link.classList.toggle('is-active', link === a));
  }));
  cloud?.onAuth(event => {
    // Supabase warns against awaiting auth API calls inside the auth callback.
    if (event === 'PASSWORD_RECOVERY') { recovery = true; setTimeout(showRecovery, 0); }
    if (event === 'SIGNED_OUT') setTimeout(() => { loginView(); message('status', 'نشست حساب پایان یافت. برای ادامه وارد شو.'); }, 0);
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  load();
})();
