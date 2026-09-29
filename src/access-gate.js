// Access key gate. The server (server/auth.mjs) answers 401 to anything that holds data until the device has
// presented the deployment's access key once; it then sets an HttpOnly cookie that every later request carries —
// including photos loaded by <img>, which no JavaScript header could reach.
//
// Two jobs here, both framework-free so neither prototype has to change:
//   1. wrap window.fetch so every call to our API goes out with credentials (needed only when the app and the
//      server are on different ports, i.e. Vite dev), and a 401 raises the gate;
//   2. the gate itself: a small overlay asking for the key, POST /auth/login, reload on success.
const API = /^\/(storage|meta|photos|sheet|backups|proxy|auth)(\/|$)/;
const ACCENT = "#1F5C3E";
let shown = false;
let nativeFetch = null;

export function installAccessGate(server) {
  if (nativeFetch || typeof window === "undefined") return;
  nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    let abs;
    try { abs = new URL(typeof input === "string" ? input : input.url, location.href); } catch { return nativeFetch(input, init); }
    const ours = abs.origin === server || (abs.origin === location.origin && API.test(abs.pathname));
    if (!ours) return nativeFetch(input, init);
    const r = await nativeFetch(input, { ...(init || {}), credentials: "include" });
    if (r.status === 401 && !abs.pathname.startsWith("/auth/")) showGate(server);
    return r;
  };
}

function showGate(server) {
  if (shown || typeof document === "undefined") return;
  shown = true;
  const root = document.createElement("div");
  root.id = "qc-access-gate";
  root.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(17,24,19,.72);backdrop-filter:blur(3px);font:15px/1.45 -apple-system,'Segoe UI',Roboto,sans-serif;color:#182219";
  root.innerHTML = `
    <form style="width:min(360px,100%);background:#fff;border-radius:16px;padding:22px 22px 18px;box-shadow:0 20px 60px rgba(0,0,0,.35)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="width:30px;height:30px;border-radius:9px;background:${ACCENT};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700">Q</span>
        <b style="font-size:17px">Access key</b>
      </div>
      <p style="margin:0 0 14px;color:#6a776e;font-size:13px">This device has not been unlocked yet. Enter the QCteam access key from your Head — once per device.</p>
      <input name="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="access key"
             style="width:100%;box-sizing:border-box;font-size:16px;padding:10px 12px;border:1px solid #dde3de;border-radius:10px;outline:none" />
      <div data-err style="min-height:18px;margin:6px 0 10px;color:#a63d3d;font-size:13px"></div>
      <button type="submit" style="width:100%;padding:11px;border:0;border-radius:10px;background:${ACCENT};color:#fff;font-weight:600;font-size:15px;cursor:pointer">Unlock this device</button>
    </form>`;
  document.body.appendChild(root);
  const form = root.querySelector("form"), input = root.querySelector("input"), err = root.querySelector("[data-err]"), btn = root.querySelector("button");
  setTimeout(() => input.focus(), 50);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = input.value.trim(); if (!key) return;
    btn.disabled = true; err.textContent = "";
    try {
      const r = await nativeFetch(`${server}/auth/login`, { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      if (r.ok) { location.reload(); return; }
      err.textContent = r.status === 401 ? "That key is not right." : `Could not unlock (${r.status}).`;
    } catch { err.textContent = "No connection to the server."; }
    btn.disabled = false; input.select();
  });
}
