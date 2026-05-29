// BoardRenderer.js - 棋盘渲染
const BoardRenderer = {
  playerHandEl: null,
  playerActiveEl: null,
  playerBenchEl: null,
  opponentHandEl: null,
  opponentActiveEl: null,
  opponentBenchEl: null,

  init() {
    this.playerHandEl = document.getElementById('player-hand');
    this.playerActiveEl = document.getElementById('player-active');
    this.playerBenchEl = document.getElementById('player-bench');
    this.opponentHandEl = document.getElementById('opponent-hand');
    this.opponentActiveEl = document.getElementById('opponent-active');
    this.opponentBenchEl = document.getElementById('opponent-bench');
  },

  render(state) {
    // 清除旧拖放目标区域
    DragDropManager.clearZones();

    this.renderPlayerArea(state.me, state.isMyTurn);
    this.renderOpponentArea(state.opponent, state.opponentId);
    this.renderInfo(state);

    // 注册新的拖放目标区域
    this._registerDropZones(state.me, state.isMyTurn);
  },

  renderPlayerArea(me, isMyTurn) {
    if (!me) return;

    // 信息区
    document.getElementById('player-name').textContent = me.playerName || '我';
    document.getElementById('player-deck-size').textContent = `牌库: ${me.deckSize || 0}`;
    document.getElementById('player-prize').textContent = `Prize: ${(me.prizeCards || []).length}`;

    // 手牌
    this.playerHandEl.innerHTML = '<div class="zone-label">手牌</div>';
    if (me.hand) {
      me.hand.forEach(card => {
        const el = CardRenderer.render(card, {
          size: 'small',
          interactive: true,
          draggable: isMyTurn,   // ★ 己方回合可拖放
          onClick: (c, element) => this._onCardClick(c, element)
        });
        this.playerHandEl.appendChild(el);
      });
    }

    // 出战
    this.playerActiveEl.innerHTML = '';
    if (me.activePokemon) {
      const el = this._renderPokemonSlot(me.activePokemon, 'large', true);
      el.id = 'my-active-pokemon';
      this.playerActiveEl.appendChild(el);
    } else {
      this.playerActiveEl.innerHTML = '<div class="zone-label">出战</div><div class="slot-empty">空</div>';
    }

    // 后备
    this.playerBenchEl.innerHTML = '<div class="zone-label">后备</div>';
    if (me.bench) {
      me.bench.forEach((slot, i) => {
        if (slot) {
          const el = this._renderPokemonSlot(slot, 'small', true);
          el.dataset.benchIndex = i;
          this.playerBenchEl.appendChild(el);
        } else {
          const empty = document.createElement('div');
          empty.className = 'slot-empty';
          empty.textContent = '空';
          empty.dataset.benchIndex = i;
          this.playerBenchEl.appendChild(empty);
        }
      });
    }
  },

  renderOpponentArea(opponent, opponentId) {
    if (!opponent) return;

    document.getElementById('opponent-name').textContent = opponent.playerName || '对手';
    document.getElementById('opponent-deck-size').textContent = `牌库: ${opponent.deckSize || 0}`;
    document.getElementById('opponent-prize').textContent = `Prize: ${(opponent.prizeCards || []).length}`;

    // 手牌（背面）
    this.opponentHandEl.innerHTML = '<div class="zone-label">手牌</div>';
    for (let i = 0; i < (opponent.handSize || 0); i++) {
      const el = CardRenderer.render(null, { faceDown: true, size: 'small' });
      this.opponentHandEl.appendChild(el);
    }

    // 出战
    this.opponentActiveEl.innerHTML = '';
    if (opponent.activePokemon) {
      const el = this._renderPokemonSlot(opponent.activePokemon, 'large', false);
      el.id = 'opponent-active-pokemon';
      this.opponentActiveEl.appendChild(el);
    }

    // 后备
    this.opponentBenchEl.innerHTML = '<div class="zone-label">后备</div>';
    if (opponent.bench) {
      opponent.bench.forEach((slot) => {
        if (slot) {
          const el = this._renderPokemonSlot(slot, 'small', false);
          this.opponentBenchEl.appendChild(el);
        } else {
          const empty = document.createElement('div');
          empty.className = 'slot-empty';
          empty.textContent = '空';
          this.opponentBenchEl.appendChild(empty);
        }
      });
    }
  },

  renderInfo(state) {
    const turnEl = document.getElementById('battle-turn-info');
    const phaseEl = document.getElementById('battle-phase-info');
    const endBtn = document.getElementById('btn-end-turn');

    turnEl.textContent = `第 ${state.turnCount || 1} 回合`;

    if (state.phase === 'setup') {
      phaseEl.textContent = '设置阶段 - 选择出战宝可梦';
    } else if (state.isMyTurn) {
      const phaseLabel = {
        draw: '抽牌阶段',
        main: '主要阶段',
        attack: '攻击阶段',
        end: '回合结束'
      };
      phaseEl.textContent = phaseLabel[state.turnPhase] || '你的回合';
      endBtn.disabled = !state.allowedActions.includes('end_turn');
    } else {
      phaseEl.textContent = '对手回合';
      endBtn.disabled = true;
    }

    // 能量附着状态
    const energyEl = document.getElementById('energy-indicator');
    if (state.me) {
      energyEl.textContent = state.me.energyAttachedThisTurn ? '✅ 已附能' : '⬜ 可附能';
    }
  },

  _renderPokemonSlot(slot, size, interactive) {
    const container = document.createElement('div');
    container.className = 'pokemon-slot';

    const cardEl = CardRenderer.render(slot.card, { size });
    CardRenderer.updateDamage(cardEl, slot.damageCounters || 0, slot.card.hp);

    // 附着能量
    if (slot.attachedEnergy && slot.attachedEnergy.length > 0) {
      const energyBar = document.createElement('div');
      energyBar.className = 'attached-energy';
      slot.attachedEnergy.forEach(e => {
        const dot = document.createElement('span');
        dot.className = 'energy';
        dot.style.background = CardRenderer.energyColors[e] || '#666';
        energyBar.appendChild(dot);
      });
      cardEl.appendChild(energyBar);
    }

    // 进化标记
    if (slot.card.subtype && slot.card.subtype !== 'basic') {
      const badge = document.createElement('div');
      badge.className = 'evo-badge';
      badge.textContent = slot.card.subtype === 'stage1' ? '1阶' : '2阶';
      badge.style.cssText = 'position:absolute;top:2px;right:2px;font-size:0.5rem;background:rgba(0,0,0,0.5);padding:1px 4px;border-radius:4px;';
      cardEl.appendChild(badge);
    }

    container.appendChild(cardEl);
    return container;
  },

  _onCardClick(card, element) {
    // 交由 BattleScreen 处理
    const event = new CustomEvent('card-click', { detail: { card, element } });
    document.dispatchEvent(event);
  },

  // ============================================================
  // 注册拖放目标区域
  // ============================================================
  _registerDropZones(me, isMyTurn) {
    if (!me || !isMyTurn) return;

    const allowed = DragDropManager._validActions || [];

    // 出战区（空位 → 放置基础宝可梦）
    if (allowed.includes('play_pokemon') && (!me.activePokemon || me.activePokemon.card.type === 'pokemon')) {
      DragDropManager.registerZone('active', this.playerActiveEl, { action: 'play_pokemon_auto' });
    }

    // 后备区空位
    if (allowed.includes('play_pokemon') && me.bench) {
      me.bench.forEach((slot, i) => {
        if (!slot) {
          const emptyEl = this.playerBenchEl.querySelector(`[data-bench-index="${i}"]`) ||
                          this.playerBenchEl.children[i + 1];
          if (emptyEl) {
            DragDropManager.registerZone('bench', emptyEl, { action: 'play_pokemon', benchIndex: i });
          }
        }
      });
    }

    // 场上宝可梦 → 附着能量目标
    if (allowed.includes('attach_energy')) {
      // 出战宝可梦
      if (me.activePokemon) {
        const activeEl = this.playerActiveEl.querySelector('.pokemon-slot') || this.playerActiveEl;
        DragDropManager.registerZone('pokemon_energy', activeEl, { target: 'active' });
      }
      // 后备宝可梦
      me.bench && me.bench.forEach((slot, i) => {
        if (slot) {
          const el = this.playerBenchEl.querySelector(`.pokemon-slot:nth-child(${i + 2})`) ||
                     this.playerBenchEl.children[i + 1];
          if (el) {
            DragDropManager.registerZone('pokemon_energy', el, { target: 'bench', benchIndex: i });
          }
        }
      });
    }

    // 进化目标
    if (allowed.includes('evolve')) {
      if (me.activePokemon) {
        const activeEl = this.playerActiveEl.querySelector('.pokemon-slot') || this.playerActiveEl;
        DragDropManager.registerZone('evolve', activeEl, { target: 'active' });
      }
      me.bench && me.bench.forEach((slot, i) => {
        if (slot) {
          const el = this.playerBenchEl.querySelector(`.pokemon-slot:nth-child(${i + 2})`) ||
                     this.playerBenchEl.children[i + 1];
          if (el) {
            DragDropManager.registerZone('evolve', el, { target: 'bench', benchIndex: i });
          }
        }
      });
    }

    // 撤退目标（后备空位）
    if (allowed.includes('retreat') && me.activePokemon) {
      me.bench && me.bench.forEach((slot, i) => {
        if (!slot) {
          const emptyEl = this.playerBenchEl.querySelector(`[data-bench-index="${i}"]`) ||
                          this.playerBenchEl.children[i + 1];
          if (emptyEl) {
            DragDropManager.registerZone('retreat', emptyEl, { benchIndex: i });
          }
        }
      });
    }
  }
};
