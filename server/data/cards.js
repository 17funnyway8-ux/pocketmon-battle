// server/data/cards.js - 所有卡牌数据和预组牌组
// ============================================================
// 规则说明：
// - 能量卡只生产 6 种基础属性
// - 宝可梦招式的 cost 中含 'colorless' 表示"任意属性能量"
// - 支付时：所有附着能量都视为无色能量使用
// ============================================================

const { CardType, EvolutionStage } = require('../../shared/constants');

// ============================================================
// 宝可梦卡数据
// ============================================================
const POKEMON_CARDS = [
  // === 火系进化链 ===
  {
    id: 'charmander', name: '小火龙', type: CardType.POKEMON,
    subtype: EvolutionStage.BASIC, evolvesFrom: null, evolvesTo: ['charmeleon'],
    element: 'fire', hp: 60,
    attacks: [{ name: '抓', damage: 10, cost: ['colorless'], description: '' }],
    retreatCost: 1, weakness: 'water', resistance: null
  },
  {
    id: 'charmeleon', name: '火恐龙', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_1, evolvesFrom: 'charmander', evolvesTo: ['charizard'],
    element: 'fire', hp: 90,
    attacks: [
      { name: '火焰', damage: 30, cost: ['fire', 'colorless'], description: '' },
      { name: '烈焰', damage: 60, cost: ['fire', 'fire', 'colorless'], description: '' }
    ],
    retreatCost: 2, weakness: 'water', resistance: null
  },
  {
    id: 'charizard', name: '喷火龙', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_2, evolvesFrom: 'charmeleon', evolvesTo: null,
    element: 'fire', hp: 150,
    attacks: [
      { name: '烈火', damage: 50, cost: ['fire', 'colorless'], description: '' },
      { name: '爆炸烈焰', damage: 120, cost: ['fire', 'fire', 'fire', 'colorless'], description: '' }
    ],
    retreatCost: 3, weakness: 'water', resistance: null
  },

  // === 水系进化链 ===
  {
    id: 'squirtle', name: '杰尼龟', type: CardType.POKEMON,
    subtype: EvolutionStage.BASIC, evolvesFrom: null, evolvesTo: ['wartortle'],
    element: 'water', hp: 60,
    attacks: [{ name: '撞击', damage: 10, cost: ['colorless'], description: '' }],
    retreatCost: 1, weakness: 'grass', resistance: null
  },
  {
    id: 'wartortle', name: '卡咪龟', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_1, evolvesFrom: 'squirtle', evolvesTo: ['blastoise'],
    element: 'water', hp: 90,
    attacks: [
      { name: '水枪', damage: 30, cost: ['water', 'colorless'], description: '' },
      { name: '泡沫光线', damage: 50, cost: ['water', 'water', 'colorless'], description: '' }
    ],
    retreatCost: 2, weakness: 'grass', resistance: null
  },
  {
    id: 'blastoise', name: '水箭龟', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_2, evolvesFrom: 'wartortle', evolvesTo: null,
    element: 'water', hp: 140,
    attacks: [
      { name: '高压水泵', damage: 60, cost: ['water', 'water', 'colorless'], description: '' },
      { name: '火箭头槌', damage: 100, cost: ['water', 'water', 'water', 'colorless'], description: '' }
    ],
    retreatCost: 3, weakness: 'grass', resistance: null
  },

  // === 草系进化链 ===
  {
    id: 'bulbasaur', name: '妙蛙种子', type: CardType.POKEMON,
    subtype: EvolutionStage.BASIC, evolvesFrom: null, evolvesTo: ['ivysaur'],
    element: 'grass', hp: 60,
    attacks: [{ name: '藤鞭', damage: 10, cost: ['colorless'], description: '' }],
    retreatCost: 1, weakness: 'fire', resistance: null
  },
  {
    id: 'ivysaur', name: '妙蛙草', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_1, evolvesFrom: 'bulbasaur', evolvesTo: ['venusaur'],
    element: 'grass', hp: 90,
    attacks: [
      { name: '飞叶快刀', damage: 30, cost: ['grass', 'colorless'], description: '' },
      { name: '种子炸弹', damage: 50, cost: ['grass', 'grass', 'colorless'], description: '' }
    ],
    retreatCost: 2, weakness: 'fire', resistance: null
  },
  {
    id: 'venusaur', name: '妙蛙花', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_2, evolvesFrom: 'ivysaur', evolvesTo: null,
    element: 'grass', hp: 140,
    attacks: [
      { name: '花瓣舞', damage: 60, cost: ['grass', 'grass', 'colorless'], description: '' },
      { name: '阳光烈焰', damage: 110, cost: ['grass', 'grass', 'grass', 'colorless'], description: '' }
    ],
    retreatCost: 3, weakness: 'fire', resistance: null
  },

  // === 电系进化链 ===
  {
    id: 'pikachu', name: '皮卡丘', type: CardType.POKEMON,
    subtype: EvolutionStage.BASIC, evolvesFrom: null, evolvesTo: ['raichu'],
    element: 'electric', hp: 60,
    attacks: [{ name: '电击', damage: 20, cost: ['electric'], description: '' }],
    retreatCost: 1, weakness: 'fighting', resistance: null
  },
  {
    id: 'raichu', name: '雷丘', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_1, evolvesFrom: 'pikachu', evolvesTo: null,
    element: 'electric', hp: 110,
    attacks: [
      { name: '十万伏特', damage: 50, cost: ['electric', 'colorless'], description: '' },
      { name: '打雷', damage: 90, cost: ['electric', 'electric', 'colorless'], description: '' }
    ],
    retreatCost: 2, weakness: 'fighting', resistance: null
  },

  // === 超能系进化链 ===
  {
    id: 'ralts', name: '拉鲁拉丝', type: CardType.POKEMON,
    subtype: EvolutionStage.BASIC, evolvesFrom: null, evolvesTo: ['kirlia'],
    element: 'psychic', hp: 50,
    attacks: [{ name: '念力', damage: 10, cost: ['psychic'], description: '' }],
    retreatCost: 1, weakness: 'fighting', resistance: null
  },
  {
    id: 'kirlia', name: '奇鲁莉安', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_1, evolvesFrom: 'ralts', evolvesTo: ['gardevoir'],
    element: 'psychic', hp: 80,
    attacks: [
      { name: '精神强念', damage: 40, cost: ['psychic', 'colorless'], description: '' }
    ],
    retreatCost: 2, weakness: 'fighting', resistance: null
  },
  {
    id: 'gardevoir', name: '沙奈朵', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_2, evolvesFrom: 'kirlia', evolvesTo: null,
    element: 'psychic', hp: 130,
    attacks: [
      { name: '月亮之力', damage: 60, cost: ['psychic', 'colorless'], description: '' },
      { name: '精神冲击', damage: 100, cost: ['psychic', 'psychic', 'colorless'], description: '' }
    ],
    retreatCost: 2, weakness: 'fighting', resistance: null
  },

  // === 斗系进化链 ===
  {
    id: 'machop', name: '腕力', type: CardType.POKEMON,
    subtype: EvolutionStage.BASIC, evolvesFrom: null, evolvesTo: ['machoke'],
    element: 'fighting', hp: 70,
    attacks: [{ name: '空手刀', damage: 20, cost: ['fighting'], description: '' }],
    retreatCost: 1, weakness: 'psychic', resistance: null
  },
  {
    id: 'machoke', name: '豪力', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_1, evolvesFrom: 'machop', evolvesTo: ['machamp'],
    element: 'fighting', hp: 100,
    attacks: [
      { name: '过肩摔', damage: 40, cost: ['fighting', 'colorless'], description: '' },
      { name: '怪力', damage: 70, cost: ['fighting', 'fighting', 'colorless'], description: '' }
    ],
    retreatCost: 2, weakness: 'psychic', resistance: null
  },
  {
    id: 'machamp', name: '怪力', type: CardType.POKEMON,
    subtype: EvolutionStage.STAGE_2, evolvesFrom: 'machoke', evolvesTo: null,
    element: 'fighting', hp: 150,
    attacks: [
      { name: '十字劈', damage: 60, cost: ['fighting', 'fighting', 'colorless'], description: '' },
      { name: '爆裂拳', damage: 110, cost: ['fighting', 'fighting', 'fighting', 'colorless'], description: '' }
    ],
    retreatCost: 3, weakness: 'psychic', resistance: null
  },

  // === 无属性 ===
  {
    id: 'eevee', name: '伊布', type: CardType.POKEMON,
    subtype: EvolutionStage.BASIC, evolvesFrom: null, evolvesTo: null,
    element: 'colorless', hp: 50,
    attacks: [
      { name: '撞击', damage: 10, cost: ['colorless'], description: '' },
      { name: '撒娇', damage: 20, cost: ['colorless', 'colorless'], description: '' }
    ],
    retreatCost: 1, weakness: 'fighting', resistance: null
  }
];

// ============================================================
// 能量卡数据
// ============================================================
const ENERGY_CARDS = [
  { id: 'energy_fire', name: '火能量', type: CardType.ENERGY, element: 'fire' },
  { id: 'energy_water', name: '水能量', type: CardType.ENERGY, element: 'water' },
  { id: 'energy_grass', name: '草能量', type: CardType.ENERGY, element: 'grass' },
  { id: 'energy_electric', name: '电能量', type: CardType.ENERGY, element: 'electric' },
  { id: 'energy_psychic', name: '超能量', type: CardType.ENERGY, element: 'psychic' },
  { id: 'energy_fighting', name: '斗能量', type: CardType.ENERGY, element: 'fighting' }
];

// ============================================================
// 训练家卡数据
// ============================================================
const TRAINER_CARDS = [
  {
    id: 'potion', name: '伤药', type: CardType.TRAINER,
    effect: 'heal', value: 30, target: 'own_active',
    description: '回复出战宝可梦30HP'
  },
  {
    id: 'pokeball', name: '精灵球', type: CardType.TRAINER,
    effect: 'search', value: 1, target: 'deck_basic',
    description: '从牌组检索1只基础宝可梦到手牌'
  },
  {
    id: 'professor_research', name: '博士的研究', type: CardType.TRAINER,
    effect: 'draw', value: 7, target: 'self',
    description: '弃掉手牌，抽7张'
  },
  {
    id: 'energy_switch', name: '能量转移', type: CardType.TRAINER,
    effect: 'energy_accel', value: 1, target: 'bench_to_active',
    description: '将1张后备宝可梦的能量移到出战宝可梦'
  }
];

// ============================================================
// 所有卡牌索引
// ============================================================
const ALL_CARDS = [...POKEMON_CARDS, ...ENERGY_CARDS, ...TRAINER_CARDS];
const CARD_MAP = {};
ALL_CARDS.forEach(c => { CARD_MAP[c.id] = c; });

function getCard(id) { return CARD_MAP[id]; }
function getCards(ids) { return ids.map(id => CARD_MAP[id]).filter(Boolean); }
function cloneCard(card) { return card ? JSON.parse(JSON.stringify(card)) : null; }
function cloneCards(cards) { return cards.map(c => cloneCard(c)); }

// ============================================================
// 预组牌组
// ============================================================
const PREBUILT_DECKS = [
  {
    id: 'deck_fire',
    name: '🔥 火系强攻',
    element: 'fire',
    description: '高攻高爆发',
    cards: [
      'charmander','charmander','charmander','charmander','charmander',
      'charmeleon','charmeleon','charmeleon',
      'charizard','charizard',
      'pikachu','pikachu','pikachu',
      'energy_fire','energy_fire','energy_fire','energy_fire',
      'energy_fire','energy_fire','energy_fire','energy_fire',
      'energy_electric','energy_electric','energy_electric',
      'potion','potion','pokeball','professor_research','energy_switch','energy_switch'
    ]
  },
  {
    id: 'deck_water',
    name: '💧 水系控制',
    element: 'water',
    description: '均衡续航型',
    cards: [
      'squirtle','squirtle','squirtle','squirtle',
      'wartortle','wartortle','wartortle','wartortle',
      'blastoise','blastoise','blastoise',
      'eevee','eevee','eevee',
      'energy_water','energy_water','energy_water','energy_water',
      'energy_water','energy_water','energy_water','energy_water',
      'potion','potion','potion',
      'pokeball','pokeball','professor_research','energy_switch','energy_switch'
    ]
  },
  {
    id: 'deck_grass',
    name: '🌿 草系消耗',
    element: 'grass',
    description: '控场消耗型',
    cards: [
      'bulbasaur','bulbasaur','bulbasaur','bulbasaur',
      'ivysaur','ivysaur','ivysaur',
      'venusaur','venusaur','venusaur',
      'eevee','eevee','eevee','eevee',
      'energy_grass','energy_grass','energy_grass','energy_grass',
      'energy_grass','energy_grass','energy_grass','energy_grass',
      'potion','potion','potion',
      'pokeball','pokeball',
      'professor_research','energy_switch','energy_switch'
    ]
  },
  {
    id: 'deck_psychic',
    name: '🌀 超能爆发',
    element: 'psychic',
    description: '快攻爆发型',
    cards: [
      'ralts','ralts','ralts','ralts',
      'kirlia','kirlia','kirlia',
      'gardevoir','gardevoir','gardevoir',
      'machop','machop','machop','machop',
      'energy_psychic','energy_psychic','energy_psychic',
      'energy_psychic','energy_psychic','energy_psychic','energy_psychic',
      'energy_fighting','energy_fighting','energy_fighting',
      'potion','pokeball','pokeball',
      'professor_research','energy_switch','energy_switch'
    ]
  },
  {
    id: 'deck_electric',
    name: '⚡ 电系速攻',
    element: 'electric',
    description: '快速成型连续攻击',
    cards: [
      'pikachu','pikachu','pikachu','pikachu',
      'raichu','raichu','raichu','raichu',
      'eevee','eevee','eevee','eevee',
      'energy_electric','energy_electric','energy_electric',
      'energy_electric','energy_electric','energy_electric',
      'energy_electric','energy_electric',
      'potion','potion','potion','potion',
      'pokeball','pokeball','pokeball',
      'professor_research','energy_switch','energy_switch'
    ]
  }
];

// 验证牌组合法性
function isDeckValid(deck) {
  return deck.cards && deck.cards.length === 30;
}

module.exports = {
  POKEMON_CARDS, ENERGY_CARDS, TRAINER_CARDS, ALL_CARDS, CARD_MAP,
  getCard, getCards, cloneCard, cloneCards,
  PREBUILT_DECKS, isDeckValid
};
