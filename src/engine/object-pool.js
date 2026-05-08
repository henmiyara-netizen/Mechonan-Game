// Generic object pool. Avoids GC churn for high-frequency entities (bullets, particles).

export class ObjectPool {
  constructor(factory, reset) {
    this.factory = factory;
    this.reset = reset || ((o) => o);
    this.free = [];
    this.active = [];
  }

  acquire(...args) {
    const obj = this.free.pop() || this.factory();
    this.reset(obj, ...args);
    obj.alive = true;
    this.active.push(obj);
    return obj;
  }

  release(obj) {
    obj.alive = false;
  }

  // Removes dead from active, sends to free pool
  sweep() {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      if (!o.alive) {
        this.active.splice(i, 1);
        this.free.push(o);
      }
    }
  }

  forEach(fn) {
    for (const o of this.active) if (o.alive) fn(o);
  }

  clear() {
    for (const o of this.active) o.alive = false;
    this.sweep();
  }

  get count() { return this.active.length; }
}
