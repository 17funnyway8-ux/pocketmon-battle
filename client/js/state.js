// state.js - 客户端游戏状态
const GameState = {
  playerId: null,
  opponentId: null,
  phase: null,
  turnPhase: null,
  turnCount: 0,
  isMyTurn: false,
  isSetup: false,
  allowedActions: [],
  me: null,
  opponent: null,
  room: null,
  decks: [],
  selectedDeckId: null,
  pendingAnimations: [],

  // 应用服务端推送的完整游戏状态
  applyGameState(payload) {
    this.phase = payload.phase;
    this.turnPhase = payload.turnPhase;
    this.turnCount = payload.turnCount || 0;
    this.isMyTurn = payload.isYourTurn || false;
    this.allowedActions = payload.allowedActions || [];
    this.playerId = payload.yourPlayerId;

    if (payload.players) {
      const ids = Object.keys(payload.players);
      this.me = payload.players[this.playerId] || null;
      this.opponentId = ids.find(id => id !== this.playerId) || null;
      this.opponent = this.opponentId ? payload.players[this.opponentId] : null;
    }
  },

  // 重置
  reset() {
    this.playerId = null;
    this.opponentId = null;
    this.phase = null;
    this.turnPhase = null;
    this.turnCount = 0;
    this.isMyTurn = false;
    this.isSetup = false;
    this.allowedActions = [];
    this.me = null;
    this.opponent = null;
    this.pendingAnimations = [];
  }
};
