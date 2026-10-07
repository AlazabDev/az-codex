<script lang="ts">
  import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Copy,
    GitBranch,
    PlugZap,
    RefreshCw,
    RotateCw,
    Server,
    Settings,
    ShieldCheck,
    Terminal,
    Wrench
  } from "lucide-svelte";
  import { onMount } from "svelte";

  import { api } from "$lib/api";
  import type {
    AppConfigPayload,
    CodexRuntimeProcess,
    CodexRuntimeStatus,
    McpServerStatus,
    ProductionCheckId,
    ProductionCheckPayload,
    UserRole
  } from "$lib/types";

  let {
    role = null,
    activeProfileId = null,
    onOpenDiagnostics,
    onOpenGit,
    onOpenSettings,
    onCreateTerminal
  }: {
    role?: UserRole | null;
    activeProfileId?: string | null;
    onOpenDiagnostics?: () => void;
    onOpenGit?: () => void;
    onOpenSettings?: () => void;
    onCreateTerminal?: () => void | Promise<void>;
  } = $props();

  let config = $state<AppConfigPayload | null>(null);
  let runtime = $state<CodexRuntimeStatus | null>(null);
  let processes = $state<CodexRuntimeProcess[]>([]);
  let mcpServers = $state<McpServerStatus[]>([]);
  let busy = $state(false);
  let actionBusy = $state<"update" | "mcp" | "restart" | null>(null);
  let errorText = $state("");
  let noticeText = $state("");
  let copiedCommand = $state<string | null>(null);
  let runningCheck = $state<ProductionCheckId | null>(null);
  let checkResults = $state<Partial<Record<ProductionCheckId, ProductionCheckPayload>>>({});

  const canAdmin = $derived(role === "owner" || role === "admin");
  const canRestart = $derived(role === "owner" && Boolean(config?.gateway.restartAvailable));
  const activeProfile = $derived(
    config?.profiles.find((profile) => profile.id === activeProfileId)
      ?? config?.profiles.find((profile) => profile.active)
      ?? null
  );
  const foundryProfile = $derived(
    config?.profiles.find((profile) => profile.id === "azcodex" || profile.codexHome.includes(".azcodex"))
      ?? null
  );
  const healthyMcpCount = $derived(
    mcpServers.filter((server) => {
      const status = String(server.authStatus ?? "").toLowerCase();
      return !["error", "failed", "unauthorized"].some((needle) => status.includes(needle));
    }).length
  );
  const totalSessions = $derived(processes.reduce((sum, process) => sum + process.sessionCount, 0));
  const memoryPercent = $derived.by(() => {
    const ratio = runtime?.hostResources?.memoryUsageRatio;
    if (typeof ratio === "number" && Number.isFinite(ratio)) {
      return Math.max(0, Math.min(100, Math.round(ratio * 100)));
    }
    const used = runtime?.hostResources?.memoryCurrentBytes;
    const max = runtime?.hostResources?.memoryMaxBytes ?? runtime?.hostResources?.procMemTotalBytes;
    if (typeof used === "number" && typeof max === "number" && max > 0) {
      return Math.max(0, Math.min(100, Math.round((used / max) * 100)));
    }
    return null;
  });

  const commands: Array<{ id: ProductionCheckId; label: string; command: string; description: string }> = [
    {
      id: "release",
      label: "Release gate",
      command: "pnpm release:check",
      description: "Full TypeScript, Rust, security, runtime smoke and package verification."
    },
    {
      id: "foundry",
      label: "Foundry live",
      command: "pnpm foundry:doctor",
      description: "Live Codex → Microsoft Foundry round-trip."
    },
    {
      id: "production",
      label: "Production doctor",
      command: "pnpm prod:doctor",
      description: "Production environment, profiles, runtime and Foundry validation."
    },
    {
      id: "mcp",
      label: "MCP doctor",
      command: "pnpm mcp:doctor",
      description: "Validate enabled integration targets from the MCP registry."
    }
  ];

  onMount(() => {
    void refreshAll();
  });

  async function refreshAll() {
    if (busy) return;
    busy = true;
    errorText = "";
    try {
      runtime = await api.getRuntimeStatus();
      if (canAdmin) {
        const [nextConfig, nextMcp] = await Promise.all([
          api.getConfig(),
          api.listMcpServers()
        ]);
        config = nextConfig;
        mcpServers = nextMcp.data;
        try {
          processes = (await api.getRuntimeProcesses()).processes;
        } catch {
          processes = [];
        }
      } else {
        config = null;
        mcpServers = [];
        processes = [];
      }
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
    }
  }

  async function refreshMcp() {
    if (!canAdmin || actionBusy) return;
    actionBusy = "mcp";
    errorText = "";
    noticeText = "";
    try {
      await api.refreshMcpServers();
      mcpServers = (await api.listMcpServers()).data;
      noticeText = "MCP servers refreshed.";
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
    } finally {
      actionBusy = null;
    }
  }

  async function checkUpdate() {
    if (!canAdmin || actionBusy) return;
    actionBusy = "update";
    errorText = "";
    noticeText = "";
    try {
      runtime = await api.checkRuntimeUpdate();
      noticeText = runtime.updateAvailable ? "Codex update available." : "Codex runtime is current.";
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
    } finally {
      actionBusy = null;
    }
  }

  async function restartGateway() {
    if (!canRestart || actionBusy) return;
    if (!window.confirm("Restart the production gateway now? Active sessions use handoff when available.")) return;
    actionBusy = "restart";
    errorText = "";
    noticeText = "";
    try {
      await api.restartGateway();
      noticeText = "Gateway restart scheduled. Reconnecting…";
      window.setTimeout(() => api.reconnectNow(), 2500);
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
      actionBusy = null;
    }
  }

  async function runCheck(check: ProductionCheckId) {
    if (role !== "owner" || runningCheck) return;
    runningCheck = check;
    errorText = "";
    noticeText = "";
    try {
      const result = await api.runProductionCheck(check);
      checkResults = { ...checkResults, [check]: result };
      noticeText = result.ok
        ? `${result.script} passed in ${Math.max(1, Math.round(result.durationMs / 1000))}s.`
        : `${result.script} failed with exit code ${result.exitCode ?? "unknown"}.`;
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
    } finally {
      runningCheck = null;
    }
  }

  async function copyCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      copiedCommand = command;
      window.setTimeout(() => {
        if (copiedCommand === command) copiedCommand = null;
      }, 1600);
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
    }
  }

  function formatBytes(value: number | null | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "-";
    const units = ["B", "KiB", "MiB", "GiB", "TiB"];
    let next = value;
    let index = 0;
    while (next >= 1024 && index < units.length - 1) {
      next /= 1024;
      index += 1;
    }
    return `${next >= 10 || index === 0 ? next.toFixed(0) : next.toFixed(1)} ${units[index]}`;
  }
</script>

<div class="production-workspace">
  <header class="production-hero">
    <div class="production-hero__copy">
      <span class="production-kicker"><ShieldCheck size={14} /> Production control</span>
      <h2>Production / الإنتاج</h2>
      <p>Runtime health, Foundry profile, MCP integrations and safe operational shortcuts in one place.</p>
    </div>
    <button class="production-button production-button--primary" disabled={busy} onclick={() => void refreshAll()} type="button">
      <RefreshCw size={15} class={busy ? "animate-spin" : ""} />
      Refresh
    </button>
  </header>

  {#if errorText}
    <div class="production-alert production-alert--error">
      <AlertTriangle size={16} />
      <span>{errorText}</span>
    </div>
  {/if}
  {#if noticeText}
    <div class="production-alert production-alert--ok">
      <CheckCircle2 size={16} />
      <span>{noticeText}</span>
    </div>
  {/if}

  <section class="production-metrics">
    <article class="metric-card">
      <div class="metric-icon"><Activity size={17} /></div>
      <div><span>Codex runtime</span><strong>{runtime?.version ?? (runtime?.installed ? "installed" : "unavailable")}</strong></div>
      <span class:metric-ok={runtime?.installed} class:metric-warn={!runtime?.installed} class="metric-state">
        {runtime?.installed ? "healthy" : "check"}
      </span>
    </article>

    <article class="metric-card">
      <div class="metric-icon"><Server size={17} /></div>
      <div><span>Gateway build</span><strong>{runtime?.webuiBuildCommitShort ?? runtime?.webuiBuildVersion ?? "-"}</strong></div>
      <span class:metric-ok={!runtime?.webuiBuildDirty} class:metric-warn={runtime?.webuiBuildDirty} class="metric-state">
        {runtime?.webuiBuildDirty ? "dirty" : "clean"}
      </span>
    </article>

    <article class="metric-card">
      <div class="metric-icon"><PlugZap size={17} /></div>
      <div><span>MCP servers</span><strong>{healthyMcpCount} / {mcpServers.length}</strong></div>
      <span class:metric-ok={mcpServers.length > 0 && healthyMcpCount === mcpServers.length} class:metric-warn={healthyMcpCount !== mcpServers.length} class="metric-state">
        {mcpServers.length > 0 && healthyMcpCount === mcpServers.length ? "ready" : "review"}
      </span>
    </article>

    <article class="metric-card">
      <div class="metric-icon"><Wrench size={17} /></div>
      <div><span>App-server sessions</span><strong>{totalSessions}</strong></div>
      <span class="metric-state">{processes.length} proc</span>
    </article>
  </section>

  <section class="production-grid">
    <article class="production-card">
      <header><div><span>Runtime</span><h3>Host & gateway</h3></div><Activity size={18} /></header>
      <dl>
        <div><dt>Memory</dt><dd>{memoryPercent === null ? "-" : `${memoryPercent}%`}</dd></div>
        <div><dt>Used</dt><dd>{formatBytes(runtime?.hostResources?.memoryCurrentBytes)}</dd></div>
        <div><dt>OOM kills</dt><dd>{runtime?.hostResources?.oomKillCount ?? 0}</dd></div>
        <div><dt>Update</dt><dd>{runtime?.updateAvailable === true ? "available" : runtime?.updateAvailable === false ? "current" : "unknown"}</dd></div>
      </dl>
      {#if runtime?.issues?.length}
        <div class="issue-list">
          {#each runtime.issues as issue (issue)}<span>{issue}</span>{/each}
        </div>
      {/if}
      <div class="card-actions">
        <button class="production-button" disabled={!canAdmin || Boolean(actionBusy)} onclick={() => void checkUpdate()} type="button">
          <RefreshCw size={14} class={actionBusy === "update" ? "animate-spin" : ""} /> Check update
        </button>
        <button class="production-button production-button--danger" disabled={!canRestart || Boolean(actionBusy)} onclick={() => void restartGateway()} type="button">
          <RotateCw size={14} class={actionBusy === "restart" ? "animate-spin" : ""} /> Restart gateway
        </button>
      </div>
    </article>

    <article class="production-card">
      <header><div><span>Profiles</span><h3>Codex routing</h3></div><ShieldCheck size={18} /></header>
      <dl>
        <div><dt>Active</dt><dd>{activeProfile?.label ?? activeProfileId ?? "-"}</dd></div>
        <div><dt>CODEX_HOME</dt><dd title={activeProfile?.codexHome ?? ""}>{activeProfile?.codexHome ?? "-"}</dd></div>
        <div><dt>Foundry</dt><dd>{foundryProfile ? "configured" : "missing"}</dd></div>
        <div><dt>Allowed roots</dt><dd>{config?.allowedRoots.length ?? 0}</dd></div>
      </dl>
      <div class="profile-list">
        {#each config?.profiles ?? [] as profile (profile.id)}
          <span class:profile-active={profile.id === activeProfile?.id}>
            <strong>{profile.label}</strong>
            <code>{profile.codexHome}</code>
          </span>
        {/each}
      </div>
    </article>

    <article class="production-card">
      <header><div><span>Integrations</span><h3>MCP status</h3></div><PlugZap size={18} /></header>
      {#if mcpServers.length === 0}
        <div class="empty-state">No MCP servers reported by Codex.</div>
      {:else}
        <div class="mcp-list">
          {#each mcpServers as server (server.name)}
            <div>
              <span class="mcp-dot"></span>
              <strong>{server.name}</strong>
              <small>{Object.keys(server.tools ?? {}).length} tools · {server.resources?.length ?? 0} resources</small>
            </div>
          {/each}
        </div>
      {/if}
      <div class="card-actions">
        <button class="production-button" disabled={!canAdmin || Boolean(actionBusy)} onclick={() => void refreshMcp()} type="button">
          <RefreshCw size={14} class={actionBusy === "mcp" ? "animate-spin" : ""} /> Refresh MCP
        </button>
        <button class="production-button" onclick={onOpenSettings} type="button"><Settings size={14} /> MCP settings</button>
      </div>
    </article>

    <article class="production-card production-card--commands">
      <header><div><span>Release tools</span><h3>Verified commands</h3></div><Terminal size={18} /></header>
      <div class="command-list">
        {#each commands as item (item.command)}
          <div class="command-row">
            <div class="command-copy">
              <strong>{item.label}</strong>
              <small>{item.description}</small>
              <code>{item.command}</code>
            </div>
            <div class="command-actions">
              <button class="icon-action" onclick={() => void copyCommand(item.command)} title="Copy command" type="button">
                <Copy size={14} />
              </button>
              <button
                class="run-action"
                disabled={role !== "owner" || Boolean(runningCheck)}
                onclick={() => void runCheck(item.id)}
                type="button"
              >
                {#if runningCheck === item.id}<RefreshCw size={13} class="animate-spin" />{:else}<Activity size={13} />{/if}
                Run
              </button>
            </div>
            {#if copiedCommand === item.command}<span class="copied">copied</span>{/if}
            {#if checkResults[item.id]}
              {@const result = checkResults[item.id]!}
              <div class={`command-result ${result.ok ? "command-result--ok" : "command-result--error"}`}>
                <header>
                  <strong>{result.ok ? "PASS" : "FAIL"}</strong>
                  <span>{result.durationMs} ms · exit {result.exitCode ?? "-"}</span>
                </header>
                {#if result.stdout}<pre>{result.stdout}</pre>{/if}
                {#if result.stderr}<pre>{result.stderr}</pre>{/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </article>
  </section>

  <section class="production-toolbar">
    <button class="tool-card" onclick={onOpenGit} type="button"><GitBranch size={17} /><span><strong>Git</strong><small>Review source and deployment diff</small></span></button>
    <button class="tool-card" onclick={() => void onCreateTerminal?.()} disabled={!canAdmin} type="button"><Terminal size={17} /><span><strong>Terminal</strong><small>Run guarded production commands</small></span></button>
    <button class="tool-card" onclick={onOpenDiagnostics} type="button"><Activity size={17} /><span><strong>Diagnostics</strong><small>Processes, parser and runtime events</small></span></button>
    <button class="tool-card" onclick={onOpenSettings} type="button"><Settings size={17} /><span><strong>Settings</strong><small>Profiles, MCP, skills and automation</small></span></button>
  </section>
</div>

<style>
  .production-workspace{height:100%;overflow:auto;padding:1.25rem;background:var(--panel-soft);color:var(--ink)}
  .production-hero,.production-card,.metric-card,.production-toolbar,.production-alert{border:1px solid var(--line);background:var(--panel-strong);box-shadow:0 18px 40px -32px rgba(15,23,42,.45)}
  .production-hero{display:flex;align-items:center;justify-content:space-between;gap:1rem;border-radius:1.4rem;padding:1.1rem 1.2rem}
  .production-hero__copy h2{margin:.3rem 0 0;font-size:1.35rem;font-weight:850;color:var(--ink-strong)}
  .production-hero__copy p{margin:.4rem 0 0;max-width:52rem;font-size:.82rem;line-height:1.5;color:var(--muted)}
  .production-kicker{display:inline-flex;align-items:center;gap:.4rem;color:#b45309;font-size:.68rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase}
  .production-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem;margin-top:.9rem}
  .metric-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.7rem;border-radius:1rem;padding:.85rem}
  .metric-icon{display:grid;height:2.1rem;width:2.1rem;place-items:center;border-radius:.75rem;background:rgba(245,158,11,.12);color:#d97706}
  .metric-card span{font-size:.68rem;color:var(--muted)} .metric-card strong{display:block;margin-top:.16rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-strong);font-size:.86rem}
  .metric-state{border-radius:999px;background:var(--panel-soft);padding:.2rem .48rem!important;font-size:.6rem!important;font-weight:850;text-transform:uppercase}.metric-ok{background:rgba(16,185,129,.12)!important;color:#059669!important}.metric-warn{background:rgba(245,158,11,.13)!important;color:#b45309!important}
  .production-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.9rem;margin-top:.9rem}
  .production-card{min-width:0;border-radius:1.2rem;padding:1rem}.production-card header{display:flex;align-items:center;justify-content:space-between;gap:.75rem;color:var(--ink-strong)}.production-card header span{font-size:.62rem;font-weight:850;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}.production-card h3{margin:.15rem 0 0;font-size:.98rem}
  dl{display:grid;gap:.5rem;margin:.8rem 0 0}dl div{display:flex;justify-content:space-between;gap:1rem;border-top:1px solid var(--line);padding-top:.5rem}dt{font-size:.72rem;font-weight:700;color:var(--muted)}dd{margin:0;max-width:68%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.74rem;font-weight:800;color:var(--ink-strong)}
  .issue-list,.profile-list,.mcp-list,.command-list{display:grid;gap:.5rem;margin-top:.8rem}.issue-list span{border-radius:.65rem;background:rgba(245,158,11,.1);padding:.45rem .55rem;font-size:.7rem;color:#b45309}
  .profile-list>span{display:grid;gap:.15rem;border:1px solid var(--line);border-radius:.75rem;padding:.5rem .6rem}.profile-list strong{font-size:.72rem}.profile-list code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.65rem;color:var(--muted)}.profile-active{border-color:rgba(245,158,11,.45)!important;background:rgba(245,158,11,.07)}
  .mcp-list>div{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.5rem;border:1px solid var(--line);border-radius:.75rem;padding:.5rem .6rem}.mcp-dot{height:.5rem;width:.5rem;border-radius:999px;background:#10b981}.mcp-list strong{font-size:.72rem}.mcp-list small{color:var(--muted);font-size:.63rem}
  .card-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.85rem}.production-button{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border:1px solid var(--line);border-radius:.75rem;padding:.48rem .7rem;color:var(--ink);font-size:.7rem;font-weight:800;transition:transform .14s ease,background .14s ease}.production-button:hover:not(:disabled){transform:translateY(-1px);background:var(--panel-soft)}.production-button:disabled{cursor:not-allowed;opacity:.45}.production-button--primary{border-color:#111827;background:#111827;color:white}.production-button--danger{color:#b91c1c}
  .command-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:.75rem;border:1px solid var(--line);border-radius:.8rem;padding:.62rem .7rem}.command-copy{min-width:0;display:grid;gap:.18rem}.command-row strong{font-size:.72rem}.command-row small{font-size:.64rem;color:var(--muted)}.command-row code{margin-top:.15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.64rem;color:#b45309}.command-actions{display:flex;align-items:center;gap:.35rem}.icon-action,.run-action{display:inline-flex;align-items:center;justify-content:center;gap:.3rem;border:1px solid var(--line);border-radius:.55rem;padding:.35rem .45rem;font-size:.62rem;font-weight:800}.run-action{background:#111827;color:#fff}.icon-action:hover,.run-action:hover:not(:disabled){transform:translateY(-1px)}.run-action:disabled{cursor:not-allowed;opacity:.4}.copied{position:absolute;right:6rem;top:.45rem;border-radius:999px;background:#dcfce7;padding:.15rem .4rem;font-size:.56rem;font-weight:800;color:#15803d}.command-result{grid-column:1/-1;overflow:hidden;border-radius:.7rem;border:1px solid var(--line)}.command-result header{display:flex;align-items:center;justify-content:space-between;background:var(--panel-soft);padding:.4rem .55rem}.command-result header strong{font-size:.62rem}.command-result header span{font-size:.58rem;color:var(--muted)}.command-result pre{max-height:14rem;overflow:auto;margin:0;border-top:1px solid var(--line);padding:.55rem;font-size:.62rem;line-height:1.45;white-space:pre-wrap;color:var(--muted)}.command-result--ok{border-color:rgba(16,185,129,.3)}.command-result--ok header strong{color:#059669}.command-result--error{border-color:rgba(239,68,68,.3)}.command-result--error header strong{color:#dc2626}
  .production-toolbar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.65rem;margin-top:.9rem;border-radius:1.2rem;padding:.75rem}.tool-card{display:flex;align-items:center;gap:.6rem;border:1px solid var(--line);border-radius:.85rem;padding:.65rem;text-align:left}.tool-card:hover:not(:disabled){background:var(--panel-soft)}.tool-card:disabled{opacity:.45}.tool-card strong{display:block;font-size:.72rem}.tool-card small{display:block;margin-top:.1rem;font-size:.61rem;color:var(--muted)}
  .production-alert{display:flex;align-items:center;gap:.5rem;margin-top:.8rem;border-radius:.9rem;padding:.65rem .8rem;font-size:.74rem;font-weight:700}.production-alert--error{color:#b91c1c}.production-alert--ok{color:#047857}.empty-state{margin-top:.8rem;border:1px dashed var(--line);border-radius:.8rem;padding:.8rem;text-align:center;font-size:.72rem;color:var(--muted)}
  @media(max-width:980px){.production-metrics,.production-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.production-workspace{padding:.8rem}.production-hero{align-items:stretch;flex-direction:column}.production-grid,.production-metrics,.production-toolbar{grid-template-columns:1fr}}
</style>
