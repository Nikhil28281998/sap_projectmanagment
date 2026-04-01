/**
 * Claude AI Agent — Enterprise-grade AI integration
 * 
 * How auth works:
 *   Option A: API Key — Set CLAUDE_API_KEY env var or store in AppConfig
 *             Anthropic API keys are separate from Claude.ai enterprise login.
 *             Your IT admin can create one at console.anthropic.com.
 *   Option B: Enterprise SSO — If your org has Anthropic enterprise contract,
 *             the admin provisions API access that bills to the org account.
 * 
 * Both options use the same Anthropic Messages API. The only difference is
 * who gets billed — personal vs. enterprise account.
 * 
 * Current uses:
 *   1. polishReport()      — Takes raw weekly report → professional email
 *   2. analyzeTestData()   — Reads test summary → risk insights
 *   3. testConnection()    — Verify API key works
 */

class ClaudeClient {
  constructor(apiKeyOverride) {
    this.apiKey = apiKeyOverride || process.env.CLAUDE_API_KEY;
    this.model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    this.baseUrl = process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com/v1/messages';
    this.enabled = !!this.apiKey;
  }

  /**
   * Load API key from AppConfig if not in env
   */
  static async create(db, entities) {
    let apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey && db && entities?.AppConfig) {
      try {
        const config = await SELECT.one.from(entities.AppConfig).where({ configKey: 'CLAUDE_API_KEY' });
        if (config?.configValue && config.configValue !== 'YOUR_API_KEY_HERE') {
          apiKey = config.configValue;
        }
      } catch { /* no config table yet */ }
    }
    return new ClaudeClient(apiKey);
  }

  /**
   * Send a message to Claude API
   */
  async _call(systemPrompt, userMessage, maxTokens = 2000) {
    if (!this.enabled) {
      throw new Error('AI not configured. Add your Anthropic API key in Settings > AI Integration.');
    }

    const response = await fetch(this.baseUrl, {
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

  /**
   * Polish a weekly report into a professional executive email
   */
  async polishReport(rawReport) {
    if (!this.enabled) {
      return rawReport + '\n\n---\n_AI polish disabled. Add API key in Settings > AI Integration._';
    }

    try {
      return await this._call(
        `You are a senior IT Program Manager composing a weekly status email to VP-level leadership.
Rules:
- Keep all numbers and data points EXACTLY as provided — do NOT invent data
- Professional tone, concise, executive-friendly
- Use bullet points for key items
- Start with a 2-sentence executive summary
- Include "Key Risks" section if any RED/AMBER items exist
- End with "Next Steps" section
- Format as a professional email (Subject line, body, signature)`,
        `Transform this raw status data into an executive email:\n\n${rawReport}`
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
    if (!this.enabled) {
      return null;
    }

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
  Passed: ${testSummary.passed} (${testSummary.total > 0 ? Math.round(testSummary.passed/testSummary.total*100) : 0}%)
  Failed: ${testSummary.failed} (${testSummary.total > 0 ? Math.round(testSummary.failed/testSummary.total*100) : 0}%)
  TBD: ${testSummary.tbd} (${testSummary.total > 0 ? Math.round(testSummary.tbd/testSummary.total*100) : 0}%)
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
   * Test the API connection — returns model info or throws
   */
  async testConnection() {
    const result = await this._call(
      'You are a helpful assistant.',
      'Reply with exactly: "Connection OK" followed by the current model name.',
      100
    );
    return { success: true, message: result };
  }
}

module.exports = { ClaudeClient };
