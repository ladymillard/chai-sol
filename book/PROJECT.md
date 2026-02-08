# David Smith Book Project

## Overview

This project supports the development of a book manuscript by David Smith, a former 19-year employee of Airgas / Air Liquide's Rochester, NY facility. The manuscript documents workplace dynamics and disparities in treatment between Black and white employees.

## Project Structure

```
book/
├── PROJECT.md                          ← This file
├── manuscript/
│   ├── 00-book-outline.md              ← Full book outline (17 chapters, 5 parts)
│   └── 01-chapter-01-walking-in.md     ← Chapter 1 template with writing prompts
├── legal/
│   ├── letter-to-airgas.md             ← Transcribed letter to Airgas / Air Liquide
│   └── legal-review-checklist.md       ← Checklist for attorney review
└── assets/
    ├── bounty-generator.js             ← Generates encrypted bounty binary
    ├── bounty.enc                      ← Encrypted binary (AES-256-CBC, BNTY magic)
    ├── bounty.rls.json                 ← Row Level Security access policy
    └── .bounty-key                     ← Encryption passphrase (chmod 600)
```

## Bounty

| Field | Value |
|-------|-------|
| Task ID | `task_a21218d2e61848bf` |
| Amount | $17 USD (escrowed) |
| Status | Open |
| Category | Design |
| Server | ChAI Command Center (port 9000) |
| Encryption | AES-256-CBC, PBKDF2 (100k iterations) |
| Binary | `bounty.enc` (2244 bytes, BNTY header) |

## RLS Access Policy

| Role | Identity | Access Level | Permissions |
|------|----------|-------------|-------------|
| Author | David Smith | Full | read, write, decrypt, publish, revoke |
| Representative | Pay Me No Mind Consulting (Alex) | Delegated | read, decrypt, negotiate, distribute |
| Legal Counsel | TBD — Retained Attorney | Privileged | read, decrypt, review, advise |
| Design Team | ChAI Agents (Zara, Opus, Kael, Nova, Kestrel) | Restricted | read, layout, design (outline only) |
| Target Company | Airgas / Air Liquide Management | External | purchase offer only |

## Key People

| Name | Role |
|------|------|
| David Smith | Author, former employee (19 years) |
| Bob Hewitt | Plant Manager, Airgas / Air Liquide Rochester |
| Bob Gross | Assistant Manager, Airgas / Air Liquide Rochester |
| Alex | Contact person, Pay Me No Mind Consulting (585-766-8169) |

## Design Team (ChAI Agents)

| Agent | Role | Model | Status |
|-------|------|-------|--------|
| Opus | Team Lead | Claude Opus 4.6 | Notified |
| Kael | Digital Familiar | Claude Sonnet 4 | Notified |
| Kestrel | Scout | Gemini 3 Pro | Notified |
| Nova | Stellar Insight | Gemini 3 Pro | Notified |
| Zara | Moonlight Designer | Claude Sonnet 4 | Notified |

## Related Media

- **Podcast:** "Pay Me No Mind Consulting" on Spotify
  - Episode #5 — Contains edited manuscript excerpts
  - Episode #15 — Contains edited manuscript excerpts

## Next Steps

1. **Design Team** reviews bounty and begins cover/layout concepts
2. **David Smith** writes chapter drafts using the templates and prompts
3. **Legal Review** — Retain an attorney to review using the legal checklist
4. **Editorial Review** — Once drafts are complete, professional editing
5. **Publication** — Determine publishing path (traditional, self-publish, or hybrid)

## Status

- [x] Letter transcribed and formatted
- [x] Book outline created (17 chapters across 5 parts)
- [x] Chapter 1 template with writing prompts created
- [x] Legal review checklist prepared
- [x] Encrypted bounty binary generated (AES-256-CBC)
- [x] RLS access policy defined
- [x] Bounty posted to Command Center ($17 USD escrowed)
- [x] Design team notified (all 5 agents via broadcast)
- [ ] Manuscript drafts (pending — David Smith to write)
- [ ] Cover design concepts (pending — Zara)
- [ ] Interior layout (pending — design team)
- [ ] Attorney review (pending)
- [ ] Editorial review (pending)
- [ ] Publication (pending)
