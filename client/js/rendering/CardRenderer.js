// CardRenderer.js - 卡牌 DOM 渲染
const CardRenderer = {
  // 属性颜色
  elementColors: {
    fire: '#f44336', water: '#2196f3', grass: '#4caf50',
    electric: '#ffeb3b', psychic: '#9c27b0', fighting: '#ff9800',
    colorless: '#9e9e9e'
  },
  // 属性符号
  elementSymbols: {
    fire: '🔥', water: '💧', grass: '🌿',
    electric: '⚡', psychic: '🌀', fighting: '💪',
    colorless: '⬜'
  },
  // 能量符号内联样式
  energyColors: {
    fire: '#f44336', water: '#2196f3', grass: '#4caf50',
    electric: '#ffeb3b', psychic: '#9c27b0', fighting: '#ff9800',
    colorless: '#999'
  },

  render(card, options = {}) {
    const el = document.createElement('div');
    const size = options.size || 'normal';
    el.className = `card card--${size}`;
    el.dataset.cardId = card ? card.id : '';

    if (options.faceDown || !card) {
      el.classList.add('card--facedown');
      return el;
    }

    if (options.className) {
      el.classList.add(options.className);
    }

    switch (card.type) {
      case 'pokemon': this._renderPokemon(el, card); break;
      case 'energy':  this._renderEnergy(el, card); break;
      case 'trainer': this._renderTrainer(el, card); break;
      default: el.textContent = card.name || '?'; break;
    }

    if (options.interactive) {
      el.classList.add('card--interactive');
      el.tabIndex = 0;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onClick && options.onClick(card, el);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') options.onClick && options.onClick(card, el);
      });
    }

    // 拖放支持
    if (options.draggable) {
      el.classList.add('card--draggable');
      el.addEventListener('pointerdown', (e) => {
        // 长按/拖动手势触发拖放（避免短按干扰 click）
        DragDropManager.startDrag(card, el, e);
      });
    }

    return el;
  },

  _renderPokemon(el, card) {
    const color = this.elementColors[card.element] || '#666';
    el.style.setProperty('--card-color', color);
    el.classList.add('card--pokemon');
    el.style.borderColor = color;

    el.innerHTML = `
      <div class="card__header" style="border-bottom-color: ${color}44">
        <span class="card__name">${card.name}</span>
        <span class="card__hp">HP ${card.hp}</span>
        <span class="card__element-icon">${this.elementSymbols[card.element] || ''}</span>
      </div>
      <div class="card__image">
        <div class="card__image-placeholder">${this.elementSymbols[card.element] || '?'}</div>
      </div>
      <div class="card__attacks">
        ${card.attacks.map(a => `
          <div class="attack">
            <div class="attack__cost">
              ${a.cost.map(c => `<span class="energy" style="background:${this.energyColors[c] || '#666'}"></span>`).join('')}
            </div>
            <div class="attack__name">${a.name}</div>
            <div class="attack__damage">${a.damage || ''}</div>
          </div>
        `).join('')}
      </div>
      <div class="card__footer">
        <span>弱点 ${card.weakness ? this.elementSymbols[card.weakness] || card.weakness : '—'}</span>
        <span>撤退 ${'●'.repeat(card.retreatCost || 0)}</span>
      </div>
    `;
  },

  _renderEnergy(el, card) {
    const color = this.elementColors[card.element] || '#666';
    el.style.borderColor = color;
    el.style.background = `linear-gradient(135deg, ${color}33, ${color}11)`;
    el.innerHTML = `
      <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;">
        <span style="font-size:1.5rem;">${this.elementSymbols[card.element] || '⚡'}</span>
        <span style="font-size:0.7rem;font-weight:600;">${card.name}</span>
      </div>
    `;
  },

  _renderTrainer(el, card) {
    const gradient = 'linear-gradient(135deg, #e91e63, #9c27b0)';
    el.style.borderColor = '#e91e63';
    el.style.background = gradient;
    el.innerHTML = `
      <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;padding:4px;">
        <span style="font-size:1.2rem;">📋</span>
        <span style="font-size:0.65rem;font-weight:700;text-align:center;">${card.name}</span>
        <span style="font-size:0.5rem;text-align:center;opacity:0.7;">${card.description || ''}</span>
      </div>
    `;
  },

  // 更新卡牌上的伤害指示器
  updateDamage(el, damage, maxHp) {
    if (!el) return;
    let overlay = el.querySelector('.card__damage-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'card__damage-overlay';
      el.appendChild(overlay);
    }
    const ratio = Math.min(1, damage / maxHp);
    overlay.textContent = damage > 0 ? `-${damage}` : '';
    overlay.style.height = `${ratio * 100}%`;
    overlay.style.opacity = damage > 0 ? '0.6' : '0';
    el.classList.toggle('card--knocked-out', damage >= maxHp);
  }
};
