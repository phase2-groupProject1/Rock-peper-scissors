const request = require("supertest");

jest.mock("../models", () => {
  return {
    Room: {
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
    },
    Move: {},
    User: {},
  };
});

const { Room } = require("../models");
const app = require("../app");

describe("Rooms API", () => {
  beforeEach(() => jest.clearAllMocks());

  test("POST /rooms - 201 create room with room_code", async () => {
    Room.create.mockResolvedValue({ id: 1, save: jest.fn(), room_code: null });
    const res = await request(app).post("/rooms");
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("room");
    expect(Room.create).toHaveBeenCalled();
  });

  test("GET /rooms - 200 list rooms", async () => {
    Room.findAll.mockResolvedValue([{ id: 1, room_code: "ABC123" }]);
    const res = await request(app).get("/rooms");
    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(1);
  });

  test("GET /rooms/:room_code - 200 when found", async () => {
    Room.findOne.mockResolvedValue({ id: 2, room_code: "W2LJ51" });
    const res = await request(app).get("/rooms/W2LJ51");
    expect(res.status).toBe(200);
    expect(res.body.room).toMatchObject({ id: 2, room_code: "W2LJ51" });
  });

  test("GET /rooms/:room_code - 404 when not found", async () => {
    Room.findOne.mockResolvedValue(null);
    const res = await request(app).get("/rooms/NOPE");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Room not found");
  });

  test("POST /rooms/:room_code/join - 400 missing user_id", async () => {
    Room.findOne.mockResolvedValue({ id: 3, room_code: "JOIN01" });
    const res = await request(app).post("/rooms/JOIN01/join").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "User ID is required");
  });

  test("POST /rooms/:room_code/join - 404 room not found", async () => {
    Room.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/rooms/NOPE/join")
      .send({ user_id: 10 });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Room not found");
  });

  test("POST /rooms/:room_code/join - 200 success", async () => {
    Room.findOne.mockResolvedValue({ id: 5, room_code: "OK1234" });
    const res = await request(app)
      .post("/rooms/OK1234/join")
      .send({ user_id: 8 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Successfully joined the room");
  });

  // Additional negative-path tests to increase coverage
  test("POST /rooms - 500 when Room.create throws", async () => {
    Room.create.mockRejectedValue(new Error("db down"));
    const res = await request(app).post("/rooms");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Internal server error");
  });

  test("GET /rooms - 500 when Room.findAll throws", async () => {
    Room.findAll.mockRejectedValue(new Error("boom"));
    const res = await request(app).get("/rooms");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Internal server error");
  });

  test("GET /rooms/:room_code - 500 when Room.findOne throws", async () => {
    Room.findOne.mockRejectedValue(new Error("err"));
    const res = await request(app).get("/rooms/ERR123");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Internal server error");
  });

  test("POST /rooms/:room_code/join - 500 when Room.findOne throws", async () => {
    Room.findOne.mockRejectedValue(new Error("err"));
    const res = await request(app)
      .post("/rooms/ERR123/join")
      .send({ user_id: 1 });
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error", "Internal server error");
  });
});
