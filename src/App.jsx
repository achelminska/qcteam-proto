import React, { Suspense, lazy, useEffect, useState } from "react";
// Two separate chunks: a phone never downloads the portal code and vice versa — halves the first load on warehouse Wi-Fi.
const Portal = lazy(() => import("./Portal.jsx"));
const Mobile = lazy(() => import("./Mobile.jsx"));
// #mobile → controller phone app; anything else → Head portal. Switch at runtime by changing the hash.
export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const h = () => setHash(location.hash); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  return <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#5E6B62", fontFamily: "system-ui, sans-serif", fontSize: 14 }}>Loading QCteam…</div>}>{hash === "#mobile" ? <Mobile /> : <Portal />}</Suspense>;
}
