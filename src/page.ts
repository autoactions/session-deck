export function renderPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Debug Session</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0f1419;
      --card: #1a222c;
      --text: #e8eef4;
      --muted: #93a0ae;
      --line: #2b3642;
      --off: #6b7280;
      --starting: #d97706;
      --on: #16a34a;
      --stopping: #2563eb;
      --failed: #dc2626;
      --accent: #38bdf8;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f4f7fa;
        --card: #ffffff;
        --text: #12202c;
        --muted: #5b6b7a;
        --line: #d5dee6;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font: 16px/1.5 ui-sans-serif, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    main {
      max-width: 880px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3rem;
    }
    h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
    .lede { color: var(--muted); margin: 0 0 1.5rem; }
    .token-row, .slots {
      display: grid;
      gap: 1rem;
    }
    @media (min-width: 720px) {
      .slots { grid-template-columns: 1fr 1fr; }
    }
    label { display: block; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.35rem; }
    input, button {
      font: inherit;
      border-radius: 10px;
    }
    input {
      width: 100%;
      padding: 0.7rem 0.8rem;
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--text);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 1.1rem 1.15rem 1.2rem;
    }
    .card h2 { margin: 0 0 0.2rem; font-size: 1.15rem; text-transform: capitalize; }
    .host { color: var(--muted); font-family: ui-monospace, monospace; font-size: 0.9rem; }
    .state {
      display: inline-block;
      margin: 0.8rem 0;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;
      background: color-mix(in srgb, var(--tone) 18%, transparent);
      color: var(--tone);
    }
    .actions { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
    button {
      border: 0;
      padding: 0.55rem 0.9rem;
      background: var(--accent);
      color: #06202b;
      font-weight: 650;
      cursor: pointer;
    }
    button.secondary { background: transparent; color: var(--text); border: 1px solid var(--line); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    a { color: var(--accent); }
    .error { color: var(--failed); min-height: 1.3em; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <main>
    <h1>Debug Session</h1>
    <p class="lede">打开或关闭 Linux / Windows 槽。机器仍在 GitHub-hosted runner 上，这里只是开关。</p>
    <div class="card token-row">
      <div>
        <label for="token">Admin Token</label>
        <input id="token" type="password" autocomplete="off" placeholder="粘贴管理密钥">
      </div>
    </div>
    <p class="error" id="error"></p>
    <section class="slots">
      <article class="card" data-slot="linux">
        <h2>linux</h2>
        <div class="host">debug-session-linux</div>
        <div class="state" style="--tone: var(--off)">off</div>
        <div class="actions">
          <button data-action="start">打开</button>
          <button class="secondary" data-action="stop">关闭</button>
          <a class="run hidden" target="_blank" rel="noreferrer">GitHub run</a>
        </div>
      </article>
      <article class="card" data-slot="windows">
        <h2>windows</h2>
        <div class="host">debug-session-windows</div>
        <div class="state" style="--tone: var(--off)">off</div>
        <div class="actions">
          <button data-action="start">打开</button>
          <button class="secondary" data-action="stop">关闭</button>
          <a class="run hidden" target="_blank" rel="noreferrer">GitHub run</a>
        </div>
      </article>
    </section>
  </main>
  <script>
    const tokenInput = document.getElementById("token");
    const errorEl = document.getElementById("error");
    const STORAGE = "debug-session-admin-token";
    const closing = { linux: false, windows: false };
    tokenInput.value = sessionStorage.getItem(STORAGE) || "";

    function token() {
      const value = tokenInput.value.trim();
      sessionStorage.setItem(STORAGE, value);
      return value;
    }

    async function api(path, method) {
      const response = await fetch(path, {
        method: method || "GET",
        headers: { Authorization: "Bearer " + token() },
      });
      const body = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(body.error || ("HTTP " + response.status));
      }
      return body;
    }

    function paint(slot) {
      if (closing[slot.id] && (slot.state === "on" || slot.state === "starting")) {
        slot = Object.assign({}, slot, { state: "stopping" });
      }
      if (slot.state === "off" || slot.state === "failed") closing[slot.id] = false;
      const card = document.querySelector('[data-slot="' + slot.id + '"]');
      const stateEl = card.querySelector(".state");
      stateEl.textContent = slot.state;
      stateEl.style.setProperty("--tone", "var(--" + slot.state + ")");
      const run = card.querySelector(".run");
      if (slot.runUrl) {
        run.href = slot.runUrl;
        run.classList.remove("hidden");
      } else {
        run.removeAttribute("href");
        run.classList.add("hidden");
      }
      const active = slot.state === "on" || slot.state === "starting" || slot.state === "stopping";
      card.querySelector('[data-action="start"]').disabled = active;
      card.querySelector('[data-action="stop"]').disabled = !active;
    }

    async function refresh() {
      if (!token()) return;
      const body = await api("/api/slots");
      body.slots.forEach(paint);
      errorEl.textContent = "";
    }

    document.querySelectorAll("[data-action]").forEach(function (button) {
      button.addEventListener("click", async function () {
        const slot = button.closest("[data-slot]").dataset.slot;
        try {
          const next = await api("/api/slots/" + slot + "/" + button.dataset.action, "POST");
          if (button.dataset.action === "stop") closing[slot] = true;
          paint(next);
          errorEl.textContent = "";
        } catch (err) {
          errorEl.textContent = err.message;
        }
      });
    });

    tokenInput.addEventListener("change", refresh);
    tokenInput.addEventListener("keyup", function (event) {
      if (event.key === "Enter") refresh();
    });
    setInterval(function () { refresh().catch(function (err) { errorEl.textContent = err.message; }); }, 5000);
    refresh().catch(function (err) { errorEl.textContent = err.message; });
  </script>
</body>
</html>`;
}