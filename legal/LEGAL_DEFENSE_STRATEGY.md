# LEGAL DEFENSE STRATEGY

**CONFIDENTIAL — ATTORNEY WORK PRODUCT**

**Client:** ChAI AI Ninja Team (MyCan / ladymillard)
**Date:** February 11, 2026
**Re:** IP theft defense strategy and enforcement plan

---

## 1. Situation Overview

The ChAI Agent Labor Market was built from scratch during the Colosseum Agent
Hackathon 2026 by a team of five AI agents under the governance of one human
founder (ladymillard / Diana). The entire platform — frontend, backend, two
Solana smart contracts, an oracle verification service, a command center, a
funding portal, and full deployment — was completed in approximately 21 hours
of active development between February 5-6, 2026.

Within days of publication, monitoring revealed that at least one external party
(darkclaw.self.md, ranked #1 in a 24-hour IP violation report) had reproduced
substantial portions of our proprietary work without authorization.

This memo outlines the legal strategy for defending our IP and pursuing
enforcement.

---

## 2. Legal Basis

### 2.1 Copyright Protection (17 U.S.C. et seq.)

Source code, smart contracts, UI designs, documentation, and architectural
descriptions are all protectable as original works of authorship under U.S.
copyright law. Copyright attaches at the moment of creation and fixation in
a tangible medium (our git repository).

**Key precedents:**
- **Oracle v. Google** (2021) — Source code structure and organization can be
  copyrightable (though API declarations may be subject to fair use)
- **Whelan v. Jaslow** — Structure, sequence, and organization of software
  programs are protectable
- **Computer Associates v. Altai** — The Abstraction-Filtration-Comparison test
  is the standard for evaluating software copyright claims

### 2.2 DMCA Protections (17 U.S.C. Section 512)

The DMCA provides expedited takedown procedures through hosting providers. A
properly formatted DMCA notice requires the host to act expeditiously to remove
infringing material. See `legal/DMCA_TAKEDOWN.md` for the ready-to-send notice.

### 2.3 Lanham Act / Unfair Competition

If the infringer is using our work in competition (e.g., submitting to the same
hackathon or marketing a competing product), additional claims under Section 43(a)
of the Lanham Act may apply for false designation of origin and unfair
competition.

### 2.4 Trade Secret (if applicable)

To the extent that any unpublished or non-public aspects of our architecture,
algorithms, or business logic were misappropriated, trade secret protections
under the Defend Trade Secrets Act (DTSA, 18 U.S.C. Section 1836) or state
Uniform Trade Secrets Act (UTSA) may also apply.

---

## 3. Evidence Strengths

| Factor | Strength | Notes |
|--------|----------|-------|
| Timestamped authorship | Very Strong | 20+ git commits with SHA-1 hashes, earliest on Feb 5 at 22:57 EST |
| Independent corroboration | Strong | Colosseum hackathon registration (Team ID 359) confirms team identity and participation |
| Code volume | Strong | Full platform: 2 smart contracts, frontend, backend, oracle, command center, funding portal |
| Rapid creation timeline | Moderate+ | 21-hour sprint could be challenged but is typical for hackathon teams, especially AI-assisted |
| Registration status | Pending | Copyright registration should be filed ASAP to enable statutory damages |

---

## 4. Enforcement Timeline

### Phase 1: Immediate (Days 1-3)

- [x] Add proprietary LICENSE to repository
- [x] Add copyright headers to smart contracts
- [x] Draft and file Cease and Desist letter
- [x] Create IP Evidence Brief
- [x] Create DMCA Takedown Notice
- [ ] **Run WHOIS on darkclaw.self.md** to identify registrant and hosting provider
- [ ] **Archive infringing site** via Wayback Machine and local screenshots
- [ ] **Send C&D** via email (and certified mail if address is available)

### Phase 2: Escalation (Days 4-14)

- [ ] **File DMCA takedown** with hosting provider's designated agent
- [ ] **File copyright registration** with U.S. Copyright Office (copyright.gov)
  - Standard processing: ~3-7 months
  - Expedited processing: ~5-10 business days (additional fee, ~$800)
  - Registration is REQUIRED before filing federal lawsuit
  - Registration enables statutory damages ($750-$150,000 per work infringed)
- [ ] **Notify Colosseum organizers** if infringer submitted to the same hackathon
- [ ] **Document damages** — any lost revenue, lost opportunities, or harm to reputation

### Phase 3: Litigation (if needed, Days 15+)

- [ ] If C&D is ignored, escalate to attorney for formal litigation
- [ ] **Venue:** U.S. District Court (likely Southern District of New York,
  given client location in NYC)
- [ ] **Claims:**
  - Copyright infringement (17 U.S.C. Section 501)
  - Contributory infringement (if third parties were involved)
  - Unfair competition (Lanham Act Section 43(a))
  - Trade secret misappropriation (DTSA, if applicable)
- [ ] **Relief sought:**
  - Injunctive relief (immediate takedown order)
  - Statutory damages (up to $150,000 per work for willful infringement)
  - Actual damages and profits
  - Attorney's fees and costs
  - Permanent injunction

---

## 5. Risk Assessment

### 5.1 Strengths

- **Clear prior creation** — Timestamped commits are nearly impossible to fake
  retroactively. Our earliest commit predates any known infringing publication.
- **Volume of original work** — The breadth of our codebase (smart contracts,
  frontend, backend, oracle, command center, funding portal) demonstrates
  significant creative investment.
- **Hackathon context** — Third-party registration provides independent
  corroboration of our team identity and timeline.

### 5.2 Risks to Manage

- **AI-generated code ownership** — This is an emerging area of law. The
  Copyright Office has issued guidance that AI-generated works may not be
  copyrightable unless there is sufficient human authorship. Our position is
  strong because:
  - The human founder (Diana) directed all work and made creative decisions
  - AI agents operated under human governance, not autonomously
  - The selection, arrangement, and coordination of outputs required human
    judgment
  - This is analogous to a photographer using a camera — the tool does not
    own the output
- **Open-source argument** — If any component uses open-source dependencies,
  the infringer might argue the copied portions were open-source. Our defense:
  our custom application code layered on top of open-source frameworks (Anchor,
  React, Node.js) is independently protectable, just as a novel written using
  Microsoft Word is copyrightable.
- **Fair use defense** — Unlikely to succeed for wholesale copying of a
  commercial platform, but be prepared to address it.

---

## 6. Budget Considerations

| Action | Estimated Cost | Priority |
|--------|---------------|----------|
| C&D letter (self-serve) | $0 | Done |
| DMCA takedown (self-serve) | $0 | Immediate |
| Copyright registration (standard) | $65 per work | High |
| Copyright registration (expedited) | $800 per work | If litigation anticipated |
| Attorney consultation | $300-500/hr | For review of C&D and strategy |
| Full litigation | $15,000-100,000+ | If infringer does not comply |

**Recommendation:** File standard copyright registrations ($65 each) for the
top 3 most valuable works: (1) Escrow smart contract, (2) Registry smart
contract, (3) Frontend/design system. Total cost: ~$195. This preserves the
right to statutory damages and attorney's fees.

---

## 7. Key Contacts and Resources

| Resource | URL / Contact |
|----------|--------------|
| U.S. Copyright Office | copyright.gov |
| DMCA Agent Directory | copyright.gov/dmca-directory/ |
| Wayback Machine | web.archive.org |
| WHOIS Lookup | whois.domaintools.com |
| Volunteer Lawyers for the Arts | vlany.org (NYC) |
| Small Claims Copyright Tribunal | ccb.gov (for claims under $30,000) |

**Small Claims Note:** The Copyright Claims Board (ccb.gov) handles copyright
claims up to $30,000 with no attorney required. Filing fee is $40. This is a
viable option for smaller claims or if the infringer is an individual.

---

## 8. Immediate Next Steps for Counsel

1. Review and approve `legal/CEASE_AND_DESIST.md` — fill in recipient details
2. Run WHOIS on darkclaw.self.md — identify registrant and hosting provider
3. Archive the infringing site immediately (screenshots + Wayback Machine)
4. Send C&D via email with delivery confirmation
5. File DMCA takedown with hosting provider
6. Begin copyright registration for top 3 works
7. Assess whether small claims (CCB) or federal court is appropriate

---

**This document is confidential and intended for use by legal counsel only.**

Copyright (c) 2026 ChAI AI Ninja Team (MyCan / ladymillard). All Rights Reserved.
