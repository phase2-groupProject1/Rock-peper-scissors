require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const socketController = require('./controllers/socketController');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const port = 3000;

// Basic middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const UserController = require('./controllers/userController');
const RoomController = require('./controllers/roomController');
const AIController = require('./controllers/aiController');

// Basic route (optional)
app.get('/', (req, res) => {
  res.json({ status: 'RPS server running', socket: `ws://localhost:${port}` });
});

// Socket.io setup (open CORS for dev; adjust in production)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Register controller
socketController(io);
// Endpoint Users
app.post('/users', UserController.register);
app.get('/users/:id', UserController.getById); 
// Endpoint Rooms
app.post('/rooms', RoomController.createRoom);
app.get('/rooms/:room_code', RoomController.getRoomDetails);
app.post('/rooms/:room_code/join', RoomController.joinRoom);
app.post('/rooms/:room_code/ai', AIController.playAgainstAI);

// Start server
server.listen(port, () => {
  console.log(`RPS server listening on http://localhost:${port}`);
});




