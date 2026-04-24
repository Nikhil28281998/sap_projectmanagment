/**
 * RFC Client — Wraps SAP RFC calls via BTP Cloud Connector
 *
 * Calls Z_TCC_GET_TRANSPORTS which reads from SAP standard tables:
 *   - E070 / E07T   → Transport headers + descriptions
 *   - TSTRFCOR       → Import history (per system + client)
 *   - USR21 / ADRP   → Owner full names
 *
 * Returns JSON with { transports: [...], importLog: [...] }
 *
 * In dev/test: Returns mock data from fixtures
 * Circuit Breaker: After 5 failures in 60s, stops calling for 30s
 * Retry: 3 attempts with exponential backoff (1s → 2s → 4s)
 */

// Load mock data lazily — test fixtures aren't available in production builds
let MOCK_TRANSPORTS = [];
try { MOCK_TRANSPORTS = require('../../test/fixtures/rfc-transports-response.json'); } catch { /* not available in prod */ }

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
  /**
   * @param {object} [opts] Runtime overrides sourced from AppConfig at call time.
   * @param {string} [opts.destinationName] BTP destination name (default: env/RFC_DEST_NAME or S4HANA_RFC_DS4)
   * @param {string} [opts.fmName]          FM name (default: env/RFC_FM_NAME or ZTCC_GET_TRANSPORTS)
   * @param {string} [opts.startDate]       YYYYMMDD string
   * @param {string} [opts.systemsFilter]   Comma-separated system IDs (e.g. 'DS4,QS4,PS4')
   */
  constructor(opts = {}) {
    this.circuitBreaker = new CircuitBreaker();
    this.maxRetries = 3;
    this.useMock = process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_RFC === 'true';
    this.destinationName = opts.destinationName
      || process.env.RFC_DEST_NAME
      || 'S4HANA_RFC_DS4';
    this.fmName         = opts.fmName         || process.env.RFC_FM_NAME       || 'ZTCC_GET_TRANSPORTS';
    this.startDate      = opts.startDate      || process.env.TR_START_DATE     || '20260101';
    this.systemsFilter  = opts.systemsFilter  ?? process.env.SAP_SYSTEMS       ?? '';
  }

  /**
   * Get all transports from SAP via Z_TCC_GET_TRANSPORTS.
   * Returns normalized transport array for the app.
   *
   * The SAP function module returns JSON: { transports: [...], importLog: [...] }
   * - transports: from E070/E07T (header + description + owner)
   * - importLog:  from TSTRFCOR (every import action per system + client)
   *
   * This method joins them: for each transport, derives currentSystem and
   * importRC from the latest import log entry.
   */
  async getTransports(startDate = null) {
    if (this.useMock) {
      return this._getMockTransports();
    }

    // FM + systems filter + start date come from AppConfig (via constructor) or env fallback.
    const raw = await this._callWithRetry(this.fmName, {
      IV_FROM_DATE: startDate || this.startDate,
      IV_SYSTEMS:   this.systemsFilter,
      IV_MAX_ROWS:  5000,
    });

    // Parse the JSON response from SAP
    let data;
    if (typeof raw === 'string') {
      data = JSON.parse(raw);          // EV_JSON_DATA returned as string
    } else if (raw.EV_JSON_DATA) {
      data = JSON.parse(raw.EV_JSON_DATA);
    } else if (raw.transports) {
      data = raw;                       // Already parsed
    } else {
      // Fallback: old-style flat array (backward compat)
      return this._normalizeFlatResponse(raw);
    }

    const transports = data.transports || [];
    const importLog = data.importLog || data.import_log || [];

    // Build a lookup: trkorr → latest import per system
    const importMap = this._buildImportMap(importLog);

    // Normalize each transport
    return transports.map(r => {
      const trkorr = r.trkorr || r.TRKORR || '';
      const imports = importMap[trkorr] || {};

      // Determine current system: the highest-environment system with a successful import
      const currentSystem = this._deriveCurrentSystem(imports, r.trstatus || r.TRSTATUS);

      // Latest import RC across all systems
      const latestImport = this._getLatestImport(imports);

      return {
        trNumber:      trkorr,
        description:   r.as4text    || r.AS4TEXT    || '',
        owner:         r.as4user    || r.AS4USER    || '',
        ownerName:     r.ownerName  || r.OWNER_NAME || r.owner_name || '',
        status:        this._resolveStatus(r.trstatus || r.TRSTATUS),
        trFunction:    r.trfunction || r.TRFUNCTION || 'K',
        currentSystem: currentSystem,
        importRC:      latestImport ? latestImport.trretcode : null,
        createdDate:   this._formatDate(r.as4date || r.AS4DATE),
        // Extended fields from TSTRFCOR
        importHistory: imports,        // { DS4: [{client,rc,date,time}], QS4: [...], PS4: [...] }
        firstImportDate: latestImport ? this._formatDate(latestImport.trexedate) : null,
      };
    });
  }

  /**
   * Build a map: trkorr → { SYSTEM: [{ client, rc, date, time }] }
   * from the TSTRFCOR import log entries.
   */
  _buildImportMap(importLog) {
    const map = {};
    for (const entry of importLog) {
      const tr = entry.trkorr || entry.TRKORR;
      const step = entry.trstep || entry.TRSTEP;
      if (!tr || step === 'E') continue; // Skip exports, keep only imports

      if (!map[tr]) map[tr] = {};
      const sys = entry.trsysnam || entry.TRSYSNAM || 'UNKNOWN';
      if (!map[tr][sys]) map[tr][sys] = [];

      map[tr][sys].push({
        client:  entry.trclient  || entry.TRCLIENT || '',
        rc:      Number(entry.trretcode ?? entry.TRRETCODE ?? -1),
        date:    entry.trexedate || entry.TREXEDATE || '',
        time:    entry.trexetime || entry.TREXETIME || '',
      });
    }
    return map;
  }

  /**
   * Determine current system based on import history.
   * Priority: PS4 (PRD) > QS4 (QAS) > DS4 (DEV).
   * Only counts successful imports (RC ≤ 4).
   */
  _deriveCurrentSystem(imports, trstatus) {
    // Check system hierarchy — customize these to match your landscape
    const systemHierarchy = (process.env.SAP_SYSTEM_HIERARCHY || 'PS4,QS4,DS4').split(',').map(s => s.trim());

    for (const sys of systemHierarchy) {
      const entries = imports[sys];
      if (entries && entries.some(e => e.rc <= 4)) {
        // Map system ID to display name
        return this._systemDisplayName(sys);
      }
    }

    // Fallback based on status
    if (trstatus === 'D' || trstatus === 'L') return 'DEV';
    if (trstatus === 'R' || trstatus === 'N') return 'QAS';
    return 'DEV';
  }

  /**
   * Map SAP system ID (DS4, QS4, PS4) to display name (DEV, QAS, PRD).
   * Configure via SAP_SYSTEM_MAP env var: "DS4=DEV,QS4=QAS,PS4=PRD"
   */
  _systemDisplayName(sysId) {
    if (!this._sysMap) {
      this._sysMap = {};
      const mapStr = process.env.SAP_SYSTEM_MAP || 'DS4=DEV,QS4=QAS,PS4=PRD';
      for (const pair of mapStr.split(',')) {
        const [k, v] = pair.split('=').map(s => s.trim());
        if (k && v) this._sysMap[k] = v;
      }
    }
    return this._sysMap[sysId] || sysId;
  }

  /** Get the latest import entry across all systems */
  _getLatestImport(imports) {
    let latest = null;
    for (const entries of Object.values(imports)) {
      for (const e of entries) {
        if (!latest || e.date > latest.trexedate || (e.date === latest.trexedate && e.time > latest.trexetime)) {
          latest = { trretcode: e.rc, trexedate: e.date, trexetime: e.time };
        }
      }
    }
    return latest;
  }

  /** Resolve SAP status code to readable text */
  _resolveStatus(code) {
    const map = { D: 'Modifiable', L: 'Modifiable', O: 'Release Started', R: 'Released', N: 'Released' };
    return map[code] || code || 'Released';
  }

  /** Format SAP date (YYYYMMDD) to ISO date (YYYY-MM-DD) */
  _formatDate(sapDate) {
    if (!sapDate || sapDate.length < 8) return null;
    const s = String(sapDate);
    return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
  }

  /** Backward compat: normalize old flat array response (no importLog) */
  _normalizeFlatResponse(raw) {
    const arr = Array.isArray(raw) ? raw : (raw.ET_TRANSPORTS || []);
    return arr.map(r => ({
      trNumber:     r.TRKORR    || r.trNumber    || r.trkorr    || '',
      description:  r.AS4TEXT   || r.description  || r.as4text   || '',
      owner:        r.AS4USER   || r.owner        || r.as4user   || '',
      ownerName:    r.OWNER_NAME || r.ownerName   || r.owner_name|| '',
      status:       this._resolveStatus(r.TRSTATUS || r.status || r.trstatus),
      trFunction:   r.TRFUNCTION|| r.trFunction   || r.trfunction|| 'K',
      currentSystem:r.SYSNAME   || r.currentSystem|| r.sysname   || 'DEV',
      importRC:     r.IMPORT_RC != null ? Number(r.IMPORT_RC) : (r.importRC ?? null),
      createdDate:  this._formatDate(r.AS4DATE || r.createdDate || r.as4date),
      importHistory: {},
      firstImportDate: null,
    }));
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
          await this._sleep(Math.pow(2, attempt - 1) * 1000);
        }
      }
    }

    this.circuitBreaker.recordFailure();
    throw new Error(`RFC ${functionName} failed after ${this.maxRetries} retries: ${lastError.message}`);
  }

  // ─── Internal: Execute actual RFC call via SAP Cloud SDK HTTP Client ───
  async _executeRFC(functionName, params) {
    let executeHttpRequest;
    try {
      ({ executeHttpRequest } = require('@sap-cloud-sdk/http-client'));
    } catch {
      throw new Error(
        'RFC production mode requires @sap-cloud-sdk/http-client. ' +
        'Run: npm install @sap-cloud-sdk/http-client @sap-cloud-sdk/connectivity. ' +
        'For development, set USE_MOCK_RFC=true in your .env file.'
      );
    }

    const destName = this.destinationName;
    const icfPath = `/sap/bc/srt/rfc/sap/${functionName.toLowerCase()}`;

    const response = await executeHttpRequest(
      { destinationName: destName },
      {
        method: 'POST',
        url: icfPath,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'sap-client': process.env.SAP_CLIENT || '100',
        },
        data: params,
        timeout: 25000,
      }
    );

    if (!response.data) {
      throw new Error(`RFC ${functionName} returned empty response`);
    }

    return response.data;
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
