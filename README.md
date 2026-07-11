# 👑 Galaxy Temp Voice Bot (Standalone)

بوت غرف صوتية مؤقتة ملكي ومستقل تماماً يتميز بسرعة استجابة فائقة وعزل كامل عن بقية أنظمة البوت الشامل.

## 📁 محتويات المشروع
* **`bot.js`**: نقطة انطلاق البوت وربط الأحداث وقاعدة البيانات.
* **`events/voiceStateUpdate.js`**: المسؤول عن إنشاء الغرفة الصوتية عند دخول روم `Join-To-Create`، استعادة الإعدادات، إرسال لوحة التحكم وإلغاء القناة عند تفريغها.
* **`events/interactionCreate.js`**: إدارة جميع التفاعلات (`vc_rename`, `vc_privacy_menu`, `vc_limit`, `vc_trust`, `vc_block`, `vc_transfer`).
* **`utils/pvcImage.js`**: توليد الصورة الإرشادية الخاصة بالرومات باستخدام خطوط Cairo ومكتبة Canvas.
* **`models/`**: نماذج قاعدة البيانات (`PrivateVC`, `Coin`, `AdminCommand`, `GuildSettings`) متوافقة بنسبة 100% مع داتابيز البوت الشامل.

---

## 🚀 كيفية تشغيل البوت وتفعيله (الخطوات المطلوبة منك)

### 1. إنشاء توكن بوت جديد
1. اذهب إلى [Discord Developer Portal](https://discord.com/developers/applications).
2. اضغط على **New Application** وقم بتسميته `Galaxy Temp Voice` (أو أي اسم تفضله).
3. اذهب إلى قسم **Bot** من القائمة اليسرى:
   * اضغط **Reset Token** وانسخ التوكن الجديد.
   * تأكد من تفعيل خيار **SERVER MEMBERS INTENT** في قسم Privileged Gateway Intents.
4. اذهب إلى ملف `.env` داخل هذا المجلد (`c:\my-server-bots\galaxy-temp-voice-bot\.env`) وضع التوكن الخاص بك في متغير `BOT_TOKEN`.

### 2. تثبيت الحزم والمكتبات
افتح التيرمنال (الـ CMD أو PowerShell) في هذا المجلد ونفذ الأمر التالي:
```bash
npm install
```

### 3. تشغيل البوت
لتشغيل البوت:
```bash
npm start
```
أو للتشغيل في وضع المطور والتحديث التلقائي:
```bash
npm run dev
```

### 4. إدخال البوت للسيرفر وإعطاؤه الصلاحيات
* ادعُ البوت إلى سيرفرك من Discord Developer Portal (قسم OAuth2 -> URL Generator واختر `bot` مع صلاحية `Administrator` أو `Manage Channels + Move/Mute/Deafen Members`).
* **مهم جداً:** في إعدادات رتب السيرفر (Server Roles)، قم برفع رتبة هذا البوت لتكون فوق رتب الأعضاء والبنات والولاد لكي يستطيع قفل وفتح القنوات ونقل الأعضاء بسلاسة.
