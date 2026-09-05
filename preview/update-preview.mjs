import fs from 'node:fs';
const path = '/home/ubuntu/bank-karimi-web-staging/preview/password-login.html';
let html = fs.readFileSync(path, 'utf8');
html = html.replace('أدخل بيانات حسابك للوصول إلى لوحة تجهيز كشوف الحسابات.', 'أدخل كلمة المرور للوصول إلى لوحة تجهيز كشوف الحسابات.');
html = html.replace('<div class="field"><label>اسم المستخدم <span>مطلوب</span></label><div class="input"><span>◉</span><span class="value">employee@example.com</span></div></div>', '');
html = html.replace('كلمة المرور <span>نسيت كلمة المرور؟</span>', 'كلمة المرور <span>مطلوب</span>');
html = html.replace('<p class="help">تحتاج مساعدة؟ <b>تواصل مع مسؤول النظام</b></p>', '<p class="help">للدخول المصرح به لموظفي النظام فقط</p>');
fs.writeFileSync(path, html);
console.log('updated password-only preview');
