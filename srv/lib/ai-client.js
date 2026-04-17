/**
 * Unified AI Client — Supports Claude, ChatGPT, Gemini, and OpenRouter
 * 
 * BTP Deployment: AI providers are configured as BTP Destinations.
 *   - The backend uses @sap-cloud-sdk/connectivity to resolve destinations
 *   - API keys live in the BTP Destination (never exposed to the frontend)
 *   - Fallback: encrypted keys in AppConfig DB table (AES-256-GCM)
 *   - Fallback: env vars for local development
 * 
 * Users connect their account in Settings → AI Integration:
 *   - Choose provider: Claude, ChatGPT, Gemini, or OpenRouter
 *   - Enter API key from the provider's console (stored encrypted on backend)
 *   - OpenRouter: FREE models via openrouter.ai — no credit card needed
 *   - Enterprise orgs: admin provisions BTP Destinations billed to the org
 */

const { decrypt } = require('./crypto-utils');

// ── BTP Destination names (configured in BTP cockpit) ──
// If AI_DESTINATION_NAME env var is set (e.g., "Ai_Core"), ALL AI providers
// route through that single destination. Otherwise, use per-provider destinations.
const AI_DEST_OVERRIDE = process.env.AI_DESTINATION_NAME || null;

const DESTINATION_NAMES = {
  claude:     AI_DEST_OVERRIDE || 'SAP_PM_AI_CLAUDE',
  chatgpt:    AI_DEST_OVERRIDE || 'SAP_PM_AI_OPENAI',
  gemini:     AI_DEST_OVERRIDE || 'SAP_PM_AI_GEMINI',
  openrouter: AI_DEST_OVERRIDE || 'SAP_PM_AI_OPENROUTER',
  rfc:        'SAP_PM_RFC_S4HANA',
  sharepoint: 'SAP_PM_SHAREPOINT',
};

const PROVIDERS = {
  claude: {
    name: 'Claude (Anthropic)',
    defaultModel: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    keyPrefix: 'sk-ant-',
    configKey: 'CLAUDE_API_KEY',
  },
  chatgpt: {
    name: 'ChatGPT (OpenAI)',
    defaultModel: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    keyPrefix: 'sk-',
    configKey: 'OPENAI_API_KEY',
  },
  gemini: {
    name: 'Gemini (Google)',
    defaultModel: 'gemini-1.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    keyPrefix: 'AIza',
    configKey: 'GEMINI_API_KEY',
  },
  openrouter: {
    name: 'OpenRouter (Free)',
    defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    keyPrefix: 'sk-or-',
    configKey: 'OPENROUTER_API_KEY',
  }
};

class AIClient {
  constructor({ provider, apiKey, model }) {
    this.provider = provider || 'claude';
    this.apiKey = apiKey;
    this.providerConfig = PROVIDERS[this.provider] || PROVIDERS.claude;
    this.model = model || this.providerConfig.defaultModel;
    this.enabled = !!this.apiKey;
  }

  /**
   * Factory — loads provider + API key from:
   *   1. BTP Destination service (production)
   *   2. AppConfig DB table (encrypted)
   *   3. Environment variables (dev fallback)
   */
  static async create(db, entities) {
    // Check which provider is configured
    let provider = 'claude';
    let apiKey = null;
    let destUrl = null;

    if (db && entities?.AppConfig) {
      try {
        // Read provider preference
        const providerConfig = await SELECT.one.from(entities.AppConfig)
          .where({ configKey: 'AI_PROVIDER' });
        if (providerConfig?.configValue) {
          provider = providerConfig.configValue;
        }

        // ── Strategy 1: Try BTP Destination (production) ──
        if (process.env.NODE_ENV === 'production' || process.env.VCAP_SERVICES) {
          try {
            const destResult = await AIClient._resolveDestination(provider);
            if (destResult) {
              apiKey = destResult.apiKey;
              destUrl = destResult.url;
              console.log(`[AI] Using BTP Destination "${DESTINATION_NAMES[provider]}" for ${provider}`);
            }
          } catch (destErr) {
            console.warn(`[AI] BTP Destination not found for ${provider}: ${destErr.message}. Falling back to AppConfig.`);
          }
        }

        // ── Strategy 2: AppConfig encrypted key ──
        if (!apiKey) {
          const keyConfigName = PROVIDERS[provider]?.configKey || 'CLAUDE_API_KEY';
          const keyConfig = await SELECT.one.from(entities.AppConfig)
            .where({ configKey: keyConfigName });
          if (keyConfig?.configValue && !keyConfig.configValue.startsWith('YOUR_')) {
            apiKey = decrypt(keyConfig.configValue);
          }
        }
      } catch { /* table may not exist yet */ }
    }

    // ── Strategy 3: Fallback to env vars ──
    if (!apiKey) {
      if (provider === 'chatgpt') {
        apiKey = process.env.OPENAI_API_KEY;
      } else if (provider === 'gemini') {
        apiKey = process.env.GEMINI_API_KEY;
      } else if (provider === 'openrouter') {
        apiKey = process.env.OPENROUTER_API_KEY;
      } else {
        apiKey = process.env.CLAUDE_API_KEY;
      }
    }

    const client = new AIClient({ provider, apiKey });
    if (destUrl) {
      client._destUrl = destUrl;
      // SAP AI Core: auth comes from the destination, not from an API key
      // Mark as enabled even without explicit apiKey
      if (destUrl.includes('/v2/inference')) {
        client.enabled = true;
        console.log(`[AI] SAP AI Core destination resolved → ${destUrl}`);
      } else if (AI_DEST_OVERRIDE) {
        console.log(`[AI] Using unified destination "${AI_DEST_OVERRIDE}" → ${destUrl}`);
      }
    }
    return client;
  }

  /**
   * Resolve API key from BTP Destination service
   * Destinations are configured in BTP cockpit with the API key as password
   */
  static async _resolveDestination(provider) {
    const destName = DESTINATION_NAMES[provider];
    if (!destName) return null;

    try {
      // Try @sap-cloud-sdk/connectivity (preferred for BTP)
      const { getDestination } = require('@sap-cloud-sdk/connectivity');
      const dest = await getDestination({ destinationName: destName });
      if (dest) {
        return {
          url: dest.url || null,
          apiKey: dest.password || dest.authTokens?.[0]?.value || null,
        };
      }
    } catch {
      // SDK not available — try VCAP_SERVICES directly
      try {
        const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
        const destService = vcap.destination?.[0];
        if (destService) {
          // Use destination service REST API
          const destServiceUrl = destService.credentials.uri;
          const token = await AIClient._getDestServiceToken(destService.credentials);
          const res = await fetch(`${destServiceUrl}/destination-configuration/v1/destinations/${destName}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const destConfig = await res.json();
            return {
              url: destConfig.destinationConfiguration?.URL || null,
              apiKey: destConfig.destinationConfiguration?.Password
                || destConfig.authTokens?.[0]?.value || null,
            };
          }
        }
      } catch (vcapErr) {
        console.warn(`[AI] VCAP destination lookup failed: ${vcapErr.message}`);
      }
    }
    return null;
  }

  /**
   * Get OAuth token for the BTP Destination service instance
   */
  static async _getDestServiceToken(credentials) {
    const tokenUrl = `${credentials.url}/oauth/token`;
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientid,
        client_secret: credentials.clientsecret,
      }).toString(),
    });
    if (!res.ok) throw new Error(`Destination token request failed: ${res.status}`);
    const data = await res.json();
    return data.access_token;
  }

  /**
   * Send message to the configured AI provider
   */
  async _call(systemPrompt, userMessage, maxTokens = 2000) {
    if (!this.enabled) {
      throw new Error(
        'AI not configured. Go to Settings → AI Integration and add your API key.'
      );
    }

    // SAP AI Core: destination URL contains /v2/inference — use OpenAI-compatible format
    // with deployment ID appended. Model is managed by AI Core, not by us.
    if (this._destUrl && this._destUrl.includes('/v2/inference')) {
      return this._callAICore(systemPrompt, userMessage, maxTokens);
    }

    if (this.provider === 'chatgpt') {
      return this._callOpenAI(systemPrompt, userMessage, maxTokens);
    }
    if (this.provider === 'gemini') {
      return this._callGemini(systemPrompt, userMessage, maxTokens);
    }
    if (this.provider === 'openrouter') {
      return this._callOpenRouter(systemPrompt, userMessage, maxTokens);
    }
    return this._callClaude(systemPrompt, userMessage, maxTokens);
  }

  // ── SAP AI Core (Generative AI Hub) — OpenAI-compatible ──
  // Three strategies to handle auth, tried in order:
  //   1. executeHttpRequest (Cloud SDK — handles OAuth automatically)
  //   2. getDestination + manual fetch with token
  //   3. Direct fetch with VCAP_SERVICES credentials
  async _callAICore(systemPrompt, userMessage, maxTokens) {
    const deploymentId = process.env.AI_CORE_DEPLOYMENT_ID || 'd8e31dc8207d4ea9';
    const destName = AI_DEST_OVERRIDE || 'Ai_Core';
    const resourceGroup = process.env.AI_CORE_RESOURCE_GROUP || 'default';
    const baseUrl = this._destUrl.replace(/\/+$/, '');
    const fullUrl = `${baseUrl}/deployments/${deploymentId}/chat/completions`;

    const body = JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: maxTokens,
    });

    // ── Strategy 1: Cloud SDK executeHttpRequest ──
    try {
      console.log(`[AI] Strategy 1: executeHttpRequest → dest=${destName}`);
      const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
      const response = await executeHttpRequest(
        { destinationName: destName },
        {
          method: 'POST',
          url: `/deployments/${deploymentId}/chat/completions`,
          headers: {
            'Content-Type': 'application/json',
            'AI-Resource-Group': resourceGroup,
          },
          data: JSON.parse(body),
          timeout: 60000,
        }
      );
      console.log(`[AI] Strategy 1 succeeded`);
      return response.data?.choices?.[0]?.message?.content || '';
    } catch (err1) {
      console.warn(`[AI] Strategy 1 failed: ${err1.message}`);

      // ── Strategy 2: getDestination + manual fetch ──
      try {
        console.log(`[AI] Strategy 2: getDestination + fetch → ${fullUrl}`);
        const { getDestination } = require('@sap-cloud-sdk/connectivity');
        const dest = await getDestination({ destinationName: destName });

        // Log destination details for debugging (no secrets)
        console.log(`[AI] Destination resolved: url=${dest?.url}, authType=${dest?.authentication}, hasTokens=${!!dest?.authTokens?.length}, hasPassword=${!!dest?.password}`);

        let token = dest?.authTokens?.[0]?.value || dest?.password || null;

        // If no token from destination, try to get one from XSUAA bound to the destination
        if (!token && dest?.originalProperties?.Authentication === 'OAuth2ClientCredentials') {
          console.log(`[AI] Fetching OAuth token from destination credentials...`);
          const tokenUrl = dest.originalProperties.tokenServiceURL || dest.originalProperties.URL?.replace(/\/v2.*/, '/oauth/token');
          if (tokenUrl && dest.originalProperties.clientId) {
            const tokenRes = await fetch(tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: dest.originalProperties.clientId,
                client_secret: dest.originalProperties.clientSecret,
              }).toString(),
            });
            if (tokenRes.ok) {
              const tokenData = await tokenRes.json();
              token = tokenData.access_token;
              console.log(`[AI] OAuth token obtained (${token.substring(0, 20)}...)`);
            } else {
              console.warn(`[AI] OAuth token fetch failed: ${tokenRes.status}`);
            }
          }
        }

        if (!token) {
          throw new Error('No auth token available from destination');
        }

        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'AI-Resource-Group': resourceGroup,
          },
          body,
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`${response.status}: ${errText.substring(0, 300)}`);
        }

        const data = await response.json();
        console.log(`[AI] Strategy 2 succeeded`);
        return data.choices?.[0]?.message?.content || '';
      } catch (err2) {
        console.warn(`[AI] Strategy 2 failed: ${err2.message}`);

        // ── Strategy 3: VCAP_SERVICES direct credentials ──
        try {
          console.log(`[AI] Strategy 3: VCAP_SERVICES direct credentials`);
          const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');

          // Find AI Core service binding (could be under 'aicore' or 'user-provided')
          const aiCoreBinding = vcap.aicore?.[0] || vcap['user-provided']?.find(s => s.name?.toLowerCase().includes('ai'));
          const destBinding = vcap.destination?.[0];

          let token = null;

          if (aiCoreBinding?.credentials) {
            // Direct AI Core service binding
            const creds = aiCoreBinding.credentials;
            console.log(`[AI] Found AI Core binding: ${creds.serviceurls?.AI_API_URL || 'no url'}`);
            const tokenRes = await fetch(`${creds.url}/oauth/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: creds.clientid,
                client_secret: creds.clientsecret,
              }).toString(),
            });
            if (tokenRes.ok) {
              token = (await tokenRes.json()).access_token;
            }
          } else if (destBinding?.credentials) {
            // Get token via destination service REST API
            const destCreds = destBinding.credentials;
            const destTokenRes = await fetch(`${destCreds.url}/oauth/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: destCreds.clientid,
                client_secret: destCreds.clientsecret,
              }).toString(),
            });
            if (destTokenRes.ok) {
              const destToken = (await destTokenRes.json()).access_token;
              // Use destination service to get the actual AI Core destination + token
              const destLookup = await fetch(
                `${destCreds.uri}/destination-configuration/v1/destinations/${destName}`,
                { headers: { 'Authorization': `Bearer ${destToken}` } }
              );
              if (destLookup.ok) {
                const destConfig = await destLookup.json();
                token = destConfig.authTokens?.[0]?.value;
                console.log(`[AI] Got token from destination service lookup`);
              }
            }
          }

          if (!token) {
            throw new Error('No credentials available in VCAP_SERVICES');
          }

          const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'AI-Resource-Group': resourceGroup,
            },
            body,
            signal: AbortSignal.timeout(60000),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${response.status}: ${errText.substring(0, 300)}`);
          }

          const data = await response.json();
          console.log(`[AI] Strategy 3 succeeded`);
          return data.choices?.[0]?.message?.content || '';
        } catch (err3) {
          console.error(`[AI] All 3 strategies failed.`);
          console.error(`[AI]   Strategy 1: ${err1.message}`);
          console.error(`[AI]   Strategy 2: ${err2.message}`);
          console.error(`[AI]   Strategy 3: ${err3.message}`);
          throw new Error(
            `SAP AI Core connection failed. Check destination "${destName}" configuration.\n` +
            `Last error: ${err3.message}`
          );
        }
      }
    }
  }

  // ── Claude (Anthropic) ──
  async _callClaude(systemPrompt, userMessage, maxTokens) {
    const url = this._destUrl
      ? `${this._destUrl.replace(/\/+$/, '')}/v1/messages`
      : this.providerConfig.baseUrl;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        })
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Claude API timed out after 30s');
      throw err;
    } finally { clearTimeout(timeout); }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  // ── Gemini (Google) — FREE tier: 15 RPM, 1M tokens/day ──
  async _callGemini(systemPrompt, userMessage, maxTokens) {
    const baseUrl = this._destUrl
      ? `${this._destUrl.replace(/\/+$/, '')}/v1beta/models`
      : this.providerConfig.baseUrl;
    const url = `${baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: maxTokens }
    });

    // Retry once on 429 (rate limit) after a short wait
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body
        });
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') throw new Error('Gemini API timed out after 30s');
        throw err;
      } finally { clearTimeout(timeout); }

      if (response.status === 429 && attempt === 0) {
        console.warn('Gemini rate limit hit, retrying in 5s...');
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      if (!response.ok) {
        const err = await response.text();
        // Extract the user-friendly message from Google's error
        try {
          const errObj = JSON.parse(err);
          const msg = errObj?.error?.message || err;
          throw new Error(`Gemini API ${response.status}: ${msg.substring(0, 200)}`);
        } catch (parseErr) {
          if (parseErr.message.startsWith('Gemini API')) throw parseErr;
          throw new Error(`Gemini API ${response.status}: ${err.substring(0, 200)}`);
        }
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    throw new Error('Gemini API: rate limited after retry. Try again in a minute.');
  }

  // ── OpenRouter (FREE models) — OpenAI-compatible API ──
  async _callOpenRouter(systemPrompt, userMessage, maxTokens) {
    const url = this._destUrl
      ? `${this._destUrl.replace(/\/+$/, '')}/v1/chat/completions`
      : this.providerConfig.baseUrl;
    // Free models may route to reasoning models that need more tokens
    const effectiveMaxTokens = Math.max(maxTokens, 4000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://sap-project-mgmt.local',
          'X-Title': 'SAP Project Management'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: effectiveMaxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        })
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('OpenRouter API timed out after 30s');
      throw err;
    } finally { clearTimeout(timeout); }

    if (!response.ok) {
      const err = await response.text();
      try {
        const errObj = JSON.parse(err);
        const msg = errObj?.error?.message || err;
        throw new Error(`OpenRouter API ${response.status}: ${msg.substring(0, 200)}`);
      } catch (parseErr) {
        if (parseErr.message.startsWith('OpenRouter API')) throw parseErr;
        throw new Error(`OpenRouter API ${response.status}: ${err.substring(0, 200)}`);
      }
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    // Some free models are reasoning models where content is null
    // but the actual response is in the reasoning field
    const content = choice?.message?.content;
    if (content) return content;
    // Fallback: extract from reasoning if content is null
    const reasoning = choice?.message?.reasoning;
    if (reasoning) return reasoning;
    return '';
  }

  // ── ChatGPT (OpenAI) ──
  async _callOpenAI(systemPrompt, userMessage, maxTokens) {
    const url = this._destUrl
      ? `${this._destUrl.replace(/\/+$/, '')}/v1/chat/completions`
      : this.providerConfig.baseUrl;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        })
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('OpenAI API timed out after 30s');
      throw err;
    } finally { clearTimeout(timeout); }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // ───────────────────────────────────────────────
  // Agent: Chat with project data
  // ───────────────────────────────────────────────

  /**
   * The AI agent — receives user question + all app context,
   * returns a helpful answer using the connected AI provider.
   */
  async chat(question, appContext) {
    const systemPrompt = `You are an AI assistant embedded in an SAP Project Management application.
You have access to the following live project data. Answer the user's question using ONLY this data.
Be concise, professional, and direct. Use bullet points for lists. If the data doesn't contain the answer, say so.

RULES:
- NEVER invent data — only use what's provided below
- Format numbers: use commas for thousands, round percentages to 1 decimal
- For RAG status: RED = critical risk, AMBER = needs attention, GREEN = on track
- When asked about "projects" you should consider all work items (Projects, Enhancements, Break-fixes, etc.)
- If asked to draft an email, write a professional email based on the project data

APP DATA:
${appContext}`;

    return this._call(systemPrompt, question, 3000);
  }

  /**
   * Polish a weekly report into a professional Outlook-ready HTML email
   */
  async polishReport(rawReport) {
    if (!this.enabled) {
      return rawReport;
    }

    try {
      let result = await this._call(
        `You are a senior IT Program Manager writing a weekly status email to VP-level leadership.
You MUST output valid Outlook-compatible HTML that can be pasted directly into Outlook. 

CRITICAL FORMAT RULES:
- Output ONLY HTML — NO markdown, NO code fences, NO \`\`\`html blocks
- Start directly with <div> or <p> tags
- Use inline CSS styles on every element (Outlook ignores <style> blocks)
- Use HTML <table> with borders for ALL tabular data — this is essential
- Table styling: border-collapse:collapse; width:100% on <table>
- Cell styling: border:1px solid #ddd; padding:8px 12px; text-align:left; font-size:13px on every <td> and <th>
- Header row: background-color:#1f4e79; color:white; font-weight:bold; padding:10px 12px
- Alternating row colors: even rows background-color:#f2f7fb
- Use 🟢 🟡 🔴 emoji for RAG status (these render in Outlook)
- Use <span style="color:green">●</span> as backup for RAG if needed
- Font: Calibri, Arial, sans-serif throughout (Outlook default)
- Keep ALL numbers and data points EXACTLY as provided — NEVER invent or change data

EMAIL STRUCTURE (follow this exact order):
1. Greeting: "Hi All," 
2. Brief intro paragraph (1-2 sentences about the week's status)
3. **Project Overview Table**: Project Name | SAP Owner | Business Owner | Go-Live Target | Overall Status
4. **Schedule & Key Milestones Table**: Milestone | SAP Area | Planned Date | Status | Owner | Comments
5. **Current Week** section: bullet points of what happened this week
6. **Next Week** section: bullet points of what's planned next week
7. **Risks & Issues** section: only if there are RED items or alerts (use a table if multiple)
8. Closing: "Please let us know if you have any questions or more information is required."
9. Sign-off: "Best regards,<br>SAP Project Management Team"

IMPORTANT:
- Every table MUST use <table style="border-collapse:collapse; width:100%; font-family:Calibri,Arial,sans-serif; margin:16px 0">
- Every <th> MUST have style="border:1px solid #ddd; padding:10px 12px; background-color:#1f4e79; color:white; font-weight:bold; text-align:left; font-size:13px"
- Every <td> MUST have style="border:1px solid #ddd; padding:8px 12px; text-align:left; font-size:13px"
- Section headers use <h3 style="color:#1f4e79; font-family:Calibri,Arial,sans-serif; margin:20px 0 8px 0">
- Paragraphs use <p style="font-family:Calibri,Arial,sans-serif; font-size:14px; line-height:1.6; color:#333">
- Bullet lists use <ul style="font-family:Calibri,Arial,sans-serif; font-size:14px; color:#333">`,
        `Transform this raw project data into a polished Outlook HTML email. Keep every number accurate. Output ONLY HTML, no markdown:\n\n${rawReport}`,
        6000
      );
      // Strip markdown code fences if AI wraps output in ```html ... ```
      if (result.trimStart().startsWith('```')) {
        result = result.replace(/^[\s]*```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      return result;
    } catch (err) {
      console.warn(`AI polish failed: ${err.message}`);
      return rawReport;
    }
  }

  /**
   * Analyze test results and provide risk insights
   */
  async analyzeTestData(projectName, testSummary, daysToGoLive, methodology) {
    if (!this.enabled) return null;

    try {
      return await this._call(
        `You are an SAP Quality Assurance expert analyzing UAT test results.
Provide a brief (3-5 bullet) risk assessment. Be direct and actionable.
Do NOT invent data. Only analyze what's given.`,
        `Project: ${projectName}
Methodology: ${methodology || 'Waterfall'}
Days to Go-Live: ${daysToGoLive || 'TBD'}
Test Summary:
  Total: ${testSummary.total}
  Passed: ${testSummary.passed} (${testSummary.total > 0 ? Math.round(testSummary.passed / testSummary.total * 100) : 0}%)
  Failed: ${testSummary.failed} (${testSummary.total > 0 ? Math.round(testSummary.failed / testSummary.total * 100) : 0}%)
  TBD: ${testSummary.tbd}
  Blocked: ${testSummary.blocked}
  Skipped: ${testSummary.skipped}

Provide: risk level, key concerns, recommended actions.`,
        800
      );
    } catch (err) {
      console.warn(`AI test analysis failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Test the API connection
   */
  async testConnection() {
    const result = await this._call(
      'You are a helpful assistant.',
      'Reply with exactly one short sentence confirming the connection works and state which AI model you are.',
      100
    );
    return { success: true, message: result, provider: this.provider };
  }

  /**
   * Get provider info
   */
  getProviderInfo() {
    return {
      provider: this.provider,
      name: this.providerConfig.name,
      model: this.model,
      enabled: this.enabled
    };
  }
}

module.exports = { AIClient, PROVIDERS, DESTINATION_NAMES };
