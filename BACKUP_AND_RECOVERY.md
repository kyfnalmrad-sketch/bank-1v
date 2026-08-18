# النسخ الاحتياطي والاسترجاع — قاعدة Staging

## الهدف والنطاق

تضيف هذه الخطة نسخة احتياطية **منطقية ومشفرة** لقاعدة Render Postgres الخاصة ببيئة Staging. تعمل المهمة تلقائيًا مرتين أسبوعيًا، صباح الاثنين والخميس عند 01:17 بتوقيت UTC، ويمكن تشغيلها يدويًا من صفحة **Actions** في GitHub عند الحاجة. تحتفظ الخطة بأحدث ملف مشفر فقط ضمن إصدار خاص في المستودع الخاص؛ ولا تُرفع أي نسخة SQL أو dump غير مشفرة إلى GitHub.

| إعداد | القيمة |
|---|---|
| مصدر البيانات | قاعدة Render Postgres الخاصة بـStaging فقط |
| صيغة النسخة | `pg_dump` بصيغة PostgreSQL custom |
| الحماية | AES-256-CBC مع PBKDF2 و600,000 تكرار |
| الاحتفاظ | أحدث نسخة مشفرة فقط |
| مكان الحفظ | إصدار خاص باسم `staging-db-backup` في GitHub الخاص |
| الجدولة | الاثنين والخميس، 01:17 UTC، مع تشغيل يدوي متاح |

## التهيئة المطلوبة مرة واحدة

من صفحة المستودع الخاص على GitHub افتح **Settings → Secrets and variables → Actions** ثم أضف السر التالي. لا تضع قيمته داخل أي ملف أو رسالة أو سجل تنفيذ.

| اسم السر | الغرض | مصدره |
|---|---|---|
| `BACKUP_ENCRYPTION_PASSPHRASE` | تشفير النسخة وفكها عند الاسترجاع | أنشئ عبارة طويلة وفريدة في مدير كلمات مرور واحفظها لدى المخول بالاسترجاع |

أما رابط قاعدة Render `RENDER_POSTGRES_URL` فيُدار كسر مستقل في GitHub ولا يظهر في المستودع أو السجلات. بعد إضافة عبارة التشفير، شغّل المسار **Encrypted Render Postgres Backup** يدويًا مرة واحدة وتحقق من وجود ملفين في إصدار `staging-db-backup`: ملف `.dump.enc` وملف بصمة `.sha256`.

## الاسترجاع في قاعدة فارغة فقط

لا تسترجع هذه النسخة إلى قاعدة تحتوي على بيانات مهمة. أنشئ قاعدة Postgres جديدة وفارغة، وحمّل الملفين من الإصدار الخاص، ثم افحص البصمة وفك التشفير. استبدل المتغيرات بالقيم الفعلية محليًا فقط.

```bash
sha256sum -c render-postgres-staging-latest.dump.enc.sha256
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in render-postgres-staging-latest.dump.enc \
  -out render-postgres-staging-restore.dump \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE
pg_restore --dbname="$TARGET_DATABASE_URL" --verbose --clean --if-exists --no-owner --no-privileges render-postgres-staging-restore.dump
rm -f render-postgres-staging-restore.dump
```

> تعامل مع العبارة والملفات المفكوكة على أنها بيانات حساسة. لا ترسل العبارة عبر البريد أو المحادثات، ولا تحفظ النسخة المفكوكة في المجلدات المشتركة.

## الحدود المعروفة

قاعدة Render المجانية لا توفر نسخًا احتياطية مُدارة أو استرجاعًا زمنيًا، وتنتهي بعد 30 يومًا من إنشائها؛ لذلك لا تغني هذه الخطة عن فحص نجاح النسخة يدويًا أو إنشاء قاعدة جديدة قبل انتهاء المهلة. كما أن نسخة Staging هذه ليست بديلًا عن تصميم استمرارية أعمال أو متطلبات احتفاظ قانونية لبيئة تشغيل فعلية.

## مراجع

[1] [Render — Deploy for Free](https://render.com/docs/free)  
[2] [Render — PostgreSQL Recovery and Backups](https://render.com/docs/postgresql-backups)
