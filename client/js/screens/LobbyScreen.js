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
      el.innerHTML = `
        <div class="deck-card__element">${deck.element === 'fire' ? '🔥' : deck.element === 'water' ? '💧' : deck.element === 'grass' ? '🌿' : deck.element === 'electric' ? '⚡' : deck.element === 'psychic' ? '🌀' : '💪'}</div>
        <div class="deck-card__info">
          <div class="deck-card__name">${deck.name}</div>
          <div class="deck-card__desc">${deck.description || ''}</div>
        </div>
        <div class="deck-card__count">${deck.cardCount || 30}张</div>
      `;
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
      WS.send('select_deck', { deckId: GameState.selectedDeckId });
      // 稍微延迟再发送 ready
      setTimeout(() => {
        WS.send('player_ready', {});
      }, 200);
      document.getElementById('btn-ready').disabled = true;
      document.getElementById('btn-ready').textContent = '已准备';
    };
  },

  updateRoomPlayers(room) {
    const container = document.getElementById('room-players');
    container.innerHTML = '';
    if (!room || !room.players) return;

    room.players.forEach(p => {
      const el = document.createElement('div');
      el.className = 'room-player';
      el.innerHTML = `
        <div class="p-name">${p.name || '训练师'}</div>
        <div class="p-status ${p.isReady ? 'p-ready' : 'p-not-ready'}">
          ${p.isReady ? '✅ 已准备' : '⏳ 准备中'}
        </div>
      `;
      container.appendChild(el);
    });

    // 补齐空位
    while (container.children.length < 2) {
      const el = document.createElement('div');
      el.className = 'room-player waiting';
      el.innerHTML = `<div class="p-name">等待加入...</div>`;
      container.appendChild(el);
    }
  }
};
