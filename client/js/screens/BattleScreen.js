// BattleScreen.js - 对战界面控制
const BattleScreen = {
  selectedCard: null,
  selectedCardEl: null,
  pendingAction: null,    // 待处理的 action 类型
  lastLogCount: 0,
  energyAttached: false,
  _setupPlacedCard: null,    // 本地已放置的宝可梦卡（乐观记录）
  _hasConfirmedSetup: false, // 玩家是否已点击确认（不可逆）
  _setupRendered: false,     // 选牌界面是否已渲染过
  _boardTemplate: '',        // 原始对战棋盘 HTML（setup 覆盖后用于恢复）

  init() {
    BoardRenderer.init();
    AnimationManager.init();
    this._bindEvents();
    // 捕获原始棋盘模板（只做一次）
    const board = document.getElementById('board');
    if (board && !this._boardTemplate) {
      this._boardTemplate = board.innerHTML;
    }
  },

  show() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-battle').classList.add('active');
    // 确保 board 恢复为原始结构（防止之前 setup 残留）
    if (this._boardTemplate) {
      document.getElementById('board').innerHTML = this._boardTemplate;
    }
    this.selectedCard = null;
    this.selectedCardEl = null;
    this.pendingAction = null;
    this.lastLogCount = 0;
    this._setupPlacedCard = null;
    this._hasConfirmedSetup = false;
    this._setupRendered = false;
  },

  updateState(payload) {
    GameState.applyGameState(payload);

    // 双方都确认后游戏正式开始
    if (payload.gameStarted) {
      // ★ 关键修复：_renderSetup / _renderSetupWaiting 替换了 board.innerHTML，
      // 导致 BoardRenderer 缓存的 DOM 引用（player-hand等）变成游离节点。
      // 必须先恢复原始棋盘结构，然后重新初始化 BoardRenderer 引用。
      document.getElementById('board').innerHTML = this._boardTemplate;
      BoardRenderer.init();
      GameState.isSetup = false;
      BoardRenderer.render(GameState);
      this._updateActions();
      this._updateLog(payload.turnLog);
      this._clearSelection();
      return;
    }

    // 设置阶段
    if (payload.isSetup || GameState.phase === 'setup') {
      GameState.isSetup = true;

      const me = GameState.me;

      // 优先级1：己方已确认（本地标志 或 服务器已记录了activePokemon）
      if (this._hasConfirmedSetup || (me && me.activePokemon)) {
        // 服务器侧记录了activePokemon → 同步到本地
        if (me && me.activePokemon) {
          this._setupPlacedCard = me.activePokemon.card;
        }
        this._renderSetupWaiting();
        return;
      }

      // 优先级2：选牌界面已渲染过 → 只增量更新对手状态，不重建DOM
      if (this._setupRendered) {
        this._updateSetupOpponentStatus();
        return;
      }

      // 优先级3：首次进入设置阶段 → 渲染选牌界面
      this._setupRendered = true;
      this._renderSetup();
      return;
    }

    GameState.isSetup = false;
    BoardRenderer.render(GameState);
    if (payload.turnLog) {
      const newLogs = payload.turnLog.slice(this.lastLogCount);
      this.lastLogCount = payload.turnLog.length;
      AnimationManager.enqueue(newLogs);
    }
    this._updateActions();
    this._updateLog(payload.turnLog);
    this._clearSelection();
  },

  // 更新设置阶段的对手状态（只更新指示器文字，不重新渲染DOM）
  _updateSetupOpponentStatus() {
    const opponent = GameState.opponent;
    if (!opponent) return;
    const oppoPlaced = opponent.activePokemon !== null;
    const statusEl = document.getElementById('opponent-setup-status');
    if (statusEl) {
      statusEl.textContent = oppoPlaced ? '✅ 对手已放置出战宝可梦' : '⏳ 等待对手选择...';
    }
  },

  // ============================================================
  // 设置阶段：选牌界面
  // ============================================================
  _renderSetup() {
    const board = document.getElementById('board');
    const me = GameState.me;
    const opponent = GameState.opponent;
    const oppoPlaced = opponent && opponent.activePokemon !== null;

    document.getElementById('battle-turn-info').textContent = '设置阶段';

    board.innerHTML = `
      <div class="board-section" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;">
        <div style="text-align:center;">
          <h3 style="margin-bottom:8px;">选择你的初始出战宝可梦</h3>
          <p style="color:var(--text-dim);font-size:0.9rem;">
            ${oppoPlaced ? '✅ 对手已选择，请你也选一只' : '从手牌中选择一只基础宝可梦'}
          </p>
        </div>
        <div id="opponent-setup-status" style="padding:6px 14px;border-radius:8px;background:rgba(255,255,255,0.05);font-size:0.85rem;">
          ${oppoPlaced ? '✅ 对手已放置出战宝可梦' : '⏳ 等待对手选择...'}
        </div>
        <div id="setup-hand" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;min-height:140px;">
        </div>
        <button id="btn-confirm-setup" class="btn btn-primary" disabled>确认出战</button>
      </div>
    `;

    this.selectedCard = null;
    this.selectedCardEl = null;

    if (me && me.hand) {
      const setupHand = document.getElementById('setup-hand');
      me.hand.forEach(card => {
        if (card.type === 'pokemon' && card.subtype === 'basic') {
          const el = CardRenderer.render(card, {
            interactive: true,
            onClick: (c, element) => {
              document.querySelectorAll('#setup-hand .card').forEach(crd => crd.classList.remove('selected'));
              element.classList.add('selected');
              this.selectedCard = c;
              this.selectedCardEl = element;
              const btn = document.getElementById('btn-confirm-setup');
              if (btn) btn.disabled = false;
            }
          });
          setupHand.appendChild(el);
        }
      });
    }

    const confirmBtn = document.getElementById('btn-confirm-setup');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        if (!this.selectedCard) return;
        this._setupPlacedCard = this.selectedCard;      // 乐观记录
        this._hasConfirmedSetup = true;                  // 不可逆标志
        WS.send('game_action', {
          action: 'setup_active',
          cardId: this.selectedCard.id,
          zone: 'active'
        });
        // 立即切换到等待界面
        this._renderSetupWaiting();
      };
    }
  },

  // ============================================================
  // 设置阶段：等待对手界面（己方已放置）
  // ============================================================
  _renderSetupWaiting() {
    const board = document.getElementById('board');
    const opponent = GameState.opponent;
    const oppoPlaced = opponent && opponent.activePokemon !== null;
    const placedCard = GameState.me?.activePokemon?.card || this._setupPlacedCard;

    document.getElementById('battle-turn-info').textContent = '设置阶段';

    // 如果已经在显示等待界面，只增量更新文字和卡牌（避免重建DOM）
    const existingCard = document.getElementById('setup-confirmed-pokemon');
    if (existingCard) {
      // 更新对手状态文字
      const statusEl = document.getElementById('opponent-setup-status');
      if (statusEl) {
        statusEl.textContent = oppoPlaced ? '✅ 对手已放置出战宝可梦' : '⏳ 等待对手选择...';
      }
      // 更新提示文字
      const hintEl = board.querySelector('.board-section p');
      if (hintEl) {
        hintEl.style.color = 'var(--text-dim)';
        hintEl.textContent = oppoPlaced ? '双方已就绪，即将开始对战...' : '等待对手选择...';
      }
      // 如果卡牌容器为空（首次乐观渲染时可能还没渲染卡），补渲染
      if (existingCard.children.length === 0 && placedCard) {
        const el = CardRenderer.render(placedCard, { size: 'large' });
        existingCard.appendChild(el);
      }
      return;
    }

    // 首次渲染：重建DOM
    board.innerHTML = `
      <div class="board-section" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;">
        <div style="text-align:center;">
          <h3 style="margin-bottom:8px;">✅ 已放置出战宝可梦</h3>
          <p style="color:var(--text-dim);">${oppoPlaced ? '双方已就绪，即将开始对战...' : '等待对手选择...'}</p>
        </div>
        <div id="setup-confirmed-pokemon" style="display:flex;justify-content:center;"></div>
        <div id="opponent-setup-status" style="padding:8px 16px;border-radius:8px;background:rgba(255,255,255,0.05);font-size:0.9rem;">
          ${oppoPlaced ? '✅ 对手已放置出战宝可梦' : '⏳ 等待对手选择...'}
        </div>
      </div>
    `;

    if (placedCard) {
      const container = document.getElementById('setup-confirmed-pokemon');
      if (container) {
        const el = CardRenderer.render(placedCard, { size: 'large' });
        container.appendChild(el);
      }
    }
  },

  // ============================================================
  // 操作绑定
  // ============================================================
  _bindEvents() {
    // 结束回合
    document.getElementById('btn-end-turn').addEventListener('click', () => {
      WS.send('game_action', { action: 'end_turn', payload: {} });
    });

    // 投降
    document.getElementById('btn-forfeit').addEventListener('click', () => {
      if (confirm('确定要投降吗？')) {
        WS.send('forfeit', {});
      }
    });

    // 卡牌点击事件
    document.addEventListener('card-click', (e) => {
      this._handleCardClick(e.detail.card, e.detail.element);
    });

    // 取消攻击
    document.getElementById('btn-cancel-attack').addEventListener('click', () => {
      document.getElementById('attack-modal').classList.add('hidden');
      this.pendingAction = null;
    });

    // 取消后备选择
    document.getElementById('btn-cancel-bench').addEventListener('click', () => {
      document.getElementById('bench-select-modal').classList.add('hidden');
      this.pendingAction = null;
    });

    // 返回大厅
    document.getElementById('btn-back-lobby').addEventListener('click', () => {
      GameState.reset();
      document.getElementById('gameover-modal').classList.add('hidden');
      LobbyScreen.show();
    });
  },

  _handleCardClick(card, element) {
    if (!GameState.isMyTurn || GameState.phase !== 'player_turn') return;
    if (GameState.isSetup) return;

    const allowed = GameState.allowedActions;

    if (!card || !element) return;

    // 选中/取消选中
    if (this.selectedCardEl === element) {
      this._clearSelection();
      return;
    }
    this._clearSelection();
    element.classList.add('selected');
    this.selectedCard = card;
    this.selectedCardEl = element;

    // 根据卡牌类型显示可用操作
    if (card.type === 'pokemon' && allowed.includes('play_pokemon')) {
      // 手牌中的宝可梦
      this._showPokemonOptions(card);
    } else if (card.type === 'energy' && allowed.includes('attach_energy')) {
      this._showEnergyOptions(card);
    } else if (card.type === 'trainer' && allowed.includes('use_trainer')) {
      this._useTrainer(card);
    } else if (card.type === 'pokemon' && allowed.includes('evolve') && card.subtype !== 'basic') {
      this._showEvolveOptions(card);
    }
  },

  _showPokemonOptions(card) {
    // 检查是否在 hand 中
    const inHand = GameState.me && GameState.me.hand && GameState.me.hand.some(c => c.id === card.id);
    if (!inHand) return;

    if (!GameState.me.activePokemon) {
      // 没有出战宝可梦 → 自动放到出战区
      WS.send('game_action', { action: 'play_pokemon', payload: { cardId: card.id, zone: 'active' } });
      this._clearSelection();
    } else {
      // 放到后备区
      const emptyBench = GameState.me.bench.filter(b => b === null).length;
      if (emptyBench > 0) {
        this._showBenchSelect('选择放置到哪个后备位', (idx) => {
          WS.send('game_action', { action: 'play_pokemon', payload: { cardId: card.id, zone: 'bench', benchIndex: idx } });
          this._clearSelection();
        });
      }
    }
  },

  _showEnergyOptions(card) {
    const inHand = GameState.me && GameState.me.hand && GameState.me.hand.some(c => c.id === card.id);
    if (!inHand) return;

    const options = [];
    if (GameState.me.activePokemon) {
      options.push({ label: '出战宝可梦', value: 'active' });
    }
    GameState.me.bench.forEach((slot, i) => {
      if (slot) options.push({ label: `后备${i+1}`, value: `bench_${i}` });
    });

    if (options.length === 1) {
      WS.send('game_action', { action: 'attach_energy', payload: { cardId: card.id, target: options[0].value } });
      this._clearSelection();
    } else {
      this._showBenchSelect('附着到哪个宝可梦？', (idx) => {
        const target = idx === -1 ? 'active' : `bench_${idx}`;
        WS.send('game_action', { action: 'attach_energy', payload: { cardId: card.id, target } });
        this._clearSelection();
      }, true);
    }
  },

  _showEvolveOptions(card) {
    const inHand = GameState.me && GameState.me.hand && GameState.me.hand.some(c => c.id === card.id);
    if (!inHand) return;

    // 找可以进化的目标
    const targets = [];
    if (GameState.me.activePokemon && GameState.me.activePokemon.card.id === card.evolvesFrom) {
      targets.push({ label: `出战 ${GameState.me.activePokemon.card.name}`, value: 'active' });
    }
    GameState.me.bench.forEach((slot, i) => {
      if (slot && slot.card.id === card.evolvesFrom) {
        targets.push({ label: `后备${i+1} ${slot.card.name}`, value: `bench_${i}` });
      }
    });

    if (targets.length === 1) {
      WS.send('game_action', { action: 'evolve', payload: { cardId: card.id, target: targets[0].value } });
      this._clearSelection();
    } else if (targets.length > 1) {
      this._showCustomSelect('进化哪个宝可梦？', targets, (val) => {
        WS.send('game_action', { action: 'evolve', payload: { cardId: card.id, target: val } });
        this._clearSelection();
      });
    }
  },

  _useTrainer(card) {
    WS.send('game_action', { action: 'use_trainer', payload: { cardId: card.id } });
    this._clearSelection();
  },

  // ============================================================
  // 攻击操作
  // ============================================================
  showAttackOptions() {
    if (!GameState.me || !GameState.me.activePokemon) return;
    if (!GameState.allowedActions.includes('use_attack')) return;

    const pokemon = GameState.me.activePokemon;
    const attacks = pokemon.card.attacks;
    const energy = pokemon.attachedEnergy || [];

    const modal = document.getElementById('attack-modal');
    const list = document.getElementById('attack-list');
    list.innerHTML = '';

    attacks.forEach((attack, idx) => {
      const canPay = this._canPayCost(energy, attack.cost);
      const item = document.createElement('div');
      item.className = 'attack-item' + (canPay ? '' : ' disabled');
      item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div class="attack-name">${attack.name}</div>
            <div class="attack-cost" style="display:flex;gap:2px;margin-top:2px;">
              ${attack.cost.map(c => `<span class="energy" style="background:${CardRenderer.energyColors[c] || '#666'}"></span>`).join('')}
            </div>
          </div>
          <div class="attack-dmg">${attack.damage || '—'}</div>
        </div>
        ${!canPay ? '<div style="font-size:0.7rem;color:var(--danger);margin-top:4px;">⚠ 能量不足</div>' : ''}
      `;
      if (canPay) {
        item.addEventListener('click', () => {
          WS.send('game_action', { action: 'use_attack', payload: { attackIndex: idx } });
          modal.classList.add('hidden');
        });
      }
      list.appendChild(item);
    });

    modal.classList.remove('hidden');
  },

  _canPayCost(energy, cost) {
    const available = [...energy];
    for (const required of cost) {
      if (required === 'colorless') {
        if (available.length === 0) return false;
        available.pop();
      } else {
        const idx = available.indexOf(required);
        if (idx === -1) return false;
        available.splice(idx, 1);
      }
    }
    return true;
  },

  // ============================================================
  // 撤退操作
  // ============================================================
  doRetreat() {
    if (!GameState.allowedActions.includes('retreat')) return;
    WS.send('game_action', { action: 'retreat', payload: {} });
    this._clearSelection();
  },

  // ============================================================
  // 界面辅助
  // ============================================================
  _updateActions() {
    const allowed = GameState.allowedActions;

    // 攻击按钮
    if (allowed.includes('use_attack') && GameState.me && GameState.me.activePokemon) {
      // 手牌上方显示攻击按钮
      const actionBar = document.getElementById('battle-actions');
      if (!document.getElementById('btn-attack')) {
        const btn = document.createElement('button');
        btn.id = 'btn-attack';
        btn.className = 'btn btn-action';
        btn.textContent = '⚔ 攻击';
        btn.addEventListener('click', () => this.showAttackOptions());
        actionBar.insertBefore(btn, document.getElementById('btn-end-turn'));
      }
      document.getElementById('btn-attack').style.display = 'inline-block';
    } else {
      const btn = document.getElementById('btn-attack');
      if (btn) btn.style.display = 'none';
    }

    // 撤退按钮
    if (allowed.includes('retreat') && GameState.me && GameState.me.activePokemon) {
      const actionBar = document.getElementById('battle-actions');
      if (!document.getElementById('btn-retreat')) {
        const btn = document.createElement('button');
        btn.id = 'btn-retreat';
        btn.className = 'btn btn-action';
        btn.textContent = '🔙 撤退';
        btn.addEventListener('click', () => this.doRetreat());
        actionBar.insertBefore(btn, document.getElementById('btn-end-turn'));
      }
      document.getElementById('btn-retreat').style.display = 'inline-block';
    } else {
      const btn = document.getElementById('btn-retreat');
      if (btn) btn.style.display = 'none';
    }
  },

  _updateLog(turnLog) {
    const logEl = document.getElementById('battle-log');
    if (!turnLog || turnLog.length === 0) return;

    logEl.innerHTML = '';
    // 显示最近10条
    const entries = turnLog.slice(-10);
    entries.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.textContent = this._formatLog(entry);
      logEl.appendChild(div);
    });
    logEl.scrollTop = logEl.scrollHeight;
  },

  _formatLog(entry) {
    switch (entry.type) {
      case 'draw': return '抽了一张牌';
      case 'play_pokemon': return `打出了 ${entry.cardId || '宝可梦'}`;
      case 'attack': return `⚔ 使用 ${entry.attackName || '招式'} 造成 ${entry.damage || 0} 伤害`;
      case 'knockout': return `💥 击倒了 ${entry.pokemonName || '对手宝可梦'}！`;
      case 'evolve': return `✨ 进化！`;
      case 'retreat': return `🔙 撤退`;
      case 'end_turn': return `⏭ 结束回合`;
      case 'game_start': return `🎮 游戏开始！`;
      case 'use_trainer': return `📋 使用了训练家卡`;
      case 'trainer_heal': return `💚 回复了 ${entry.healAmount || 0} HP`;
      case 'trainer_draw': return `📚 弃牌重抽了 ${entry.drawnCount || 0} 张`;
      case 'attach_energy': return `⚡ 附着能量`;
      case 'forfeit': return `🏳 投降`;
      case 'game_over': return `🏆 游戏结束`;
      default: return entry.type || '未知事件';
    }
  },

  _showBenchSelect(title, callback, includeActive = false) {
    const modal = document.getElementById('bench-select-modal');
    document.getElementById('bench-select-title').textContent = title;
    const list = document.getElementById('bench-select-list');
    list.innerHTML = '';

    if (includeActive && GameState.me && GameState.me.activePokemon) {
      const opt = document.createElement('div');
      opt.className = 'bench-option';
      opt.textContent = `出战: ${GameState.me.activePokemon.card.name}`;
      opt.addEventListener('click', () => { callback(-1); modal.classList.add('hidden'); });
      list.appendChild(opt);
    }

    if (GameState.me && GameState.me.bench) {
      GameState.me.bench.forEach((slot, i) => {
        const opt = document.createElement('div');
        opt.className = 'bench-option';
        opt.textContent = slot ? `后备${i+1}: ${slot.card.name}` : `后备${i+1}: 空`;
        if (!slot) {
          opt.style.opacity = '0.4';
          opt.style.cursor = 'default';
        } else {
          opt.addEventListener('click', () => { callback(i); modal.classList.add('hidden'); });
        }
        list.appendChild(opt);
      });
    }

    modal.classList.remove('hidden');
  },

  _showCustomSelect(title, options, callback) {
    const modal = document.getElementById('bench-select-modal');
    document.getElementById('bench-select-title').textContent = title;
    const list = document.getElementById('bench-select-list');
    list.innerHTML = '';

    options.forEach(opt => {
      const el = document.createElement('div');
      el.className = 'bench-option';
      el.textContent = opt.label;
      el.addEventListener('click', () => { callback(opt.value); modal.classList.add('hidden'); });
      list.appendChild(el);
    });

    modal.classList.remove('hidden');
  },

  _clearSelection() {
    document.querySelectorAll('.card.selected').forEach(el => el.classList.remove('selected'));
    this.selectedCard = null;
    this.selectedCardEl = null;
  },

  showGameOver(payload) {
    const modal = document.getElementById('gameover-modal');
    const title = document.getElementById('gameover-title');
    const content = modal.querySelector('.gameover-content');
    const reason = document.getElementById('gameover-reason');

    if (payload.winner === GameState.playerId) {
      title.textContent = '🎉 你赢了！';
      content.className = 'modal-content gameover-content win';
      reason.textContent = payload.reason || '恭喜！';
    } else {
      title.textContent = '😢 你输了';
      content.className = 'modal-content gameover-content lose';
      reason.textContent = payload.reason || '再接再厉！';
    }

    modal.classList.remove('hidden');
  }
};
