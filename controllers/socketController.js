// Socket.IO Controller (CommonJS) — simple, class-like layout
// Events: join_room, player_move, round_result

const { Move, Room, User } = require('../models');

// In-memory state (per roomKey) for real-time play. RoomKey can be a string (code) or numeric id used by clients.
// Each entry: { names: {socketId:name}, moves: {socketId:move}, userIds: {socketId:userId}, seats: [socketId,...] }
const rooms = {};

class SocketGameController {
  // Room helpers
  static getRoom(roomId) {
    if (!rooms[roomId]) rooms[roomId] = { names: {}, moves: {}, userIds: {}, seats: [] };
    // Backfill in case older objects exist without new fields
    if (!rooms[roomId].userIds) rooms[roomId].userIds = {};
    if (!Array.isArray(rooms[roomId].seats)) rooms[roomId].seats = [];
    return rooms[roomId];
  }

  static decideWinner(a, b) {
    if (a === b) return 'draw';
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    return beats[a] === b ? 'a' : 'b';
  }

  // Event handlers
  static async onJoinRoom(io, socket, body = {}) {
    console.log('[join_room]', socket.id, body);
    const roomKey = body.roomId || body.room || body.roomCode; // client-provided identifier
    if (!roomKey) return socket.emit('error', { message: 'roomId is required' });
    const name = body.playerName || `Player-${socket.id.slice(0, 5)}`;
    const userId = body.userId ?? null; // optional; if provided, enables DB persistence with user IDs

    // Try to resolve actual Room DB id when possible
    let roomDbId = null;
    try {
      // If roomKey is a number-like id, use it directly
      if (/^\d+$/.test(String(roomKey))) {
        roomDbId = Number(roomKey);
      } else if (body.roomId && /^\d+$/.test(String(body.roomId))) {
        roomDbId = Number(body.roomId);
      } else if (body.roomCode) {
        const found = await Room.findOne({ where: { room_code: body.roomCode } });
        roomDbId = found ? found.id : null;
      }
    } catch (e) {
      console.log('[join_room][warn] Room lookup failed:', e.message);
    }

    socket.join(roomKey);
    socket.data.roomId = roomKey; // the socket.io room identifier used for broadcasting
    socket.data.roomDbId = roomDbId; // numeric Room.id if known
    socket.data.playerName = name;
    socket.data.userId = userId; // may be null

  const room = this.getRoom(roomKey);
  room.names[socket.id] = name;
  room.userIds[socket.id] = userId;
    if (!Array.isArray(room.seats)) room.seats = [];
    if (!room.seats.includes(socket.id) && room.seats.length < 2) room.seats.push(socket.id);

    socket.emit('joined_room', { room: roomKey, playerName: name, userId, roomDbId });
    console.log('[joined_room->emit]', { room: roomKey, playerName: name, userId, roomDbId });
  }

  static async onPlayerMove(io, socket, body = {}) {
    console.log('[player_move]', socket.id, body);
    const move = String(body.move || '').toLowerCase();
    if (!['rock', 'paper', 'scissors'].includes(move)) {
      return socket.emit('error', { message: 'invalid move (rock|paper|scissors)' });
    }

    const roomKey = socket.data.roomId;
    if (!roomKey) return socket.emit('error', { message: 'join_room first' });

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

      // Prefer stable ordering using seats if available
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

      const who12 = this.decideWinner(move1, move2); // relative to id1/id2
      const winnerSocketId = who12 === 'draw' ? null : who12 === 'a' ? id1 : id2;
      const winnerName = winnerSocketId ? (winnerSocketId === id1 ? name1 : name2) : null;
      const winnerUserId = winnerSocketId ? (winnerSocketId === id1 ? userId1 : userId2) : null;

      // Emit real-time result
      io.to(roomKey).emit('round_result', {
        room: roomKey,
        players: [
          { id: id1, name: name1, userId: userId1, move: move1 },
          { id: id2, name: name2, userId: userId2, move: move2 },
        ],
        winnerId: winnerSocketId,
        winnerUserId,
        winnerName,
        result: who12 === 'draw' ? 'draw' : 'win',
        message: who12 === 'draw' ? 'Draw' : `Winner: ${winnerName}`,
      });
      console.log('[round_result->emit]', {
        room: roomKey,
        players: [
          { id: id1, name: name1, userId: userId1, move: move1 },
          { id: id2, name: name2, userId: userId2, move: move2 },
        ],
        winnerSocketId,
        winnerUserId,
        winnerName,
        result: who12 === 'draw' ? 'draw' : 'win',
      });

      // Persist to DB (best-effort; non-blocking game flow)
      const roomDbId = socket.data.roomDbId ?? null;
      try {
        if (roomDbId || userId1 || userId2) {
          const resultTag = who12 === 'draw' ? 'draw' : (winnerSocketId === id1 ? 'User_id_1' : 'User_id_2');
          await Move.create({
            Room_id: roomDbId,
            User_id_1: userId1,
            User_id_2: userId2,
            User_id_1_choice: move1,
            User_id_2_choice: move2,
            result: resultTag,
          });
          console.log('[db][Move.create] saved', {
            Room_id: roomDbId,
            User_id_1: userId1,
            User_id_2: userId2,
            User_id_1_choice: move1,
            User_id_2_choice: move2,
            result: resultTag,
          });
        } else {
          console.log('[db][skip] Missing roomDbId and userIds; not saving this round');
        }
      } catch (e) {
        console.log('[db][error] Move.create failed:', e.message);
      }

      rooms[roomKey].moves = {}; // reset moves for next round
    }
  }

  static onDisconnect(socket, reason) {
    console.log('[disconnect]', socket.id, reason);
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];
    delete room.names[socket.id];
    delete room.moves[socket.id];
    if (Object.keys(room.names).length === 0) delete rooms[roomId];
  }

  // Wire events
  static init(io) {
    io.on('connection', (socket) => {
      console.log('[connect]', socket.id);
      socket.on('join_room', async (body) => this.onJoinRoom(io, socket, body));
      socket.on('player_move', async (body) => this.onPlayerMove(io, socket, body));
      socket.on('disconnect', (reason) => this.onDisconnect(socket, reason));
    });
  }
}

// Keep CommonJS export signature compatible with app.js
module.exports = function (io) {
  SocketGameController.init(io);
};
