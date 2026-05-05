/**
 * SAP AI Core Client — all AI features route through SAP Generative AI Hub
 * via the BTP Destination configured by SuperAdmin in Settings → SAP AI Core Integration.
 *
 * Configuration (stored in AppConfig, editable by Admin/SuperAdmin):
 *   AI_DESTINATION_NAME  — BTP Destination name (default: Ai_Core)
 *   AI_CORE_DEPLOYMENT_ID — Deployment ID from AI Core → ML Operations → Deployments
 *
 * The resource group and auth headers are configured in the BTP Destination itself
 * as URL.headers.AI-Resource-Group and URL.headers.Content-Type additional properties.
 * The Cloud SDK (executeHttpRequest) injects those headers automatically.
 *
 * Call flow (three strategies, tried in order):
 *   1. executeHttpRequest (Cloud SDK) — preferred on CF; OAuth handled automatically
 *   2. getDestination + manual fetch — fallback if Cloud SDK not available
 *   3. VCAP_SERVICES direct credentials — last resort
 */

class AIClient {
  constructor({ destName, deploymentId }) {
    this._aiDestName     = destName     || 'Ai_Core';
    this._aiDeploymentId = deploymentId || '';
    this.enabled         = true; // always enabled — auth is in the BTP Destination
    this.provider        = 'aicore';
  }

  /**
   * Factory — reads AI_DESTINATION_NAME and AI_CORE_DEPLOYMENT_ID from AppConfig.
   * Falls back to env vars if AppConfig rows not yet saved.
   */
  static async create(db, entities) {
    let destName     = process.env.AI_DESTINATION_NAME    || 'Ai_Core';
    let deploymentId = process.env.AI_CORE_DEPLOYMENT_ID  || '';

    if (db && entities?.AppConfig) {
      try {
        const [destCfg, deployCfg] = await Promise.all([
          SELECT.one.from(entities.AppConfig).where({ configKey: 'AI_DESTINATION_NAME' }),
          SELECT.one.from(entities.AppConfig).where({ configKey: 'AI_CORE_DEPLOYMENT_ID' }),
        ]);
        if (destCfg?.configValue)   destName     = destCfg.configValue;
        if (deployCfg?.configValue) deploymentId = deployCfg.configValue;
      } catch { /* AppConfig table may not exist yet in local dev */ }
    }

    console.log(`[AI] SAP AI Core → dest=${destName}, deployment=${deploymentId || '(not set)'}`);
    return new AIClient({ destName, deploymentId });
  }

  /**
   * Core call — routes through _callAICore with three auth strategies
   */
  async _call(systemPrompt, userMessage, maxTokens = 2000) {
    if (!this._aiDeploymentId) {
      throw new Error(
        'AI deployment ID not configured. Go to Settings → SAP AI Core Integration and set the Deployment ID.'
      );
    }
    return this._callAICore(systemPrompt, userMessage, maxTokens);
  }

  // ── SAP AI Core (Generative AI Hub) — OpenAI-compatible ──
  // Three strategies tried in order:
  //   1. executeHttpRequest (Cloud SDK — handles OAuth + destination headers automatically)
  //   2. getDestination + manual fetch (fallback)
  //   3. VCAP_SERVICES direct credentials (last resort)
  async _callAICore(systemPrompt, userMessage, maxTokens) {
    const destName     = this._aiDestName;
    const deploymentId = this._aiDeploymentId;
    const path         = `/v2/inference/deployments/${deploymentId}/chat/completions?api-version=2025-01-01-preview`;

    const body = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      max_completion_tokens: maxTokens,
    };

    // ── Strategy 1: Cloud SDK executeHttpRequest ──
    // Automatically resolves OAuth token and injects URL.headers.* from destination
    try {
      console.log(`[AI] Strategy 1: executeHttpRequest → dest=${destName}, path=${path}`);
      const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
      const response = await executeHttpRequest(
        { destinationName: destName },
        { method: 'POST', url: path, data: body, timeout: 60000 }
      );
      console.log('[AI] Strategy 1 succeeded');
      return response.data?.choices?.[0]?.message?.content || '';
    } catch (err1) {
      console.warn(`[AI] Strategy 1 failed: ${err1.message}`);

      // ── Strategy 2: getDestination + manual fetch ──
      try {
        console.log(`[AI] Strategy 2: getDestination → dest=${destName}`);
        const { getDestination } = require('@sap-cloud-sdk/connectivity');
        const dest = await getDestination({ destinationName: destName });
        const baseUrl = (dest?.url || '').replace(/\/+$/, '');

        console.log(`[AI] Destination: url=${baseUrl}, authType=${dest?.authentication}, hasTokens=${!!dest?.authTokens?.length}`);

        let token = dest?.authTokens?.[0]?.value || dest?.password || null;

        if (!token && dest?.originalProperties?.Authentication === 'OAuth2ClientCredentials') {
          const tokenUrl  = dest.originalProperties.tokenServiceURL;
          const clientId  = dest.originalProperties.clientId;
          const clientSecret = dest.originalProperties.clientSecret;
          if (tokenUrl && clientId) {
            const tokenRes = await fetch(tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
            });
            if (tokenRes.ok) {
              token = (await tokenRes.json()).access_token;
              console.log('[AI] OAuth token fetched from destination credentials');
            } else {
              console.warn(`[AI] OAuth token fetch failed: ${tokenRes.status}`);
            }
          }
        }

        if (!token) throw new Error('No auth token from destination');

        // Resource group: read from destination additional properties, fall back to 'default'
        const resourceGroup = dest?.originalProperties?.['URL.headers.AI-Resource-Group'] || 'default';

        const response = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'AI-Resource-Group': resourceGroup,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`${response.status}: ${errText.substring(0, 300)}`);
        }
        console.log('[AI] Strategy 2 succeeded');
        return (await response.json()).choices?.[0]?.message?.content || '';
      } catch (err2) {
        console.warn(`[AI] Strategy 2 failed: ${err2.message}`);

        // ── Strategy 3: VCAP_SERVICES direct credentials ──
        try {
          console.log('[AI] Strategy 3: VCAP_SERVICES direct credentials');
          const vcap         = JSON.parse(process.env.VCAP_SERVICES || '{}');
          const aiCoreBinding = vcap.aicore?.[0] || vcap['user-provided']?.find(s => s.name?.toLowerCase().includes('ai'));
          const destBinding   = vcap.destination?.[0];

          let token    = null;
          let baseUrl  = '';

          if (aiCoreBinding?.credentials) {
            const creds = aiCoreBinding.credentials;
            baseUrl = (creds.serviceurls?.AI_API_URL || '').replace(/\/+$/, '');
            const tokenRes = await fetch(`${creds.url}/oauth/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ grant_type: 'client_credentials', client_id: creds.clientid, client_secret: creds.clientsecret }).toString(),
            });
            if (tokenRes.ok) token = (await tokenRes.json()).access_token;
          } else if (destBinding?.credentials) {
            const dc = destBinding.credentials;
            const dtRes = await fetch(`${dc.url}/oauth/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ grant_type: 'client_credentials', client_id: dc.clientid, client_secret: dc.clientsecret }).toString(),
            });
            if (dtRes.ok) {
              const dtToken = (await dtRes.json()).access_token;
              const dlRes = await fetch(`${dc.uri}/destination-configuration/v1/destinations/${destName}`, {
                headers: { 'Authorization': `Bearer ${dtToken}` },
              });
              if (dlRes.ok) {
                const dlData = await dlRes.json();
                baseUrl = (dlData.destinationConfiguration?.URL || '').replace(/\/+$/, '');
                token   = dlData.authTokens?.[0]?.value;
              }
            }
          }

          if (!token) throw new Error('No credentials in VCAP_SERVICES');

          const response = await fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'AI-Resource-Group': 'default',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(60000),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${response.status}: ${errText.substring(0, 300)}`);
          }
          console.log('[AI] Strategy 3 succeeded');
          return (await response.json()).choices?.[0]?.message?.content || '';
        } catch (err3) {
          console.error('[AI] All 3 strategies failed.');
          console.error(`[AI]   Strategy 1: ${err1.message}`);
          console.error(`[AI]   Strategy 2: ${err2.message}`);
          console.error(`[AI]   Strategy 3: ${err3.message}`);
          throw new Error(
            `SAP AI Core connection failed. Verify destination "${destName}" in BTP Cockpit.\n` +
            `Ensure Client ID, Client Secret and Token Service URL match the AI Core service key.\n` +
            `Last error: ${err3.message}`
          );
        }
      }
    }
  }

  // ─── Public methods used by transport-service.js ───────────────────────────

  async chat(question, appContext) {
    const systemPrompt = `You are an AI assistant embedded in an SAP Project Management application.
You have access to the following live project data. Answer the user's question using ONLY this data.
Be concise, professional, and direct. Use bullet points for lists. If the data doesn't contain the answer, say so.

RULES:
- NEVER invent data — only use what's provided below
- Format numbers: use commas for thousands, round percentages to 1 decimal
- For RAG status: RED = critical risk, AMBER = needs attention, GREEN = on track
- When asked about "projects" consider all work items (Projects, Enhancements, Break-fixes, etc.)
- If asked to draft an email, write a professional email based on the project data

APP DATA:
${appContext}`;
    return this._call(systemPrompt, question, 3000);
  }

  async polishReport(rawReport) {
    if (!this.enabled) return rawReport;
    try {
      let result = await this._call(
        `You are a senior IT Program Manager writing a weekly status email to VP-level leadership.
Output ONLY valid Outlook-compatible HTML. No markdown. No code fences.

CRITICAL FORMAT RULES:
- Start directly with <div> or <p> tags
- Use inline CSS on every element (Outlook ignores <style> blocks)
- Use HTML <table> with borders for ALL tabular data
- Table: border-collapse:collapse; width:100%
- <th>: border:1px solid #ddd; padding:10px 12px; background-color:#1f4e79; color:white; font-weight:bold; text-align:left; font-size:13px
- <td>: border:1px solid #ddd; padding:8px 12px; text-align:left; font-size:13px
- Alternating rows: even rows background-color:#f2f7fb
- Use 🟢 🟡 🔴 for RAG status
- Font: Calibri, Arial, sans-serif throughout
- Keep ALL numbers EXACTLY as provided

EMAIL STRUCTURE:
1. "Hi All,"
2. Brief intro (1-2 sentences)
3. Project Overview Table: Name | SAP Owner | Business Owner | Go-Live | Status
4. Schedule & Milestones Table: Milestone | Area | Planned Date | Status | Owner | Comments
5. Current Week bullets
6. Next Week bullets
7. Risks & Issues (only if RED items exist)
8. "Please let us know if you have any questions."
9. "Best regards,\\nSAP Project Management Team"`,
        `Transform this raw project data into a polished Outlook HTML email. Keep every number accurate. Output ONLY HTML:\n\n${rawReport}`,
        3000
      );
      if (result.trimStart().startsWith('```')) {
        result = result.replace(/^[\s]*```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      return result;
    } catch (err) {
      console.warn(`AI polish failed: ${err.message}`);
      return rawReport;
    }
  }

  async analyzeTestData(projectName, testSummary, daysToGoLive, methodology) {
    if (!this.enabled) return null;
    try {
      return await this._call(
        `You are an SAP QA expert analyzing UAT test results. Provide a brief (3-5 bullet) risk assessment. Be direct and actionable. Do NOT invent data.`,
        `Project: ${projectName}
Methodology: ${methodology || 'Waterfall'}
Days to Go-Live: ${daysToGoLive || 'TBD'}
Test Summary:
  Total: ${testSummary.total}
  Passed: ${testSummary.passed} (${testSummary.total > 0 ? Math.round(testSummary.passed / testSummary.total * 100) : 0}%)
  Failed: ${testSummary.failed} (${testSummary.total > 0 ? Math.round(testSummary.failed / testSummary.total * 100) : 0}%)
  TBD: ${testSummary.tbd}
  Blocked: ${testSummary.blocked}
  Skipped: ${testSummary.skipped}`,
        800
      );
    } catch (err) {
      console.warn(`AI test analysis failed: ${err.message}`);
      return null;
    }
  }

  async testConnection() {
    const result = await this._call(
      'You are a helpful assistant.',
      'Reply with exactly one sentence confirming the connection works and which AI model you are.',
      100
    );
    return { success: true, message: result, provider: 'SAP AI Core' };
  }

  getProviderInfo() {
    return {
      provider: 'aicore',
      name: 'SAP AI Core (Generative AI Hub)',
      destName: this._aiDestName,
      deploymentId: this._aiDeploymentId,
      enabled: this.enabled,
    };
  }
}

module.exports = { AIClient };
