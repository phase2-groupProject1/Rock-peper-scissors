const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const socketController = require('./controllers/socketController');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

// Basic middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route (optional)
app.get('/', (req, res) => {
  res.json({ status: 'RPS server running', socket: `ws://localhost:${port}` });
});



server.listen(port, () => {
  console.log(`RPS server listening on http://localhost:${port}`);
});