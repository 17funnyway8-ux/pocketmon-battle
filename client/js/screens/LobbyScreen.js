// LobbyScreen.js - 大厅界面控制
const LobbyScreen = {
  init() {
    this._bindEvents();
    this._switchTab('create');
    document.getElementById('input-name-create').value = '训练师' + Math.floor(Math.random() * 1000);
    document.getElementById('input-name-join').value = '训练师' + Math.floor(Math.random() * 1000);
  },

  show() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-lobby').classList.add('active');
  },

  _bindEvents() {
    // Tab 切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._switchTab(btn.dataset.tab);
      });
    });

    // 创建房间
    document.getElementById('btn-create-room').addEventListener('click', () => {
      const name = document.getElementById('input-name-create').value.trim() || '训练师';
      WS.send('create_room', { playerName: name });
      this._setStatus('创建中...', 'info');
    });

    // 加入房间
    document.getElementById('btn-join-room').addEventListener('click', () => {
      const name = document.getElementById('input-name-join').value.trim() || '训练师';
      const code = document.getElementById('input-room-code').value.trim().toUpperCase();
      if (!code || code.length < 4) {
        this._setStatus('请输入有效的房间码', 'error');
        return;
      }
      WS.send('join_room', { roomCode: code, playerName: name });
      this._setStatus('加入中...', 'info');
    });

    // 房间码自动大写
    document.getElementById('input-room-code').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    // 回车提交
    document.getElementById('input-room-code').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-join-room').click();
    });
    document.getElementById('input-name-create').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-create-room').click();
    });
  },

  _switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('tab-create').classList.toggle('hidden', tab !== 'create');
    document.getElementById('tab-join').classList.toggle('hidden', tab !== 'join');
  },

  _setStatus(msg, type) {
    const el = document.getElementById('lobby-status');
    if (!msg) { el.classList.add('hidden'); return; }
    el.className = 'lobby-status ' + (type || 'info');
    el.textContent = msg;
    el.classList.remove('hidden');
  },

  showDeckSelect(roomCode, decks) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-deck-select').classList.add('active');
    document.getElementById('deck-room-info').textContent = `房间: ${roomCode}`;

    GameState.room = { code: roomCode };
    GameState.decks = decks;

    const list = document.getElementById('deck-list');
    list.innerHTML = '';
    decks.forEach(deck => {
      const el = document.createElement('div');
      el.className = 'deck-card';
      el.dataset.deckId = deck.id;
      const elemDiv = document.createElement('div');
      elemDiv.className = 'deck-card__element';
      elemDiv.textContent = deck.element === 'fire' ? '🔥' : deck.element === 'water' ? '💧' : deck.element === 'grass' ? '🌿' : deck.element === 'electric' ? '⚡' : deck.element === 'psychic' ? '🌀' : '💪';
      el.appendChild(elemDiv);

      const infoDiv = document.createElement('div');
      infoDiv.className = 'deck-card__info';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'deck-card__name';
      nameDiv.textContent = deck.name;
      infoDiv.appendChild(nameDiv);

      const descDiv = document.createElement('div');
      descDiv.className = 'deck-card__desc';
      descDiv.textContent = deck.description || '';
      infoDiv.appendChild(descDiv);
      el.appendChild(infoDiv);

      const countDiv = document.createElement('div');
      countDiv.className = 'deck-card__count';
      countDiv.textContent = (deck.cardCount || 30) + '张';
      el.appendChild(countDiv);
      el.addEventListener('click', () => {
        document.querySelectorAll('.deck-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        GameState.selectedDeckId = deck.id;
        document.getElementById('btn-ready').disabled = false;
      });
      list.appendChild(el);
    });

    // 默认选中第一个
    if (decks.length > 0) {
      list.firstChild.click();
    }

    document.getElementById('btn-ready').onclick = () => {
      if (!GameState.selectedDeckId) return;
      // 先选牌
      WS.send('select_deck', { deckId: GameState.selectedDeckId });
      document.getElementById('btn-ready').disabled = true;
      document.getElementById('btn-ready').textContent = '选牌中...';
      // 等待 room_updated 确认选牌成功后再发 ready
      // 这里通过全局回调来触发
    };

    // 选牌确认通过 EventBus 触发
    const unsubDeck = EventBus.on('deck_confirmed', () => {
      WS.send('player_ready', {});
      const btn = document.getElementById('btn-ready');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '✅ 已准备';
      }
      unsubDeck(); // 只触发一次
    });

    // 强制开始按钮
    document.getElementById('btn-force-start').onclick = () => {
      // 先确保自己选了牌
      if (GameState.selectedDeckId) {
        WS.send('select_deck', { deckId: GameState.selectedDeckId });
      }
      // 直接发 ready 并尝试强制开始
      setTimeout(() => {
        WS.send('player_ready', {});
        // 再发一次确保
        setTimeout(() => {
          WS.send('player_ready', {});
        }, 500);
      }, 300);
      document.getElementById('btn-force-start').disabled = true;
      document.getElementById('btn-force-start').textContent = '正在强制开始...';
    };
  },

  updateRoomPlayers(room) {
    const container = document.getElementById('room-players');
    container.innerHTML = '';
    if (!room || !room.players) return;

    room.players.forEach(p => {
      const el = document.createElement('div');
      el.className = 'room-player';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'p-name';
      nameDiv.textContent = p.name || '训练师';
      const statusDiv = document.createElement('div');
      statusDiv.className = `p-status ${p.isReady ? 'p-ready' : 'p-not-ready'}`;
      statusDiv.textContent = p.isReady ? '✅ 已准备' : '⏳ 准备中';
      el.appendChild(nameDiv);
      el.appendChild(statusDiv);
      container.appendChild(el);
    });

    // 补齐空位
    while (container.children.length < 2) {
      const el = document.createElement('div');
      el.className = 'room-player waiting';
      el.innerHTML = `<div class="p-name">等待加入...</div>`;
      container.appendChild(el);
    }

    // 如果两人都在房间，显示强制开始按钮
    const forceBtn = document.getElementById('btn-force-start');
    if (room.players && room.players.length === 2) {
      forceBtn.style.display = 'block';
    } else {
      forceBtn.style.display = 'none';
    }
  }
};
