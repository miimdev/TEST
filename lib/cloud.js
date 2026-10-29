/* Only the public browser key belongs here. RLS, not key secrecy, protects writes. */
import { createClient } from '@supabase/supabase-js';
const client = createClient('https://jmpwryddrxmuwzmbmhsb.supabase.co', 'sb_publishable_E7s-ifIkDJ_zzLa_gt7xNQ_37xhuA-w', {
  auth: { storageKey: 'miim:cloud-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});
const adminEmail = 'resane.miim@gmail.com';
const redirectTo = 'https://miimdev.github.io/TEST/admin/';
function check(error) { if (error) throw error; }
function publicData(data) {
  const result = { ...data };
  delete result.authHash;
  return result;
}
window.MiimCloud = {
  adminEmail,
  async read(timeout = 7000) {
    const { data, error } = await client.from('miim_content').select('data,revision,updated_at').eq('id', 'main').single().abortSignal(AbortSignal.timeout(timeout));
    check(error); return data;
  },
  async session() {
    const { data, error } = await client.auth.getSession(); check(error); return data.session;
  },
  async isAdmin() {
    const { data, error } = await client.rpc('miim_is_admin'); check(error); return data === true;
  },
  async login(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    check(error); return data.session;
  },
  async activate(email, password) {
    if (email.toLowerCase() !== adminEmail) throw new Error('فعال‌سازی فقط برای ایمیل مدیر مجاز است.');
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    check(error); return data;
  },
  async recover(email) {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo }); check(error);
  },
  async password(password) { const { error } = await client.auth.updateUser({ password }); check(error); },
  async logout() { const { error } = await client.auth.signOut(); check(error); },
  onAuth(callback) { return client.auth.onAuthStateChange(callback); },
  async save(data, revision) {
    const response = await client.from('miim_content').update({ data: publicData(data) }).eq('id', 'main').eq('revision', revision).select('data,revision,updated_at').maybeSingle();
    check(response.error);
    if (!response.data) throw new Error('نسخهٔ جدیدتری ذخیره شده یا دسترسی ویرایش ندارید. قبل از تلاش مجدد، اطلاعات را تازه‌سازی کنید.');
    return response.data;
  },
};
