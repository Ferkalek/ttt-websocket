const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { v4: uuidv4 } = require('uuid');
const port = process.env.PORT || 3000;

const app = express();
app.use(cors());

app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/getGameKey', (req, res) => {
  const gameKey = uuidv4();
  res.json({ gameKey });
});

const server = http.createServer(app);

const io = new Server(server, {
  // Дозвіл на з'єднання з джерелом. 
  // В цьому випадку - дозволити всім, але можна прописати конкретний домен, наприклад: http://localhost:3004
  // cors: {
  //   origin: "*", 
  //   methods: ["GET", "POST"]
  // }
});

io.on('connection', (socket) => {
  const gameKey = socket.handshake.query.gameKey;
  const roomName = `room-${gameKey}`;

  // Лічильник гравців у кімнаті
  let playerCount = io.sockets.adapter.rooms.get(roomName)?.size || 0;

  // Максимальна кількість гравців у кімнаті
  const maxPlayers = 2;


  if (playerCount < maxPlayers) {
    socket.join(roomName); // Додаємо гравця до кімнати
    playerCount++;

    socket.to(roomName).emit('userConnected');
    // Оновлюємо лічильник гравців у всіх гравців у кімнаті
    io.to(roomName).emit('updatePlayerCount', playerCount);

    // Обробник події виходу гравця з кімнати
    socket.on('disconnecting', (reason) => {
      console.log(`User ${socket.id} left the game`, reason);
      playerCount--;

      // Оновлюємо лічильник гравців у всіх гравців у кімнаті
      io.to(roomName).emit('updatePlayerCount', playerCount);
    });

    socket.on('setPlayerCross', () => socket.to(roomName).emit('playerCrossSet'));
  
    // Оновлення хрестика
    // Повідомлення інших гравців у кімнаті про встановлення хрестика
    socket.on('setCross', (position) => socket.to(roomName).emit('opponentSetCross', position));
  
    // Оновлення нулика
    // Повідомлення інших гравців у кімнаті про встановлення нулика
    socket.on('setZero', (position) => socket.to(roomName).emit('opponentSetZero', position));
  
    socket.on('winnerResult', (result) => socket.to(roomName).emit('sendWinnerResult', result));

    socket.on('restartGame', () => socket.to(roomName).emit('shouldRestartGame'));

  } else {
    // Відмовляємо в підключенні, якщо досягнуто максимальну кількість гравців
    socket.emit('maxPlayersReached', 'Maximum number of players in the room');
    socket.disconnect(true);
  }

});

server.listen(port, () => console.log(`listening on port ${port}`));
