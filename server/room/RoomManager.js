// server/room/RoomManager.js - 房间生命周期管理
const { Room } = require('./Room');

class RoomManager {
  constructor() {
    this.rooms = new Map();         // roomId -> Room
    this.codeIndex = new Map();     // roomCode -> roomId
    this.playerRoomIndex = new Map(); // playerId -> roomId
  }

  createRoom(hostId, hostName) {
    const room = new Room(hostId, hostName);
    this.rooms.set(room.id, room);
    this.codeIndex.set(room.code, room.id);
    this.playerRoomIndex.set(hostId, room.id);
    return room;
  }

  joinRoom(roomCode, playerId, playerName) {
    const roomId = this.codeIndex.get(roomCode.toUpperCase());
    if (!roomId) throw new Error('ROOM_NOT_FOUND');
    const room = this.rooms.get(roomId);

    // 游戏进行中 - 检查是否可重连
    if (room.state === 'playing') {
      // 找一个没有活跃 WebSocket 连接的玩家席位
      const disconnectedSlot = room.players.find(p => !p.ws || p.ws.readyState !== 1);
      if (disconnectedSlot) {
        // 把新玩家绑定到这个空位上
        this.playerRoomIndex.set(playerId, roomId);
        // 返回特殊标记，让上层做重连处理
        return { room, isReconnect: true, targetPlayerId: disconnectedSlot.id };
      }
      throw new Error('ROOM_FULL');
    }

    if (room.state !== 'waiting') throw new Error('ROOM_IN_GAME');
    if (room.isFull()) throw new Error('ROOM_FULL');
    if (this.playerRoomIndex.has(playerId)) {
      this.leaveRoom(playerId);
    }
    room.addPlayer(playerId, playerName);
    this.playerRoomIndex.set(playerId, roomId);
    return { room, isReconnect: false, targetPlayerId: null };
  }

  leaveRoom(playerId) {
    const roomId = this.playerRoomIndex.get(playerId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (room) {
      room.removePlayer(playerId);
      if (room.players.length === 0) {
        this._destroyRoom(roomId);
        return null;
      }
    }
    this.playerRoomIndex.delete(playerId);
    return room;
  }

  getRoomByPlayer(playerId) {
    const roomId = this.playerRoomIndex.get(playerId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  getRoomByCode(code) {
    const roomId = this.codeIndex.get(code.toUpperCase());
    return roomId ? this.rooms.get(roomId) : null;
  }

  _destroyRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.codeIndex.delete(room.code);
    this.rooms.delete(roomId);
    // 清理玩家索引
    for (const [pid, rid] of this.playerRoomIndex) {
      if (rid === roomId) this.playerRoomIndex.delete(pid);
    }
  }

  // 清理超时空房间（10分钟无活跃）
  cleanStaleRooms(maxAgeMs = 600000) {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      if (now - room.createdAt > maxAgeMs && room.state === 'waiting') {
        this._destroyRoom(id);
      }
    }
  }
}

module.exports = { RoomManager };
