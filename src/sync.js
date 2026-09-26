// Shared-state synchronisation for both apps (Portal.jsx and Mobile.jsx import this — one implementation, one behaviour).
//
// Model: `base` is the last state we know the server has (with its `version`); `pending` is the queue of local edits
// (pure functions state → state) the server has not confirmed yet; the state the UI shows is always
//     local = pending applied on top of base
// That single invariant is what makes every path safe:
//   - a save (PUT with If-Match = version) that succeeds → base = what we sent, drop the confirmed edits; anything the
//     user typed while the request was in flight is still in `pending`, still applied on top, nothing to recompute;
//   - a save that conflicts (409, someone else wrote first) → base = the server's copy, replay ALL pending edits on
//     top of it (including the ones queued while the request was in flight — the old code lost exactly those), retry;
//   - a pull (someone else wrote, we noticed via /meta) → same as a conflict: base = server, replay pending. Pulls are
//     therefore always allowed, even with unsaved edits — no more "skip the pull while pending" windows in which a
//     stale copy could sneak in, and no more "ignore your edits because a pull is in progress" either.
// A pulled or conflicted copy is only accepted if its version is NEWER than ours: responses from a GET that was in
// flight while our own save landed carry an older version and are dropped, so a confirmed edit can't flicker away.
// Network errors keep the queue intact and the poll retries; nothing is ever dropped because a request failed.
//
// A reload is not a network error: it throws the in-memory queue away. The UI already showed the edit (a finished
// skip, a remark) and the PUT may still be in flight or not started — warehouse Wi‑Fi, or the controller refreshing
// to "check it stuck". Every unconfirmed local state is therefore written to a device-local snapshot, synchronously,
// before the debounce. The next load puts it back: wholesale when the server is still the version we edited, or by
// merging our records in when someone else saved in between. A confirmed save deletes the snapshot.

const parseState = (txt, isValid) => { try { const p = JSON.parse(txt); return isValid(p) ? p : null; } catch { return null; } };
const newer = (v, than) => !!v && (!than || Number(v) > Number(than));

// Records a controller creates or finishes. When the server moved on while our save was still unconfirmed, keep
// these from the device and keep everything else (catalog, dock rows, …) from the server.
const RECORD_LISTS = ["inspections", "flags", "notifications", "announcements", "conversations"];
const recordStamp = o => [o?.completedAt, o?.lastEditedAt, o?.answeredAt, o?.updatedAt, o?.startedAt, o?.createdAt].filter(Boolean).sort().at(-1) || "";
const recordRank = o => ({ Completed: 3, PendingReview: 2, Draft: 1 }[o?.status] ?? 0);

export function mergeForward(base, local) {
  const mergeList = (serverList, localList) => {
    const out = new Map();
    for (const item of serverList || []) if (item && item.id != null) out.set(item.id, item);
    for (const item of localList || []) {
      if (!item || item.id == null) continue;
      const prev = out.get(item.id);
      if (!prev) { out.set(item.id, item); continue; }
      const ls = recordStamp(item), ps = recordStamp(prev);
      if (ls > ps || (ls === ps && ((item.audit || []).length > (prev.audit || []).length || recordRank(item) > recordRank(prev)))) out.set(item.id, item);
    }
    return [...out.values()];
  };
  const next = { ...base };
  for (const k of RECORD_LISTS) next[k] = mergeList(base[k], local[k]);
  return next;
}

/**
 * @param {object} o
 * @param {string} o.key                  storage key of the shared state
 * @param {(raw: object) => object} o.normalize   normalize + sort a state that came from the server
 * @param {(p: any) => boolean} o.isValid          shape check for a parsed server copy
 * @param {object} o.initial                       state to show when the server has nothing yet
 * @param {(state: object) => void} o.onState      push the new local state to React
 * @param {(msg: string) => void} [o.onToast]
 * @param {object} [o.storage]                     defaults to window.storage (injectable for tests)
 * @param {object} [o.localStore]                  defaults to localStorage; holds the unconfirmed snapshot
 */
export function createSyncer({ key, normalize, isValid, initial, onState, onToast, storage, localStore }) {
  const sy = { base: null, version: null, pending: [], local: initial, busy: false, loaded: false, flushTimer: null, disposed: false };
  const pendingKey = key + ":pending";
  const S = () => storage || (typeof window !== "undefined" ? window.storage : null);
  const disk = () => localStore || (typeof localStorage !== "undefined" ? localStorage : null);
  const toast = m => { try { onToast && onToast(m); } catch {} };
  // Synchronous: a refresh can happen before the debounced PUT starts. Failures (private mode, quota) leave us no
  // worse than before — the in-memory queue still tries the network.
  const remember = () => {
    const d = disk(); if (!d) return;
    try {
      if (!sy.pending.length) d.removeItem(pendingKey);
      else d.setItem(pendingKey, JSON.stringify({ version: sy.version, value: JSON.stringify(sy.local) }));
    } catch (e) { console.warn("QCteam: could not keep an unconfirmed edit on this device", e); }
  };
  const readPending = () => {
    const d = disk(); if (!d) return null;
    try { const raw = d.getItem(pendingKey); if (!raw) return null; const p = JSON.parse(raw); return p && typeof p.value === "string" ? p : null; } catch { return null; }
  };
  const replay = (base, ops) => ops.reduce((acc, op) => { try { return op.fn(acc); } catch (e) { console.warn("QCteam: could not re-apply a change", e); return acc; } }, base);
  const emit = () => onState(sy.local);
  const adoptServerCopy = (value, version) => {
    const p = parseState(value, isValid); if (!p) return false;
    sy.base = normalize(p); sy.version = version || null; sy.local = replay(sy.base, sy.pending); emit(); remember(); return true;
  };

  const scheduleFlush = (delay = 150) => {
    if (sy.disposed || !sy.loaded) return;
    if (sy.flushTimer) clearTimeout(sy.flushTimer);
    sy.flushTimer = setTimeout(() => { sy.flushTimer = null; flush(); }, delay);
  };

  const flush = async () => {
    const st = S(); if (sy.disposed || !sy.loaded || sy.busy || !sy.pending.length || !st) return;
    sy.busy = true; let retryNow = false;
    try {
      if (!st.setVersioned) { try { await st.set(key, JSON.stringify(sy.local)); } catch {} sy.pending.length = 0; return; }
      for (let attempt = 0; attempt < 8 && sy.pending.length; attempt++) {
        const ops = sy.pending.slice(), candidate = sy.local;
        const res = await st.setVersioned(key, JSON.stringify(candidate), sy.version, { force: ops.some(o => o.force) });
        if (!res || res.error) break; // offline / dropped connection: keep the queue, the poll retries in a few seconds
        if (res.rejected) {
          // The server's size guard refused it (an almost-empty state over a populated one without an explicit force).
          // These edits can't be saved as they are: drop them, show the server's copy, and say so — not silently.
          sy.pending.splice(0, ops.length); toast("Save refused by the server — it would wipe most of the shared data. Reloaded the server's copy.");
          const r = await st.get(key); if (r?.value) adoptServerCopy(r.value, r.version); else { sy.local = replay(sy.base || initial, sy.pending); emit(); }
          break;
        }
        if (res.conflict) {
          if (res.value != null && (newer(res.version, sy.version) || !sy.version)) adoptServerCopy(res.value, res.version);
          else if (res.value != null) { /* stale copy — keep ours, but we still need its version to retry */ sy.version = res.version || sy.version; }
          continue; // our edits are now applied on top of the server's copy — save that
        }
        // Saved. Whatever was queued while the request was in flight is already applied on top of `candidate`.
        sy.pending.splice(0, ops.length); sy.base = candidate; if (res.version) sy.version = res.version;
        retryNow = sy.pending.length > 0; break;
      }
    } finally { sy.busy = false; remember(); if (retryNow) scheduleFlush(0); }
  };

  // A refresh mid-save aborts the PUT. Flush as the page goes away; the snapshot covers a request the browser kills.
  const onPageHide = () => { if (!sy.disposed && sy.pending.length) flush(); };
  if (typeof window !== "undefined") window.addEventListener("pagehide", onPageHide);

  const pull = async () => {
    const st = S(); if (sy.disposed || !sy.loaded || sy.busy || !st) return false;
    let r; try { r = await st.get(key); } catch { return false; }
    if (sy.busy || !r?.value) return false;               // a save started meanwhile — its result decides, not this GET
    if (!r.version) return false;                          // offline fallback copy from this device: not the server's truth
    if (!newer(r.version, sy.version)) return false;       // same or older than what we already have
    return adoptServerCopy(r.value, r.version);
  };

  return {
    state: sy,
    /** Queue a local edit and show it immediately. `fn` must be a pure function of the state (it may be re-applied). */
    apply(fn, { force = false } = {}) {
      const op = { fn, force }; sy.pending.push(op);
      try { sy.local = fn(sy.local); } catch (e) { console.warn("QCteam: change failed", e); sy.pending.pop(); return; }
      emit(); remember(); scheduleFlush();
    },
    /** First load: adopt the server's copy (or start from `initial`). An unconfirmed snapshot from a previous
     *  page — a finished inspection the PUT never confirmed — is put back and saved. */
    async load() {
      try { const st = S(); if (st) { const r = await st.get(key); if (r?.value) { const p = parseState(r.value, isValid); if (p) { sy.base = normalize(p); sy.version = r.version || null; } } } } catch {}
      if (!sy.base) sy.base = normalize(initial);
      const snap = readPending();
      const parsed = snap ? parseState(snap.value, isValid) : null;
      const snapNorm = parsed ? normalize(parsed) : null;
      if (snapNorm) {
        const sameBase = !sy.version || snap.version === sy.version;
        sy.local = sameBase ? snapNorm : mergeForward(sy.base, snapNorm);
        if (JSON.stringify(sy.local) !== JSON.stringify(sy.base)) {
          const frozen = snapNorm;
          sy.pending = [{ fn: base => mergeForward(base, frozen) }];
        }
      }
      if (!sy.pending.length) sy.local = sy.base;
      sy.loaded = true; emit(); remember();
      if (sy.pending.length) scheduleFlush(0);
    },
    flush, pull,
    /** One poll tick: retry unsaved edits first; otherwise pull if the server's version moved. */
    async tick() {
      if (sy.disposed || !sy.loaded) return;
      if (sy.pending.length) { await flush(); return; }
      const st = S(); if (!st?.getMeta) return;
      const v = await st.getMeta(key);
      if (v && v !== sy.version) await pull();
    },
    hasUnsaved: () => sy.pending.length > 0 || sy.busy,
    dispose() { sy.disposed = true; if (sy.flushTimer) clearTimeout(sy.flushTimer); if (typeof window !== "undefined") window.removeEventListener("pagehide", onPageHide); },
  };
}

/** Ask before leaving with unsaved edits (a reload mid-save would lose whatever is still in the queue). */
export function guardUnload(syncer) {
  const h = e => { if (syncer.hasUnsaved()) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", h);
  return () => window.removeEventListener("beforeunload", h);
}
