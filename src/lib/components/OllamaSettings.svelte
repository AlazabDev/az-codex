<script lang="ts">
  import { api } from "$lib/api";
  let models = $state<Array<{ name: string; size: number }>>([]);
  let model = $state("");
  let endpoint = $state("");
  let busy = $state(false);
  let message = $state("");
  let failed = $state(false);
  let verified = $state("");
  async function run(action: "catalog" | "probe" | "setup") {
    busy = true; message = ""; failed = false;
    try {
      if (action === "catalog") {
        const data = await api.ollamaCatalog();
        endpoint = data.endpoint; models = data.models; verified = "";
        model = models.some(item => item.name === model) ? model : models.find(item => item.name === "gpt-oss:20b")?.name ?? models[0]?.name ?? "";
        message = models.length ? "تم جلب النماذج؛ اختبر النموذج قبل حفظه." : "لا توجد نماذج مثبتة على خادم Ollama.";
      } else {
        const result = await api.ollamaAction(action, model);
        message = result.message;
        if (action === "probe") verified = model;
      }
    } catch (error) { failed = true; message = error instanceof Error ? error.message : "تعذر الاتصال بـOllama."; }
    finally { busy = false; }
  }
</script>
<section class="panel" dir="rtl">
  <div class="panel__header"><div><h3>نماذج Ollama البعيدة</h3><span>ملف تشغيل مستقل يحافظ على حسابي OpenAI وFoundry.</span></div></div>
  <div class="settings-meta">
    <p>يُضبط عنوان الخادم والمصادقة في بيئة خادم التطبيق. تُنفذ الأدوات على سيرفر Frappe.</p>
    {#if endpoint}<p dir="ltr">{endpoint}</p>{/if}
    <button class="ghost-button" disabled={busy} onclick={() => void run("catalog")} type="button">اكتشاف النماذج</button>
    <label for="ollama-model">النموذج</label>
    <select id="ollama-model" bind:value={model} disabled={busy || !models.length} onchange={() => { verified = ""; message = ""; }}>
      {#each models as item (item.name)}<option value={item.name}>{item.name}</option>{/each}
    </select>
    <button class="ghost-button" disabled={busy || !model} onclick={() => void run("probe")} type="button">اختبار التوليد</button>
    <button class="solid-button" disabled={busy || !model || verified !== model} onclick={() => void run("setup")} type="button">حفظ ملف تشغيل Ollama</button>
    {#if busy}<p role="status">جارٍ التنفيذ… قد يستغرق تحميل النموذج عدة دقائق.</p>{/if}
    {#if message}<p role={failed ? "alert" : "status"}>{message}</p>{/if}
  </div>
</section>
