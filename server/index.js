// server/index.js - WebSocket 服务入口
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const { RoomManager } = require('./room/RoomManager');
const { GameSession } = require('./game/GameSession');
const { C2S, S2C, GamePhase, CONFIG } = require('../shared/constants');
const { PREBUILT_DECKS, isDeckValid } = require('./data/cards');

const path = require('path');
const fs = require('fs');

// 版本号
const APP_VERSION = (() => {
  try { return fs.readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf8').trim(); }
  catch(e) { return 'dev'; }
})();
const roomManager = new RoomManager();
const PORT = process.env.PORT || 3000;

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const CLIENT_DIR = path.join(__dirname, '..', 'client');

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  // API / 健康检查
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // 静态文件服务
  // 剥离查询参数（如 ?v=1.0.4），防止 path.extname 误判扩展名
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(CLIENT_DIR, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 找不到文件，返回 index.html（SPA 后备）
      fs.readFile(path.join(CLIENT_DIR, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          return res.end('Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

// ============================================================
// 连接处理
// ============================================================
wss.on('connection', (ws, req) => {
  const session = {
    ws,
    playerId: uuidv4(),
    name: '训练师',
    roomId: null,
    isAlive: true
  };
  ws.sessionData = session;

  console.log(`[+] 新连接: ${session.playerId}`);

  send(ws, S2C.CONNECTED, { playerId: session.playerId });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleMessage(session, msg);
    } catch (err) {
      send(ws, S2C.ERROR, { code: 'INVALID_JSON', message: '消息格式错误' });
    }
  });

  ws.on('close', () => {
    console.log(`[-] 断开: ${session.playerId}`);
    handleDisconnect(session);
  });

  ws.on('pong', () => { session.isAlive = true; });
});

// ============================================================
// 心跳
// ============================================================
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.sessionData && !ws.sessionData.isAlive) {
      return ws.terminate();
    }
    if (ws.sessionData) {
      ws.sessionData.isAlive = false;
      ws.ping();
    }
  });

  // 清理过期房间
  roomManager.cleanStaleRooms();
}, CONFIG.HEARTBEAT_INTERVAL);

// ============================================================
// 消息路由
// ============================================================
const handlers = {
  [C2S.CREATE_ROOM]: handleCreateRoom,
  [C2S.JOIN_ROOM]: handleJoinRoom,
  [C2S.LEAVE_ROOM]: handleLeaveRoom,
  [C2S.SELECT_DECK]: handleSelectDeck,
  [C2S.PLAYER_READY]: handlePlayerReady,
  [C2S.GAME_ACTION]: handleGameAction,
  [C2S.FORFEIT]: handleForfeit,
  [C2S.RECONNECT]: handleReconnect,
  [C2S.PING]: () => {}
};

// 速率限制
const rateLimitMap = new Map();
function checkRateLimit(session) {
  const now = Date.now();
  const record = rateLimitMap.get(session.playerId) || { count: 0, resetAt: now + 1000 };
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + 1000;
  } else {
    record.count++;
  }
  rateLimitMap.set(session.playerId, record);
  if (record.count > 15) {
    console.warn(`  速率限制: ${session.playerId} 消息过多`);
    return false;
  }
  return true;
}

function handleMessage(session, msg) {
  const handler = handlers[msg.type];
  if (msg.type !== 'ping' && !checkRateLimit(session)) return;
  if (!handler) {
    return send(session.ws, S2C.ERROR, { code: 'UNKNOWN_TYPE', message: `未知消息类型: ${msg.type}` });
  }
  handler(session, msg.payload || {});
}

// ============================================================
// 房间操作
// ============================================================
function handleCreateRoom(session, payload) {
  const name = payload.playerName || '训练师';
  session.name = name;

  try {
    const room = roomManager.createRoom(session.playerId, name);

    // 绑定 WebSocket
    const player = room.getPlayer(session.playerId);
    if (player) player.ws = session.ws;
    session.roomId = room.id;

    send(session.ws, S2C.ROOM_CREATED, {
      roomCode: room.code,
      room: room.toJSON(),
      decks: getDeckList()
    });
    console.log(`  房间创建: ${room.code} by ${name}`);
  } catch (err) {
    send(session.ws, S2C.ERROR, { code: 'CREATE_FAILED', message: err.message });
  }
}

function handleJoinRoom(session, payload) {
  const { roomCode, playerName } = payload;
  if (!roomCode) return send(session.ws, S2C.ERROR, { code: 'NO_CODE', message: '请输入房间码' });

  const name = playerName || '训练师';
  session.name = name;

  try {
    const result = roomManager.joinRoom(roomCode, session.playerId, name);
    const room = result.room;

    if (result.isReconnect) {
      // === 断线重连 ===
      const targetId = result.targetPlayerId;
      const player = room.getPlayer(targetId);
      if (!player) throw new Error('RECONNECT_FAILED');

      // 更新 WS 连接和信息
      player.name = name;
      player.ws = session.ws;
      session.roomId = room.id;
      session.playerId = targetId; // 使用原有 playerId 保证状态一致

      // 发送当前游戏状态
      if (room.gameSession) {
        const view = room.gameSession.getViewForPlayer(targetId);
        send(session.ws, S2C.GAME_STATE, { ...view, reconnected: true });
        // 通知对手
        room.broadcastExcept(targetId, {
          type: S2C.OPPONENT_RECONNECTED, payload: {}
        });
      }
      console.log(`  重连成功: ${roomCode} by ${name} (${targetId})`);
      return;
    }

    // === 正常加入（等待中的房间） ===
    const player = room.getPlayer(session.playerId);
    if (player) player.ws = session.ws;
    session.roomId = room.id;

    send(session.ws, S2C.ROOM_JOINED, {
      roomCode: room.code,
      room: room.toJSON(),
      decks: getDeckList()
    });

    room.broadcastExcept(session.playerId, {
      type: S2C.PLAYER_JOINED,
      payload: { player: { id: session.playerId, name, isReady: false, deckId: null } }
    });

    console.log(`  加入房间: ${roomCode} by ${name}`);
  } catch (err) {
    const errMap = {
      'ROOM_NOT_FOUND': { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      'ROOM_IN_GAME': { code: 'ROOM_IN_GAME', message: '游戏已开始' },
      'ROOM_FULL': { code: 'ROOM_FULL', message: '房间已满' }
    };
    const info = errMap[err.message] || { code: 'JOIN_FAILED', message: err.message };
    send(session.ws, S2C.ERROR, info);
  }
}

function handleLeaveRoom(session) {
  const room = roomManager.leaveRoom(session.playerId);
  if (room) {
    room.broadcastExcept(session.playerId, {
      type: S2C.PLAYER_LEFT,
      payload: { playerId: session.playerId }
    });
    // 如果房间只剩1人，也通知他
    if (room.players.length === 1) {
      const remaining = room.players[0];
      if (remaining.ws && remaining.ws.readyState === 1) {
        send(remaining.ws, S2C.PLAYER_LEFT, { playerId: session.playerId });
      }
    }
  }
  session.roomId = null;
}

// ============================================================
// 牌组选择 & 准备
// ============================================================
function handleSelectDeck(session, payload) {
  const room = roomManager.getRoomByPlayer(session.playerId);
  if (!room) return send(session.ws, S2C.ERROR, { code: 'NO_ROOM', message: '不在房间中' });

  const deck = PREBUILT_DECKS.find(d => d.id === payload.deckId);
  if (!deck) return send(session.ws, S2C.ERROR, { code: 'INVALID_DECK', message: '牌组不存在' });
  if (!isDeckValid(deck)) return send(session.ws, S2C.ERROR, { code: 'INVALID_DECK', message: '牌组不合法' });

  const player = room.getPlayer(session.playerId);
  if (player) player.deckId = payload.deckId;
  console.log(`  ${session.name} 选择了 ${deck.name}`);

  room.broadcast(S2C.ROOM_UPDATED, room.toJSON());
}

function handlePlayerReady(session) {
  const room = roomManager.getRoomByPlayer(session.playerId);
  if (!room) return send(session.ws, S2C.ERROR, { code: 'NO_ROOM', message: '不在房间中' });

  const player = room.getPlayer(session.playerId);
  if (!player) return;

  // 如果没有选牌，静默处理（前端会重试）
  if (!player.deckId) {
    console.log(`  ${session.name} 尝试准备但未选牌，忽略`);
    return;
  }

  // 重复点击准备不会切换回未准备状态（防止 toggle 误触）
  if (!player.isReady) {
    player.isReady = true;
    console.log(`  ${session.name} 已准备`);
    room.broadcast(S2C.ROOM_UPDATED, room.toJSON());
  }

  // 双方都准备 -> 开始游戏
  if (room.canStart()) {
    console.log(`  双方已准备，开始游戏!`);
    try {
      startGame(room);
    } catch (err) {
      console.error(`  开始游戏失败:`, err);
      send(session.ws, S2C.ERROR, { code: 'START_FAILED', message: '开始游戏失败: ' + err.message });
    }
  }
}

function startGame(room) {
  console.log(`  [开始游戏] 房间: ${room.code}`);
  const session = new GameSession(room);
  room.gameSession = session;
  room.state = 'playing';
  session.initGame();
  for (const p of room.players) {
    const view = session.getViewForPlayer(p.id);
    if (p.ws && p.ws.readyState === 1) {
      send(p.ws, S2C.GAME_START, { ...view, isSetup: true });
    }
  }
}

// ============================================================
// 游戏动作
// ============================================================
function handleGameAction(session, payload) {
  const room = roomManager.getRoomByPlayer(session.playerId);
  if (!room || !room.gameSession) {
    return send(session.ws, S2C.ERROR, { code: 'NO_GAME', message: '没有进行中的游戏' });
  }

  const gs = room.gameSession;

  // 设置阶段（放置初始宝可梦）
  if (gs.state.phase === GamePhase.SETUP) {
    if (payload.action === 'setup_active') {
      console.log(`  [设置] ${session.name} 放置出战宝可梦: ${payload.cardId}`);
      const result = gs.confirmSetup(session.playerId, payload);
      if (result.error) {
        return send(session.ws, S2C.ACTION_DENIED, { action: 'setup_active', reason: result.error });
      }

      // 广播更新
      for (const p of room.players) {
        const view = gs.getViewForPlayer(p.id);

        if (result.ready && p.ws && p.ws.readyState === 1) {
          // 游戏正式开始
          p.ws.send(JSON.stringify({
            type: S2C.GAME_STATE,
            payload: { ...view, gameStarted: true }
          }));
        } else if (p.ws && p.ws.readyState === 1) {
          p.ws.send(JSON.stringify({
            type: S2C.GAME_STATE,
            payload: view
          }));
        }
      }
      return;
    }
    return send(session.ws, S2C.ACTION_DENIED, {
      action: payload.action,
      reason: '请在设置阶段放置出战宝可梦'
    });
  }

  // 正常游戏动作
  const result = gs.handleAction(session.playerId, payload.action, payload);

  if (result.error) {
    return send(session.ws, S2C.ACTION_DENIED, {
      action: payload.action,
      reason: result.error
    });
  }

  // 游戏结束
  if (result.gameOver) {
    for (const p of room.players) {
      const view = gs.getViewForPlayer(p.id);
      if (p.ws && p.ws.readyState === 1) {
        p.ws.send(JSON.stringify({
          type: S2C.GAME_OVER,
          payload: {
            winner: result.winner,
            winnerName: room.getPlayer(result.winner)?.name || '未知',
            reason: result.reason,
            ...view
          }
        }));
      }
    }
    room.state = 'finished';
    return;
  }

  // 广播状态更新
  gs._broadcastState();
}

// ============================================================
// 投降
// ============================================================
function handleForfeit(session) {
  const room = roomManager.getRoomByPlayer(session.playerId);
  if (!room || !room.gameSession) return;

  const result = room.gameSession.forfeit(session.playerId);

  for (const p of room.players) {
    if (p.ws && p.ws.readyState === 1) {
      const view = room.gameSession.getViewForPlayer(p.id);
      p.ws.send(JSON.stringify({
        type: S2C.GAME_OVER,
        payload: {
          winner: result.winner,
          winnerName: room.getPlayer(result.winner)?.name,
          reason: result.reason,
          ...view
        }
      }));
    }
  }
  room.state = 'finished';
}

// ============================================================
// 断线处理
// ============================================================
const disconnectTimers = new Map();

function handleDisconnect(session) {
  console.log(`[-] 断开: ${session.playerId}`);
  const room = roomManager.getRoomByPlayer(session.playerId);
  if (!room) return;

  if (room.state === 'playing') {
    // 设置 30 秒超时：不重连则自动投降
    const timer = setTimeout(() => {
      const r = roomManager.getRoomByPlayer(session.playerId);
      if (!r || r.state !== 'playing') return;
      if (r.gameSession && r.gameSession.state.phase !== 'game_over') {
        const result = r.gameSession.forfeit(session.playerId);
        // 通知还在线的玩家
        for (const p of r.players) {
          if (p.id !== session.playerId && p.ws && p.ws.readyState === 1) {
            const view = r.gameSession.getViewForPlayer(p.id);
            p.ws.send(JSON.stringify({
              type: 'game_over',
              payload: { winner: result.winner, winnerName: p.name, reason: '对方超时未重连', ...view }
            }));
          }
        }
        r.state = 'finished';
        console.log(`  超时: ${session.playerId} 自动投降`);
      }
      disconnectTimers.delete(session.playerId);
    }, 30000);
    disconnectTimers.set(session.playerId, timer);

    // 通知对手
    const other = room.getOtherPlayer(session.playerId);
    if (other && other.ws && other.ws.readyState === 1) {
      other.ws.send(JSON.stringify({
        type: 'opponent_disconnected',
        payload: { timeout: 30 }
      }));
    }
  } else {
    // 大厅中断线，直接离开
    room.removePlayer(session.playerId);
    room.broadcastExcept(session.playerId, {
      type: 'player_left',
      payload: { playerId: session.playerId }
    });
    if (room.players.length === 0) {
      roomManager._destroyRoom(room.id);
    }
  }
  roomManager.playerRoomIndex.delete(session.playerId);
}

function handleReconnect(session, payload) {
  const { roomCode } = payload;
  const room = roomManager.getRoomByCode(roomCode);
  if (!room || !room.gameSession) {
    return send(session.ws, S2C.ERROR, { code: 'ROOM_CLOSED', message: '房间已关闭' });
  }

  // 更新连接
  const player = room.getPlayer(session.playerId);
  if (player) {
    player.ws = session.ws;
  }
  session.roomId = room.id;

  // 发送重连状态
  const view = room.gameSession.getViewForPlayer(session.playerId);
  send(session.ws, S2C.GAME_STATE, { ...view, reconnected: true });

  // 通知对手重连成功
  room.broadcastExcept(session.playerId, {
    type: S2C.OPPONENT_RECONNECTED,
    payload: {}
  });
}

// ============================================================
// 工具函数
// ============================================================
function send(ws, type, payload) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function getDeckList() {
  return PREBUILT_DECKS.map(d => ({
    id: d.id, name: d.name, element: d.element,
    description: d.description, cardCount: d.cards.length
  }));
}

// ============================================================
// 启动服务器
// ============================================================
server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════╗`);
  console.log(`║  PocketMon Battle v${APP_VERSION.padEnd(5)}  ║`);
  console.log(`║  HTTP:   http://0.0.0.0:${PORT} ║`);
  console.log(`║  WS:     ws://0.0.0.0:${PORT}   ║`);
  console.log(`╚══════════════════════════════╝\n`);
});
