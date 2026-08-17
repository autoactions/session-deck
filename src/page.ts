export const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <circle cx="16" cy="16" r="13" stroke="#f2f2f0" stroke-width="1"/>
  <circle cx="16" cy="16" r="5.5" fill="#f2f2f0"/>
  <circle cx="16" cy="16" r="2" fill="#000000"/>
</svg>`;

const MARK = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="1"/>
  <path fill="currentColor" fill-rule="evenodd" d="M16 21.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zm0-3.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
</svg>`;

export function renderPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Debug Session</title>
  <link rel="icon" href="/assets/mark.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Inter:ital,wght@0,400;0,500;0,600&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #050505;
      --bg-2: #000000;
      --surface: #0c0c0c;
      --fg: #f2f2f0;
      --muted: #8a8a84;
      --faint: #6e6e68;
      --border: rgba(242, 242, 240, 0.1);
      --line: rgba(242, 242, 240, 0.1);
      --line-strong: rgba(242, 242, 240, 0.18);
      --accent: #f2f2f0;
      --accent-fg: #0a0a0a;
      --accent-hover: #d9d9d4;
      --failed: #d85a4a;
      --display: "Instrument Serif", "Times New Roman", serif;
      --body: Inter, ui-sans-serif, system-ui, sans-serif;
      --mono: "IBM Plex Mono", ui-monospace, monospace;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      min-height: 100vh;
      font: 15px/1.45 var(--body);
      letter-spacing: -0.011em;
      background: var(--bg-2);
      color: var(--fg);
    }
    body.is-app { background: var(--bg); }
    ::selection { background: var(--fg); color: var(--accent-fg); }
    a { color: inherit; }
    button, input, select { font: inherit; color: inherit; border-radius: 0; }
    .grain, .bloom {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }
    .grain {
      z-index: 40;
      opacity: 0.035;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    .bloom {
      z-index: 0;
      background: radial-gradient(circle at 50% 42%, rgba(242, 242, 240, 0.07), transparent 58%);
    }
    .hidden { display: none !important; }
    .kicker, dt, th, .tab, .method, .foot, .gate-foot dt {
      font-family: var(--mono);
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .mark { display: block; color: var(--fg); }
    .gate-mark { width: 28px; height: 28px; }
    .brand-mark { width: 18px; height: 18px; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border: 0;
      background: transparent;
      font-family: var(--body);
      font-size: 13px;
      font-weight: 500;
      letter-spacing: -0.011em;
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease, opacity 150ms ease;
    }
    .btn-primary { background: var(--accent); color: var(--accent-fg); }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); color: var(--accent-fg); }
    .btn-ghost {
      border: 1px solid var(--line-strong);
      color: var(--fg);
    }
    .btn-ghost:hover:not(:disabled) { background: rgba(242, 242, 240, 0.06); }
    .btn-quiet {
      min-height: 32px;
      color: var(--muted);
      padding: 0 10px;
    }
    .btn-quiet:hover:not(:disabled) { color: var(--fg); }
    .btn:disabled { opacity: 0.38; cursor: not-allowed; }
    :focus-visible {
      outline: 1px solid var(--fg);
      outline-offset: 3px;
    }
    .field {
      width: 100%;
      padding: 12px 0;
      border: 0;
      border-bottom: 1px solid var(--line-strong);
      background: transparent;
      color: var(--fg);
      font-family: var(--body);
      font-size: 15px;
      line-height: 1.45;
      letter-spacing: -0.011em;
      appearance: none;
      border-radius: 0;
    }
    .field::placeholder { color: var(--faint); }
    .field:focus { outline: none; border-bottom-color: var(--fg); }
    select.field {
      background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
      background-position: calc(100% - 10px) 50%, calc(100% - 5px) 50%;
      background-size: 5px 5px, 5px 5px;
      background-repeat: no-repeat;
      padding-right: 22px;
    }
    #gate {
      position: relative;
      z-index: 1;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px 96px;
    }
    .gate-stack {
      width: min(440px, 100%);
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }
    .gate-stack .mark { margin-bottom: 28px; }
    .gate-kicker {
      color: var(--faint);
      margin: 0 0 12px;
    }
    .gate-title {
      margin: 0;
      font-family: var(--display);
      font-size: clamp(48px, 8vw, 72px);
      font-weight: 400;
      line-height: 0.92;
      letter-spacing: -0.03em;
    }
    .lede {
      margin: 16px 0 0;
      color: var(--muted);
    }
    .gate-label {
      display: block;
      color: var(--faint);
      margin: 36px 0 0;
    }
    .gate-enter { width: 100%; margin-top: 28px; }
    .gate-error {
      min-height: 1.35em;
      margin: 12px 0 0;
      color: var(--failed);
      font-size: 13px;
    }
    .gate-foot {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding: 16px 28px 20px;
      border-top: 1px solid var(--line);
      background: var(--bg-2);
    }
    .gate-foot dt { color: var(--faint); margin: 0 0 6px; }
    .gate-foot dd {
      margin: 0;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }
    .gate-foot a { text-decoration: none; }
    .gate-foot a:hover { color: var(--fg); }
    #app {
      position: relative;
      z-index: 1;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      height: 60px;
      padding: 0 28px;
      display: flex;
      align-items: center;
      gap: 28px;
      border-bottom: 1px solid var(--line);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--display);
      font-size: 20px;
      line-height: 1;
      letter-spacing: -0.02em;
    }
    .tabs {
      display: flex;
      align-items: stretch;
      height: 100%;
      gap: 24px;
      margin-right: auto;
    }
    .tab {
      display: inline-flex;
      align-items: center;
      height: 100%;
      padding: 0;
      border: 0;
      border-bottom: 1px solid transparent;
      margin-bottom: -1px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      transition: color 150ms ease, border-color 150ms ease;
    }
    .tab:hover { color: var(--fg); }
    .tab[aria-selected="true"] {
      color: var(--fg);
      border-bottom-color: var(--fg);
    }
    .stage { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .board {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: calc(100vh - 60px - 36px);
    }
    .machine {
      display: flex;
      flex-direction: column;
      padding: 36px 40px 28px;
      min-height: 100%;
    }
    .machine + .machine { border-left: 1px solid var(--line); }
    .host-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .os { color: var(--faint); margin: 0 0 8px; }
    .host {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--fg);
    }
    .led {
      position: relative;
      width: 6px;
      height: 6px;
      margin-top: 6px;
      border-radius: 6px;
      background: var(--muted);
      flex: none;
    }
    .led.is-live { background: var(--fg); }
    .led.is-live::after {
      content: "";
      position: absolute;
      inset: -5px;
      border: 1px solid var(--fg);
      border-radius: 50%;
      animation: pulse 2.4s ease-out infinite;
    }
    .led.is-failed { background: var(--failed); }
    @keyframes pulse {
      0% { transform: scale(0.7); opacity: 0.55; }
      100% { transform: scale(2.1); opacity: 0; }
    }
    .word {
      margin: 48px 0 0;
      font-family: var(--display);
      font-size: clamp(56px, 7vw, 96px);
      font-style: italic;
      font-weight: 400;
      line-height: 0.9;
      letter-spacing: -0.03em;
      color: var(--fg);
    }
    .word.is-off, .word.is-stopping { color: var(--muted); }
    .word.is-failed {
      color: var(--failed);
      font-style: normal;
    }
    .facts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px 24px;
      margin-top: auto;
    }
    .facts dt { color: var(--faint); margin: 0 0 6px; }
    .facts dd {
      margin: 0;
      font-size: 14px;
    }
    .facts a { text-decoration: none; border-bottom: 1px solid var(--line-strong); }
    .facts a:hover { border-bottom-color: var(--fg); }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid var(--line);
    }
    .panel {
      width: min(1080px, 100% - 56px);
      margin: 36px auto 64px;
    }
    .panel h2 {
      margin: 0;
      font-family: var(--display);
      font-size: 40px;
      font-weight: 400;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    .panel .lede { max-width: 40em; }
    table {
      width: 100%;
      margin-top: 32px;
      border-collapse: collapse;
    }
    th {
      text-align: left;
      color: var(--faint);
      font-weight: 500;
      padding: 0 16px 12px 0;
      border-bottom: 1px solid var(--line);
    }
    td {
      padding: 14px 16px 14px 0;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    td.mono, .empty {
      font-family: var(--mono);
      font-size: 12px;
    }
    .empty { color: var(--muted); padding: 28px 0; }
    .routes { margin-top: 32px; display: grid; }
    .route {
      display: grid;
      grid-template-columns: 88px 1fr auto;
      gap: 16px;
      align-items: center;
      padding: 18px 0;
      border-top: 1px solid var(--line);
    }
    .route:last-child { border-bottom: 1px solid var(--line); }
    .method { color: var(--faint); }
    .path {
      font-family: var(--mono);
      font-size: 13px;
    }
    .blurb {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .app-foot {
      height: auto;
      padding: 10px 28px 12px;
      border-top: 1px solid var(--line);
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.04em;
    }
    .scrim {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.62);
    }
    .dialog {
      width: min(440px, 100%);
      padding: 28px 28px 24px;
      background: var(--surface);
      border: 1px solid var(--line-strong);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
    }
    .dialog h3 {
      margin: 0;
      font-family: var(--display);
      font-size: 32px;
      font-weight: 400;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    .dialog .hint {
      margin: 12px 0 0;
      color: var(--muted);
    }
    .dialog .stack { display: grid; gap: 20px; margin-top: 28px; }
    .dialog .stack .kicker { display: block; color: var(--faint); margin-bottom: 0; }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 32px;
    }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 28px;
      z-index: 60;
      transform: translateX(-50%);
      padding: 12px 18px;
      background: var(--fg);
      color: var(--accent-fg);
      font-size: 13px;
      font-weight: 500;
    }
    @media (max-width: 859px) {
      header {
        height: auto;
        min-height: 60px;
        flex-wrap: wrap;
        padding-top: 14px;
        gap: 12px 28px;
      }
      .brand { order: 1; }
      header .btn-quiet { order: 2; margin-left: auto; }
      .tabs {
        order: 3;
        width: 100%;
        height: 40px;
        margin-right: 0;
        border-top: 1px solid var(--line);
      }
      .board { grid-template-columns: 1fr; }
      .machine + .machine { border-left: 0; border-top: 1px solid var(--line); }
      .panel { width: min(1080px, 100% - 40px); }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <div class="grain" aria-hidden="true"></div>
  <div id="gate">
    <div class="bloom" aria-hidden="true"></div>
    <div class="gate-stack">
      ${MARK.replace('class="mark"', 'class="mark gate-mark"')}
      <p class="kicker gate-kicker">Control Plane</p>
      <h1 class="gate-title">Debug Session</h1>
      <p class="lede">粘贴 Admin Token，打开或关闭两个预留槽。计算仍在 GitHub 上，此页只是开关。</p>
      <label class="kicker gate-label" for="token">Admin Token</label>
      <input id="token" class="field" type="password" autocomplete="off" placeholder="粘贴管理密钥">
      <button class="btn btn-primary gate-enter" id="enter" type="button">进入</button>
      <p class="gate-error" id="gate-error"></p>
    </div>
    <dl class="gate-foot">
      <div>
        <dt>仓库</dt>
        <dd><a href="https://github.com/autoactions/debug-session" target="_blank" rel="noreferrer">autoactions/debug-session</a></dd>
      </div>
      <div>
        <dt>接口</dt>
        <dd>Bearer · GET /api/slots</dd>
      </div>
    </dl>
  </div>
  <div id="app" class="hidden">
    <header>
      <div class="brand">${MARK.replace('class="mark"', 'class="mark brand-mark"')} Debug Session</div>
      <nav class="tabs" aria-label="视图">
        <button class="tab" type="button" data-view="slots" aria-selected="true">槽</button>
        <button class="tab" type="button" data-view="journal" aria-selected="false">日志</button>
        <button class="tab" type="button" data-view="api" aria-selected="false">接口</button>
      </nav>
      <button class="btn btn-quiet" id="lock" type="button">锁定</button>
    </header>
    <main class="stage">
      <section id="view-slots" class="board">
        <article class="machine" data-slot="linux">
          <div class="host-row">
            <div>
              <p class="kicker os">Linux</p>
              <div class="host">debug-session-linux</div>
            </div>
            <span class="led" data-led></span>
          </div>
          <div class="word is-off" data-word>off</div>
          <dl class="facts">
            <div><dt>Slot</dt><dd>linux</dd></div>
            <div><dt>Run</dt><dd data-run>—</dd></div>
            <div><dt>Access</dt><dd data-access>—</dd></div>
            <div><dt>Session</dt><dd data-session>—</dd></div>
          </dl>
          <div class="actions">
            <button class="btn btn-primary" data-action="start" type="button">打开</button>
            <button class="btn btn-ghost" data-action="stop" type="button" disabled>关闭</button>
          </div>
        </article>
        <article class="machine" data-slot="windows">
          <div class="host-row">
            <div>
              <p class="kicker os">Windows</p>
              <div class="host">debug-session-windows</div>
            </div>
            <span class="led" data-led></span>
          </div>
          <div class="word is-off" data-word>off</div>
          <dl class="facts">
            <div><dt>Slot</dt><dd>windows</dd></div>
            <div><dt>Run</dt><dd data-run>—</dd></div>
            <div><dt>WSL</dt><dd data-wsl>—</dd></div>
            <div><dt>Session</dt><dd data-session>—</dd></div>
          </dl>
          <div class="actions">
            <button class="btn btn-primary" data-action="start" type="button">打开</button>
            <button class="btn btn-ghost" data-action="stop" type="button" disabled>关闭</button>
          </div>
        </article>
      </section>
      <section id="view-journal" class="panel hidden">
        <h2>日志</h2>
        <p class="lede">此控制面发出的意图。Slot State 仍由 GitHub 运行推导，on 不表示 SSH 已就绪。</p>
        <p class="empty" id="journal-empty">尚无意图</p>
        <table class="hidden" id="journal-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Slot</th>
              <th>Intent</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody id="journal-body"></tbody>
        </table>
      </section>
      <section id="view-api" class="panel hidden">
        <h2>接口</h2>
        <p class="lede">四个 Bearer 路由。Authorization: Bearer &lt;Admin Token&gt;。</p>
        <div class="routes">
          <div class="route">
            <div class="method">GET</div>
            <div>
              <div class="path">/api/slots</div>
              <p class="blurb">列出两个槽的 Slot State、主机名与运行链接。</p>
            </div>
            <button class="btn btn-quiet" type="button" data-copy="/api/slots">复制</button>
          </div>
          <div class="route">
            <div class="method">GET</div>
            <div>
              <div class="path">/api/slots/{linux|windows}</div>
              <p class="blurb">读取单个槽。state 为 off / starting / on / stopping / failed。</p>
            </div>
            <button class="btn btn-quiet" type="button" data-copy="/api/slots/linux">复制</button>
          </div>
          <div class="route">
            <div class="method">POST</div>
            <div>
              <div class="path">/api/slots/{linux|windows}/start</div>
              <p class="blurb">打开 Debug Session。Linux 可带 Access Profile 与 Session Profile；Windows 可带 Session Profile 与 WSL。</p>
            </div>
            <button class="btn btn-quiet" type="button" data-copy="/api/slots/linux/start">复制</button>
          </div>
          <div class="route">
            <div class="method">POST</div>
            <div>
              <div class="path">/api/slots/{linux|windows}/stop</div>
              <p class="blurb">关闭进行中的 Debug Session。</p>
            </div>
            <button class="btn btn-quiet" type="button" data-copy="/api/slots/linux/stop">复制</button>
          </div>
        </div>
      </section>
    </main>
    <footer class="app-foot">on 表示运行在进行中，不表示 SSH 已就绪</footer>
  </div>
  <div id="dialog" class="scrim hidden" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <form class="dialog" id="start-form">
      <h3 id="dialog-title">打开</h3>
      <p class="hint" id="dialog-hint"></p>
      <div class="stack" id="dialog-fields"></div>
      <div class="dialog-actions">
        <button class="btn btn-ghost" id="dialog-cancel" type="button">取消</button>
        <button class="btn btn-primary" type="submit">确认</button>
      </div>
    </form>
  </div>
  <div id="toast" class="toast hidden" role="status"></div>
  <script>
    const STORAGE = "debug-session-admin-token";
    const PROFILE_KEY = "debug-session-profiles";
    const JOURNAL_KEY = "debug-session-journal";
    const tokenInput = document.getElementById("token");
    const gateError = document.getElementById("gate-error");
    const gate = document.getElementById("gate");
    const app = document.getElementById("app");
    const toastEl = document.getElementById("toast");
    const dialog = document.getElementById("dialog");
    const startForm = document.getElementById("start-form");
    const dialogTitle = document.getElementById("dialog-title");
    const dialogHint = document.getElementById("dialog-hint");
    const dialogFields = document.getElementById("dialog-fields");
    const closing = { linux: false, windows: false };
    const profiles = loadProfiles();
    let journal = loadJournal();
    let toastTimer = 0;
    let startSlot = "linux";
    let view = "slots";

    tokenInput.value = sessionStorage.getItem(STORAGE) || "";

    function token() {
      return tokenInput.value.trim();
    }

    function persistToken() {
      sessionStorage.setItem(STORAGE, token());
    }

    function loadProfiles() {
      try { return JSON.parse(sessionStorage.getItem(PROFILE_KEY) || "{}"); }
      catch (e) { return {}; }
    }

    function saveProfiles() {
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    }

    function loadJournal() {
      try { return JSON.parse(sessionStorage.getItem(JOURNAL_KEY) || "[]"); }
      catch (e) { return []; }
    }

    function saveJournal() {
      sessionStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    }

    function toast(message) {
      toastEl.textContent = message;
      toastEl.classList.remove("hidden");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.add("hidden"); }, 2200);
    }

    function setView(name) {
      view = name;
      document.querySelectorAll(".tab").forEach(function (tab) {
        tab.setAttribute("aria-selected", tab.dataset.view === name ? "true" : "false");
      });
      document.getElementById("view-slots").classList.toggle("hidden", name !== "slots");
      document.getElementById("view-journal").classList.toggle("hidden", name !== "journal");
      document.getElementById("view-api").classList.toggle("hidden", name !== "api");
    }

    function unlock() {
      gate.classList.add("hidden");
      app.classList.remove("hidden");
      document.body.classList.add("is-app");
      setView(view);
    }

    function lock() {
      sessionStorage.removeItem(STORAGE);
      tokenInput.value = "";
      gateError.textContent = "";
      app.classList.add("hidden");
      gate.classList.remove("hidden");
      document.body.classList.remove("is-app");
      toast("已锁定");
    }

    async function api(path, method, body) {
      const headers = { Authorization: "Bearer " + token() };
      var init = { method: method || "GET", headers: headers };
      if (body) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }
      const response = await fetch(path, init);
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.error || ("HTTP " + response.status));
      return data;
    }

    function runLabel(slot) {
      if (!slot.runUrl) return "—";
      const match = slot.runUrl.match(/\\/runs\\/(\\d+)/);
      const label = match ? "#" + match[1] : "run";
      return '<a href="' + slot.runUrl + '" target="_blank" rel="noreferrer">' + label + "</a>";
    }

    function paint(slot) {
      if (closing[slot.id] && (slot.state === "on" || slot.state === "starting")) {
        slot = Object.assign({}, slot, { state: "stopping" });
      }
      if (slot.state === "off" || slot.state === "failed") closing[slot.id] = false;
      const card = document.querySelector('[data-slot="' + slot.id + '"]');
      const word = card.querySelector("[data-word]");
      word.textContent = slot.state;
      word.className = "word is-" + slot.state;
      const led = card.querySelector("[data-led]");
      const live = slot.state === "on" || slot.state === "starting";
      led.className = "led" + (live ? " is-live" : "") + (slot.state === "failed" ? " is-failed" : "");
      card.querySelector("[data-run]").innerHTML = runLabel(slot);
      const remembered = profiles[slot.id] || {};
      if (slot.id === "linux") {
        card.querySelector("[data-access]").textContent = remembered.access_profile || "—";
      } else {
        card.querySelector("[data-wsl]").textContent = remembered.enable_wsl === "true" ? "on" : remembered.enable_wsl === "false" ? "off" : "—";
      }
      card.querySelector("[data-session]").textContent = remembered.session_profile || "—";
      const active = slot.state === "on" || slot.state === "starting" || slot.state === "stopping";
      card.querySelector('[data-action="start"]').disabled = active;
      card.querySelector('[data-action="stop"]').disabled = !active;
    }

    function renderJournal() {
      const empty = document.getElementById("journal-empty");
      const table = document.getElementById("journal-table");
      const body = document.getElementById("journal-body");
      body.innerHTML = "";
      if (!journal.length) {
        empty.classList.remove("hidden");
        table.classList.add("hidden");
        return;
      }
      empty.classList.add("hidden");
      table.classList.remove("hidden");
      journal.forEach(function (row) {
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td class="mono">' + row.time + "</td>" +
          '<td class="mono">' + row.slot + "</td>" +
          '<td class="mono">' + row.intent + "</td>" +
          "<td>" + row.detail + "</td>";
        body.appendChild(tr);
      });
    }

    function record(slot, intent, detail) {
      journal.unshift({
        time: new Date().toISOString().replace("T", " ").replace(/\\.\\d+Z$/, "Z"),
        slot: slot,
        intent: intent,
        detail: detail,
      });
      if (journal.length > 80) journal = journal.slice(0, 80);
      saveJournal();
      renderJournal();
    }

    async function refresh() {
      if (!token()) return;
      const body = await api("/api/slots");
      body.slots.forEach(paint);
    }

    async function enter() {
      if (!token()) {
        gateError.textContent = "需要 Admin Token";
        return;
      }
      try {
        persistToken();
        await refresh();
        gateError.textContent = "";
        unlock();
      } catch (err) {
        gateError.textContent = err.message === "unauthorized" ? "Admin Token 无效" : err.message;
      }
    }

    function openDialog(slot) {
      startSlot = slot;
      const remembered = profiles[slot] || {};
      if (slot === "linux") {
        dialogTitle.textContent = "打开 Linux";
        dialogHint.textContent = "Access Profile 决定入口通道；Session Profile 决定装机深度。";
        dialogFields.innerHTML =
          '<label><span class="kicker">Access Profile</span>' +
          '<select class="field" name="access_profile">' +
          '<option value="mini"' + (remembered.access_profile !== "full" ? " selected" : "") + ">mini</option>" +
          '<option value="full"' + (remembered.access_profile === "full" ? " selected" : "") + ">full</option>" +
          "</select></label>" +
          '<label><span class="kicker">Session Profile</span>' +
          '<select class="field" name="session_profile">' +
          '<option value="core"' + (remembered.session_profile === "core" ? " selected" : "") + ">core</option>" +
          '<option value="developer"' + (remembered.session_profile !== "core" ? " selected" : "") + ">developer</option>" +
          "</select></label>";
      } else {
        dialogTitle.textContent = "打开 Windows";
        dialogHint.textContent = "Session Profile 决定装机深度。需要 Linux 子系统时再打开 WSL。";
        dialogFields.innerHTML =
          '<label><span class="kicker">Session Profile</span>' +
          '<select class="field" name="session_profile">' +
          '<option value="core"' + (remembered.session_profile === "core" ? " selected" : "") + ">core</option>" +
          '<option value="developer"' + (remembered.session_profile !== "core" ? " selected" : "") + ">developer</option>" +
          "</select></label>" +
          '<label><span class="kicker">WSL</span>' +
          '<select class="field" name="enable_wsl">' +
          '<option value="false"' + (remembered.enable_wsl !== "true" ? " selected" : "") + ">off</option>" +
          '<option value="true"' + (remembered.enable_wsl === "true" ? " selected" : "") + ">on</option>" +
          "</select></label>";
      }
      dialog.classList.remove("hidden");
    }

    function closeDialog() {
      dialog.classList.add("hidden");
    }

    document.getElementById("enter").addEventListener("click", enter);
    tokenInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") enter();
    });
    document.getElementById("lock").addEventListener("click", lock);
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () { setView(tab.dataset.view); });
    });
    document.querySelectorAll("[data-action]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const slot = button.closest("[data-slot]").dataset.slot;
        if (button.dataset.action === "start") {
          openDialog(slot);
          return;
        }
        try {
          const next = await api("/api/slots/" + slot + "/stop", "POST");
          closing[slot] = true;
          paint(next);
          record(slot, "stop", "关闭");
          toast("已发出关闭");
        } catch (err) {
          toast(err.message);
        }
      });
    });
    document.getElementById("dialog-cancel").addEventListener("click", closeDialog);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDialog();
    });
    startForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const data = new FormData(startForm);
      const body = {};
      data.forEach(function (value, key) { body[key] = value; });
      try {
        const next = await api("/api/slots/" + startSlot + "/start", "POST", body);
        profiles[startSlot] = body;
        saveProfiles();
        paint(next);
        const detail = startSlot === "linux"
          ? "access " + body.access_profile + " · session " + body.session_profile
          : "session " + body.session_profile + " · wsl " + (body.enable_wsl === "true" ? "on" : "off");
        record(startSlot, "start", detail);
        closeDialog();
        toast("已发出打开");
      } catch (err) {
        toast(err.message);
      }
    });
    document.querySelectorAll("[data-copy]").forEach(function (button) {
      button.addEventListener("click", async function () {
        try {
          await navigator.clipboard.writeText(button.dataset.copy);
          toast("已复制");
        } catch (e) {
          toast(button.dataset.copy);
        }
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeDialog();
    });
    renderJournal();
    setInterval(function () {
      if (app.classList.contains("hidden")) return;
      refresh().catch(function (err) { toast(err.message); });
    }, 5000);
    if (token()) enter();
  </script>
</body>
</html>`;
}
