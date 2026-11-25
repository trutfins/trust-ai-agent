# لقطة الإنتاج — 2026-11-25 نحو 23:30 بتوقيت UTC

نسخة قراءة فقط لما يخدمه الإنتاج فعلًا، لتكون مرجعًا قبل أي تطوير. لا تُعدَّل هذه الملفات.
`MANIFEST.sha256` يحفظ بصمة كل ملف.

## ما نُسخ

| المجلد | المصدر | الطريقة |
| --- | --- | --- |
| `site/` | https://trustfins.org (Pages: trustfins-site) | زحف كامل من الصفحة الرئيسية وكل روابط sitemap.xml (28 رابطًا) مع CSS وJS والخطوط والصور |
| `tools/analysis/` | https://analysis.trustfins.org | الصفحة الرئيسية (تطبيق في ملف واحد) |
| `tools/cashflow/` | https://cashflow.trustfins.org | index.html وكل ملفات css/js المرتبطة |
| `tools/invoices/` | https://invoices.trustfins.org | الواجهة كما يخدمها العامل |
| `workers/trust-financial-agent/` | ai.trustfins.org و /admin | admin.html وindex.html من الموقع، وworker.js من Cloudflare (النسخة 9) |
| `workers/trust-invoices/index.mjs` | Cloudflare | نقطة الدخول فقط |
| `workers/trust-nav/worker.js` | Cloudflare (النسخة 33) | كامل |

## ما قد يكون ناقصًا أو مختلفًا عن ملفاتك المحلية

- **صفحات لا يصلها أي رابط:** الزحف يلتقط ما هو مرتبط فقط. صفحة يتيمة أو ملف تنزيل غير مرتبط لن يظهر هنا.
- **`_headers`:** لا يُقرأ من الخارج. أُرفق آخر نسخة من ملفاتك (`site/_headers.from-upload-2026-11-06`)، لكنها **لا تطابق الإنتاج بالكامل**: الإنتاج يعيد `/login` بـ `no-cache` ودون `X-Robots-Tag`، بينما الملف يحوي 10 قواعد والإنتاج 8. راجعه قبل أي نشر.
- **`_redirects`:** لا يوجد في الإنتاج (آخر نشر: لا قواعد تحويل).
- **تعديلات Cloudflare على HTML:** إخفاء البريد الإلكتروني (`/cdn-cgi/l/email-protection`) يغيّر روابط البريد ويضيف سكربت. هذه الفروق ليست من كودك.
- **أسماء الملفات:** حُفظت الصفحات بامتداد `.html` (مثل `smart-cfo.html`)، وهذا ما يفترضه Pages للروابط النظيفة. صفحة `/en` محفوظة باسم `en.html`، وقد تكون عندك `en/index.html`.
- **ملفات عامل invoices الخلفية** (`backend.js` و `accounting.js` و `assets.js`) و **trust-meta-agent** و **trust-ai** و **trust-login-preview:** لم تُنسخ هنا، وهي محفوظة في سجل نسخ Cloudflare لكل عامل.
- **المستودع الأصلي `index.ts`** (وكيل Durable Object) لم يعد هو المنشور على ai.trustfins.org. العامل المنشور الآن يخدم صفحتين ثابتتين فقط.

## إضافة 2026-11-26: مطابقة ملفاتك المحلية (17 ملفًا مضغوطًا)

قورن كل ملف في ملفاتك بنظيره هنا بعد إزالة تعديلات Cloudflare على البريد. **الإنتاج هو الأحدث في كل الحالات**، ولا يوجد ملف محلي أحدث منه:
- الموقع العربي والإنجليزي: كل النسخ (A, A-about-update, trustfins, trustfins-staging, B, B-about-update) تفتقد صفحتي invoice-journal وتعديلات لاحقة على 27–30 صفحة.
- analysis: أقرب نسخة v7، والإنتاج = v7 + رابط العودة للموقع + سكربت الإنجليزية + تنسيق شاشة الدخول.
- cashflow: كل النسخ تختلف في 7 ملفات عن الإنتاج.

ملفات أُضيفت مباشرة من الإنتاج لأنها غير مرتبطة بروابط: 404.html، admin.html، consultation-success.html، og-image.png، sitemap.xml، en/assets/analysis-en.js، tools/cashflow/assets/promo/*.webp.

موجود في ملفاتك فقط وغير منشور: MANIFEST-fonts.json، README-FONTS.txt (ملفات توثيق خطوط)، وen/index.html (الإنتاج يستخدم en.html). لم تُضمَّن.
