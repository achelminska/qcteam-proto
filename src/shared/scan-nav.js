// Scan result in the mobile history stack. After a code resolves, the HU / product
// code lives in the scan screen's nav param so Product profile → Back remounts the
// pallet sheet instead of an empty camera.

export const isPalletCode = code => /^\d{14,}$/.test(String(code || "").trim());

// GS1-128 pallet labels encode the SSCC behind application identifier "00"
// (often with more AIs concatenated): "00087205744101641093" → "087205744101641093".
export const extractSSCC = raw => {
  const d = String(raw || "").replace(/\D/g, "");
  const m = /(?:^|\D)00(\d{18})/.exec(String(raw || "")) || (d.length >= 20 && d.startsWith("00") ? [null, d.slice(2, 20)] : null);
  if (m) return m[1];
  if (d.length >= 18) return d.slice(0, 18);
  return d;
};

export function scanNavParam(code) {
  const val = String(code ?? "").trim();
  if (!val) return null;
  return isPalletCode(val) ? extractSSCC(val) : val;
}
