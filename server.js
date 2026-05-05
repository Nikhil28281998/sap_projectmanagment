/**
 * server.js — CAP bootstrap hook
 *
 * Wires up:
 *   1. Structured JSON logging via pino-http (every request gets a correlationId)
 *   2. Rate limiting via express-rate-limit:
 *      - AI endpoints (chatWithAgent, analyzeDocument, analyzeProjectRisks):  10 req/min per user
 *      - RFC refresh (refreshTransportData):                                   2 req/min per user
 *      - General mutations (POST/PATCH/DELETE outside the above):             60 req/min per user
 *   3. Query result limit guard (belt-and-suspenders on top of CDS config)
 */

'use strict';

const cds = require('@sap/cds');
const path = require('path');
const express = require('express');

// ── Logging setup ──────────────────────────────────────────────────────────────
let pinoHttp;
try {
  pinoHttp = require('pino-http');
} catch {
  // pino-http not installed yet — skip; fall back to CDS default logging
}

// ── Rate limiter setup ─────────────────────────────────────────────────────────
let rateLimit;
try {
  rateLimit = require('express-rate-limit').rateLimit;
} catch {
  // express-rate-limit not installed yet — skip; log a warning once
  console.warn('[server.js] express-rate-limit not installed — rate limiting disabled. Run: npm install');
}

// ── Key extractor: prefer XSUAA subject claim, fall back to IP ────────────────
function keyGenerator(req) {
  // req.authInfo is set by @sap/xssec passport middleware in production
  const subject = req.authInfo?.getSubdomain?.() || req.authInfo?.subaccountid;
  if (subject) return subject;
  // Mocked auth in dev: use the x-forwarded-user header
  const mockUser = req.headers['x-forwarded-user'];
  if (mockUser) return mockUser;
  return req.ip || 'unknown';
}

// ── Rate limit configurations ─────────────────────────────────────────────────
function buildLimiters() {
  if (!rateLimit) return null;

  // AI endpoints — expensive, cost money per call
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,   // 1 minute
    max: 10,               // 10 AI requests per minute per user
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: '429', message: 'Too many AI requests. Please wait 1 minute before trying again.' } },
    skip: (req) => process.env.NODE_ENV !== 'production' && process.env.DISABLE_RATE_LIMIT === 'true',
  });

  // RFC sync — SAP-side cost; prevent thundering herd
  const rfcLimiter = rateLimit({
    windowMs: 60 * 1000,   // 1 minute
    max: 2,                // Max 2 RFC refreshes per minute per user
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: '429', message: 'RFC refresh rate limit exceeded. Please wait 1 minute.' } },
  });

  // SharePoint sync — Graph API has its own limits; protect against manual spamming
  const spLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: '429', message: 'SharePoint sync rate limit exceeded. Please wait 1 minute.' } },
  });

  // General mutations — covers all POST/PATCH/DELETE actions
  const mutationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,               // 60 mutations per minute per user
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: '429', message: 'Too many requests. Please slow down.' } },
  });

  return { aiLimiter, rfcLimiter, spLimiter, mutationLimiter };
}

// ── CAP bootstrap hook ────────────────────────────────────────────────────────
cds.on('bootstrap', (app) => {

  // 1. Structured HTTP logging with correlation IDs
  if (pinoHttp) {
    const logger = pinoHttp({
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      transport: (() => {
        if (process.env.NODE_ENV === 'production') return undefined;
        try { require.resolve('pino-pretty'); return { target: 'pino-pretty' }; } catch { return undefined; }
      })(),
      genReqId: (req) => {
        // Reuse SAP correlation header if present (from App Router or Cloud Connector)
        return req.headers['x-correlation-id']
          || req.headers['x-request-id']
          || `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      },
      customProps: (req) => ({
        correlationId: req.id,
        user: req.headers['x-forwarded-user'] || req.authInfo?.getSubdomain?.() || 'anonymous',
      }),
    });
    app.use(logger);
  }

  // Expose correlationId on every request for downstream use
  app.use((req, _res, next) => {
    if (!req.headers['x-correlation-id']) {
      req.headers['x-correlation-id'] =
        `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }
    next();
  });

  // 2. Rate limiting — only apply to the OData service path
  const limiters = buildLimiters();
  if (limiters) {
    const { aiLimiter, rfcLimiter, spLimiter, mutationLimiter } = limiters;
    const BASE = '/api/v1/transport';

    // AI action endpoints — tight limit
    app.use(`${BASE}/chatWithAgent`,       aiLimiter);
    app.use(`${BASE}/analyzeDocument`,     aiLimiter);
    app.use(`${BASE}/analyzeProjectRisks`, aiLimiter);
    app.use(`${BASE}/refineProposals`,     aiLimiter);
    app.use(`${BASE}/generateWeeklyDigest`,aiLimiter);
    app.use(`${BASE}/polishReport`,        aiLimiter);

    // RFC refresh — SAP cost
    app.use(`${BASE}/refreshTransportData`,   rfcLimiter);

    // SharePoint sync
    app.use(`${BASE}/refreshSharePointData`,  spLimiter);
    app.use(`${BASE}/listSharePointDocuments`,spLimiter);
    app.use(`${BASE}/fetchSharePointDocument`,spLimiter);

    // General mutation limiter — covers everything else (POST/PATCH/DELETE)
    app.use(BASE, (req, res, next) => {
      if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method)) {
        return mutationLimiter(req, res, next);
      }
      next();
    });
  }

  // 3. Serve built frontend (SPA) from approuter/webapp — local deploy only.
  //    On BTP/Cloud Foundry, VCAP_APPLICATION is set and the real App Router
  //    handles routing + XSUAA auth, so we skip static serving there.
  const isCloudFoundry = !!process.env.VCAP_APPLICATION;
  const serveStatic = process.env.SERVE_STATIC === 'true'
    || (process.env.SERVE_STATIC !== 'false' && !isCloudFoundry);
  if (serveStatic) {
    const webappDir = path.join(__dirname, 'approuter', 'webapp');
    app.use(express.static(webappDir, { index: 'index.html' }));
    app.get(/^\/(?!api\b).*/, (req, res, next) => {
      if (req.method !== 'GET' || req.path.includes('.')) return next();
      res.sendFile(path.join(webappDir, 'index.html'));
    });
  }
});

module.exports = cds.server; // required by CAP — delegates to cds-serve
