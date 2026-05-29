// server/game/damage-calculator.js - 伤害计算
const { ELEMENT_CHART } = require('../../shared/constants');

/**
 * 计算伤害
 * @param {Object} attackerCard - 攻击方宝可梦卡牌数据
 * @param {Object} defenderCard - 防御方宝可梦卡牌数据
 * @param {number} attackIndex - 招式索引
 * @returns {{ baseDamage, multiplier, finalDamage, weaknessHit, resistanceReduction }}
 */
function calculateDamage(attackerCard, defenderCard, attackIndex) {
  const attack = attackerCard.attacks[attackIndex];
  if (!attack) return { baseDamage: 0, finalDamage: 0 };

  let baseDamage = attack.damage;
  let multiplier = 1;

  // 属性相克
  const attackerElement = attackerCard.element;
  const defenderElement = defenderCard.element;

  if (attackerElement !== 'colorless' && defenderElement !== 'colorless') {
    const chartEntry = ELEMENT_CHART[attackerElement];
    if (chartEntry && chartEntry[defenderElement] !== undefined) {
      multiplier = chartEntry[defenderElement];
    }
  }

  // 弱点: 防御方的 weakness 属性 = 攻击方属性 → x2
  let weaknessMultiplier = 1;
  if (defenderCard.weakness && defenderCard.weakness === attackerElement) {
    weaknessMultiplier = 2;
  }

  // 抗性: 防御方的 resistance 属性 = 攻击方属性 → -20
  let resistanceReduction = 0;
  if (defenderCard.resistance && defenderCard.resistance === attackerElement) {
    resistanceReduction = 20;
  }

  const finalDamage = Math.max(0,
    Math.floor(baseDamage * multiplier * weaknessMultiplier) - resistanceReduction
  );

  return {
    baseDamage,
    multiplier,
    weaknessMultiplier,
    resistanceReduction,
    finalDamage
  };
}

/**
 * 检查能量是否足够支付招式费用
 * @param {string[]} attachedElements - 已附着能量的 element 数组
 * @param {string[]} cost - 招式所需能量 (如 ['fire', 'colorless'])
 * @returns {boolean}
 */
function canPayEnergyCost(attachedElements, cost) {
  // 深拷贝可用能量
  const available = [...attachedElements];

  for (const required of cost) {
    if (required === 'colorless') {
      // 无色可以用任意能量支付
      if (available.length === 0) return false;
      available.pop(); // 消耗一个任意能量
    } else {
      // 特定属性需要匹配
      const idx = available.indexOf(required);
      if (idx !== -1) {
        available.splice(idx, 1);
      } else {
        return false;
      }
    }
  }
  return true;
}

module.exports = { calculateDamage, canPayEnergyCost };
