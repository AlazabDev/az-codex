<script lang="ts">
  import { onMount } from "svelte";
  import { Brain, Database, FileText, HardDrive, RefreshCw, RotateCcw, Shield, ToggleLeft, ToggleRight } from "lucide-svelte";

  import { api } from "$lib/api";
  import { m } from "$lib/paraglide/messages.js";
  import { localeSignal } from "$lib/i18n";
  import { getLocale } from "$lib/paraglide/runtime.js";
  import type { CodexMemoryStatusPayload, UserRole } from "$lib/types";

  let {
    selectedSessionId = null,
    selectedSessionProfileId = null,
    webRole = "admin"
  }: {
    selectedSessionId?: string | null;
    selectedSessionProfileId?: string | null;
    webRole?: UserRole | null;
  } = $props();

  let memory = $state<CodexMemoryStatusPayload | null>(null);
  let loading = $state(false);
  let resetting = $state(false);
  let modeBusy = $state<"enabled" | "disabled" | null>(null);
  let errorText = $state("");
  let noticeText = $state("");
  let mounted = false;
  let lastLoadedSessionKey: string | null = null;

  const readOnly = $derived(webRole === "viewer");
  const canUpdateSessionMode = $derived(Boolean(selectedSessionId) && !readOnly && !modeBusy);
  const ui = $derived.by(() => {
    const _locale = $localeSignal;
    const isKorean = getLocale() === "ko";
    return {
      title: m.workspace_78(),
      subtitle: m.workspace_79(),
      refresh: m.workspace_3(),
      reset: m.workspace_80(),
      resetConfirm: m.workspace_81(),
      resetDone: m.workspace_82(),
      resetDanger: m.workspace_83(),
      settings: m.workspace_84(),
      storage: m.workspace_85(),
      paths: m.workspace_86(),
      selectedSession: m.workspace_87(),
      noSession: m.workspace_88(),
      modeUnknown: m.workspace_89(),
      enableSession: m.workspace_90(),
      disableSession: m.workspace_91(),
      modeUpdated: m.workspace_92(),
      viewerLimited: m.workspace_93(),
      notLoaded: m.workspace_94(),
      files: m.workspace_95(),
      directories: m.workspace_96(),
      bytes: m.workspace_97(),
      latestModified: m.workspace_98(),
      codexHome: "CODEX_HOME",
      configFile: "config.toml",
      memoryRoot: m.workspace_99(),
      on: m.workspace_100(),
      off: m.workspace_101(),
      defaultValue: m.workspace_102()
    };
  });

  $effect(() => {
    const sessionKey = `${selectedSessionProfileId ?? ""}:${selectedSessionId ?? ""}`;
    if (!mounted || sessionKey === lastLoadedSessionKey) {
      return;
    }
    void loadMemoryStatus();
  });

  onMount(() => {
    mounted = true;
    void loadMemoryStatus();
  });

  async function loadMemoryStatus() {
    loading = true;
    errorText = "";
    noticeText = "";
    try {
      memory = await api.getMemoryStatus(selectedSessionId, selectedSessionProfileId);
      lastLoadedSessionKey = `${selectedSessionProfileId ?? ""}:${selectedSessionId ?? ""}`;
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function resetMemory() {
    if (readOnly || resetting) {
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(ui.resetConfirm)) {
      return;
    }
    resetting = true;
    errorText = "";
    noticeText = "";
    try {
      const result = await api.resetMemory();
      memory = result.memory;
      noticeText = ui.resetDone;
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
    } finally {
      resetting = false;
    }
  }

  async function setSessionMode(mode: "enabled" | "disabled") {
    if (!selectedSessionId || readOnly || modeBusy) {
      return;
    }
    modeBusy = mode;
    errorText = "";
    noticeText = "";
    try {
      const result = await api.setSessionMemoryMode(selectedSessionId, mode, selectedSessionProfileId);
      if (memory) {
        memory = {
          ...memory,
          selectedSession: {
            sessionId: result.sessionId,
            memoryMode: result.memoryMode,
            modeSource: "updatedInThisBrowser"
          }
        };
      }
      noticeText = ui.modeUpdated;
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
    } finally {
      modeBusy = null;
    }
  }

  function formatBytes(bytes: number | null | undefined) {
    const value = Number(bytes ?? 0);
    if (value < 1024) {
      return `${value} B`;
    }
    const units = ["KB", "MB", "GB", "TB"];
    let next = value / 1024;
    for (const unit of units) {
      if (next < 1024 || unit === units[units.length - 1]) {
        return `${next.toFixed(next >= 10 ? 1 : 2)} ${unit}`;
      }
      next /= 1024;
    }
    return `${value} B`;
  }

  function formatTimestamp(timestamp: number | null | undefined) {
    if (!timestamp) {
      return "-";
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(timestamp));
  }

  function settingRows(settings: CodexMemoryStatusPayload["settings"] | null) {
    if (!settings) {
      return [];
    }
    return [
      ["generateMemories", m.surface_153(), settings.generateMemories ? ui.on : ui.off],
      ["useMemories", m.surface_154(), settings.useMemories ? ui.on : ui.off],
      ["disableOnExternalContext", m.surface_155(), settings.disableOnExternalContext ? ui.on : ui.off],
      ["maxRawMemoriesForConsolidation", m.surface_156(), String(settings.maxRawMemoriesForConsolidation)],
      ["maxRolloutsPerStartup", m.surface_157(), String(settings.maxRolloutsPerStartup)],
      ["minRolloutIdleHours", m.surface_158(), String(settings.minRolloutIdleHours)],
      ["minRateLimitRemainingPercent", "Min rate-limit remaining", `${settings.minRateLimitRemainingPercent}%`],
      ["extractModel", m.surface_159(), settings.extractModel ?? ui.defaultValue],
      ["consolidationModel", m.surface_160(), settings.consolidationModel ?? ui.defaultValue]
    ];
  }
</script>

<div class="memory-workspace">
  <header class="memory-hero">
    <div>
      <p class="eyebrow">{ui.title}</p>
      <h2>{ui.title}</h2>
      <p>{ui.subtitle}</p>
    </div>
    <div class="memory-actions">
      <button class="memory-button" disabled={loading} onclick={() => void loadMemoryStatus()} type="button">
        <RefreshCw size={15} class={loading ? "animate-spin" : ""} />
        <span>{ui.refresh}</span>
      </button>
      <button class="memory-button memory-button--danger" disabled={readOnly || resetting} onclick={() => void resetMemory()} type="button">
        <RotateCcw size={15} class={resetting ? "animate-spin" : ""} />
        <span>{ui.reset}</span>
      </button>
    </div>
  </header>

  {#if errorText}
    <div class="memory-alert memory-alert--error">{errorText}</div>
  {/if}
  {#if noticeText}
    <div class="memory-alert memory-alert--success">{noticeText}</div>
  {/if}
  {#if readOnly}
    <div class="memory-alert">
      <Shield size={15} />
      <span>{ui.viewerLimited}</span>
    </div>
  {/if}

  {#if memory}
    <section class="memory-grid">
      <article class="memory-card memory-card--wide">
        <div class="memory-card__header">
          <div>
            <p class="eyebrow">{ui.storage}</p>
            <h3>{ui.storage}</h3>
          </div>
          <HardDrive size={18} />
        </div>
        <div class="memory-stats">
          <div>
            <span>{ui.files}</span>
            <strong>{memory.storage.fileCount}</strong>
          </div>
          <div>
            <span>{ui.directories}</span>
            <strong>{memory.storage.directoryCount}</strong>
          </div>
          <div>
            <span>{ui.bytes}</span>
            <strong>{formatBytes(memory.storage.totalBytes)}</strong>
          </div>
          <div>
            <span>{ui.latestModified}</span>
            <strong>{formatTimestamp(memory.storage.latestModifiedAt)}</strong>
          </div>
        </div>
      </article>

      <article class="memory-card">
        <div class="memory-card__header">
          <div>
            <p class="eyebrow">{ui.settings}</p>
            <h3>{ui.settings}</h3>
          </div>
          <Brain size={18} />
        </div>
        <div class="memory-settings-list">
          {#each settingRows(memory.settings) as row (row[0])}
            <div>
              <span>{row[1]}</span>
              <strong>{row[2]}</strong>
            </div>
          {/each}
        </div>
      </article>

      <article class="memory-card">
        <div class="memory-card__header">
          <div>
            <p class="eyebrow">{ui.selectedSession}</p>
            <h3>{ui.selectedSession}</h3>
          </div>
          <Database size={18} />
        </div>
        {#if selectedSessionId}
          <p class="memory-muted">{selectedSessionId}</p>
          <p class="memory-muted">{memory.selectedSession?.memoryMode ?? ui.modeUnknown}</p>
          <div class="memory-inline-actions">
            <button class="memory-button" disabled={!canUpdateSessionMode} onclick={() => void setSessionMode("enabled")} type="button">
              <ToggleRight size={15} class={modeBusy === "enabled" ? "animate-spin" : ""} />
              <span>{ui.enableSession}</span>
            </button>
            <button class="memory-button" disabled={!canUpdateSessionMode} onclick={() => void setSessionMode("disabled")} type="button">
              <ToggleLeft size={15} class={modeBusy === "disabled" ? "animate-spin" : ""} />
              <span>{ui.disableSession}</span>
            </button>
          </div>
        {:else}
          <p class="memory-muted">{ui.noSession}</p>
        {/if}
      </article>

      <article class="memory-card memory-card--wide">
        <div class="memory-card__header">
          <div>
            <p class="eyebrow">{ui.paths}</p>
            <h3>{ui.paths}</h3>
          </div>
          <FileText size={18} />
        </div>
        <dl class="memory-paths">
          <div><dt>{ui.codexHome}</dt><dd>{memory.paths.codexHome}</dd></div>
          <div><dt>{ui.configFile}</dt><dd>{memory.paths.configFilePath}</dd></div>
          <div><dt>{ui.memoryRoot}</dt><dd>{memory.paths.memoryRoot}</dd></div>
        </dl>
      </article>
    </section>
  {:else}
    <div class="memory-empty">
      <RefreshCw size={18} class={loading ? "animate-spin" : ""} />
      <span>{loading ? ui.refresh : ui.notLoaded}</span>
    </div>
  {/if}

  <p class="memory-footnote">{ui.resetDanger}</p>
</div>

<style>
  .memory-workspace {
    min-height: 100%;
    padding: 24px;
    background:
      radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 14%, transparent), transparent 32rem),
      var(--bg);
    color: var(--ink);
  }

  .memory-hero,
  .memory-card {
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--panel-strong) 94%, transparent);
    box-shadow: 0 18px 45px color-mix(in srgb, var(--ink) 8%, transparent);
  }

  .memory-hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    border-radius: 24px;
    padding: 20px;
  }

  .memory-hero h2,
  .memory-card h3 {
    margin: 0;
    color: var(--ink-strong);
  }

  .memory-hero p:last-child,
  .memory-muted,
  .memory-footnote {
    color: var(--muted);
  }

  .eyebrow {
    margin: 0 0 6px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .memory-actions,
  .memory-inline-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .memory-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 34px;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 8px 12px;
    background: var(--panel);
    color: var(--ink);
    font-size: 12px;
    font-weight: 800;
    transition:
      transform 0.16s ease,
      border-color 0.16s ease,
      background 0.16s ease;
  }

  .memory-button:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
    background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  }

  .memory-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .memory-button--danger {
    color: var(--danger, #b42318);
  }

  .memory-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 10px 12px;
    background: var(--panel-soft);
    color: var(--ink);
    font-size: 12px;
    font-weight: 700;
  }

  .memory-alert--error {
    border-color: color-mix(in srgb, var(--danger, #b42318) 45%, var(--line));
    color: var(--danger, #b42318);
  }

  .memory-alert--success {
    border-color: color-mix(in srgb, var(--success, #027a48) 45%, var(--line));
    color: var(--success, #027a48);
  }

  .memory-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-top: 14px;
  }

  .memory-card {
    border-radius: 20px;
    padding: 16px;
  }

  .memory-card--wide {
    grid-column: 1 / -1;
  }

  .memory-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .memory-stats,
  .memory-settings-list,
  .memory-paths {
    display: grid;
    gap: 8px;
  }

  .memory-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .memory-stats div,
  .memory-settings-list div,
  .memory-paths div {
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 10px;
    background: var(--panel-soft);
  }

  .memory-stats span,
  .memory-settings-list span,
  .memory-paths dt {
    display: block;
    margin-bottom: 4px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .memory-stats strong,
  .memory-settings-list strong,
  .memory-paths dd {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--ink-strong);
    font-size: 13px;
    font-weight: 800;
  }

  .memory-settings-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .memory-inline-actions {
    margin-top: 12px;
  }

  .memory-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 220px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  .memory-footnote {
    margin: 12px 2px 0;
    font-size: 11px;
    font-weight: 700;
  }

  @media (max-width: 760px) {
    .memory-workspace {
      padding: 14px;
    }

    .memory-hero {
      flex-direction: column;
      border-radius: 18px;
      padding: 16px;
    }

    .memory-actions,
    .memory-inline-actions {
      width: 100%;
    }

    .memory-button {
      flex: 1 1 auto;
    }

    .memory-grid,
    .memory-settings-list,
    .memory-stats {
      grid-template-columns: 1fr;
    }
  }
</style>
