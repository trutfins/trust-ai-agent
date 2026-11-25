/* TRUST — shared account helpers (needs supabase-js and trust-config.js loaded first). */
(function () {
  'use strict';
  var client = null;
  function sb() { return client || (client = supabase.createClient(TRUST_SB.url, TRUST_SB.key)); }

  async function isStaff(uid) {
    var r = await sb().from('staff_roles').select('role').eq('user_id', uid).maybeSingle();
    return !!r.data;
  }

  /* Self-registered clients: on first sign-in, create their company from the details
     they gave at sign-up and save their phone. Accounts created by TRUST (no "business"
     in their sign-up data) are left alone so TRUST can link them to an existing company. */
  async function ensureOrg(user) {
    var meta = user.user_metadata || {};
    var m = await sb().from('memberships').select('organization_id').eq('user_id', user.id).limit(1);
    if (m.error || (m.data && m.data.length)) return;
    if (meta.phone) await sb().from('profiles').update({ phone: String(meta.phone).slice(0, 40) }).eq('id', user.id);
    if (!meta.business) return;
    await sb().from('organizations').insert({ name: String(meta.business).slice(0, 160), industry: meta.industry ? String(meta.industry).slice(0, 120) : null, created_by: user.id });
  }

  function safeNext(n) { return (n && n.charAt(0) === '/' && n.charAt(1) !== '/' && n.indexOf('\\') < 0) ? n : null; }

  window.TRUSTAUTH = { sb: sb, isStaff: isStaff, ensureOrg: ensureOrg, safeNext: safeNext };
})();
