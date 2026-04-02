/**
 * Outlook/Graph API Mail Client — Send emails via Microsoft Graph API
 * Uses OAuth2 client_credentials flow (same tenant as SharePoint)
 *
 * STATUS: Stub with proper interface — switches between mock and Graph API
 * Prerequisites for production:
 *   - Azure AD app registration with Mail.Send permission
 *   - OUTLOOK_TENANT_ID, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET env vars
 *   - OUTLOOK_SENDER_EMAIL — the shared mailbox or user to send as
 */

class OutlookClient {
  constructor() {
    this.useMock = process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_OUTLOOK === 'true';
    this.tenantId = process.env.OUTLOOK_TENANT_ID || process.env.SHAREPOINT_TENANT_ID;
    this.clientId = process.env.OUTLOOK_CLIENT_ID || process.env.SHAREPOINT_CLIENT_ID;
    this.clientSecret = process.env.OUTLOOK_CLIENT_SECRET || process.env.SHAREPOINT_CLIENT_SECRET;
    this.senderEmail = process.env.OUTLOOK_SENDER_EMAIL || 'noreply@company.com';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Send an HTML email via Graph API (or mock in dev)
   * @param {object} options
   * @param {string[]} options.to — Array of recipient emails
   * @param {string[]} [options.cc] — Optional CC recipients
   * @param {string} options.subject — Email subject
   * @param {string} options.htmlBody — Outlook-compatible HTML body
   * @param {string} [options.importance] — low / normal / high
   * @returns {{ success: boolean, messageId?: string, message: string }}
   */
  async sendMail({ to, cc = [], subject, htmlBody, importance = 'normal' }) {
    if (this.useMock) {
      console.log(`[OutlookClient MOCK] Would send email:`);
      console.log(`  To: ${to.join(', ')}`);
      console.log(`  CC: ${cc.join(', ') || 'none'}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Body length: ${htmlBody?.length || 0} chars`);
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
        message: `Mock email sent to ${to.length} recipients (dev mode — no real email sent)`
      };
    }

    await this._ensureToken();

    const graphPayload = {
      message: {
        subject,
        importance,
        body: {
          contentType: 'HTML',
          content: htmlBody
        },
        toRecipients: to.map(email => ({
          emailAddress: { address: email }
        })),
        ccRecipients: cc.map(email => ({
          emailAddress: { address: email }
        }))
      },
      saveToSentItems: true
    };

    const url = `https://graph.microsoft.com/v1.0/users/${this.senderEmail}/sendMail`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphPayload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Graph API sendMail failed: ${response.status} — ${error}`);
    }

    return {
      success: true,
      messageId: response.headers.get('request-id') || `graph-${Date.now()}`,
      message: `Email sent successfully to ${to.length} recipients via Graph API`
    };
  }

  /**
   * Ensure we have a valid OAuth2 access token
   */
  async _ensureToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) return;

    if (!this.tenantId || !this.clientId || !this.clientSecret) {
      throw new Error('Outlook Graph API not configured. Set OUTLOOK_TENANT_ID, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET env vars.');
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error(`Outlook token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  }
}

module.exports = { OutlookClient };
