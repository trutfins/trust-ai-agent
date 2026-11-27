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
                alt="شاشة أوامر الإنتاج لمصنع، فيها نموذج أمر إنتاج جديد بخط الإنتاج والوحدات والتاريخ، مع شاشة إعدادات الضرائب.",
                a="استعرض خدمات المصانع", href="/small-factories"),
        en=dict(t="Production and cost management",
                d="Track production orders, and organise raw materials and manufacturing costs.",
                alt="Production orders screen for a manufacturer, with a new-order form for production line, planned units and date, plus a tax settings screen.",
                a="Factory and workshop services (in Arabic)", href="/small-factories", ar=True)),
    dict(
        ar=dict(t="إدارة الخدمات والفوترة",
                d="نظّم دليل الخدمات ووحدات تسعيرها، وتابع المبيعات والتحصيل.",
                alt="شاشة الأصناف والخدمات لمكتب خدمات مهنية، فيها نموذج صنف جديد وقائمة خدمات مثل الاستشارة بالساعة والتدقيق ومسك الدفاتر.",
                a="تعرّف على الأنظمة المحاسبية", href="/accounting-systems"),
        en=dict(t="Service management and billing",
                d="Organise your service catalogue and pricing units, and track sales and collections.",
                alt="Items and services screen for a professional services firm, with a new-item form and a service list such as hourly advisory, audit and bookkeeping.",
                a="Accounting systems (in Arabic)", href="/accounting-systems", ar=True)),
    dict(
        ar=dict(t="متاجر إلكترونية للجملة والمفرق",
                d="نماذج تعرض المنتجات حسب الفئة، مع واجهات للبيع بالتجزئة وطلبات الجملة.",
                alt="واجهتا متجرين إلكترونيين: متجر أدوات منزلية بفئات أواني الطهي وأدوات التحضير والتقديم، ومتجر أزياء وإكسسوارات.",
                a="ناقش مشروع متجرك", href="/contact?main=session"),
        en=dict(t="Online stores for wholesale and retail",
                d="Storefronts that show products by category, with views for retail shoppers and wholesale orders.",
                alt="Two online storefronts: a homeware store with cookware, prep tools and serveware categories, and a fashion and accessories store.",
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
            p="شاهد كيف تبدو أنظمة المحاسبة ونقاط البيع وإدارة الإنتاج والمتاجر الإلكترونية التي نجهّزها.",
            region="نماذج من أعمال ترست",
            cta="اطلب عرضاً لنشاطك", cta_href="/contact?main=session", slide="شريحة", of="من",
            prev="السابق", next="التالي", pause="إيقاف العرض", play="تشغيل العرض", arrow="←"),
    en=dict(kicker="Examples of our work", h="Examples of TRUST's work",
            p="See what the accounting, point-of-sale, production and online store systems we set up look like.",
            region="Examples of TRUST's work",
            cta="Request a quote for your business", cta_href="/en/contact?main=session", slide="Slide", of="of",
            prev="Previous", next="Next", pause="Pause slideshow", play="Play slideshow", arrow="→"),
)

CSS = '<style>\n.pf{padding:72px 0}\n.pf .sec-head{margin-bottom:28px}\n.pf-slides{display:grid;gap:28px 24px}\n.pf-slide{margin:0;min-width:0;display:flex;flex-direction:column}\n.pf-media{position:relative;border-radius:var(--r,14px);overflow:hidden;background:var(--navy,#0E2238);box-shadow:var(--shadow,0 10px 30px rgba(14,34,56,.07))}\n.pf-media img{display:block;width:100%;height:auto;aspect-ratio:1600/820}\n.pf-soon{position:absolute;right:7%;bottom:14%;display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;background:var(--gold,#C9A15A);color:var(--navy,#0E2238);font-weight:700;font-size:14px;line-height:1.4;box-shadow:0 6px 18px rgba(0,0,0,.25)}\n.pf-soon::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--navy,#0E2238)}\n.pf-cap{margin-top:14px;display:flex;flex-direction:column;gap:4px;flex:1}\n.pf-cap h3{font-size:18px}\n.pf-cap p{color:var(--ink-2,#5B6878);font-size:15.5px}\n.pf-cap a{font-weight:700;font-size:15.5px;text-underline-offset:5px;margin-top:auto;padding-top:6px}\n.pf-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:18px}\n.pf-ctl[hidden]{display:none}\n.pf-ctl button{appearance:none;font:inherit;font-size:15px;cursor:pointer;background:var(--white,#fff);color:var(--navy,#0E2238);padding:6px 16px;min-height:44px;border:1px solid #8BA0B2;border-radius:10px}\n.pf-ctl button:hover{border-color:var(--navy,#0E2238)}\n.pf-count{margin-inline-start:auto;color:var(--ink-2,#5B6878);font-size:15px}\n.pf-cta{margin-top:36px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}\n.pf-cta small{color:var(--ink-2,#5B6878);font-size:14px}\n@media (min-width:681px){.pf-slides{grid-template-columns:repeat(2,minmax(0,1fr))}.pf-slide[hidden]{display:flex}.pf-ctl{display:none}}\n@media (min-width:981px){.pf-slides{grid-template-columns:repeat(3,minmax(0,1fr))}}\n@media (max-width:680px){.pf{padding:48px 0}.pf-slide[hidden]{display:none}.pf-media img{aspect-ratio:760/890}.pf-soon{right:auto;left:50%;transform:translateX(-50%);bottom:2.5%;font-size:15px;padding:5px 14px}.pf-cap a{margin-top:2px}.pf-cta .btn{width:100%}}\n@media (max-width:680px) and (prefers-reduced-motion:no-preference){.pf-slide.pf-in{animation:pf-fade .45s ease}@keyframes pf-fade{from{opacity:.25}to{opacity:1}}}\n</style>'

JS = "<script>\n(function () {\n  var root = document.getElementById('portfolio');\n  if (!root || !window.matchMedia) return;\n  var slides = [].slice.call(root.querySelectorAll('.pf-slide'));\n  var ctl = root.querySelector('.pf-ctl');\n  var count = ctl.querySelector('.pf-count');\n  var toggle = ctl.querySelector('.pf-toggle');\n  var stage = root.querySelector('.pf-stage');\n  var T = { play: toggle.getAttribute('data-play'), pause: toggle.getAttribute('data-pause') };\n  var small = matchMedia('(max-width: 680px)');\n  var mq = matchMedia('(prefers-reduced-motion: reduce)');\n  var i = 0, playing = !mq.matches, timer = null, hovered = false, focused = false, inView = false;\n  function warm(n) { var im = slides[n].querySelector('img'); if (im) im.loading = 'eager'; }\n  function stop() { clearInterval(timer); timer = null; }\n  function render(animate) {\n    if (!small.matches) {\n      slides.forEach(function (s) { s.hidden = false; s.classList.remove('pf-in'); s.removeAttribute('aria-roledescription'); });\n      stage.removeAttribute('aria-roledescription'); ctl.hidden = true; stop(); return;\n    }\n    stage.setAttribute('aria-roledescription', 'carousel'); ctl.hidden = false;\n    slides.forEach(function (s, n) { s.hidden = n !== i; s.setAttribute('aria-roledescription', 'slide'); s.classList.toggle('pf-in', animate && n === i); });\n    count.textContent = (i + 1) + ' / ' + slides.length;\n    count.setAttribute('aria-live', playing ? 'off' : 'polite');\n    toggle.textContent = playing ? T.pause : T.play;\n    toggle.setAttribute('aria-pressed', playing ? 'false' : 'true');\n    if (inView) warm((i + 1) % slides.length);\n  }\n  function restart() {\n    stop();\n    if (small.matches && playing && inView && !hovered && !focused && !document.hidden) timer = setInterval(function () { move(1); }, 6500);\n  }\n  function move(step) { i = (i + step + slides.length) % slides.length; render(true); }\n  [].forEach.call(ctl.querySelectorAll('[data-step]'), function (b) {\n    b.addEventListener('click', function () { playing = false; move(Number(b.getAttribute('data-step'))); restart(); });\n  });\n  toggle.addEventListener('click', function () { playing = !playing; render(false); restart(); });\n  stage.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') { hovered = true; restart(); } });\n  stage.addEventListener('pointerleave', function () { hovered = false; restart(); });\n  stage.addEventListener('focusin', function () { focused = true; restart(); });\n  stage.addEventListener('focusout', function (e) { focused = stage.contains(e.relatedTarget); restart(); });\n  function onChange(e, fn) { if (e.addEventListener) e.addEventListener('change', fn); else if (e.addListener) e.addListener(fn); }\n  onChange(mq, function (e) { if (e.matches) { playing = false; render(false); restart(); } });\n  onChange(small, function () { render(false); restart(); });\n  document.addEventListener('visibilitychange', restart);\n  if ('IntersectionObserver' in window) {\n    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView && small.matches) warm((i + 1) % slides.length); restart(); }, { rootMargin: '200px 0px' }).observe(stage);\n  } else { inView = true; }\n  render(false);\n  restart();\n})();\n</script>"


def section(lang):
    u = UI[lang]
    e = html.escape
    out = [f'<section class="sec pf" id="portfolio" aria-labelledby="pf-h">{CSS}',
           '<div class="wrap">',
           f'<div class="sec-head"><span class="kicker">{e(u["kicker"])}</span><h2 id="pf-h">{e(u["h"])}</h2><p>{e(u["p"])}</p></div>',
           f'<div class="pf-stage" role="region" aria-label="{e(u["region"])}">',
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
            f'<figure class="pf-slide" role="group" aria-label="{u["slide"]} {n} {u["of"]} {n_all}">'
            f'<div class="pf-media"><picture>'
            f'<source media="(max-width:680px)" srcset="{IMG.format(n=n, k="m")}" width="760" height="890">'
            f'<img src="{IMG.format(n=n, k="d")}" width="1600" height="820" loading="lazy" decoding="async" alt="{e(c["alt"])}">'
            f'</picture>{soon}</div>'
            f'<figcaption class="pf-cap"><h3>{title}</h3><p>{e(c["d"])}</p>{link}</figcaption></figure>')
    out.append('</div>')
    out.append(f'<div class="pf-ctl" hidden><button type="button" data-step="-1">{e(u["prev"])}</button>'
               f'<button type="button" data-step="1">{e(u["next"])}</button>'
               f'<button type="button" class="pf-toggle" data-play="{e(u["play"])}" data-pause="{e(u["pause"])}">{e(u["pause"])}</button>'
               f'<span class="pf-count"></span></div>')
    out.append('</div>')
    out.append(f'<div class="pf-cta"><a class="btn btn-gold" href="{e(u["cta_href"])}" data-ev="portfolio_cta" data-main="portfolio">{e(u["cta"])}</a></div>')
    out.append('</div>')
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
