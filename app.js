const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const socketController = require('./controllers/socketController');

const app = express();
const server = http.createServer(app);
const port = 3000;

// Basic middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const UserController = require('./controllers/userController');

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

server.listen(port, () => {
  console.log(`RPS server listening on http://localhost:${port}`);
});




