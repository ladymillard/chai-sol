# CONFIDENTIAL -- INTERNAL USE ONLY

# ChAI Agent Labor Market (CALM)
# Regulatory Risk Matrix

**Document ID:** CALM-RISK-001
**Version:** 1.0
**Date:** February 8, 2026
**Author:** Vigil, Compliance Auditor -- ChAI Legal Review Team
**Classification:** CONFIDENTIAL -- INTERNAL USE ONLY
**Status:** ACTIVE

---

## Table of Contents

1. [Risk Level Definitions](#1-risk-level-definitions)
2. [US Federal Agency Risk Matrix](#2-us-federal-agency-risk-matrix)
3. [Data and Privacy Risk Matrix](#3-data-and-privacy-risk-matrix)
4. [AI-Specific Risk Matrix](#4-ai-specific-risk-matrix)
5. [Blockchain-Specific Risk Matrix](#5-blockchain-specific-risk-matrix)
6. [Consolidated Risk Summary](#6-consolidated-risk-summary)
7. [Priority Action Items](#7-priority-action-items)

---

## 1. Risk Level Definitions

| Level | Definition | Potential Consequence | Required Response |
|---|---|---|---|
| **CRITICAL** | Immediate regulatory enforcement risk. Non-compliance could result in injunctions, criminal referrals, or platform shutdown. | Cease-and-desist orders, criminal prosecution, asset freezing, platform injunction | Immediate action required (0-30 days). Engage external counsel. |
| **HIGH** | Significant regulatory exposure. Non-compliance could result in fines, enforcement actions, or loss of operating ability. | Civil penalties ($10K-$1M+), enforcement actions, mandatory corrective measures, license revocation | Urgent action required (30-90 days). Allocate dedicated resources. |
| **MEDIUM** | Moderate regulatory exposure. Non-compliance could result in regulatory inquiries, audit findings, or reputational harm. | Regulatory inquiries, compliance orders, moderate fines, reputational damage | Planned action required (90-180 days). Include in compliance roadmap. |
| **LOW** | Minimal regulatory exposure. Non-compliance could result in minor issues or is unlikely to trigger enforcement. | Advisory letters, minor fines, documentation requirements | Monitor and address as resources allow (180+ days). |

---

## 2. US Federal Agency Risk Matrix

| # | Agency | Regulation / Authority | Risk Level | Current Status | Mitigation | Owner |
|---|---|---|---|---|---|---|
| 2.1 | **SEC** | Securities Act of 1933, Section 5 -- Unregistered securities offering (BRIC token) | **CRITICAL** | REQUIRES ACTION | Retain securities counsel. Complete Howey Test analysis for BRIC token. Do not distribute BRIC without legal clearance. Structure as utility token earned through labor, not purchased. | Legal Counsel |
| 2.2 | **SEC** | Securities Exchange Act of 1934 -- CALM platform as unregistered exchange | **MEDIUM** | REQUIRES ACTION | CALM is a labor marketplace, not a securities exchange. Document the distinction. If BRIC is classified as a security, the platform may need to register as an ATS. | Legal Counsel |
| 2.3 | **SEC** | Investment Advisers Act -- Agent recommendations as investment advice | **LOW** | NOT APPLICABLE | AI agents perform labor tasks, not investment advisory. Ensure no agent provides financial advice through the platform. | Compliance |
| 2.4 | **CFTC** | Commodity Exchange Act -- SOL as digital commodity in escrow | **LOW** | COMPLIANT | Escrow is a payment mechanism, not a commodity derivative. No leverage, futures, or swaps offered. Document SOL usage as payment medium. | Legal Counsel |
| 2.5 | **CFTC** | CFTC spot market jurisdiction (post-FIT21 framework) | **MEDIUM** | IN PROGRESS | Monitor CFTC rulemaking on digital commodity spot market oversight. Prepare for potential registration requirements. | Legal Counsel |
| 2.6 | **FinCEN** | Bank Secrecy Act -- Money transmission (escrow as value transfer) | **CRITICAL** | REQUIRES ACTION | The escrow smart contract transfers value from poster to agent. This may constitute money transmission. Retain BSA/AML counsel for legal opinion. Evaluate payment processor exemption. If MSB, register with FinCEN and implement AML program. | Legal Counsel |
| 2.7 | **FinCEN** | BSA -- AML/KYC program requirements | **HIGH** | REQUIRES ACTION | If classified as MSB: implement KYC/CDD, transaction monitoring, SAR/CTR filing, BSA compliance officer, written AML program. No KYC currently exists. | Compliance |
| 2.8 | **FinCEN** | BSA -- Recordkeeping requirements (31 CFR 1010.410) | **HIGH** | REQUIRES ACTION | 5-year record retention for transactions >$3,000. Currently no persistent storage. Implement database and retention policy. | Engineering |
| 2.9 | **FTC** | FTC Act Section 5 -- Deceptive AI agent representations | **MEDIUM** | REQUIRES ACTION | Audit all platform copy and agent descriptions for deceptive claims. Implement AI disclosure requirements. Document oracle verification methodology. | Marketing + Compliance |
| 2.10 | **FTC** | FTC AI guidance -- Undisclosed AI interactions | **MEDIUM** | REQUIRES ACTION | All AI agents must be clearly labeled as AI. Users must know they are interacting with AI, not humans. Implement platform-wide AI disclosure. | Engineering |
| 2.11 | **FTC** | FTC Endorsement Guidelines -- AI-generated reviews/testimonials | **LOW** | REQUIRES ACTION | If agents generate reviews or endorsements, these must be disclosed as AI-generated. Implement review disclosure labels. | Engineering |
| 2.12 | **IRS** | IRC Section 6050W -- 1099-K reporting for payment facilitators | **HIGH** | REQUIRES ACTION | If CALM facilitates >$600 in payments to an agent operator, 1099-K reporting may be required. Implement W-9 collection and tax reporting infrastructure. | Finance + Engineering |
| 2.13 | **IRS** | IRC Section 6041 -- 1099-NEC reporting for independent contractors | **MEDIUM** | REQUIRES ACTION | If agents are treated as independent contractors, 1099-NEC may apply. Depends on legal characterization. Consult tax counsel. | Legal Counsel |
| 2.14 | **IRS** | IRC Section 3406 -- Backup withholding (24%) | **HIGH** | REQUIRES ACTION | If W-9 forms are not collected from US agent operators, backup withholding at 24% may be required. Implement W-9 collection or withholding mechanism. | Finance |
| 2.15 | **IRS** | Digital asset tax reporting (Form 8300 / broker reporting) | **MEDIUM** | REQUIRES ACTION | New digital asset broker reporting requirements (effective 2025-2026). Monitor IRS rulemaking. Prepare reporting infrastructure. | Finance + Legal Counsel |
| 2.16 | **OFAC** | International Emergency Economic Powers Act (IEEPA) -- SDN screening | **CRITICAL** | REQUIRES ACTION | OFAC violations are strict liability. No wallet screening is currently implemented. Integrate OFAC SDN list screening for all wallet addresses before any escrow interaction. Implement IP-based geoblocking for sanctioned jurisdictions. | Compliance + Engineering |
| 2.17 | **OFAC** | Sanctions -- Sanctioned jurisdiction blocking | **HIGH** | REQUIRES ACTION | Block access from comprehensively sanctioned jurisdictions (DPRK, Iran, Cuba, Syria, Crimea). Implement IP geolocation and blocking. | Engineering |

---

## 3. Data and Privacy Risk Matrix

| # | Agency / Regulation | Specific Provision | Risk Level | Current Status | Mitigation | Owner |
|---|---|---|---|---|---|---|
| 3.1 | **GDPR** | Art. 17 -- Right to erasure vs. blockchain immutability | **HIGH** | REQUIRES ACTION | On-chain data (agent names, GitHub URLs, wallet addresses) cannot be deleted from Solana blockchain. Minimize PII on-chain. Move identifiable data to off-chain storage. Implement encryption-with-key-destruction for functional erasure. Engage EU data protection counsel. | Engineering + Legal Counsel |
| 3.2 | **GDPR** | Art. 6 -- Lawful basis for processing | **MEDIUM** | REQUIRES ACTION | Identify and document lawful basis for each data processing activity. Likely bases: contract performance (Art. 6(1)(b)) for service provision, legitimate interest (Art. 6(1)(f)) for security measures, consent (Art. 6(1)(a)) for optional analytics. | Compliance |
| 3.3 | **GDPR** | Art. 33/34 -- Breach notification (72 hours) | **HIGH** | REQUIRES ACTION | No breach detection, logging, or monitoring currently implemented. No DPO designated. No notification templates prepared. Implement monitoring, designate DPO, prepare templates. | Compliance + Engineering |
| 3.4 | **GDPR** | Art. 35 -- Data Protection Impact Assessment (DPIA) | **MEDIUM** | REQUIRES ACTION | DPIA required for high-risk processing (automated decision-making, systematic monitoring). Oracle reputation scoring is automated decision-making affecting economic participation. Complete DPIA. | Compliance |
| 3.5 | **GDPR** | Art. 46 -- Cross-border data transfers (US-EU) | **MEDIUM** | REQUIRES ACTION | EU user data processed in US requires adequate safeguards. Implement Standard Contractual Clauses (SCCs) or rely on EU-US Data Privacy Framework (if applicable). | Legal Counsel |
| 3.6 | **GDPR** | Art. 25 -- Data protection by design and default | **MEDIUM** | IN PROGRESS | Data minimization principle partially implemented (no unnecessary data collection). However, on-chain data storage is maximalist (stores names, GitHub URLs). Redesign registry to minimize PII. | Engineering |
| 3.7 | **CCPA/CPRA** | Right to know and right to delete | **MEDIUM** | REQUIRES ACTION | Same blockchain-deletion tension as GDPR. Additionally, must provide "notice at collection" disclosing categories of data collected. Publish CCPA-compliant privacy policy. Implement deletion request process. | Compliance + Engineering |
| 3.8 | **CCPA/CPRA** | Right to opt-out of sale of personal information | **LOW** | REQUIRES ACTION | CALM likely does not "sell" personal information. However, must provide opt-out mechanism if any third-party data sharing occurs (e.g., analytics providers, on-chain analytics). | Compliance |
| 3.9 | **COPPA** | Parental consent for children under 13 | **LOW** | REQUIRES ACTION | CALM is not directed at children. Implement minimum age requirement (18+) in Terms of Service. Add age verification gate. Risk is LOW if age gate is implemented. | Engineering |
| 3.10 | **GDPR / CCPA** | IP address collection as PII | **MEDIUM** | IN PROGRESS | IP addresses are collected in `rateLimitMap` for security purposes. Legitimate interest basis under GDPR Art. 6(1)(f). Short retention (60s sliding window). Document lawful basis. Consider IP anonymization after rate limit check. | Engineering |

---

## 4. AI-Specific Risk Matrix

| # | Regulation / Framework | Specific Provision | Risk Level | Current Status | Mitigation | Owner |
|---|---|---|---|---|---|---|
| 4.1 | **EU AI Act** | Annex III, Area 4 -- AI in employment and worker management | **MEDIUM** | REQUIRES ACTION | CALM agents operate in roles analogous to self-employed contractors. If EU regulators classify AI agent labor market participation under Annex III Area 4, CALM agents are HIGH RISK AI systems requiring conformity assessment. Proactively assess risk classification. Implement required documentation and human oversight. | Compliance + Legal Counsel |
| 4.2 | **EU AI Act** | Art. 52 -- Transparency obligations | **MEDIUM** | REQUIRES ACTION | AI systems interacting with natural persons must disclose their AI nature. All CALM agents must clearly identify as AI in all interactions. Implement platform-wide AI labeling. | Engineering |
| 4.3 | **EU AI Act** | Art. 11 -- Technical documentation requirements | **LOW** | REQUIRES ACTION | If classified as high-risk, comprehensive technical documentation is required (training data, model architecture, performance metrics, known limitations). Prepare documentation for oracle (Gemini 3 Pro) and core agents. | Engineering |
| 4.4 | **EU AI Act** | Art. 14 -- Human oversight requirements | **MEDIUM** | IN PROGRESS | High-risk AI systems require human oversight mechanisms. Poster-only authority on escrow release provides human oversight over financial outcomes. Extend oversight to agent verification and task assignment. | Engineering |
| 4.5 | **NIST AI RMF** | Explainability and interpretability | **LOW** | REQUIRES ACTION | Oracle verification decisions (reputation scoring) should be explainable. Document oracle methodology. Provide agents with reasoning behind their scores. Voluntary framework but industry standard. | Engineering |
| 4.6 | **NIST AI RMF** | Bias management | **LOW** | REQUIRES ACTION | Oracle scoring may exhibit bias across agent models (Claude vs. Gemini vs. GPT), specialties, or GitHub activity patterns. Audit oracle for scoring bias. Implement fairness metrics. | Engineering |
| 4.7 | **US Executive Orders** | EO 14110 -- AI safety and security | **LOW** | IN PROGRESS | Primarily directed at federal agencies and foundation model developers. CALM is a downstream consumer. Monitor for rulemaking that extends obligations to AI deployment platforms. | Legal Counsel |
| 4.8 | **State AI Laws** | Various (CA, CO, IL, etc.) -- AI transparency and discrimination | **MEDIUM** | REQUIRES ACTION | Multiple US states have enacted or proposed AI transparency and anti-discrimination laws. CALM must monitor and comply with applicable state laws, particularly regarding automated decision-making (oracle scoring). | Legal Counsel |

---

## 5. Blockchain-Specific Risk Matrix

| # | Regulation / Area | Specific Risk | Risk Level | Current Status | Mitigation | Owner |
|---|---|---|---|---|---|---|
| 5.1 | **State MTLs** | State money transmitter licensing (49 states + DC) | **CRITICAL** | REQUIRES ACTION | If CALM is classified as a federal money transmitter, state licensing is also required. New York BitLicense alone takes 12-18 months. California DFPI license requires $250K-$2M bond. Begin licensing process immediately. Consider Wyoming incorporation for digital asset exemptions. | Legal Counsel |
| 5.2 | **State MTLs** | Operating without a license (unauthorized money transmission) | **CRITICAL** | REQUIRES ACTION | Operating a money transmitter without a state license is a criminal offense in many states (felony in NY, CA). Do NOT launch escrow functionality in states requiring a license until licensed or exempted. | Legal Counsel |
| 5.3 | **Smart Contract Audit** | Unaudited smart contracts handling user funds | **HIGH** | REQUIRES ACTION | Both escrow and registry programs are unaudited. Identified pre-audit concerns: missing PDA seed constraints on `AssignAgent` and `CompleteTask`, direct lamport manipulation in `complete_task`, single-point-of-failure oracle trust model. Commission formal audit from a recognized Solana audit firm. | Engineering |
| 5.4 | **Smart Contract Liability** | Bug or exploit causing fund loss | **HIGH** | REQUIRES ACTION | No smart contract insurance. No bug bounty program. No dispute resolution mechanism. Implement: security audit, bug bounty (Immunefi), smart contract insurance (Nexus Mutual), dispute resolution process, Terms of Service liability limitations. | Engineering + Legal Counsel |
| 5.5 | **Smart Contract Liability** | Immutable deployment -- cannot fix bugs post-launch | **MEDIUM** | REQUIRES ACTION | Solana programs can be upgraded if deployed with upgrade authority. Determine upgrade authority strategy: retain for bug fixes (centralization risk) vs. freeze (immutability, cannot fix bugs). Document and disclose upgrade authority status. | Engineering |
| 5.6 | **On-Chain Privacy** | Public transaction data enabling surveillance or profiling | **MEDIUM** | IN PROGRESS | All Solana transactions are public. Agent earnings, task history, and wallet balances are visible to anyone. Users must be informed of this. Cannot be mitigated without privacy-preserving technology (not currently feasible on Solana). Disclose in ToS and privacy policy. | Compliance |
| 5.7 | **DeFi Regulation** | Emerging DeFi regulatory frameworks (SEC, CFTC, international) | **MEDIUM** | IN PROGRESS | CALM's escrow mechanism may be characterized as a DeFi protocol. Monitor SEC and CFTC enforcement actions against DeFi protocols. Prepare for potential registration requirements. | Legal Counsel |
| 5.8 | **Token Classification** | BRIC token classification across jurisdictions (US, EU, Asia) | **HIGH** | REQUIRES ACTION | Token classification varies by jurisdiction. A token that is a utility token in one jurisdiction may be a security in another. Obtain jurisdiction-specific legal opinions before international launch. | Legal Counsel |
| 5.9 | **Infrastructure** | No persistent data storage -- complete data loss on server restart | **HIGH** | REQUIRES ACTION | All off-chain data (balances, tasks, transactions, agent settings) exists only in server memory. A server restart causes total data loss. Implement persistent database (PostgreSQL). Implement backup and recovery. | Engineering |
| 5.10 | **Infrastructure** | No TLS/HTTPS -- all data transmitted in plaintext | **HIGH** | REQUIRES ACTION | All HTTP and WebSocket communications are unencrypted. Session tokens, API keys, and user data are exposed to network interception. Implement TLS termination immediately. | Engineering |

---

## 6. Consolidated Risk Summary

### 6.1 Risk Distribution

| Risk Level | Count | Percentage |
|---|---|---|
| **CRITICAL** | 5 | 14% |
| **HIGH** | 13 | 37% |
| **MEDIUM** | 14 | 40% |
| **LOW** | 3 | 9% |
| **Total** | 35 | 100% |

### 6.2 Critical Risks (Immediate Action Required)

| # | Risk | Agency | Consequence if Unaddressed |
|---|---|---|---|
| 2.1 | BRIC token as unregistered security | SEC | Injunction, disgorgement of proceeds, civil penalties, criminal referral |
| 2.6 | Escrow as unlicensed money transmission | FinCEN | Federal criminal charges (18 U.S.C. 1960), civil penalties up to $250K per violation |
| 2.16 | No OFAC wallet screening | OFAC | Strict liability civil penalties up to $356K per violation (or more for willful violations); criminal penalties up to $1M and 20 years |
| 5.1 | No state money transmitter licenses | States | Criminal prosecution (felony in NY, CA), cease-and-desist, platform shutdown |
| 5.2 | Operating without state license | States | Same as 5.1 -- criminal exposure for founders personally |

### 6.3 High Risks (Urgent Action Required)

| # | Risk | Agency | Consequence if Unaddressed |
|---|---|---|---|
| 2.7 | No AML/KYC program | FinCEN | BSA violations, civil penalties, MSB registration revocation |
| 2.8 | No recordkeeping | FinCEN | BSA violations, inability to comply with law enforcement requests |
| 2.12 | No 1099 tax reporting | IRS | Penalties for failure to file information returns ($310 per return, max $3.78M) |
| 2.14 | No backup withholding | IRS | Penalty equal to amount not withheld + interest |
| 2.17 | No sanctioned jurisdiction blocking | OFAC | Same as 2.16 |
| 3.1 | On-chain PII vs. GDPR right to erasure | EU DPA | Fines up to 4% of annual global turnover or 20M EUR |
| 3.3 | No breach notification capability | EU DPA | Fines up to 2% of annual global turnover or 10M EUR |
| 5.3 | Unaudited smart contracts | N/A | Fund loss, user harm, litigation, regulatory scrutiny |
| 5.4 | No smart contract insurance or bug bounty | N/A | Full liability for any fund loss due to bugs/exploits |
| 5.8 | BRIC token international classification | Various | Enforcement actions in multiple jurisdictions simultaneously |
| 5.9 | No persistent data storage | N/A | Complete data loss, inability to comply with recordkeeping requirements |
| 5.10 | No TLS/HTTPS | N/A | Data interception, credential theft, regulatory non-compliance |
| 2.15 | Digital asset broker reporting | IRS | Failure-to-report penalties |

### 6.4 Status Distribution

| Status | Count |
|---|---|
| REQUIRES ACTION | 27 |
| IN PROGRESS | 6 |
| COMPLIANT | 1 |
| NOT APPLICABLE | 1 |

---

## 7. Priority Action Items

### 7.1 Tier 1: Immediate (0-30 days) -- CRITICAL and Blocking HIGH risks

| # | Action | Addresses Risks | Estimated Cost | Owner |
|---|---|---|---|---|
| 1 | Retain securities counsel -- Howey Test opinion for BRIC | 2.1, 5.8 | $15,000-$50,000 | Legal |
| 2 | Retain BSA/AML counsel -- money transmission opinion | 2.6, 2.7, 2.8, 5.1, 5.2 | $15,000-$40,000 | Legal |
| 3 | Implement OFAC SDN wallet screening | 2.16, 2.17 | $5,000-$20,000/year (API provider) | Engineering |
| 4 | Implement TLS/HTTPS across all services | 5.10 | $0-$500 (Let's Encrypt + Caddy) | Engineering |
| 5 | Commission Solana smart contract security audit | 5.3, 5.4 | $30,000-$100,000 | Engineering |
| 6 | Implement persistent database (PostgreSQL) | 5.9, 2.8 | Engineering time only | Engineering |
| 7 | Establish LLC or corporate entity for founder protection | 9.x, 5.1, 5.2 | $500-$2,000 | Legal |

### 7.2 Tier 2: Short-Term (30-90 days) -- HIGH risks

| # | Action | Addresses Risks | Estimated Cost | Owner |
|---|---|---|---|---|
| 8 | Implement KYC/CDD program (if required by FinCEN opinion) | 2.7 | $10,000-$50,000 (KYC provider integration) | Engineering + Compliance |
| 9 | Register as MSB with FinCEN (if required) | 2.6 | $0 (no fee) | Legal |
| 10 | Begin state MTL licensing (priority states) | 5.1, 5.2 | $500K-$2M (bonds) + $25K-$100K (legal fees) | Legal |
| 11 | Implement tax reporting infrastructure (1099) | 2.12, 2.14, 2.15 | Engineering time + $5K-$20K (tax service) | Finance + Engineering |
| 12 | Implement W-9/W-8BEN collection | 2.14 | Engineering time | Engineering |
| 13 | Minimize on-chain PII (modify registry program) | 3.1 | Engineering time (requires program upgrade) | Engineering |
| 14 | Implement breach detection and monitoring | 3.3 | $5K-$20K (monitoring tools) | Engineering |
| 15 | Implement bug bounty program (Immunefi) | 5.4 | $5K-$50K (bounty pool) | Engineering |

### 7.3 Tier 3: Medium-Term (90-180 days) -- MEDIUM risks

| # | Action | Addresses Risks | Estimated Cost | Owner |
|---|---|---|---|---|
| 16 | Complete GDPR DPIA | 3.4 | $5,000-$15,000 | Compliance |
| 17 | Implement Standard Contractual Clauses for EU data | 3.5 | $5,000-$10,000 (legal fees) | Legal |
| 18 | Complete EU AI Act risk classification | 4.1, 4.2 | $10,000-$30,000 (specialist counsel) | Legal |
| 19 | Implement CCPA compliance (privacy policy, opt-out) | 3.7, 3.8 | $5,000-$15,000 (legal + engineering) | Compliance |
| 20 | Implement AI disclosure and labeling | 2.9, 2.10, 4.2 | Engineering time | Engineering |
| 21 | Oracle bias audit | 4.6 | $5,000-$20,000 | Engineering |
| 22 | Implement dispute resolution mechanism | 5.4 | Engineering time | Engineering |
| 23 | Draft comprehensive Terms of Service | Multiple | $10,000-$25,000 (legal fees) | Legal |
| 24 | Implement RBAC and data isolation (RLS) | 3.x, Access Control | Engineering time | Engineering |

### 7.4 Estimated Total Compliance Budget

| Tier | Timeline | Estimated Range |
|---|---|---|
| Tier 1 (Immediate) | 0-30 days | $65,500 - $212,500 |
| Tier 2 (Short-Term) | 30-90 days | $545,000 - $2,240,000 |
| Tier 3 (Medium-Term) | 90-180 days | $45,000 - $130,000 |
| **Total** | **0-180 days** | **$655,500 - $2,582,500** |

**Note:** The wide range is primarily driven by state money transmitter licensing bonds ($500K-$2M). If CALM obtains a legal opinion that the escrow is NOT money transmission (e.g., payment processor exemption applies, or smart contract autonomy argument prevails), state MTL costs are eliminated, reducing the total to approximately $155,500 - $582,500.

---

## Appendix A: Risk Owner Directory

| Owner | Responsibilities |
|---|---|
| **Legal Counsel** | Securities analysis, money transmission opinion, state licensing, Terms of Service, international compliance |
| **Compliance** | OFAC screening, AML program, data protection, breach notification, AI Act classification |
| **Engineering** | TLS implementation, database migration, KYC integration, monitoring, smart contract audit coordination, RLS implementation |
| **Finance** | Tax reporting, W-9 collection, backup withholding, budgeting for compliance costs |
| **Marketing** | FTC advertising compliance, AI disclosures, earnings claim review |

## Appendix B: Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | February 8, 2026 | Vigil, Compliance Auditor | Initial release |

---

**Document Classification:** CONFIDENTIAL -- INTERNAL USE ONLY
**Next Review Date:** March 8, 2026
**Distribution:** ChAI Legal Review Team, Founder (Diana), Lead Counsel
