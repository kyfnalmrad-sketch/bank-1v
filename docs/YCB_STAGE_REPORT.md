# تقرير تنفيذ وتوثيق مرحلة شهادة YCB

## 1. الملخص التنفيذي

تم تطوير مسار شهادة **Yemen Commercial Bank (YCB)** على الفرع `1v-1` مع الحفاظ على فصل بياناته عن مساحة بنك الكريمي. شملت المرحلة تنظيم حقول الإدخال، ربط الحقول الاختيارية بنص الشهادة، تثبيت عمودي التوقيع، إضافة بيانات الرأس، تنسيق المبالغ، وإنتاج معاينة صورة وPDF. تم أيضًا توثيق الاختبارات والأوامر بحيث يمكن إعادة تنفيذ المسار عند إنشاء نموذج جديد.

النسخة المعتمدة تتضمن محاذاة موحّدة لبيانات المرجع والتاريخ في الجهة اليسرى، ومحاذاة موحّدة للتاريخ الهجري وعبارة `Customer since` في الجهة اليمنى، وجميعها على حدود مساحة المحتوى الداخلية للشهادة.

## 2. نطاق العمل

يقتصر هذا المسار على شهادة YCB الرسمية. لا يستخدم النموذج حقل `Momaiz No.`، ولا يستدعي قالب الكريمي، ولا يشارك Snapshot أو History مع مساحة الكريمي. تظل واجهة الكريمي ومساراتها مستقلة.

| المجال | النتيجة المنفذة |
|---|---|
| Customer Information | الاسم، Passport No.، الفرع، Customer since، وتاريخ الميلاد الاختياري |
| Account Information | نوع الحساب، رقم الحساب، العملة، والرصيد |
| Certificate Information | الرقم المرجعي الاختياري وتاريخ الإصدار |
| Authorization Information | Customer Service وBranch Manager كعمودين مستقلين |
| نص البيان | إدراج الجواز وتاريخ الميلاد فقط عند إدخال القيم |
| رأس الشهادة | Reference وDATE يساران، والتاريخ الهجري وCustomer since يمينًا |
| التنسيق المالي | فواصل الآلاف تلقائيًا لعملات YER وUSD وSAR |
| التوقيعات | عمودان ثابتان، مع بقاء العمود عند غياب الاسم |
| المعاينة | صورة PNG وPDF من صفحة واحدة |

## 3. مراحل التنفيذ

### المرحلة الأولى: تجهيز المستودع والفرع

تم استنساخ المستودع المرتبط، ثم التحقق من الفروع البعيدة. بعد تحديد فرع العمل الصحيح، تم استخدام `feature/commercial-bank-statement-202609` كأساس محلي، ثم إعادة تسمية الفروع لاحقًا إلى `1v` لمساحة العمل و`1v-1` لفرع التطوير.

الأوامر الأساسية كانت:

```bash
gh repo clone naderbander13-bot/bank-karimi-web-staging /home/ubuntu/bank-karimi-web-staging
cd /home/ubuntu/bank-karimi-web-staging
git fetch origin feature/commercial-bank-statement-202609
git checkout -B feature/commercial-bank-statement-202609 origin/feature/commercial-bank-statement-202609
```

بعد اعتماد أسماء الفروع:

```bash
git push origin origin/feature/arabic-dashboard-workspace-20260907:refs/heads/1v
git push origin origin/feature/commercial-bank-statement-202609:refs/heads/1v-1
gh api --method PATCH repos/naderbander13-bot/bank-karimi-web-staging -f default_branch=1v
git push origin --delete feature/arabic-dashboard-workspace-20260907 feature/commercial-bank-statement-202609
git branch -m feature/commercial-bank-statement-202609 1v-1
git branch --set-upstream-to=origin/1v-1 1v-1
git remote set-head origin -a
```

### المرحلة الثانية: فحص المشروع قبل التعديل

تم تثبيت الاعتماديات وتشغيل فحص TypeScript قبل تغيير الكود. ظهرت تحذيرات خاصة بمتغيرات التحليلات `VITE_ANALYTICS_ENDPOINT` و`VITE_ANALYTICS_WEBSITE_ID`، لكنها لا تمنع تشغيل التطبيق أو بناءه.

```bash
pnpm install --frozen-lockfile
pnpm check
```

تم تحديد الملفات المركزية التالية:

- `client/src/pages/Home.tsx`: حالة YCB، Snapshot، وواجهة الإدخال الرئيسية.
- `client/src/components/YcbCertificateWorkspace.tsx`: نموذج شهادة YCB ومسار الطباعة.
- `client/src/lib/ycbOfficialCertificateTemplate.ts`: قالب HTML/CSS للشهادة.
- `client/src/components/YcbCertificateWorkspace.test.ts`: اختبارات وضع البيانات داخل الشهادة.
- `client/src/pages/Home.ui.test.tsx`: اختبارات ظهور حقول YCB وفصلها عن الكريمي.

### المرحلة الثالثة: تنظيم الحقول

تم تثبيت الأقسام التالية داخل مسار YCB:

1. `Customer Information`.
2. `Account Information`.
3. `Certificate Information`.
4. `Authorization Information`.

تمت إضافة `Customer Service` و`Branch Manager` إلى واجهة إدخال YCB الرئيسية، وليس إلى بنك الكريمي. أضيف `Reference number` كحقل اختياري. كما صُححت تسمية الجواز إلى `Passport No.`.

### المرحلة الرابعة: ربط الحقول الاختيارية بالنص

تم استخدام placeholders داخل القالب ثم استبدالها من مولد HTML. عند ترك الحقل فارغًا، يتم حذف الجزء المرتبط به بالكامل.

| الحقل | موضعه عند الإدخال | سلوكه عند الفراغ |
|---|---|---|
| Passport No. | داخل جملة تعريف العميل | لا يظهر أي نص للجواز |
| Date of birth | داخل جملة تعريف العميل | لا يظهر أي نص لتاريخ الميلاد |
| Reference number | أعلى الشهادة | يختفي سطر المرجع كاملًا |
| Customer since | تحت التاريخ الهجري باللون الذهبي | يختفي السطر إذا لم توجد قيمة |
| Customer Service | عمود توقيع يساري | يبقى العمود ويظهر شرطة عند غياب الاسم |
| Branch Manager | عمود توقيع يميني | يبقى العمود ويظهر شرطة عند غياب الاسم |

### المرحلة الخامسة: تنسيق الرأس والمسافات

تم توحيد موضع بيانات الرأس على حدود مساحة المحتوى الداخلية بعرض `82mm`:

- `Reference` و`DATE`: محاذاة يسارية مع بداية المحتوى.
- التاريخ الهجري و`Customer since`: محاذاة يمينية مع نهاية المحتوى.
- `Customer since`: لون ذهبي، ويظهر أسفل التاريخ الهجري.
- عنوان `TO WHOM IT MAY CONCERN`: خط تحته بعرض النص.
- عمودا التوقيع: شبكة مرنة بعمودين، مع مسافة علوية مرنة.
- التنبيه الأحمر السفلي: يترك مساحة أمان تقارب `20mm` عن منطقة التوقيعات.

### المرحلة السادسة: التنسيق المالي

تمت إزالة العرض غير المنسق مثل `1250000 YER`. أصبح الرصيد يمر عبر `Intl.NumberFormat` بتنسيق إنجليزي مصرفي:

```text
1250000 YER  ->  1,250,000 YER
2500000 USD  ->  2,500,000 USD
```

يدعم التنسيق الحالي:

- `YER`: Yemeni Rials.
- `USD`: US Dollars.
- `SAR`: Saudi Riyals.

التنسيق يضع فواصل الآلاف ويحافظ على العملة المختارة، ولا يغير قيمة البيانات الأصلية.

### المرحلة السابعة: البيانات التجريبية والمعاينة

تم استخدام نموذج تجريبي قابل لإعادة الاستخدام:

```text
Customer Name: Ahmed Mohammed Al-Qahtani
Passport No.: P1234567
Date of Birth: 12 April 1988
Customer Since: 15/01/2020
Account Number: YCB-0045827319
Currency: YER
Balance: 1,250,000 YER
Reference: YCB-DEMO-2026-091
Customer Service: Sarah Abdullah Al-Maqtari
Branch Manager: Khaled Ali Al-Hadrami
```

تم إنشاء المعاينة عبر ملف HTML مستقل ثم تصديرها باستخدام Chromium:

```bash
pnpm --dir /home/ubuntu/bank-karimi-web-staging exec tsx /home/ubuntu/make_ycb_preview.ts
chromium --headless --no-sandbox --disable-gpu \
  --hide-scrollbars --window-size=1240,1754 \
  --screenshot=/home/ubuntu/ycb-certificate-demo-full.png \
  --print-to-pdf=/home/ubuntu/ycb-certificate-demo.pdf \
  http://localhost:4173/
```

النتيجة صفحة PDF واحدة، والصورة بدقة `1240 × 1754`.

## 4. الاختبارات والتحقق

تم تشغيل الأوامر التالية:

```bash
pnpm check
pnpm vitest run \
  client/src/components/YcbCertificateWorkspace.test.ts \
  client/src/pages/Home.ui.test.tsx
pnpm build
```

النتيجة الأخيرة:

| الفحص | النتيجة |
|---|---|
| TypeScript | ناجح |
| اختبارات مولد شهادة YCB | ناجح، بما في ذلك YER وUSD |
| اختبارات واجهة Home | ناجح |
| إجمالي الاختبارات في آخر تشغيل جزئي | 7 ناجحة |
| بناء الإنتاج | ناجح في التشغيل السابق |
| PDF | صفحة واحدة وسليم |

## 5. ملفات الإخراج

| الملف | الوصف |
|---|---|
| `/home/ubuntu/ycb-certificate-demo-full.png` | صورة المعاينة النهائية |
| `/home/ubuntu/ycb-certificate-demo.pdf` | ملف PDF النهائي |
| `/home/ubuntu/ycb-preview-root/index.html` | HTML مستقل للمعاينة التجريبية |

## 6. طريقة إعادة استخدام المسار لنموذج جديد

لإضافة نموذج جديد، يبدأ العمل من فرع مستقل ولا يتم تعديل قالب بنك آخر مباشرة. يتم أولًا تعريف نوع البيانات، ثم إضافة الحقول في واجهة الإدخال، ثم إضافة placeholders في القالب، ثم إنشاء اختبار للحالة الممتلئة والحالة الفارغة. بعد ذلك يتم تشغيل `pnpm check` والاختبارات والبناء، ثم إنشاء معاينة مستقلة ببيانات تجريبية قبل الدمج.

التسلسل المقترح هو:

```bash
git checkout 1v-1
git pull --ff-only origin 1v-1
pnpm install --frozen-lockfile
pnpm check
pnpm vitest run
pnpm build
pnpm dev
```

يجب عدم رفع التغيير قبل مراجعة صورة المعاينة وPDF. بعد الموافقة، يتم حفظ الحالة:

```bash
git status --short
git diff --check
git add client/src/components/YcbCertificateWorkspace.tsx \
  client/src/components/YcbCertificateWorkspace.test.ts \
  client/src/lib/ycbOfficialCertificateTemplate.ts \
  client/src/pages/Home.tsx \
  client/src/pages/Home.ui.test.tsx \
  docs/YCB_STAGE_REPORT.md
git commit -m "feat: finalize YCB certificate layout and formatting"
git push origin 1v-1
```

## 7. حالة الرفع

سيتم رفع هذه النسخة إلى `origin/1v-1` بعد إكمال الفحص النهائي. لا يتم رفع أي ملف معاينة تجريبي إلى المستودع؛ تبقى ملفات PNG وPDF في بيئة العمل للتنزيل والمراجعة.

## 8. المراجع

[1]: https://github.com/naderbander13-bot/bank-karimi-web-staging "Bank Karimi Web Staging repository"
