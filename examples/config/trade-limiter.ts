/**
 * Trade Limiter - Enforces trading limits and safety checks
 */

import { logger } from './logger.js';
import { metrics } from './metrics.js';

export interface TradeLimits {
  dailyLimit: number;
  perTradeLimit: number;
  minTradeSize: number;
  maxTradeSize: number;
  minBalance: number; // Minimum USDC balance required
}

export class TradeLimiter {
  private limits: TradeLimits;
  private dailyTraded: number = 0;
  private lastResetDate: string;

  constructor(limits: TradeLimits) {
    this.limits = limits;
    this.lastResetDate = new Date().toISOString().split('T')[0];
    this.loadDailyTraded();
  }

  private loadDailyTraded(): void {
    // In production, load from database/Redis
    // For now, reset daily
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      this.dailyTraded = 0;
      this.lastResetDate = today;
    }
  }

  private saveDailyTraded(): void {
    // In production, save to database/Redis
    metrics.set('daily_traded_usdc', this.dailyTraded);
  }

  async checkTradeAllowed(amount: number, currentBalance: number): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Reset daily counter if new day
    this.loadDailyTraded();

    // Check minimum trade size
    if (amount < this.limits.minTradeSize) {
      metrics.increment('trade_rejected', { reason: 'below_min_size' });
      return {
        allowed: false,
        reason: `Trade size ${amount} is below minimum ${this.limits.minTradeSize}`,
      };
    }

    // Check maximum trade size
    if (amount > this.limits.perTradeLimit) {
      metrics.increment('trade_rejected', { reason: 'above_per_trade_limit' });
      return {
        allowed: false,
        reason: `Trade size ${amount} exceeds per-trade limit ${this.limits.perTradeLimit}`,
      };
    }

    // Check daily limit
    if (this.dailyTraded + amount > this.limits.dailyLimit) {
      metrics.increment('trade_rejected', { reason: 'daily_limit_exceeded' });
      return {
        allowed: false,
        reason: `Daily limit would be exceeded (${this.dailyTraded + amount} > ${this.limits.dailyLimit})`,
      };
    }

    // Check balance
    if (currentBalance < this.limits.minBalance) {
      metrics.increment('trade_rejected', { reason: 'insufficient_balance' });
      return {
        allowed: false,
        reason: `Balance ${currentBalance} is below minimum ${this.limits.minBalance}`,
      };
    }

    // Check if trade would exceed balance
    if (amount > currentBalance) {
      metrics.increment('trade_rejected', { reason: 'insufficient_balance_for_trade' });
      return {
        allowed: false,
        reason: `Trade amount ${amount} exceeds balance ${currentBalance}`,
      };
    }

    return { allowed: true };
  }

  recordTrade(amount: number): void {
    this.dailyTraded += amount;
    this.saveDailyTraded();
    metrics.increment('trades_executed');
    metrics.set('daily_traded_usdc', this.dailyTraded);
    logger.info(`Trade executed: $${amount.toFixed(2)}. Daily total: $${this.dailyTraded.toFixed(2)}/${this.limits.dailyLimit}`);
  }

  getDailyTraded(): number {
    this.loadDailyTraded();
    return this.dailyTraded;
  }

  getRemainingDailyLimit(): number {
    return Math.max(0, this.limits.dailyLimit - this.getDailyTraded());
  }

  resetDaily(): void {
    this.dailyTraded = 0;
    this.lastResetDate = new Date().toISOString().split('T')[0];
    this.saveDailyTraded();
    logger.info('Daily trade limit reset');
  }
}

