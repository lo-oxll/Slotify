# وقتي — HTML + CSS + JS فقط

لا يوجد بناء ولا Node ولا خادم. كل الملفات في جذر واحد، وتعمل مباشرة على GitHub Pages.

## الإعداد (مرة واحدة، على الخطة المجانية Spark)
1. أنشئ مشروعًا في Firebase، ثم أنشئ قاعدة **Firestore**.
2. Authentication → Sign-in method: فعّل **Email/Password** و**Google** و**Anonymous**.
3. Project settings → Your apps → Web: انسخ الإعدادات إلى `config.js`.
4. Firestore → Rules: الصق محتوى `firestore.rules` ثم Publish.
5. Authentication → Settings → Authorized domains: أضف `lo-oxll.github.io`.

## النشر على GitHub Pages
ارفع كل الملفات إلى جذر المستودع، ثم Settings → Pages → Source: فرع `main` والمجلد `/ (root)`.

## الصفحات
`index.html` الرئيسية · `login.html?role=client|business` · `business.html` لوحة النشاط ·
`services.html` تصفح الخدمات · `book.html?id=…` · `bookings.html` · `b.html?s=اسم-النشاط` صفحة النشاط العامة

## ما لا يعمل بدون خادم
بريد التذكير والإشعارات، وحد الحجوزات المعلّقة، والتحقق من الوقت داخل ساعات العمل على الخادم.
