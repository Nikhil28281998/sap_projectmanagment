/**
 * RFC Client — Wraps SAP RFC calls via BTP Cloud Connector
 * 
 * In production: Uses @sap-cloud-sdk/core or direct RFC via BTP Destination
 * In dev/test: Returns mock data from fixtures
 * 
 * Circuit Breaker: After 5 failures in 60s, stops calling for 30s
 * Retry: 3 attempts with exponential backoff (1s → 2s → 4s)
 */

const MOCK_TRANSPORTS = require('../../test/fixtures/rfc-transports-response.json');

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.windowMs = options.windowMs || 60000;
    this.failures = [];
    this.state = 'CLOSED'; // CLOSED (normal), OPEN (blocked), HALF_OPEN (testing)
    this.lastFailureTime = null;
  }

  recordFailure() {
    const now = Date.now();
    this.failures = this.failures.filter(t => now - t < this.windowMs);
    this.failures.push(now);
    this.lastFailureTime = now;

    if (this.failures.length >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`[CircuitBreaker] OPEN — ${this.failures.length} failures in ${this.windowMs}ms`);
    }
  }

  recordSuccess() {
    this.failures = [];
    this.state = 'CLOSED';
  }

  canExecute() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN — allow one test call
  }
}

class RFCClient {
  constructor() {
    this.circuitBreaker = new CircuitBreaker();
    this.maxRetries = 3;
    this.useMock = process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_RFC === 'true';
  }

  /**
   * Get all transports from SAP via Z_TCC_GET_TRANSPORTS
   */
  async getTransports(startDate = null) {
    if (this.useMock) {
      return this._getMockTransports();
    }

    return this._callWithRetry('Z_TCC_GET_TRANSPORTS', {
      IV_START_DATE: startDate || process.env.TR_START_DATE || '20260101',
      IV_CLIENT: process.env.SAP_CLIENT || '100'
    });
  }

  /**
   * Get import queue from SAP via Z_TCC_GET_IMPORT_QUEUE
   */
  async getImportQueue(system = 'QAS') {
    if (this.useMock) return [];
    return this._callWithRetry('Z_TCC_GET_IMPORT_QUEUE', { IV_SYSTEM: system });
  }

  /**
   * Check for object conflicts via Z_TCC_CHECK_CONFLICTS
   */
  async checkConflicts(trNumbers = []) {
    if (this.useMock) return [];
    return this._callWithRetry('Z_TCC_CHECK_CONFLICTS', { IT_TR_NUMBERS: trNumbers });
  }

  /**
   * Get batch queue via Z_TCC_GET_BATCH_QUEUE
   */
  async getBatchQueue() {
    if (this.useMock) return [];
    return this._callWithRetry('Z_TCC_GET_BATCH_QUEUE', {});
  }

  // ─── Internal: Call with retry + circuit breaker ───
  async _callWithRetry(functionName, params) {
    if (!this.circuitBreaker.canExecute()) {
      throw new Error(`RFC circuit breaker is OPEN — SAP system appears unreachable. Try again later.`);
    }

    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this._executeRFC(functionName, params);
        this.circuitBreaker.recordSuccess();
        return result;
      } catch (err) {
        lastError = err;
        console.warn(`[RFC] ${functionName} attempt ${attempt}/${this.maxRetries} failed: ${err.message}`);
        if (attempt < this.maxRetries) {
          await this._sleep(Math.pow(2, attempt - 1) * 1000); // 1s, 2s, 4s
        }
      }
    }

    this.circuitBreaker.recordFailure();
    throw new Error(`RFC ${functionName} failed after ${this.maxRetries} retries: ${lastError.message}`);
  }

  // ─── Internal: Execute actual RFC call ───
  async _executeRFC(functionName, params) {
    // In production, this would use the SAP Cloud SDK or node-rfc
    // via BTP Destination service + Cloud Connector
    //
    // Example with @sap-cloud-sdk:
    //   const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
    //   const result = await executeHttpRequest({ destinationName: 'S4HANA_RFC' }, {
    //     method: 'POST', url: `/sap/bc/srt/rfc/sap/${functionName}`, data: params
    //   });
    //
    // For now, throw to indicate not yet connected:
    throw new Error(`RFC ${functionName} — production RFC not yet configured. Set USE_MOCK_RFC=true for development.`);
  }

  // ─── Mock data for development/testing ───
  _getMockTransports() {
    return MOCK_TRANSPORTS;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { RFCClient, CircuitBreaker };
