/**
 * Configuration Validator - Validates environment variables and configuration
 */

import { logger } from './logger.js';

export interface Config {
  privateKey?: string;
  rpcUrl?: string;
  profitThreshold: number;
  minTradeSize: number;
  maxTradeSize: number;
  dailyTradeLimit: number;
  scanIntervalMs: number;
  maxMarkets: number;
  enableTrading: boolean;
  enableMonitoring: boolean;
}

export class ConfigValidator {
  private errors: string[] = [];

  validatePrivateKey(key?: string): boolean {
    if (!key || key === '0xYOUR_PRIVATE_KEY_HERE') {
      this.errors.push('POLYMARKET_PRIVATE_KEY is not set or invalid');
      return false;
    }
    if (!key.startsWith('0x') || key.length !== 66) {
      this.errors.push('POLYMARKET_PRIVATE_KEY format is invalid (should be 0x followed by 64 hex chars)');
      return false;
    }
    return true;
  }

  validateRpcUrl(url?: string): boolean {
    if (!url) {
      this.errors.push('POLYGON_RPC_URL is not set');
      return false;
    }
    try {
      new URL(url);
      return true;
    } catch {
      this.errors.push('POLYGON_RPC_URL is not a valid URL');
      return false;
    }
  }

  validateTradeLimits(min: number, max: number, daily: number): boolean {
    if (min <= 0) {
      this.errors.push('MIN_TRADE_SIZE must be greater than 0');
      return false;
    }
    if (max <= min) {
      this.errors.push('MAX_TRADE_SIZE must be greater than MIN_TRADE_SIZE');
      return false;
    }
    if (daily <= 0) {
      this.errors.push('DAILY_TRADE_LIMIT must be greater than 0');
      return false;
    }
    return true;
  }

  validateConfig(config: Partial<Config>, requirePrivateKey = false): Config {
    this.errors = [];

    // Validate private key if required
    if (requirePrivateKey) {
      this.validatePrivateKey(config.privateKey);
    }

    // Validate RPC URL if provided
    if (config.rpcUrl) {
      this.validateRpcUrl(config.rpcUrl);
    }

    // Validate trade limits
    const minTradeSize = config.minTradeSize || parseFloat(process.env.MIN_TRADE_SIZE || '5');
    const maxTradeSize = config.maxTradeSize || parseFloat(process.env.MAX_TRADE_SIZE || '100');
    const dailyLimit = parseFloat(process.env.DAILY_TRADE_LIMIT || '1000');
    this.validateTradeLimits(minTradeSize, maxTradeSize, dailyLimit);

    // Check for errors
    if (this.errors.length > 0) {
      const errorMsg = `Configuration validation failed:\n${this.errors.map(e => `  - ${e}`).join('\n')}`;
      logger.error('Config validation failed', new Error(errorMsg));
      throw new Error(errorMsg);
    }

    // Return validated config
    return {
      privateKey: config.privateKey,
      rpcUrl: config.rpcUrl || process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      profitThreshold: config.profitThreshold || parseFloat(process.env.PROFIT_THRESHOLD || '0.005'),
      minTradeSize,
      maxTradeSize,
      dailyTradeLimit: dailyLimit,
      scanIntervalMs: config.scanIntervalMs || parseInt(process.env.SCAN_INTERVAL_MS || '5000'),
      maxMarkets: config.maxMarkets || parseInt(process.env.MAX_MARKETS || '20'),
      enableTrading: config.enableTrading ?? (!!config.privateKey && !process.env.DISABLE_TRADING),
      enableMonitoring: config.enableMonitoring ?? true,
    };
  }

  getErrors(): string[] {
    return [...this.errors];
  }
}

export const configValidator = new ConfigValidator();

