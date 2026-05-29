// server/room/Room.js - 单房间实例
const { GamePhase, CONFIG } = require('../../shared/constants');
const { generateRoomCode } = require('../utils/roomCode');

let ROOM_ID_COUNTER = 0;

class Room {
  constructor(hostId, hostName) {
    ROOM_ID_COUNTER++;
    this.id = `room_${ROOM_ID_COUNTER}`;
    this.code = generateRoomCode();
    this.state = 'waiting'; // waiting | playing | finished
    this.players = [];
    this.gameSession = null;
    this.createdAt = Date.now();

    this.addPlayer(hostId, hostName);
  }

  addPlayer(id, name) {
    this.players.push({ id, name, isReady: false, deckId: null, ws: null });
  }

  getPlayer(id) {
    return this.players.find(p => p.id === id);
  }

  removePlayer(id) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx !== -1) this.players.splice(idx, 1);
  }

  getOtherPlayer(id) {
    return this.players.find(p => p.id !== id) || null;
  }

  getPlayerByWs(ws) {
    return this.players.find(p => p.ws === ws);
  }

  isFull() {
    return this.players.length >= CONFIG.MAX_PLAYERS;
  }

  canStart() {
    return this.players.length === 2 &&
           this.players.every(p => p.isReady && p.deckId);
  }

  // 广播给所有玩家
  broadcast(type, payload, excludeWs = null) {
    const msg = JSON.stringify({ type, payload });
    for (const p of this.players) {
      if (p.ws && p.ws.readyState === 1 && p.ws !== excludeWs) {
        p.ws.send(msg);
      }
    }
  }

  // 广播给除了指定玩家之外的所有人
  broadcastExcept(playerId, message) {
    for (const p of this.players) {
      if (p.id !== playerId && p.ws && p.ws.readyState === 1) {
        p.ws.send(JSON.stringify(message));
      }
    }
  }

  toJSON() {
    return {
      code: this.code,
      state: this.state,
      players: this.players.map(p => ({
        id: p.id, name: p.name, isReady: p.isReady, deckId: p.deckId
      })),
      createdAt: this.createdAt
    };
  }
}

module.exports = { Room };
