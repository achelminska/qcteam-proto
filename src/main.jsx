import "./storage-shim.js";
import "./index.css";
// Barcode decoder for browsers without a native BarcodeDetector (Safari): ZXing reads frames from the camera preview
import * as ZXingBrowser from "@zxing/browser";
window.ZXingBrowser = ZXingBrowser;
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
createRoot(document.getElementById("root")).render(<App />);
// Stop controlling this origin with a service worker. The shell cache kept iOS home-screen copies
// on an old bundle after every Render deploy; the data layer already works offline without it.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))).catch(() => {});
    caches.keys().then(keys => Promise.all(keys.filter(k => String(k).startsWith("qc-shell")).map(k => caches.delete(k)))).catch(() => {});
  });
}
