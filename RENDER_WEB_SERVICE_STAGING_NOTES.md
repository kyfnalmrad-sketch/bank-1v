# ملاحظات إعداد خدمة Render Web Staging

تم اختيار المستودع الخاص `naderbander13-bot/bank-karimi-web-staging` ضمن مشروع Render الحالي وفي منطقة **Ohio (US East)**، بحيث تكون الخدمة وقاعدة Postgres المجانية في المنطقة نفسها. يعتمد التشغيل Node.js بفرع `main`، وأوامر Render المقترحة هي `pnpm install --frozen-lockfile; pnpm run build` للبناء و`pnpm run start` للتشغيل.

الخطة المختارة هي **Free** بسعة 512MB RAM و0.1 CPU وبكلفة $0 شهريًا. تذكر الصفحة أن مثيلات Free تتوقف بعد فترة خمول ولا تدعم SSH أو أقراصًا مستمرة. سيضاف المتغير السري `RENDER_POSTGRES_URL` داخل Render فقط قبل النشر، ولن يحفظ في GitHub أو الواجهة.

## نتيجة أول نشر

نجح أول نشر في Render في 18 أغسطس 2026، ورابط المراجعة الحالي هو: `https://bank-karimi-web-staging.onrender.com`.

أظهر سجل البداية تحذيرًا متعلقًا بـ`OAUTH_SERVER_URL` غير المعرّف في Render. الخادم استمر في التشغيل وأصبحت الخدمة Live، لكن تسجيل الدخول المبني على OAuth ليس ضمن نطاق النسخة الأولى حتى يتم نقل متغيرات OAuth النظامية أو إزالة الاعتماد عليها من مسار Staging. كما ظهرت تحذيرات بناء تخص تحليلات الواجهة وحجم حزمة JavaScript، ولم تمنع النشر.
