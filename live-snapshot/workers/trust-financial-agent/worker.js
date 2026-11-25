import HTML from './index.html';
import ADMIN from './admin.html';
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://jbeiipdxcyzdqarxzbyo.supabase.co wss://jbeiipdxcyzdqarxzbyo.supabase.co; img-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
export default {
  async fetch(req) {
    const u = new URL(req.url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    if (u.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { headers: { 'content-type': 'text/plain' } });
    if (u.pathname === '/admin' || u.pathname === '/admin/') return new Response(ADMIN, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'x-robots-tag': 'noindex, nofollow', 'strict-transport-security': 'max-age=31536000', 'content-security-policy': CSP } });
    if (u.pathname !== '/' && u.pathname !== '/index.html') return Response.redirect(u.origin + '/' + u.search + u.hash, 302);
    return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'DENY', 'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'strict-transport-security': 'max-age=31536000', 'content-security-policy': CSP } });
  }
};
