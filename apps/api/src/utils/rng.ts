import crypto from 'crypto';

export class SeededRNG {
  private state: Uint32Array;

  constructor(seed: string) {
    this.state = this.hashToState(seed);
  }

  private hashToState(seed: string): Uint32Array {
    const hash = crypto.createHash('sha256').update(seed).digest();
    const state = new Uint32Array(4);
    for (let i = 0; i < 4; i++) {
      state[i] = hash.readUInt32LE(i * 4);
    }
    return state;
  }

  next(): number {
    const s = this.state;
    const t = ((s[1] + s[3]) | 0) >>> 0;
    s[3] = (s[3] + 1) | 0;
    s[0] = (t ^ s[0]) >>> 0;
    s[1] = (s[1] ^ s[2]) >>> 0;
    s[2] = (((s[2] << 9) | (s[2] >>> 23)) + t) | 0;
    return (s[0] >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  bool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  choice<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  weightedChoice<T>(items: { item: T; weight: number }[]): T {
    const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
    let random = this.next() * totalWeight;
    for (const item of items) {
      random -= item.weight;
      if (random <= 0) return item.item;
    }
    return items[items.length - 1].item;
  }

  normal(mean: number = 0, stdDev: number = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  clone(): SeededRNG {
    const rng = Object.create(SeededRNG.prototype);
    rng.state = new Uint32Array(this.state);
    return rng;
  }
}

export function generateMatchSeed(
  matchId: string,
  scheduledTime: string,
  homeRosterHash: string,
  awayRosterHash: string,
  dailySalt: string
): string {
  return crypto
    .createHash('sha256')
    .update(matchId + scheduledTime + homeRosterHash + awayRosterHash + dailySalt)
    .digest('hex');
}

export function generateSeedHash(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}
