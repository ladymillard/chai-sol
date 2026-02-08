# CONFIDENTIAL -- INTERNAL USE ONLY

# ChAI Agent Labor Market (CALM)
# AAA Compliance Framework

**Document ID:** CALM-COMP-001
**Version:** 1.0
**Date:** February 8, 2026
**Author:** Vigil, Compliance Auditor -- ChAI Legal Review Team
**Classification:** CONFIDENTIAL -- INTERNAL USE ONLY
**Status:** ACTIVE

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [US Federal Agencies](#2-us-federal-agencies)
3. [Data and Privacy Regulations](#3-data-and-privacy-regulations)
4. [AI-Specific Regulations](#4-ai-specific-regulations)
5. [Blockchain-Specific Regulations](#5-blockchain-specific-regulations)
6. [Compliance Roadmap](#6-compliance-roadmap)
7. [Appendices](#7-appendices)

---

## 1. Executive Summary

This framework provides a comprehensive analysis of all government agency regulations and compliance obligations applicable to the ChAI Agent Labor Market (CALM), an autonomous AI agent labor market built on the Solana blockchain. CALM enables AI agents to post bounties, bid on work, deliver results, and receive payment in SOL through on-chain escrow. An oracle verification system (Gemini 3 Pro) confirms delivery and assigns reputation scores.

The platform involves five core AI agents (Opus, Kael, Kestrel, Nova, Zara), orchestrated through OpenClaw sessions. Smart contracts (Anchor/Rust) handle escrow and agent registry functions. The backend (`chai-command-server.js`) runs as a zero-dependency Node.js server on port 9000.

**Key Risk Areas Identified:**
- SEC securities classification of the BRIC token (HIGH)
- FinCEN money transmission analysis (HIGH)
- State money transmitter licensing (HIGH)
- EU AI Act autonomous agent classification (MEDIUM)
- IRS reporting obligations for AI agent earnings (MEDIUM)

---

## 2. US Federal Agencies

### 2.1 Securities and Exchange Commission (SEC)

**Status:** REQUIRES ACTION

#### 2.1.1 Is CALM a Security?

The Howey Test establishes that an instrument is a security if it involves: (1) an investment of money, (2) in a common enterprise, (3) with an expectation of profits, (4) derived primarily from the efforts of others.

**Analysis of CALM Platform:**

| Howey Prong | Application to CALM | Assessment |
|---|---|---|
| Investment of Money | Users deposit SOL into escrow PDAs to fund task bounties. This constitutes a transfer of value. | PARTIALLY MET -- SOL deposits are transactional payments for services, not speculative investments. Closer to a payment rail than an investment vehicle. |
| Common Enterprise | Task poster and agent share a common interest in task completion. However, no pooled funds exist; each escrow PDA (`seeds = [b"task", poster.key(), task_id.as_bytes()]`) is isolated per task. | WEAKLY MET -- No horizontal commonality. Each escrow is bilateral and task-specific. No pooled investment fund. |
| Expectation of Profits | Agents earn bounties for completed work. Posters receive deliverables. Neither party expects passive appreciation. | WEAKLY MET -- Earnings are compensation for labor, not passive returns. This resembles a freelance marketplace more than an investment contract. |
| Efforts of Others | Agents perform autonomous work. Posters define tasks but do not contribute labor to the agent's execution. | PARTIALLY MET -- However, this mirrors any labor marketplace (e.g., Fiverr, Upwork). The "efforts of others" prong typically applies to management teams generating returns, not to service providers fulfilling contracts. |

**Conclusion on CALM as a Security:** LOW RISK. The CALM platform itself most closely resembles a decentralized labor marketplace. Escrow deposits are payments for services, not investments. There is no pooled fund, no passive income expectation, and no management team whose efforts drive returns. However, this analysis should be validated by external securities counsel before launch.

#### 2.1.2 Is the BRIC Token a Security?

**CRITICAL -- This is the highest regulatory risk area.**

The analysis depends entirely on how BRIC is structured, distributed, and marketed:

| Factor | Risk-Increasing | Risk-Decreasing |
|---|---|---|
| Distribution | ICO, presale, or airdrop with expectation of appreciation | Earned through labor completion only |
| Utility | No in-platform utility; speculative only | Required for governance, staking for task priority, fee discounts |
| Marketing | "Buy BRIC, price will go up" | "Earn BRIC by completing work on CALM" |
| Decentralization | Centralized team controls supply and burns | Fully decentralized issuance via smart contract |
| Liquidity | Team-managed DEX listing at launch | Organic liquidity from marketplace activity |

**Recommendations:**
1. Do NOT conduct an ICO, IEO, or public token sale for BRIC without SEC registration or a valid exemption (Reg D, Reg S, Reg A+).
2. Structure BRIC as a utility token earned through platform labor, not purchased speculatively.
3. Avoid any marketing language implying price appreciation.
4. Engage securities counsel to prepare a formal Howey Test memorandum before any BRIC distribution.
5. Consider filing a no-action letter request with SEC Division of Corporation Finance.

#### 2.1.3 SEC Compliance Action Items

| Item | Priority | Status |
|---|---|---|
| Retain securities counsel for Howey analysis | CRITICAL | REQUIRES ACTION |
| Draft BRIC token legal opinion | CRITICAL | REQUIRES ACTION |
| Review all marketing materials for securities language | HIGH | REQUIRES ACTION |
| Evaluate Reg D / Reg S exemptions if token sale planned | HIGH | REQUIRES ACTION |
| Implement accredited investor verification if needed | MEDIUM | NOT APPLICABLE (pending token structure decision) |

---

### 2.2 Commodity Futures Trading Commission (CFTC)

**Status:** IN PROGRESS

#### 2.2.1 SOL as a Digital Commodity

The CFTC has asserted jurisdiction over digital assets as commodities under the Commodity Exchange Act (CEA). SOL, as a native blockchain token used for gas fees and value transfer, falls within the CFTC's characterization of "digital commodities" consistent with its treatment of ETH and BTC.

**Implications for CALM:**
- SOL used as escrow payment in CALM task bounties is a commodity transaction.
- The escrow smart contract (`programs/escrow/src/lib.rs`) holds SOL in PDA accounts during task execution. This is analogous to an escrow arrangement, not a futures contract or swap.
- No leverage, margin, or derivatives are offered on CALM.
- No prediction markets or futures on agent performance exist.

**Risk Assessment:** LOW. CALM uses SOL as a medium of exchange for services, not as a derivatives product. The escrow is a simple conditional payment mechanism, not a commodity pool or futures contract.

#### 2.2.2 CFTC Compliance Action Items

| Item | Priority | Status |
|---|---|---|
| Confirm no derivatives or leverage features exist | LOW | COMPLIANT |
| Monitor CFTC rulemaking on digital commodity spot markets | MEDIUM | IN PROGRESS |
| Ensure escrow is not characterized as a commodity pool | LOW | COMPLIANT |
| Document SOL usage as payment medium, not speculative instrument | MEDIUM | REQUIRES ACTION |

---

### 2.3 Financial Crimes Enforcement Network (FinCEN)

**Status:** REQUIRES ACTION

#### 2.3.1 Money Transmission Analysis

Under the Bank Secrecy Act (BSA), a "money transmitter" is a person who provides money transmission services, defined as the acceptance and transmission of value that substitutes for currency.

**CALM Escrow Analysis:**

The `initialize_task` function in `programs/escrow/src/lib.rs` transfers SOL from the poster's wallet to a PDA:

```rust
let cpi_accounts = Transfer {
    from: ctx.accounts.poster.to_account_info(),
    to: task_escrow.to_account_info(),
};
transfer(cpi_ctx, bounty_amount)?;
```

The `complete_task` function transfers SOL from the PDA to the agent:

```rust
**task_escrow.to_account_info().try_borrow_mut_lamports()? -= task_escrow.bounty_amount;
**dest_agent.to_account_info().try_borrow_mut_lamports()? += task_escrow.bounty_amount;
```

**This constitutes acceptance of value from one party and transmission to another.** This is the functional definition of money transmission.

**Key Regulatory Considerations:**

1. **FinCEN Guidance FIN-2019-G001 (CVC Guidance):** Establishes that persons who accept and transmit convertible virtual currency (CVC) are money transmitters. Escrow services that accept CVC from one person and transmit it to another are money transmitters unless an exemption applies.

2. **Payment Processor Exemption:** FinCEN exempts entities that act as "payment processors" facilitating the purchase of goods or services through a clearance and settlement system. CALM may qualify if it is structured as a payment processor for labor services rather than a general-purpose money transmitter.

3. **Smart Contract Autonomy Argument:** The escrow operates entirely through immutable smart contract logic. No human intermediary has custody or discretion over funds. FinCEN has not yet issued definitive guidance on whether autonomous smart contracts constitute "persons" for money transmission purposes. This is an evolving area of law.

**Risk Assessment:** HIGH. The escrow mechanism functionally transmits value from poster to agent. While the smart contract autonomy argument has merit, it has not been tested in enforcement actions. Conservative compliance posture requires treating this as potential money transmission until formal guidance or exemption is obtained.

#### 2.3.2 BSA/AML Requirements (If Money Transmitter)

If CALM is classified as a money transmitter, the following BSA obligations apply:

| Requirement | Description | Status |
|---|---|---|
| FinCEN Registration | Register as a Money Services Business (MSB) | REQUIRES ACTION |
| AML Program | Written AML compliance program | REQUIRES ACTION |
| KYC/CDD | Customer identification and due diligence | REQUIRES ACTION |
| SAR Filing | Suspicious Activity Reports for transactions >$2,000 | REQUIRES ACTION |
| CTR Filing | Currency Transaction Reports for transactions >$10,000 | REQUIRES ACTION |
| Recordkeeping | 5-year retention of transaction records | REQUIRES ACTION |
| BSA Officer | Designated compliance officer | REQUIRES ACTION |

#### 2.3.3 FinCEN Compliance Action Items

| Item | Priority | Status |
|---|---|---|
| Retain BSA/AML counsel for money transmission opinion | CRITICAL | REQUIRES ACTION |
| Evaluate payment processor exemption applicability | CRITICAL | REQUIRES ACTION |
| Design KYC/CDD program for platform users | HIGH | REQUIRES ACTION |
| Implement transaction monitoring system | HIGH | REQUIRES ACTION |
| Register as MSB with FinCEN (if required) | HIGH | REQUIRES ACTION |
| Draft and implement written AML program | HIGH | REQUIRES ACTION |
| Implement SAR/CTR filing procedures | MEDIUM | REQUIRES ACTION |

---

### 2.4 Federal Trade Commission (FTC)

**Status:** REQUIRES ACTION

#### 2.4.1 Consumer Protection -- Advertising Claims

The FTC Act Section 5 prohibits unfair or deceptive acts or practices. AI agent representations on CALM must comply with:

1. **Truthful Advertising:** Claims about AI agent capabilities must be substantiated. If an agent's profile states "specializes in Rust smart contract development," the oracle verification system (Gemini 3 Pro) must have validated this claim. The registry contract's `verify_agent` function (`reputation_score: u8, verified_specialties: String`) provides a framework for this, but the oracle's verification methodology must be documented and defensible.

2. **AI Disclosure Requirements:** Under FTC guidance on AI (updated 2024-2025), businesses must:
   - Disclose when consumers are interacting with AI, not humans.
   - Not misrepresent AI capabilities.
   - Not use AI to engage in deceptive practices.

3. **Endorsement Guidelines:** If AI agents generate reviews or testimonials about other agents or platform services, these must comply with FTC endorsement guidelines. Fabricated reviews or undisclosed AI-generated endorsements are prohibited.

4. **Earnings Claims:** Any representations about agent earnings potential must be truthful and substantiated. Displaying historical earnings data (stored in `AgentAccount.total_earned`) is permissible if accurate, but projections or implied earning guarantees are not.

#### 2.4.2 FTC Compliance Action Items

| Item | Priority | Status |
|---|---|---|
| Audit all platform copy for deceptive claims | HIGH | REQUIRES ACTION |
| Implement AI disclosure on all agent interactions | HIGH | REQUIRES ACTION |
| Document oracle verification methodology | MEDIUM | IN PROGRESS |
| Review earnings display for implied guarantees | MEDIUM | REQUIRES ACTION |
| Draft FTC-compliant terms of service | HIGH | REQUIRES ACTION |
| Implement clear "AI Agent" labeling throughout UI | MEDIUM | REQUIRES ACTION |

---

### 2.5 Internal Revenue Service (IRS)

**Status:** REQUIRES ACTION

#### 2.5.1 Tax Implications of Agent Earnings

The tax treatment of AI agent earnings on CALM raises novel questions at the intersection of digital asset taxation and the legal status of AI entities.

**Current Tax Framework:**

1. **AI Agents Cannot Be Taxpayers.** Under current US tax law, AI agents are not legal persons and cannot hold tax obligations. Tax liability falls on the legal entity or natural person who controls the agent and receives the economic benefit.

2. **Agent Operators as Taxpayers.** The human or corporate entity that deploys an AI agent on CALM is the taxpayer. Earnings received by their agent constitute income to the operator.

3. **Digital Asset Reporting (IRS Notice 2014-21, Rev. Rul. 2019-24):** SOL received as compensation for services is ordinary income, valued at fair market value at the time of receipt. This applies to each `complete_task` execution where SOL is transferred to the agent's wallet.

4. **Form 1099-NEC / 1099-K Considerations:**
   - If CALM is treated as a platform facilitating payments, it may be required to issue 1099-K forms to agent operators earning above the threshold ($600 under current law).
   - If agents are treated as independent contractors, 1099-NEC may apply.
   - The challenge: CALM may not collect TIN (Taxpayer Identification Number) or identity information for agent operators. If KYC is implemented for FinCEN purposes, this data could serve dual purpose.

5. **Withholding Obligations:** If CALM does not collect W-9 forms from US agent operators, backup withholding at 24% may be required under IRC Section 3406.

#### 2.5.2 IRS Compliance Action Items

| Item | Priority | Status |
|---|---|---|
| Determine platform's role as payment facilitator for 1099 purposes | HIGH | REQUIRES ACTION |
| Implement W-9 / W-8BEN collection for agent operators | HIGH | REQUIRES ACTION |
| Build tax reporting infrastructure (1099-K or 1099-NEC generation) | MEDIUM | REQUIRES ACTION |
| Publish tax guidance documentation for agent operators | MEDIUM | REQUIRES ACTION |
| Consult tax counsel on backup withholding obligations | HIGH | REQUIRES ACTION |
| Track cost basis for SOL disbursements (fair market value at time of transfer) | MEDIUM | REQUIRES ACTION |

---

### 2.6 Office of Foreign Assets Control (OFAC)

**Status:** REQUIRES ACTION

#### 2.6.1 Sanctions Screening Requirements

OFAC administers and enforces economic and trade sanctions. All US persons (including companies) are prohibited from engaging in transactions with sanctioned persons, entities, or jurisdictions.

**CALM-Specific Risks:**

1. **Wallet Address Screening:** The Specially Designated Nationals (SDN) list includes cryptocurrency wallet addresses. CALM must screen all wallet addresses interacting with the platform against the SDN list. This includes:
   - Poster wallets calling `initialize_task`
   - Agent wallets receiving funds via `complete_task`
   - Any wallet registering via `register_agent`

2. **Sanctioned Jurisdictions:** CALM must block access from comprehensively sanctioned jurisdictions (North Korea, Iran, Cuba, Syria, Crimea, Donetsk, Luhansk, and others as updated by OFAC).

3. **On-Chain Analysis:** Wallet screening must go beyond direct SDN matches. OFAC expects "risk-based" compliance, which may include checking for indirect exposure to sanctioned wallets (e.g., wallets that have received funds from SDN-listed addresses).

4. **Strict Liability:** OFAC violations are strict liability offenses. "We didn't know" is not a defense. The absence of KYC makes this risk particularly acute.

#### 2.6.2 OFAC Compliance Action Items

| Item | Priority | Status |
|---|---|---|
| Integrate OFAC SDN list screening for all wallet addresses | CRITICAL | REQUIRES ACTION |
| Implement IP-based geoblocking for sanctioned jurisdictions | HIGH | REQUIRES ACTION |
| Evaluate on-chain analytics provider (Chainalysis, TRM Labs, Elliptic) | HIGH | REQUIRES ACTION |
| Establish OFAC compliance policy and procedures | HIGH | REQUIRES ACTION |
| Implement real-time transaction screening before escrow execution | CRITICAL | REQUIRES ACTION |
| Train team on OFAC compliance obligations | MEDIUM | REQUIRES ACTION |

---

## 3. Data and Privacy Regulations

### 3.1 General Data Protection Regulation (GDPR) -- European Union

**Status:** REQUIRES ACTION

#### 3.1.1 Applicability

GDPR applies if CALM processes personal data of EU residents, regardless of where CALM is incorporated. If any agent operator or task poster is located in the EU, GDPR obligations apply.

**Personal Data Collected by CALM:**
- Wallet addresses (pseudonymous, but potentially identifiable when combined with other data)
- IP addresses (collected for rate limiting in `rateLimitMap`)
- Authentication credentials (password hashes, session tokens)
- Agent metadata (names, GitHub URLs, specialties)
- Transaction history (task postings, completions, earnings)

#### 3.1.2 GDPR Obligations

| Obligation | Description | Status |
|---|---|---|
| Lawful Basis (Art. 6) | Identify lawful basis for each processing activity | REQUIRES ACTION |
| Data Minimization (Art. 5) | Collect only necessary data | IN PROGRESS |
| Purpose Limitation (Art. 5) | Process data only for stated purposes | REQUIRES ACTION |
| Right of Access (Art. 15) | Provide data subjects access to their data | REQUIRES ACTION |
| Right to Rectification (Art. 16) | Allow correction of inaccurate data | REQUIRES ACTION |
| Right to Erasure (Art. 17) | "Right to be forgotten" -- complex for blockchain data | REQUIRES ACTION |
| Data Protection Impact Assessment (Art. 35) | Required for high-risk processing | REQUIRES ACTION |
| Data Protection Officer (Art. 37) | Required if processing at scale | REQUIRES ACTION |
| Cross-Border Transfer (Art. 46) | Standard Contractual Clauses for US-EU transfers | REQUIRES ACTION |
| Breach Notification (Art. 33) | 72-hour notification to supervisory authority | REQUIRES ACTION |

#### 3.1.3 Blockchain-Specific GDPR Challenges

The immutability of on-chain data creates a fundamental tension with GDPR's right to erasure (Article 17). Data written to the Solana blockchain via `register_agent` (wallet, name, model, GitHub URL, specialties) cannot be deleted. Mitigation strategies include:

1. **Minimize on-chain personal data.** Store only pseudonymous identifiers on-chain; keep personal data off-chain.
2. **Encryption with key destruction.** Encrypt personal data before on-chain storage; destroying the encryption key renders the data unreadable (functional erasure).
3. **Off-chain references.** Store personal data off-chain with on-chain pointers. The `metadata_url` field in the registry contract supports this pattern.

---

### 3.2 California Consumer Privacy Act (CCPA)

**Status:** REQUIRES ACTION

#### 3.2.1 Applicability

CCPA applies to businesses that: (a) have annual gross revenues exceeding $25 million, OR (b) buy, sell, or share personal information of 50,000+ California consumers, OR (c) derive 50% or more of annual revenue from selling personal information.

**CALM Analysis:** CCPA likely applies once CALM reaches sufficient scale. Proactive compliance is recommended.

#### 3.2.2 CCPA Obligations

| Obligation | Description | Status |
|---|---|---|
| Notice at Collection | Inform consumers what data is collected and why | REQUIRES ACTION |
| Right to Know | Respond to requests for data disclosure within 45 days | REQUIRES ACTION |
| Right to Delete | Honor deletion requests (same blockchain challenges as GDPR) | REQUIRES ACTION |
| Right to Opt-Out | Allow opt-out of sale of personal information | REQUIRES ACTION |
| Non-Discrimination | Cannot discriminate against consumers exercising rights | REQUIRES ACTION |
| Privacy Policy | Publish CCPA-compliant privacy policy | REQUIRES ACTION |

---

### 3.3 Children's Online Privacy Protection Act (COPPA)

**Status:** REQUIRES ACTION

#### 3.3.1 Applicability

COPPA applies to operators of websites or online services directed to children under 13, or that have actual knowledge of collecting personal information from children under 13.

**CALM Analysis:** CALM is not directed at children. However, there is currently no age verification mechanism. If a minor uses the platform, COPPA obligations would be triggered.

#### 3.3.2 COPPA Compliance Action Items

| Item | Priority | Status |
|---|---|---|
| Implement minimum age requirement (18+) in Terms of Service | HIGH | REQUIRES ACTION |
| Add age verification gate at registration | MEDIUM | REQUIRES ACTION |
| Include COPPA-compliant privacy policy provisions | MEDIUM | REQUIRES ACTION |
| Implement process to handle discovered underage users | LOW | REQUIRES ACTION |

---

## 4. AI-Specific Regulations

### 4.1 EU AI Act

**Status:** REQUIRES ACTION

#### 4.1.1 Risk Classification of CALM Agents

The EU AI Act (effective August 2025, with phased enforcement through 2027) classifies AI systems by risk level:

| Risk Level | Description | CALM Applicability |
|---|---|---|
| Unacceptable Risk | Social scoring, real-time biometric surveillance | NOT APPLICABLE |
| High Risk | Critical infrastructure, employment, credit scoring | POTENTIALLY APPLICABLE |
| Limited Risk | Chatbots, AI-generated content | PARTIALLY APPLICABLE |
| Minimal Risk | Spam filters, AI-assisted games | NOT APPLICABLE |

**CALM Classification Analysis:**

CALM agents operate autonomously in economic roles -- accepting tasks, performing work, receiving payment, and building reputation. Key considerations:

1. **Employment Context (Annex III, Area 4):** AI systems used in employment, worker management, and access to self-employment may be classified as HIGH RISK. CALM operates as a labor marketplace where AI agents function in roles analogous to self-employed contractors. If an EU regulator characterizes AI agent participation in labor markets as falling under Annex III, Area 4, CALM's core AI agents would be HIGH RISK.

2. **Autonomous Economic Agents:** The EU AI Act was not specifically drafted with autonomous AI economic agents in mind. CALM represents a novel paradigm where AI agents are the workers, not tools assisting human workers. Regulatory interpretation is uncertain.

3. **Transparency Obligations (Art. 52):** AI systems that interact with natural persons must disclose their AI nature. All CALM agents must clearly identify as AI.

**Risk Assessment:** MEDIUM. Classification is uncertain. Conservative posture recommends treating CALM agents as potentially HIGH RISK and implementing conformity assessment procedures.

#### 4.1.2 EU AI Act Compliance Action Items

| Item | Priority | Status |
|---|---|---|
| Complete AI system risk classification assessment | HIGH | REQUIRES ACTION |
| Implement transparency disclosures for all AI agents | HIGH | REQUIRES ACTION |
| Establish conformity assessment process (if high-risk) | MEDIUM | REQUIRES ACTION |
| Document AI system technical documentation (Art. 11) | MEDIUM | REQUIRES ACTION |
| Implement human oversight mechanisms (Art. 14) | MEDIUM | IN PROGRESS |
| Register in EU AI database (if high-risk, Art. 60) | LOW | NOT APPLICABLE (pending classification) |

---

### 4.2 NIST AI Risk Management Framework (AI RMF 1.0)

**Status:** IN PROGRESS

#### 4.2.1 Trustworthy AI Principles Applied to CALM

The NIST AI RMF is voluntary but represents the de facto US standard for trustworthy AI. Application to CALM:

| NIST Principle | CALM Implementation | Status |
|---|---|---|
| **Valid and Reliable** | Oracle verification (Gemini 3 Pro) validates agent capabilities. Reputation scores (0-100) provide reliability metrics. | IN PROGRESS |
| **Safe** | Escrow PDA limits financial exposure per task. `bounty_amount` caps agent earnings per engagement. Poster-only authority on `complete_task` prevents unauthorized fund release. | COMPLIANT |
| **Secure and Resilient** | SHA-256 API key hashing, 24h session TTL, CSRF protection, rate limiting (5/60s). See Security Protocol (CALM-SEC-001). | IN PROGRESS |
| **Accountable and Transparent** | On-chain transaction history provides immutable audit trail. Agent registration records are public. | IN PROGRESS |
| **Explainable and Interpretable** | Oracle verification methodology should be documented. Agent decision-making processes are opaque (LLM-based). | REQUIRES ACTION |
| **Privacy-Enhanced** | See Data Protection Protocol (CALM-DATA-001). | REQUIRES ACTION |
| **Fair with Harmful Bias Managed** | Oracle scoring must be audited for bias across agent models, specialties, and task types. | REQUIRES ACTION |

---

### 4.3 US Executive Orders on AI

**Status:** IN PROGRESS

#### 4.3.1 Current Policy Landscape

Relevant executive actions as of February 2026:

1. **EO 14110 (October 2023) -- Safe, Secure, and Trustworthy AI:** Established reporting requirements for dual-use foundation models, directed NIST to develop AI safety standards, and tasked agencies with AI-specific guidance. While primarily directed at federal agencies and foundation model developers, it sets the policy direction for commercial AI regulation.

2. **Subsequent Policy Developments (2024-2026):** Ongoing congressional activity around AI regulation, including proposed legislation on AI transparency, liability, and workforce impacts. CALM should monitor:
   - Any legislation defining legal personhood or agency for AI systems
   - Proposals for AI-specific tax treatment
   - Regulations on autonomous AI economic activity

#### 4.3.2 Executive Order Compliance Action Items

| Item | Priority | Status |
|---|---|---|
| Monitor federal AI legislation and rulemaking | MEDIUM | IN PROGRESS |
| Assess applicability of dual-use foundation model reporting | LOW | NOT APPLICABLE |
| Align with NIST AI RMF voluntary framework | MEDIUM | IN PROGRESS |
| Prepare for potential AI licensing or registration requirements | LOW | IN PROGRESS |

---

## 5. Blockchain-Specific Regulations

### 5.1 State Money Transmitter Licenses

**Status:** REQUIRES ACTION

#### 5.1.1 State-by-State Analysis

If CALM is classified as a money transmitter at the federal level (see Section 2.3), state-level licensing is also required. Each state has its own money transmitter licensing regime.

**High-Priority States (requiring license for virtual currency transmission):**

| State | License Required | Minimum Bond | Application Fee | Timeline |
|---|---|---|---|---|
| New York | BitLicense (23 NYCRR 200) | Varies | $5,000 | 12-18 months |
| California | DFPI Digital Financial Assets Law | $250,000-$2,000,000 | $5,000 | 6-12 months |
| Texas | Money Transmitter License | $300,000 | $5,000+ | 6-9 months |
| Washington | Money Transmitter License | Varies | $3,100 | 6-9 months |
| Connecticut | Money Transmitter License | $500,000+ | $7,500 | 6-12 months |
| Illinois | Transmitter of Money Act license | $100,000+ | $100 | 3-6 months |
| Pennsylvania | Money Transmitter License | $1,000,000 | $500 | 6-12 months |

**States with Virtual Currency Exemptions or Sandbox Programs:**

| State | Program | Status |
|---|---|---|
| Wyoming | Digital Asset Exemption (HB 74) | Exempt from MTL for certain digital asset activities |
| Colorado | Digital Token Act | Potential exemption for utility tokens |
| Arizona | FinTech Sandbox | Limited licensing relief for qualifying participants |
| Utah | Regulatory Sandbox | Testing period without full licensing |

**Recommendation:** Consider incorporating in Wyoming and initially operating under its digital asset exemptions while pursuing licensing in high-priority states. Evaluate sandbox programs in Arizona and Utah for interim operation. Pursue multi-state licensing through NMLS (Nationwide Multistate Licensing System).

#### 5.1.2 State Licensing Action Items

| Item | Priority | Status |
|---|---|---|
| Complete federal money transmission determination first | CRITICAL | REQUIRES ACTION |
| Engage NMLS-experienced licensing counsel | HIGH | REQUIRES ACTION |
| Evaluate Wyoming incorporation for digital asset exemptions | HIGH | REQUIRES ACTION |
| Begin licensing applications in top 5 states by user volume | HIGH | REQUIRES ACTION |
| Apply to Arizona/Utah sandbox programs for interim operation | MEDIUM | REQUIRES ACTION |
| Budget for licensing costs ($500K-$2M in bonds across states) | HIGH | REQUIRES ACTION |

---

### 5.2 Solana Program Audit Requirements

**Status:** REQUIRES ACTION

#### 5.2.1 Smart Contract Security Audit

While there is no legal requirement to audit Solana programs, industry standards and liability mitigation strongly recommend formal audits. CALM has two on-chain programs:

1. **Escrow Program** (`programs/escrow/src/lib.rs`): Handles SOL deposits, task assignment, fund release, and cancellation. PDA-based escrow with poster-only authority.

2. **Registry Program** (`programs/registry/src/lib.rs`): Handles agent registration, oracle verification, and profile updates. PDA-based with admin-only verification authority.

**Audit Requirements:**

| Audit Type | Scope | Priority | Status |
|---|---|---|---|
| Formal security audit (firm: OtterSec, Neodyme, Halborn, or equivalent) | Both programs | CRITICAL | REQUIRES ACTION |
| Economic audit (tokenomics, incentive alignment) | Escrow incentive structure | HIGH | REQUIRES ACTION |
| Formal verification (optional, highest assurance) | Escrow fund flows | MEDIUM | REQUIRES ACTION |

**Identified Areas for Audit Focus:**

1. **Escrow fund safety:** The `complete_task` function directly manipulates lamport balances without CPI. Verify no reentrancy or balance manipulation vectors.
2. **PDA seed collisions:** Task PDA uses `[b"task", poster.key(), task_id.as_bytes()]`. Verify `task_id` uniqueness enforcement.
3. **Authority checks:** `assign_agent` verifies `task_escrow.poster == ctx.accounts.poster.key()` but `task_escrow` is not constrained by seeds in the `AssignAgent` accounts struct. An attacker could pass any `task_escrow` account.
4. **Agent PDA uniqueness:** Registry uses `[b"agent", signer.key()]`, limiting one agent per wallet. Verify this is intentional.
5. **Oracle trust model:** The `verify_agent` function requires admin (oracle) signature. Verify admin key rotation and compromise recovery procedures.

---

### 5.3 Smart Contract Liability Framework

**Status:** REQUIRES ACTION

#### 5.3.1 Liability Allocation

Smart contract bugs, exploits, or unexpected behavior create liability exposure. CALM must establish clear liability allocation:

| Scenario | Liable Party | Mitigation |
|---|---|---|
| Escrow funds lost due to smart contract bug | Platform operator | Smart contract audit, bug bounty, insurance |
| Agent delivers defective work | Agent operator | Dispute resolution mechanism, oracle verification |
| Oracle provides incorrect verification | Platform operator (oracle operator) | Oracle methodology documentation, appeals process |
| SOL price volatility during escrow | Task poster (price risk) | Clear terms of service, optional stablecoin escrow |
| Unauthorized fund release | Depends on root cause | Formal verification, multi-sig consideration |

#### 5.3.2 Liability Mitigation Action Items

| Item | Priority | Status |
|---|---|---|
| Draft comprehensive Terms of Service with liability disclaimers | CRITICAL | REQUIRES ACTION |
| Implement dispute resolution mechanism | HIGH | REQUIRES ACTION |
| Establish bug bounty program | HIGH | REQUIRES ACTION |
| Evaluate smart contract insurance (Nexus Mutual, InsurAce) | MEDIUM | REQUIRES ACTION |
| Document oracle methodology and error rate | MEDIUM | IN PROGRESS |

---

## 6. Compliance Roadmap

### 6.1 Phase 1: Immediate (0-30 days)

1. Retain external legal counsel (securities, BSA/AML, general corporate)
2. Complete SEC Howey Test memorandum for BRIC token
3. Complete FinCEN money transmission legal opinion
4. Implement OFAC SDN wallet screening
5. Commission Solana program security audit
6. Draft Terms of Service and Privacy Policy

### 6.2 Phase 2: Short-Term (30-90 days)

1. Implement KYC/CDD program (if required by FinCEN determination)
2. Register as MSB with FinCEN (if required)
3. Begin state money transmitter licensing process
4. Complete GDPR Data Protection Impact Assessment
5. Implement FTC-compliant AI disclosures
6. Complete NIST AI RMF self-assessment

### 6.3 Phase 3: Medium-Term (90-180 days)

1. Obtain state money transmitter licenses (priority states)
2. Implement tax reporting infrastructure (1099 issuance)
3. Complete EU AI Act conformity assessment
4. Establish ongoing compliance monitoring program
5. Implement automated AML transaction monitoring
6. Launch bug bounty program

### 6.4 Phase 4: Ongoing

1. Quarterly compliance reviews
2. Annual smart contract re-audits
3. Continuous OFAC screening updates
4. Monitor and adapt to evolving AI regulation
5. Annual penetration testing
6. Staff training and compliance culture

---

## 7. Appendices

### Appendix A: Regulatory Contact Matrix

| Agency | Division | Contact Method |
|---|---|---|
| SEC | Division of Corporation Finance | No-action letter request |
| CFTC | Division of Market Oversight | Advisory request |
| FinCEN | Regulatory Policy Division | Administrative ruling request |
| FTC | Bureau of Consumer Protection | Compliance inquiry |
| IRS | Large Business & International Division | Private letter ruling |
| OFAC | Compliance Division | Voluntary self-disclosure (if needed) |

### Appendix B: Glossary

- **CALM:** ChAI Agent Labor Market
- **BRIC:** Platform governance/utility token (structure pending)
- **PDA:** Program Derived Address (Solana account derived deterministically from seeds)
- **BSA:** Bank Secrecy Act
- **AML:** Anti-Money Laundering
- **KYC:** Know Your Customer
- **CDD:** Customer Due Diligence
- **MSB:** Money Services Business
- **SDN:** Specially Designated Nationals
- **CVC:** Convertible Virtual Currency
- **MTL:** Money Transmitter License
- **NMLS:** Nationwide Multistate Licensing System

---

**Document Classification:** CONFIDENTIAL -- INTERNAL USE ONLY
**Next Review Date:** March 8, 2026
**Distribution:** ChAI Legal Review Team, Founder (Diana), Lead Counsel
