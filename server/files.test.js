import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { contentDisposition, filesDirOf, resolveStoredFile, storeUploadedFile } from "./files.mjs";

describe("storeUploadedFile", () => {
  it("writes a PDF once and reuses the hash name", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qc-files-"));
    const bytes = Buffer.from("%PDF-1.4 hello");
    const a = storeUploadedFile({ bytes, name: "briefing.pdf", mime: "application/pdf", dir });
    const b = storeUploadedFile({ bytes, name: "other.pdf", mime: "application/pdf", dir });
    expect(a.path).toMatch(/^\/files\/[a-f0-9]{32}\.pdf$/);
    expect(b.path).toBe(a.path);
    expect(a.name).toBe("briefing.pdf");
    expect(fs.existsSync(path.join(dir, a.path.slice("/files/".length)))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses a disallowed type", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qc-files-"));
    const r = storeUploadedFile({ bytes: Buffer.from("MZ"), name: "setup.exe", mime: "application/octet-stream", dir });
    expect(r.error).toMatch(/not allowed/);
    expect(fs.readdirSync(dir)).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("resolveStoredFile", () => {
  it("serves a stored file with the original download name", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qc-files-"));
    const saved = storeUploadedFile({ bytes: Buffer.from("%PDF-1.4 x"), name: "note.pdf", mime: "application/pdf", dir });
    const hit = resolveStoredFile(dir, saved.path, "Q3 briefing.pdf");
    expect(hit.mime).toBe("application/pdf");
    expect(hit.inline).toBe(true);
    expect(hit.download).toBe("Q3 briefing.pdf");
    expect(resolveStoredFile(dir, "/files/../state.json", "x.pdf")).toBe(null);
    expect(resolveStoredFile(dir, "/files/not-a-hash.pdf", "x.pdf")).toBe(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("helpers", () => {
  it("keeps files next to state and encodes Content-Disposition", () => {
    expect(filesDirOf("/data", "/tmp/server")).toBe(path.join("/data", "files"));
    expect(filesDirOf(null, "/tmp/server")).toBe(path.join("/tmp/server", "files"));
    expect(contentDisposition(true, "Q3 briefing.pdf")).toContain("inline");
    expect(contentDisposition(false, "deck.pptx")).toContain("attachment");
    expect(contentDisposition(true, "załącznik.pdf")).toContain("filename*=UTF-8''");
  });
});
