#!/usr/bin/env node
/**
 * generate-seed.mjs
 *
 * One-shot bootstrap: takes the real list of 2026 DS4 customer workbench
 * transports (pulled via ZCL_TCC_RUN -> ZTCC_GET_TRANSPORTS) and produces
 * the two seed CSVs that CAP auto-loads at deploy time:
 *
 *   db/data/sap.pm-WorkItems.csv
 *   db/data/sap.pm-TransportWorkItems.csv
 *
 * Categorization rules (stable, re-runnable):
 *   INC0*        → Bug Fix      (snowTicket = INC number)
 *   SCTASK0*     → Enhancement  (snowTicket = SCTASK number)
 *   CS0*         → Bug Fix      (snowTicket = CS number)
 *   IT-CC-00XXX  → Project      (snowTicket = IT-CC number)
 *   SAP Note N   → SAP Note
 *   Monthly security-note batches → one per month
 *   Known multi-TR programs      → explicit groupings below
 *   Test / ToC / DO NOT MOVE     → skipped (no work item created)
 *
 * Run: node scripts/generate-seed.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'db', 'data');
fs.mkdirSync(outDir, { recursive: true });

// ──────────────────────────────────────────────────────────────────────────
// 1. Raw TR list — pulled live from DS4/400 via ZCL_TCC_RUN on 2026-04-24.
//    Format: trkorr | as4date | as4user | trstatus | trfunction | description
// ──────────────────────────────────────────────────────────────────────────
const RAW = `
DS4K905528|20260424|RAVDINDUR|R|W|SEC-RD-IT-CC-00777 Adding T-cdoe to the role
DS4K905537|20260424|UDAGUNTA|D|K|FO Invoice block check
DS4K905471|20260424|NICRIVERA|D|W|Global - SD - Pricing Procedure Exclusion - IT-CC-00XXX
DS4K905534|20260423|NIKKUMAR|D|K|TCC - Transport Command Center report
DS4K905532|20260423|VISPULIPATI|D|W|CS0116179:FI:VP:GL account substution tvarvc
DS4K905400|20260423|VISPULIPATI|D|K|CS0116179:FI:VP:GL account substution
DS4K905530|20260423|DANALMADA|D|K|Claude Role Test
DS4K905523|20260422|NICRIVERA|D|W|Global - FICO - VKOA and OKB9 Updates - IT-CC-00761
DS4K905496|20260422|NICRIVERA|D|W|Global - SD - NewSalesOrg & ServiceOrderConfig - IT-CC-00761
DS4K905526|20260422|MOIABDUL|D|W|Test_DO NOT MOVE
DS4K905485|20260422|RAVDINDUR|R|W|Sec- RD- IT-CC-00642- Adding Cust Rep for BatchGenealogy App
DS4K905521|20260422|MOIABDUL|D|W|MLBS-FICO-Co.Code-MLBS Email Id Updated-IT-CC-00720
DS4K905499|20260422|NICRIVERA|D|W|Global - MM - Profit Center Field - IT-CC-00761
DS4K905519|20260422|NICRIVERA|D|W|Global - MM - Acct Assmt Grp Mat Mandatory - IT-CC-00XXX
DS4K905517|20260421|DANALMADA|D|K|ZFIRE_ALLOCATIONS_DANIEL - Dynamic receiving CC per source
DS4K905515|20260421|DANALMADA|D|K|Generated Request for Change Recording
DS4K905507|20260420|ANKKATOCH|D|W|CS0119501 - Bank of america related config, payment methods,
DS4K905511|20260420|MOIABDUL|D|W|GLOBAL-FICO-OKKN-Val.Variant 001 added_PC01-IT-CC-00718/720
DS4K905505|20260420|ANKKATOCH|D|K|CS0119501- Bank of america related config, payment methods
DS4K905509|20260420|VISPULIPATI|D|W|GLOBAL-MM-PO Item TXJCD TVARVC - IT-CC-00718/720
DS4K904821|20260420|ROHSINGH|D|K|DNT COA POC
DS4K905280|20260420|ROHSINGH|D|K|CS0018792:Certificate of Analysis
DS4K905503|20260417|RAVDINDUR|D|K|GLOBAL - SEC - MLBS/CALC Roles IT-CC-00718/720 ActivatOdata
DS4K905501|20260417|RAVDINDUR|D|W|GLOBAL - SEC - MLBS/CALC Roles IT-CC-00718/720 Add Fiori App
DS4K905498|20260417|NIKKUMAR|R|T|ToC from DS4K905366 : SCTASK0021067:New allocation rule gene
DS4K905366|20260417|NIKKUMAR|D|W|SCTASK0021067:New allocation rule general insurance
DS4K905473|20260417|NIKKUMAR|R|W|SCTASK0023398: Business area updates
DS4K905489|20260416|ROHSINGH|R|K|CS0118419:BBIO Logo in Payment advice
DS4K905494|20260416|RAVDINDUR|D|W|RD SEC IT-CC-00767 - Adding Tcodes to Basis Admin role
DS4K905459|20260416|VINGADIRAJU|D|W|CS0018792:VGADIRAJU:PP:SAP -Quality Certificates
DS4K905491|20260416|UDAGUNTA|D|W|FO Order workflow Acct Assign Catergories
DS4K905487|20260416|RAVDINDUR|D|W|testing only - DO NOT MOVE THIS
DS4K905461|20260415|RAVDINDUR|R|W|SEC-RD-IT-CC-00768-Adding T-code to the role
DS4K905481|20260414|SIVMETTU|D|W|CS0119747:MM:SM-new CMO plant 2040 TJOAPACK NL
DS4K905483|20260414|TATSPINARDI|D|W|CS0119766:SD:TS:ZFD - Copy Control
DS4K905457|20260414|ROHSINGH|R|K|SCTASK0010028:CS0104930  APQR Report:V4
DS4K905480|20260414|DANALMADA|R|T|ToC: DO NOT MOVE
DS4K905477|20260414|KATRAVITEJA|D|K|COPA_Test
DS4K905469|20260414|ROHSINGH|R|K|CS0109281:BC:MO:Dump issue in QS4
DS4K905466|20260413|ELISYED|D|W|GLOBAL-MM-MVKE_KTGRM made mandatory for ZFIN_IT-CC-00718/007
DS4K905464|20260413|AYUSINGHAL|D|W|Customer master field mandatory
DS4K905387|20260413|KATRAVITEJA|R|W|Global - FICO - FI-MM-SD Account determination - IT-CC-00761
DS4K905376|20260413|NICRIVERA|R|W|Global - SD - Pricing Procedure ZSRV01 Service - IT-CC-00761
DS4K905391|20260413|KATRAVITEJA|R|W|Global - FICO - MM msg change to 'W' from 'E' - IT-CC-00761
DS4K905361|20260413|KATRAVITEJA|R|K|Global - FICO - COPA Characterstics - IT-CC-00761
DS4K905359|20260413|KATRAVITEJA|R|W|Global - FICO - COPA Characterstics - IT-CC-00761
DS4K905435|20260413|KATRAVITEJA|R|K|Global - FICO - COPA Custom fields to ACDOCA - IT-CC-00761
DS4K905341|20260413|KATRAVITEJA|R|W|Global- FICO - FA/Dummy PC/Down Payment/OKB9 - IT-CC-00761
DS4K905370|20260413|NICRIVERA|R|W|Global - SD - Sales Doc Type ZSRV for Services - IT-CC-00761
DS4K905379|20260413|SUDGANTA|R|K|CS0118259:BC:GS:GLOBAL-FICO SAP Note 3321316 IT-CC-00761
DS4K905454|20260412|RAVDINDUR|D|K|SEC-RD-IT-CC-00762-Activating odata service
DS4K905452|20260409|YASSHAIK|R|W|CALC-QM-SS&CDG-ZUD1&ZUD-IT-CC-00718
DS4K905449|20260409|RAVDINDUR|D|W|SEC-RD-IT-CC-00762-Situation Handling for MBC-ITCOM
DS4K905447|20260408|ROHSINGH|D|K|CS0118419
DS4K905445|20260407|UDAGUNTA|D|K|CS0116348:ABAP:Framework order ( doc type FO)
DS4K905437|20260406|ELISYED|D|W|GLOBAL-MM-Disable QM insp. Process_mvt 107IT-CC-00718/00720
DS4K905443|20260406|ELISYED|D|W|GLOBAL-MM-Enable GR-Based IV for ME11&ME12 IT-CC-00718/00720
DS4K905327|20260406|MOIABDUL|D|W|CALC-FICO-Assigned TAX Jurisdiction-IT-CC-00718
DS4K905406|20260406|MOIABDUL|D|W|CS0116179:FI:MB:GL-50500000_FSG-YB30_UOM optional updated
DS4K905441|20260406|VASATIKYALA|D|K|CS0117152 -
DS4K903883|20260406|UDAGUNTA|R|K|293024:ABAP:SPDD Adjustments
DS4K905439|20260406|KATRAVITEJA|D|W|Global - FICO - MM msg change to 'E' from 'W' - IT-CC-00761
DS4K905432|20260403|UDAGUNTA|R|K|SCTASK0020294:ABAP:BlackLine GroupReporting Interface
DS4K905434|20260403|UDAGUNTA|R|T|ToC from DS4K905432 : SCTASK0020294:ABAP:BlackLine GroupRepo
DS4K905430|20260402|DANALMADA|D|W|Joule: Business Role Z_BR_JOULE
DS4K905428|20260402|DANALMADA|D|W|Joule: Business Catalog Z_BC_FIORI_JOULE
DS4K905426|20260402|DANALMADA|D|K|Joule: Technical Catalog Z_TC_FIORI_JOULE
DS4K905423|20260402|VIPGOGINENI|R|T|ToC from DS4K905421 : 6-56: Testing CALM TMS
DS4K905421|20260402|VIPGOGINENI|D|W|6-56: Testing CALM TMS
DS4K905414|20260402|NIKKUMAR|R|W|SCTASK0017638: Assest Gl acct update.v2
DS4K905417|20260402|SANKANUGULA|D|K|ML90-MM-Note 3625474 implement-ITCC00718/720
DS4K905372|20260401|UDAGUNTA|R|K|CS0118236:ABAP:Invoice Workflow
DS4K905416|20260331|NIKKUMAR|R|T|ToC from DS4K905414 : SCTASK0017638: Assest Gl acct update.v
DS4K905412|20260331|NIKKUMAR|D|K|Test API
DS4K905312|20260331|NIKKUMAR|D|W|Test API
DS4K905410|20260331|MOIABDUL|D|W|MLBS-MM & FICO-Default Tax Codes for CC-IT-CC-00720
DS4K905408|20260331|MOIABDUL|D|W|CALC-FICO-Updated CALC Co.Code Name-IT-CC-00718
DS4K905397|20260330|NIKKUMAR|R|W|SCTASK0017638: Assest Gl acct update
DS4K905331|20260327|ROHSINGH|R|K|SCTASK0010028:CS0104930  APQR Report:V3
DS4K905345|20260327|UDAGUNTA|R|K|SCTASK0020294:ABAP:BlackLine GroupReporting Interface
DS4K905404|20260326|NIKKUMAR|R|T|ToC from DS4K905397 : SCTASK0017638: Assest Gl acct update
DS4K905402|20260326|NIKKUMAR|R|T|ToC from DS4K905397 : SCTASK0017638: Assest Gl acct update
DS4K905393|20260326|VASATIKYALA|R|K|CS0117152 -  Custom PPV Report
DS4K905374|20260325|NIKKUMAR|R|W|INC0039121: New business area DC01 & Add DNU to 4 area
DS4K905368|20260325|RAVDINDUR|R|W|SEC - RD - IT-CC-00752 - Add Tcode to Basis FF ADM Role
DS4K905395|20260324|MOIABDUL|D|W|GLOBAL-FI-Mov.Type 331(KOSTL-Required)-IT-CC-00718/720
DS4K905389|20260324|PAUMCGHGHY|D|W|CS0018792 - Plannign Group for RSPEC
DS4K905383|20260323|MOIABDUL|D|W|CALC-FICO-FI-SD Configurations-IT-CC-00718
DS4K905381|20260323|MOIABDUL|D|W|MLBS-FICO-FI-SD Configurations-IT-CC-00720
DS4K905265|20260323|AYUSINGHAL|D|W|Setting up Transit plant for assigning Value chain for Sales
DS4K905267|20260323|TATSPINARDI|R|W|CS0116762:SD:TS:Intercompany Pricing Procedure
DS4K905238|20260323|TATSPINARDI|R|W|CS0115929:SD:TS:Change Pricing Procedure , New Tax Condition
DS4K905240|20260323|TATSPINARDI|R|K|CS0115929:SD:TS:Change Pricing Procedure , New Tax Condition
DS4K905385|20260323|NIKKUMAR|D|W|SCTASK0017638: Bank of america accounts.v2
DS4K905355|20260323|NIKKUMAR|R|W|SCTASK0017638: Bank of america accounts
DS4K905232|20260323|ELISYED|R|W|CS0116179:MM:ESYED:Change IC COGS from 50100000 to 50600000
DS4K905322|20260323|ELISYED|R|W|CS0116179:MM:ESYED:IC Sales_901 mvt_COGS from 50500000-50600
DS4K905353|20260318|NIKKUMAR|R|W|INC0037906: AED ~ CHF Curreny pair
DS4K905259|20260318|ROHSINGH|R|K|CS0116066 - Create Correspondence Application and Logos
DS4K905364|20260318|UDAGUNTA|D|W|GRP Gls
DS4K905212|20260318|RAVDINDUR|R|W|RD SEC IT-CC-00722 Add app to GR_ADMIN
DS4K905339|20260317|UDAGUNTA|D|K|Group Reporting Do not Transport
DS4K905347|20260312|MOIABDUL|D|W|MLBS-FICO-OKB9-Assign Default CostObjects-IT-CC-00720
DS4K905357|20260312|MOIABDUL|D|W|CALC-FICO-OKB9-Assign Default CostObjects-IT-CC-00718
DS4K905352|20260311|DANALMADA|R|T|ToC - Do Not Move
DS4K905351|20260311|DANALMADA|R|T|ToC - Do Not Move
DS4K905343|20260310|VISPULIPATI|D|K|GLOBAL-MM-PO Item change TXJCD - IT-CC-00718/720
DS4K905335|20260309|RAMJAGIRWAR|R|W|CS0117396: RJ: Activate System Alias FAR_CUSTOMER_LIST_V2
DS4K905333|20260309|UDAGUNTA|D|K|Group Reporting view
DS4K905329|20260309|NIKKUMAR|D|W|Test Odata
DS4K905325|20260309|ROHSINGH|R|K|CS0109281:BC:MO:CL_FINCS_CTR_BADI_RATE_WRAPPER:V6
DS4K905191|20260306|MAHOLADRI|R|K|CS0114668: BC: RJ: Security Notes Jan'26
DS4K905244|20260306|SANKANUGULA|R|K|CS0116512:SK:BC:Security Vulnerability note 3697099
DS4K905320|20260306|ROHSINGH|R|K|CS0109281:BC:MO:CL_FINCS_CTR_BADI_RATE_WRAPPER:V5
DS4K905318|20260306|VISPULIPATI|D|K|GLOBAL-MM -PO form changes - IT-CC-00718/720
DS4K905316|20260306|UDAGUNTA|D|K|CS0117143:ABAP:Group Reporting Service Activation
DS4K905314|20260306|UDAGUNTA|D|K|Test Service- Do Not Transport
DS4K905310|20260305|NIKKUMAR|D|K|SAP Note
DS4K905308|20260305|RAKDHESIDI|D|W|CS0117199:BC-SEC RD Roles ZRS_AMS*
DS4K905304|20260305|ROHSINGH|R|K|CS0109281:BC:MO:CL_FINCS_CTR_BADI_RATE_WRAPPER:V4
DS4K905300|20260304|MOIABDUL|D|W|CALC-FICO-Plants ML Activation-IT-CC-00718
DS4K905302|20260304|NIKKUMAR|D|K|GR Data balckline
DS4K905292|20260304|NIKKUMAR|R|W|INC0036958: Reverse YM2 posting rule changes
DS4K905298|20260304|MOIABDUL|D|W|MLBS-FICO-Plants ML Activation-IT-CC-00720
DS4K905296|20260304|YASSHAIK|D|W|CALC-QM-SS Codegroup-IT-CC-00718
DS4K905294|20260304|YASSHAIK|D|W|MLBS-QM-SS Codegroup-IT-CC-00720
DS4K905284|20260303|AYUSINGHAL|D|W|MLBS-SD-Org structure-IT-CC-00720
DS4K905286|20260303|AYUSINGHAL|D|W|CALC-SD-Org structure-IT-CC-00718
DS4K905277|20260303|ELISYED|D|W|CALC-MM-Plants Creation - IT-CC-00718
DS4K905288|20260303|ROHSINGH|R|K|CS0109281:BC:MO:CL_FINCS_CTR_BADI_RATE_WRAPPER:V3
DS4K905290|20260303|SIVMETTU|D|W|CS0116348:MM:SM-Framework Order Config
DS4K905282|20260303|ROHSINGH|R|K|CS0109281:BC:MO:CL_FINCS_CTR_BADI_RATE_WRAPPER:V2
DS4K905234|20260303|MAHOLADRI|R|K|CS0109281:BC:MO:CL_FINCS_CTR_BADI_RATE_WRAPPER
DS4K905226|20260303|VASATIKYALA|R|K|CS0116077- SCTASK0020271- New Fm for user data pull
DS4K905274|20260302|ELISYED|D|W|MLBS-MM-Plants Creation - IT-CC-00720
DS4K905270|20260302|NIKKUMAR|D|K|Test balckline gr data
DS4K905202|20260226|DANALMADA|R|T|CS0109281:BC:MO:Deimplementing & Re implementing SAP Notes
DS4K905250|20260225|SIVMETTU|D|W|CS0116348:MM:SM-Set up Framework order (Doc Type FO)
DS4K905263|20260225|ANIKHARE|D|W|Intercompany Pricing procedure for BBIO and BBNL
DS4K905261|20260225|NIKKUMAR|D|W|FOC Test
DS4K905228|20260225|NIKKUMAR|R|W|SCTASK0019085: Auto-posting rules
DS4K905246|20260225|NIKKUMAR|R|W|SCTASK0018429:Add M rates for currency pairs.v2
DS4K905177|20260225|NIKKUMAR|R|W|SCTASK0018429:Add M rates for currency pairs
DS4K905255|20260225|VASATIKYALA|D|K|CS0114668  for BridgeBio - SAP Security Notes to implement
DS4K905248|20260225|BHAALLAWADA|D|W|CS0116348:BC-BA:Missing PR & PO doc type FO
DS4K905082|20260224|ANIKHARE|R|W|INC0021454 Configure Messages to check Duplicate invoices
DS4K905242|20260223|DANALMADA|D|W|GLOBAL - SEC - MLBS/CALC Roles IT-CC-00718/720
DS4K905197|20260223|RAVDINDUR|R|W|SEC-RD-IT-CC-00715-Adding new plant 2035 Patheon TR roles
DS4K905236|20260220|PAUMCGHGHY|D|W|SCTASK0018350 - Catalog Select Set for Yes No Results
DS4K905230|20260219|RAVDINDUR|D|W|SEC-RD-IT-CC-00706-Situation Handling for MBC-ITCOM
DS4K905193|20260218|ROHSINGH|R|K|SCTASK0010028:CS0104930  APQR Report:V2
DS4K905225|20260217|DANALMADA|R|T|ToC: SCTASKXXXXXXX - New Joule Catalog Fiori
DS4K905224|20260217|DANALMADA|R|T|SCTASKXXXXXXX - New Joule Catalog Fiori
DS4K905223|20260216|DANALMADA|R|T|SCTASKXXXXXXX - New Joule Catalog Fiori
DS4K905195|20260216|SIVMETTU|R|W|SCTASK0018350 - New CMO Plant 2035 Patheon TRO
DS4K905216|20260211|RAVDINDUR|D|W|RD SEC IT-CC-00710 - Adding Targetmapping
DS4K905214|20260211|ANIKHARE|D|W|Tier Pricing for Procurement
DS4K905203|20260211|NIKKUMAR|R|K|SCTASK0018295:Custom cal Z1 to skip first thursday of month
DS4K905124|20260211|NIKKUMAR|R|W|SCTASK0017450: MBC situation handling
DS4K905185|20260210|RAVDINDUR|R|W|SEC-RD-IT-CC-00706-Situation Handling for MBC
DS4K905210|20260209|NIKKUMAR|D|K|SAP Learning Course fiori tile
DS4K905209|20260209|DANALMADA|R|T|TOC - Deimplement/Implement SAP Notes, do not move
DS4K905207|20260206|NIKKUMAR|D|K|SAP Learning Courses Platform v1.0
DS4K905206|20260205|NIKKUMAR|R|T|ToC from DS4K905203 : SCTASK0018295:Custom cal Z1 to skip fi
DS4K905183|20260203|DANALMADA|R|W|SNOW SCTASK0017424 - New roles for Blackline Connector
DS4K905181|20260203|DANALMADA|R|K|SNOW SCTASK0017424 - New roles for Blackline Connector
DS4K905189|20260202|NIKKUMAR|R|W|SCTASK0018307: Comp rule change - Markup gl accounts
DS4K905199|20260202|NIKKUMAR|R|W|SCTASK0017638: New company codes - EMEA.v2
DS4K905201|20260202|NIKKUMAR|R|T|ToC from DS4K905199 : SCTASK0017638: New company codes - EME
DS4K905175|20260202|NIKKUMAR|R|W|SCTASK0017638: New company codes - EMEA
DS4K905187|20260131|MAHOLADRI|R|K|CS0109281:BC:MO:Deimplementing & Re implementing SAP Notes
DS4K905033|20260127|RAVDINDUR|R|W|Sec- RD- IT-CC-00642- Adding Cust Rep for BatchGenealogy App
DS4K905159|20260127|RAVDINDUR|R|W|Sec- RD- IT-CC-00642- Creating custom Fiori Tile ZGBR
DS4K904964|20260127|ROHSINGH|R|K|SCTASK0010028:CS0104930  APQR Report
DS4K905157|20260126|RAVDINDUR|R|K|RD-Implement SAP Notes SAP Note 3548791
DS4K905179|20260125|BHAALLAWADA|R|T|CS0113738:AT:BC:Client copy WE20
DS4K905180|20260125|BHAALLAWADA|R|T|CS0113738:AT:BA:Client copy WE21 Partner profiles export
DS4KT01618|20260123|BHAALLAWADA|R|M|Client Export of Client-Spec. Objects
DS4K905168|20260121|MAHOLADRI|R|K|CS0113738:BC:MO:Remote Client Copy - PS4/400 to DS4/210
DS4K905166|20260118|RAVDINDUR|R|W|SEC-RD-IT-CC-00635-Adding New Tiles to Cashmngmt
DS4K905173|20260114|NIKKUMAR|D|K|export software
DS4K905171|20260113|NIKKUMAR|D|W|Odata for export/import software
DS4K905170|20260112|RAVDINDUR|R|T|Package backup: SAPK75701NCPSAPBASIS
DS4K905153|20260112|MAHOLADRI|R|K|CS0109281:BC:MO:if_fincs_ctr_parallel_Interface
DS4K905151|20260109|RAVDINDUR|R|W|SEC-RD-IT-CC-00697-Ading S_USER_GRP to role Z_BC_BATCH_ADMIN
DS4K905165|20260108|DANALMADA|R|T|ToC from DS4K905147 : S4 HANA Joule - Security and Functiona
DS4K905164|20260108|DANALMADA|R|T|ToC from DS4K905149 : S4 HANA Joule - Security and Functiona
DS4K905162|20260108|DANALMADA|R|T|ToC from DS4K905149 : S4 HANA Joule - Security and Functiona
DS4K905161|20260108|MAHOLADRI|R|T|ToC from DS4K905153 : CS0109281:BC:MO:if_fincs_ctr_parallel_
DS4K905155|20260106|MAHOLADRI|R|T|ToC from DS4K905153 : CS0109281:BC:MO:if_fincs_ctr_parallel_
DS4K905145|20260105|MAHOLADRI|R|K|CS0109281:BC:MO:FINCS_CTR_CTRSCR_PA_PARAL Line Code
`.trim();

// Parse raw → array of {trkorr, date, user, status, fn, desc}
const trs = RAW.split('\n').map(line => {
  const [trkorr, as4date, as4user, trstatus, trfunction, ...descParts] = line.split('|');
  return {
    trkorr,
    as4date,                       // YYYYMMDD
    as4user,
    trstatus,                      // R=Released, D=Modifiable, L=Locked
    trfunction,                    // K=workbench, W=customizing, T=transport-of-copies, etc.
    desc: descParts.join('|').trim(),
  };
});

// ──────────────────────────────────────────────────────────────────────────
// 2. Work-item registry (the grouping I presented + user's answers)
//    workItemKey → { name, type, snowTicket, owner, priority, notes }
// ──────────────────────────────────────────────────────────────────────────
const WI = {
  // ── Big multi-TR programs ─────────────────────────────────────────────
  'IT-CC-00761':  { name: 'Global FICO/SD/MM Rollout (IT-CC-00761)',      type: 'Project',     snow: 'IT-CC-00761',  owner: 'NICRIVERA',    priority: 'P1', sapModule: 'FICO' },
  'IT-CC-00718':  { name: 'CALC Company Code Rollout (IT-CC-00718)',      type: 'Project',     snow: 'IT-CC-00718',  owner: 'MOIABDUL',     priority: 'P1', sapModule: 'FICO' },
  'IT-CC-00720':  { name: 'MLBS Company Code Rollout (IT-CC-00720)',      type: 'Project',     snow: 'IT-CC-00720',  owner: 'MOIABDUL',     priority: 'P1', sapModule: 'FICO' },
  'CS0109281':    { name: 'FINCS BADI Rate Wrapper (CS0109281)',          type: 'Bug Fix',     snow: 'CS0109281',    owner: 'ROHSINGH',     priority: 'P2', sapModule: 'FI-CS' },
  'CS0104930':    { name: 'APQR Report (SCTASK0010028/CS0104930)',        type: 'Enhancement', snow: 'SCTASK0010028', owner: 'ROHSINGH',    priority: 'P2', sapModule: 'QM' },
  'SCTASK0017638':{ name: 'Bank of America & EMEA Company Codes',          type: 'Enhancement', snow: 'SCTASK0017638', owner: 'NIKKUMAR',    priority: 'P2', sapModule: 'FICO' },
  'CS0116348':    { name: 'Framework Order Doc Type FO (CS0116348)',     type: 'Enhancement', snow: 'CS0116348',    owner: 'UDAGUNTA',     priority: 'P2', sapModule: 'MM' },
  'CS0116179':    { name: 'IC COGS & GL Substitution (CS0116179)',       type: 'Bug Fix',     snow: 'CS0116179',    owner: 'VISPULIPATI',  priority: 'P2', sapModule: 'FI' },
  'CS0113738':    { name: 'Client Copy PS4/400 → DS4/210 (CS0113738)',   type: 'Infrastructure', snow: 'CS0113738', owner: 'MAHOLADRI',    priority: 'P2', sapModule: 'BC' },
  'SCTASK0020294':{ name: 'ABAP BlackLine GroupReporting Interface',       type: 'Enhancement', snow: 'SCTASK0020294', owner: 'UDAGUNTA',   priority: 'P2', sapModule: 'FI-CS' },
  'IT-CC-00706':  { name: 'MBC Situation Handling (IT-CC-00706)',         type: 'Project',     snow: 'IT-CC-00706',  owner: 'RAVDINDUR',    priority: 'P2', sapModule: 'BC-SEC' },
  'IT-CC-00642':  { name: 'BatchGenealogy Security (IT-CC-00642)',        type: 'Project',     snow: 'IT-CC-00642',  owner: 'RAVDINDUR',    priority: 'P2', sapModule: 'BC-SEC' },
  'JOULE':        { name: 'S/4HANA Joule Fiori Launchpad',                 type: 'Project',     snow: '',              owner: 'DANALMADA',   priority: 'P2', sapModule: 'BC' },
  'CS0018792':    { name: 'Certificate of Analysis / APQR (CS0018792)',  type: 'Enhancement', snow: 'CS0018792',    owner: 'ROHSINGH',     priority: 'P3', sapModule: 'QM' },
  'TATSPINARDI-SD': { name: 'SD Pricing & Copy Control (TATSPINARDI)',    type: 'Enhancement', snow: '',              owner: 'TATSPINARDI', priority: 'P3', sapModule: 'SD' },
  'TCC':          { name: 'Transport Command Center (internal)',          type: 'Project',     snow: '',              owner: 'NIKKUMAR',    priority: 'P3', sapModule: 'Custom' },
  'SAP-LEARN':    { name: 'SAP Learning Courses Platform v1.0',           type: 'Project',     snow: '',              owner: 'NIKKUMAR',    priority: 'P3', sapModule: 'Fiori' },
  'GR-VIEW-AMS':  { name: 'Group Reporting View (AMS)',                   type: 'Enhancement', snow: '',              owner: 'UDAGUNTA',    priority: 'P3', sapModule: 'FI-CS' },
  'CALM-TMS':     { name: 'CALM TMS PoC',                                  type: 'Enhancement', snow: '',              owner: 'VIPGOGINENI', priority: 'P3', sapModule: 'BC' },
  // ── Monthly security notes batches ────────────────────────────────────
  'SECNOTE-2026-01': { name: 'Security Notes — January 2026',             type: 'SAP Note',    snow: 'CS0114668',    owner: 'MAHOLADRI',    priority: 'P2', sapModule: 'BC-SEC' },
  'SECNOTE-2026-03': { name: 'Security Notes — March 2026 (Note 3697099)', type: 'SAP Note',    snow: 'CS0116512',    owner: 'SANKANUGULA', priority: 'P2', sapModule: 'BC-SEC' },
};

// ──────────────────────────────────────────────────────────────────────────
// 3. TR → workItemKey assignment rules.
//    Returns a workItemKey or null (→ create per-TR work item) or 'SKIP'.
// ──────────────────────────────────────────────────────────────────────────
function classifyTR(tr) {
  const d = tr.desc;

  // Skip list — no work item, no TransportWorkItems row
  if (/test\s*api|foc\s*test|copa_test|test\s*odata|test\s*service|grp\s*gls/i.test(d)) return 'SKIP';
  if (/test\s*balckline|gr\s*data\s*balckline|export\s*software|odata\s*for\s*export/i.test(d)) return 'SKIP';
  if (/do\s*not\s*move|do\s*not\s*transport|dnt\s*coa\s*poc|testing\s*only/i.test(d)) return 'SKIP';
  if (/^toc[\s:-]/i.test(d) || / toc from /i.test(d) || /^toc from/i.test(d)) return 'SKIP';
  if (/^claude\s+role\s+test/i.test(d)) return 'SKIP';
  if (/^package\s+backup/i.test(d)) return 'SKIP';
  if (/^client export of client/i.test(d)) return 'SKIP';
  if (/generated\s+request\s+for\s+change\s+recording/i.test(d)) return 'SKIP';
  if (/^sap\s+note$/i.test(d)) return 'SKIP';                                 // Q2 — skip bare "SAP Note"
  if (/group\s+reporting\s+view/i.test(d)) return 'GR-VIEW-AMS';              // Q5
  if (/^sctaskxxxxxxx/i.test(d)) return 'JOULE';                               // Joule placeholder TRs
  if (/s4\s*hana\s*joule/i.test(d)) return 'JOULE';
  if (/^joule:|joule\s*business\s*role|joule\s*fiori/i.test(d)) return 'JOULE';
  if (/6-56:\s*testing\s*calm\s*tms/i.test(d)) return 'CALM-TMS';              // Q7
  if (/sap\s+learning\s+course/i.test(d)) return 'SAP-LEARN';                  // Q6
  if (/tcc\s*-\s*transport\s+command\s+center/i.test(d)) return 'TCC';

  // Explicit multi-TR projects by ticket match (first match wins)
  if (/CS0109281/i.test(d)) return 'CS0109281';
  if (/SCTASK0010028|CS0104930/i.test(d)) return 'CS0104930';
  if (/SCTASK0017638/i.test(d)) return 'SCTASK0017638';
  if (/CS0116348/i.test(d)) return 'CS0116348';
  if (/CS0116179/i.test(d)) return 'CS0116179';
  if (/CS0113738/i.test(d)) return 'CS0113738';
  if (/SCTASK0020294/i.test(d)) return 'SCTASK0020294';
  if (/CS0018792/i.test(d)) return 'CS0018792';
  if (/CS0114668/i.test(d)) return 'SECNOTE-2026-01';
  if (/CS0116512/i.test(d) || /note\s*3697099/i.test(d)) return 'SECNOTE-2026-03';
  if (/IT-CC-00761/i.test(d)) return 'IT-CC-00761';
  if (/IT-CC-00718(?!\/)/i.test(d) && !/00720/.test(d)) return 'IT-CC-00718';
  if (/IT-CC-00720(?!\/)/i.test(d) && !/00718/.test(d)) return 'IT-CC-00720';
  if (/IT-CC-00718\/00?720|IT-CC-00720\/00?718|IT-CC-00718\/720/i.test(d))     return 'IT-CC-00718'; // bundle rollouts under CALC (with MLBS cross-linked via notes)
  if (/IT-CC-00706(?!\d)/i.test(d)) return 'IT-CC-00706';
  if (/IT-CC-00642(?!\d)/i.test(d)) return 'IT-CC-00642';
  if (/CS0115929|CS0116762|CS0119766/i.test(d)) return 'TATSPINARDI-SD';

  // Fall through → create per-TR work item (below)
  return null;
}

// Infer simple ticket id from description for per-TR work items
function inferSnow(desc) {
  const m = desc.match(/\b(IT-CC-\d{5}|SCTASK\d{7,}|INC\d{7,}|CS\d{7,})\b/);
  return m ? m[1] : '';
}
function inferType(desc) {
  if (/^INC\d/i.test(desc) || /\bINC\d{7,}/i.test(desc)) return 'Bug Fix';
  if (/\bSCTASK\d{7,}/i.test(desc)) return 'Enhancement';
  if (/\bCS\d{7,}/i.test(desc)) return 'Bug Fix';
  if (/\bIT-CC-\d{5}/i.test(desc)) return 'Project';
  if (/sap\s*note\s+\d/i.test(desc) || /rd-implement\s+sap\s+notes?/i.test(desc)) return 'SAP Note';
  if (/spdd|client copy|package backup|client export/i.test(desc)) return 'Infrastructure';
  return 'Enhancement';
}
function inferSapModule(desc) {
  if (/FICO|FI-MM-SD|OKB9|OKKN|COPA|ACDOCA|Markup gl|Asset\s+Gl|posting rule|Currency|allocation|Bank of america/i.test(desc)) return 'FICO';
  if (/[\s-]SD[\s:-]|Pricing Procedure|Sales|Service.+Config/i.test(desc)) return 'SD';
  if (/[\s-]MM[\s:-]|Plants|Movement|PO Item|PO form|ME11|ME12|MVKE|Tax Jurisdiction/i.test(desc)) return 'MM';
  if (/[\s-]QM[\s:-]|Quality|Codegroup|SS\s?&\s?CDG/i.test(desc)) return 'QM';
  if (/[\s-]PP[\s:-]/i.test(desc)) return 'PP';
  if (/SEC-RD|SEC[\s-]|Role|Fiori\s+(?:Tile|App|Targetmapping)|Tcode|role/i.test(desc)) return 'BC-SEC';
  if (/ABAP|FM for|BADI|SPDD|User\s+Data\s+Pull|Framework order/i.test(desc)) return 'ABAP';
  if (/Joule|Fiori/i.test(desc)) return 'Fiori';
  return 'Other';
}
function inferPriority(desc) {
  if (/^INC/i.test(desc) || /\bINC\d/.test(desc)) return 'P1';
  if (/IT-CC-0076\d/.test(desc)) return 'P1';
  return 'P2';
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Build work-item + transport-work-item rows
// ──────────────────────────────────────────────────────────────────────────
const workItems = new Map();          // key → WorkItem record
const perTrItems = [];                // per-TR work items go straight to an array
const transports = [];                // TransportWorkItem records

function uuid(prefix, n) {
  // Deterministic pseudo-UUID — enough for HANA primary keys, predictable diffs
  const hex = n.toString(16).padStart(12, '0');
  return `${prefix}-0000-4000-8000-${hex}`;
}

function statusMap(t) {
  return t === 'R' ? 'Released' : t === 'L' ? 'Locked' : 'Modifiable';
}
function sysMap(tr) {
  return tr.trstatus === 'R' ? 'PRD' : tr.trfunction === 'K' ? 'DEV' : 'DEV';
}
function itemStatus(trstatuses) {
  // All released → Complete. Any modifiable → Active.
  return trstatuses.every(s => s === 'R') ? 'Complete' : 'Active';
}

// First pass — assign
const assignments = trs.map(tr => ({ tr, key: classifyTR(tr) }));

let wiCounter = 1;
const mkWorkItemId = () => uuid('c0000001', wiCounter++);

// Pre-create grouped work-items from WI registry
for (const [key, meta] of Object.entries(WI)) {
  const members = assignments.filter(a => a.key === key);
  if (!members.length) continue;
  const id = mkWorkItemId();
  workItems.set(key, {
    ID: id,
    workItemName: meta.name,
    projectCode: meta.snow || `WI-${wiCounter.toString().padStart(3, '0')}`,
    workItemType: meta.type,
    application: 'SAP',
    snowTicket: meta.snow || '',
    businessOwner: meta.owner,
    systemOwner: meta.owner,
    leadDeveloper: meta.owner,
    sapModule: meta.sapModule || 'Other',
    sapSystems: 'DS4,QS4,PS4',
    estimatedTRCount: members.length,
    complexity: members.length > 5 ? 'High' : members.length > 2 ? 'Medium' : 'Low',
    priority: meta.priority,
    status: itemStatus(members.map(m => m.tr.trstatus)),
    currentPhase: itemStatus(members.map(m => m.tr.trstatus)) === 'Complete' ? 'Complete' : 'Development',
    methodology: 'Agile',
    overallRAG: 'GREEN',
    riskScore: 20,
    deploymentPct: Math.round(100 * members.filter(m => m.tr.trstatus === 'R').length / members.length),
    testTotal: 0, testPassed: 0, testFailed: 0, testBlocked: 0, testTBD: 0, testSkipped: 0,
    testCompletionPct: 0, uatStatus: 'Not Started', goLiveDate: '',
    veevaCCNumber: '', sharepointUrl: '', amsTicket: '', notes: `Bootstrap from 2026 TR history. ${members.length} TR(s).`,
  });
}

// Per-TR work items for un-grouped assignments (key === null, not SKIP)
const perTrMap = new Map();
for (const { tr, key } of assignments) {
  if (key === 'SKIP') continue;
  if (key) continue;
  // new work item per TR (ticket-scoped)
  const snow = inferSnow(tr.desc);
  const wiKey = snow || `TR:${tr.trkorr}`;
  if (!perTrMap.has(wiKey)) {
    const id = mkWorkItemId();
    perTrMap.set(wiKey, { id, members: [] });
    const type = inferType(tr.desc);
    const mod  = inferSapModule(tr.desc);
    const name = snow ? `${snow} — ${tr.desc.slice(0, 70)}` : tr.desc.slice(0, 80);
    workItems.set(wiKey, {
      ID: id,
      workItemName: name,
      projectCode: snow || `WI-${wiCounter.toString().padStart(3, '0')}`,
      workItemType: type,
      application: 'SAP',
      snowTicket: snow.startsWith('IT-CC') ? '' : snow,
      businessOwner: tr.as4user,
      systemOwner: tr.as4user,
      leadDeveloper: tr.as4user,
      sapModule: mod,
      sapSystems: 'DS4,QS4,PS4',
      estimatedTRCount: 1,
      complexity: 'Low',
      priority: inferPriority(tr.desc),
      status: tr.trstatus === 'R' ? 'Complete' : 'Active',
      currentPhase: tr.trstatus === 'R' ? 'Complete' : 'Development',
      methodology: 'Agile',
      overallRAG: 'GREEN',
      riskScore: 10,
      deploymentPct: tr.trstatus === 'R' ? 100 : 0,
      testTotal: 0, testPassed: 0, testFailed: 0, testBlocked: 0, testTBD: 0, testSkipped: 0,
      testCompletionPct: 0, uatStatus: tr.trstatus === 'R' ? 'Complete' : 'Not Started', goLiveDate: '',
      veevaCCNumber: '', sharepointUrl: '',
      amsTicket: snow.startsWith('IT-CC') ? snow : '',
      notes: '',
    });
  }
  perTrMap.get(wiKey).members.push(tr);
}

// ──────────────────────────────────────────────────────────────────────────
// 5. Build TransportWorkItem rows
// ──────────────────────────────────────────────────────────────────────────
let trCounter = 1;
const mkTrId = () => uuid('e0000001', trCounter++);

function workTypeAbbrev(type) {
  return ({
    'Project': 'PRJ', 'Enhancement': 'ENH', 'Bug Fix': 'BUG',
    'SAP Note': 'NOTE', 'Infrastructure': 'INFRA',
  })[type] || 'OTH';
}

for (const { tr, key } of assignments) {
  if (key === 'SKIP') continue;
  let wiId, wiType;
  if (key) {
    const wi = workItems.get(key);
    wiId = wi.ID; wiType = wi.workItemType;
  } else {
    const snow = inferSnow(tr.desc) || `TR:${tr.trkorr}`;
    const wi = workItems.get(snow);
    wiId = wi.ID; wiType = wi.workItemType;
  }
  const snowOnTr = inferSnow(tr.desc);
  transports.push({
    ID: mkTrId(),
    trNumber: tr.trkorr,
    trDescription: tr.desc,
    workType: workTypeAbbrev(wiType),
    snowTicket: snowOnTr,
    trOwner: tr.as4user,
    ownerFullName: tr.as4user,
    trStatus: statusMap(tr.trstatus),
    trFunction: tr.trfunction,
    currentSystem: sysMap(tr),
    importRC: tr.trstatus === 'R' ? 0 : '',
    createdDate: `${tr.as4date.slice(0,4)}-${tr.as4date.slice(4,6)}-${tr.as4date.slice(6,8)}`,
    workItem_ID: wiId,
    version: 1,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// 6. Emit CSVs
// ──────────────────────────────────────────────────────────────────────────
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function writeCsv(file, header, rows) {
  const lines = [header.join(';')];
  for (const row of rows) lines.push(header.map(h => csvEscape(row[h])).join(';'));
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
  console.log(`  wrote ${path.relative(path.resolve(__dirname, '..'), file)}  (${rows.length} rows)`);
}

const wiHeader = [
  'ID','workItemName','projectCode','workItemType','application','snowTicket',
  'businessOwner','systemOwner','leadDeveloper','sapModule','sapSystems',
  'estimatedTRCount','complexity','priority','status','currentPhase','methodology',
  'overallRAG','riskScore','deploymentPct',
  'testTotal','testPassed','testFailed','testBlocked','testTBD','testSkipped',
  'testCompletionPct','uatStatus','goLiveDate','veevaCCNumber','sharepointUrl','amsTicket','notes'
];
const trHeader = [
  'ID','trNumber','trDescription','workType','snowTicket','trOwner','ownerFullName',
  'trStatus','trFunction','currentSystem','importRC','createdDate','workItem_ID','version'
];

writeCsv(path.join(outDir, 'sap.pm-WorkItems.csv'), wiHeader, [...workItems.values()]);
writeCsv(path.join(outDir, 'sap.pm-TransportWorkItems.csv'), trHeader, transports);

// Small AppConfig stub so admin can see defaults post-deploy
const cfgRows = [
  { configKey: 'RFC_DESTINATION_NAME', configValue: 'S4HANA_RFC_DS4',     description: 'BTP Destination for all RFC calls' },
  { configKey: 'RFC_FM_NAME',          configValue: 'ZTCC_GET_TRANSPORTS', description: 'ABAP function module called by refresh' },
  { configKey: 'RFC_TR_START_DATE',    configValue: '',                    description: 'YYYYMMDD — set to today after first deploy' },
  { configKey: 'RFC_SYSTEMS_FILTER',   configValue: '',                    description: 'Comma-separated system IDs; blank = all' },
  { configKey: 'RFC_SCHEDULE_ENABLED', configValue: 'false',               description: 'Toggle for auto-refresh cron' },
  { configKey: 'RFC_SCHEDULE_CRON',    configValue: '0 */4 * * *',         description: '5-field cron; e.g. every 4h' },
];
writeCsv(path.join(outDir, 'sap.pm-AppConfig.csv'),
  ['configKey','configValue','description'],
  cfgRows);

console.log('\nSummary:');
console.log(`  Work items:      ${workItems.size}`);
console.log(`  Transports:      ${transports.length}`);
console.log(`  Skipped (test):  ${assignments.filter(a => a.key === 'SKIP').length}`);
console.log(`  Total input TRs: ${trs.length}`);
