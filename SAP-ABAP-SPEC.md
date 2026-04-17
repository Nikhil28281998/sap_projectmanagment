# SAP S/4HANA ABAP Development Specification

## Transport Command Center — RFC Function Module

> **Principle**: Read ONLY from SAP standard tables. No custom Z tables, no custom
> structures. One RFC-enabled function module that returns everything the app needs.

---

## Landscape

| System ID | Type | Clients | Description |
|-----------|------|---------|-------------|
| DS4 | Development | 210, 220, 400, 280 | Dev system — multiple workstreams |
| QS4 | Quality | (list clients) | QA / UAT system |
| PS4 | Production | (list clients) | Production |

> Adjust system IDs and clients to match your actual landscape.

---

## What We Need from SAP

The app needs exactly **two data sets**:

1. **Transport headers** — TR number, description, owner, status, creation date
2. **Import history** — When was each TR imported into which system + client, and what was the return code

Both exist in standard SAP tables. No custom tables needed.

---

## SAP Standard Tables Used (Read Only)

### Transport Header

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **E070** | Transport request header | TRKORR, AS4USER, AS4DATE, TRSTATUS, TRFUNCTION, STRKORR |
| **E07T** | Transport description (per language) | TRKORR, AS4TEXT, LANGU |

### Import History (Per System + Client)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **TSTRFCOR** | Transport action log — records **every** export/import action | TRKORR, TRSTEP, TRSYSNAM, TRCLIENT, TRRETCODE, TREXEDATE, TREXETIME |

> `TSTRFCOR` is the **single source of truth** for "when was this TR deployed to
> which system and client". Every `tp import` writes a row here.

### User Name Resolution

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **USR21** | User master → address key | BNAME, PERSNUMBER |
| **ADRP** | Address → full name | PERSNUMBER, NAME_FIRST, NAME_LAST |

---

## TSTRFCOR — The Key Table

This table already records everything we need about deployments:

```
TSTRFCOR fields:
  TRKORR     — Transport number (e.g., DS4K900150)
  TRSTEP     — Action type:
                 'E' = Export
                 'I' = Import
                 'T' = Test Import (import simulation)
                 'J' = Import into target group
  TRSYSNAM   — System where action happened (DS4, QS4, PS4)
  TRCLIENT   — Client where action happened (210, 220, 400, etc.)
  TRRETCODE  — Return code (0=OK, 4=Warning, 8=Error, 12=Fatal)
  TREXEDATE  — Execution date (YYYYMMDD)
  TREXETIME  — Execution time (HHMMSS)
```

**Example rows for one transport:**

| TRKORR | TRSTEP | TRSYSNAM | TRCLIENT | TRRETCODE | TREXEDATE | TREXETIME |
|--------|--------|----------|----------|-----------|-----------|-----------|
| DS4K900150 | E | DS4 | 210 | 0 | 20260401 | 143022 |
| DS4K900150 | I | QS4 | 300 | 0 | 20260403 | 091505 |
| DS4K900150 | I | QS4 | 310 | 4 | 20260403 | 091530 |
| DS4K900150 | I | PS4 | 100 | 0 | 20260410 | 060012 |

From this we know:
- Exported from DS4/210 on Apr 1
- Imported to QS4/300 on Apr 3 (RC 0 = success)
- Imported to QS4/310 on Apr 3 (RC 4 = warning)
- Imported to PS4/100 on Apr 10 (RC 0 = success) → **in production**

---

## Step-by-Step ABAP Development

### Step 1: Create Package

```
Tcode:  SE80
Name:   Z_TCC
Description: Transport Command Center RFC
Software Component: HOME (or your local component)
Transport Request: (create new)
```

### Step 2: Create Function Group

```
Tcode:  SE37 → Environment → Function Groups → Create Group
Name:   Z_TCC
Description: Transport Command Center
Package: Z_TCC
```

### Step 3: Create the Function Module

```
Tcode:  SE37 → Create
Name:   Z_TCC_GET_TRANSPORTS
Function Group: Z_TCC
Short Text: Get transports with import history for TCC app
Processing Type: ☑ Remote-Enabled Module
```

> **Remote-Enabled Module** is mandatory — this is what makes it callable via RFC.

### Step 4: Define Parameters

**Import tab:**

| Parameter | Typing | Associated Type | Default Value | Optional | Description |
|-----------|--------|----------------|---------------|----------|-------------|
| IV_FROM_DATE | TYPE | SY-DATUM | SY-DATUM - 90 | ☑ | Fetch transports created from this date |
| IV_SYSTEMS | TYPE | STRING | | ☑ | Comma-separated system filter (e.g., 'DS4,QS4,PS4'). Empty = all |
| IV_MAX_ROWS | TYPE | INT4 | 5000 | ☑ | Max transport headers to return |

**No Export parameters** — we return everything via tables.

**Tables tab:**

| Parameter | Associated Type | Description |
|-----------|----------------|-------------|
| ET_TRANSPORTS | BAPIRET2 | *Ignore this — see below* |
| ET_IMPORT_LOG | BAPIRET2 | *Ignore this — see below* |

> Since we are NOT creating custom structures, we return **two flat tables
> using only built-in types**. The actual typing is done inside the function
> module using internal tables with explicit field definitions that we
> serialize to a JSON string in an export parameter.

**Actually — simplest approach:** Return a single JSON string that the Node.js
app parses. This avoids all DDIC structure creation:

**Revised Export tab:**

| Parameter | Typing | Associated Type | Description |
|-----------|--------|----------------|-------------|
| EV_JSON_DATA | TYPE | STRING | JSON string containing transports + import history |
| EV_COUNT | TYPE | INT4 | Number of transports returned |
| EV_RETURN_CODE | TYPE | INT4 | 0=OK, 4=Truncated, 8=Error |
| EV_MESSAGE | TYPE | STRING | Status message |

### Step 5: ABAP Source Code

```abap
FUNCTION z_tcc_get_transports.
*"----------------------------------------------------------------------
*" IMPORTING
*"   VALUE(IV_FROM_DATE)  TYPE DATS DEFAULT SY-DATUM - 90
*"   VALUE(IV_SYSTEMS)    TYPE STRING OPTIONAL
*"   VALUE(IV_MAX_ROWS)   TYPE INT4 DEFAULT 5000
*" EXPORTING
*"   VALUE(EV_JSON_DATA)    TYPE STRING
*"   VALUE(EV_COUNT)        TYPE INT4
*"   VALUE(EV_RETURN_CODE)  TYPE INT4
*"   VALUE(EV_MESSAGE)      TYPE STRING
*"----------------------------------------------------------------------

  TYPES: BEGIN OF ty_transport,
           trkorr      TYPE e070-trkorr,
           as4text     TYPE e07t-as4text,
           as4user     TYPE e070-as4user,
           owner_name  TYPE string,
           trstatus    TYPE e070-trstatus,
           trfunction  TYPE e070-trfunction,
           as4date     TYPE e070-as4date,
         END OF ty_transport,

         BEGIN OF ty_import_log,
           trkorr     TYPE tstrfcor-trkorr,
           trstep     TYPE tstrfcor-trstep,
           trsysnam   TYPE tstrfcor-trsysnam,
           trclient   TYPE tstrfcor-trclient,
           trretcode  TYPE tstrfcor-trretcode,
           trexedate  TYPE tstrfcor-trexedate,
           trexetime  TYPE tstrfcor-trexetime,
         END OF ty_import_log.

  DATA: lt_transports TYPE TABLE OF ty_transport,
        lt_import_log TYPE TABLE OF ty_import_log,
        lt_e070       TYPE TABLE OF e070,
        lt_e07t       TYPE TABLE OF e07t,
        lt_tstrfcor   TYPE TABLE OF tstrfcor,
        lt_usr21      TYPE TABLE OF usr21,
        lt_adrp       TYPE TABLE OF adrp.

  CLEAR: ev_json_data, ev_count, ev_return_code.

*----------------------------------------------------------------------
* 1. Fetch transport headers from E070
*    Only main requests (STRKORR = initial means it's a main request,
*    not a task underneath another request)
*----------------------------------------------------------------------
  SELECT trkorr as4user as4date trstatus trfunction
    FROM e070
    INTO CORRESPONDING FIELDS OF TABLE lt_e070
    WHERE as4date >= iv_from_date
      AND strkorr = ''
    ORDER BY as4date DESCENDING.

  IF lt_e070 IS INITIAL.
    ev_return_code = 0.
    ev_count = 0.
    ev_message = 'No transports found'.
    ev_json_data = '{"transports":[],"importLog":[]}'.
    RETURN.
  ENDIF.

  " Apply max rows limit
  IF lines( lt_e070 ) > iv_max_rows.
    DELETE lt_e070 FROM ( iv_max_rows + 1 ).
    ev_return_code = 4.
    ev_message = |Truncated to { iv_max_rows } rows|.
  ENDIF.

*----------------------------------------------------------------------
* 2. Fetch descriptions from E07T (English)
*----------------------------------------------------------------------
  SELECT trkorr as4text
    FROM e07t
    INTO CORRESPONDING FIELDS OF TABLE lt_e07t
    FOR ALL ENTRIES IN lt_e070
    WHERE trkorr = lt_e070-trkorr
      AND langu  = 'E'.

*----------------------------------------------------------------------
* 3. Resolve owner full names via USR21 + ADRP
*----------------------------------------------------------------------
  SELECT bname persnumber
    FROM usr21
    INTO CORRESPONDING FIELDS OF TABLE lt_usr21
    FOR ALL ENTRIES IN lt_e070
    WHERE bname = lt_e070-as4user.

  IF lt_usr21 IS NOT INITIAL.
    SELECT persnumber name_first name_last
      FROM adrp
      INTO CORRESPONDING FIELDS OF TABLE lt_adrp
      FOR ALL ENTRIES IN lt_usr21
      WHERE persnumber = lt_usr21-persnumber
        AND nation = ''.          " Default nationality row
  ENDIF.

*----------------------------------------------------------------------
* 4. Fetch ALL import history from TSTRFCOR
*    Step types: E=Export, I=Import, T=Test Import
*    This gives us: which system, which client, when, return code
*----------------------------------------------------------------------
  SELECT trkorr trstep trsysnam trclient trretcode trexedate trexetime
    FROM tstrfcor
    INTO CORRESPONDING FIELDS OF TABLE lt_tstrfcor
    FOR ALL ENTRIES IN lt_e070
    WHERE trkorr = lt_e070-trkorr
      AND trstep IN ('E','I','J')  " Export + Import + Import into group
    ORDER BY trkorr trexedate trexetime.

  " Optional: filter by target systems
  IF iv_systems IS NOT INITIAL.
    DATA: lt_sys_range TYPE RANGE OF tstrfcor-trsysnam,
          ls_sys_range LIKE LINE OF lt_sys_range,
          lt_sys_split TYPE TABLE OF string.
    SPLIT iv_systems AT ',' INTO TABLE lt_sys_split.
    LOOP AT lt_sys_split INTO DATA(lv_sys).
      ls_sys_range-sign = 'I'.
      ls_sys_range-option = 'EQ'.
      ls_sys_range-low = to_upper( condense( lv_sys ) ).
      APPEND ls_sys_range TO lt_sys_range.
    ENDLOOP.
    DELETE lt_tstrfcor WHERE trsysnam NOT IN lt_sys_range.
  ENDIF.

*----------------------------------------------------------------------
* 5. Build transport result table
*----------------------------------------------------------------------
  LOOP AT lt_e070 INTO DATA(ls_e070).
    DATA(ls_tr) = VALUE ty_transport(
      trkorr     = ls_e070-trkorr
      as4user    = ls_e070-as4user
      trstatus   = ls_e070-trstatus
      trfunction = ls_e070-trfunction
      as4date    = ls_e070-as4date
    ).

    " Description
    READ TABLE lt_e07t INTO DATA(ls_e07t)
      WITH KEY trkorr = ls_e070-trkorr.
    IF sy-subrc = 0.
      ls_tr-as4text = ls_e07t-as4text.
    ENDIF.

    " Owner name
    READ TABLE lt_usr21 INTO DATA(ls_usr)
      WITH KEY bname = ls_e070-as4user.
    IF sy-subrc = 0.
      READ TABLE lt_adrp INTO DATA(ls_adr)
        WITH KEY persnumber = ls_usr-persnumber.
      IF sy-subrc = 0.
        ls_tr-owner_name = |{ ls_adr-name_first } { ls_adr-name_last }|.
      ENDIF.
    ENDIF.

    APPEND ls_tr TO lt_transports.
  ENDLOOP.

*----------------------------------------------------------------------
* 6. Build import log table
*----------------------------------------------------------------------
  LOOP AT lt_tstrfcor INTO DATA(ls_log).
    APPEND VALUE ty_import_log(
      trkorr    = ls_log-trkorr
      trstep    = ls_log-trstep
      trsysnam  = ls_log-trsysnam
      trclient  = ls_log-trclient
      trretcode = ls_log-trretcode
      trexedate = ls_log-trexedate
      trexetime = ls_log-trexetime
    ) TO lt_import_log.
  ENDLOOP.

*----------------------------------------------------------------------
* 7. Serialize to JSON
*    Uses /UI2/CL_JSON (available in S/4HANA and NW 7.40+)
*----------------------------------------------------------------------
  DATA: BEGIN OF ls_result,
          transports TYPE TABLE OF ty_transport,
          import_log TYPE TABLE OF ty_import_log,
        END OF ls_result.

  ls_result-transports = lt_transports.
  ls_result-import_log = lt_import_log.

  ev_json_data = /ui2/cl_json=>serialize(
    data          = ls_result
    compress      = abap_true
    pretty_name   = /ui2/cl_json=>pretty_mode-camel_case
  ).

  ev_count = lines( lt_transports ).
  IF ev_return_code IS INITIAL.
    ev_return_code = 0.
    ev_message = |OK: { ev_count } transports, { lines( lt_import_log ) } log entries|.
  ENDIF.

ENDFUNCTION.
```

### Step 6: Activate the Function Module

```
Tcode: SE37
→ Open Z_TCC_GET_TRANSPORTS
→ Ctrl+F3 (Activate)
→ Verify status: Active
```

### Step 7: Test the Function Module

```
Tcode: SE37
→ Z_TCC_GET_TRANSPORTS → Test (F8)
→ IV_FROM_DATE = 20260101
→ IV_SYSTEMS = 'DS4,QS4,PS4'
→ Execute (F8)
→ Check EV_JSON_DATA contains valid JSON
→ Check EV_COUNT > 0
```

### Step 8: Activate ICF Service for HTTP Access

```
Tcode: SICF
→ Navigate: default_host → sap → bc → srt → rfc → sap
→ Right-click on "sap" → Create Sub-Element
   Name: z_tcc_get_transports
   Description: TCC Transport Sync RFC
   Handler: CL_HTTP_EXT_SOAPHANDLER_RFC
→ Right-click the new node → Activate
```

Test HTTP access:
```
URL: https://<sap-host>:<port>/sap/bc/srt/rfc/sap/z_tcc_get_transports?sap-client=210
Method: POST
Auth: Basic (RFC user)
Body: {"IV_FROM_DATE":"20260101"}
```

### Step 9: Create RFC User

```
Tcode: SU01
→ Create user: RFC_TCC
→ User Type: System (type S — for RFC/background)
→ Assign roles:
    S_RFC        — RFC execution (ACTVT=16, RFC_TYPE=FUNC, RFC_NAME=Z_TCC_*)
    S_TADIR_RAN  — Read access to repository (for E070/E07T)
    S_ADMI_FCD   — Admin functions (for TSTRFCOR read)
→ Set password
→ No dialog logon required
```

### Step 10: Test End-to-End via Cloud Connector

```
1. Cloud Connector: Add resource mapping
   Protocol: HTTPS
   Internal Host: <sap-app-server>
   Internal Port: 443 (or 8000/8001)
   Virtual Host: sap-rfc
   Path: /sap/bc/srt/rfc/sap/z_tcc_get_transports
   Access Policy: Path Only

2. BTP Destination:
   Name: S4HANA_RFC
   URL: http://sap-rfc:443
   Proxy Type: OnPremise
   Authentication: BasicAuthentication
   User: RFC_TCC
   Additional Properties: sap-client = 210

3. Test from Node.js:
   SET USE_MOCK_RFC=false
   SET RFC_DEST_NAME=S4HANA_RFC
   → Trigger "Refresh All Data" button in the app
   → Check SyncLog for SUCCESS status
```

---

## How the App Uses This Data

### JSON Response Structure

The function module returns a single JSON string in `EV_JSON_DATA`:

```json
{
  "transports": [
    {
      "trkorr": "DS4K900150",
      "as4text": "PRJ-CHG0012345 | FICO Cash Mgmt GL restructure",
      "as4user": "MCHEN",
      "ownerName": "Mike Chen",
      "trstatus": "R",
      "trfunction": "K",
      "as4date": "20260401"
    }
  ],
  "importLog": [
    {
      "trkorr": "DS4K900150",
      "trstep": "E",
      "trsysnam": "DS4",
      "trclient": "210",
      "trretcode": 0,
      "trexedate": "20260401",
      "trexetime": "143022"
    },
    {
      "trkorr": "DS4K900150",
      "trstep": "I",
      "trsysnam": "QS4",
      "trclient": "300",
      "trretcode": 0,
      "trexedate": "20260403",
      "trexetime": "091505"
    },
    {
      "trkorr": "DS4K900150",
      "trstep": "I",
      "trsysnam": "PS4",
      "trclient": "100",
      "trretcode": 0,
      "trexedate": "20260410",
      "trexetime": "060012"
    }
  ]
}
```

### App Derives These Fields from importLog

| App Field | How Derived |
|-----------|-------------|
| `currentSystem` | Latest system with step='I' and retcode ≤ 4 |
| `importRC` | Return code of the latest import |
| `deployedToClients` | All trclient values grouped by trsysnam |
| `firstImportDate` | Earliest trexedate where trstep='I' |
| `isInPRD` | Any row with trsysnam=PS4 and trstep='I' and trretcode ≤ 4 |
| `isStuck` | Latest import > 5 days ago AND not in PRD |

### TR Description Convention (Go-Live Day-1)

When you go live with the app, start using this prefix format for TR descriptions:

```
{TYPE}-{TICKET} | {description}

PRJ-CHG0012345 | FICO Cash Management phase 2
ENH-CHG0054321 | Add vendor aging column to ZMM_RPT01
BRK-INC0123456 | Fix pricing rounding in SD billing
UPG-CHG0011111 | S/4 2025 FPS02 FICO notes
SUP-INC0099999 | Retailer 4502 EDI mapping fix
HYP-INC0088888 | Post go-live GL balance fix
```

**Before go-live**: All existing transports without prefix → go to **Unassigned** bucket.
Managers manually categorize them in the app or leave them unassigned.

**After go-live**: New transports with prefix → auto-categorized by the app.

---

## Object Checklist

| # | Object | Tcode | Status |
|---|--------|-------|--------|
| 1 | Package `Z_TCC` | SE80 | ☐ |
| 2 | Function Group `Z_TCC` | SE37 | ☐ |
| 3 | FM `Z_TCC_GET_TRANSPORTS` (RFC-enabled) | SE37 | ☐ |
| 4 | ICF Service `/sap/bc/srt/rfc/sap/z_tcc_get_transports` | SICF | ☐ |
| 5 | RFC User `RFC_TCC` | SU01 | ☐ |
| 6 | Cloud Connector resource mapping | CC Admin | ☐ |
| 7 | BTP Destination `S4HANA_RFC` | BTP Cockpit | ☐ |

**That's it. 1 function module, 0 custom tables, 0 custom structures.**

---

## Appendix A: Verifying Data in SAP

Quick checks the ABAP developer can run:

```sql
-- How many transports exist since Jan 2026?
SE16 → E070 → AS4DATE >= 20260101 AND STRKORR = ''
→ Expected: hundreds to thousands

-- Check TSTRFCOR has import history
SE16 → TSTRFCOR → TRKORR = '<any TR number>'
→ Should see E (export) + I (import) rows per system

-- Check a specific TR's journey
SE16 → TSTRFCOR → TRKORR = 'DS4K900150'
→ Shows: Export from DS4, Import to QS4, Import to PS4

-- Verify /UI2/CL_JSON is available (for JSON serialization)
SE24 → /UI2/CL_JSON → Should exist in S/4HANA 1909+
```

## Appendix B: What If /UI2/CL_JSON Is Not Available?

On older systems (below NW 7.40 SP8), use manual JSON building:

```abap
" Instead of /ui2/cl_json=>serialize(), build JSON manually:
CONCATENATE '{"transports":[' INTO ev_json_data.
LOOP AT lt_transports INTO DATA(ls_t).
  IF sy-tabix > 1. CONCATENATE ev_json_data ',' INTO ev_json_data. ENDIF.
  CONCATENATE ev_json_data
    '{"trkorr":"' ls_t-trkorr '",'
    '"as4text":"' ls_t-as4text '",'
    '"as4user":"' ls_t-as4user '",'
    '"trstatus":"' ls_t-trstatus '",'
    '"as4date":"' ls_t-as4date '"}'
    INTO ev_json_data.
ENDLOOP.
CONCATENATE ev_json_data '],"importLog":[' INTO ev_json_data.
" ... same pattern for import log entries ...
CONCATENATE ev_json_data ']}' INTO ev_json_data.
```

## Appendix C: Multi-Client Landscape Matrix

Fill in your actual landscape:

| System | Client | Purpose | Used By |
|--------|--------|---------|---------|
| DS4 | 210 | Unit Test | Developers |
| DS4 | 220 | Integration Test | Developers |
| DS4 | 400 | Golden Config | Basis |
| DS4 | 280 | Sandbox | Business Users |
| QS4 | 300 | QA Testing | QA Team |
| QS4 | 310 | UAT | Business Users |
| PS4 | 100 | Production | All |

The app reads ALL clients from TSTRFCOR and groups them by system.
In the dashboard, each transport shows which clients it has been imported to.
