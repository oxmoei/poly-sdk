/**
 * Metrics Collector - Simple metrics for monitoring
 * 
 * In production, you would use Prometheus or similar
 */

import { logger } from './logger.js';

export interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  // Counter: increment a value
  increment(name: string, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
    this.recordMetric(name, current + 1, labels, 'counter');
  }

  // Gauge: set a value
  set(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
    this.recordMetric(name, value, labels, 'gauge');
  }

  // Histogram: record a value
  observe(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels, 'histogram');
  }

  private recordMetric(
    name: string,
    value: number,
    labels?: Record<string, string>,
    type: string = 'gauge'
  ): void {
    const metric: Metric = {
      name: `${name}_${type}`,
      value,
      labels,
      timestamp: Date.now(),
    };

    const key = this.getKey(name, labels);
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(metric);

    // Log metric (in production, send to Prometheus/DataDog/etc)
    logger.debug(`Metric: ${metric.name} = ${value}`, labels);
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  // Get current counter value
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.getKey(name, labels);
    return this.counters.get(key) || 0;
  }

  // Get current gauge value
  getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.getKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  // Get all metrics (for export)
  getAllMetrics(): Metric[] {
    const all: Metric[] = [];
    for (const metrics of this.metrics.values()) {
      all.push(...metrics);
    }
    return all;
  }

  // Reset all metrics
  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
  }
}

export const metrics = new MetricsCollector();

