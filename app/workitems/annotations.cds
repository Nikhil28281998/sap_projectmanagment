using TransportService as service from '../../srv/transport-service';

// ─── WorkItems: List Report + Object Page ───────────────────
annotate service.WorkItems with @(
    UI.HeaderInfo          : {
        TypeName       : 'Work Item',
        TypeNamePlural : 'Work Items',
        Title          : { $Type: 'UI.DataField', Value: workItemName },
        Description    : { $Type: 'UI.DataField', Value: projectCode }
    },

    UI.SelectionFields     : [
        workItemType,
        status,
        currentPhase,
        overallRAG,
        sapModule,
        priority
    ],

    UI.LineItem            : [
        { $Type: 'UI.DataField', Value: projectCode,    Label: 'Project Code' },
        { $Type: 'UI.DataField', Value: workItemName,    Label: 'Work Item' },
        { $Type: 'UI.DataField', Value: workItemType,    Label: 'Type' },
        { $Type: 'UI.DataField', Value: status,          Label: 'Status' },
        { $Type: 'UI.DataField', Value: overallRAG,      Label: 'RAG' },
        { $Type: 'UI.DataField', Value: currentPhase,    Label: 'Phase' },
        { $Type: 'UI.DataField', Value: sapModule,       Label: 'Module' },
        { $Type: 'UI.DataField', Value: priority,        Label: 'Priority' },
        { $Type: 'UI.DataField', Value: goLiveDate,      Label: 'Go-Live' },
        { $Type: 'UI.DataField', Value: deploymentPct,   Label: 'Deployment %' }
    ],

    UI.Facets              : [
        { $Type: 'UI.ReferenceFacet', ID: 'General',    Label: 'General Information',   Target: '@UI.FieldGroup#General' },
        { $Type: 'UI.ReferenceFacet', ID: 'People',     Label: 'People',                Target: '@UI.FieldGroup#People' },
        { $Type: 'UI.ReferenceFacet', ID: 'Timeline',   Label: 'Project Timeline',      Target: '@UI.FieldGroup#Timeline' },
        { $Type: 'UI.ReferenceFacet', ID: 'StatusInfo', Label: 'Status & Tracking',     Target: '@UI.FieldGroup#Status' },
        { $Type: 'UI.ReferenceFacet', ID: 'Transports', Label: 'Transports',            Target: 'transports/@UI.LineItem' },
        { $Type: 'UI.ReferenceFacet', ID: 'Milestones', Label: 'Milestones',            Target: 'milestones/@UI.LineItem' }
    ],

    UI.FieldGroup #General : {
        Data: [
            { $Type: 'UI.DataField', Value: projectCode,     Label: 'Project Code' },
            { $Type: 'UI.DataField', Value: workItemName,     Label: 'Work Item Name' },
            { $Type: 'UI.DataField', Value: workItemType,     Label: 'Type' },
            { $Type: 'UI.DataField', Value: sapModule,        Label: 'SAP Module' },
            { $Type: 'UI.DataField', Value: sapSystems,       Label: 'SAP Systems' },
            { $Type: 'UI.DataField', Value: complexity,       Label: 'Complexity' },
            { $Type: 'UI.DataField', Value: priority,         Label: 'Priority' },
            { $Type: 'UI.DataField', Value: snowTicket,       Label: 'SNOW Ticket' },
            { $Type: 'UI.DataField', Value: veevaCCNumber,    Label: 'Veeva CC Number' },
            { $Type: 'UI.DataField', Value: notes,            Label: 'Notes' }
        ]
    },

    UI.FieldGroup #People  : {
        Data: [
            { $Type: 'UI.DataField', Value: businessOwner,    Label: 'Business Owner' },
            { $Type: 'UI.DataField', Value: systemOwner,      Label: 'System Owner' },
            { $Type: 'UI.DataField', Value: leadDeveloper,    Label: 'Lead Developer' },
            { $Type: 'UI.DataField', Value: functionalLead,   Label: 'Functional Lead' },
            { $Type: 'UI.DataField', Value: qaLead,           Label: 'QA Lead' }
        ]
    },

    UI.FieldGroup #Timeline: {
        Data: [
            { $Type: 'UI.DataField', Value: kickoffDate,      Label: 'Kickoff Date' },
            { $Type: 'UI.DataField', Value: devCompleteDate,   Label: 'Dev Complete' },
            { $Type: 'UI.DataField', Value: uatStartDate,     Label: 'UAT Start' },
            { $Type: 'UI.DataField', Value: uatSignoffDate,   Label: 'UAT Sign-off' },
            { $Type: 'UI.DataField', Value: goLiveDate,       Label: 'Go-Live Date' },
            { $Type: 'UI.DataField', Value: actualGoLiveDate, Label: 'Actual Go-Live' },
            { $Type: 'UI.DataField', Value: hypercareEndDate, Label: 'Hypercare End' }
        ]
    },

    UI.FieldGroup #Status  : {
        Data: [
            { $Type: 'UI.DataField', Value: status,           Label: 'Status' },
            { $Type: 'UI.DataField', Value: currentPhase,     Label: 'Current Phase' },
            { $Type: 'UI.DataField', Value: overallRAG,       Label: 'RAG Status' },
            { $Type: 'UI.DataField', Value: riskScore,        Label: 'Risk Score (0-100)' },
            { $Type: 'UI.DataField', Value: deploymentPct,    Label: 'Deployment %' },
            { $Type: 'UI.DataField', Value: estimatedTRCount, Label: 'Estimated TRs' },
            { $Type: 'UI.DataField', Value: sharepointSync,   Label: 'SharePoint Synced' },
            { $Type: 'UI.DataField', Value: lastSynced,       Label: 'Last Synced' }
        ]
    }
);

// ─── Milestones sub-table (within WorkItem Object Page) ─────
annotate service.Milestones with @(
    UI.LineItem: [
        { $Type: 'UI.DataField', Value: milestoneName,  Label: 'Milestone' },
        { $Type: 'UI.DataField', Value: milestoneDate,  Label: 'Deadline' },
        { $Type: 'UI.DataField', Value: milestoneOrder, Label: 'Sequence' },
        { $Type: 'UI.DataField', Value: status,         Label: 'Status' },
        { $Type: 'UI.DataField', Value: completedDate,  Label: 'Completed' },
        { $Type: 'UI.DataField', Value: evidence,       Label: 'Evidence' }
    ]
);
