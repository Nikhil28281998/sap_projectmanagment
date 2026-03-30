/**
 * Claude API Client — Optional AI report polish
 * Direct Anthropic API (~$0.50/month at ~5 calls/week)
 * Feature-flagged: ENABLE_AI=true to activate
 */

class ClaudeClient {
  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY;
    this.model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    this.enabled = process.env.ENABLE_AI === 'true' && !!this.apiKey;
  }

  /**
   * Polish a weekly report with Claude
   */
  async polishReport(rawReport) {
    if (!this.enabled) {
      return rawReport + '\n\n---\n_AI polish disabled. Enable in Settings > AI Integration._';
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `You are a senior IT manager writing a weekly status email to leadership. 
Polish this report into a professional, concise executive summary email. 
Keep all data points accurate. Use bullet points for key items. 
Add a brief "Key Risks" section if any RED/AMBER items exist.
Do NOT add fictional data — only use what's provided.

RAW REPORT DATA:
${rawReport}`
          }]
        })
      });

      if (!response.ok) {
        console.warn(`Claude API error: ${response.status}. Returning raw report.`);
        return rawReport;
      }

      const data = await response.json();
      return data.content?.[0]?.text || rawReport;
    } catch (err) {
      console.warn(`Claude API call failed: ${err.message}. Returning raw report.`);
      return rawReport;
    }
  }
}

module.exports = { ClaudeClient };
