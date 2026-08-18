# تحليل ملفات Excel المرفقة

**المصدر:** خمسة ملفات Excel رفعها المستخدم في 18 أغسطس 2026.  
**الاستخدام:** مرجع لاختبار الاستيراد الذكي في Web Staging؛ لا تُنسخ بيانات الملف إلى واجهة عامة أو إلى قاعدة Staging تلقائيًا.

| الملف | الورقة الرئيسية | صف العناوين | ترتيب الأعمدة الفعلي | ملاحظة |
|---|---:|---:|---|---|
| `trainingantledgeryeenibeneficiaries.xlsx` | Training Ledger | 8 | Date, Particular, Reference No., Debit, Credit, Balance | يتضمن رصيدًا جاريًا |
| `trainingantledgeryeenibZZciaries.xlsx` | Training Ledger | 8 | Date, Particular, Reference No., Debit, Credit, Balance | بعض أعمدة الرصيد فارغة في الصفوف |
| `trainingantledgeryeenineficiaries.xlsx` | Training Ledger | 8 | Date, Particular, Reference No., Debit, Credit, Balance | صفوف المقدمة فارغة أو مختصرة |
| `training_account_ledger(7).xlsx` | Training Ledger | 8 | No., Date, Particular, Debit, Credit, Balance | يحتوي عمود ترتيب إضافي قبل التاريخ |
| `training_ant_ledger_yeeni_beneficiaries.xlsx` | Training Ledger | 8 | No., Date, Particular, Debit, Credit, Balance | يحتوي عمود ترتيب إضافي قبل التاريخ |

## قاعدة الاستدلال المعتمدة

تتعرف الخوارزمية على `Particular` بوصفه **الوصف**، وعلى `Reference No.` بوصفه **مرجع Excel الخارجي**. كما تدعم الحالة التي يقع فيها التاريخ في العمود الثاني بسبب عمود `No.` الإضافي. عند اختلاف الاسم، تستدل من عينة الصفوف التالية لصف محتمل للعناوين: قيمة تاريخ Excel أو تاريخ نصي، نص وصفي، مرجع أبجدي رقمي، ثم أعمدة رقمية للمدين والدائن والرصيد.

> لا يُنشئ النظام أعمدة افتراضية مثل One أو Two أو Three، ولا يقبل صف مقدمة منفردًا على أنه صف عناوين. وفي حال تعادل صفين صالحين بالدرجة نفسها، يرفض الاستيراد بدل اختيار صف عشوائي.

## الأوصاف الملحوظة

تعرض الملفات أنماطًا مثل `Incoming: Name` و`Personal: Name` و`Family: Name` مع عمليات نقدية مثل `ATM withdrawal` و`Cash withdrawal`. تظل الصياغة الموجودة في Excel كما هي عند الاستيراد، ويمكن للموظف اعتماد اقتراح منظم يدويًا للحركة المؤهلة فقط. الأوصاف غير المناسبة أو غير الواضحة لا تُستبدل تلقائيًا.
