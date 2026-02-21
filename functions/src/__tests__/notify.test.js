/* Tests for notify.js — ntfy push notification */

const { notifyLimitReached } = require("../notify");

describe("notifyLimitReached", () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sends notification with correct payload", async () => {
    await notifyLimitReached({
      ntfyUrl: "https://ntfy.example.com",
      ntfyTopic: "test-topic",
      adminSecret: "secret123",
      count: 1000,
      limit: 1000,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://ntfy.example.com");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body.topic).toBe("test-topic");
    expect(body.title).toContain("Stundenlimit");
    expect(body.message).toContain("1000/1000");
    expect(body.priority).toBe(4);
    expect(body.tags).toEqual(["warning"]);
    expect(body.actions).toHaveLength(3);
    expect(body.actions[0].label).toBe("+100 Analysen");
    expect(body.actions[0].action).toBe("view");
    expect(body.actions[0].url).toContain("/api/admin/boost?token=");
    expect(body.actions[1].label).toBe("Reset");
    expect(body.actions[2].label).toBe("Stats");
    expect(body.actions[2].url).toContain("/stats");
  });

  test("does nothing when ntfyUrl is empty", async () => {
    await notifyLimitReached({
      ntfyUrl: "",
      ntfyTopic: "topic",
      adminSecret: "secret",
      count: 1000,
      limit: 1000,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("does nothing when ntfyTopic is empty", async () => {
    await notifyLimitReached({
      ntfyUrl: "https://ntfy.example.com",
      ntfyTopic: "",
      adminSecret: "secret",
      count: 1000,
      limit: 1000,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("does not throw on fetch error", async () => {
    fetchSpy.mockRejectedValue(new Error("network error"));
    await expect(
      notifyLimitReached({
        ntfyUrl: "https://ntfy.example.com",
        ntfyTopic: "topic",
        adminSecret: "secret",
        count: 1000,
        limit: 1000,
      })
    ).resolves.toBeUndefined();
  });

  test("includes boost and reset action URLs", async () => {
    await notifyLimitReached({
      ntfyUrl: "https://ntfy.example.com",
      ntfyTopic: "topic",
      adminSecret: "sec",
      count: 500,
      limit: 500,
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.actions[0].url).toContain("/api/admin/boost?token=sec");
    expect(body.actions[0].action).toBe("view");
    expect(body.actions[1].url).toContain("/api/admin/reset?token=sec");
    expect(body.actions[1].action).toBe("view");
  });
});
