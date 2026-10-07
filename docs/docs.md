## 📂 `docs/` – وثائق المشروع التقنية

يحتوي هذا المجلد على الوثائق التقنية لمشروع AzaBot:

| الملف | المحتوى |
|-------|---------|
| `BOTS_API_INTEGRATION_GUIDE.md` | دليل تكامل البوتات الثلاثة مع bot-gateway وmaintenance-gateway |
| `API_GATEWAY_TESTING_COMMANDS.md` | أوامر curl لاختبار دورة حياة طلب الصيانة كاملة |
| `PRODUCTION_DEPLOYMENT.md` | خطوات النشر على الإنتاج (Rasa + Actions + Supabase + Nginx) |
| `daftra-module.md` | توثيق API نظام دفترة المحاسبي (Invoices, Clients, Auth) |
| `daftra-module.html` | نسخة HTML من توثيق دفترة |
| `daftra-module.json` | مواصفات OpenAPI لـ دفترة |
| `template.txt` | قالب أسئلة وأجوبة عامة عن Rasa |

> **ملاحظة**: هذا المجلد للوثائق التقنية وليس لملفات المعرفة (RAG). ملفات المعرفة للبوت موجودة في `knowledge/`.

استقصى هيكل المشروع لفهم السياق الكامل
استقصى هيكل المشروع لفهم السياق الكامل
الصورة كاملة. 3 مشاكل واضحة — أصلحها كلها الآن:

الآن قراءة كل الملفات دفعة واحدة:إليك الصورة الكاملة للمشروع:

---

## بنية الشات — نظرة شاملة

### 1. كيف تُرسل الرسائل (`useChat.ts` → `chat-service.ts`)

**المسار الكامل:**
```
ChatInput (Enter/Click) 
  → handleSend() [AzaBot.tsx]
    → send() [useChat.ts]
      → streamChat() [chat-service.ts]
        → POST /chat (FastAPI)
```

**ما يُرسل لـ `/chat`:**
```json
{
  "sender_id": "web_xxx",         // من localStorage
  "message": "نص الرسالة",
  "channel": "website",
  "site_host": "hostname",
  "site_path": "/path",
  "brand": "alazab_construction"  // من siteId
}
```

> **ملاحظة مهمة:** الاسم `streamChat` مضلل — المشروع لا يستخدم SSE أو streaming حقيقي. يرسل POST عادي وينتظر JSON كامل، ثم يستدعي `onDelta` مرة واحدة.

---

### 2. `config.ts` — نقطة الاتصال بالباك اند

```typescript
API_ORIGIN = VITE_CHAT_API_URL || window.location.origin
// endpoints:
/chat        ← الرسائل النصية
/chat/upload ← رفع ملفات
/chat/audio  ← Speech-to-Text
/chat/tts    ← Text-to-Speech
```

في `.env` الحالي: `VITE_CHAT_API_URL` معطّل (مع `#`) → يستخدم `window.location.origin` (أي نفس الأوريجين في prod، أو يحتاج proxy في dev).

---

### 3. بنية البيانات (`types/chat.ts`)

```typescript
Message:    { id, role, content, attachments?, buttons?, ts, isError? }
ApiMessage: { role, content }           // ما يُبنى ويُمرر للـ API
Attachment: { name, size, type }
MessageButton: { title, payload?, url? }
```

---

### 4. `SiteContext` — تخصيص متعدد المواقع

يُحلّ `siteId` بالترتيب:
1. `VITE_SITE_ID` من `.env` (حالياً: `alazab_construction`)
2. مسار URL (`/luxury-finishing` → `luxury-finishing`)
3. اسم النطاق (hostname)

ثم يُمرر `site.id` → `useChat(site.id)` → يُرسل كـ `brand` في كل طلب.

---

### 5. تدفق الردود

الباك اند يعيد:
```json
{ "responses": [{ "text": "...", "buttons": [...] }] }
```

دالة `normalizeResponses()` تجمع النصوص بـ `\n\n` وتجمع الأزرار من كل العناصر.

---

### 6. الملفات الأساسية مرتبة بالأهمية

| الملف | الدور |
|-------|-------|
| `src/lib/chat-service.ts` | طبقة الشبكة — كل fetch هنا |
| `src/hooks/useChat.ts` | state المحادثة + orchestration |
| `src/lib/config.ts` | URLs والإعدادات |
| `src/components/AzaBot.tsx` | المكوّن الجذر + event handlers |
| `src/types/chat.ts` | Types + NAV_ITEMS + VOICES |
| `src/context/SiteContext.tsx` | تحديد الـ brand/site النشط |الصورة واضحة. الآن أفهم البنية كاملاً. أبدأ التنفيذ:**المهمة 1 — تحديث azabot/.env**أكمل المهام المتبقية دفعة واحدة.الآن عندي كل ما أحتاجه. أنفذ المهام 2-8 بالترتيب.

**المهمة 2 — `azure-agent-service.ts`****المهمة 3 — تحديث `config.ts`****المهمة 4 — `useBotMode` hook****المهمة 5 — تحديث `useChat.ts`****المهمة 6 — `BotModeSwitch` component****المهمة 7 — تحديث `ChatHeader.tsx`****تحديث `AzaBot.tsx` ليمرر `modeState` للـ Header وللـ useChat****المهمة 8 — تحديث `az.sh` لأمر `frontend-env`**الآن أكمل `cmd_frontend_env` في قسم الأوامر ليعرض تقرير أوضح:الآن أحدّث `cmd_help` ليعكس الأوامر الجديدة:الآن أتحقق من أن case router يحتوي الأوامر الجديدة:الملف كاملاً مع كل case router. الآن أحذف الـ `}` الزائد وأضيف الأوامر الناقصة في case router:الآن أضيف الأوامر الجديدة في case router:الآن تحقق سريع من syntax الـ bash:كل الملفات جاهزة. أكمل تحديث الـ todo list:---

اكتملت كل المهام الثماني. هذا ملخص ما تم:

### الملفات الجديدة

**`src/lib/azure-agent-service.ts`** — طبقة شبكة كاملة للـ Azure AI Foundry:
- إنشاء Thread وحفظه في localStorage
- إضافة رسالة → تشغيل Agent → polling على الـ Run → جلب الرد
- `resetAzureThread()` عند بدء محادثة جديدة
- يدعم proxy URL لإخفاء الـ key في الـ production

**`src/hooks/useBotMode.ts`** — يدير حالة السويتش:
- يقرأ من `VITE_BOT_MODE` في `.env`
- يحفظ اختيار المستخدم في localStorage بين الجلسات
- يُعيد `toggle`, `setMode`, `azureAvailable`

**`src/components/chat/BotModeSwitch.tsx`** — زر التحويل في الـ UI:
- يظهر فقط إذا كان `azureAvailable = true`
- تصميم Switch + Tooltip
- `BotModeBadge` صغير يظهر في الـ header عند تفعيل Azure

### الملفات المحدَّثة

| الملف | التغيير |
|-------|---------|
| `azabot/.env` | `VITE_BOT_MODE=rasa` + `VITE_AZURE_*` واضح ومنظم |
| `src/lib/config.ts` | `BotMode` type + `azureAvailable` + `azure` config block |
| `src/hooks/useChat.ts` | يقبل `botMode` ويوجّه لـ `azureChat` أو `streamChat` |
| `src/components/chat/ChatHeader.tsx` | يعرض `BotModeSwitch` في الـ header وداخل القائمة |
| `src/components/AzaBot.tsx` | `useBotMode()` + تمرير `modeState` للـ header |
| `az.sh` | `cmd_frontend_env` محسَّن يمزج VITE_AZURE_* تلقائياً |

### تشغيل

```bash
# مزامنة .env الفرونت اند
bash az.sh frontend-env

# تشغيل dev server
bash az.sh on
```

لتفعيل Azure بشكل افتراضي — غيّر في `azabot/.env`:
```
VITE_BOT_MODE=azure
```