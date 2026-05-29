// server/game/GameSession.js - 游戏会话主循环
const { GamePhase, TurnPhase, GameAction, CONFIG, CardType } = require('../../shared/constants');
const { GameStateMachine } = require('./GameStateMachine');
const { getValidator } = require('./action-validators/index');
const { calculateDamage } = require('./damage-calculator');
const { cloneCard, cloneCards, getCard, getCards, PREBUILT_DECKS } = require('../data/cards');

class GameSession {
  constructor(room) {
    this.room = room;
    this.machine = new GameStateMachine();
    this.state = null;
    this.turnLog = [];
    this.logSeq = 0;
  }

  // ============================================================
  // 初始化游戏
  // ============================================================
  initGame() {
    const players = this.room.players;
    const playerIds = players.map(p => p.id);

    this.state = {
      sessionId: `session_${Date.now()}`,
      roomCode: this.room.code,
      turnCount: 0,
      currentPlayerId: null,
      phase: GamePhase.SETUP,
      turnPhase: null,
      playerIds,
      players: {},
      turnLog: []
    };

    // 初始化每个玩家的游戏状态
    for (const p of players) {
      // 查牌组定义，获取卡牌ID列表
      const deckDef = PREBUILT_DECKS.find(d => d.id === p.deckId);
      const deckCardIds = deckDef ? deckDef.cards : [];
      const deckCards = cloneCards(getCards(deckCardIds));
      this.state.players[p.id] = {
        playerId: p.id,
        playerName: p.name,
        deck: this._shuffle(deckCards),
        hand: [],
        discardPile: [],
        prizeCards: [],
        activePokemon: null,
        bench: [null, null, null],
        energyAttachedThisTurn: false,
        evolvedThisTurn: false,
        attackedThisTurn: false
      };
    }

    // 设置阶段
    this._setupPhase();
    this.state.phase = GamePhase.SETUP;
  }

  // 设置阶段：发牌、Prize、初始放置
  _setupPhase() {
    for (const id of this.state.playerIds) {
      const p = this.state.players[id];

      // 1. 放 Prize 卡（3张）
      p.prizeCards = p.deck.splice(0, CONFIG.PRIZE_COUNT);

      // 2. 发初始手牌（7张）
      p.hand = p.deck.splice(0, CONFIG.HAND_SIZE);

      // 3. Mulligan 检查：手牌中必须有基础宝可梦
      let mulliganCount = 0;
      while (!p.hand.some(c => c.type === CardType.POKEMON && c.subtype === 'basic')) {
        p.deck.push(...p.hand);
        p.hand = [];
        p.deck = this._shuffle(p.deck);
        p.hand = p.deck.splice(0, CONFIG.HAND_SIZE);
        mulliganCount++;
      }

      // Mulligan 补偿：对手可以多抽1张
      if (mulliganCount > 0) {
        const opponent = this._getOpponent(id);
        if (opponent && opponent.deck.length > 0) {
          opponent.hand.push(opponent.deck.pop());
          this._addLog('mulligan_compensation', { playerId: id, opponentId: opponent.playerId });
        }
      }
    }

    // 先手后手决定（创建者先手）
    this.machine.currentPlayerIndex = 0;
    this.state.currentPlayerId = this.state.playerIds[0];
    this.machine.phase = GamePhase.SETUP;
  }

  // 确认初始布局
  confirmSetup(playerId, payload) {
    const player = this.state.players[playerId];
    if (!player || !payload.cardId) return { error: '缺少卡牌ID' };

    const card = player.hand.find(c => c.id === payload.cardId);
    if (!card || card.type !== CardType.POKEMON || card.subtype !== 'basic') {
      return { error: '请选择一只基础宝可梦作为出战' };
    }

    // 从手牌移除放到出战区
    player.hand = player.hand.filter(c => c.id !== payload.cardId);
    player.activePokemon = {
      card: cloneCard(card),
      attachedEnergy: [],
      damageCounters: 0,
      justPlayed: true
    };

    this._addLog('setup_active', { playerId, cardId: payload.cardId });

    // 检查双方是否都放好了
    const allConfirmed = this.state.playerIds
      .map(id => this.state.players[id])
      .every(p => p.activePokemon !== null);

    if (allConfirmed) {
      // 游戏正式开始，先手方进入抽牌阶段
      this.machine.phase = GamePhase.PLAYER_TURN;
      this.machine.turnPhase = TurnPhase.DRAW;
      this.machine.turnCount = 1;
      this.state.turnCount = 1;
      this.state.currentPlayerId = this.state.playerIds[0];
      this.state.phase = GamePhase.PLAYER_TURN;
      this.state.turnPhase = TurnPhase.DRAW;

      // 先手第一回合自动抽牌进入主阶段
      this._autoDraw(this.state.playerIds[0]);
      this.machine.startDraw();
      this.state.turnPhase = TurnPhase.MAIN;

      this._addLog('game_start', { firstPlayer: this.state.playerIds[0] });
      return { ready: true };
    }

    return { ready: false };
  }

  // ============================================================
  // 游戏动作处理
  // ============================================================
  handleAction(playerId, action, payload) {
    try {
      const player = this.state.players[playerId];
      if (!player) return { error: '玩家不存在' };

      // 检查是否该玩家的回合
      if (this.state.currentPlayerId !== playerId) {
        return { error: '不是你的回合' };
      }

      if (this.state.phase !== GamePhase.PLAYER_TURN) {
        return { error: '当前不是操作阶段' };
      }

      // 攻击动作：从 MAIN 自动转入 ATTACK 阶段
      // （否则 enterAttack() 从未被调用 → 攻击永不可用）
      if (action === 'use_attack' && this.state.turnPhase === TurnPhase.MAIN) {
        this.machine.enterAttack();
        this.state.turnPhase = TurnPhase.ATTACK;
      }

      // 获取并执行验证器
      const validator = getValidator(action);
      if (!validator) return { error: `未知动作: ${action}` };

      const validation = validator(this.state, playerId, payload);
      if (!validation.valid) return { error: validation.reason };

      // 执行动作
      return this._executeAction(playerId, action, payload, validation);
    } catch (err) {
      console.error(`  动作执行崩溃: ${action}`, err);
      return { error: '服务器内部错误: ' + err.message };
    }
  }

  _executeAction(playerId, action, payload, validation) {
    try {
      const player = this.state.players[playerId];
      if (!player) return { error: '玩家状态异常' };

      switch (action) {
      case 'play_pokemon': {
        const card = player.hand.find(c => c.id === payload.cardId);
        player.hand = player.hand.filter(c => c.id !== payload.cardId);

        if (validation.autoActive) {
          // 放到出战区（首个宝可梦）
          player.activePokemon = {
            card: cloneCard(card),
            attachedEnergy: [],
            damageCounters: 0,
            justPlayed: true
          };
          this._addLog('play_pokemon', { playerId, cardId: card.id, zone: 'active' });
        } else {
          // 放到后备区
          const idx = player.bench.findIndex(b => b === null);
          if (idx !== -1) {
            player.bench[idx] = {
              card: cloneCard(card),
              attachedEnergy: [],
              damageCounters: 0,
              justPlayed: true
            };
            this._addLog('play_pokemon', { playerId, cardId: card.id, zone: 'bench', index: idx });
          }
        }
        break;
      }

      case 'attach_energy': {
        const card = player.hand.find(c => c.id === payload.cardId);
        player.hand = player.hand.filter(c => c.id !== payload.cardId);
        player.energyAttachedThisTurn = true;

        let target;
        if (payload.target === 'active') {
          target = player.activePokemon;
        } else if (payload.target && payload.target.startsWith('bench_')) {
          const idx = parseInt(payload.target.split('_')[1]);
          target = player.bench[idx];
        }

        if (target) {
          target.attachedEnergy.push(card.element);
          this._addLog('attach_energy', { playerId, cardId: card.id, target: payload.target, element: card.element });
        }
        break;
      }

      case 'use_trainer': {
        const card = player.hand.find(c => c.id === payload.cardId);
        player.hand = player.hand.filter(c => c.id !== payload.cardId);

        switch (card.effect) {
          case 'heal': {
            const healTarget = player.activePokemon;
            const healAmount = Math.min(card.value, healTarget.damageCounters);
            healTarget.damageCounters -= healAmount;
            this._addLog('trainer_heal', { playerId, healAmount, targetHp: healTarget.card.hp - healTarget.damageCounters });
            break;
          }
          case 'draw': {
            // 博士的研究：弃手牌，抽7张
            player.discardPile.push(...player.hand);
            const drawCount = Math.min(card.value, player.deck.length);
            player.hand = player.deck.splice(0, drawCount);
            this._addLog('trainer_draw', { playerId, discardedCount: card.value - drawCount, drawnCount: drawCount });
            break;
          }
          case 'search': {
            // 精灵球：从牌组抽1只基础宝可梦
            const idx = player.deck.findIndex(c => c.type === CardType.POKEMON && c.subtype === 'basic');
            if (idx !== -1) {
              const found = player.deck.splice(idx, 1)[0];
              player.hand.push(found);
            }
            this._addLog('trainer_search', { playerId });
            break;
          }
          case 'energy_accel': {
            // 能量转移：从后备区移1能量到出战
            for (let i = 0; i < player.bench.length; i++) {
              const benchMon = player.bench[i];
              if (benchMon && benchMon.attachedEnergy.length > 0) {
                const moved = benchMon.attachedEnergy.pop();
                player.activePokemon.attachedEnergy.push(moved);
                this._addLog('trainer_energy_accel', { playerId, fromBench: i, element: moved });
                break;
              }
            }
            break;
          }
        }

        player.discardPile.push(card);
        this._addLog('use_trainer', { playerId, cardId: card.id, effect: card.effect });
        break;
      }

      case 'evolve': {
        const card = player.hand.find(c => c.id === payload.cardId);
        player.hand = player.hand.filter(c => c.id !== payload.cardId);
        player.evolvedThisTurn = true;

        const target = validation.targetPokemon;
        target.card = cloneCard(card);
        target.justPlayed = false;

        this._addLog('evolve', { playerId, cardId: card.id, target: payload.target || 'active' });
        break;
      }

      case 'retreat': {
        const cost = validation.retreatCost;
        // 消耗能量
        for (let i = 0; i < cost; i++) {
          player.activePokemon.attachedEnergy.pop();
        }

        // 找后备区第一个
        const benchIdx = player.bench.findIndex(b => b !== null);
        const replacement = player.bench[benchIdx];
        player.bench[benchIdx] = player.activePokemon;
        player.activePokemon = replacement;

        this._addLog('retreat', { playerId, fromBench: benchIdx });
        break;
      }

      case 'use_attack': {
        const opponent = this._getOpponent(playerId);
        const attacker = player.activePokemon;
        const defender = opponent.activePokemon;

        if (!defender) return { error: '对手没有出战宝可梦' };

        const dmgResult = calculateDamage(attacker.card, defender.card, payload.attackIndex);
        defender.damageCounters += dmgResult.finalDamage;
        player.attackedThisTurn = true;

        this._addLog('attack', {
          playerId, opponentId: opponent.playerId,
          attackName: validation.attack.name,
          damage: dmgResult.finalDamage,
          baseDamage: dmgResult.baseDamage,
          multiplier: dmgResult.multiplier,
          finalDamage: dmgResult.finalDamage,
          weaknessHit: dmgResult.weaknessMultiplier > 1
        });

        // 击倒检测
        if (defender.damageCounters >= defender.card.hp) {
          return this._handleKnockout(playerId, opponent);
        }

        break;
      }

      case 'end_turn': {
        const result = this.machine.endTurn();
        if (result === 'turn_switch') {
          this.state.currentPlayerId = this.state.playerIds[this.machine.currentPlayerIndex];
          this.state.phase = GamePhase.OPPONENT_TURN;
          this.state.turnPhase = TurnPhase.DRAW;

          // 重置本回合标志
          player.energyAttachedThisTurn = false;
          player.evolvedThisTurn = false;
          player.attackedThisTurn = false;
          player.activePokemon && (player.activePokemon.justPlayed = false);

          this._addLog('end_turn', { playerId, nextPlayer: this.state.currentPlayerId });

          // 自动切换：通知对手他的回合开始
          // 对手回合相当于他的 DRAW 阶段
          setTimeout(() => {
            this._handleOpponentTurn(this.state.currentPlayerId);
          }, 500);
        }
        break;
      }
    }

    // 检查游戏是否结束
    const gameOver = this.machine.isGameOver(this.state);
    if (gameOver) {
      this.state.phase = GamePhase.GAME_OVER;
      this._addLog('game_over', { winner: gameOver.winner, reason: gameOver.reason });
      return { gameOver: true, winner: gameOver.winner, reason: gameOver.reason };
    }

    // 更新状态
    this.state.turnCount = this.machine.turnCount;
    this.state.turnPhase = this.machine.turnPhase;
    this.state.phase = this.machine.phase;

    return { success: true };
    } catch (err) {
      console.error(`  动作执行失败:`, err);
      return { error: '执行异常: ' + err.message };
    }
  }

  _handleKnockout(attackerId, defender) {
    const attacker = this.state.players[attackerId];
    const attackedPokemon = attacker.activePokemon;

    // 击倒方拿1张Prize
    if (attacker.prizeCards.length > 0) {
      const prize = attacker.prizeCards.pop();
      attacker.hand.push(prize);
    }

    this._addLog('knockout', {
      attackerId,
      defenderId: defender.playerId,
      pokemonName: defender.activePokemon.card.name
    });

    // 被击倒的宝可梦去弃牌堆
    const koPokemon = defender.activePokemon;
    koPokemon.attachedEnergy.forEach(e => {
      defender.discardPile.push({ type: 'energy', element: e });
    });
    defender.discardPile.push(cloneCard(koPokemon.card));
    defender.activePokemon = null;

    // 如果后备区有宝可梦，自动换上第一个
    const benchIdx = defender.bench.findIndex(b => b !== null);
    if (benchIdx !== -1) {
      defender.activePokemon = defender.bench[benchIdx];
      defender.bench[benchIdx] = null;
      this._addLog('auto_switch', { playerId: defender.playerId, fromBench: benchIdx });
    }

    // 检查游戏结束
    const gameOver = this.machine.isGameOver(this.state);
    if (gameOver) {
      this.state.phase = GamePhase.GAME_OVER;
      this._addLog('game_over', { winner: gameOver.winner, reason: gameOver.reason });
      return { gameOver: true, winner: gameOver.winner, reason: gameOver.reason };
    }

    return { success: true, knockout: true };
  }

  _handleOpponentTurn(playerId) {
    const player = this.state.players[playerId];

    // 自动抽牌
    if (this.state.phase === GamePhase.OPPONENT_TURN) {
      // 切换到玩家回合
      this.machine.switchToPlayerTurn(this.state.playerIds.indexOf(playerId));
      this.state.phase = GamePhase.PLAYER_TURN;
      this.state.turnPhase = TurnPhase.DRAW;
      this.state.currentPlayerId = playerId;
      this.state.turnCount = this.machine.turnCount;

      // 重置标志
      player.energyAttachedThisTurn = false;
      player.evolvedThisTurn = false;
      player.attackedThisTurn = false;

      // 自动抽牌
      if (player.deck.length === 0) {
        // 牌库空，检查游戏结束
        const gameOver = this.machine.isGameOver(this.state);
        if (gameOver) {
          this.state.phase = GamePhase.GAME_OVER;
          this._addLog('game_over', { winner: gameOver.winner, reason: '对手牌库已空' });
        }
        return;
      }

      const drawn = player.deck.pop();
      player.hand.push(drawn);
      this.machine.startDraw();
      this.state.turnPhase = TurnPhase.MAIN;
      this._addLog('draw', { playerId, cardId: drawn ? drawn.id : 'none' });
    }

    // 广播状态
    this._broadcastState();
  }

  // 自动抽牌
  _autoDraw(playerId) {
    const player = this.state.players[playerId];
    if (player.deck.length === 0) return false;
    const drawn = player.deck.pop();
    if (drawn) {
      player.hand.push(drawn);
      this._addLog('draw', { playerId, cardId: drawn.id });
      return true;
    }
    return false;
  }

  // ============================================================
  // 投降
  // ============================================================
  forfeit(playerId) {
    const opponent = this._getOpponent(playerId);
    if (!opponent) {
      this.state.phase = GamePhase.GAME_OVER;
      this._addLog('forfeit_no_opponent', { playerId });
      return { winner: playerId, reason: '对手已离开，自动获胜' };
    }
    const winner = opponent;
    this.state.phase = GamePhase.GAME_OVER;
    this._addLog('forfeit', { playerId, winnerId: winner.playerId });
    return { winner: winner.playerId, reason: '对方投降了' };
  }

  // ============================================================
  // 获取玩家视角（剔除对手不可见信息）
  // ============================================================
  getViewForPlayer(playerId) {
    const view = {
      sessionId: this.state.sessionId,
      roomCode: this.state.roomCode,
      turnCount: this.state.turnCount,
      currentPlayerId: this.state.currentPlayerId,
      phase: this.state.phase,
      turnPhase: this.state.turnPhase,
      allowedActions: this.machine.getAllowedActions(),
      players: {},
      turnLog: this.state.turnLog,
      yourPlayerId: playerId,
      isYourTurn: this.state.currentPlayerId === playerId
    };

    for (const id of this.state.playerIds) {
      if (id === playerId) {
        // 自己的完整信息（含手牌和牌库大小）
        const me = this.state.players[id];
        view.players[id] = {
          playerName: me.playerName,
          activePokemon: me.activePokemon,
          bench: me.bench,
          hand: me.hand,
          deckSize: me.deck.length,
          discardPile: me.discardPile,
          prizeCards: me.prizeCards,
          energyAttachedThisTurn: me.energyAttachedThisTurn,
          evolvedThisTurn: me.evolvedThisTurn,
          attackedThisTurn: me.attackedThisTurn
        };
      } else {
        // 对手的可见信息（手牌反面向、牌库数量）
        const them = this.state.players[id];
        view.players[id] = {
          playerName: them.playerName,
          activePokemon: them.activePokemon,
          bench: them.bench,
          handSize: them.hand.length,
          deckSize: them.deck.length,
          discardPile: them.discardPile,
          prizeCards: them.prizeCards
        };
      }
    }

    return view;
  }

  // ============================================================
  // 广播
  // ============================================================
  _broadcastState() {
    for (const id of this.state.playerIds) {
      const view = this.getViewForPlayer(id);
      this._sendToPlayer(id, 'game_state', view);
    }
  }

  _sendToPlayer(playerId, type, payload) {
    const player = this.room.getPlayer(playerId);
    if (player && player.ws && player.ws.readyState === 1) {
      try {
        player.ws.send(JSON.stringify({ type, payload }));
      } catch (e) {
        console.error(`  发送消息失败 [${type}] 给 ${playerId}: ${e.message}`);
      }
    }
  }

  _getOpponent(playerId) {
    const idx = this.state.playerIds.indexOf(playerId);
    if (idx === -1) return null;
    const oppId = this.state.playerIds[1 - idx];
    return this.state.players[oppId];
  }

  _addLog(type, data) {
    this.logSeq++;
    const entry = { seq: this.logSeq, type, timestamp: Date.now(), ...data };
    this.state.turnLog.push(entry);
    this.turnLog.push(entry);
    // 限制日志长度
    if (this.state.turnLog.length > 200) {
      this.state.turnLog = this.state.turnLog.slice(-100);
    }
  }

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

module.exports = { GameSession };
