/**
 * Unified AI Client — Supports Claude (Anthropic) AND ChatGPT (OpenAI)
 * 
 * Users connect their account in Settings → AI Integration:
 *   - Choose provider: Claude or ChatGPT
 *   - Enter API key from console.anthropic.com or platform.openai.com
 *   - Enterprise orgs: admin provisions keys billed to the org
 * 
 * The AI Agent uses whichever provider is configured to:
 *   1. Answer questions about project data (chat agent)
 *   2. Polish weekly reports into executive emails
 *   3. Analyze test results for risk insights
 */

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
    defaultModel: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    keyPrefix: 'AIza',
    configKey: 'GEMINI_API_KEY',
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
          apiKey = keyConfig.configValue;
        }
      } catch { /* table may not exist yet */ }
    }

    // Fallback to env vars
    if (!apiKey) {
      if (provider === 'chatgpt') {
        apiKey = process.env.OPENAI_API_KEY;
      } else if (provider === 'gemini') {
        apiKey = process.env.GEMINI_API_KEY;
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: maxTokens }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
   * Polish a weekly report into a professional executive email
   */
  async polishReport(rawReport) {
    if (!this.enabled) {
      return rawReport;
    }

    try {
      return await this._call(
        `You are a senior IT Program Manager writing a weekly status email to VP-level leadership.
RULES:
- Keep ALL numbers and data points EXACTLY as provided — NEVER invent or change data
- Professional tone, concise, executive-friendly
- Structure: Subject line → Executive Summary (2-3 sentences) → Project Status Table → Key Risks → Action Items → Next Steps
- Use clean formatting with bullet points and bold for emphasis
- Flag RED items prominently with clear risk statements
- Include a brief go-live countdown for upcoming deployments
- End with "Regards," signature block`,
        `Transform this raw project data into a polished executive status email. Keep every number accurate:\n\n${rawReport}`,
        4000
      );
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
