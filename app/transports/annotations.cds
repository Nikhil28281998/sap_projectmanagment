using TransportService as service from '../../srv/transport-service';

// ─── Transports: List Report + Object Page ──────────────────
annotate service.Transports with @(
    UI.HeaderInfo          : {
        TypeName       : 'Transport',
        TypeNamePlural : 'Transports',
        Title          : { $Type: 'UI.DataField', Value: trNumber },
        Description    : { $Type: 'UI.DataField', Value: trDescription }
    },

    UI.SelectionFields     : [
        trStatus,
        currentSystem,
        workType,
        trOwner,
        trFunction
    ],

    UI.LineItem            : [
        { $Type: 'UI.DataField', Value: trNumber,       Label: 'TR Number' },
        { $Type: 'UI.DataField', Value: trDescription,  Label: 'Description' },
        { $Type: 'UI.DataField', Value: projectName,    Label: 'Project' },
        { $Type: 'UI.DataField', Value: workType,       Label: 'Work Type' },
        { $Type: 'UI.DataField', Value: trOwner,        Label: 'Owner' },
        { $Type: 'UI.DataField', Value: ownerFullName,  Label: 'Full Name' },
        { $Type: 'UI.DataField', Value: trStatus,       Label: 'Status' },
        { $Type: 'UI.DataField', Value: trFunction,     Label: 'Function' },
        { $Type: 'UI.DataField', Value: currentSystem,  Label: 'System' },
        { $Type: 'UI.DataField', Value: importRC,       Label: 'Import RC' },
        { $Type: 'UI.DataField', Value: createdDate,    Label: 'Created' }
    ],

    UI.Facets              : [
        { $Type: 'UI.ReferenceFacet', ID: 'TRDetails',    Label: 'Transport Details',   Target: '@UI.FieldGroup#TRDetails' },
        { $Type: 'UI.ReferenceFacet', ID: 'Classification',Label: 'Classification',     Target: '@UI.FieldGroup#Classification' },
        { $Type: 'UI.ReferenceFacet', ID: 'SyncInfo',     Label: 'Sync Information',    Target: '@UI.FieldGroup#SyncInfo' }
    ],

    UI.FieldGroup #TRDetails      : {
        Data: [
            { $Type: 'UI.DataField', Value: trNumber,       Label: 'Transport Number' },
            { $Type: 'UI.DataField', Value: trDescription,  Label: 'Description' },
            { $Type: 'UI.DataField', Value: trOwner,        Label: 'Owner (SAP User)' },
            { $Type: 'UI.DataField', Value: ownerFullName,  Label: 'Owner Full Name' },
            { $Type: 'UI.DataField', Value: trStatus,       Label: 'Status' },
            { $Type: 'UI.DataField', Value: trFunction,     Label: 'Function (K/W)' },
            { $Type: 'UI.DataField', Value: currentSystem,  Label: 'Current System' },
            { $Type: 'UI.DataField', Value: importRC,       Label: 'Import Return Code' },
            { $Type: 'UI.DataField', Value: createdDate,    Label: 'TR Created Date' }
        ]
    },

    UI.FieldGroup #Classification : {
        Data: [
            { $Type: 'UI.DataField', Value: workType,       Label: 'Work Type' },
            { $Type: 'UI.DataField', Value: projectName,    Label: 'Project Name' },
            { $Type: 'UI.DataField', Value: snowTicket,     Label: 'ServiceNow Ticket' },
            { $Type: 'UI.DataField', Value: veevaCCNumber,  Label: 'Veeva CC Number' },
            { $Type: 'UI.DataField', Value: assignedBy,     Label: 'Categorized By' },
            { $Type: 'UI.DataField', Value: assignedDate,   Label: 'Categorized Date' }
        ]
    },

    UI.FieldGroup #SyncInfo       : {
        Data: [
            { $Type: 'UI.DataField', Value: lastSynced,     Label: 'Last RFC Sync' },
            { $Type: 'UI.DataField', Value: version,        Label: 'Version' }
        ]
    }
);
