import { describe, expect, it } from "vitest";
import {
  ANNOUNCE_ACCEPT,
  ANNOUNCE_MAX_BYTES,
  announceFileHref,
  announceFilesOf,
  classifyAnnounceFile,
  extOfName,
  fileKindLabel,
  formatFileSize,
  isAnnounceFile,
  isImageAnnounceFile,
  isInlineExt,
  mimeForExt,
  sanitizeFileName,
} from "./announce-files.js";

describe("classifyAnnounceFile", () => {
  it("accepts a PDF, a PowerPoint and an image", () => {
    expect(classifyAnnounceFile({ name: "briefing.pptx", mime: "", size: 12000 }).ok).toBe(true);
    expect(classifyAnnounceFile({ name: "note.PDF", mime: "application/pdf", size: 800 }).ext).toBe("pdf");
    expect(classifyAnnounceFile({ name: "label.jpg", mime: "image/jpeg", size: 4000 }).mime).toBe("image/jpeg");
  });

  it("refuses an empty file, a huge file and an executable", () => {
    expect(classifyAnnounceFile({ name: "a.pdf", size: 0 }).ok).toBe(false);
    expect(classifyAnnounceFile({ name: "a.pdf", size: ANNOUNCE_MAX_BYTES + 1 }).ok).toBe(false);
    expect(classifyAnnounceFile({ name: "setup.exe", size: 100 }).ok).toBe(false);
    expect(classifyAnnounceFile({ name: "page.html", size: 100 }).ok).toBe(false);
  });

  it("uses the last extension and strips a path", () => {
    const r = classifyAnnounceFile({ name: "C:\\Users\\Head\\Q3 briefing.PPTX", size: 50 });
    expect(r.ok).toBe(true);
    expect(r.name).toBe("Q3 briefing.PPTX");
    expect(r.ext).toBe("pptx");
  });
});

describe("announce file records", () => {
  it("keeps only stored /files paths", () => {
    const a = {
      attachments: [
        { id: "1", name: "a.pdf", path: "/files/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf", mime: "application/pdf", size: 12 },
        { id: "2", name: "b.pdf", path: "data:application/pdf;base64,xx", size: 4 },
        { id: "3", name: "c.pdf" },
      ],
    };
    expect(announceFilesOf(a)).toHaveLength(1);
    expect(isAnnounceFile(a.attachments[0])).toBe(true);
    expect(isAnnounceFile(a.attachments[1])).toBe(false);
  });

  it("builds a server href that carries the original name", () => {
    const href = announceFileHref({ name: "Q3 briefing.pptx", path: "/files/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pptx" });
    expect(href).toContain("/files/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pptx");
    expect(href).toContain("name=Q3%20briefing.pptx");
  });
});

describe("helpers", () => {
  it("maps extensions and formats sizes", () => {
    expect(extOfName("a.PPTX")).toBe("pptx");
    expect(mimeForExt("pdf")).toBe("application/pdf");
    expect(isInlineExt("pdf")).toBe(true);
    expect(isInlineExt("pptx")).toBe(false);
    expect(formatFileSize(800)).toBe("800 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(ANNOUNCE_ACCEPT).toContain(".pptx");
    expect(sanitizeFileName("a/b<c>.pdf")).toBe("bc.pdf");
    expect(fileKindLabel("Freshness issues w38.pdf")).toBe("PDF");
    expect(fileKindLabel("deck.PPTX")).toBe("PPTX");
    expect(isImageAnnounceFile({ name: "label.jpg", path: "/files/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg" })).toBe(true);
    expect(isImageAnnounceFile({ name: "briefing.pdf", path: "/files/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf" })).toBe(false);
  });
});
