const { move, room, user } = require("../models");
const { getAIMove } = require("../helpers/gemini");

class AIController {
  static async playAgainstAI(req, res) {
    try {
      const { room_code } = req.params;
      const { user_id, player_move } = req.body;
      if (!user_id || !player_move) {
        return res
          .status(400)
          .json({ error: "User ID and player move are required" });
      }
      const roomDetails = await room.findOne({
        where: { room_code },
        include: [{ model: user, as: "players" }],
      });
      if (!roomDetails) {
        return res.status(404).json({ error: "Room not found" });
      }
      const playerHistory = await move.findAll({
        where: { User_id: user_id, Room_id: roomDetails.id },
        order: [["createdAt", "ASC"]],
      });
      const aiResponse = await getAIMove(playerHistory.map((m) => m.move));
      const ai_move = aiResponse.move;
      const result = aiResponse.result;
      const insights = aiResponse.insights;
      await move.create({
        Room_id: roomDetails.id,
        User_id: user_id,
        move: player_move,
        result: result === "win" ? "win" : result === "lose" ? "lose" : "draw",
      });
      await move.create({
        Room_id: roomDetails.id,
        User_id: null,
        move: ai_move,
        result: result === "win" ? "lose" : result === "lose" ? "win" : "draw",
      });
      return res.status(200).json({
        player_move,
        ai_move,
        result,
        insights,
      });
    } catch (error) {
      console.error("Error playing against AI:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

module.exports = AIController;
