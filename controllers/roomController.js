const { move, room, user } = require("../models");

export async function createRoom(req, res) {
  try {
    const { User_id_1 } = req.body;
    if (!User_id_1)
      return res.status(400).json({ error: "User ID is required" });

    const chars = "0123456789";
    let roomCode = "";
    Array.from({ length: 6 }).forEach(() => {
      roomCode += chars[Math.floor(Math.random() * chars.length)];
    });
    const newRoom = await room.create({ room_code: roomCode });
    await move.create({
      Room_id: newRoom.id,
      User_id_1,
    });
    return res.status(201).json({ room: newRoom });
  } catch (error) {
    console.error("Error creating room:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

