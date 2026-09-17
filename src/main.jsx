import "./storage-shim.js";
// Barcode decoder for browsers without a native BarcodeDetector (Safari): ZXing reads frames from the camera preview
import * as ZXingBrowser from "@zxing/browser";
window.ZXingBrowser = ZXingBrowser;
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
createRoot(document.getElementById("root")).render(<App />);
