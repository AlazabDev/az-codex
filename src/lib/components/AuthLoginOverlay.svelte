<script lang="ts">
  import { ArrowRight, ChevronDown, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-svelte";

  import type { LoginHcaptchaConfig } from "$lib/types";

  type LocaleOption = {
    value: string;
    label: string;
  };

  type UiCopy = {
    privateGateway: string;
    appTitle: string;
    loginLede: string;
    language: string;
    password: string;
    signingIn: string;
    signIn: string;
  };

  let {
    ui,
    localeOptions,
    activeLocale,
    loginPassword = $bindable(""),
    loginBusy,
    loginMessage,
    loginHcaptcha,
    loginHcaptchaToken,
    loginHcaptchaContainer = $bindable(null),
    onLocaleChange,
    onSubmit
  }: {
    ui: UiCopy;
    localeOptions: readonly LocaleOption[];
    activeLocale: string;
    loginPassword: string;
    loginBusy: boolean;
    loginMessage: string;
    loginHcaptcha: LoginHcaptchaConfig;
    loginHcaptchaToken: string;
    loginHcaptchaContainer: HTMLDivElement | null;
    onLocaleChange: (locale: string) => void;
    onSubmit: () => void | Promise<void>;
  } = $props();

  let showPassword = $state(false);
</script>

<div class="az-login-shell absolute inset-0 z-10">
  <section class="az-login-brand" aria-label="Az Codex">
    <div class="az-login-grid"></div>
    <div class="az-login-glow"></div>

    <div class="az-login-brand__inner">
      <header class="az-login-logo">
        <div class="az-login-mark" aria-hidden="true">
          <span></span>
          <span></span>
        </div>
        <div>
          <strong>Az Codex</strong>
          <small>AI OPERATIONS</small>
        </div>
      </header>

      <div class="az-login-hero">
        <p class="az-login-eyebrow"><ShieldCheck size={14} /> AL-AZAB INTELLIGENT WORKSPACE</p>
        <h1>
          <span>Enterprise</span>
          <span class="az-login-accent">AI Development</span>
          <span>Workspace.</span>
        </h1>
        <p class="az-login-description">
          Build, operate, and manage Alazab systems from one intelligent workspace.
        </p>
      </div>

      <div class="az-login-stats" aria-label="Platform capabilities">
        <div>
          <strong>Live</strong>
          <span>CODEX + FOUNDRY</span>
        </div>
        <div>
          <strong>MCP</strong>
          <span>CONNECTED TOOLS</span>
        </div>
        <div>
          <strong>AR / EN</strong>
          <span>BILINGUAL</span>
        </div>
      </div>
    </div>
  </section>

  <section class="az-login-form-panel">
    <div class="az-login-form-wrap">
      <div class="az-login-mobile-brand">
        <div class="az-login-mark az-login-mark--small" aria-hidden="true">
          <span></span>
          <span></span>
        </div>
        <div>
          <strong>Az Codex</strong>
          <small>AI OPERATIONS</small>
        </div>
      </div>

      <div class="az-login-form-heading">
        <h2>Welcome back</h2>
        <p>Sign in to your Az Codex workspace</p>
      </div>

      <form
        class="az-login-form"
        data-testid="login-form"
        onsubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <label class="az-login-field">
          <span>{ui.password}</span>
          <div class="az-login-input-wrap">
            <LockKeyhole size={17} class="az-login-input-icon" />
            <input
              bind:value={loginPassword}
              autocomplete="current-password"
              class="az-login-input"
              data-testid="login-password"
              placeholder="Enter your password"
              type={showPassword ? "text" : "password"}
            />
            <button
              class="az-login-password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onclick={() => (showPassword = !showPassword)}
              type="button"
            >
              {#if showPassword}
                <EyeOff size={18} />
              {:else}
                <Eye size={18} />
              {/if}
            </button>
          </div>
        </label>

        {#if loginHcaptcha.enabled && loginHcaptcha.siteKey}
          <div
            bind:this={loginHcaptchaContainer}
            class="az-login-hcaptcha"
          ></div>
        {/if}

        <button
          class="az-login-submit"
          data-testid="login-submit"
          disabled={loginBusy || (loginHcaptcha.enabled && !loginHcaptchaToken)}
          type="submit"
        >
          <span>{loginBusy ? ui.signingIn : ui.signIn}</span>
          {#if !loginBusy}<ArrowRight size={17} />{/if}
        </button>
      </form>

      {#if loginMessage}
        <p class="az-login-error" role="alert">{loginMessage}</p>
      {/if}

      <div class="az-login-footer">
        <span>{ui.privateGateway}</span>
        <label>
          <span class="sr-only">{ui.language}</span>
          <select
            aria-label={ui.language}
            onchange={(event) => onLocaleChange((event.currentTarget as HTMLSelectElement).value)}
            value={activeLocale}
          >
            {#each localeOptions as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          <ChevronDown size={13} />
        </label>
      </div>
    </div>
  </section>
</div>

<style>
  .az-login-shell {
    display: grid;
    grid-template-columns: minmax(0, 64%) minmax(25rem, 36%);
    background: #f7f7f5;
    color: #101318;
  }

  .az-login-brand {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 78% 16%, rgba(255, 185, 0, 0.11), transparent 28rem),
      linear-gradient(145deg, #07113d 0%, #030957 42%, #111827 100%);
    color: white;
  }

  .az-login-grid {
    position: absolute;
    inset: 0;
    opacity: 0.16;
    background-image:
      linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: linear-gradient(to right, rgba(0,0,0,.95), rgba(0,0,0,.35));
  }

  .az-login-glow {
    position: absolute;
    width: 32rem;
    height: 32rem;
    border-radius: 999px;
    right: -10rem;
    top: -12rem;
    background: rgba(255, 185, 0, 0.09);
    filter: blur(80px);
  }

  .az-login-brand__inner {
    position: relative;
    z-index: 1;
    display: flex;
    height: 100%;
    min-height: 100dvh;
    flex-direction: column;
    padding: clamp(2rem, 4.2vw, 4.5rem);
  }

  .az-login-logo,
  .az-login-mobile-brand {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .az-login-logo strong,
  .az-login-mobile-brand strong {
    display: block;
    font-size: 1.1rem;
    font-weight: 850;
    letter-spacing: -0.02em;
  }

  .az-login-logo small,
  .az-login-mobile-brand small {
    display: block;
    margin-top: 0.15rem;
    color: #ffb900;
    font-size: 0.61rem;
    font-weight: 900;
    letter-spacing: 0.18em;
  }

  .az-login-mark {
    position: relative;
    width: 2.9rem;
    height: 2.9rem;
    flex: 0 0 auto;
  }

  .az-login-mark span {
    position: absolute;
    inset: 0.25rem 0.78rem;
    border-radius: 0.2rem;
    background: linear-gradient(180deg, #ffcc33, #ff8a00);
    transform-origin: 50% 100%;
  }

  .az-login-mark span:first-child {
    transform: rotate(28deg) translateX(-0.48rem);
  }

  .az-login-mark span:last-child {
    transform: rotate(-28deg) translateX(0.48rem);
  }

  .az-login-mark--small {
    width: 2.35rem;
    height: 2.35rem;
  }

  .az-login-hero {
    margin-top: auto;
    margin-bottom: auto;
    max-width: 46rem;
    transform: translateY(-2vh);
  }

  .az-login-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0 0 1.4rem;
    color: rgba(255,255,255,.68);
    font-size: 0.67rem;
    font-weight: 850;
    letter-spacing: 0.16em;
  }

  .az-login-hero h1 {
    margin: 0;
    font-size: clamp(3.45rem, 5.8vw, 6.8rem);
    font-weight: 900;
    line-height: 0.94;
    letter-spacing: -0.065em;
  }

  .az-login-hero h1 span {
    display: block;
  }

  .az-login-accent {
    color: #ffb900;
  }

  .az-login-description {
    max-width: 35rem;
    margin: 1.55rem 0 0;
    color: rgba(226,232,240,.66);
    font-size: clamp(0.9rem, 1.1vw, 1.08rem);
    line-height: 1.75;
  }

  .az-login-stats {
    display: flex;
    align-items: stretch;
    gap: 0;
    width: fit-content;
    margin-top: auto;
  }

  .az-login-stats > div {
    min-width: 9rem;
    padding: 0 1.4rem;
    border-left: 1px solid rgba(255,255,255,.18);
  }

  .az-login-stats > div:first-child {
    padding-left: 0;
    border-left: 0;
  }

  .az-login-stats strong {
    display: block;
    font-size: 0.9rem;
    font-weight: 850;
  }

  .az-login-stats span {
    display: block;
    margin-top: .35rem;
    color: rgba(226,232,240,.46);
    font-size: .56rem;
    font-weight: 800;
    letter-spacing: .06em;
  }

  .az-login-form-panel {
    display: grid;
    place-items: center;
    background: #f7f7f5;
    padding: clamp(2rem, 4vw, 4.5rem);
  }

  .az-login-form-wrap {
    width: min(100%, 26rem);
  }

  .az-login-mobile-brand {
    display: none;
    margin-bottom: 2.4rem;
    color: #030957;
  }

  .az-login-form-heading h2 {
    margin: 0;
    color: #101318;
    font-size: clamp(2rem, 2.5vw, 2.75rem);
    font-weight: 900;
    letter-spacing: -0.045em;
  }

  .az-login-form-heading p {
    margin: .55rem 0 0;
    color: #667085;
    font-size: .88rem;
  }

  .az-login-form {
    margin-top: 2.7rem;
  }

  .az-login-field {
    display: block;
  }

  .az-login-field > span {
    display: block;
    margin-bottom: .55rem;
    color: #16191f;
    font-size: .82rem;
    font-weight: 650;
  }

  .az-login-input-wrap {
    position: relative;
  }

  .az-login-input-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #98a2b3;
    pointer-events: none;
  }

  .az-login-input {
    width: 100%;
    height: 3.25rem;
    border: 1px solid #d9dde4;
    border-radius: .72rem;
    background: rgba(255,255,255,.8);
    padding: 0 3rem 0 2.85rem;
    color: #111827;
    font-size: .84rem;
    outline: none;
    transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
  }

  .az-login-input:focus {
    border-color: #ffb900;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(255,185,0,.12);
  }

  .az-login-password-toggle {
    position: absolute;
    right: .8rem;
    top: 50%;
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    transform: translateY(-50%);
    border-radius: .55rem;
    color: #98a2b3;
  }

  .az-login-password-toggle:hover {
    background: #f2f4f7;
    color: #475467;
  }

  .az-login-hcaptcha {
    min-height: 82px;
    overflow: hidden;
    margin-top: 1.1rem;
    border: 1px solid #e4e7ec;
    border-radius: .75rem;
    background: #fff;
    padding: .7rem;
  }

  .az-login-submit {
    display: flex;
    width: 100%;
    height: 3.2rem;
    align-items: center;
    justify-content: center;
    gap: .55rem;
    margin-top: 1.45rem;
    border-radius: .7rem;
    background: #ffb900;
    color: #111318;
    font-size: .84rem;
    font-weight: 850;
    box-shadow: 0 11px 24px -14px rgba(255,138,0,.8);
    transition: transform .16s ease, background .16s ease, box-shadow .16s ease;
  }

  .az-login-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    background: #ffc526;
    box-shadow: 0 15px 28px -14px rgba(255,138,0,.9);
  }

  .az-login-submit:active:not(:disabled) {
    transform: translateY(0);
  }

  .az-login-submit:disabled {
    cursor: not-allowed;
    opacity: .5;
  }

  .az-login-error {
    margin: 1rem 0 0;
    border: 1px solid #fecaca;
    border-radius: .75rem;
    background: #fff1f2;
    padding: .75rem .9rem;
    color: #b42318;
    font-size: .76rem;
    line-height: 1.45;
  }

  .az-login-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1.8rem;
    padding-top: 1.15rem;
    border-top: 1px solid #e4e7ec;
    color: #98a2b3;
    font-size: .62rem;
    font-weight: 750;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .az-login-footer label {
    position: relative;
    display: flex;
    align-items: center;
    color: #667085;
  }

  .az-login-footer select {
    appearance: none;
    min-width: 7.4rem;
    border: 0;
    background: transparent;
    padding: .4rem 1.45rem .4rem .4rem;
    color: #667085;
    font-size: .68rem;
    font-weight: 800;
    outline: none;
    cursor: pointer;
  }

  .az-login-footer svg {
    position: absolute;
    right: .3rem;
    pointer-events: none;
  }

  @media (max-width: 1024px) {
    .az-login-shell {
      grid-template-columns: 56% 44%;
    }

    .az-login-brand__inner {
      padding: 2.25rem;
    }

    .az-login-hero h1 {
      font-size: clamp(3rem, 6vw, 5rem);
    }

    .az-login-stats > div {
      min-width: 7rem;
      padding: 0 1rem;
    }
  }

  @media (max-width: 760px) {
    .az-login-shell {
      display: block;
      overflow-y: auto;
      background: #f7f7f5;
    }

    .az-login-brand {
      display: none;
    }

    .az-login-form-panel {
      min-height: 100dvh;
      padding: 2rem 1.35rem;
    }

    .az-login-form-wrap {
      width: min(100%, 28rem);
    }

    .az-login-mobile-brand {
      display: flex;
    }

    .az-login-form-heading h2 {
      font-size: 2rem;
    }

    .az-login-form {
      margin-top: 2.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .az-login-submit,
    .az-login-input {
      transition: none;
    }
  }
</style>
