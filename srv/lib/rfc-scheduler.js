'use strict';

/**
 * RFC auto-refresh scheduler.
 *
 * Reads cron expression + enabled flag + other RFC settings from AppConfig
 * and schedules a recurring call to the bound `_onRefreshTransportData`
 * handler via node-cron. Re-reads AppConfig on every save so the admin can
 * change schedule/destination/FM without restarting the server.
 */

const cron = require('node-cron');

let currentJob = null;
let currentExpression = null;

/**
 * Start or reconfigure the scheduler based on AppConfig values.
 *
 * @param {object} deps
 * @param {function} deps.readConfig - async () => { enabled:boolean, cron:string }
 * @param {function} deps.runRefresh - async () => void   // invokes the same refresh flow as the header button
 * @param {object}   [deps.logger]   - { info, warn, error } (defaults to console)
 */
async function configureRfcScheduler({ readConfig, runRefresh, logger = console }) {
  try {
    const { enabled, cron: expr } = await readConfig();

    // Stop any existing job first
    if (currentJob) {
      currentJob.stop();
      currentJob = null;
      currentExpression = null;
    }

    if (!enabled) {
      logger.info('[rfc-scheduler] disabled — no auto-refresh will run');
      return { scheduled: false, reason: 'disabled' };
    }

    if (!expr) {
      logger.warn('[rfc-scheduler] enabled but no cron expression set — skipping');
      return { scheduled: false, reason: 'no expression' };
    }

    if (!cron.validate(expr)) {
      logger.error(`[rfc-scheduler] invalid cron expression: "${expr}"`);
      return { scheduled: false, reason: 'invalid expression' };
    }

    currentJob = cron.schedule(expr, async () => {
      logger.info(`[rfc-scheduler] tick — running scheduled RFC refresh (${expr})`);
      try {
        await runRefresh();
      } catch (err) {
        logger.error('[rfc-scheduler] refresh failed:', err.message || err);
      }
    });
    currentExpression = expr;
    logger.info(`[rfc-scheduler] scheduled with "${expr}"`);
    return { scheduled: true, cron: expr };
  } catch (err) {
    logger.error('[rfc-scheduler] configuration failed:', err.message || err);
    return { scheduled: false, reason: err.message };
  }
}

function getScheduleStatus() {
  return {
    running: !!currentJob,
    cron: currentExpression,
  };
}

module.exports = { configureRfcScheduler, getScheduleStatus };
