/**
 * Unified AI Client — Supports Claude, ChatGPT, Gemini, and OpenRouter
 * 
 * Users connect their account in Settings → AI Integration:
 *   - Choose provider: Claude, ChatGPT, Gemini, or OpenRouter
 *   - Enter API key from the provider's console
 *   - OpenRouter: FREE models via openrouter.ai — no credit card needed
 *   - Enterprise orgs: admin provisions keys billed to the org
 * 
 * API keys are stored encrypted (AES-256-GCM) and decrypted on read.
 */

const { decrypt } = require('./crypto-utils');

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
    defaultModel: 'openrouter/free',
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
   * Factory — loads provider + API key from AppConfig or env
   */
  static async create(db, entities) {
    // Check which provider is configured
    let provider = 'claude';
    let apiKey = null;

    if (db && entities?.AppConfig) {
      try {
        // Read provider preference
        const providerConfig = await SELECT.one.from(entities.AppConfig)
          .where({ configKey: 'AI_PROVIDER' });
        if (providerConfig?.configValue) {
          provider = providerConfig.configValue;
        }

        // Read the API key for the chosen provider
        const keyConfigName = PROVIDERS[provider]?.configKey || 'CLAUDE_API_KEY';
        const keyConfig = await SELECT.one.from(entities.AppConfig)
          .where({ configKey: keyConfigName });
        if (keyConfig?.configValue && !keyConfig.configValue.startsWith('YOUR_')) {
          // Decrypt if encrypted (enc: prefix), pass-through if plain
          apiKey = decrypt(keyConfig.configValue);
        }
      } catch { /* table may not exist yet */ }
    }

    // Fallback to env vars
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

    return new AIClient({ provider, apiKey });
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

  // ── Claude (Anthropic) ──
  async _callClaude(systemPrompt, userMessage, maxTokens) {
    const response = await fetch(this.providerConfig.baseUrl, {
      method: 'POST',
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

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  // ── Gemini (Google) — FREE tier: 15 RPM, 1M tokens/day ──
  async _callGemini(systemPrompt, userMessage, maxTokens) {
    const url = `${this.providerConfig.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: maxTokens }
    });

    // Retry once on 429 (rate limit) after a short wait
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });

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
    // Free models may route to reasoning models that need more tokens
    const effectiveMaxTokens = Math.max(maxTokens, 4000);
    const response = await fetch(this.providerConfig.baseUrl, {
      method: 'POST',
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
    const response = await fetch(this.providerConfig.baseUrl, {
      method: 'POST',
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

module.exports = { AIClient, PROVIDERS };
