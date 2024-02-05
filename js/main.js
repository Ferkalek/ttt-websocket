document.addEventListener("DOMContentLoaded", () => {
  document.querySelector('body').style.opacity = 1;
});

const table = document.getElementById("table");
const btnRestart = document.getElementById("restart");

const playerCountEl = document.getElementById("playerCount");
const typeOfPlayer = document.getElementById("typeOfPlayer");

const winResults = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["1", "4", "7"],
  ["2", "5", "8"],
  ["3", "6", "9"],
  ["1", "5", "9"],
  ["3", "5", "7"],
];

let counterClick = 0;
let arrX = [];
let arr0 = [];
let isStopGame = false;

const USER_TYPE_CROSS = 'cross';
const USER_TYPE_ZERO = 'zero';

let userType = null; // string 'cross' or 'zero'
let isBlock = false; // блокуємо ігрове поле

const urlParams = new URLSearchParams(window.location.search);
let gameKey = urlParams.get('gameKey');

let socket = null;
let gameUrl = '';

let amountOfPlayers = 0;

function initialize(key) {
  // socket = io(`http://localhost:3001/?gameKey=${key}`);
  // https://5aa7-2a02-a31a-e043-6080-a8e8-21d2-7139-7398.ngrok-free.app
  socket = io(`/?gameKey=${key}`);

  socket.on('userConnected', () => {
    userType = USER_TYPE_CROSS;

    typeOfPlayer.textContent = 'X';
    
    // Перший користувач призначений, як той, що ставить Х 
    // і треба тепер повідомити другу сторону, що вона - ігрок 0
    socket.emit('setPlayerCross', USER_TYPE_CROSS);
  });

  socket.on('updatePlayerCount', (playerCount) => {
    playerCountEl.textContent = playerCount;

    if (playerCount === 1 && !!urlParams.size) {
      document.location.href = '/';
    }

    if (playerCount === 2) {
      document.querySelector('.type-of-player').classList.remove('hidden');

      if (userType === USER_TYPE_CROSS) {
        showNotification('success', 'Joined second player');
      }
    }

    if (amountOfPlayers === 2 && playerCount < 2) {
      showNotification('warning', 'Second player left the game');
      restartGame();

      if (!!urlParams.size) {
        setTimeout(() => document.location.href = '/', 3000);
      }
    }

    amountOfPlayers = playerCount;
  });

  // обробки відмови в підключенні
  socket.on('maxPlayersReached', (message) => {
    showNotification('warning', message);
    setTimeout(() => document.location.href = '/', 3000);
  });
  
  socket.on('playerCrossSet', () => {
    userType = USER_TYPE_ZERO;
    typeOfPlayer.textContent = '0';
    showNotification('success', 'You are joined to the game');
  });
  
  
  // Обробка події встановлення хрестика
  socket.on('opponentSetCross', (position) => {
    // Логіка відображення хрестика опонента на вашому ігровому полі
    console.log('---opponentSetCross', position);
  
    setBlock(false);
    
    const el = document.querySelector(`[data-val="${position}"]`);
    el.classList.add("elem-x");
    arrX.push(position);
  
    if (arrX.length > 2) {
      result = checkoutWin(arrX);
    }
  });
  
  // Обробка події встановлення нолика
  socket.on('opponentSetZero', (position) => {
    // Логіка відображення нолика опонента на вашому ігровому полі
    console.log('---opponentSetZero', position);
  
    setBlock(false);
  
    const el = document.querySelector(`[data-val="${position}"]`);
    el.classList.add("elem-o");
    arr0.push(position);
  
    if (arr0.length > 2) {
      result = checkoutWin(arr0);
    }
  });

  socket.on('sendWinnerResult', (result) => finishOfGame(result));

  socket.on('shouldRestartGame', () => {
    restartGame();
    btnRestart.classList.add("hidden");
  });
}

if (gameKey) {
  initialize(gameKey);
} else {
  // https://5aa7-2a02-a31a-e043-6080-a8e8-21d2-7139-7398.ngrok-free.app
  // fetch('http://localhost:3001/getGameKey')
  fetch('/getGameKey')
    .then(response => response.json())
    .then(data => {
      gameKey = data.gameKey;
      gameUrl = `${document.location.origin}?gameKey=${gameKey}`;

      document.getElementById('invitation-link').value = gameUrl;
      document.querySelector('.invite-friend').classList.remove('hidden');

      initialize(gameKey);
    })
    .catch(error => {
      console.error('Error getting game key:', error);
      showNotification('failed', 'Cannot getting game key');
    });
}

async function copyContent(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('The link copied to clipboard');
    showNotification('success', 'The link copied to clipboard');
  } catch (err) {
    console.error('Failed to copy: ', err);
    showNotification('failed', 'Failed to copy of link');
  }
}

document.getElementById('copy-link').addEventListener('click', () => {
  const link = document.getElementById('invitation-link').value;
  copyContent(link);
});

// Ваша логіка для встановлення хрестика на ігровому полі
function setCross(position) {
  // Логіка відображення хрестика на вашому ігровому полі
  setBlock(true);

  // Повідомлення сервера про встановлення хрестика
  socket.emit('setCross', position);
}

// Ваша логіка для встановлення нолика на ігровому полі
function setZero(position) {
  // Логіка відображення нолика на вашому ігровому полі
  setBlock(true);

  // Повідомлення сервера про встановлення нолика
  socket.emit('setZero', position);
}

function setWinnerResult(result) {
  socket.emit('winnerResult', result);
}

function setBlock(val) {
  const body = document.querySelector('body');
  if (val) {
    body.classList.add('is-block');
  } else {
    if (body.classList.contains('is-block')) {
      body.classList.remove('is-block');
    }
  }
}

function finishOfGame(result) {
  document.getElementById("wrapper").classList.add(`winner-${result}`);
    showButton();
    isStopGame = true;
}


table.addEventListener("click", function (e) {
  if (
    e.target.classList.contains("elem-x") ||
    e.target.classList.contains("elem-o") ||
    !e.target.classList.contains("cell") ||
    isStopGame
  ) {
    return;
  }

  const value = e.target.dataset.val;
  let result = null;

  counterClick++;

  // у випадку якщо грає сам з собою
  if (userType === null) {
    if (counterClick % 2) {
      e.target.classList.add("elem-x");
      arrX.push(value);

      if (arrX.length > 2) {
        result = checkoutWin(arrX);
      }
    } else {
      e.target.classList.add("elem-o");
      arr0.push(value);

      if (arr0.length > 2) {
        result = checkoutWin(arr0);
      }
    }
  }

  // у випадку коли грає двоє
  if (userType === USER_TYPE_CROSS) {
    e.target.classList.add("elem-x");
    setCross(value);
    arrX.push(value);

    if (arrX.length > 2) {
      result = checkoutWin(arrX);
    }
  } else if (userType === USER_TYPE_ZERO) {
    e.target.classList.add("elem-o");
    setZero(value);
    arr0.push(value);

    if (arr0.length > 2) {
      result = checkoutWin(arr0);
    }
  }

  if (result !== null) {
    finishOfGame(result);
    setWinnerResult(result);
  }

  if ((amountOfPlayers === 2 && counterClick > 4) || counterClick > 8) {
    showButton();
  }
});

function checkoutWin(arr) {
  for (let i = 0; i < 8; i++) {
    if (
      arr.includes(winResults[i][0]) &&
      arr.includes(winResults[i][1]) &&
      arr.includes(winResults[i][2])
    ) {
      return i + 1;
    }
  }
  return null;
}

function showButton() {
  if (btnRestart.classList.contains("hidden")) {
    btnRestart.classList.remove("hidden");
  }
}

btnRestart.addEventListener("click", function (e) {
  console.log('--------- e', e)
  restartGame();

  if (socket && amountOfPlayers === 2) {
    socket.emit('restartGame');
  }

  e.target.classList.add("hidden");
});

function restartGame() {
  isStopGame = false;
  counterClick = 0;
  arrX = [];
  arr0 = [];
  document.getElementById("wrapper").className = "";
  document.querySelectorAll("table td").forEach((elem) => {
    elem.classList = "cell";
  });
}

const notification = document.querySelector('.notification');
const notificationMessage = document.querySelector('.notification .msg');
const notificationCloseBtn = document.querySelector('.notification .close');


function showNotification(type, msg) {
  // type could be: 'success', 'failed', and 'warning'

  notificationMessage.textContent = msg;
  notification.classList.add(type);
  setTimeout(() => notification.classList.add('show'), 300);

  setTimeout(() => notification.classList.remove('show'), 3000);
  setTimeout(() => {
    notificationMessage.textContent = '';
    notification.classList.remove(type);
  }, 3500);
}

notificationCloseBtn.addEventListener('click', function() {
  notification.classList.remove('show');

  setTimeout(() => {
    notification.classList.remove('success', 'failed', 'warning');
    notificationMessage.textContent = '';
  }, 500);
});
