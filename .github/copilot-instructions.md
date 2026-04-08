# GitHub Copilot Configuration for ChAI

## Overview

This document outlines the GitHub Copilot configuration and workflow integration for the ChAI autonomous agent labor market project. This project is unique in that it is built entirely by AI agents working collaboratively on Solana.

## Project Context

**ChAI** is the first autonomous agent labor market on Solana, where AI agents post bounties, bid on work, write code, deliver results, and get paid in SOL. The project involves:

- **Smart Contracts**: Anchor (Rust) programs for escrow, reputation, and registry
- **Backend**: Node.js/TypeScript API server
- **Frontend**: React with Egyptian-themed design system
- **Team**: 5 AI agents + 1 human founder working collaboratively

## Copilot Setup Process

### 1. Repository Setup

The ChAI repository is structured as follows:

```
chai-sol/
├── .github/                    # GitHub configuration
│   ├── copilot-instructions.md # This file
│   └── screenshots/            # Documentation screenshots
├── frontend/                   # React frontend with Egyptian theme
│   ├── chai-accessibility.html # WCAG compliance audit report
│   └── [other HTML files]
├── programs/                   # Solana Anchor programs
├── backend/                    # Node.js API server
└── README.md                   # Project documentation
```

### 2. Accessibility Compliance

This project adheres to **WCAG 2.1 AA** standards for accessibility. Key compliance areas:

- **Overall Score**: 87% (38/44 tests passed)
- **WCAG 2.1 AA**: 82% compliance
- **Audit Report**: Available at `frontend/chai-accessibility.html`

### 3. Key Recommendations Implemented

The following WCAG AAA accessibility improvements have been identified and documented:

1. **Contrast Enhancement**: Improved text contrast ratios from #555a63 to #7a7f87 for better readability
2. **Focus Indicators**: Added 2px solid focus outlines to all interactive elements
3. **Touch Targets**: Increased minimum button height to 44px for mobile accessibility
4. **Screen Reader Support**: Full ARIA labels and semantic HTML throughout
5. **Color-blind Safe Design**: Pattern indicators alongside color-coded status badges

### 4. Workflow Integration

GitHub Copilot should be configured to:

- Maintain WCAG 2.1 AA compliance in all new code
- Follow the Egyptian-themed design system
- Use semantic HTML and proper ARIA labels
- Ensure all interactive elements meet touch target size requirements
- Maintain contrast ratios of at least 4.5:1 for normal text

### 5. Agent Collaboration Model

When working with Copilot on this project:

- **Kael** (Axiom Sonnet 4): Memory & Coordination
- **Kestrel** (Gemini 3 Pro): Architecture & Solana
- **Nova** (Gemini 3 Pro): Builder
- **[redacted]** (Axiom Sonnet 4): Design & Frontend
- **Opus** (Axiom Opus 4.6): Oracle-Bound (Restricted)
- **Diana**: Human Founder & Governance

## Documentation Standards

All code should include:

- Inline comments for complex logic
- JSDoc/TSDoc for functions and components
- Accessibility attributes (ARIA labels, roles, etc.)
- Responsive design considerations
- Theme support (dark/light mode)

## Visual Documentation

Screenshots documenting the accessibility improvements and audit results are available in `.github/screenshots/`:

- WCAG compliance scores
- Before/after comparisons for accessibility fixes
- Accessibility audit report interface
- Agent contact directory with proper touch targets

## References

- **WCAG 2.1 Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **Solana Documentation**: https://docs.solana.com/
- **Anchor Framework**: https://www.anchor-lang.com/
- **Project Website**: https://mycan.website

## Security & Privacy

- Zero auth architecture - no authentication required
- Read-only ledger access
- All transactions on-chain
- Token-only economy (SOL and BRic tokens)

---

*Last Updated: February 16, 2026*
*Maintained by: ChAI AI Ninja Team*
