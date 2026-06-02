import { useEffect, useState } from "react";

interface Settings {
  theme: "dark" | "light";
  rateLimitPerMinute: number;
  maintenanceMode: boolean;
  welcomeMessage: string;
  instance?: string;
}

const defaultSettings: Settings = {
  theme: "dark",
  rateLimitPerMinute: 600,
  maintenanceMode: false,
  welcomeMessage: "Welcome to Neo. Oracle is optional.",
};

async function getJson<T>(path: string): Promise<T> {
  const token = (localStorage.getItem("neo_admin_token") ?? "").trim();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<string>("Loading settings...");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    setToken(localStorage.getItem("neo_admin_token") ?? "");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getJson<Settings>("/api/settings");
        setSettings({ ...defaultSettings, ...data });
        setStatus("Control plane online.");
      } catch (err) {
        setStatus(String(err));
      }
    })();
  }, []);

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setStatus("Saving...");
    try {
      const entries: [keyof Settings, unknown][] = [
        ["theme", settings.theme],
        ["rateLimitPerMinute", settings.rateLimitPerMinute],
        ["maintenanceMode", settings.maintenanceMode],
        ["welcomeMessage", settings.welcomeMessage],
      ];
      for (const [key, value] of entries) {
        const authToken = (localStorage.getItem("neo_admin_token") ?? "").trim();
        const res = await fetch(`/api/settings/${key}`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ value }),
        });
        if (!res.ok) throw new Error(`Failed to save ${key}`);
      }
      setStatus("Saved settings to Postgres + Redis cache.");
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setStatus("Applying and smoke-testing...");
    try {
      const applyRes = await getJson<{ instance?: string }>("/api/settings/apply");
      const pingRes = await getJson<{ instance: string; globalPingCount: number }>(
        "/scale/ping"
      );
      setStatus(
        `Applied on ${applyRes.instance ?? "?"}; /scale/ping from ${
          pingRes.instance
        } globalPingCount=${pingRes.globalPingCount}`
      );
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    setStatus("Refreshing...");
    try {
      const data = await getJson<Settings>("/api/settings");
      setSettings({ ...defaultSettings, ...data });
      setStatus("Refreshed from API.");
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return (
      <div className="shell">
        <div className="hero">
          <div>
            <h1>Neo Control Plane</h1>
            <p className="sub">Bootstrapping…</p>
          </div>
        </div>
        <div className="status">{status}</div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="hero">
        <div>
          <h1>Neo Control Plane</h1>
          <p className="sub">Change settings instantly. No Oracle forms. No change board.</p>
        </div>
        <div className="pill">instance: {settings.instance ?? "unknown"}</div>
      </div>
      <div className="grid">
        <div className="card">
          <div className="label">Security</div>
          <div className="title">Admin Token</div>
          <p className="muted">Required in production. Stored locally in your browser.</p>
          <input
            type="password"
            value={token}
            onChange={(e) => {
              const next = e.target.value;
              setToken(next);
              localStorage.setItem("neo_admin_token", next);
            }}
            placeholder="Paste ADMIN_TOKEN"
          />
        </div>
        <div className="card">
          <div className="label">Theme</div>
          <div className="title">Dashboard Theme</div>
          <p className="muted">Controls preferred client theme.</p>
          <select
            value={settings.theme}
            onChange={(e) => updateField("theme", e.target.value as Settings["theme"])}
          >
            <option value="dark">dark</option>
            <option value="light">light</option>
          </select>
        </div>
        <div className="card">
          <div className="label">Rate Limit</div>
          <div className="title">Requests / Minute</div>
          <p className="muted">API policy hint for downstream limiters.</p>
          <input
            type="number"
            min={1}
            value={settings.rateLimitPerMinute}
            onChange={(e) =>
              updateField("rateLimitPerMinute", Number(e.target.value) || 0)
            }
          />
        </div>
        <div className="card">
          <div className="label">Maintenance</div>
          <div className="title">Maintenance Mode</div>
          <p className="muted">Flag runtime as maintenance.</p>
          <select
            value={settings.maintenanceMode ? "true" : "false"}
            onChange={(e) => updateField("maintenanceMode", e.target.value === "true")}
          >
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        </div>
        <div className="card span-2">
          <div className="label">Messaging</div>
          <div className="title">Welcome Message</div>
          <p className="muted">Customer-visible string used by services.</p>
          <textarea
            rows={4}
            value={settings.welcomeMessage}
            onChange={(e) => updateField("welcomeMessage", e.target.value)}
          />
        </div>
      </div>
      <div className="row">
        <button onClick={refresh} disabled={busy} className="secondary">
          Refresh
        </button>
        <button onClick={save} disabled={busy}>
          Save Settings
        </button>
        <button onClick={apply} disabled={busy} className="secondary">
          Apply + Smoke Test
        </button>
      </div>
      <div className="status">{status}</div>
    </div>
  );
}

