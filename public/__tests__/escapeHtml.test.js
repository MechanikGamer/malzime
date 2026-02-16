import { describe, it, expect, beforeEach } from "vitest";
import { setupDOM } from "./setup.js";

describe("escapeHtml", () => {
  let escapeHtml;

  beforeEach(async () => {
    setupDOM();
    const mod = await import("../js/dom.js");
    escapeHtml = mod.escapeHtml;
  });

  it("escapes <script> tags", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes HTML entities", () => {
    expect(escapeHtml('a "b" & <c>')).toBe('a "b" &amp; &lt;c&gt;');
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("passes through safe text unchanged", () => {
    expect(escapeHtml("Hallo Welt 123")).toBe("Hallo Welt 123");
  });

  it("escapes angle brackets so event handlers cannot execute", () => {
    const xss = '<img onerror="alert(1)" src=x>';
    const result = escapeHtml(xss);
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });
});
