import React, { useEffect, useState } from "react";
import Portal from "./Portal.jsx";
import Mobile from "./Mobile.jsx";
// #mobile → controller phone app; anything else → Head portal. Switch at runtime by changing the hash.
export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const h = () => setHash(location.hash); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  return hash === "#mobile" ? <Mobile /> : <Portal />;
}
