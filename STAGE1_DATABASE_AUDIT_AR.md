# تقرير المرحلة الأولى — فحص قاعدة البيانات

## النتيجة
- مشروع Supabase الجديد: `bank-good-shared`
- Project Ref: `zblwjkyuoecmcldzbzyv`
- الحالة: `ACTIVE_HEALTHY`
- المنطقة: `us-east-2`
- المشروع فارغ وقت الفحص، ولم تُنشأ جداول أو بيانات.

## قواعد Supabase القديمة
لم يتم تعديلها:
- `kficlejaizpjxrkrxifn`: غير نشط ومخططه يخص منصة تعليمية.
- `wnqcenwgvrfvcxclcdkl`: نشط لكنه يخص مشروع `thaqib-platform`.

## قاعدة Render الحالية
- الاسم: `bank-1v-db`
- الحالة: `available`
- تاريخ الانتهاء الظاهر: `2026-10-16T23:31:35Z`
- الجداول الموجودة: 9 جداول `staging_*`.
- البيانات الحالية: 3 `staging_snapshots` و8 `staging_statement_history`، ولا توجد سجلات profiles أو statements أو transactions أو imports.
- لم يتم تنفيذ أي تعديل أو حذف أو نقل بيانات.

## مخاطر الفحص
- مخطط Drizzle الأساسي في `bankv1` يستخدم MySQL للمستخدمين، بينما بيانات Staging الحالية PostgreSQL؛ سيُعتمد PostgreSQL في Supabase مع تصميم جديد واضح.
- مشروع `good` يعتمد حاليًا على localStorage/IndexedDB ولا توجد له قاعدة Render.

## الاختبارات المعتمدة لاحقًا
1. اختبار اتصال كل تطبيق بقاعدة Supabase وظهور رسالة الحالة.
2. اختبار حفظ/قراءة سجل في المسار الصحيح.
3. اختبار عزل المسارات والصلاحيات وRLS.
4. اختبار مطابقة السجلات والعلاقات بعد النقل.
5. اختبار النسخ الاحتياطي والاستعادة.

لا تشمل الخطة اختبارات الطباعة أو PDF أو التصميم.
