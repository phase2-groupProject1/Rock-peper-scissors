const { move, room, user } = require("../models");

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createRoom(req, res) {
  try {
    const newRoom = await room.create({});

    const roomCode = generateRoomCode();
    newRoom.room_code = roomCode;
    await newRoom.save();

    return res.status(201).json({ room: newRoom });
  } catch (error) {
    console.error("Error creating room:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getRoomDetails(req, res) {
  try {
    const { room_code } = req.params;
    const roomDetails = await room.findOne({
      where: { room_code },
      include: [{ model: user, as: "players" }],
    });
    if (!roomDetails) {
      return res.status(404).json({ error: "Room not found" });
    }
    return res.status(200).json({ room: roomDetails });
  } catch (error) {
    console.error("Error fetching room details:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function joinRoom(req, res) {
  try {
    const { room_code } = req.params;
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const roomDetails = await room.findOne({
      where: { room_code },
      include: [{ model: user, as: "players" }],
    });
    if (!roomDetails) {
      return res.status(404).json({ error: "Room not found" });
    }
    await move.create({
      Room_id: roomDetails.id,
      User_id: user_id,
    });
    return res.status(200).json({ message: "Successfully joined the room" });
  } catch (error) {
    console.error("Error joining room:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
