const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cron = require('node-cron');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {};  // store player sessions
let currentNumbers = [];  // track the extracted numbers
let timerStarted = false;

// Function to generate a bingo card
const generateCard = () => {
    let card = [];
    while (card.length < 25) {
        let num = Math.floor(Math.random() * 75) + 1;
        if (!card.includes(num)) card.push(num);
    }
    return card;
};

// Function to start game & draw a number every minute
const startGame = () => {
    currentNumbers = [];
    let drawnNumbers = [];
    let interval = setInterval(() => {
        if (drawnNumbers.length === 75) clearInterval(interval);
        let newNumber = Math.floor(Math.random() * 75) + 1;
        if (!drawnNumbers.includes(newNumber)) {
            drawnNumbers.push(newNumber);
            currentNumbers.push(newNumber);

            // Broadcast the new number to all players
            wss.clients.forEach(client => {
                client.send(JSON.stringify({ type: 'number-drawn', number: newNumber }));
            });

            checkForWinners();
        }
    }, 60000);  // Draw a number every 60 seconds (1 minute)
};

// Function to check if any player has won
const checkForWinners = () => {
    Object.keys(players).forEach(playerId => {
        players[playerId].cards.forEach(card => {
            if (card.every(num => currentNumbers.includes(num))) {
                endGame(playerId);
            }
        });
    });
};

// Function to end the game when someone wins
const endGame = (winnerId) => {
    clearInterval(startGame);
    wss.clients.forEach(client => {
        client.send(JSON.stringify({ type: 'game-end', winner: winnerId }));
    });
    timerStarted = false;
};

// WebSocket connection setup
wss.on('connection', (ws) => {
    let playerId = Math.random().toString(36).substring(7);  // generate unique player ID
    players[playerId] = { cards: [generateCard(), generateCard()] };  // give player 2 cards

    ws.send(JSON.stringify({ type: 'init', playerId, cards: players[playerId].cards }));

    if (!timerStarted) {
        startGame();
        timerStarted = true;
    }
});

// Start a new extraction every 30 minutes using cron
cron.schedule('*/30 * * * *', () => {
    startGame();
});

server.listen(8080, () => {
    console.log('Server running on port 8080');
});
