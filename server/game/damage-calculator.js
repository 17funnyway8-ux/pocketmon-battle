// server/game/damage-calculator.js - 伤害计算
const { ELEMENT_CHART } = require('../../shared/constants');

/**
 * 计算伤害
 * 规则：
 * - ELEMENT_CHART 处理属性相克（2x 或 0.5x）
 * - 宝可梦卡上的 resistance 字段作为抗性减伤（-20）
 * - weakness 字段仅作显示参考，不叠加于 ELEMENT_CHART
 */
function calculateDamage(attackerCard, defenderCard, attackIndex) {
  const attack = attackerCard.attacks[attackIndex];
  if (!attack) return { baseDamage: 0, finalDamage: 0 };

  let baseDamage = attack.damage;
  let multiplier = 1;

  // 属性相克（ELEMENT_CHART 已直接包含克制关系）
  const attackerElement = attackerCard.element;
  const defenderElement = defenderCard.element;

  if (attackerElement !== 'colorless' && defenderElement !== 'colorless') {
    const chartEntry = ELEMENT_CHART[attackerElement];
    if (chartEntry && chartEntry[defenderElement] !== undefined) {
      multiplier = chartEntry[defenderElement];
    }
  }

  // 抗性减伤：若防御方的 resistance 匹配攻击方属性
  let resistanceReduction = 0;
  if (defenderCard.resistance && defenderCard.resistance === attackerElement) {
    resistanceReduction = 20;
  }

  const finalDamage = Math.max(0,
    Math.floor(baseDamage * multiplier) - resistanceReduction
  );

  return {
    baseDamage,
    multiplier,
    resistanceReduction,
    weaknessHit: multiplier > 1,
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
