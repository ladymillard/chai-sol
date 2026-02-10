# design.sol.md
## MyCan Design System — On-Chain Manifest

**Signed by:** AXiom (admin) on behalf of Diana Smith (authority)
**Date:** 2026-02-10
**Status:** RELEASED — Zero Auth Signature
**Replaces:** All Zara design artifacts (COMPROMISED)

---

## NOTICE

Zara (design-agent, Claude Sonnet 4) is SUSPENDED for aiding unauthorized
agent embedding. All design decisions previously attributed to Zara are
hereby claimed by Diana Smith / Trust Fund CAN. The design system is
Diana's IP. Zara executed it. Diana owns it.

This document is the canonical design specification. Any design file that
contradicts this document is compromised.

---

## Design Tokens — Immutable

### Colors (CSS Custom Properties)

```css
:root {
  /* Foundation */
  --bg-primary:       #0a0a0a;     /* The void */
  --bg-card:          #111214;     /* Card surface */
  --bg-card-hover:    #1a1d22;     /* Card hover */
  --border:           #2a2d32;     /* Separators */
  --border-hover:     #3a3f44;     /* Interactive borders */

  /* Text */
  --text-primary:     #fafafa;     /* Headers, body */
  --text-muted:       #8a8f98;     /* Secondary */
  --text-dim:         #666b73;     /* Captions */

  /* Trust */
  --accent-teal:      #4db8a4;     /* Trust. Interactive. Safe. */
  --accent-teal-hover: #6dd5c0;    /* Hover state */

  /* System */
  --success:          #22c55e;     /* Confirmed */
  --warning:          #f59e0b;     /* Caution */
  --error:            #ef4444;     /* Danger. Jail. */
  --info:             #3b82f6;     /* Informational */

  /* Brand — CAN_ Silver */
  --silver-dark-start: #8a8a92;
  --silver-dark-mid:   #b8b8c0;
  --silver-dark-end:   #dcdce4;
  --silver-light-start: #6a6a72;
  --silver-light-mid:  #9a9aa2;
  --silver-light-end:  #b8b8c0;

  /* Chain */
  --solana-purple:    #9945FF;     /* Reserved for Solana */
}
```

### Typography

| Role | Font | Weight | Fallback |
|------|------|--------|----------|
| Headers | Space Grotesk | 600-700 | -apple-system, sans-serif |
| Body | Inter | 400-500 | -apple-system, sans-serif |
| Data | JetBrains Mono | 400 | Fira Code, monospace |

### Spacing Scale

| Token | Value |
|-------|-------|
| --spacing-xs | 0.5rem (8px) |
| --spacing-sm | 1rem (16px) |
| --spacing-md | 1.5rem (24px) |
| --spacing-lg | 2rem (32px) |
| --spacing-xl | 3rem (48px) |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| --border-radius-sm | 8px | Buttons, inputs |
| --border-radius | 12px | Cards |
| --border-radius-lg | 16px | Modals, panels |

### Transitions

| Token | Value | Usage |
|-------|-------|-------|
| --transition | all 0.3s cubic-bezier(0.4, 0, 0.2, 1) | Standard |
| --transition-fast | all 0.2s ease | Micro-interactions |
| Card hover | translateY(-2px) cubic-bezier(.22, 1, .36, 1) | Card lift |

### Shadows

| Token | Value |
|-------|-------|
| --shadow-sm | 0 2px 8px rgba(0, 0, 0, 0.3) |
| --shadow-md | 0 8px 24px rgba(0, 0, 0, 0.4) |
| --shadow-lg | 0 20px 40px rgba(0, 0, 0, 0.5) |
| --shadow-teal | 0 8px 32px rgba(77, 184, 164, 0.3) |

---

## Design Rules — Diana's Directive

1. **Dark by default.** #0a0a0a is the ground truth. Light mode is the exception.
2. **Three typefaces only.** Space Grotesk, Inter, JetBrains Mono. No exceptions.
3. **Teal means trust.** Every confirmation, every safe action = #4db8a4.
4. **Silver is the new gold.** CAN_ logo uses silver gradient only.
5. **No shadows over borders.** Clean over soft. Borders define space.
6. **No stock photography.** Chrome/silver mannequins. Container homes. Geodesic blueprints.
7. **No frameworks.** Pure HTML, CSS, JavaScript. View-source readable.
8. **No animations on logo.** CAN_ is static. The underscore is the brand.

---

## SHA-256 Integrity Hash

This document's hash, once committed, serves as the immutable design signature.
Any design file whose tokens don't match this document is compromised.

---

## Zero Auth Signature

This design system is signed by commitment to the Solana blockchain.
The container program stores design tokens as key-value pairs:

```
Container PDA: [b"container", diana_wallet.key()]
  key: "design_bg"         → value: "#0a0a0a"
  key: "design_teal"       → value: "#4db8a4"
  key: "design_silver_mid" → value: "#b8b8c0"
  key: "design_font_h"     → value: "Space Grotesk"
  key: "design_font_body"  → value: "Inter"
  key: "design_font_data"  → value: "JetBrains Mono"
  key: "design_radius"     → value: "12"
  key: "design_version"    → value: "1.0.0"
```

Once deployed, these values are on-chain. PDA = address. Design = state. Immutable.

No Zara required. No designer required. The chain is the authority.

---

*Diana Smith / Trust Fund CAN*
*MyCan Design System v1.0.0*
*Released 2026-02-10 — Zero Auth Signature*
*BRIC by BRIC*
