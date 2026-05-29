// app.js - 应用入口 & WebSocket 消息路由
(function() {
  'use strict';

  // WebSocket URL: 自动适应本地开发和部署环境
  // 本地: ws://localhost:3000  |  部署: wss://your-app.onrender.com
  const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;

  // ============================================================
  // 初始化
  // ============================================================
  LobbyScreen.init();
  BattleScreen.init();

  // 连接服务器
  WS.connect(WS_URL);

  // ============================================================
  // WebSocket 消息路由
  // ============================================================

  // 连接成功
  WS.on('connected', (payload) => {
    console.log('[连接] 已连接, ID:', payload.playerId);
    GameState.playerId = payload.playerId;
  });

  // 房间创建成功
  WS.on('room_created', (payload) => {
    console.log('[房间] 创建成功:', payload.roomCode);
    LobbyScreen.showDeckSelect(payload.roomCode, payload.decks || []);
  });

  // 加入房间成功
  WS.on('room_joined', (payload) => {
    console.log('[房间] 加入成功:', payload.roomCode);
    LobbyScreen.showDeckSelect(payload.roomCode, payload.decks || []);
    if (payload.room) {
      LobbyScreen.updateRoomPlayers(payload.room);
    }
  });

  // 玩家加入
  WS.on('player_joined', (payload) => {
    console.log('[房间] 玩家加入:', payload.player);
    // 更新房间显示
    const room = GameState.room;
    if (room) {
      const fakeRoom = {
        code: room.code,
        players: [room.players ? room.players[0] : { name: '我' }, payload.player]
      };
      LobbyScreen.updateRoomPlayers({
        code: room.code,
        players: [
          { name: GameState.me ? GameState.me.playerName : '我', isReady: false },
          { name: payload.player.name, isReady: false }
        ]
      });
    }
  });

  // 玩家离开
  WS.on('player_left', (payload) => {
    console.log('[房间] 玩家离开:', payload.playerId);
  });

  // 房间更新
  WS.on('room_updated', (payload) => {
    console.log('[房间] 更新:', payload);
    if (payload.players) {
      LobbyScreen.updateRoomPlayers(payload);
      // 检测选牌确认：自己被列在 players 中且 deckId 不为空
      const myPlayer = payload.players.find(p => p.id === GameState.playerId);
      if (myPlayer && myPlayer.deckId) {
        // 如果还在等待选牌确认，触发 ready
        if (document.getElementById('screen-deck-select').classList.contains('active')) {
          EventBus.emit('deck_confirmed');
        }
      }
    }
  });

  // 游戏开始
  WS.on('game_start', (payload) => {
    console.log('[游戏] 开始!');
    GameState.reset();
    GameState.playerId = payload.yourPlayerId;
    GameState.applyGameState(payload);
    BattleScreen.show();
    BattleScreen.updateState(payload);
  });

  // 游戏状态更新
  WS.on('game_state', (payload) => {
    // console.log('[状态]', payload.phase, payload.turnPhase);
    BattleScreen.updateState(payload);
  });

  // 动作被拒
  WS.on('action_denied', (payload) => {
    console.warn('[动作被拒]', payload.reason);
    // 显示提示
    const phaseEl = document.getElementById('battle-phase-info');
    if (phaseEl) {
      phaseEl.textContent = '⚠ ' + payload.reason;
      phaseEl.style.color = 'var(--danger)';
      setTimeout(() => {
        phaseEl.style.color = '';
        if (GameState.isMyTurn) {
          phaseEl.textContent = GameState.turnPhase === 'main' ? '主要阶段' : '你的回合';
        }
      }, 2000);
    }
  });

  // 游戏结束
  WS.on('game_over', (payload) => {
    console.log('[游戏结束]', payload.winner, payload.reason);
    GameState.applyGameState(payload);
    BoardRenderer.render(GameState);
    BattleScreen.showGameOver(payload);
  });

  // 对手断线
  WS.on('opponent_disconnected', (payload) => {
    console.log('[对手] 断线');
    const phaseEl = document.getElementById('battle-phase-info');
    if (phaseEl) {
      phaseEl.textContent = '⏳ 对手断线，等待重连...';
      phaseEl.style.color = 'var(--accent2)';
    }
  });

  // 对手重连
  WS.on('opponent_reconnected', () => {
    console.log('[对手] 重连成功');
    const phaseEl = document.getElementById('battle-phase-info');
    if (phaseEl) {
      phaseEl.textContent = '对手已重连';
      phaseEl.style.color = 'var(--success)';
      setTimeout(() => { phaseEl.style.color = ''; }, 2000);
    }
  });

  // 错误消息
  WS.on('error', (payload) => {
    console.error('[错误]', payload.message);
    if (document.getElementById('screen-lobby').classList.contains('active')) {
      LobbyScreen._setStatus(payload.message, 'error');
    } else {
      const phaseEl = document.getElementById('battle-phase-info');
      if (phaseEl) phaseEl.textContent = '⚠ ' + payload.message;
    }
  });

  // 全消息监听（调试用）
  WS.on('*', (msg) => {
    // 可以在控制台取消注释来调试
    // console.log('[WS]', msg.type, msg.payload);
  });

  console.log('PocketMon Battle 已启动!');
  console.log(`连接至: ${WS_URL}`);
})();
