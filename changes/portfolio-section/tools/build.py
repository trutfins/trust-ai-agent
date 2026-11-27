"""Build the portfolio section for the Arabic and English homepages.

Usage: python3 -I build.py <base_ar> <base_en> <out_ar> <out_en>
Inserts the section right after the services section (before #smart-cfo).
"""
import sys, html

IMG = "/assets/img/portfolio/pf-{n}-{k}.webp"

SLIDES = [
    dict(
        ar=dict(t="نظام محاسبة للمحلات التجارية",
                d="تابع مبيعات اليوم وأرصدة الصندوق والمخزون والذمم من لوحة واحدة.",
                alt="لوحة تحكم محاسبية تعرض مبيعات اليوم، والنقد في الصندوق، والبنك، وذمم العملاء والموردين، والأصناف التي وصلت حد إعادة الطلب.",
                a="استعرض خدمات المحلات", href="/retail-shops"),
        en=dict(t="Accounting system for retail shops",
                d="Track today's sales, cash on hand, stock, receivables and payables from one dashboard.",
                alt="Accounting dashboard showing today's sales, cash on hand, bank balance, customer and supplier balances, and items at their reorder level.",
                a="Retail shop services (in Arabic)", href="/retail-shops", ar=True)),
    dict(
        ar=dict(t="نقطة بيع لمحل جوالات",
                d="ابحث عن المنتج بالاسم أو الباركود، وأصدر الفاتورة بطريقة الدفع المناسبة.",
                alt="شاشة نقطة بيع فيها بحث بالاسم أو الباركود، وتصنيفات للمنتجات، وفاتورة حالية بخيارات الدفع نقداً أو بالبطاقة أو بالآجل.",
                a="تعرّف على الأنظمة المحاسبية", href="/accounting-systems"),
        en=dict(t="Point of sale for a mobile phone shop",
                d="Find products by name or barcode, and issue the invoice with the right payment method.",
                alt="Point-of-sale screen with search by name or barcode, product categories, and a current invoice with cash, card or credit payment options.",
                a="Accounting systems (in Arabic)", href="/accounting-systems", ar=True)),
    dict(
        ar=dict(t="إدارة الإنتاج والتكاليف",
                d="تابع أوامر الإنتاج، ونظّم المواد الخام وتكاليف التصنيع.",
                alt="شاشة أوامر الإنتاج لشركة تجريبية، فيها نموذج أمر إنتاج جديد بخط الإنتاج والوحدات والتاريخ، مع شاشة إعدادات الضرائب.",
                a="استعرض خدمات المصانع", href="/small-factories"),
        en=dict(t="Production and cost management",
                d="Track production orders, and organise raw materials and manufacturing costs.",
                alt="Production orders screen for a demo company, with a new-order form for production line, planned units and date, plus a tax settings screen.",
                a="Factory and workshop services (in Arabic)", href="/small-factories", ar=True)),
    dict(
        ar=dict(t="إدارة الخدمات والفوترة",
                d="نظّم دليل الخدمات ووحدات تسعيرها، وتابع المبيعات والتحصيل.",
                alt="شاشة الأصناف والخدمات لمكتب خدمات تجريبي، فيها نموذج صنف جديد وقائمة خدمات مثل الاستشارة بالساعة والتدقيق ومسك الدفاتر.",
                a="تعرّف على الأنظمة المحاسبية", href="/accounting-systems"),
        en=dict(t="Service management and billing",
                d="Organise your service catalogue and pricing units, and track sales and collections.",
                alt="Items and services screen for a demo service firm, with a new-item form and a service list such as hourly advisory, audit and bookkeeping.",
                a="Accounting systems (in Arabic)", href="/accounting-systems", ar=True)),
    dict(
        ar=dict(t="متاجر إلكترونية للجملة والمفرق",
                d="نماذج تعرض المنتجات حسب الفئة، مع واجهات للبيع بالتجزئة وطلبات الجملة.",
                alt="واجهتا متجرين تجريبيين: متجر أدوات منزلية بفئات أواني الطهي وأدوات التحضير والتقديم، ومتجر أزياء وإكسسوارات.",
                a="ناقش مشروع متجرك", href="/contact?main=session"),
        en=dict(t="Online stores for wholesale and retail",
                d="Storefronts that show products by category, with views for retail shoppers and wholesale orders.",
                alt="Two demo storefronts: a homeware store with cookware, prep tools and serveware categories, and a fashion and accessories store.",
                a="Discuss your store project", href="/en/contact?main=session")),
    dict(
        soon=True,
        ar=dict(t="منصة متاجر إلكترونية للتجار في فلسطين",
                d="اختر قالباً يناسب نشاطك، وأضف منتجاتك، واستلم الدفع عند الاستلام بالشيكل.",
                alt="لقطتان من منصة متاجر قيد التطوير: الصفحة الرئيسية بعنوان «افتح متجرك الإلكتروني وابدأ البيع في فلسطين»، وقوالب متاجر لأنشطة مختلفة.",
                soon="قريباً"),
        en=dict(t="An online store platform for merchants in Palestine",
                d="Choose a template that fits your business, add your products, and collect cash on delivery in shekels.",
                alt="Two screenshots of a store platform in development: its home page, headed “Open your online store and start selling in Palestine”, and store templates for different kinds of business.",
                soon="Coming soon")),
]

UI = dict(
    ar=dict(kicker="نماذج من أعمالنا", h="نماذج من أعمال ترست",
            p="شاهد كيف تبدو أنظمة المحاسبة ونقاط البيع وإدارة الإنتاج والمتاجر الإلكترونية التي نجهّزها. الشاشات معروضة ببيانات تجريبية.",
            region="نماذج من أعمال ترست، عرض شرائح", slide="شريحة", of="من",
            prev="السابق", next="التالي", pause="إيقاف العرض", play="تشغيل العرض", arrow="←"),
    en=dict(kicker="Examples of our work", h="Examples of TRUST's work",
            p="See what the accounting, point-of-sale, production and online store systems we set up look like. Screens are shown with demo data.",
            region="Examples of TRUST's work, slideshow", slide="Slide", of="of",
            prev="Previous", next="Next", pause="Pause slideshow", play="Play slideshow", arrow="→"),
)

CSS = """<style>
.pf{padding:72px 0}
.pf .sec-head{margin-bottom:28px}
.pf-slides{display:grid}
.pf-slide{margin:0;min-width:0}
.pf-slide[hidden]{display:none}
.pf-media{position:relative;border-radius:var(--r-lg,20px);overflow:hidden;background:var(--navy,#0E2238);box-shadow:var(--shadow,0 10px 30px rgba(14,34,56,.07))}
.pf-media img{display:block;width:100%;height:auto;aspect-ratio:1600/820}
.pf-soon{position:absolute;right:7%;bottom:16%;display:inline-flex;align-items:center;gap:8px;padding:8px 20px;border-radius:99px;background:var(--gold,#C9A15A);color:var(--navy,#0E2238);font-weight:700;font-size:clamp(16px,2vw,24px);line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.pf-soon::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--navy,#0E2238)}
.pf-cap{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 20px;margin-top:14px}
.pf-cap h3{font-size:20px}
.pf-cap p{color:var(--ink-2,#5B6878);font-size:16px;flex-basis:100%;order:3}
.pf-cap a{font-weight:700;text-underline-offset:5px;white-space:nowrap}
.pf-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:18px}
.pf-ctl[hidden]{display:none}
.pf-ctl button{appearance:none;font:inherit;font-size:15px;cursor:pointer;background:var(--white,#fff);color:var(--navy,#0E2238);padding:6px 16px;min-height:44px;border:1px solid #8BA0B2;border-radius:10px}
.pf-ctl button:hover{border-color:var(--navy,#0E2238)}
.pf-count{margin-inline-start:auto;color:var(--ink-2,#5B6878);font-size:15px}
@media (prefers-reduced-motion:no-preference){.pf-slide.pf-in{animation:pf-fade .45s ease}@keyframes pf-fade{from{opacity:.25}to{opacity:1}}}
@media (max-width:680px){.pf{padding:48px 0}.pf-media{border-radius:14px}.pf-media img{aspect-ratio:760/890}.pf-soon{right:auto;left:50%;transform:translateX(-50%);bottom:2.5%;top:auto;font-size:15px;padding:5px 14px}.pf-cap h3{font-size:18px}.pf-cap p{font-size:15px}.pf-cap a{white-space:normal}}
</style>"""

JS = """<script>
(function () {
  var root = document.getElementById('portfolio');
  if (!root) return;
  var slides = [].slice.call(root.querySelectorAll('.pf-slide'));
  var ctl = root.querySelector('.pf-ctl');
  var count = ctl.querySelector('.pf-count');
  var toggle = ctl.querySelector('.pf-toggle');
  var T = { play: toggle.getAttribute('data-play'), pause: toggle.getAttribute('data-pause') };
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var i = 0, playing = !mq.matches, timer = null, hovered = false, focused = false, inView = false;
  function warm(n) { var im = slides[n].querySelector('img'); if (im) im.loading = 'eager'; }
  function render(animate) {
    slides.forEach(function (s, n) { s.hidden = n !== i; s.classList.toggle('pf-in', animate && n === i); });
    count.textContent = (i + 1) + ' / ' + slides.length;
    count.setAttribute('aria-live', playing ? 'off' : 'polite');
    toggle.textContent = playing ? T.pause : T.play;
    toggle.setAttribute('aria-pressed', playing ? 'false' : 'true');
    if (inView) warm((i + 1) % slides.length);
  }
  function stop() { clearInterval(timer); timer = null; }
  function restart() {
    stop();
    if (playing && inView && !hovered && !focused && !document.hidden) timer = setInterval(function () { move(1); }, 6500);
  }
  function move(step) { i = (i + step + slides.length) % slides.length; render(true); }
  [].forEach.call(ctl.querySelectorAll('[data-step]'), function (b) {
    b.addEventListener('click', function () { playing = false; move(Number(b.getAttribute('data-step'))); restart(); });
  });
  toggle.addEventListener('click', function () { playing = !playing; render(false); restart(); });
  root.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') { hovered = true; restart(); } });
  root.addEventListener('pointerleave', function () { hovered = false; restart(); });
  root.addEventListener('focusin', function () { focused = true; restart(); });
  root.addEventListener('focusout', function (e) { focused = root.contains(e.relatedTarget); restart(); });
  if (mq.addEventListener) mq.addEventListener('change', function (e) { if (e.matches) { playing = false; render(false); restart(); } });
  document.addEventListener('visibilitychange', restart);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) warm((i + 1) % slides.length); restart(); }, { rootMargin: '200px 0px' }).observe(root);
  } else { inView = true; }
  ctl.hidden = false;
  render(false);
  restart();
})();
</script>"""


def section(lang):
    u = UI[lang]
    e = html.escape
    out = [f'<section class="sec pf" id="portfolio" aria-labelledby="pf-h">{CSS}',
           '<div class="wrap">',
           f'<div class="sec-head"><span class="kicker">{e(u["kicker"])}</span><h2 id="pf-h">{e(u["h"])}</h2><p>{e(u["p"])}</p></div>',
           f'<div class="pf-stage" role="region" aria-roledescription="carousel" aria-label="{e(u["region"])}">',
           '<div class="pf-slides">']
    n_all = len(SLIDES)
    for n, s in enumerate(SLIDES, 1):
        c = s[lang]
        soon = f'<span class="pf-soon">{e(c["soon"])}</span>' if s.get("soon") else ""
        if c.get("href"):
            extra = ' class="ar-link" hreflang="ar"' if c.get("ar") else ""
            link = f'<a href="{e(c["href"])}"{extra} data-ev="portfolio_click" data-main="portfolio-{n}">{e(c["a"])} {u["arrow"]}</a>'
        else:
            link = ""
        title = e(c["t"]) + (f' <span class="sr-only">({e(c["soon"])})</span>' if s.get("soon") else "")
        out.append(
            f'<figure class="pf-slide" role="group" aria-roledescription="slide" aria-label="{u["slide"]} {n} {u["of"]} {n_all}">'
            f'<div class="pf-media"><picture>'
            f'<source media="(max-width:680px)" srcset="{IMG.format(n=n, k="m")}" width="760" height="890">'
            f'<img src="{IMG.format(n=n, k="d")}" width="1600" height="820" loading="lazy" decoding="async" alt="{e(c["alt"])}">'
            f'</picture>{soon}</div>'
            f'<figcaption class="pf-cap"><h3>{title}</h3>{link}<p>{e(c["d"])}</p></figcaption></figure>')
    out.append('</div>')
    out.append(f'<div class="pf-ctl" hidden><button type="button" data-step="-1">{e(u["prev"])}</button>'
               f'<button type="button" data-step="1">{e(u["next"])}</button>'
               f'<button type="button" class="pf-toggle" data-play="{e(u["play"])}" data-pause="{e(u["pause"])}">{e(u["pause"])}</button>'
               f'<span class="pf-count"></span></div>')
    out.append('</div></div>')
    out.append(JS)
    out.append('</section>')
    return "".join(out)


ANCHOR = '<section class="sec scfo" id="smart-cfo"'


def inject(src, dst, lang):
    s = open(src, encoding="utf-8").read()
    assert s.count(ANCHOR) == 1, (src, s.count(ANCHOR))
    assert 'id="portfolio"' not in s
    s = s.replace(ANCHOR, section(lang) + ANCHOR, 1)
    open(dst, "w", encoding="utf-8").write(s)


if __name__ == "__main__":
    a, b, c, d = sys.argv[1:5]
    inject(a, c, "ar")
    inject(b, d, "en")
    print("ok")
