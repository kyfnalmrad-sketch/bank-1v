from pathlib import Path

root = Path('/home/ubuntu/bank-karimi-web-staging')
html_path = root / 'preview/ycb-official-certificate-preview.html'
html = html_path.read_text()
replacements = {
    'width:21mm;height:21mm;object-fit:contain': 'width:25mm;height:25mm;object-fit:contain',
    'top:34mm;left:12mm;width:21mm': 'top:38mm;left:12mm;width:25mm',
    'top:64mm;right:21mm;left:21mm': 'top:64mm;right:21mm;left:21mm',
    'margin:0 0 6mm': 'margin:0 0 4mm',
    'margin-top:5mm;color:#a30000': 'margin-top:3mm;color:#a30000',
    'margin-top:9mm;color:#151b29': 'margin-top:6mm;color:#151b29',
    'margin:15mm 0 0': 'margin:10mm 0 0',
}
for old, new in replacements.items():
    html = html.replace(old, new)
html_path.write_text(html)

plan = root / 'YCB_IMPLEMENTATION_PLAN_AR.md'
plan.write_text('''# خطة تنفيذ قسم بنك اليمن التجاري\n\n## قاعدة العمل\nكل التغييرات تتم على `feature/yemen-commercial-bank-statement` فقط. لا يتم تعديل `main` أو دمج أي شيء إليه قبل موافقة صريحة.\n\n## المرحلة الأولى: الشهادة الرسمية والاستقلالية\nتثبيت ورقة الشهادة الرسمية، الحقول المتغيرة، التوزيع النهائي، QR بلون وهوية YCB، ونطاق بيانات تحقق مستقل. تكون مراجع الشهادة وقراءة QR وبيانات البنك منفصلة عن الكريمي، مع مراجعة سلامة الملفات وعدم وجود أسماء موظفين ثابتة.\n\n## المرحلة الثانية: الكشوف\nبناء كشف المراجعة السريع والكشف التفصيلي متعدد الصفحات داخل قسم مستقل، مع نفس نمط المدخلات العام عند الحاجة، لكن ببيانات YCB ومراجعها وترقيمها وقالبها وجداولها الخاصة.\n\n## المرحلة الثالثة: النظام والاختبار والتسليم\nربط المدخلات بالمعاينات وتوليد PDF وQR الديناميكي، ثم اختبار الحسابات والطباعة وتعدد الصفحات واستقلال السجلات وعدم تأثر الكريمي. بعد النجاح يتم commit وpush إلى الفرع المستقل فقط، ويبقى `main` دون تغيير.\n''')
print('updated stage-one layout and three-stage plan')
