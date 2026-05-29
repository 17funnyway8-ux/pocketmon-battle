// ============================================================
// shared/constants.js - 前后端共享的枚举和常量
// ============================================================

// 属性枚举
const Element = {
  FIRE: 'fire',
  WATER: 'water',
  GRASS: 'grass',
  ELECTRIC: 'electric',
  PSYCHIC: 'psychic',
  FIGHTING: 'fighting',
  COLORLESS: 'colorless'
};

// 属性显示名
const ELEMENT_LABELS = {
  fire: '火',
  water: '水',
  grass: '草',
  electric: '电',
  psychic: '超',
  fighting: '斗',
  colorless: '无'
};

// 属性符号
const ELEMENT_SYMBOLS = {
  fire: '🔥',
  water: '💧',
  grass: '🌿',
  electric: '⚡',
  psychic: '🌀',
  fighting: '💪',
  colorless: '⬜'
};

// 属性克制表 (攻击方 -> 防御方 -> 倍率)
const ELEMENT_CHART = {
  fire:     { grass: 2, fire: 0.5, water: 0.5 },
  water:    { fire: 2, water: 0.5, grass: 0.5, electric: 0.5 },
  grass:    { water: 2, grass: 0.5, fire: 0.5, psychic: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5 },
  psychic:  { fighting: 2, psychic: 0.5 },
  fighting: { electric: 2, fire: 2, fighting: 0.5, psychic: 0.5, grass: 0.5 }
};

// 卡牌类型
const CardType = {
  POKEMON: 'pokemon',
  ENERGY: 'energy',
  TRAINER: 'trainer'
};

// 进化阶段
const EvolutionStage = {
  BASIC: 'basic',
  STAGE_1: 'stage1',
  STAGE_2: 'stage2'
};

// 游戏阶段
const GamePhase = {
  WAITING: 'waiting',
  SETUP: 'setup',
  PLAYER_TURN: 'player_turn',
  OPPONENT_TURN: 'opponent_turn',
  GAME_OVER: 'game_over'
};

// 回合内子阶段
const TurnPhase = {
  DRAW: 'draw',
  MAIN: 'main',
  ATTACK: 'attack',
  END: 'end'
};

// 训练家卡效果
const TrainerEffect = {
  HEAL: 'heal',
  DRAW: 'draw',
  SEARCH: 'search',
  SWITCH: 'switch',
  ENERGY_ACCEL: 'energy_accel'
};

// 游戏动作
const GameAction = {
  PLAY_POKEMON: 'play_pokemon',
  ATTACH_ENERGY: 'attach_energy',
  USE_TRAINER: 'use_trainer',
  EVOLVE: 'evolve',
  RETREAT: 'retreat',
  USE_ATTACK: 'use_attack',
  END_TURN: 'end_turn',
  SELECT_BENCH_ACTIVE: 'select_bench_active'
};

// ============================================================
// 消息类型
// ============================================================

// Client -> Server
const C2S = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  SELECT_DECK: 'select_deck',
  PLAYER_READY: 'player_ready',
  GAME_ACTION: 'game_action',
  FORFEIT: 'forfeit',
  RECONNECT: 'reconnect',
  PING: 'ping'
};

// Server -> Client
const S2C = {
  CONNECTED: 'connected',
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  ROOM_UPDATED: 'room_updated',
  GAME_START: 'game_start',
  GAME_STATE: 'game_state',
  ACTION_DENIED: 'action_denied',
  GAME_OVER: 'game_over',
  OPPONENT_DISCONNECTED: 'opponent_disconnected',
  OPPONENT_RECONNECTED: 'opponent_reconnected',
  ERROR: 'error',
  MULLIGAN_REQUEST: 'mulligan_request'
};

// ============================================================
// 配置常量
// ============================================================

const CONFIG = {
  DECK_SIZE: 30,
  HAND_SIZE: 7,
  PRIZE_COUNT: 3,
  MAX_BENCH: 3,
  MAX_PLAYERS: 2,
  ROOM_CODE_LENGTH: 6,
  HEARTBEAT_INTERVAL: 30000,
  RECONNECT_TIMEOUT: 30000,
  MAX_RECONNECT_ATTEMPTS: 5
};

// ============================================================

module.exports = {
  Element, ELEMENT_LABELS, ELEMENT_SYMBOLS, ELEMENT_CHART,
  CardType, EvolutionStage, GamePhase, TurnPhase, TrainerEffect, GameAction,
  C2S, S2C, CONFIG
};
