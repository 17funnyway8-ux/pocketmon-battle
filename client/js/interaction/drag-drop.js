// drag-drop.js — 卡牌拖放交互管理器（Pointer Events，支持鼠标+触屏）
// ============================================================
// 使用 PointerEvent API 实现统一拖放，避免 HTML5 DnD 的移动端兼容问题

const DragDropManager = {
  enabled: false,
  dragging: null,     // { card, sourceEl, ghostEl, offsetX, offsetY, pointerId }
  dropZones: [],     // [{ el, type, data }] — type: 'active'|'bench'|'pokemon_energy'
  _ghostClone: null,
  _highlightEls: [],
  _pointerId: null,

  // 回调：拖放完成时触发 → BattleScreen 据此决定发送什么 WS 消息
  onDrop: null,      // (card, zoneType, zoneData) => void

  // ============================================================
  // 生命周期
  // ============================================================
  init() {
    document.addEventListener('pointermove', this._onPointerMove.bind(this));
    document.addEventListener('pointerup',   this._onPointerUp.bind(this));
    document.addEventListener('pointercancel', this._onPointerUp.bind(this));
  },

  enable(validActions) {
    this.enabled = true;
    this._validActions = validActions || [];
  },

  disable() {
    this.enabled = false;
    this.cancelDrag();
    this._validActions = [];
  },

  // ============================================================
  // 注册 / 清除拖放目标区域
  // ============================================================
  registerZone(type, element, data) {
    if (!element) return;
    this.dropZones.push({ el: element, type, data: data || {} });
  },

  clearZones() {
    this.dropZones = [];
    this._clearHighlights();
  },

  // ============================================================
  // 开始拖放（CardRenderer / BoardRenderer 调用）
  // ============================================================
  startDrag(card, sourceEl, event) {
    if (!this.enabled) return;
    if (this.dragging) this.cancelDrag();

    const rect = sourceEl.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    this.dragging = {
      card,
      sourceEl,
      ghostEl: null,
      offsetX,
      offsetY,
      pointerId: event.pointerId
    };
    this._pointerId = event.pointerId;

    // 创建跟随指针的幽灵卡牌
    this._createGhost(card, sourceEl);

    // 视觉反馈：源卡半透明
    sourceEl.style.opacity = '0.4';
    sourceEl.style.transition = 'opacity 0.15s';

    // 初始高亮有效区域
    this._updateHighlights(event.clientX, event.clientY);

    // 阻止默认（防止文本选中、滚动等）
    event.preventDefault();
    event.stopPropagation();
    sourceEl.setPointerCapture(event.pointerId);
  },

  // 取消拖放
  cancelDrag() {
    if (!this.dragging) return;

    // 恢复源卡
    if (this.dragging.sourceEl) {
      this.dragging.sourceEl.style.opacity = '1';
      this.dragging.sourceEl.style.transition = '';
    }

    // 移除幽灵
    if (this.dragging.ghostEl && this.dragging.ghostEl.parentNode) {
      this.dragging.ghostEl.parentNode.removeChild(this.dragging.ghostEl);
    }

    this._clearHighlights();
    this.dragging = null;
    this._pointerId = null;
  },

  // ============================================================
  // 内部：指针移动
  // ============================================================
  _onPointerMove(e) {
    if (!this.dragging) return;
    if (e.pointerId !== this._pointerId) return;
    e.preventDefault();

    // 移动幽灵
    if (this.dragging.ghostEl) {
      this.dragging.ghostEl.style.left = (e.clientX - this.dragging.offsetX) + 'px';
      this.dragging.ghostEl.style.top  = (e.clientY - this.dragging.offsetY) + 'px';
    }

    // 更新高亮
    this._updateHighlights(e.clientX, e.clientY);
  },

  // 内部：指针释放
  _onPointerUp(e) {
    if (!this.dragging) return;
    if (e.pointerId !== this._pointerId) return;

    const zone = this._findDropZone(e.clientX, e.clientY);

    if (zone) {
      // 有效放置
      if (this.onDrop && this.dragging.card) {
        this.onDrop(this.dragging.card, zone.type, zone.data);
      }
      // 放置动画
      this._playDropAnimation(e.clientX, e.clientY);
    } else {
      // 无效放置 → 回弹
      this._playReturnAnimation();
    }

    // 延迟清理（等动画结束）
    const card = this.dragging.card;
    const sourceEl = this.dragging.sourceEl;
    setTimeout(() => {
      if (sourceEl) {
        sourceEl.style.opacity = '1';
        sourceEl.style.transition = '';
      }
      this._clearHighlights();
      if (this.dragging && this.dragging.ghostEl && this.dragging.ghostEl.parentNode) {
        this.dragging.ghostEl.parentNode.removeChild(this.dragging.ghostEl);
      }
      this.dragging = null;
      this._pointerId = null;
    }, 200);
  },

  // ============================================================
  // 内部：幽灵卡牌
  // ============================================================
  _createGhost(card, sourceEl) {
    this._ghostClone = sourceEl.cloneNode(true);
    this._ghostClone.classList.add('card--dragging');
    this._ghostClone.style.cssText = `
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      opacity: 0.9;
      transform: rotate(2deg) scale(1.05);
      box-shadow: 0 12px 36px rgba(0,0,0,0.5);
      left: ${sourceEl.getBoundingClientRect().left}px;
      top: ${sourceEl.getBoundingClientRect().top}px;
      transition: none;
    `;
    document.body.appendChild(this._ghostClone);
    this.dragging.ghostEl = this._ghostClone;
  },

  // ============================================================
  // 内部：查找拖放目标区域
  // ============================================================
  _findDropZone(clientX, clientY) {
    for (const zone of this.dropZones) {
      const rect = zone.el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top  && clientY <= rect.bottom) {
        return zone;
      }
    }
    return null;
  },

  _updateHighlights(clientX, clientY) {
    this._clearHighlights();
    const zone = this._findDropZone(clientX, clientY);
    if (zone) {
      zone.el.classList.add('drop-zone--active');
      this._highlightEls.push(zone.el);
    }
  },

  _clearHighlights() {
    this._highlightEls.forEach(el => el.classList.remove('drop-zone--active'));
    this._highlightEls = [];
  },

  // ============================================================
  // 内部：动画
  // ============================================================
  _playDropAnimation(clientX, clientY) {
    if (!this.dragging || !this.dragging.ghostEl) return;
    const ghost = this.dragging.ghostEl;
    ghost.style.transition = 'all 0.15s ease-in';
    ghost.style.left = (clientX - 65) + 'px';
    ghost.style.top  = (clientY - 92) + 'px';
    ghost.style.opacity = '0';
    ghost.style.transform = 'rotate(0deg) scale(0.8)';
  },

  _playReturnAnimation() {
    if (!this.dragging || !this.dragging.ghostEl || !this.dragging.sourceEl) return;
    const ghost = this.dragging.ghostEl;
    const rect = this.dragging.sourceEl.getBoundingClientRect();
    ghost.style.transition = 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    ghost.style.left = rect.left + 'px';
    ghost.style.top  = rect.top  + 'px';
    ghost.style.opacity = '0.6';
    ghost.style.transform = 'rotate(0deg) scale(0.9)';
  }
};
