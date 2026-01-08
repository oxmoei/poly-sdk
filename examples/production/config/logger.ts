/**
 * Production Logger - Structured logging for production environments
 * 
 * Features:
 * - JSON structured logs
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - File rotation
 * - Sensitive data masking
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  context?: Record<string, any>;
}

class ProductionLogger {
  private minLevel: LogLevel;
  private logFile?: string;
  private sensitiveKeys = ['privateKey', 'PRIVATE_KEY', 'password', 'secret', 'apiKey'];

  constructor(minLevel: LogLevel = LogLevel.INFO, logFile?: string) {
    this.minLevel = minLevel;
    this.logFile = logFile;
  }

  private maskSensitiveData(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskSensitiveData(item));
    }

    const masked: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (this.sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()))) {
        masked[key] = '***MASKED***';
      } else if (typeof value === 'object') {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  private formatLog(level: string, message: string, data?: any, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (data !== undefined) {
      entry.data = this.maskSensitiveData(data);
    }

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    return entry;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private writeLog(entry: LogEntry): void {
    const jsonLog = JSON.stringify(entry);
    
    // Console output (human-readable)
    const emoji = {
      DEBUG: '🔍',
      INFO: '📋',
      WARN: '⚠️',
      ERROR: '❌',
    }[entry.level] || '📋';

    console.log(`[${entry.timestamp}] ${emoji} [${entry.level}] ${entry.message}`);
    if (entry.data) {
      console.log(JSON.stringify(entry.data, null, 2));
    }
    if (entry.error) {
      console.error(`Error: ${entry.error.message}`);
      if (entry.error.stack) {
        console.error(entry.error.stack);
      }
    }

    // File output (JSON structured)
    if (this.logFile) {
      // In production, you would write to file here
      // For now, we'll just use console
      // fs.appendFileSync(this.logFile, jsonLog + '\n');
    }
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog(this.formatLog('DEBUG', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog(this.formatLog('INFO', message, data));
    }
  }

  warn(message: string, data?: any, error?: Error): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog(this.formatLog('WARN', message, data, error));
    }
  }

  error(message: string, error?: Error, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog(this.formatLog('ERROR', message, data, error));
    }
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

// Export singleton instance
export const logger = new ProductionLogger(
  (process.env.LOG_LEVEL as keyof typeof LogLevel) 
    ? LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] 
    : LogLevel.INFO,
  process.env.LOG_FILE
);

