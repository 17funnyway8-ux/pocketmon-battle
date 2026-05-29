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
    this.renderPlayerArea(state.me, state.isMyTurn);
    this.renderOpponentArea(state.opponent, state.opponentId);
    this.renderInfo(state);
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
  }
};
