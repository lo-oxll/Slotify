# وقتي

كل الملفات في جذر واحد بلا مجلدات.

## التشغيل
1. `npm install`
2. انسخ `.env.example` إلى `.env` وأدخل مفاتيح Firebase
3. Authentication: فعّل Email/Password و Google و **Anonymous**
4. `npm run dev`

المسارات: `/` `/login?role=client|business` `/business` `/services` `/book?id=…` `/bookings` `/اسم-النشاط`

## GitHub Pages
1. `npm run deploy` (يبني بمسار `/Slotify/` ويدفع `dist` إلى فرع `gh-pages`)
2. Settings → Pages → Source: فرع `gh-pages`
3. Firebase → Authentication → Settings → Authorized domains: أضف `lo-oxll.github.io`

## النشر (خطة Blaze مطلوبة للدوال)
1. `npm run build`
2. `firebase deploy` (قواعد Firestore + الدوال + الاستضافة)
3. ثبّت إضافة **Trigger Email from Firestore** (مجموعة `mail`) لإرسال الإشعارات والتذكيرات

## الاختبارات
`npm run test:rules`

## اختياري
- App Check: أضف `VITE_RECAPTCHA_SITE_KEY` ثم فعّل الإلزام من لوحة Firebase
- راجع مجموعة `errors` في Firestore لأخطاء الواجهة
