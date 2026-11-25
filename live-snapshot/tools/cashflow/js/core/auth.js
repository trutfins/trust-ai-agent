/* =============================================================================
   core/auth.js — sign-in with a TRUST account (same accounts and approvals as
   the financial & credit analysis tool). Used only for AI commentary: the TRUST
   AI service answers approved accounts. The session is kept in this browser.
   ============================================================================= */
(function(){
const A = BM.auth = {};
const KEY = "trust-auth", CODE = "trust-ai-code";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch(e){ return null; } };
const write = s => { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch(e){} };
const keep = j => { const s = {access:j.access_token, refresh:j.refresh_token, exp:Date.now() + (j.expires_in || 3600) * 1000, email:(j.user && j.user.email) || ""}; write(s); return s; };
async function tokenCall(grant, body){
  const r = await fetch(BM.SUPA.url + "/auth/v1/token?grant_type=" + grant, {method:"POST", headers:{"Content-Type":"application/json", apikey:BM.SUPA.key}, body:JSON.stringify(body)});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.msg || j.message || ("HTTP " + r.status));
  return keep(j);
}
A.user = () => { const s = read(); return s ? {email:s.email} : null; };
A.signIn = async (email, password) => tokenCall("password", {email, password});
A.signOut = () => { const s = read(); write(null);
  if (s) fetch(BM.SUPA.url + "/auth/v1/logout", {method:"POST", headers:{apikey:BM.SUPA.key, Authorization:"Bearer " + s.access}}).catch(() => {}); };
/* a valid access token, refreshed when it is about to expire; null when signed out */
A.token = async () => {
  const s = read(); if (!s) return null;
  if (Date.now() < s.exp - 60000) return s.access;
  try { return (await tokenCall("refresh_token", {refresh_token:s.refresh})).access; } catch(e){ write(null); return null; }
};
/* ---------- TRUST account procedures (same as the financial & credit analysis tool) ----------
   Same Supabase project, same accounts, same approval table (analysis_access) and the same
   server functions (analysis_tier, analysis_is_admin). Approval and suspension are enforced by
   row-level security on the server; the TRUST AI service checks the same approval. */
const H = (tok) => { const h = {"Content-Type":"application/json", apikey:BM.SUPA.key}; if (tok) h.Authorization = "Bearer " + tok; return h; };
const HERE = () => location.origin + location.pathname;
async function call(path, opt){ const r = await fetch(BM.SUPA.url + path, opt); const j = await r.json().catch(() => ({}));
  if (!r.ok){ const e = new Error(j.error_description || j.msg || j.message || j.error || ("HTTP " + r.status)); e.status = r.status; e.code = j.error_code || j.code; throw e; } return j; }
A.MIN_PW = 8;
/* create an account; TRUST approves it before use. Returns {confirm:true} when the e-mail must be confirmed first */
A.signUp = async (email, password, fullName) => {
  const j = await call("/auth/v1/signup?redirect_to=" + encodeURIComponent(HERE()), {method:"POST", headers:H(), body:JSON.stringify({email, password, data:{full_name:fullName}})});
  if (Array.isArray(j.identities) && !j.identities.length){ const e = new Error("already registered"); e.code = "user_already_exists"; throw e; }
  if (j.access_token){ keep(j); await A.ensureRequest(fullName); return {confirm:false}; }
  return {confirm:true};
};
/* e-mail a link to set a new password (answers the same whether or not the e-mail exists) */
A.recover = (email) => call("/auth/v1/recover?redirect_to=" + encodeURIComponent(HERE()), {method:"POST", headers:H(), body:JSON.stringify({email})});
/* set a new password for the signed-in account (also used after a recovery link) */
A.setPassword = async (password) => { const tok = await A.token(); if (!tok) throw new Error("session ended");
  await call("/auth/v1/user", {method:"PUT", headers:H(tok), body:JSON.stringify({password})}); };
/* re-check the current password before changing it (sign-in with it) */
A.verifyPassword = async (password) => { const u = A.user(); if (!u) throw new Error("session ended"); await A.signIn(u.email, password); };
/* links from TRUST e-mails arrive as #access_token=…&type=recovery|signup|magiclink */
A.fromLink = () => {
  const h = location.hash || ""; if (h.indexOf("access_token=") < 0 && h.indexOf("error_description=") < 0) return null;
  const q = new URLSearchParams(h.slice(1)); history.replaceState(null, "", location.pathname);
  if (q.get("error_description")) return {error:q.get("error_description")};
  keep({access_token:q.get("access_token"), refresh_token:q.get("refresh_token"), expires_in:+q.get("expires_in") || 3600, user:{email:""}});
  return {type:q.get("type") || ""};
};
/* who is signed in (fills the e-mail after a link) */
A.me = async () => { const tok = await A.token(); if (!tok) return null; const j = await call("/auth/v1/user", {headers:H(tok)});
  const s = read(); if (s && !s.email){ s.email = j.email || ""; write(s); } return j; };
/* the access request row of this account; created (status pending) if it does not exist yet */
A.access = async () => { const tok = await A.token(); if (!tok) return null;
  const rows = await call("/rest/v1/analysis_access?select=status,full_access,full_name,email&user_id=eq." + encodeURIComponent(A.uid()), {headers:H(tok)});
  return rows[0] || null; };
A.ensureRequest = async (fullName) => { const tok = await A.token(); if (!tok) return null; const cur = await A.access(); if (cur) return cur;
  const u = await A.me(); const name = fullName || (u.user_metadata && u.user_metadata.full_name) || "";
  await call("/rest/v1/analysis_access", {method:"POST", headers:Object.assign(H(tok), {Prefer:"return=minimal"}), body:JSON.stringify({user_id:u.id, email:u.email, full_name:name})}).catch(e => { if (e.status !== 409) throw e; });
  return A.access(); };
A.tier = async () => { const tok = await A.token(); if (!tok) return null; return call("/rest/v1/rpc/analysis_tier", {method:"POST", headers:H(tok), body:"{}"}); };
A.uid = () => { const s = read(); if (!s || !s.access) return ""; try { return JSON.parse(atob(s.access.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).sub || ""; } catch(e){ return ""; } };
/* admin: requests and decisions (allowed by RLS only when analysis_is_admin()) */
A.adminList = async () => { const tok = await A.token(); return call("/rest/v1/analysis_access?select=user_id,email,full_name,status,full_access,free_runs_used,ai_calls,requested_at,decided_at&order=requested_at.desc", {headers:H(tok)}); };
A.adminSet = async (userId, patch) => { const tok = await A.token(); const me = A.uid();
  const body = Object.assign({}, patch); if (patch.status) { body.decided_at = new Date().toISOString(); body.decided_by = me; }
  await call("/rest/v1/analysis_access?user_id=eq." + encodeURIComponent(userId), {method:"PATCH", headers:Object.assign(H(tok), {Prefer:"return=minimal"}), body:JSON.stringify(body)}); };

/* emergency access code for TRUST staff — kept for this browser session only */
A.code = () => { try { return sessionStorage.getItem(CODE) || ""; } catch(e){ return ""; } };
A.setCode = v => { try { v ? sessionStorage.setItem(CODE, v) : sessionStorage.removeItem(CODE); } catch(e){} };
})();
