/**
 * SharePoint Client — Microsoft Graph API integration
 * Reads "IT Projects Master List" from SharePoint via Graph API
 * 
 * In production: Uses BTP Destination with OAuth2 client credentials
 * In dev/test: Returns mock data from fixtures
 */

const MOCK_PROJECTS = require('../../test/fixtures/sharepoint-projects-response.json');

class SharePointClient {
  constructor() {
    this.useMock = process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_SHAREPOINT === 'true';
    this.tenantId = process.env.SHAREPOINT_TENANT_ID;
    this.clientId = process.env.SHAREPOINT_CLIENT_ID;
    this.clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
    this.siteId = process.env.SHAREPOINT_SITE_ID;
    this.listId = process.env.SHAREPOINT_LIST_ID;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get all projects from SharePoint list
   */
  async getProjects() {
    if (this.useMock) {
      return MOCK_PROJECTS;
    }

    await this._ensureToken();

    const url = `https://graph.microsoft.com/v1.0/sites/${this.siteId}/lists/${this.listId}/items?$expand=fields`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`SharePoint API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return (data.value || []).map(item => this._mapSharePointItem(item.fields));
  }

  // ─── Map SharePoint list fields to app model ───
  _mapSharePointItem(fields) {
    return {
      title: fields.Title || '',
      projectCode: fields.ProjectCode || '',
      workItemType: fields.WorkItemType || 'Project',
      snowTicket: fields.SNOWTicket || '',
      businessOwner: fields.BusinessOwner || '',
      systemOwner: fields.SystemOwner || '',
      leadDeveloper: fields.LeadDeveloper || '',
      functionalLead: fields.FunctionalLead || '',
      qaLead: fields.QALead || '',
      kickoffDate: fields.KickoffDate || null,
      devCompleteDate: fields.DevCompleteDate || null,
      uatStartDate: fields.UATStartDate || null,
      uatSignoffDate: fields.UATSignoffDate || null,
      goLiveDate: fields.GoLiveDate || null,
      hypercareEndDate: fields.HypercareEndDate || null,
      sapModule: fields.SAPModule || '',
      sapSystems: fields.SAPSystemsAffected || '',
      estimatedTRCount: fields.EstimatedTRCount || 0,
      complexity: fields.Complexity || 'Medium',
      priority: fields.Priority || 'P3',
      status: fields.Status || 'Active',
      notes: fields.Notes || ''
    };
  }

  // ─── Token management ───
  async _ensureToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return; // Token still valid
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
      throw new Error(`SharePoint token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000; // Refresh 5 min early
  }
}

module.exports = { SharePointClient };
