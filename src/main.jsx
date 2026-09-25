import "./storage-shim.js";
import "./index.css";
// Barcode decoder for browsers without a native BarcodeDetector (Safari): ZXing reads frames from the camera preview
import * as ZXingBrowser from "@zxing/browser";
window.ZXingBrowser = ZXingBrowser;
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
createRoot(document.getElementById("root")).render(<App />);
// Offline app shell (production only — in dev Vite serves modules the worker must not cache).
if (import.meta.env.PROD && "serviceWorker" in navigator) { window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); }); }
