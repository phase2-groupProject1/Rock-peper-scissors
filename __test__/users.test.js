const request = require("supertest");

jest.mock("../models", () => {
  return {
    User: {
      create: jest.fn(),
      findByPk: jest.fn(),
    },
    Room: {},
    Move: {},
  };
});

const { User } = require("../models");
const app = require("../app");

describe("Users API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /users - 201 success", async () => {
    User.create.mockResolvedValue({ id: 1, username: "wada" });
    const res = await request(app)
      .post("/users")
      .send({ username: "wada" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message", "User registered successfully");
    expect(res.body.user).toMatchObject({ id: 1, username: "wada" });
    expect(User.create).toHaveBeenCalledWith({ username: "wada" });
  });

  test("POST /users - 500 when create throws", async () => {
    User.create.mockRejectedValue(new Error("db fail"));
    const res = await request(app).post("/users").send({ username: "wada" });
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message", "Internal server error");
  });

  test("POST /users - 400 when username missing", async () => {
    const res = await request(app).post("/users").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message", "Username is required");
  });

  test("GET /users/:id - 200 when found", async () => {
    User.findByPk.mockResolvedValue({ id: 7, username: "alice" });
    const res = await request(app).get("/users/7");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 7, username: "alice" });
  });

  test("GET /users/:id - 404 when not found", async () => {
    User.findByPk.mockResolvedValue(null);
    const res = await request(app).get("/users/99");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message", "User not found");
  });

  test("GET /users/:id - 500 when find throws", async () => {
    User.findByPk.mockRejectedValue(new Error("db err"));
    const res = await request(app).get("/users/9");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message", "Internal server error");
  });
});
