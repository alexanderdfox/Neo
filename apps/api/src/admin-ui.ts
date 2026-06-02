export const adminUiHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Neo Control Plane</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: radial-gradient(circle at top, #111827, #020617 55%);
      color: #e2e8f0;
    }
    .wrap { max-width: 1000px; margin: 36px auto; padding: 0 20px; }
    .hero {
      display: flex; align-items: center; justify-content: space-between; gap: 20px;
      margin-bottom: 24px;
    }
    h1 { margin: 0; font-size: 28px; letter-spacing: 0.2px; }
    .sub { color: #94a3b8; margin-top: 8px; }
    .pill {
      background: #0f172a; border: 1px solid #334155; border-radius: 999px;
      padding: 8px 12px; font-size: 12px; color: #cbd5e1;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
      margin-bottom: 16px;
    }
    .card {
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 16px;
      backdrop-filter: blur(8px);
    }
    .label { color: #93c5fd; font-size: 12px; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 8px; }
    .title { font-size: 18px; margin-bottom: 8px; }
    .muted { color: #94a3b8; font-size: 13px; margin-bottom: 12px; min-height: 36px; }
    input, textarea, select {
      width: 100%;
      padding: 10px;
      border: 1px solid #475569;
      border-radius: 10px;
      background: #020617;
      color: #e2e8f0;
    }
    .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    button {
      border: 1px solid #334155;
      background: #0ea5e9;
      color: #00111f;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
      padding: 9px 12px;
    }
    button.secondary { background: #0f172a; color: #e2e8f0; }
    .status {
      margin-top: 14px; padding: 10px 12px; border-radius: 10px;
      border: 1px solid #1e293b; background: rgba(2, 6, 23, .8); color: #cbd5e1;
      min-height: 38px;
    }
    code { color: #a5f3fc; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div>
        <h1>Neo Control Plane</h1>
        <div class="sub">Change settings instantly. No Oracle forms. No change board.</div>
      </div>
      <div class="pill" id="instancePill">instance: loading...</div>
    </div>
    <div class="grid">
      <div class="card">
        <div class="label">Theme</div>
        <div class="title">Dashboard Theme</div>
        <div class="muted">Controls preferred client theme.</div>
        <select id="theme">
          <option value="dark">dark</option>
          <option value="light">light</option>
        </select>
      </div>
      <div class="card">
        <div class="label">Rate Limit</div>
        <div class="title">Requests / Minute</div>
        <div class="muted">API policy hint for downstream limiters.</div>
        <input id="rateLimitPerMinute" type="number" min="1" step="1" />
      </div>
      <div class="card">
        <div class="label">Maintenance</div>
        <div class="title">Maintenance Mode</div>
        <div class="muted">Flag runtime as maintenance.</div>
        <select id="maintenanceMode">
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      </div>
      <div class="card">
        <div class="label">Messaging</div>
        <div class="title">Welcome Message</div>
        <div class="muted">Customer-visible string used by services.</div>
        <textarea id="welcomeMessage" rows="4"></textarea>
      </div>
    </div>
    <div class="row">
      <button id="refreshBtn" class="secondary">Refresh</button>
      <button id="saveBtn">Save Settings</button>
      <button id="applyBtn" class="secondary">Apply + Smoke Test</button>
    </div>
    <div class="status" id="status">Ready.</div>
  </div>
  <script>
    const statusEl = document.getElementById("status");
    const setStatus = (msg) => { statusEl.textContent = msg; };

    async function readSettings() {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    }

    function fillForm(settings) {
      document.getElementById("theme").value = settings.theme ?? "dark";
      document.getElementById("rateLimitPerMinute").value = String(settings.rateLimitPerMinute ?? 600);
      document.getElementById("maintenanceMode").value = String(Boolean(settings.maintenanceMode));
      document.getElementById("welcomeMessage").value = settings.welcomeMessage ?? "";
      document.getElementById("instancePill").textContent = "instance: " + (settings.instance ?? "unknown");
    }

    async function saveSettings() {
      const payload = {
        theme: document.getElementById("theme").value,
        rateLimitPerMinute: Number(document.getElementById("rateLimitPerMinute").value),
        maintenanceMode: document.getElementById("maintenanceMode").value === "true",
        welcomeMessage: document.getElementById("welcomeMessage").value
      };
      for (const [key, value] of Object.entries(payload)) {
        const res = await fetch("/api/settings/" + encodeURIComponent(key), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value })
        });
        if (!res.ok) throw new Error("Failed to save " + key);
      }
      setStatus("Saved. Settings are now persisted in Postgres + cached in Redis.");
    }

    async function applyAndSmoke() {
      const applyRes = await fetch("/api/settings/apply", { method: "POST" });
      if (!applyRes.ok) throw new Error("Failed to apply settings");
      const apply = await applyRes.json();
      const pingRes = await fetch("/scale/ping", { method: "POST" });
      const ping = await pingRes.json();
      setStatus("Applied on " + apply.instance + ". smoke /scale/ping => globalPingCount=" + ping.globalPingCount);
    }

    document.getElementById("refreshBtn").addEventListener("click", async () => {
      try {
        setStatus("Refreshing...");
        const data = await readSettings();
        fillForm(data);
        setStatus("Loaded from API.");
      } catch (err) {
        setStatus(String(err));
      }
    });

    document.getElementById("saveBtn").addEventListener("click", async () => {
      try {
        setStatus("Saving...");
        await saveSettings();
      } catch (err) {
        setStatus(String(err));
      }
    });

    document.getElementById("applyBtn").addEventListener("click", async () => {
      try {
        setStatus("Applying and testing...");
        await applyAndSmoke();
      } catch (err) {
        setStatus(String(err));
      }
    });

    (async () => {
      try {
        const data = await readSettings();
        fillForm(data);
        setStatus("Control plane online.");
      } catch (err) {
        setStatus(String(err));
      }
    })();
  </script>
</body>
</html>`;

