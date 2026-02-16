const { parseJsonBody } = require("../upload");

describe("parseJsonBody", () => {
  test("returns null for non-JSON content type", () => {
    const req = { headers: { "content-type": "multipart/form-data" }, body: {} };
    expect(parseJsonBody(req)).toBeNull();
  });

  test("returns body for valid JSON request", () => {
    const body = { imageBase64: "abc", mimeType: "image/jpeg" };
    const req = { headers: { "content-type": "application/json" }, body };
    expect(parseJsonBody(req)).toBe(body);
  });

  test("throws for JSON content-type with no body", () => {
    const req = { headers: { "content-type": "application/json" }, body: null };
    expect(() => parseJsonBody(req)).toThrow("Invalid JSON body");
  });

  test("thrown error has status 400", () => {
    const req = { headers: { "content-type": "application/json" }, body: "string" };
    try {
      parseJsonBody(req);
      fail("should have thrown");
    } catch (err) {
      expect(err.status).toBe(400);
      expect(err.code).toBe("bad_json");
    }
  });
});
