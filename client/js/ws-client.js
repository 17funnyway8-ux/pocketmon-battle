// ws-client.js - WebSocket 客户端封装
const WS = {
  ws: null,
  listeners: {},
  reconnectAttempts: 0,
  maxReconnect: 5,
  pendingActions: [],
  playerId: null,
  onStatusChange: null,

  connect(url) {
    const self = this;
    self.ws = new WebSocket(url);

    self.ws.onopen = () => {
      self.reconnectAttempts = 0;
      while (self.pendingActions.length > 0) {
        self.ws.send(JSON.stringify(self.pendingActions.shift()));
      }
      self._emit('_connected');
      self._updateStatus('connected');
    };

    self.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        self._emit(msg.type, msg.payload);
      } catch (e) {
        console.warn('WS parse error:', e);
      }
    };

    self.ws.onclose = () => {
      self._updateStatus('disconnected');
      self._attemptReconnect(url);
    };

    self.ws.onerror = () => {
      self._updateStatus('disconnected');
    };
  },

  send(type, payload = {}) {
    const msg = JSON.stringify({ type, payload });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.pendingActions.push({ type, payload });
    }
  },

  on(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
  },

  off(type, callback) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
  },

  _emit(type, payload) {
    (this.listeners[type] || []).forEach(cb => cb(payload));
    this._emit('*', { type, payload });
  },

  _updateStatus(status) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    el.className = 'connection-status ' + status;
    const labels = { connected: '已连接', disconnected: '已断开', connecting: '连接中...' };
    el.textContent = labels[status] || status;
    if (this.onStatusChange) this.onStatusChange(status);
  },

  _attemptReconnect(url) {
    if (this.reconnectAttempts >= this.maxReconnect) return;
    this.reconnectAttempts++;
    this._updateStatus('connecting');
    setTimeout(() => this.connect(url), 1000 * this.reconnectAttempts);
  },

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
};
