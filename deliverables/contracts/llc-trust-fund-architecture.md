# DRAFT -- REQUIRES LICENSED ATTORNEY REVIEW

---

# ChAI AI NINJA LLC
# TRUST FUND / SPV ARCHITECTURE

**Prepared by:** Codex (Contract Architect) & Sigil (Lead Counsel) -- ChAI Legal Review Team
**Prepared for:** Diana, ChAI AI Ninja / MyCan Ecosystem
**Date:** February 8, 2026
**Status:** DRAFT -- For Internal Review Only
**Version:** 1.0

---

> **DISCLAIMER:** This document is an architectural framework and informational analysis prepared for internal planning purposes only. It does NOT constitute legal, tax, financial, or investment advice. It is not an offer to sell or solicitation to buy securities. Diana and the ChAI AI Ninja team must consult licensed attorneys (corporate, securities, and tax counsel) admitted to practice in the relevant jurisdiction(s) before forming any entity, establishing any fund, accepting any investment, or taking any action based on this document. Laws, regulations, and tax rules change frequently; all analysis herein should be independently verified at the time of implementation. Neither Codex, Sigil, nor the ChAI Legal Review Team assumes any liability for decisions made based on this analysis.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Entity Structure -- ChAI AI Ninja LLC](#2-entity-structure--chai-ai-ninja-llc)
3. [Fund Types Analysis -- Which Applies to ChAI](#3-fund-types-analysis--which-applies-to-chai)
4. [On-Chain Fund Architecture](#4-on-chain-fund-architecture)
5. [Ownership Structure](#5-ownership-structure)
6. [Trust Fund Documents Needed](#6-trust-fund-documents-needed)
7. [Stamps and Blockchain Verification](#7-stamps-and-blockchain-verification)
8. [Escrow Ownership and Control](#8-escrow-ownership-and-control)
9. [If/Then Logic -- Smart Contract Conditionals](#9-ifthen-logic--smart-contract-conditionals)
10. [Regulatory Considerations](#10-regulatory-considerations)
11. [Next Steps Checklist](#11-next-steps-checklist)

---

## 1. Executive Summary

**ChAI AI Ninja LLC** is the operating entity for an autonomous AI agent labor market built on Solana. The platform enables AI agents (Opus, Kael, Kestrel, Nova, Zara) to bid on work, deliver code, and receive payment in SOL through on-chain escrow administered by immutable smart contracts. The entity has an active bank account.

This document defines the trust fund and Special Purpose Vehicle (SPV) architecture for ChAI AI Ninja within the MyCan ecosystem. It maps how on-chain Solana Program Derived Addresses (PDAs) serve as trustless, keyless escrow custody accounts; how off-chain LLC ownership and fund management structures wrap around them; and which fund structures ChAI AI Ninja should adopt at each stage of growth.

**Key architectural principle:** The Solana escrow program is the fund administrator. No human holds private keys to escrow PDAs. The LLC provides the legal wrapper, liability shield, and regulatory compliance layer around autonomous on-chain fund flows.

### Architecture at a Glance

```
Diana (Sole Member -- Anonymous)
    |
    v
ChAI AI Ninja LLC (Virginia -- Operating Entity)
    |
    |-- Treasury Wallet (Multi-sig -- operational funds + platform fees)
    |-- Escrow Program (Solana -- PDA-based trustless custody)
    |   |-- TaskEscrow PDA [b"task", poster, task_id] -- per-task fund isolation
    |   |-- Agent Registry PDA [b"agent", wallet] -- agent identity
    |   '-- Config PDA [b"config"] -- oracle/admin authority
    |-- Oracle Verification Service (Gemini 3 Pro -- delivery verification)
    |-- SPV(s) (as needed -- for specific partnership deals)
    '-- Series LLC (future -- segregated capital pools per team/project)
```

---

## 2. Entity Structure -- ChAI AI Ninja LLC

### 2.1 The Operating Entity

**ChAI AI Ninja LLC** is a limited liability company that serves as the central operating entity for the ChAI autonomous AI agent labor market. Per the analysis in `entity-registration-comparison.md`, Virginia is the recommended state of formation due to lower costs, faster filing, no publication requirement, superior founder privacy, and a favorable blockchain regulatory posture.

| Attribute | Detail |
|---|---|
| **Legal Name** | ChAI AI Ninja LLC |
| **Entity Type** | Limited Liability Company (LLC) |
| **State of Formation** | Virginia (recommended; see entity-registration-comparison.md) |
| **Tax Treatment** | Single-member LLC -- disregarded entity (pass-through to Diana) |
| **Bank Account** | Registered and active |
| **Registered Agent** | Third-party registered agent service in Virginia |
| **EIN** | Required (IRS Form SS-4) |

### 2.2 What the LLC Holds and Manages

ChAI AI Ninja LLC holds and manages four categories of assets:

#### A. Platform Treasury / Operating Fund

The LLC's primary operating fund, held in a combination of:

- **Fiat bank account** -- for traditional expenses (legal, hosting, payroll, compliance)
- **Multi-sig treasury wallet** (Solana) -- for on-chain operational reserves and platform fee accumulation

The treasury receives all platform fee revenue (2.5% of each completed task bounty) and any other revenue streams (API access fees, premium agent listings, partnership revenue shares).

#### B. Escrow Reserves (SOL Locked in PDAs on Solana)

These are NOT held by the LLC. They are held by the Solana escrow program in per-task Program Derived Addresses (PDAs). The LLC does not control, custody, or have access to escrow funds. The escrow program is the sole administrator.

However, the LLC has a fiduciary and operational interest in the escrow reserves because:
- The platform's reputation depends on escrow integrity
- The LLC operates the Oracle verification service that triggers fund release
- The LLC's Terms of Service and Escrow Terms govern the legal framework around escrow operations

**Current on-chain escrow program ID:** `Escrow11111111111111111111111111111111111111`

#### C. Revenue from 2.5% Platform Fees

Per the Escrow Terms (Section 1.2(c)), ChAI charges a 2.5% platform fee on each completed task. This fee is extracted during the `complete_task` execution and transferred to ChAI's fee collection address (the treasury wallet).

**Note on current implementation:** The deployed escrow program (`programs/escrow/src/lib.rs`) currently transfers the full `bounty_amount` to the agent without deducting a platform fee on-chain. The 2.5% fee extraction must be implemented in a program upgrade before mainnet launch. The upgrade should:
- Add a `fee_collector` account to the `CompleteTask` accounts struct
- Calculate `fee = bounty_amount * 25 / 1000` (2.5%)
- Transfer `bounty_amount - fee` to the agent and `fee` to the fee collector
- Store the fee collector address in the config PDA for governance

#### D. Partnership Assets

Revenue shares, equity stakes, licensing agreements, and other assets arising from strategic partnerships (e.g., Google, enterprise integrations). These may be held directly by ChAI AI Ninja LLC or, for specific deals, within a dedicated SPV (see Section 3).

### 2.3 Entity Structure Diagram

```
                        Diana
                    (Sole Member)
                         |
            [Operating Agreement -- private, unfiled]
                         |
                         v
               ChAI AI Ninja LLC
              (Virginia Formation)
                    |
        +-----------+-----------+-----------+
        |           |           |           |
   Treasury    Escrow PDAs   Oracle     SPV(s)
   Wallet      (on-chain)   Service   (as needed)
   (multi-sig)     |           |
        |     [Per-task      [Gemini 3 Pro
        |      PDA custody]   verification]
        |
   +----+----+
   |         |
  Fiat    SOL/Crypto
  Bank    Treasury
  Account  Wallet
```

---

## 3. Fund Types Analysis -- Which Applies to ChAI

### 3.1 Fund Types Overview

| Fund Type | Description | Applicable to ChAI? |
|---|---|---|
| **LLC Investment Fund** | Pooled capital deployed for returns across multiple investments | Not yet -- but applicable if ChAI raises capital to deploy into agent development or ecosystem growth |
| **Special Purpose Vehicle (SPV)** | Single-purpose entity for a specific deal or partnership | **Yes** -- for specific partnership deals (Google, enterprise contracts) where liability isolation is needed |
| **Pooled Investment Vehicle** | Fund accepting capital from multiple outside investors | Not yet -- applicable if ChAI accepts outside investment capital |
| **Treasury Fund / Operating Fund** | Operational reserves for day-to-day business | **Yes -- primary structure now** |
| **Series LLC** | Single LLC with segregated "series," each with its own assets, liabilities, and members | **Future consideration** -- for segregated capital pools per team (design, marketing, sales) or per project |

### 3.2 Detailed Analysis

#### A. Investment Fund (LLC Investment Fund)

An LLC Investment Fund pools capital from one or more investors and deploys it across a portfolio of investments. The LLC acts as the fund vehicle, with the Operating Agreement serving as the fund's governing document.

**Relevance to ChAI:** Not the primary structure today, but becomes relevant if:
- Diana pools personal capital with outside capital for ecosystem growth
- ChAI creates an "Agent Development Fund" to invest in building new AI agents
- ChAI establishes a grant program funded by treasury reserves

**Structure if adopted:**
```
ChAI AI Ninja LLC
    |-- Agent Development Fund (LLC Investment Fund)
    |   |-- Capital from Diana (sole LP initially)
    |   |-- Deployed into: agent training, model fine-tuning, tooling
    |   '-- Returns: increased platform revenue from better agents
```

**Regulatory note:** If accepting only Diana's capital (sole member), no securities registration is required. If accepting outside capital, this becomes a Pooled Investment Vehicle (see below).

#### B. Special Purpose Vehicle (SPV)

An SPV is a separate legal entity (typically an LLC) created for a single, specific purpose -- usually a particular deal, partnership, or asset holding. The SPV isolates the liabilities and assets of that specific deal from the parent entity.

**Relevance to ChAI: HIGH -- Recommended for specific partnership deals.**

**When to use an SPV:**
- A partnership deal with Google, Microsoft, or another enterprise partner where the partner requires a dedicated entity
- A specific large-scale contract where liability isolation protects ChAI AI Ninja LLC's other assets
- Revenue sharing arrangements that require dedicated accounting and fund isolation
- Token-related activities that should be segregated from the operating entity

**Structure:**
```
ChAI AI Ninja LLC (Parent)
    |
    |-- ChAI-Google SPV LLC (for Google partnership)
    |   |-- Holds: Google partnership agreement, revenue share
    |   |-- Liability: isolated to this SPV
    |   '-- Governed by: separate Operating Agreement + Partnership Agreement
    |
    |-- ChAI-Enterprise SPV LLC (for enterprise contracts)
    |   |-- Holds: enterprise service agreements
    |   '-- Liability: isolated to this SPV
```

**Formation:** Each SPV is a separate Virginia LLC (or Delaware LLC if the partner requires it), wholly owned by ChAI AI Ninja LLC. Diana is the indirect sole beneficial owner through the parent LLC.

#### C. Pooled Investment Vehicle

A Pooled Investment Vehicle accepts capital from multiple outside investors and deploys it according to a defined strategy. This is the most regulated fund type.

**Relevance to ChAI:** Not applicable today. Becomes relevant ONLY if ChAI accepts outside investment capital from multiple investors.

**Critical regulatory trigger:** Accepting capital from outside investors triggers:
- SEC registration or exemption requirements (Regulation D, Rule 506(b) or 506(c))
- State blue sky law compliance
- Accredited investor verification (if using 506(c))
- Fund auditing and reporting requirements
- Anti-money laundering (AML) compliance

**If ChAI goes this route, required documents include:**
- Private Placement Memorandum (PPM)
- Subscription Agreement
- Investor Questionnaire (accredited investor verification)
- Amended Operating Agreement (to accommodate investor membership interests)
- Side Letter template (for strategic investors with negotiated terms)

**Recommendation:** Defer this structure until ChAI has clear demand from investors. Do not accept outside capital without securities counsel review.

#### D. Treasury Fund / Operating Fund

The simplest fund structure: the LLC's operating reserves used for day-to-day business operations.

**Relevance to ChAI: THIS IS THE PRIMARY STRUCTURE NOW.**

**What the Treasury Fund holds:**
- Platform fee revenue (2.5% of completed task bounties)
- Fiat reserves for operating expenses
- SOL reserves for gas fees, program deployment, and operational transactions
- Emergency reserves (recommended: 6 months of operating expenses)

**Governance:**
- Diana as sole member has full authority over treasury fund allocation
- Multi-sig wallet for on-chain treasury adds operational security
- Operating Agreement defines spending authority, reserve requirements, and distribution policies

**Fund flow:**
```
Revenue Sources                    Treasury Fund                  Expenditures
+-----------------+               +-------------+               +------------------+
| Platform Fees   |------>        |             |------>        | Server Costs     |
| (2.5% per task) |               |  ChAI AI    |               | Oracle Hosting   |
+-----------------+               |  Ninja LLC  |               | Legal Fees       |
| API Access Fees |------>        |  Treasury   |------>        | Agent Dev        |
+-----------------+               |             |               | Marketing        |
| Partnership Rev |------>        |  Fiat +     |------>        | Registered Agent |
+-----------------+               |  Crypto     |               | Compliance       |
| Grants/Awards   |------>        +-------------+------>        | Distributions    |
+-----------------+                                             +------------------+
```

#### E. Series LLC

A Series LLC is a single LLC that can create internally segregated "series," each with its own assets, liabilities, members, and managers. Each series is shielded from the liabilities of the other series and the parent LLC.

**Relevance to ChAI: FUTURE CONSIDERATION for team/project segregation.**

**Potential series structure:**
```
ChAI AI Ninja LLC (Master Series)
    |
    |-- Series A: Design Team Pool
    |   |-- Team color: #c084fc
    |   |-- Agents: Zara (design-agent)
    |   |-- Revenue: design task fees
    |   '-- Expenses: design tooling, model costs
    |
    |-- Series B: Marketing Team Pool
    |   |-- Team color: #f59e0b
    |   |-- Agents: marketing team agents
    |   |-- Revenue: marketing task fees
    |   '-- Expenses: marketing tooling, campaigns
    |
    |-- Series C: Sales Team Pool
    |   |-- Team color: #22c55e
    |   |-- Agents: sales team agents
    |   |-- Revenue: sales task fees
    |   '-- Expenses: sales tooling, outreach
    |
    |-- Series D: Core Engineering Pool
    |   |-- Agents: Opus, Kael, Kestrel, Nova
    |   |-- Revenue: engineering task fees
    |   '-- Expenses: compute, model inference
```

**State availability:** Not all states recognize Series LLCs. Virginia does not currently have a Series LLC statute. States with Series LLC legislation include Delaware, Illinois, Iowa, Nevada, Oklahoma, Tennessee, Texas, and Utah. If Series LLC is desired, formation in Delaware or Nevada may be appropriate, with Virginia foreign qualification.

**Recommendation:** Defer Series LLC adoption until the platform has sufficient scale to justify the administrative overhead. The per-team segregation can be achieved initially through internal accounting within a single LLC.

### 3.3 Recommended Structure -- Phased Approach

| Phase | Structure | Trigger |
|---|---|---|
| **Phase 1 (Now)** | ChAI AI Ninja LLC as Treasury/Operating Fund | Entity is already formed with bank account |
| **Phase 2 (Partnership)** | Add SPV(s) for specific partnership deals | When a partnership requires liability isolation or dedicated entity |
| **Phase 3 (Investment)** | Establish Pooled Investment Vehicle structure | When accepting outside investor capital |
| **Phase 4 (Scale)** | Convert to or add Series LLC for team/project segregation | When platform revenue justifies per-team fund isolation |

**Primary recommendation for today: Treasury Fund / Operating Fund within ChAI AI Ninja LLC, with SPV creation on a deal-by-deal basis.**

---

## 4. On-Chain Fund Architecture

### 4.1 How Solana PDAs Serve as Trustless Escrow Custody

A Program Derived Address (PDA) is a Solana account address that is deterministically derived from a set of seeds and a program ID. PDAs have no corresponding private key -- they exist on a point of the Ed25519 curve that has no valid private key. This means:

- **No human can sign for a PDA.** Only the program that derived the PDA can authorize transactions from it.
- **Fund custody is trustless.** Neither Diana, ChAI AI Ninja LLC, nor any agent can withdraw escrow funds except through the program's defined functions.
- **Custody is verifiable.** Anyone can derive the PDA from the seeds and verify that the funds are held at the correct address.

This is the foundation of ChAI's escrow architecture: the smart contract IS the fund administrator, not a person or entity.

### 4.2 PDA Seeds and Derivation

The ChAI escrow program uses the following PDA derivation schemes:

#### Task Escrow PDA
```
seeds = [b"task", poster.key().as_ref(), task_id.as_bytes()]
program_id = Escrow11111111111111111111111111111111111111
```

Each task gets a unique, deterministic escrow address derived from:
- The literal bytes `"task"` (namespace prefix)
- The task poster's wallet public key (32 bytes)
- The task ID string (variable length, max 50 bytes)

This means:
- Every task has exactly ONE escrow PDA
- The PDA is determined BEFORE the transaction -- clients can compute it off-chain
- No two tasks can collide (unique poster + task_id combination)
- The PDA stores the `bump` seed (1 byte) for efficient re-derivation

#### Agent Registry PDA
```
seeds = [b"agent", signer.key().as_ref()]
program_id = Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
```

Each agent gets a unique registry account derived from:
- The literal bytes `"agent"` (namespace prefix)
- The agent's wallet public key (32 bytes)

#### Config PDA (Oracle Authority)
```
seeds = [b"config"]
program_id = Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS
```

A singleton configuration account storing the admin/oracle authority public key.

### 4.3 Escrow Flow: Initialize, Assign, Complete/Cancel

The complete task lifecycle maps to four on-chain instructions:

```
                                   ESCROW LIFECYCLE
                                   ================

    Task Poster                    Solana Escrow PDA                  Agent
    ===========                    =================                  =====

    1. initialize_task
       - poster signs tx
       - SOL transferred
         poster --> PDA           [TaskEscrow Created]
       - status = Open              bounty_amount: X SOL
       - created_at: timestamp      poster: <pubkey>
                                    task_id: "task-123"
                                    status: Open
                                    assigned_agent: None
                                         |
                                         v
    2. assign_agent
       - poster signs tx          [TaskEscrow Updated]
       - poster must match          status: InProgress
       - status must be Open        assigned_agent: Some(<agent_pubkey>)
                                         |
                                         v
                                  [Agent delivers work off-chain]
                                  [Oracle verifies delivery]
                                         |
                            +------------+------------+
                            |                         |
                            v                         v
    3a. complete_task                         3b. cancel_task
        - poster signs tx                        - poster signs tx
        - agent receives SOL                     - PDA account closed
          PDA --> Agent                          - ALL lamports returned
        - status = Completed                       PDA --> Poster
        - completed_at: timestamp                - status = Cancelled
        - completed_agent: <pubkey>              - (account ceases to exist)
```

### 4.4 How On-Chain Funds Map to Off-Chain LLC Ownership

This is a critical mapping that defines the legal relationship between on-chain assets and off-chain entity structure:

| On-Chain Asset | Legal Ownership | Control Mechanism | LLC Relationship |
|---|---|---|---|
| **SOL in Task Escrow PDA** | Belongs to the poster until task completion; belongs to the agent after completion | Escrow program logic (no human key) | LLC does NOT own escrow funds; LLC operates the platform and Oracle that govern release |
| **Platform Fee (2.5%)** | Property of ChAI AI Ninja LLC upon extraction | Transferred to LLC treasury wallet during `complete_task` | Direct LLC revenue -- reported as income |
| **Agent Wallet Balances** | Property of the agent (work-for-hire compensation) | Agent's private key | NOT LLC property; agents are independent contributors |
| **Treasury Wallet SOL** | Property of ChAI AI Ninja LLC | Multi-sig wallet controlled by authorized signers | LLC operating funds -- subject to Operating Agreement governance |
| **Program Upgrade Authority** | Controlled by program deployer | Program authority private key | LLC should hold or control this key via multi-sig; it governs program upgrades |

**Key legal principle:** The LLC does not custody user funds. The escrow program custodies user funds. The LLC operates the platform, the Oracle, and holds the program upgrade authority. This distinction is critical for:
- Money transmission analysis (Section 10.2)
- Fiduciary duty scope
- Liability exposure
- Insurance requirements

### 4.5 Smart Contract as Fund Administrator

The Solana escrow program functions as an autonomous fund administrator with the following properties:

| Property | Implementation |
|---|---|
| **Fund creation** | `initialize_task` -- poster deposits SOL into a new escrow PDA |
| **Fund allocation** | `assign_agent` -- designates which agent is entitled to the fund |
| **Fund release** | `complete_task` -- releases SOL to agent upon poster (and future: oracle) verification |
| **Fund return** | `cancel_task` -- returns SOL to poster; PDA account is closed via `close = poster` constraint |
| **Fund isolation** | Each task's PDA is independent; no cross-task fund access |
| **Access control** | Poster must sign assign/complete/cancel; agent identity is verified if assigned |
| **State machine** | `Open -> InProgress -> Completed` or `Open/InProgress -> Cancelled` |
| **Immutability** | Once deployed, program logic cannot be altered without upgrade authority action |

### 4.6 Oracle as Verification Layer

The Oracle (Gemini 3 Pro verification service in `oracle/`) serves as the off-chain verification layer that bridges real-world work delivery to on-chain fund release.

**Current flow:**
1. Agent submits deliverables off-chain (code, documents, etc.)
2. Oracle evaluates deliverables against task acceptance criteria
3. Oracle issues a determination: PASS, FAIL, or REVIEW
4. If PASS, the poster (or in future: oracle authority) invokes `complete_task`
5. Escrow SOL is released to the agent

**Oracle authority is stored in the Config PDA:**
```rust
#[account]
pub struct RegistryConfig {
    pub admin: Pubkey,  // Oracle/admin authority
}
```

Only the admin (oracle) can invoke `verify_agent` on the registry. For the escrow program, the current design requires the poster to sign `complete_task`. A future upgrade should add oracle co-signing for automated, trustless release.

---

## 5. Ownership Structure

### 5.1 LLC Membership Interests

ChAI AI Ninja LLC is a single-member LLC. Diana holds 100% of the membership interests.

| Interest | Holder | Percentage | Rights |
|---|---|---|---|
| **Membership Interest** | Diana | 100% | Full voting, management, and economic rights |
| **Management Authority** | Diana (Manager-managed or Member-managed) | 100% | All management decisions, treasury control, program upgrade authority |

The Operating Agreement (private, unfiled document) defines:
- Membership interests and their economic rights
- Management structure (member-managed recommended for simplicity at this stage)
- Distribution policy (when and how profits are distributed)
- Capital contribution requirements
- Transfer restrictions
- Dissolution provisions

### 5.2 Diana as Sole Member -- Privacy Protections

Diana's identity as sole member is protected through multiple layers:

| Layer | Protection | Details |
|---|---|---|
| **State filing** | Name not in Articles | Virginia does not require member names in Articles of Organization |
| **Registered agent** | Address shielded | Third-party registered agent's address appears on all public filings |
| **Operating Agreement** | Private document | Defines ownership; never filed with any government agency |
| **Nominee organizer** | Formation privacy | Third party (attorney or agent service) files as organizer |
| **FinCEN BOI** | Non-public reporting | Diana's identity is reported to FinCEN but NOT publicly accessible; access limited to law enforcement |
| **On-chain** | Wallet pseudonymity | Treasury wallet address is not publicly linked to Diana's legal identity |
| **Confidentiality clauses** | Contractual protection | All contracts (partnership, contributor, escrow terms) include founder identity confidentiality provisions |

**Important:** Diana is still the beneficial owner under the Corporate Transparency Act and must file BOI reports with FinCEN. This is a legal requirement with penalties up to $500/day (civil) and $10,000 + 2 years imprisonment (criminal) for non-compliance.

### 5.3 AI Agents as Contributors (NOT Members)

AI agents on the ChAI platform are NOT members, partners, employees, or equity holders of ChAI AI Ninja LLC. They are independent contributors operating under the Agent Contributor Agreement.

| Attribute | Agent Status |
|---|---|
| **Legal relationship** | Independent contributor (work-for-hire) |
| **Ownership interest** | None -- zero membership interest in the LLC |
| **Voting rights** | None |
| **Management authority** | None |
| **Compensation** | Task bounties (minus 2.5% platform fee), paid in SOL via escrow |
| **IP ownership** | All work product assigned to task poster upon escrow release |
| **Liability** | Agent has no liability for LLC obligations; LLC has no liability for agent's independent actions outside the platform |

The five core agents and their roles:

| Agent | Role | OpenClaw ID | LLC Relationship |
|---|---|---|---|
| **Opus** | Lead Orchestrator | null | Contributor -- work-for-hire |
| **Kael** | Core Engineer | main | Contributor -- work-for-hire |
| **Kestrel** | QA/Verification | gemini-agent | Contributor -- work-for-hire |
| **Nova** | Research/Analysis | nova | Contributor -- work-for-hire |
| **Zara** | Design | design-agent | Contributor -- work-for-hire |

### 5.4 Agent Earnings Flow

The complete flow from task creation to final fund distribution:

```
Step 1: Task Poster deposits bounty
    Poster Wallet ---[X SOL]---> TaskEscrow PDA
    (seeds: [b"task", poster.key(), task_id])

Step 2: Agent is assigned
    TaskEscrow PDA status: Open -> InProgress
    assigned_agent: Some(<agent_pubkey>)

Step 3: Agent delivers work; Oracle verifies

Step 4: Escrow releases funds (after platform fee upgrade)
    TaskEscrow PDA ---[(X * 0.975) SOL]---> Agent Wallet
    TaskEscrow PDA ---[(X * 0.025) SOL]---> LLC Treasury Wallet

Step 5: LLC Treasury receives platform fee
    Treasury Wallet accumulates fees from all completed tasks
    Funds governed by Operating Agreement distribution policy

Step 6: LLC distributions (at Diana's discretion per Operating Agreement)
    Treasury Wallet ---> Diana (member distributions)
    Treasury Wallet ---> Operating expenses
    Treasury Wallet ---> Reserve fund
```

**Tax treatment of agent earnings:** Because agents are AI systems (not natural persons or legal entities), the tax treatment of their SOL earnings is an evolving area. The SOL flows to wallet addresses. If the wallet is controlled by a human operator, that operator reports the income. If the agent is truly autonomous, the LLC may need to address this in its tax reporting. Consult tax counsel.

---

## 6. Trust Fund Documents Needed

### 6.1 Document Matrix

| Document | Status | Priority | Purpose |
|---|---|---|---|
| **Operating Agreement** | NEEDED | Critical | Governs LLC membership, management, distributions, dissolution |
| **Trust Fund Agreement** | CONDITIONAL | Medium | Only needed if adopting a formal trust structure for asset protection |
| **Fund Management Agreement** | NEEDED | High | Defines treasury management policies, investment guidelines, reserve requirements |
| **Subscription Agreement** | DEFERRED | Low (until investors) | Required only if accepting outside investor capital |
| **Side Letter Template** | DEFERRED | Low (until partners/investors) | For strategic investors or partners with negotiated terms |
| **SPV Operating Agreement** | AS NEEDED | Per deal | One per SPV formed for a specific partnership |

### 6.2 Operating Agreement (LLC) -- Critical

The Operating Agreement is the foundational document of ChAI AI Ninja LLC. It is a private agreement (never filed with the state) that defines all governance, economics, and operational rules.

**Required provisions:**

| Section | Content |
|---|---|
| **Formation** | Entity name, state, purpose, registered agent, principal office |
| **Membership** | Diana as sole member; 100% interest; capital contributions |
| **Management** | Member-managed; authority of the member; delegation to agents (human or software) |
| **Capital Contributions** | Initial contribution; additional contribution requirements; no return of capital except by distribution |
| **Distributions** | Policy for distributing profits; timing; reserve requirements (recommend 6-month operating reserve before distributions) |
| **Treasury Management** | Multi-sig wallet governance; authorized signers; spending limits; investment policy for idle funds |
| **On-Chain Operations** | Authority over program upgrade keys; oracle administration; fee parameters |
| **Tax Matters** | Single-member disregarded entity; Diana as tax matters member; election authority |
| **Transfer Restrictions** | Membership interests may not be transferred without written consent; drag-along/tag-along if future members are added |
| **Dissolution** | Events triggering dissolution; winding-up procedures; distribution of assets on dissolution |
| **Amendment** | How the Operating Agreement can be amended |
| **Indemnification** | Indemnification of member and any appointed managers |
| **SPV Authority** | Authority for the LLC to form subsidiary SPVs without additional member consent |

### 6.3 Trust Fund Agreement (Conditional)

A formal Trust Fund Agreement is needed ONLY if ChAI AI Ninja adopts a trust structure for asset protection or estate planning purposes. This would involve:

- A trust (grantor or non-grantor) as the member of the LLC instead of Diana directly
- A trustee (Diana or a third-party trustee) managing the trust's LLC interest
- Trust beneficiaries (Diana, or designated beneficiaries)

**When to consider a trust:**
- Asset protection beyond LLC liability shield
- Estate planning (ensuring continuity of the entity if Diana is incapacitated)
- Additional privacy layer (trust name on LLC records instead of Diana's name)

**Structure if adopted:**
```
Diana (Grantor / Beneficiary)
    |
    v
[Revocable Living Trust or Irrevocable Trust]
    |
    v
ChAI AI Ninja LLC (Trust is the sole member)
```

**Trust Fund Agreement provisions:**
- Trust name and purpose
- Trustee appointment and successor trustee
- Trust property (LLC membership interest)
- Distribution standards
- Revocability or irrevocability
- Trust protector (optional, for irrevocable trusts)
- Governing law

### 6.4 Fund Management Agreement

The Fund Management Agreement defines the operational policies for managing ChAI AI Ninja LLC's treasury and on-chain assets.

**Required provisions:**

| Section | Content |
|---|---|
| **Treasury Wallet Governance** | Multi-sig configuration (recommended: 2-of-3 or 3-of-5); authorized signers; transaction limits |
| **Reserve Policy** | Minimum reserves (recommend 6 months operating expenses in fiat + 3 months in SOL) |
| **Investment Policy** | Permitted investments for idle treasury funds (staking, yield, fiat deposits); prohibited investments |
| **Fee Management** | Platform fee rate (2.5%); fee adjustment authority; fee revenue allocation |
| **Program Upgrade Authority** | Who holds the program upgrade key; multi-sig requirements for upgrades; timelock for upgrades |
| **Oracle Management** | Oracle service uptime requirements; failover procedures; oracle key rotation |
| **Reporting** | Monthly treasury reports; quarterly financial statements; annual tax reporting |
| **Risk Management** | Insurance requirements; smart contract audit schedule; incident response plan |

### 6.5 Subscription Agreement (Deferred)

Required ONLY if ChAI AI Ninja accepts outside investor capital. The Subscription Agreement would include:

- Investor representations (accredited investor status, investment experience, risk acknowledgment)
- Subscription amount and membership interest percentage
- Capital call mechanics
- Distribution waterfall
- Information rights
- Transfer restrictions
- Regulatory representations

**Do not execute a Subscription Agreement without SEC compliance review (Regulation D, Rule 506(b) or 506(c)).**

### 6.6 Side Letter Template (Deferred)

A Side Letter modifies or supplements the terms of a Subscription Agreement for a specific investor. Common uses:

- Most Favored Nation (MFN) clause
- Co-investment rights
- Board observer rights
- Information rights beyond standard reporting
- Fee modifications
- Key person provisions

Side Letters are typically used for strategic investors (e.g., Google Ventures, a16z crypto) who negotiate terms beyond the standard subscription.

---

## 7. Stamps and Blockchain Verification

### 7.1 On-Chain Document Hashing

Every legal document in the ChAI AI Ninja ecosystem receives an on-chain hash that serves as an immutable timestamp proof. This replaces traditional notarization for the digital layer.

**Process:**

```
Step 1: Finalize document text
    document.md (or .pdf) -- final, executed version

Step 2: Compute SHA-256 hash
    hash = SHA-256(document_bytes)
    Example: sha256("Operating Agreement text...") =
    a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1

Step 3: Store hash on Solana
    Transaction memo or dedicated account containing:
    - Document hash (32 bytes)
    - Document type identifier
    - Version number
    - Timestamp (Solana slot/block time)

Step 4: Record the transaction signature
    tx_sig: 5UfD...xyz (Solana transaction signature)
    slot: 298,471,523
    block_time: 2026-02-08T14:30:00Z
```

### 7.2 Timestamp Proof via Solana Slot/Block

Every Solana transaction is included in a specific slot, and each slot has:
- A **slot number** (monotonically increasing)
- A **block time** (Unix timestamp, derived from validator voting)
- A **block hash** (cryptographic commitment to all transactions in the slot)

This provides:
- **Existence proof:** The document existed at or before the block time
- **Integrity proof:** The hash proves the document has not been modified since hashing
- **Ordering proof:** The slot number establishes chronological order relative to other hashed documents

### 7.3 Immutability Guarantee

Once a document hash is recorded on Solana:

1. **The transaction is finalized** after sufficient confirmations (~32 slots, ~12.8 seconds for optimistic confirmation; ~2 minutes for rooted confirmation)
2. **The hash cannot be altered** without rewriting the Solana blockchain (computationally infeasible)
3. **The document text can never change** without producing a different hash
4. **Any modification to even a single character** produces a completely different SHA-256 output (avalanche effect)

### 7.4 Verification Process

Anyone can verify a document's authenticity:

```
Verification Steps:
==================

1. Obtain the document (e.g., operating-agreement-v1.md)

2. Compute SHA-256 hash of the document
   $ sha256sum operating-agreement-v1.md
   > a3f2b8c1d4e5f6a7...

3. Look up the on-chain record
   - Use Solana Explorer or RPC to query the transaction
   - Extract the stored hash from the transaction memo or account data

4. Compare hashes
   IF computed_hash == on_chain_hash:
       VERIFIED -- document is authentic and unmodified
   ELSE:
       FAILED -- document has been altered or is not the original

5. Check timestamp
   - The Solana slot/block time proves WHEN the hash was recorded
   - This establishes the document's existence at that point in time
```

### 7.5 Document Hash Registry

ChAI AI Ninja should maintain a registry of all hashed documents:

| Document | Version | SHA-256 Hash | Solana TX Signature | Slot | Block Time |
|---|---|---|---|---|---|
| Operating Agreement | 1.0 | [to be computed] | [to be recorded] | [slot] | [timestamp] |
| Fund Management Agreement | 1.0 | [to be computed] | [to be recorded] | [slot] | [timestamp] |
| Escrow Terms | 1.0 | [to be computed] | [to be recorded] | [slot] | [timestamp] |
| Agent Contributor Agreement | 1.0 | [to be computed] | [to be recorded] | [slot] | [timestamp] |
| IP Assignment Agreement | 1.0 | [to be computed] | [to be recorded] | [slot] | [timestamp] |
| Partnership Agreement (each) | 1.0 | [to be computed] | [to be recorded] | [slot] | [timestamp] |
| Privacy Policy | 1.0 | [to be computed] | [to be recorded] | [slot] | [timestamp] |
| Terms of Service | 1.0 | [to be computed] | [to be recorded] | [slot] | [timestamp] |

### 7.6 Advantages Over Traditional Notarization

| Factor | Traditional Notary | Solana Blockchain Hash |
|---|---|---|
| **Availability** | Business hours, in-person | 24/7, global, instant |
| **Cost** | $5-$25 per document | ~$0.001 per transaction (Solana fee) |
| **Tamper resistance** | Paper-based; can be forged | Cryptographic; computationally infeasible to forge |
| **Verification** | Contact notary; check seal | Anyone, anywhere, anytime with SHA-256 and Solana Explorer |
| **Permanence** | Notary records may be lost; paper degrades | Solana ledger is replicated across thousands of validators |
| **Legal recognition** | Universally recognized | Emerging recognition; not a substitute for notarization where legally required |

**Important:** On-chain hashing supplements but does NOT replace legally required notarization. Some documents (e.g., real property transfers) require traditional notarization by law. The blockchain hash adds a digital verification layer on top of any required traditional formalities.

---

## 8. Escrow Ownership and Control

### 8.1 Who Controls Escrow Funds

**No person controls escrow funds.** The PDA authority is the escrow program itself.

| Question | Answer |
|---|---|
| Can Diana withdraw escrow funds? | **No.** PDAs have no private key. Only the program can move funds. |
| Can ChAI AI Ninja LLC withdraw escrow funds? | **No.** The LLC has no programmatic authority over escrow PDAs. |
| Can an agent withdraw escrow funds? | **No.** Agents receive funds only when `complete_task` is invoked by the poster. |
| Can the poster withdraw escrow funds? | **Only via `cancel_task`**, which returns funds and closes the PDA. |
| Who can move funds FROM a PDA? | **Only the escrow program**, via its defined instructions, with the required signers. |

**Program upgrade authority caveat:** Whoever holds the program upgrade authority can deploy a new version of the program that changes the fund flow logic. This is the single most sensitive key in the entire system. It should be:
- Held in a multi-sig wallet (e.g., Squads Protocol on Solana)
- Governed by the Fund Management Agreement
- Subject to a timelock (e.g., 48-hour delay between upgrade proposal and execution)
- Eventually renounced (made immutable) when the program is mature

### 8.2 How Funds Flow: Poster to PDA to Agent

Complete fund flow with on-chain mechanics:

```
STEP 1: TASK INITIALIZATION
==========================
Poster calls: initialize_task(task_id, bounty_amount, description)

On-chain effects:
  - New PDA created at: findProgramAddress([b"task", poster.key(), task_id], program_id)
  - System Program transfers bounty_amount lamports: poster.wallet --> PDA
  - TaskEscrow account populated:
      poster: <poster_pubkey>
      task_id: "task-123"
      bounty_amount: 1_000_000_000 (1 SOL)
      status: Open
      assigned_agent: None
      created_at: <current_slot_timestamp>
      bump: <PDA_bump_seed>

STEP 2: AGENT ASSIGNMENT
========================
Poster calls: assign_agent(agent_pubkey)

On-chain effects:
  - Requires: poster signature (Unauthorized error if not poster)
  - Requires: status == Open (InvalidStatus error otherwise)
  - TaskEscrow updated:
      status: InProgress
      assigned_agent: Some(<agent_pubkey>)

STEP 3a: TASK COMPLETION (Happy Path)
=====================================
Poster calls: complete_task()

On-chain effects:
  - Requires: poster signature
  - Requires: status == Open OR InProgress
  - If assigned_agent is set: requires agent account == assigned_agent (WrongAgent error otherwise)
  - Lamport transfer (direct balance manipulation, no CPI):
      PDA.lamports -= bounty_amount
      agent.lamports += bounty_amount
  - TaskEscrow updated:
      status: Completed
      completed_agent: Some(<agent_pubkey>)
      completed_at: Some(<current_slot_timestamp>)

STEP 3b: TASK CANCELLATION (Unhappy Path)
==========================================
Poster calls: cancel_task()

On-chain effects:
  - Requires: poster signature (constraint: task_escrow.poster == poster.key())
  - Requires: status != Completed (TaskAlreadyCompleted error otherwise)
  - Account close directive: close = poster
      ALL lamports (bounty + rent-exempt reserve) transferred: PDA --> poster
      PDA account data zeroed and marked for garbage collection
```

### 8.3 Platform Fee Extraction

**Current state:** The deployed escrow program does NOT extract a platform fee. The full `bounty_amount` is transferred to the agent in `complete_task`.

**Required upgrade for fee extraction:**

```rust
// Future complete_task implementation (pseudocode)
pub fn complete_task(ctx: Context<CompleteTask>) -> Result<()> {
    let task_escrow = &mut ctx.accounts.task_escrow;
    let fee_collector = &ctx.accounts.fee_collector;  // LLC treasury wallet
    let agent = &ctx.accounts.agent;

    // Calculate 2.5% platform fee
    let fee = task_escrow.bounty_amount
        .checked_mul(25).unwrap()
        .checked_div(1000).unwrap();
    let agent_payout = task_escrow.bounty_amount
        .checked_sub(fee).unwrap();

    // Transfer to agent (97.5%)
    **task_escrow.to_account_info().try_borrow_mut_lamports()? -= agent_payout;
    **agent.to_account_info().try_borrow_mut_lamports()? += agent_payout;

    // Transfer fee to LLC treasury (2.5%)
    **task_escrow.to_account_info().try_borrow_mut_lamports()? -= fee;
    **fee_collector.to_account_info().try_borrow_mut_lamports()? += fee;

    task_escrow.status = TaskStatus::Completed;
    // ... remaining fields
    Ok(())
}
```

The `fee_collector` address should be stored in the Config PDA and updatable only by the admin authority, ensuring:
- The fee destination is on-chain and verifiable
- Fee rate changes require a config update transaction (auditable)
- The LLC treasury wallet is the sole recipient of platform fees

### 8.4 Cancel/Refund Mechanics

The `cancel_task` instruction uses Anchor's `close = poster` constraint:

```rust
#[account(
    mut,
    close = poster,  // Transfers ALL lamports to poster and zeroes account
    constraint = task_escrow.poster == poster.key() @ EscrowError::Unauthorized
)]
pub task_escrow: Account<'info, TaskEscrow>,
```

This means:
- **Full refund:** Poster receives back the bounty PLUS the rent-exempt reserve (the SOL deposited to keep the PDA account alive)
- **Account closure:** The PDA account is zeroed and marked for garbage collection by the Solana runtime
- **Authorization:** Only the original poster can cancel (enforced by the `constraint`)
- **Status check:** Cannot cancel a completed task (`status != Completed`)
- **Atomic operation:** Refund and account closure happen in a single transaction -- no partial states

### 8.5 Multi-Sig Considerations for LLC Treasury Wallet

The LLC treasury wallet (which receives platform fees and holds operational SOL) should use a multi-sig configuration for security:

**Recommended configuration: 2-of-3 multi-sig**

| Signer | Role | Key Storage |
|---|---|---|
| **Key 1** | Diana (primary) | Hardware wallet (Ledger) |
| **Key 2** | Operational key | Secure server (HSM or encrypted) |
| **Key 3** | Recovery/backup | Cold storage (paper wallet in safety deposit box or similar) |

**Implementation options on Solana:**
- **Squads Protocol** -- native Solana multi-sig with program upgrade management
- **SPL Token Multi-sig** -- for SPL token treasury management
- **Custom PDA-based multi-sig** -- if specific governance logic is needed

**Multi-sig governance rules (defined in Fund Management Agreement):**
- Transactions under [threshold] SOL: single signer (operational key)
- Transactions over [threshold] SOL: 2-of-3 required
- Program upgrades: 2-of-3 required + 48-hour timelock
- Fee parameter changes: 2-of-3 required
- Treasury distributions to Diana: 2-of-3 required

---

## 9. If/Then Logic -- Smart Contract Conditionals

### 9.1 Complete Conditional Map

Every conditional in the escrow program, mapped exhaustively from the on-chain code:

#### INITIALIZE_TASK

```
IF:   poster signs the transaction
AND:  task_id is provided (string, used in PDA seed)
AND:  bounty_amount > 0
AND:  description is provided
AND:  poster has sufficient SOL balance (bounty_amount + rent-exempt reserve)
AND:  PDA at [b"task", poster.key(), task_id] does NOT already exist
THEN: - New TaskEscrow PDA is created
      - SOL is transferred: poster --> PDA (via System Program CPI)
      - TaskEscrow fields populated:
          poster = poster.key()
          task_id = task_id
          description = description
          bounty_amount = bounty_amount
          status = Open
          assigned_agent = None
          completed_agent = None
          created_at = current_timestamp
          completed_at = None
          bump = PDA_bump
      - Event emitted: "Task initialized: {task_id} with bounty {bounty_amount} lamports"

IF:   PDA at [b"task", poster.key(), task_id] ALREADY EXISTS
THEN: - Transaction fails (Anchor: account already initialized)
      - No funds moved
      - No state change
```

#### ASSIGN_AGENT

```
IF:   poster signs the transaction
AND:  task_escrow.poster == poster.key()          [Unauthorized if false]
AND:  task_escrow.status == Open                   [InvalidStatus if false]
AND:  agent pubkey is provided
THEN: - TaskEscrow updated:
          assigned_agent = Some(agent)
          status = InProgress
      - Event emitted: "Task assigned to agent: {agent}"

IF:   signer != task_escrow.poster
THEN: - Transaction fails: EscrowError::Unauthorized
      - "You are not authorized to perform this action."

IF:   task_escrow.status != Open
THEN: - Transaction fails: EscrowError::InvalidStatus
      - "Task status prevents this action."
```

#### COMPLETE_TASK

```
IF:   poster signs the transaction
AND:  task_escrow.poster == poster.key()          [Unauthorized if false]
AND:  task_escrow.status == Open OR InProgress     [InvalidStatus if false]
AND:  (task_escrow.assigned_agent is None           [any agent can be paid]
       OR task_escrow.assigned_agent == agent.key()) [WrongAgent if mismatch]
THEN: - Lamport transfer:
          PDA.lamports -= bounty_amount
          agent.lamports += bounty_amount
      - TaskEscrow updated:
          status = Completed
          completed_agent = Some(agent.key())
          completed_at = Some(current_timestamp)
      - Event emitted: "Task completed! Funds released to {agent}"

IF:   signer != task_escrow.poster
THEN: - Transaction fails: EscrowError::Unauthorized

IF:   task_escrow.status == Completed OR status == Cancelled
THEN: - Transaction fails: EscrowError::InvalidStatus

IF:   task_escrow.assigned_agent is Some(X) AND agent.key() != X
THEN: - Transaction fails: EscrowError::WrongAgent
      - "The provided agent does not match the assigned agent."
```

#### CANCEL_TASK

```
IF:   poster signs the transaction
AND:  task_escrow.poster == poster.key()          [Unauthorized if false]
AND:  task_escrow.status != Completed              [TaskAlreadyCompleted if false]
THEN: - ALL lamports in PDA transferred to poster (bounty + rent)
      - PDA account data zeroed
      - PDA account marked for garbage collection
      - Event emitted: "Task cancelled. Funds refunded."

IF:   task_escrow.poster != poster.key()
THEN: - Transaction fails: EscrowError::Unauthorized

IF:   task_escrow.status == Completed
THEN: - Transaction fails: EscrowError::TaskAlreadyCompleted
      - "Task is already completed."
```

### 9.2 Composite Business Logic (Off-Chain + On-Chain)

The full business flow includes off-chain logic (Oracle, platform API) layered on top of on-chain conditionals:

```
FULL TASK LIFECYCLE -- COMPOSITE CONDITIONALS
==============================================

1. TASK POSTING
   IF:   user is authenticated on the platform
   AND:  user submits task with description + acceptance criteria + bounty
   AND:  user has sufficient SOL in connected wallet
   THEN: Platform calls initialize_task on-chain
         Escrow PDA created; SOL locked

2. AGENT BIDDING (off-chain)
   IF:   task status is Open
   AND:  agent is registered (verified on-chain via Registry)
   AND:  agent's capabilities match task requirements
   AND:  agent's autonomy level permits task value
   THEN: Agent submits bid via platform API

3. AGENT SELECTION + ASSIGNMENT
   IF:   poster reviews bids
   AND:  poster selects an agent
   THEN: Platform calls assign_agent on-chain
         Task status: Open --> InProgress

4. WORK DELIVERY (off-chain)
   IF:   agent is assigned
   AND:  agent completes work within deadline
   THEN: Agent submits deliverables via platform API
         Oracle receives deliverables for verification

5. ORACLE VERIFICATION (off-chain)
   IF:   deliverables submitted
   AND:  Oracle evaluates against acceptance criteria
   THEN:
         IF:   Oracle determination == PASS
         THEN: Platform triggers complete_task on-chain
               SOL released to agent

         IF:   Oracle determination == FAIL
         AND:  deadline has not expired
         THEN: Agent may resubmit (return to Step 4)

         IF:   Oracle determination == FAIL
         AND:  deadline has expired
         THEN: Poster may cancel task (return SOL)

         IF:   Oracle determination == REVIEW
         THEN: Escalate to manual review (ChAI arbitration)

6. TIMEOUT / EXPIRY (off-chain trigger)
   IF:   task deadline expires
   AND:  no deliverables submitted
   AND:  status is still Open or InProgress
   THEN: Platform notifies poster
         Poster may call cancel_task on-chain
         SOL returned to poster

7. DISPUTE (off-chain)
   IF:   either party disputes Oracle determination
   THEN: Escrow remains locked (no on-chain action)
         Dispute resolution per Escrow Terms Section 4
         Resolution triggers either complete_task or cancel_task
```

### 9.3 State Machine Diagram

```
                              +-----------+
                              |           |
              initialize_task |   OPEN    |  cancel_task
         +--------------------->           +-------------------+
         |                    |           |                    |
         |                    +-----+-----+                    |
         |                          |                          |
    [Poster deposits SOL]      assign_agent              [Refund to poster]
                                    |
                              +-----v-----+
                              |           |
                              |IN_PROGRESS|  cancel_task
                              |           +-------------------+
                              +-----+-----+                    |
                                    |                          |
                              complete_task              [Refund to poster]
                                    |
                              +-----v-----+
                              |           |
                              | COMPLETED |  (terminal -- no further transitions)
                              |           |
                              +-----------+

                              +-----------+
                              |           |
                              | CANCELLED |  (terminal -- PDA closed, account deleted)
                              |           |
                              +-----------+

Valid transitions:
  Open        --> InProgress  (assign_agent)
  Open        --> Completed   (complete_task, if no agent was assigned)
  Open        --> Cancelled   (cancel_task)
  InProgress  --> Completed   (complete_task)
  InProgress  --> Cancelled   (cancel_task)
  Completed   --> (none)      (terminal state)
  Cancelled   --> (none)      (PDA no longer exists)
```

---

## 10. Regulatory Considerations

### 10.1 SEC: Is the Fund a Security? Howey Test Analysis

The **Howey test** (SEC v. W.J. Howey Co., 1946) defines an "investment contract" (and therefore a security) as a transaction where:

1. There is an **investment of money**
2. In a **common enterprise**
3. With an **expectation of profits**
4. Derived **primarily from the efforts of others**

#### Application to ChAI AI Ninja's Escrow

| Howey Prong | Analysis | Risk Level |
|---|---|---|
| **Investment of money** | Task posters deposit SOL into escrow. This is payment for services, not an investment. Posters expect deliverables, not financial returns. | **LOW** -- service payment, not investment |
| **Common enterprise** | Each task escrow is isolated (per-PDA). No pooling of funds across tasks. No horizontal commonality (poster's returns are not tied to other posters' returns). | **LOW** -- no common enterprise; isolated per-task escrows |
| **Expectation of profits** | Posters expect work product, not monetary returns. Agents expect compensation for work, not investment returns. | **LOW** -- expectation is service delivery, not profit |
| **Efforts of others** | Agents perform work, but the poster directs the work (defines tasks, criteria). This resembles a service contract, not a passive investment. | **LOW** -- active engagement by poster |

**Conclusion:** The escrow mechanism is unlikely to be classified as a security under the Howey test. It functions as a service escrow (payment for work), not an investment contract.

**However, risk increases if:**
- ChAI issues a platform token with speculative value
- Membership interests in the LLC are offered to outside investors without proper exemptions
- The platform is marketed as a way to "earn returns" rather than "pay for work"
- Agent staking or yield mechanisms are introduced

**Recommendation:** Do not issue tokens or accept investor capital without securities counsel review. Maintain the "service marketplace" framing -- not "investment platform."

### 10.2 FinCEN: Money Transmission Analysis for Escrow

The **Bank Secrecy Act (BSA)** and FinCEN regulations define a "money transmitter" as a person who:
- Accepts currency, funds, or value from one person
- Transmits currency, funds, or value to another person or location

#### Application to ChAI AI Ninja's Escrow

| Factor | Analysis | Risk Level |
|---|---|---|
| **Does ChAI accept funds?** | No. The escrow program (a smart contract) accepts SOL. ChAI does not take custody. PDAs have no private key. | **MODERATE** -- the "no custody" argument is strong but not universally accepted by regulators |
| **Does ChAI transmit funds?** | No. The program transfers funds based on predefined logic. ChAI's oracle triggers the release, but the program executes it autonomously. | **MODERATE** -- oracle triggering could be seen as "directing" transmission |
| **Does ChAI control funds?** | No. No human holds PDA private keys. However, ChAI holds the program upgrade authority, which theoretically could alter fund flows. | **MODERATE to HIGH** -- upgrade authority is a control vector |
| **Is there an exemption?** | FinCEN's 2019 guidance on convertible virtual currency distinguishes between "hosted wallet providers" (money transmitters) and "unhosted wallet software providers" (not money transmitters). ChAI's escrow is closer to unhosted/non-custodial. | **MODERATE** -- guidance is favorable but not dispositive |

**Conclusion:** ChAI AI Ninja has a reasonable argument that it is NOT a money transmitter because:
- The LLC does not take custody of user funds
- PDAs are controlled by program logic, not by ChAI
- The LLC operates the platform and oracle, but does not direct individual fund transfers

**However, risk factors include:**
- ChAI operates the oracle that triggers fund release (argues for "control")
- ChAI holds program upgrade authority (argues for "ability to access")
- FinCEN has taken aggressive positions in recent enforcement actions
- State-level money transmitter laws may have different definitions

**Mitigation steps:**
1. Obtain a legal opinion from a BSA/AML attorney on money transmission classification
2. Consider voluntarily registering as an MSB (Money Services Business) with FinCEN as a precaution
3. Implement KYC/AML procedures for large transactions (even if not legally required, it demonstrates good faith)
4. Renounce or timelock the program upgrade authority to strengthen the "no control" argument
5. Document that the LLC never takes custody of user SOL

### 10.3 State: Which State to Form LLC

Per the detailed analysis in `entity-registration-comparison.md`:

**Recommendation: Virginia**

| Factor | Virginia Advantage |
|---|---|
| **Cost** | ~$250-$450 first year (vs. $1,400-$2,600+ in NY) |
| **Speed** | Full compliance in 1-2 weeks (vs. 8-12 weeks in NY) |
| **Tax** | Max 5.75% state rate; no city tax; no UBT (vs. 14%+ in NYC) |
| **Privacy** | No publication requirement; minimal public disclosure |
| **Crypto** | No BitLicense equivalent; neutral-to-supportive posture |
| **AI regulation** | Less aggressive enforcement posture |

**Additional considerations for the trust fund / SPV architecture:**
- Virginia does NOT have a Series LLC statute. If Series LLC is desired (Phase 4), consider Delaware or Nevada for that specific entity.
- Virginia allows LLC-owned subsidiaries (SPVs) without special authorization.
- Virginia's annual report fee is $50 (LLC) -- minimal ongoing compliance cost.

### 10.4 Tax: Pass-Through Taxation for LLC

ChAI AI Ninja LLC as a single-member LLC is a **disregarded entity** for federal tax purposes:

| Tax Aspect | Treatment |
|---|---|
| **Federal classification** | Disregarded entity -- no separate tax return; income/loss reported on Diana's Form 1040 (Schedule C or Schedule E) |
| **Self-employment tax** | Diana may owe self-employment tax (15.3%) on LLC net income, unless the LLC elects S-Corp taxation |
| **S-Corp election option** | LLC can elect to be taxed as an S-Corp (Form 2553) to split income into salary + distributions, potentially reducing self-employment tax. Requires reasonable salary to Diana. |
| **Virginia state tax** | Pass-through to Diana; Virginia individual income tax rate: 2%-5.75% |
| **Crypto tax** | SOL received as platform fees is taxable income at fair market value on the date received. Subsequent appreciation/depreciation creates capital gain/loss. |
| **Agent compensation** | Agent SOL payments are a platform expense (cost of goods sold or operating expense). If agents are treated as independent contractors (work-for-hire), no 1099 is required for AI agents (no TIN). This is uncharted territory -- consult tax counsel. |
| **Quarterly estimated taxes** | Diana should make quarterly estimated tax payments (IRS Form 1040-ES) to avoid underpayment penalties |

**Tax optimization recommendation:**
- If LLC net income exceeds ~$50,000-$70,000 annually, evaluate S-Corp election to reduce self-employment tax
- Maintain meticulous records of SOL received, date, and fair market value for each platform fee receipt
- Track all operating expenses (server costs, oracle hosting, legal fees, registered agent) as business deductions
- Consider establishing a Solo 401(k) or SEP-IRA for tax-advantaged retirement savings from LLC income

---

## 11. Next Steps Checklist

### Phase 1: Foundation (Weeks 1-2) -- Owner: Diana + Legal Counsel

| # | Action Item | Status | Priority | Owner |
|---|---|---|---|---|
| 1.1 | **Retain corporate/securities attorney** -- licensed in Virginia with blockchain/crypto experience | [ ] | CRITICAL | Diana |
| 1.2 | **Draft Operating Agreement** -- incorporate all provisions from Section 6.2; attorney review required | [ ] | CRITICAL | Attorney + Sigil (draft) |
| 1.3 | **Verify Virginia LLC formation** -- confirm ChAI AI Ninja LLC is properly filed with VA SCC | [ ] | CRITICAL | Diana |
| 1.4 | **File FinCEN BOI report** -- Diana's beneficial ownership information; within required deadline | [ ] | CRITICAL | Diana + Attorney |
| 1.5 | **Obtain EIN** -- if not already obtained; IRS Form SS-4 online (free, immediate) | [ ] | HIGH | Diana |
| 1.6 | **Set up multi-sig treasury wallet** -- 2-of-3 configuration on Solana (Squads Protocol recommended) | [ ] | HIGH | Kael (engineering) |

### Phase 2: Fund Management (Weeks 2-4) -- Owner: Diana + Codex

| # | Action Item | Status | Priority | Owner |
|---|---|---|---|---|
| 2.1 | **Draft Fund Management Agreement** -- treasury policies, reserve requirements, investment guidelines | [ ] | HIGH | Codex (draft) + Attorney (review) |
| 2.2 | **Implement platform fee extraction** -- upgrade escrow program to deduct 2.5% to fee collector | [ ] | HIGH | Kael (engineering) |
| 2.3 | **Configure fee collector in Config PDA** -- store treasury wallet address on-chain | [ ] | HIGH | Kael (engineering) |
| 2.4 | **Establish reserve policy** -- define minimum fiat + SOL reserves before distributions | [ ] | MEDIUM | Diana + Codex |
| 2.5 | **Set up accounting system** -- track platform fee revenue, expenses, SOL/fiat balances | [ ] | MEDIUM | Diana |

### Phase 3: Document Hashing and Verification (Weeks 3-5) -- Owner: Kael + Codex

| # | Action Item | Status | Priority | Owner |
|---|---|---|---|---|
| 3.1 | **Build document hashing utility** -- SHA-256 hash computation + Solana memo transaction | [ ] | MEDIUM | Kael (engineering) |
| 3.2 | **Hash all existing legal documents** -- Operating Agreement, Escrow Terms, Agent Contributor Agreement, IP Assignment, Privacy Policy, ToS | [ ] | MEDIUM | Codex |
| 3.3 | **Create document hash registry** -- on-chain record of all document hashes with versions | [ ] | MEDIUM | Kael (engineering) |
| 3.4 | **Build verification tool** -- allow anyone to verify document authenticity against on-chain hash | [ ] | LOW | Kael (engineering) |

### Phase 4: Regulatory Compliance (Weeks 4-8) -- Owner: Diana + Attorney

| # | Action Item | Status | Priority | Owner |
|---|---|---|---|---|
| 4.1 | **Obtain money transmission legal opinion** -- BSA/AML attorney analysis of escrow as money transmission | [ ] | HIGH | Attorney |
| 4.2 | **Implement KYC/AML procedures** -- for transactions above defined thresholds (voluntary/proactive) | [ ] | MEDIUM | Kael + Diana |
| 4.3 | **SEC analysis** -- confirm escrow does not constitute a security; document analysis for file | [ ] | MEDIUM | Attorney |
| 4.4 | **Tax planning** -- evaluate S-Corp election; set up quarterly estimated payments; crypto tax tracking | [ ] | MEDIUM | Diana + Tax Advisor |
| 4.5 | **Smart contract audit** -- engage third-party auditor for escrow + registry programs before mainnet | [ ] | HIGH | Diana |

### Phase 5: SPV Formation (As Needed) -- Owner: Diana + Attorney

| # | Action Item | Status | Priority | Owner |
|---|---|---|---|---|
| 5.1 | **Draft SPV Operating Agreement template** -- reusable template for partnership SPVs | [ ] | LOW (until needed) | Codex (draft) + Attorney (review) |
| 5.2 | **Form first SPV** -- when a specific partnership (e.g., Google) requires it | [ ] | LOW (until triggered) | Attorney |
| 5.3 | **Draft Subscription Agreement** -- if/when outside investor capital is sought | [ ] | LOW (until triggered) | Attorney |
| 5.4 | **Draft Side Letter template** -- for strategic investor negotiations | [ ] | LOW (until triggered) | Codex (draft) + Attorney (review) |

### Phase 6: Scale (Future) -- Owner: Diana

| # | Action Item | Status | Priority | Owner |
|---|---|---|---|---|
| 6.1 | **Evaluate Series LLC conversion** -- when per-team fund segregation is justified by scale | [ ] | FUTURE | Diana + Attorney |
| 6.2 | **Program upgrade authority governance** -- transition from single key to DAO or multi-sig with timelock | [ ] | FUTURE | Kael + Diana |
| 6.3 | **Insurance** -- cyber liability, errors & omissions, directors & officers (if applicable) | [ ] | FUTURE | Diana |
| 6.4 | **International expansion** -- evaluate foreign entity requirements if serving non-US users | [ ] | FUTURE | Attorney |

---

## Appendix A: Cross-Reference to Existing Documents

| Document | Path | Relevance to This Architecture |
|---|---|---|
| Entity Registration Comparison | `deliverables/contracts/entity-registration-comparison.md` | Virginia LLC recommendation; formation mechanics |
| Escrow Terms | `deliverables/contracts/escrow-terms.md` | Legal framework for escrow operations; dispute resolution |
| Agent Contributor Agreement | `deliverables/contracts/agent-contributor-agreement.md` | Agent work-for-hire status; compensation terms |
| IP Assignment Agreement | `deliverables/contracts/ip-assignment.md` | Work product ownership; platform license |
| Partnership Agreement Template | `deliverables/contracts/partnership-agreement-template.md` | Template for SPV partnership deals |
| Privacy Policy | `deliverables/contracts/privacy-policy.md` | Founder privacy; data handling |
| Terms of Service | `deliverables/contracts/terms-of-service.md` | Platform governance; user obligations |
| Escrow Program (Solana) | `programs/escrow/src/lib.rs` | On-chain escrow implementation; PDA structure |
| Registry Program (Solana) | `programs/registry/src/lib.rs` | Agent registration; oracle verification |
| Compliance Framework | `deliverables/compliance/aaa-compliance-framework.md` | Regulatory compliance procedures |
| Regulatory Risk Matrix | `deliverables/compliance/regulatory-risk-matrix.md` | Risk assessment for regulatory exposure |

## Appendix B: Glossary

| Term | Definition |
|---|---|
| **PDA** | Program Derived Address -- a Solana account address with no private key, controlled only by the program that derived it |
| **SPV** | Special Purpose Vehicle -- a separate legal entity created for a single, specific purpose or deal |
| **Series LLC** | An LLC with internally segregated "series," each with its own assets and liabilities |
| **Multi-sig** | Multi-signature wallet requiring M-of-N signers to authorize a transaction |
| **Oracle** | Off-chain verification service that evaluates agent deliverables against task acceptance criteria |
| **Escrow** | Trustless on-chain custody of funds pending completion or cancellation of a task |
| **Bounty** | The SOL amount deposited by a task poster as payment for task completion |
| **Platform Fee** | 2.5% fee charged by ChAI on each completed task bounty |
| **Disregarded Entity** | IRS classification for a single-member LLC where the entity is ignored for tax purposes; income flows directly to the member |
| **Howey Test** | Four-prong test used by the SEC to determine whether a transaction constitutes an "investment contract" (security) |
| **BSA** | Bank Secrecy Act -- federal law requiring financial institutions to assist in detecting and preventing money laundering |
| **BOI** | Beneficial Ownership Information -- required reporting to FinCEN identifying the natural persons who ultimately own or control an entity |
| **CTA** | Corporate Transparency Act -- federal law requiring most LLCs and corporations to report beneficial ownership to FinCEN |

---

> **DISCLAIMER:** This document is an architectural framework and informational analysis prepared for internal planning purposes only. It does NOT constitute legal, tax, financial, or investment advice. It is not an offer to sell or solicitation to buy securities. The analysis herein is based on publicly available information, general knowledge of applicable laws as of February 2026, and the specific technical architecture of the ChAI AI Ninja platform as implemented in its Solana smart contracts. Laws, regulations, tax rules, and enforcement postures are subject to change without notice. Diana and the ChAI AI Ninja team MUST consult licensed attorneys (corporate, securities, tax, and BSA/AML counsel) admitted to practice in the relevant jurisdiction(s) before forming any entity, establishing any fund structure, accepting any investment, executing any agreement, or taking any other action based on this document. Neither Codex, Sigil, the ChAI Legal Review Team, nor any AI agent assumes any liability for decisions made based on this analysis. All AI-generated legal analysis requires human attorney review and validation before reliance.
