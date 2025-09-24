const { Move, Room, User } = require("../models");
const { getAIMove } = require("../helpers/gemini");

const rooms = {};

class SocketGameController {
  // Track last AI call timestamp per-socket to prevent bursts
  static lastAiCall = new Map(); // socket.id -> timestamp

  static getRoom(roomId) {
    if (!rooms[roomId])
      rooms[roomId] = { names: {}, moves: {}, userIds: {}, seats: [] };
    if (!rooms[roomId].userIds) rooms[roomId].userIds = {};
    if (!Array.isArray(rooms[roomId].seats)) rooms[roomId].seats = [];
    return rooms[roomId];
  }

  static decideWinner(a, b) {
    if (a === b) return "draw";
    const beats = { rock: "scissors", paper: "rock", scissors: "paper" };
    return beats[a] === b ? "a" : "b";
  }

  static buildRoomsUpdate() {
    try {
      return Object.keys(rooms).map((roomKey) => {
        const room = this.getRoom(roomKey);
        const count = Array.isArray(room.seats)
          ? room.seats.length
          : room && room.names
          ? Object.keys(room.names).length
          : 0;
        return {
          room: roomKey,
          players: count,
          status: count >= 2 ? "playing" : "waiting",
        };
      });
    } catch (e) {
      return [];
    }
  }

  static async onJoinRoom(io, socket, body = {}) {
    console.log("[join_room]", socket.id, body);
    const roomKey = body.roomId || body.room || body.roomCode;
    if (!roomKey)
      return socket.emit("error", { message: "roomId is required" });
    const name = body.playerName || `Player-${socket.id.slice(0, 5)}`;
    const userId = body.userId ?? null;

    let roomDbId = null;
    try {
      if (/^\d+$/.test(String(roomKey))) {
        roomDbId = Number(roomKey);
      } else if (body.roomId && /^\d+$/.test(String(body.roomId))) {
        roomDbId = Number(body.roomId);
      } else if (body.roomCode) {
        const found = await Room.findOne({
          where: { room_code: body.roomCode },
        });
        roomDbId = found ? found.id : null;
      }
    } catch (e) {
      console.log("[join_room][warn] Room lookup failed:", e.message);
    }

    socket.join(roomKey);
    socket.data.roomId = roomKey;
    socket.data.roomDbId = roomDbId;
    socket.data.playerName = name;
    socket.data.userId = userId;

    const room = this.getRoom(roomKey);
    room.names[socket.id] = name;
    room.userIds[socket.id] = userId;
    if (!Array.isArray(room.seats)) room.seats = [];
    if (!room.seats.includes(socket.id) && room.seats.length < 2)
      room.seats.push(socket.id);

    socket.emit("joined_room", {
      room: roomKey,
      playerName: name,
      userId,
      roomDbId,
    });
    console.log("[joined_room->emit]", {
      room: roomKey,
      playerName: name,
      userId,
      roomDbId,
    });
  }

  static async onPlayerMove(io, socket, body = {}) {
    console.log("[player_move]", socket.id, body);
    const move = String(body.move || "").toLowerCase();
    if (!["rock", "paper", "scissors"].includes(move)) {
      return socket.emit("error", {
        message: "invalid move (rock|paper|scissors)",
      });
    }

    const roomKey = socket.data.roomId;
    if (!roomKey) return socket.emit("error", { message: "join_room first" });

    const room = this.getRoom(roomKey);
    room.moves[socket.id] = move;

    const ids = Object.keys(room.moves);
    if (ids.length >= 2) {
      const [aId, bId] = ids.slice(0, 2);
      const aMove = room.moves[aId];
      const bMove = room.moves[bId];
      const aName = room.names[aId] || aId;
      const bName = room.names[bId] || bId;
      const aUserId = room.userIds ? room.userIds[aId] : null;
      const bUserId = room.userIds ? room.userIds[bId] : null;

      const seatOrder = Array.isArray(room.seats)
        ? room.seats.filter((sid) => ids.includes(sid)).slice(0, 2)
        : [];
      const [id1, id2] = seatOrder.length === 2 ? seatOrder : [aId, bId];
      const move1 = room.moves[id1];
      const move2 = room.moves[id2];
      const name1 = room.names[id1] || id1;
      const name2 = room.names[id2] || id2;
      const userId1 = room.userIds ? room.userIds[id1] : null;
      const userId2 = room.userIds ? room.userIds[id2] : null;

      const who12 = this.decideWinner(move1, move2);
      const winnerSocketId =
        who12 === "draw" ? null : who12 === "a" ? id1 : id2;
      const winnerName = winnerSocketId
        ? winnerSocketId === id1
          ? name1
          : name2
        : null;
      const winnerUserId = winnerSocketId
        ? winnerSocketId === id1
          ? userId1
          : userId2
        : null;

      io.to(roomKey).emit("round_result", {
        room: roomKey,
        players: [
          { id: id1, name: name1, userId: userId1, move: move1 },
          { id: id2, name: name2, userId: userId2, move: move2 },
        ],
        winnerId: winnerSocketId,
        winnerUserId,
        winnerName,
        result: who12 === "draw" ? "draw" : "win",
        message: who12 === "draw" ? "Draw" : `Winner: ${winnerName}`,
      });
      console.log("[round_result->emit]", {
        room: roomKey,
        players: [
          { id: id1, name: name1, userId: userId1, move: move1 },
          { id: id2, name: name2, userId: userId2, move: move2 },
        ],
        winnerSocketId,
        winnerUserId,
        winnerName,
        result: who12 === "draw" ? "draw" : "win",
      });

      const roomDbId = socket.data.roomDbId;
      if (roomDbId && userId1 && userId2) {
        try {
          const result1 =
            who12 === "draw" ? "draw" : who12 === "a" ? "win" : "lose";
          const result2 =
            who12 === "draw" ? "draw" : who12 === "b" ? "win" : "lose";

          await Move.create({
            Room_id: roomDbId,
            User_id: userId1,
            move: move1,
            result: result1,
          });
          await Move.create({
            Room_id: roomDbId,
            User_id: userId2,
            move: move2,
            result: result2,
          });
        } catch (dbError) {
          console.error("Failed to save moves to database:", dbError);
        }
      }

      rooms[roomKey].moves = {};
    }
  }

  // Play versus AI via Socket.IO
  static async onPlayAI(io, socket, body = {}) {
    try {
      console.log("[play_ai]", socket.id, body);
      const playerMove = String(body.player_move || body.move || "").toLowerCase();
      if (!["rock", "paper", "scissors"].includes(playerMove)) {
        return socket.emit("error", { message: "invalid move (rock|paper|scissors)" });
      }

      // Cooldown 1s per socket to avoid spamming the external API
      const now = Date.now();
      const last = this.lastAiCall.get(socket.id) || 0;
      if (now - last < 1000) {
        return socket.emit("error", { message: "You're going too fast. Please wait a moment before playing AI again." });
      }
      this.lastAiCall.set(socket.id, now);

      // Identify user and room context
      const userId = body.userId ?? socket.data.userId ?? null;
      const name = socket.data.playerName || body.playerName || `Player-${socket.id.slice(0, 5)}`;
      const roomKey = socket.data.roomId || body.roomId || body.room || body.roomCode || "ai-room";

      let roomDbId = socket.data.roomDbId ?? null;
      try {
        if (!roomDbId && body.roomId && /^\d+$/.test(String(body.roomId))) {
          roomDbId = Number(body.roomId);
        } else if (!roomDbId && body.roomCode) {
          const found = await Room.findOne({ where: { room_code: body.roomCode } });
          roomDbId = found ? found.id : null;
        }
      } catch (e) {
        console.log("[play_ai][warn] room resolve failed:", e.message);
      }

      // Build a simple player history if possible (best-effort, tolerant to schema variants)
      let playerHistory = [];
      try {
        if (roomDbId && userId) {
          const rounds = await Move.findAll({ where: { Room_id: roomDbId }, order: [["createdAt", "ASC"]] });
          for (const rr of rounds) {
            const r = rr.get ? rr.get({ plain: true }) : rr;
            if (r && typeof r === "object") {
              if ("User_id_1" in r || "User_id_2" in r) {
                if (r.User_id_1 === userId && r.User_id_1_choice) playerHistory.push(r.User_id_1_choice);
                else if (r.User_id_2 === userId && r.User_id_2_choice) playerHistory.push(r.User_id_2_choice);
              } else if ("User_id" in r && "move" in r) {
                if (r.User_id === userId && r.move) playerHistory.push(r.move);
              }
            }
          }
        }
      } catch (e) {
        console.log("[play_ai][warn] history load failed:", e.message);
      }

      // Get AI move via helper (uses Gemini if key exists, else random)
      let aiMove = "rock";
      let insights = null;
      try {
        const aiResp = await getAIMove(playerHistory);
        const m = String(aiResp?.move || "").toLowerCase();
        aiMove = ["rock", "paper", "scissors"].includes(m) ? m : "rock";
        insights = aiResp?.insights ?? null;
      } catch (e) {
        console.log("[play_ai][warn] getAIMove failed, fallback random:", e.message);
        aiMove = ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];
      }

      // Decide outcome from player's perspective
      const who = this.decideWinner(playerMove, aiMove); // 'a' | 'b' | 'draw'
      const resultPerspective = who === "draw" ? "draw" : who === "a" ? "win" : "lose";

      // Emit only back to the requester
      const payload = {
        room: roomKey,
        players: [
          { id: socket.id, name, userId, move: playerMove },
          { id: "AI", name: "AI", userId: null, move: aiMove },
        ],
        winnerId: who === "draw" ? null : who === "a" ? socket.id : "AI",
        winnerUserId: who === "a" ? userId : null,
        winnerName: who === "draw" ? null : who === "a" ? name : "AI",
        result: resultPerspective,
        message: who === "draw" ? "Draw" : `Winner: ${who === "a" ? name : "AI"}`,
        ai: { insights },
      };
      socket.emit("round_result", payload);
  console.log("[round_result->emit][ai]", payload);

      // Best-effort DB persistence (try combined schema first, then fallback to per-move rows)
      const resultTag = who === "draw" ? "draw" : who === "a" ? "User_id_1" : "User_id_2";
      if (roomDbId || userId) {
        try {
          await Move.create({
            Room_id: roomDbId,
            User_id_1: userId,
            User_id_2: null,
            User_id_1_choice: playerMove,
            User_id_2_choice: aiMove,
            result: resultTag,
          });
          console.log("[db][Move.create][ai] combined schema saved");
        } catch (e1) {
          console.log("[db][warn][ai] combined schema failed, trying per-move rows:", e1.message);
          try {
            const res1 = who === "draw" ? "draw" : who === "a" ? "win" : "lose";
            const res2 = who === "draw" ? "draw" : who === "b" ? "win" : "lose";
            await Move.create({ Room_id: roomDbId, User_id: userId, move: playerMove, result: res1 });
            await Move.create({ Room_id: roomDbId, User_id: null, move: aiMove, result: res2 });
            console.log("[db][Move.create][ai] per-move rows saved");
          } catch (e2) {
            console.log("[db][error][ai] persistence failed:", e2.message);
          }
        }
      } else {
        console.log("[db][skip][ai] Missing roomDbId and userId");
      }
    } catch (e) {
      console.log("[play_ai][error]", e.message);
      socket.emit("error", { message: "AI play failed" });
    }
  }

  static onDisconnect(socket, reason) {
    console.log("[disconnect]", socket.id, reason);
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];
    delete room.names[socket.id];
    delete room.moves[socket.id];
    if (Object.keys(room.names).length === 0) delete rooms[roomId];
  }

  static init(io) {
    io.on("connection", (socket) => {
      console.log("[connect]", socket.id);
      socket.on("join_room", async (body) => this.onJoinRoom(io, socket, body));
      socket.on("player_move", async (body) =>
        this.onPlayerMove(io, socket, body)
      );
      socket.on("play_ai", async (body) => this.onPlayAI(io, socket, body));
      socket.on("disconnect", (reason) => this.onDisconnect(socket, reason));
    });
  }
}

module.exports = function (io) {
  SocketGameController.init(io);
};
