# تشغيل Ollama البعيد مع وكيل Codex

يشغل التطبيق وعمليات `codex app-server` والأدوات على سيرفر Frappe. يعمل النموذج على سيرفر Ollama البعيد. لا يتطلب ذلك تثبيت Ollama على سيرفر Frappe.

أضف إلى ملف بيئة **خدمة التطبيق**:

```dotenv
OLLAMA_BASE_URL=https://ollama.alazab.com
OLLAMA_AUTH_USER=azureuser
OLLAMA_AUTH_PASS=<password>
OLLAMA_CODEX_HOME=/home/frappe/.codex-ollama
```

يدعم الاتصال كذلك `OLLAMA_API_KEY` لمصادقة Bearer، أو `OLLAMA_AUTHORIZATION` لترويسة كاملة؛ أولوية الترويسة الكاملة ثم Basic ثم Bearer. تبقى القيم في بيئة الخادم. ملف TOML يحفظ اسم متغير الترويسة فقط.

بعد بناء النسخة وتحديث الخدمة، يظهر حساب **Ollama** مستقلًا عند ضبط `OLLAMA_BASE_URL`، حتى عند تعريف الحسابات الحالية عبر `CODEX_WEBUI_PROFILES_JSON`. لا يتغير الحساب الافتراضي ولا ملفات OpenAI أو Foundry.

من الإعدادات ← إعداد Codex، بحساب المدير أو المالك:

1. اكتشف النماذج الموجودة فعليًا على الخادم.
2. اختر النموذج ثم اختبر التوليد. الاختبار يستخدم `/v1/responses` الذي يحتاجه Codex، وليس مجرد فحص الشبكة.
3. احفظ ملف التشغيل. يُرفض النموذج الذي لا يعلن دعم الأدوات.
4. اختر حساب Ollama وافتح محادثة جديدة. إذا سبق تشغيل هذا الحساب قبل تغيير إعداداته، أوقف عمليته من قسم العمليات بعد انتهاء عمله ثم افتح جلسة جديدة كي تُقرأ الإعدادات الجديدة. إعادة تشغيل البوابة مع handoff قد تُبقي عملية Codex القديمة.

يمكن تنفيذ الفحص من الخادم أيضًا:

```bash
node --env-file=.env scripts/ollama-runtime.mjs catalog
node --env-file=.env scripts/ollama-runtime.mjs probe gpt-oss:20b
node --env-file=.env scripts/ollama-runtime.mjs setup gpt-oss:20b
```

اختبار التوليد لا يثبت وحده اكتمال دورة أدوات Codex. تحقق على السيرفر من محادثة جديدة تطلب قراءة ملف تجريبي ثم تعديل ملف تجريبي وتشغيله. لا يُنشر هذا التغيير تلقائيًا.

ملف `~/.codex-ollama/config.toml` مستقل. إذا توفر مجلد `sites` داخل `FRAPPE_BENCH_PATH` (أو `/home/frappe/frappe-bench` افتراضيًا)، يُسجل خادم Frappe MCP تلقائيًا. ويمكن إضافة إعدادات MCP أخرى؛ يحافظ حفظ Ollama اللاحق على جداول MCP المضافة. يرفض التطبيق استبدال ملف إعداد يدوي غير موسوم بعلامة إدارته.
