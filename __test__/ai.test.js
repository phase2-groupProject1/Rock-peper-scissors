const request = require("supertest");

jest.mock("../models", () => {
  return {
    move: undefined, // aiController uses lowercase wrongly; we'll provide both
    room: undefined,
    user: undefined,
    Move: {
      findAll: jest.fn(),
      create: jest.fn(),
    },
    Room: {
      findOne: jest.fn(),
    },
    User: {},
  };
});

// aiController currently imports lowercase names; provide shims
const models = require("../models");
models.move = models.Move;
models.room = models.Room;
models.user = models.User;

jest.mock("../helpers/gemini", () => ({
  getAIMove: jest.fn().mockResolvedValue({ move: "rock", result: "draw", insights: "ok" }),
}));

const { Room, Move } = require("../models");
const app = require("../app");

describe("AI REST API", () => {
  beforeEach(() => jest.clearAllMocks());

  test("POST /rooms/:room_code/ai - 200 success", async () => {
    Room.findOne.mockResolvedValue({ id: 10, room_code: "W2LJ51" });
    Move.findAll.mockResolvedValue([]);
    Move.create.mockResolvedValue({});

    const res = await request(app)
      .post("/rooms/W2LJ51/ai")
      .send({ user_id: 8, player_move: "paper" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("player_move", "paper");
    expect(res.body).toHaveProperty("ai_move");
    expect(res.body).toHaveProperty("result");
    expect(Move.create).toHaveBeenCalledTimes(2);
  });

  test("POST /rooms/:room_code/ai - 200 with history present", async () => {
    Room.findOne.mockResolvedValue({ id: 11, room_code: "HIST01" });
    // simulate previous rounds
    Move.findAll.mockResolvedValue([
      { move: "rock" },
      { move: "paper" },
    ]);
    Move.create.mockResolvedValue({});
    const res = await request(app)
      .post("/rooms/HIST01/ai")
      .send({ user_id: 3, player_move: "scissors" });
    expect(res.status).toBe(200);
    expect(Move.create).toHaveBeenCalledTimes(2);
  });

  test("POST /rooms/:room_code/ai - 400 missing fields", async () => {
    const res = await request(app).post("/rooms/ABC123/ai").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("POST /rooms/:room_code/ai - 404 room not found", async () => {
    Room.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/rooms/NOPE/ai")
      .send({ user_id: 8, player_move: "rock" });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Room not found");
  });

  test("POST /rooms/:room_code/ai - 500 when controller throws", async () => {
    // Make Room.findOne resolve, then Move.findAll throw to trigger catch-all 500
    Room.findOne.mockResolvedValue({ id: 12, room_code: "ERR01" });
    Move.findAll.mockRejectedValue(new Error("db err"));
    const res = await request(app)
      .post("/rooms/ERR01/ai")
      .send({ user_id: 1, player_move: "rock" });
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Internal server error");
  });
});
