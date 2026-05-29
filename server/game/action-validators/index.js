// server/game/action-validators/index.js - 动作验证器入口

function validatePlayPokemon(gameState, playerId, payload) {
  const player = gameState.players[playerId];
  const card = player.hand.find(c => c.id === payload.cardId);
  if (!card) return { valid: false, reason: '卡牌不在手牌中' };
  if (card.type !== 'pokemon') return { valid: false, reason: '不是宝可梦卡' };
  if (gameState.turnPhase !== 'main') return { valid: false, reason: '当前阶段不能出宝可梦' };

  // 无出战宝可梦时，必须放置到出战区
  if (!player.activePokemon) {
    // 进化型不能直接作为出战
    if (card.subtype !== 'basic') {
      return { valid: false, reason: '进化型宝可梦不能直接上场' };
    }
    return { valid: true, autoActive: true };
  }

  // 已出战，放置到后备区
  if (payload.zone === 'bench') {
    const emptySlots = player.bench.filter(b => b === null).length;
    if (emptySlots === 0) return { valid: false, reason: '后备区已满' };
    if (card.subtype !== 'basic') return { valid: false, reason: '进化型宝可梦不能直接放到后备区' };
    return { valid: true };
  }

  return { valid: false, reason: '出战区已有宝可梦' };
}

function validateAttachEnergy(gameState, playerId, payload) {
  const player = gameState.players[playerId];
  const card = player.hand.find(c => c.id === payload.cardId);
  if (!card) return { valid: false, reason: '卡牌不在手牌中' };
  if (card.type !== 'energy') return { valid: false, reason: '不是能量卡' };
  if (gameState.turnPhase !== 'main') return { valid: false, reason: '当前阶段不能附着能量' };
  if (player.energyAttachedThisTurn) return { valid: false, reason: '本回合已附着过能量' };

  if (payload.target === 'active') {
    if (!player.activePokemon) return { valid: false, reason: '没有出战宝可梦' };
  } else if (payload.target && payload.target.startsWith('bench_')) {
    const idx = parseInt(payload.target.split('_')[1]);
    if (!player.bench[idx]) return { valid: false, reason: '指定的后备宝可梦不存在' };
  }

  return { valid: true };
}

function validateUseTrainer(gameState, playerId, payload) {
  const player = gameState.players[playerId];
  const card = player.hand.find(c => c.id === payload.cardId);
  if (!card) return { valid: false, reason: '卡牌不在手牌中' };
  if (card.type !== 'trainer') return { valid: false, reason: '不是训练家卡' };
  if (gameState.turnPhase !== 'main') return { valid: false, reason: '当前阶段不能使用训练家卡' };

  // 根据效果做特化验证
  if (card.effect === 'heal') {
    // 伤药：需要有受伤的宝可梦
    if (!player.activePokemon) return { valid: false, reason: '没有出战宝可梦' };
    if (player.activePokemon.damageCounters <= 0) return { valid: false, reason: '出战宝可梦没有受伤' };
  }
  if (card.effect === 'energy_accel') {
    // 能量转移：需要后备区有能量
    if (!player.activePokemon) return { valid: false, reason: '没有出战宝可梦' };
    const benchHasEnergy = player.bench.some(b => b && b.attachedEnergy.length > 0);
    if (!benchHasEnergy) return { valid: false, reason: '后备区没有可转移的能量' };
  }
  if (card.effect === 'search') {
    // 精灵球：牌组需要有基础宝可梦
    const hasBasic = player.deck.some(c => c.type === 'pokemon' && c.subtype === 'basic');
    if (!hasBasic && !player.hand.some(c => c.type === 'pokemon' && c.subtype === 'basic')) {
      // 也可以从手牌
    }
  }

  return { valid: true };
}

function validateEvolve(gameState, playerId, payload) {
  const player = gameState.players[playerId];
  const card = player.hand.find(c => c.id === payload.cardId);
  if (!card) return { valid: false, reason: '卡牌不在手牌中' };
  if (card.type !== 'pokemon') return { valid: false, reason: '不是宝可梦卡' };
  if (card.subtype === 'basic') return { valid: false, reason: '基础宝可梦不能进化' };
  if (gameState.turnPhase !== 'main') return { valid: false, reason: '当前阶段不能进化' };
  if (player.evolvedThisTurn) return { valid: false, reason: '本回合已进化过' };

  const target = payload.target || 'active';
  let targetPokemon;
  if (target === 'active') {
    targetPokemon = player.activePokemon;
  } else if (target.startsWith('bench_')) {
    const idx = parseInt(target.split('_')[1]);
    targetPokemon = player.bench[idx];
  }

  if (!targetPokemon) return { valid: false, reason: '目标宝可梦不存在' };

  // 检查进化链
  if (targetPokemon.card.id !== card.evolvesFrom) {
    return { valid: false, reason: `需要从 ${targetPokemon.card.name} 进化，但 ${card.name} 不进化自它` };
  }

  // 检查本回合是否刚上场
  if (targetPokemon.justPlayed) return { valid: false, reason: '刚上场的宝可梦本回合不能进化' };

  return { valid: true, targetPokemon };
}

function validateRetreat(gameState, playerId) {
  const player = gameState.players[playerId];
  if (!player.activePokemon) return { valid: false, reason: '没有出战宝可梦' };
  if (gameState.turnPhase !== 'main') return { valid: false, reason: '当前阶段不能撤退' };

  const retreatCost = player.activePokemon.card.retreatCost || 0;
  const energyCount = player.activePokemon.attachedEnergy.length;
  if (energyCount < retreatCost) {
    return { valid: false, reason: `撤退需要 ${retreatCost} 能量，当前只有 ${energyCount}` };
  }

  const benchEmpty = player.bench.every(b => b === null);
  if (benchEmpty) return { valid: false, reason: '没有可替换的后备宝可梦' };

  return { valid: true, retreatCost };
}

function validateUseAttack(gameState, playerId, payload) {
  const player = gameState.players[playerId];
  if (gameState.turnPhase !== 'attack') return { valid: false, reason: '当前不是攻击阶段' };
  if (!player.activePokemon) return { valid: false, reason: '没有出战宝可梦' };

  const { canPayEnergyCost } = require('../damage-calculator');
  const attack = player.activePokemon.card.attacks[payload.attackIndex];
  if (!attack) return { valid: false, reason: '招式不存在' };

  const energyProvided = [...player.activePokemon.attachedEnergy];
  if (!canPayEnergyCost(energyProvided, attack.cost)) {
    return { valid: false, reason: '能量不足' };
  }

  if (player.attackedThisTurn) return { valid: false, reason: '本回合已攻击过' };

  return { valid: true, attack };
}

const validators = {
  play_pokemon: validatePlayPokemon,
  attach_energy: validateAttachEnergy,
  use_trainer: validateUseTrainer,
  evolve: validateEvolve,
  retreat: validateRetreat,
  use_attack: validateUseAttack
};

function getValidator(action) {
  return validators[action] || null;
}

module.exports = { getValidator, validatePlayPokemon, validateAttachEnergy, validateUseTrainer, validateEvolve, validateRetreat, validateUseAttack };
