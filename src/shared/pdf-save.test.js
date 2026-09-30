import { describe, expect, it, vi } from "vitest";
import { isAppleTouch, needsShareToSave, pdfFileFromBlob, savePdfFile, triggerAnchorDownload } from "./pdf-save.js";

const iphone = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 };
const ipadOs = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 };
const android = { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile", platform: "Linux armv8l", maxTouchPoints: 5 };
const desktop = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120", platform: "MacIntel", maxTouchPoints: 0 };

describe("isAppleTouch", () => {
  it("detects iPhone, iPadOS, and not Android or a Mac with a mouse", () => {
    expect(isAppleTouch(iphone)).toBe(true);
    expect(isAppleTouch(ipadOs)).toBe(true);
    expect(isAppleTouch(android)).toBe(false);
    expect(isAppleTouch(desktop)).toBe(false);
    expect(isAppleTouch(null)).toBe(false);
  });
});

describe("needsShareToSave", () => {
  it("is only the iOS path — Android can use <a download>", () => {
    expect(needsShareToSave(iphone)).toBe(true);
    expect(needsShareToSave(android)).toBe(false);
    expect(needsShareToSave(desktop)).toBe(false);
  });
});

describe("pdfFileFromBlob", () => {
  it("wraps a blob as an application/pdf File with the report name", () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const file = pdfFileFromBlob(blob, "QC_Report_Gala.pdf");
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("QC_Report_Gala.pdf");
    expect(file.type).toBe("application/pdf");
  });
});

describe("triggerAnchorDownload", () => {
  it("clicks a temporary <a download> and removes it", () => {
    const clicked = [];
    const removed = [];
    const a = { href: "", download: "", rel: "", click: () => clicked.push(1), remove: () => removed.push(1) };
    const doc = { createElement: () => a, body: { appendChild: vi.fn() } };
    expect(triggerAnchorDownload("blob:x", "report.pdf", doc)).toBe(true);
    expect(a.href).toBe("blob:x");
    expect(a.download).toBe("report.pdf");
    expect(clicked).toEqual([1]);
    expect(removed).toEqual([1]);
  });
});

describe("savePdfFile", () => {
  const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
  const doc = () => {
    const a = { href: "", download: "", rel: "", click: vi.fn(), remove: vi.fn() };
    return { a, doc: { createElement: () => a, body: { appendChild: vi.fn() } } };
  };

  it("shares only the file on iPhone when canShare accepts it", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const nav = { ...iphone, canShare: ({ files }) => files?.length === 1, share };
    const result = await savePdfFile(blob, "QC_Report.pdf", { nav, doc: doc().doc });
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0][0];
    expect(payload).toEqual({ files: [expect.any(File)] });
    expect(payload.files[0].name).toBe("QC_Report.pdf");
    expect(payload.title).toBeUndefined();
    expect(payload.text).toBeUndefined();
    expect(payload.url).toBeUndefined();
  });

  it("returns needs-tap when iOS share is not allowed in this gesture", async () => {
    const err = new Error("not allowed");
    err.name = "NotAllowedError";
    const nav = { ...iphone, canShare: () => true, share: vi.fn().mockRejectedValue(err) };
    expect(await savePdfFile(blob, "QC_Report.pdf", { nav, doc: doc().doc })).toBe("needs-tap");
  });

  it("returns aborted when the user closes the share sheet", async () => {
    const err = new Error("cancel");
    err.name = "AbortError";
    const nav = { ...iphone, canShare: () => true, share: vi.fn().mockRejectedValue(err) };
    expect(await savePdfFile(blob, "QC_Report.pdf", { nav, doc: doc().doc })).toBe("aborted");
  });

  it("returns needs-tap on iPhone when share is missing, instead of a fake <a download>", async () => {
    const { a, doc: d } = doc();
    expect(await savePdfFile(blob, "QC_Report.pdf", { nav: iphone, doc: d })).toBe("needs-tap");
    expect(a.click).not.toHaveBeenCalled();
  });

  it("uses <a download> on Android and desktop", async () => {
    const { a, doc: d } = doc();
    expect(await savePdfFile(blob, "QC_Report.pdf", { nav: android, doc: d, url: "blob:android" })).toBe("downloaded");
    expect(a.click).toHaveBeenCalledTimes(1);
    expect(a.download).toBe("QC_Report.pdf");
    const desk = doc();
    expect(await savePdfFile(blob, "QC_Report.pdf", { nav: desktop, doc: desk.doc, url: "blob:desk" })).toBe("downloaded");
    expect(desk.a.click).toHaveBeenCalledTimes(1);
  });
});
