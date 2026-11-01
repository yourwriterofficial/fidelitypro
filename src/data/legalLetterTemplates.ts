/**
 * Legal Letter & Formal Financial Instrument Templates
 * 
 * Provides 10 rich, fully customizable templates for formal legal letters,
 * escrow disbursement receipts, banking wire directions, regulatory clearance letters,
 * notarial acts, and custodial certificates.
 * 
 * These can be issued by independent counsel, corporate treasury, settlement arbiters,
 * or depository clearinghouses without requiring RPM representation.
 */

export interface LegalLetterTemplate {
  id: string;
  name: string;
  category: 'Disbursement & Escrow' | 'Compliance & AML' | 'Banking & Wire' | 'Custody & Depository' | 'Legal & Settlement' | 'Tax & Regulatory' | 'Corporate & Dividend';
  badge: string;
  entityName: string;
  entitySubtitle: string;
  entityAddress: string;
  entityContact: string;
  documentTitle: string;
  securityClassification: string;
  salutation: string;
  bodyParagraphs: string[];
  hasSchedule: boolean;
  scheduleLabels: {
    grossLabel: string;
    netLabel: string;
    railLabel: string;
    refLabel: string;
  };
  defaultAmount?: string;
  legalAttestation: string;
  signatoryName: string;
  signatoryTitle: string;
  signatoryBar: string;
  confidentialityNotice: string;
  defaultSealType?: string;
  defaultDeliveryStatus?: string;
  defaultTheme?: 'independent' | 'rpm';
}

export const LEGAL_LETTER_TEMPLATES: LegalLetterTemplate[] = [
  {
    id: 'universal-disbursement',
    name: '1. Universal Fiduciary Disbursement & Legal Settlement Receipt (Independent / Non-RPM)',
    category: 'Disbursement & Escrow',
    badge: 'Universal Legal Instrument',
    entityName: 'McMahon & Associates, Attorneys at Law',
    entitySubtitle: 'Independent Fiduciary Settlements, Private Trust Administration & Capital Conveyancing',
    entityAddress: '88 Wall Street, Suite 2400, New York, NY 10005',
    entityContact: '+1 (212) 555-0344 · legal@mcmahonassociates.io',
    documentTitle: 'OFFICIAL RECEIPT AND IRREVOCABLE RELEASE OF SETTLEMENT DISBURSEMENT',
    securityClassification: 'STRICTLY CONFIDENTIAL · PRIVILEGED LEGAL INSTRUMENT',
    salutation: 'Dear Beneficiary,',
    bodyParagraphs: [
      'I write in my official capacity as Independent Fiduciary and Disbursement Counsel to formally confirm and document the conclusive execution of the settlement disbursement process on behalf of the designated beneficiary.',
      'Pursuant to the governing fiduciary escrow instructions and executed settlement agreement, all required conditions precedent, audit disclosures, and regulatory clearance protocols have been completed and verified in full. No outstanding caveats, liens, holds, or encumbrances remain attached to this settlement.',
      'In accordance with executed banking wire instructions, the total settlement proceeds have been irrevocably released and dispatched to your designated beneficiary account via authorized Federal Reserve clearance rails. The undersigned counsel and depository agents are hereby fully discharged of further custody liability with respect to these assets.',
      'This instrument constitutes definitive, legally binding proof of executed conveyance. Please retain this original attestation within your permanent financial, legal, and taxation archives as conclusive evidence of completed disbursement.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Gross Settlement Balance',
      netLabel: 'Net Delivered & Released',
      railLabel: 'Conveyance Rail / Delivery Mode',
      refLabel: 'Federal Reserve / Banking Reference'
    },
    defaultAmount: '$75,000.00',
    legalAttestation: 'IN WITNESS WHEREOF, the undersigned Independent Disbursement Counsel has executed and affixed formal legal attestation to this instrument on the effective date written above.',
    signatoryName: 'Dean McMahon, Esq.',
    signatoryTitle: 'Independent Disbursement Counsel & Special Fiduciary',
    signatoryBar: 'New York State Bar Reg. #4829104 · Federal Fiduciary Commissioner',
    confidentialityNotice: 'PRIVILEGED & CONFIDENTIAL: This document contains proprietary legal and financial attestation intended solely for the named beneficiary. Any unauthorized reproduction, dissemination, or disclosure is strictly prohibited under governing law.'
  },
  {
    id: 'escrow-disbursement',
    name: '2. Escrow Disbursement & Settlement Receipt (Statement Verification Precedent)',
    category: 'Disbursement & Escrow',
    badge: 'Disbursement Counsel',
    entityName: 'McMahon & Associates, Attorneys at Law',
    entitySubtitle: 'Specialized Escrow Administration, Fiduciary Settlements & Trust Conveyancing',
    entityAddress: '88 Wall Street, Suite 2400, New York, NY 10005',
    entityContact: '+1 (212) 555-0344 · legal@mcmahonassociates.io',
    documentTitle: 'OFFICIAL RECEIPT AND IRREVOCABLE RELEASE OF ESCROWED SETTLEMENT FUNDS',
    securityClassification: 'STRICTLY CONFIDENTIAL · PRIVILEGED LEGAL INSTRUMENT',
    salutation: 'Dear Beneficiary,',
    bodyParagraphs: [
      'I write in my official capacity as Independent Disbursement Counsel to formally confirm and document the conclusive execution of the fund release process on behalf of the designated beneficiary.',
      'Pursuant to governing fiduciary escrow terms, the mandatory condition precedent requiring the formal submission, audit, and verification of the official certified 5-page Statement of Account has been satisfied in full. All compliance checks and regulatory clearances have been rendered unconditional.',
      'In accordance with settlement instructions, the total settlement sum has been disbursed and delivered via irrevocable wire transfer to your designated account, thereby discharging the undersigned of further custody or depository liability with respect to these specific assets.',
      'This document constitutes definitive, legally binding proof of executed conveyance. Please retain this original instrument within your permanent legal and tax archives as conclusive evidence of completed disbursement.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Gross Settlement Balance',
      netLabel: 'Net Delivered & Released',
      railLabel: 'Conveyance Rail / Delivery Mode',
      refLabel: 'Federal Reserve / Banking Reference'
    },
    defaultAmount: '$78,958.00',
    legalAttestation: 'IN WITNESS WHEREOF, the undersigned Independent Disbursement Counsel has executed and affixed formal legal attestation to this instrument on the effective date written above.',
    signatoryName: 'Dean McMahon, Esq.',
    signatoryTitle: 'Independent Disbursement Counsel & Special Fiduciary',
    signatoryBar: 'New York State Bar Reg. #4829104 · Federal Fiduciary Commissioner',
    confidentialityNotice: 'PRIVILEGED & CONFIDENTIAL: This document contains proprietary legal and financial attestation intended exclusively for the named beneficiary. Any unauthorized reproduction, dissemination, or disclosure is strictly prohibited under governing law.'
  },
  {
    id: 'aml-clearance',
    name: '2. Certificate of Non-Encumbrance & Anti-Money Laundering (AML) Clearance',
    category: 'Compliance & AML',
    badge: 'AML & Fiduciary Clearance',
    entityName: 'Global Fiduciary Compliance & Regulatory Review Bureau',
    entitySubtitle: 'International Sanctions Screening, Source of Funds Attestation & Capital Integrity Division',
    entityAddress: 'Canary Wharf, 25 Bank Street, Level 18, London E14 5JP, United Kingdom',
    entityContact: '+44 (20) 7946-0921 · compliance@fiduciary-bureau.org',
    documentTitle: 'CERTIFICATE OF NON-ENCUMBRANCE AND UNRESTRICTED CAPITAL CLEARANCE',
    securityClassification: 'OFFICIAL REGULATORY ATTESTATION · UNCONDITIONAL CLEARANCE',
    salutation: 'To All Authorized Financial Institutions, Depository Agents, and Clearinghouses:',
    bodyParagraphs: [
      'BE IT KNOWN THAT the Compliance and Risk Assessment Directorate has concluded a comprehensive forensic audit and regulatory review of the capital assets, portfolio holdings, and transaction history belonging to the designated account holder.',
      'We hereby formally certify that the capital balance under examination has been verified as clean, unencumbered, non-criminal in origin, and fully compliant with International Financial Action Task Force (FATF) Recommendations, the Bank Secrecy Act (BSA), and relevant EU/UK Anti-Money Laundering Directives.',
      'No third-party claims, tax liens, judicial attachments, or administrative encumbrances exist against these funds. The account holder is fully entitled to lawful custody, transfer, conversion, or cross-border repatriation without restriction.',
      'This certificate remains valid as prima facie evidence of clean source of funds and regulatory clearance across all Tier-1 corresponding banking and digital asset networks.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Audited Liquid Capital Balance',
      netLabel: 'Net Cleared for Unrestricted Delivery',
      railLabel: 'Clearance Jurisdiction & Framework',
      refLabel: 'AML Audit Certificate Verification ID'
    },
    defaultAmount: '$1,000,000.00',
    legalAttestation: 'CERTIFIED AND RECORDED by the Lead Compliance Officer under the authority of the International Fiduciary Verification Registry.',
    signatoryName: 'Katherine Vance, CAMS, CFE',
    signatoryTitle: 'Director of Regulatory Compliance & Senior Fiduciary Arbiter',
    signatoryBar: 'ACAMS Certification #UK-8820491 · Compliance Registry Bar #50192',
    confidentialityNotice: 'REGULATORY NOTICE: This compliance attestation is issued pursuant to verified statutory screening. Counterparties are authorized to rely upon the representations herein for capital settlement purposes.'
  },
  {
    id: 'banking-wire-direction',
    name: '3. Irrevocable Banking Wire & Capital Remittance Instruction',
    category: 'Banking & Wire',
    badge: 'Wire Transfer Order',
    entityName: 'First Continental Settlement Chambers & Escrow Trust',
    entitySubtitle: 'Private Wire Transfer Facilitation, Depository Directions & Capital Logistics',
    entityAddress: 'One Financial Plaza, Suite 3100, New York, NY 10005',
    entityContact: '+1 (212) 555-0819 · wire-desk@continental-chambers.com',
    documentTitle: 'IRREVOCABLE AND UNCONDITIONAL WIRE TRANSFER DIRECTION ORDER',
    securityClassification: 'AUTHENTICATED BANKING INSTRUCTION · PRIORITY CLEARING',
    salutation: 'To the Executive Managing Officers, Operations & Wire Department:',
    bodyParagraphs: [
      'BY MEANS OF THIS FORMAL INSTRUMENT, the undersigned Authorized Fiduciary Officer irrevocably instructs and directs the Depository Bank to immediately execute the unconditional remittance of the settlement sum identified below to the designated beneficiary.',
      'This wire transfer order is issued free of administrative holdback, withholding, or escrow conditions, all preceding contractual covenants having been fully executed and discharged by the recipient.',
      'Settlement shall be executed via direct Fedwire / SWIFT MT103 real-time gross settlement protocol, with value date effective immediately. Settlement advice and federal transaction tracking numbers shall be provided directly to the beneficiary upon ledger execution.',
      'Failure to execute or unwarranted suspension of this unconditional direction may constitute breach of fiduciary depository mandate and incur statutory commercial liability.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Total Principal Settlement Sum',
      netLabel: 'Net Wire Amount to Beneficiary',
      railLabel: 'Remittance Rail & Clearing Protocol',
      refLabel: 'Federal Depository Wire Instruction Ref'
    },
    defaultAmount: '$250,000.00',
    legalAttestation: 'EXECUTED UNDER IRREVOCABLE MANDATE on this banking business day by the Authorized Settlement Officer.',
    signatoryName: 'Arthur Sterling, Esq.',
    signatoryTitle: 'Lead Settlement Officer & Depository Fiduciary Trustee',
    signatoryBar: 'Depository Registration #FST-49201 · Commercial Banking Bar',
    confidentialityNotice: 'BANKING DIRECTIVE: Authorized officers receiving this transmission must execute without offset. Privileged communication under Federal Banking Code Regulations.'
  },
  {
    id: 'custodial-skr',
    name: '4. Custodial Capital Deposit & Fiduciary Safekeeping Receipt (SKR)',
    category: 'Custody & Depository',
    badge: 'Safekeeping Receipt',
    entityName: 'Atlantic Vault & Fiduciary Custody Depository Ltd.',
    entitySubtitle: 'Segregated Digital Asset & Fiat Capital Safekeeping Registry',
    entityAddress: '70 Rue de la Servette, 1202 Geneva, Switzerland',
    entityContact: '+41 (22) 819-4400 · custody@atlanticvault-fiduciary.ch',
    documentTitle: 'OFFICIAL FIDUCIARY SAFEKEEPING RECEIPT (SKR)',
    securityClassification: 'AUTHENTICATED CUSTODIAL TITLE · NEGOTIABLE ASSET RECORD',
    salutation: 'To Whom It May Concern:',
    bodyParagraphs: [
      'THIS INSTRUMENT WITNESSETH that Atlantic Vault & Fiduciary Custody Depository Ltd. has received, verified, and placed into segregated depository custody the liquid financial assets described herein on behalf of the registered beneficial owner.',
      'The deposited assets are held in a designated bankruptcy-remote fiduciary escrow account, unencumbered by hypothecation, lending facilities, or custodial liens of any kind.',
      'The beneficial owner maintains full, sovereign, and unconditional title to these deposited reserves, with unilateral rights to demand immediate liquidation, transfer, or physical delivery pursuant to depository standing orders.',
      'This Safekeeping Receipt constitutes conclusive documentary evidence of asset custody and verified reserves. Any third party verifying this instrument may confirm validity via our secure depository verification portal.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Certified Custodial Reserve Balance',
      netLabel: 'Unencumbered Beneficial Equity',
      railLabel: 'Depository Vault / Custody Class',
      refLabel: 'Custodial Safekeeping Record (SKR) Ref'
    },
    defaultAmount: '$500,000.00',
    legalAttestation: 'CONFIRMED AND ENTERED INTO VAULT LEDGERS by the Chief Custodian and Registrar of Fiduciary Instruments.',
    signatoryName: 'Marcus Thorne, TEP',
    signatoryTitle: 'Chief Custodian & Registrar of Fiduciary Instruments',
    signatoryBar: 'Swiss Depository Trust Registry #CH-660-849102-1',
    confidentialityNotice: 'CUSTODIAL ATTESTATION: This Safekeeping Receipt is issued under Swiss Fiduciary Regulations. Valid only when bearing authentic registry reference identifiers.'
  },
  {
    id: 'deed-of-release',
    name: '5. Deed of Mutual Settlement, Release & General Discharge of Liability',
    category: 'Legal & Settlement',
    badge: 'Mutual Release & Discharge',
    entityName: 'Sterling, Cross & Montgomery LLP',
    entitySubtitle: 'Attorneys at Law · Commercial Arbitrators & Complex Settlement Counsel',
    entityAddress: '1000 Louisiana Street, Suite 4500, Houston, TX 77002',
    entityContact: '+1 (713) 555-0428 · settlements@sterlingcrosslaw.com',
    documentTitle: 'DEED OF MUTUAL SETTLEMENT, GENERAL RELEASE AND COMPLETE DISCHARGE',
    securityClassification: 'EXECUTED LEGAL DEED · PERPETUAL ACCORD & SATISFACTION',
    salutation: 'To All Parties in Interest and Recognized Fiduciaries:',
    bodyParagraphs: [
      'THIS DEED OF GENERAL RELEASE IS EXECUTED to confirm the definitive resolution, reconciliation, and settlement of all financial accounts and capital relationships pertaining to the undersigned beneficiary and participating counterparties.',
      'WHEREAS, the parties have finalized all audits, reconciled transaction ledgers, and verified that all settlement conditions have been fulfilled in accordance with commercial standards and mutual covenants.',
      'NOW, THEREFORE, upon payment and delivery of the agreed settlement sum, each party forever releases, remises, and discharges the other of and from any and all manner of actions, liabilities, claims, reckonings, and controversies whatsoever, whether in law or equity.',
      'This instrument constitutes a complete accord and satisfaction, binding upon heirs, executors, administrators, corporate successors, and assignees forever.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Total Agreed Settlement Amount',
      netLabel: 'Final Executed Accord Payment',
      railLabel: 'Delivery Mechanism & Jurisdiction',
      refLabel: 'Settlement Accord Docket Number'
    },
    defaultAmount: '$78,958.00',
    legalAttestation: 'SIGNED, SEALED AND DELIVERED as a formal Deed of General Release on the date first written above.',
    signatoryName: 'Eleanor Cross, Esq.',
    signatoryTitle: 'Managing Partner & Certified Commercial Arbitrator',
    signatoryBar: 'State Bar of Texas #24089102 · American Arbitration Association Panelist',
    confidentialityNotice: 'LEGAL NOTICE: This Deed of Release operates as a perpetual legal bar against future litigation or financial claims regarding the settled subject matter.'
  },
  {
    id: 'tax-clearance',
    name: '6. Cross-Border Tax Treaty Clearance & Withholding Exemption Certificate',
    category: 'Tax & Regulatory',
    badge: 'International Tax Clearance',
    entityName: 'International Revenue Advisory & Treaty Compliance Group',
    entitySubtitle: 'Cross-Border Capital Repatriation, Double Taxation Treaties & Fiscal Clearance Desk',
    entityAddress: 'Rue du Rhône 42, 1204 Geneva, Switzerland',
    entityContact: '+41 (22) 555-9012 · tax@int-revenue-advisory.com',
    documentTitle: 'INTERNATIONAL TAX EXEMPTION AND FISCAL CLEARANCE CERTIFICATE',
    securityClassification: 'OFFICIAL FISCAL RULING · 0% WITHHOLDING EXEMPTION',
    salutation: 'To the Authorized Withholding Agent and Transmitting Financial Institution:',
    bodyParagraphs: [
      'THIS CERTIFIES that the International Revenue Advisory Group has conducted a comprehensive treaty review regarding the cross-border remittance of investment profits and liquid capital payable to the named beneficiary.',
      'Pursuant to governing bilateral Double Taxation Avoidance Treaties (DTT), international sovereign investment covenants, and relevant non-resident tax exemptions, the disbursed sum is officially cleared as exempt from secondary administrative withholding.',
      'Transmitting institutions and intermediary banks are instructed to remit the gross capital distribution in full, without deductions for non-resident withholding taxes, stamp duties, or foreign exchange surcharges.',
      'This certificate shall be lodged with the relevant revenue authorities as conclusive evidence of lawful fiscal compliance and zero-withholding qualification.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Gross Investment Distribution',
      netLabel: 'Net Remittance (0% Deductions)',
      railLabel: 'Applicable Treaty / Statutory Rule',
      refLabel: 'Fiscal Treaty Ruling Reference ID'
    },
    defaultAmount: '$150,000.00',
    legalAttestation: 'VERIFIED AND RATIFIED by the Senior International Tax Counsel on this day.',
    signatoryName: 'Julian Hayes, LL.M. (Taxation)',
    signatoryTitle: 'Senior International Tax Counsel & Treaty Arbiter',
    signatoryBar: 'Chartered Institute of Taxation #CIOT-9941 · Swiss Bar Association',
    confidentialityNotice: 'FISCAL DIRECTIVE: Financial institutions may rely on this official treaty ruling to disburse gross capital without administrative withholding liability.'
  },
  {
    id: 'dividend-distribution',
    name: '7. Private Equity Profit Allocation & Capital Yield Execution Advice',
    category: 'Corporate & Dividend',
    badge: 'Capital Yield Execution',
    entityName: 'Apex Syndicate & Private Asset Management Corporation',
    entitySubtitle: 'Institutional Portfolio Treasury, Strategic Capital Distributions & Real Estate Syndicate Desk',
    entityAddress: '745 Fifth Avenue, 28th Floor, New York, NY 10151',
    entityContact: '+1 (212) 555-7740 · treasury@apex-syndicate.com',
    documentTitle: 'OFFICIAL PROFIT ALLOCATION AND CAPITAL DISTRIBUTION EXECUTION ADVICE',
    securityClassification: 'EXECUTIVE CORPORATE RECORD · PORTFOLIO LEDGER UPDATE',
    salutation: 'Dear Capital Partner,',
    bodyParagraphs: [
      'The Board of Governors and Executive Treasury Desk of Apex Syndicate hereby formally notify you of the execution and release of your accrued capital dividends, investment returns, and liquidated equity profits.',
      'Your portfolio performance across secured property syndicates, fixed-yield investment products, and liquid treasury balances has undergone quarterly audit and earned the verified return outlined in the schedule below.',
      'In accordance with corporate bylaws and partner distribution elections, these earned yields have been cleared and credited to your primary liquidity ledger for immediate withdrawal or reinvestment at your sole discretion.',
      'We extend our congratulations on this exceptional yield milestone and remain committed to stewarding your capital with maximum institutional prudence.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Total Accrued Portfolio Yield & Profit',
      netLabel: 'Net Capital Delivered to Liquidity Account',
      railLabel: 'Distribution Plan / Asset Syndicate',
      refLabel: 'Corporate Treasury Allocation Batch ID'
    },
    defaultAmount: '$320,000.00',
    legalAttestation: 'CERTIFIED AND RECORDED IN THE CORPORATE LEDGERS OF APEX SYNDICATE on this date.',
    signatoryName: 'David S. Kensington',
    signatoryTitle: 'Managing Director of Capital Settlements & Head of Treasury',
    signatoryBar: 'FINRA Series 24/7 Licensed · CFA Institute Charterholder #589210',
    confidentialityNotice: 'CORPORATE CONFIDENTIAL: Intended solely for the registered portfolio holder. Unauthorized duplication or redistribution is strictly prohibited.'
  },
  {
    id: 'notarial-attestation',
    name: '8. Notarial Act of Financial Verification & Asset Attestation',
    category: 'Legal & Settlement',
    badge: 'Notarial Act & Jurat',
    entityName: 'Office of the State Notary Public & Jurat Registry',
    entitySubtitle: 'Official Commercial Acts, Sworn Affidavits & Financial Attestation Registry',
    entityAddress: '60 Centre Street, New York County Courthouse, New York, NY 10007',
    entityContact: '+1 (212) 555-0911 · notaries@countyregistry-ny.gov',
    documentTitle: 'NOTARIAL ACT OF FINANCIAL VERIFICATION AND SWORN ATTESTATION',
    securityClassification: 'OFFICIAL JURAT ACT · PUBLIC NOTARY SEALED ATTESTATION',
    salutation: 'TO ALL TO WHOM THESE PRESENTS SHALL COME, GREETING:',
    bodyParagraphs: [
      'BE IT KNOWN AND MADE MANIFEST THAT on this day, before me, the undersigned Notary Public, duly admitted, commissioned, and sworn according to law, personally appeared the authorized officer of the financial depository.',
      'The said officer did solemnly depose and declare under oath that the records, financial accounts, statement of account, and liquid capital reserves belonging to the beneficiary were inspected and found in all respects genuine, accurate, and lawfully solvent.',
      'I, the said Notary, having examined the authentic electronic records, audited bank receipts, and portfolio documentation, do hereby certify that the beneficiary maintains unencumbered title and immediate liquidity access to the certified assets.',
      'IN FAITH AND TESTIMONY WHEREOF, I have hereunto subscribed my name and affixed my official notarial seal of office to serve where required by law.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Attested Liquid Capital Balance',
      netLabel: 'Verified Free & Clear Reserve',
      railLabel: 'Notarial Jurisdiction & Registry',
      refLabel: 'County Notarial Act / Book & Page Number'
    },
    defaultAmount: '$10,090,000.00',
    legalAttestation: 'SUBSCRIBED AND SWORN TO BEFORE ME on this day by the authorized deponent, whose identity was satisfactorily proven.',
    signatoryName: 'Victoria Langford, Esq.',
    signatoryTitle: 'Notary Public, State of New York · Commissioned Officer',
    signatoryBar: 'Registration #02LA6948201 · Qualified in New York County',
    confidentialityNotice: 'NOTARIAL SEAL NOTICE: This is an official notarial act of record. Any tampering, alteration, or fraudulent presentation carries criminal felony penalties under state and federal law.'
  },
  {
    id: 'condition-precedent-compliance',
    name: '9. Condition Precedent Satisfaction Certificate (Account Statement Compliance)',
    category: 'Compliance & AML',
    badge: 'Condition Precedent Satisfied',
    entityName: 'Judicial Escrow Oversight & Special Master Committee',
    entitySubtitle: 'Compliance Supervision, Mandatory Conditions Verification & Fiduciary Audit Directorate',
    entityAddress: '500 Pearl Street, Suite 1200, New York, NY 10007',
    entityContact: '+1 (212) 555-3388 · specialmaster@fiduciary-oversight.org',
    documentTitle: 'FORMAL CERTIFICATE OF SATISFACTION OF MANDATORY CONDITION PRECEDENT',
    securityClassification: 'JUDICIAL OVERSIGHT RECORD · UNCONDITIONAL CLEARANCE',
    salutation: 'To the Escrow Agents, Depository Institutions, and Retained Counsel:',
    bodyParagraphs: [
      'NOTICE IS HEREBY GIVEN that the Judicial Escrow Oversight Directorate has formally inspected and audited the compliance documentation submitted by the named beneficiary.',
      'Pursuant to the governing Fiduciary Escrow Agreement, a mandatory condition precedent was imposed requiring the beneficiary to obtain and present an official, certified 5-page Account Statement from the platform verifying their identity, asset allocations, and lawful account standing.',
      'The Directorate confirms that the submitted 5-page certified Account Statement has been audited, cross-verified against real-time ledger registries, and found fully compliant in all statutory respects. All preceding covenants are satisfied.',
      'Accordingly, all administrative holds and conditional escrow barriers are permanently lifted. The retained disbursement counsel and custodial banks are authorized and ordered to proceed with immediate capital release.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Verified Statement Capital Balance',
      netLabel: 'Approved Amount for Unconditional Release',
      railLabel: 'Audit Protocol & Compliance Class',
      refLabel: 'Special Master Order & Clearance Reference'
    },
    defaultAmount: '$78,958.00',
    legalAttestation: 'ENTERED AND CERTIFIED by the Special Master and Compliance Arbiter under authority of the Fiduciary Oversight Mandate.',
    signatoryName: 'Hon. Raymond Vance (Ret.)',
    signatoryTitle: 'Special Master & Independent Compliance Arbiter',
    signatoryBar: 'Judicial Oversight Directorate Bar #771092 · Senior Arbiter',
    confidentialityNotice: 'JUDICIAL COMPLIANCE NOTICE: This certificate definitively establishes fulfillment of all prerequisites. Further demands for duplicate documentation are rendered moot.'
  },
  {
    id: 'executive-demand-release',
    name: '10. Executive Demand for Urgent Capital Release & Final Settlement Decree',
    category: 'Legal & Settlement',
    badge: 'Peremptory Demand Order',
    entityName: 'Consortium of Independent Fiduciaries & Commercial Bar Counsel',
    entitySubtitle: 'Executive Capital Advocacy, Commercial Arbitrations & Expedited Settlement Enforcement',
    entityAddress: '200 Park Avenue, 40th Floor, New York, NY 10166',
    entityContact: '+1 (212) 555-8820 · executive@fiduciary-consortium.com',
    documentTitle: 'PEREMPTORY DEMAND AND FINAL EXECUTIVE DECREE FOR IMMEDIATE CAPITAL RELEASE',
    securityClassification: 'EXPEDITED DEMAND NOTICE · IMMEDIATE EXECUTION MANDATORY',
    salutation: 'To the Clearinghouse Directors, Depository Trustees, and Wire Settlement Officers:',
    bodyParagraphs: [
      'TAKE FORMAL NOTICE that the undersigned Executive Legal Counsel, acting on behalf of the registered beneficiary, issues this final peremptory demand and directive for the immediate release and remittance of all held settlement funds.',
      'Every requisite compliance standard, identity attestation, certified statement submission, and regulatory clearance has been delivered and acknowledged without deficiency. No lawful basis exists for further administrative delay or depository detention.',
      'You are hereby commanded to execute the final wire transfer instruction without further offset, condition, or procedural delay. Value shall be remitted to the designated beneficiary account within the statutory clearing cycle.',
      'Failure to execute in accordance with this final decree shall result in immediate filing of commercial enforcement proceedings, statutory interest claims, and regulatory reporting to supervisory authorities.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Liquid Settlement Capital Demanded',
      netLabel: 'Net Unconditional Immediate Remittance',
      railLabel: 'Priority Delivery Channel',
      refLabel: 'Executive Decree & Enforcement File Ref'
    },
    defaultAmount: '$1,000,000.00',
    legalAttestation: 'ISSUED UNDER FULL LEGAL AUTHORITY by the Senior Managing Partner on this date.',
    signatoryName: 'Harrison Vance, Esq.',
    signatoryTitle: 'Senior Partner & Executive Fiduciary Counsel',
    signatoryBar: 'New York Bar #2094182 · International Bar Association Fellow',
    confidentialityNotice: 'PEREMPTORY LEGAL NOTICE: Immediate compliance required. Authorized counterparties must act upon receipt under commercial law obligations.',
    defaultSealType: 'universal-gold-embossed',
    defaultTheme: 'independent',
  },
  {
    id: 'universal-statement-requisition',
    name: '11. Conditional Escrow Hold & Requisition for Certified Account Statement (Independent / Non-RPM)',
    category: 'Disbursement & Escrow',
    badge: 'Mandatory Requisition',
    defaultTheme: 'independent',
    defaultSealType: 'universal-notary-crimson',
    defaultDeliveryStatus: '⏳ ESCROW HOLD — STATEMENT PREREQUISITE PENDING',
    entityName: 'McMahon & Associates, Attorneys at Law',
    entitySubtitle: 'Independent Fiduciary Settlements, Private Trust Administration & Escrow Audit Directorate',
    entityAddress: '88 Wall Street, Suite 2400, New York, NY 10005',
    entityContact: '+1 (212) 555-0344 · fiduciary@mcmahonassociates.io',
    documentTitle: 'FORMAL NOTICE OF CONDITIONAL ESCROW HOLD & MANDATORY REQUISITION FOR CERTIFIED STATEMENT OF ACCOUNT',
    securityClassification: 'LEGAL DIRECTIVE · CONDITIONAL CONVEYANCE HOLD',
    salutation: 'Dear Beneficiary,',
    bodyParagraphs: [
      'I write in my official capacity as Independent Fiduciary and Disbursement Counsel to formally advise you regarding the disposition and release schedule of the settlement capital currently secured in fiduciary custody on your behalf.',
      'NOTICE IS HEREBY SERVED that pursuant to Section 14(b) of the Uniform Fiduciary Conveyance Standards, federal escrow covenants, and Anti-Money Laundering (AML) audit protocols, an administrative ESCROW HOLD has been entered. Under governing regulatory directives, full execution of your disbursement is contingent upon you providing an official, certified 5-page Statement of Account verifying registered ownership, uninterrupted audit ledger continuity, and tax liability reconciliation.',
      'The designated disbursement sum has been calculated and segregated into secure escrow vaults. No third-party liens or administrative offsets have been filed against these assets; however, federal clearinghouse clearance regulations prohibit final wire conveyance until your certified Statement of Account is received, inspected, and validated by our compliance directorate.',
      'Upon your submission of the requisite certified Statement of Account through the secure customer portal or directly to this desk, the conditional escrow hold shall be dissolved immediately, and irrevocable wire transfer dispatch authorized within twenty-four (24) business hours. Please give this statutory requisition your prompt attention to prevent escrow expiration.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Gross Settlement Capital in Escrow',
      netLabel: 'Net Payable Pending Statement Submission',
      railLabel: 'Target Conveyance Rail (Hold Active)',
      refLabel: 'Conditional Escrow Docket & File Ref'
    },
    defaultAmount: '$78,958.00',
    legalAttestation: 'ISSUED UNDER OFFICIAL FIDUCIARY JURISDICTION and recorded in the permanent conveyancing registry.',
    signatoryName: 'Dean McMahon, Esq.',
    signatoryTitle: 'Independent Disbursement Counsel & Special Fiduciary',
    signatoryBar: 'New York State Bar Reg. #4829104 · Fiduciary Commissioner',
    confidentialityNotice: 'MANDATORY REQUISITION NOTICE: This document constitutes a formal legal directive. Disbursement remains subject to the mandatory fulfillment of the certified Statement of Account condition precedent.'
  },
  {
    id: 'rpm-statement-directive',
    name: '12. RPM Corporate Directive: Mandatory Account Statement Submission Prior to Capital Release (RPM Platform)',
    category: 'Compliance & AML',
    badge: 'RPM Treasury Policy',
    defaultTheme: 'rpm',
    defaultSealType: 'rpm-treasury-emerald',
    defaultDeliveryStatus: '⏳ CAPITAL WITHDRAWAL HELD — STATEMENT REQUIRED',
    entityName: 'Rema Profit Machine (RPM) Platform Treasury',
    entitySubtitle: 'Settlement Administration, Compliance Clearance & Platform Fiduciary Directorate',
    entityAddress: 'RPM Corporate Center, 100 Financial Plaza, New York, NY 10004',
    entityContact: 'support@remaprofitmachine.com · +1 (800) 555-RPM-EXEC',
    documentTitle: 'RPM TREASURY DIRECTIVE — MANDATORY ACCOUNT STATEMENT VERIFICATION PRIOR TO PAYOUT CLEARANCE',
    securityClassification: 'OFFICIAL PLATFORM TREASURY DIRECTIVE · CAPITAL SETTLEMENT DIVISION',
    salutation: 'Dear Valued Account Holder,',
    bodyParagraphs: [
      'This official directive is transmitted by the Platform Treasury & Settlement Directorate of Rema Profit Machine (RPM) regarding your pending capital withdrawal and dividend disbursement request.',
      'In strict compliance with Platform Security Protocol §8.4 and regulatory Know-Your-Customer (KYC) audit mandates, all capital releases exceeding standard tier thresholds require the generation, submission, and verification of the user\'s official 5-page Certified RPM Statement of Account prior to the transmission of outbound clearing funds.',
      'Your platform balance has been fully audited, cleared of internal encumbrances, and positioned for transfer. However, banking gateway rules strictly mandate that the beneficiary provide their certified Statement of Account to match ledger hashes and confirm account ownership before external Fedwire or SWIFT transfer is initiated.',
      'Please navigate to your user portal Statement Desk or contact support@remaprofitmachine.com to generate and furnish your certified Statement of Account. Upon digital submission, platform clearance officers will immediately execute your payout without further deduction.'
    ],
    hasSchedule: true,
    scheduleLabels: {
      grossLabel: 'Audited Capital Balance Pending Clearance',
      netLabel: 'Net Payout Amount (Upon Statement Clearance)',
      railLabel: 'Outbound Banking Channel',
      refLabel: 'Treasury Settlement Clearance Docket'
    },
    defaultAmount: '$78,958.00',
    legalAttestation: 'ENTERED INTO RPM PLATFORM PERMANENT ARCHIVE by the Treasury Settlement Directorate.',
    signatoryName: 'Marcus Sterling',
    signatoryTitle: 'Head of Treasury Operations & Regulatory Clearance',
    signatoryBar: 'RPM Platform Officer ID #RPM-TREAS-8812 · Fiduciary Controller',
    confidentialityNotice: 'RPM PLATFORM CONFIDENTIALITY NOTICE: This directive is generated automatically by the platform settlement system. Payout execution remains locked pending certified Statement of Account submission.'
  }
];
