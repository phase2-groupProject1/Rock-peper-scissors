describe("helpers/gemini", () => {
  let originalEnv;
  beforeAll(() => {
    originalEnv = { ...process.env };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  test("returns random when no API key", async () => {
    jest.resetModules();
    delete process.env.GEMINI_API_KEY;
    const { getAIMove } = require("../helpers/gemini");
    const res = await getAIMove(["rock", "paper"]);
    expect(["rock", "paper", "scissors"]).toContain(res.move);
    expect(res.result).toBe("draw");
  });

  test("uses axios when key present and parses response", async () => {
    jest.resetModules();
    process.env.GEMINI_API_KEY = "test-key";
    // Mock axios for this isolated import
    jest.doMock("axios", () => ({
      post: jest.fn().mockResolvedValue({
        data: {
          candidates: [
            { content: { parts: [{ text: "move: paper\nresult: win\ninsights: ok" }] } },
          ],
        },
      }),
    }));
    const { getAIMove } = require("../helpers/gemini");
    const res = await getAIMove(["rock"]);
    expect(res).toMatchObject({ move: "paper", result: "win" });
  });

  test("serves from cache on repeated history (no extra axios call)", async () => {
    jest.resetModules();
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MIN_INTERVAL_MS = "0"; // bypass cooldown
    process.env.GEMINI_CACHE_TTL_MS = "60000";
    const post = jest.fn().mockResolvedValue({
      data: { candidates: [{ content: { parts: [{ text: "move: rock\nresult: draw\ninsights: ok" }] } }] },
    });
    jest.doMock("axios", () => ({ post }));
    const { getAIMove } = require("../helpers/gemini");
    const history = ["rock", "paper"]; 
    const res1 = await getAIMove(history);
    const res2 = await getAIMove(history);
    expect(post).toHaveBeenCalledTimes(1);
    expect(res2.fromCache).toBe(true);
  });

  test("cooldown path returns random without calling axios", async () => {
    jest.resetModules();
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MIN_INTERVAL_MS = "100000"; // big to trigger cooldown
    const post = jest.fn();
    jest.doMock("axios", () => ({ post }));
    const { getAIMove } = require("../helpers/gemini");
    await getAIMove(["rock"]); // first call sets lastCallAt
    const res2 = await getAIMove(["rock"]); // second call within cooldown
    expect(post).toHaveBeenCalledTimes(1);
    expect(res2.insights).toMatch(/cooling down/i);
  });

  test("404 model not found goes to fallback with error insight", async () => {
    jest.resetModules();
    process.env.GEMINI_API_KEY = "test-key";
    jest.doMock("axios", () => ({
      post: jest.fn().mockRejectedValue({ response: { status: 404 }, message: "not found" })
    }));
    const { getAIMove } = require("../helpers/gemini");
    const res = await getAIMove(["rock"]);
    expect(["rock", "paper", "scissors"]).toContain(res.move);
    expect(res.result).toBe("draw");
    expect(res.insights).toMatch(/Gemini API error/i);
  });
});

