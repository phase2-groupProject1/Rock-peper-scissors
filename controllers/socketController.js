// Minimal Socket.io controller for Rock-Paper-Scissors (server-side only)
// Keep it simple: in-memory state, 2 events: "join_room" and "player_move".

// roomState shape: { players: Set<string>, moves: Map<string, 'rock'|'paper'|'scissors'>, names: Map<string, string> }
const rooms = new Map();

function getRoom(roomKey) {
  if (!rooms.has(roomKey)) {
    rooms.set(roomKey, {
      players: new Set(),
      moves: new Map(),
      names: new Map(),
    });
  }
  return rooms.get(roomKey);
}

function determineWinner(aMove, bMove) {
  if (aMove === bMove) return 'draw';
  const win = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  return win[aMove] === bMove ? 'a' : 'b';
}

module.exports = function socketController(io) {
  io.on('connection', (socket) => {
    // Join a room (room key can be provided as room | roomId | roomCode)
    socket.on('join_room', (payload = {}) => {
      const roomKey = payload.room || payload.roomId || payload.roomCode;
      const playerName = payload.playerName || `Player-${socket.id.slice(0, 5)}`;
      if (!roomKey) return socket.emit('error', { message: 'room is required' });

      const room = getRoom(roomKey);
      socket.join(roomKey);
      socket.data.roomKey = roomKey;
      socket.data.playerName = playerName;

      room.players.add(socket.id);
      room.names.set(socket.id, playerName);

      socket.emit('joined_room', { room: roomKey, playerName });
    });

    // Player submits a move
    socket.on('player_move', (payload = {}) => {
      const move = (payload.move || '').toLowerCase();
      if (!['rock', 'paper', 'scissors'].includes(move)) {
        return socket.emit('error', { message: 'invalid move (rock|paper|scissors)' });
      }

      const roomKey = socket.data.roomKey;
      if (!roomKey) return socket.emit('error', { message: 'join a room first' });

      const room = getRoom(roomKey);
      // Record/overwrite this player's move
      room.moves.set(socket.id, move);

      // If we have moves from 2 distinct players, resolve the round
      if (room.moves.size >= 2) {
        const [aId, bId] = Array.from(room.moves.keys()).slice(0, 2);
        const aMove = room.moves.get(aId);
        const bMove = room.moves.get(bId);
        const aName = room.names.get(aId) || aId;
        const bName = room.names.get(bId) || bId;

        const resultKey = determineWinner(aMove, bMove); // 'a' | 'b' | 'draw'
        const winnerId = resultKey === 'draw' ? null : resultKey === 'a' ? aId : bId;
        const winnerName = winnerId ? (winnerId === aId ? aName : bName) : null;

        io.to(roomKey).emit('round_result', {
          room: roomKey,
          players: [
            { id: aId, name: aName, move: aMove },
            { id: bId, name: bName, move: bMove },
          ],
          winnerId,
          winnerName,
          result: resultKey === 'draw' ? 'draw' : 'win',
          message: resultKey === 'draw' ? 'Draw' : `Winner: ${winnerName}`,
        });

        // Reset moves for next round; keep players & names
        room.moves.clear();
      }
    });

    socket.on('disconnect', () => {
      const roomKey = socket.data.roomKey;
      if (!roomKey || !rooms.has(roomKey)) return;
      const room = rooms.get(roomKey);
      room.players.delete(socket.id);
      room.moves.delete(socket.id);
      room.names.delete(socket.id);
      // Cleanup empty room
      if (room.players.size === 0) rooms.delete(roomKey);
    });
  });
};
