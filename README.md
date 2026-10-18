# وقتي — HTML + CSS + JS فقط

بلا بناء ولا Node. كل الملفات في جذر واحد وتعمل مباشرة على GitHub Pages.

## النشر على GitHub Pages
1. احذف ملفات المشروع القديمة من المستودع، وارفع كل ملفات هذا المجلد إلى **الجذر**.
2. Settings → Pages → Source: **Deploy from a branch** → فرع `main` والمجلد `/ (root)`.
3. افتح `https://USERNAME.github.io/REPO/` بعد دقيقة.

## وضعان
- **تجريبي (الافتراضي):** `config.js` فارغ، فيعمل كل شيء فورًا: تسجيل نشاط، إضافة خدمة، حجزها.
  البيانات داخل متصفحك فقط (localStorage)، فلا يراها أحد غيرك.
- **حقيقي (مشترك بين الجميع):** عبّئ `config.js` بإعدادات Firebase، فيتحول تلقائيًا:
  1. أنشئ مشروع Firebase وقاعدة **Firestore**.
  2. Authentication → فعّل **Email/Password** و**Google** و**Anonymous**.
  3. Project settings → Your apps → Web: انسخ الإعدادات إلى `config.js`.
  4. Firestore → Rules: الصق `firestore.rules` ثم Publish.
  5. Authentication → Settings → Authorized domains: أضف `USERNAME.github.io`.

## تجربة سريعة
1. `login.html?role=business` → سجّل نشاطًا → تبويب «الخدمات» → أضف خدمة.
2. اخرج، ثم افتح `services.html` واحجز الخدمة كضيف (الاسم والهاتف مطلوبان).
3. ادخل كنشاط → «الحجوزات» → اقبل الحجز → يظهر رقم العميل.

## الصفحات
`index.html` · `login.html?role=client|business` · `business.html` · `services.html` ·
`book.html?id=…` · `bookings.html` · `b.html?s=اسم-النشاط`
