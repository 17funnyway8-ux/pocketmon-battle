// AnimationManager.js - 动画管理与回放
const AnimationManager = {
  queue: [],
  isPlaying: false,
  boardEl: null,

  init() {
    this.boardEl = document.getElementById('board');
  },

  enqueue(logEntries) {
    if (!logEntries || logEntries.length === 0) return;
    for (const entry of logEntries) {
      this.queue.push(entry);
    }
    if (!this.isPlaying) this._processQueue();
  },

  async _processQueue() {
    this.isPlaying = true;
    while (this.queue.length > 0) {
      const entry = this.queue.shift();
      await this._playEntry(entry);
    }
    this.isPlaying = false;
  },

  async _playEntry(entry) {
    switch (entry.type) {
      case 'draw': await this._animateDraw(entry); break;
      case 'play_pokemon': await this._animatePlay(entry); break;
      case 'attack': await this._animateAttack(entry); break;
      case 'knockout': await this._animateKnockout(entry); break;
      case 'evolve': await this._animateEvolve(entry); break;
      case 'retreat': await this._animateRetreat(entry); break;
      case 'use_trainer': await this._animateTrainer(entry); break;
      case 'attach_energy': this._animateEnergy(entry); break;
      case 'trainer_heal': await this._animateHeal(entry); break;
      // 其他类型直接跳过
    }
  },

  async _animateDraw(entry) {
    const handEl = document.getElementById('player-hand');
    if (!handEl) return;
    // 新抽的卡用动画入场
    const lastChild = handEl.lastElementChild;
    if (lastChild) {
      lastChild.classList.add('card--drawing');
      await this._wait(350);
      lastChild.classList.remove('card--drawing');
    }
  },

  async _animatePlay(entry) {
    const zone = entry.zone === 'active' ? 'player-active' : 'player-bench';
    const el = document.getElementById(zone);
    if (!el) return;
    const lastChild = el.lastElementChild;
    if (lastChild && lastChild.querySelector('.card')) {
      const card = lastChild.querySelector('.card');
      card.classList.add('card--playing');
      await this._wait(350);
      card.classList.remove('card--playing');
    }
  },

  async _animateAttack(entry) {
    const myActive = document.getElementById('my-active-pokemon');
    const oppActive = document.getElementById('opponent-active-pokemon');
    if (!myActive || !oppActive) return;

    // 1. 攻击方抖动
    const myCard = myActive.querySelector('.card');
    if (myCard) {
      myCard.classList.add('pokemon--attacking');
    }
    await this._wait(500);

    // 2. 受击方闪白
    const oppCard = oppActive.querySelector('.card');
    if (oppCard) {
      oppCard.classList.add('pokemon--damaged');
    }

    // 3. 伤害数字
    if (entry.damage && entry.damage > 0) {
      this._showDamagePopup(oppActive, entry.damage);
    }

    await this._wait(600);

    if (myCard) myCard.classList.remove('pokemon--attacking');
    if (oppCard) oppCard.classList.remove('pokemon--damaged');
  },

  async _animateKnockout(entry) {
    const active = document.getElementById('opponent-active-pokemon');
    if (!active) return;
    const card = active.querySelector('.card');
    if (card) {
      card.classList.add('pokemon--knocked-out');
    }
    await this._wait(700);
  },

  async _animateEvolve(entry) {
    const targetId = entry.target === 'active' ? 'my-active-pokemon'
      : `player-bench [data-bench-index="${entry.target.split('_')[1]}"]`;

    // 用简单方式处理
    const allCards = document.querySelectorAll('#player-active .card, #player-bench .card');
    const lastCard = allCards[allCards.length - 1];
    if (lastCard) {
      lastCard.classList.add('pokemon--evolving');
      await this._wait(900);
      lastCard.classList.remove('pokemon--evolving');
    }
  },

  async _animateRetreat(entry) {
    await this._wait(300);
  },

  async _animateTrainer(entry) {
    await this._wait(200);
  },

  _animateEnergy(entry) {
    // 简化的能量附着动画
  },

  async _animateHeal(entry) {
    await this._wait(300);
  },

  _showDamagePopup(targetEl, damage) {
    const rect = targetEl.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'damage-popup';
    popup.textContent = `-${damage}`;
    popup.style.left = `${rect.left + rect.width / 2 - 20}px`;
    popup.style.top = `${rect.top + rect.height / 2 - 20}px`;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
  },

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
