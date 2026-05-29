// server/game/GameStateMachine.js - 回合制状态机
const { GamePhase, TurnPhase } = require('../../shared/constants');

class GameStateMachine {
  constructor() {
    this.phase = GamePhase.WAITING;
    this.currentPlayerIndex = 0;
    this.turnPhase = null;
    this.turnCount = 0;
  }

  // 根据当前状态获取允许的动作列表
  getAllowedActions() {
    const ph = this.phase;
    const tp = this.turnPhase;

    if (ph === GamePhase.SETUP) return ['select_bench_active'];
    if (ph === GamePhase.GAME_OVER) return [];

    if (ph === GamePhase.PLAYER_TURN) {
      if (tp === TurnPhase.DRAW) return [];
      if (tp === TurnPhase.MAIN) {
        return [
          'play_pokemon', 'attach_energy', 'use_trainer',
          'evolve', 'retreat', 'end_turn'
        ];
      }
      if (tp === TurnPhase.ATTACK) return ['use_attack'];
      if (tp === TurnPhase.END) return [];
    }

    return [];
  }

  // 起始抽牌
  startDraw() {
    if (this.phase === GamePhase.PLAYER_TURN && this.turnPhase === TurnPhase.DRAW) {
      this.turnPhase = TurnPhase.MAIN;
      return true;
    }
    return false;
  }

  // 进入攻击阶段
  enterAttack() {
    if (this.phase === GamePhase.PLAYER_TURN && this.turnPhase === TurnPhase.MAIN) {
      this.turnPhase = TurnPhase.ATTACK;
      return true;
    }
    return false;
  }

  // 结束回合
  endTurn() {
    if (this.phase === GamePhase.PLAYER_TURN &&
        (this.turnPhase === TurnPhase.MAIN || this.turnPhase === TurnPhase.ATTACK)) {
      this.turnPhase = TurnPhase.END;
      this.phase = GamePhase.OPPONENT_TURN;
      this.currentPlayerIndex = 1 - this.currentPlayerIndex;
      this.turnCount++;
      return 'turn_switch';
    }
    if (this.phase === GamePhase.OPPONENT_TURN) {
      this.phase = GamePhase.PLAYER_TURN;
      this.turnPhase = TurnPhase.DRAW;
      return 'your_turn';
    }
    return false;
  }

  // 切换到对手回合（由服务器在对手行动时主动调用）
  switchToOpponentTurn() {
    this.phase = GamePhase.OPPONENT_TURN;
    this.turnPhase = TurnPhase.DRAW;
  }

  // 切换到玩家回合
  switchToPlayerTurn(playerIndex) {
    this.phase = GamePhase.PLAYER_TURN;
    this.turnPhase = TurnPhase.DRAW;
    this.currentPlayerIndex = playerIndex;
    this.turnCount++;
  }

  // 检测游戏结束
  isGameOver(gameState) {
    const playerIds = gameState.playerIds;
    const p1 = gameState.players[playerIds[0]];
    const p2 = gameState.players[playerIds[1]];

    // 条件1: Prize 卡为空
    if (p1.prizeCards.length === 0) return { winner: playerIds[1], reason: '对手拿完了所有Prize卡' };
    if (p2.prizeCards.length === 0) return { winner: playerIds[0], reason: '对手拿完了所有Prize卡' };

    // 条件2: 出战+后备全无宝可梦
    const hasPokemon = (p) => {
      if (p.activePokemon) return true;
      return p.bench.some(b => b !== null);
    };
    if (!hasPokemon(p1)) return { winner: playerIds[1], reason: '对手的宝可梦全部被击败' };
    if (!hasPokemon(p2)) return { winner: playerIds[0], reason: '对手的宝可梦全部被击败' };

    // 条件3: 抽牌时牌库为空
    return null;
  }
}

module.exports = { GameStateMachine };
