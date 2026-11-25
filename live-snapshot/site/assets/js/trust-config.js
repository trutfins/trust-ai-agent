/* TRUST — site settings.
   The publishable key is safe to expose: all data is protected by Row Level Security in the database. */
window.TRUST_SB = {
  url: 'https://jbeiipdxcyzdqarxzbyo.supabase.co',
  key: 'sb_publishable_1-BaxouaNpq6UhJuWoSMBw_6UF-FWQI',

  /* Who must sign in before using the Financial Hub:
     'tools' = only the financial calculator needs a free account (recommended)
     'all'   = the whole Financial Hub (hub page, calculator, consultation, file upload) needs an account
     'none'  = everything open
     The free health check and the main website always stay open. */
  gate: 'tools',

  /* Where public forms are delivered:
     'netlify'  = Netlify Forms (email notifications) + a copy in the CRM
     'supabase' = the CRM only (use this on Cloudflare Pages or any other host) */
  forms: 'supabase'
};

/* Redirect to sign-in when this page is gated (pages mark themselves with <html data-gate="tools|hub">). */
(function () {
  var g = document.documentElement.getAttribute('data-gate'), m = window.TRUST_SB.gate;
  var need = (g === 'tools' && (m === 'tools' || m === 'all')) || (g === 'hub' && m === 'all');
  if (!need) return;
  var has = false;
  try { has = !!localStorage.getItem('sb-jbeiipdxcyzdqarxzbyo-auth-token'); } catch (e) {}
  if (!has) location.replace('/login.html?mode=signup&why=' + g + '&next=' + encodeURIComponent(location.pathname + location.search));
})();
