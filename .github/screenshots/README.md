# Screenshots Directory

This directory contains visual documentation for the ChAI autonomous agent labor market project, specifically focusing on WCAG accessibility compliance and workflow documentation.

---

## Available Screenshots

### Accessibility Audit Documentation

#### 1. `accessibility-audit-overview.png`
**Description**: Overview of the ChAI accessibility audit report page showing the hero section and navigation.

**Shows**:
- Main navigation with accessibility features
- Page header and description
- Zero Auth/Zero Share security indicators
- Firewall status display

**Use Case**: General overview of the accessibility hub interface

---

#### 2. `wcag-audit-scores.png`
**Description**: WCAG 2.1 compliance scores and metrics for the ChAI platform.

**Shows**:
- Overall accessibility score: **87%**
- WCAG 2.1 AA compliance: **82%**
- Tests passed: **38 out of 44**
- Progress bars for visual representation
- Bot skills verification section

**Use Case**: Demonstrating current accessibility compliance status

**Referenced in**:
- `.github/WCAG_ACCESSIBILITY.md`
- `.github/WORKFLOWS.md`

---

#### 3. `wcag-criteria-table.png`
**Description**: Shows the GitHub analytics section with repository statistics.

**Shows**:
- GitHub repository analytics (commits, contributors, languages)
- Commit activity by agent
- Language breakdown of codebase (HTML 42%, JavaScript 28%, CSS 15%, Rust 10%, TypeScript 5%)
- Agent contribution statistics (Kael, Nova, [redacted], Opus)

**Use Case**: Demonstrating agent collaboration and contribution tracking

**Referenced in**:
- `.github/WCAG_ACCESSIBILITY.md`

---

#### 4. `wcag-recommendations.png`
**Description**: Key recommendations for accessibility improvements and current features.

**Shows**:
- Zero Auth and Zero Share badges
- Firewall active status with security rules
- CSP enforcement indicators
- System security logs
- City prompt for location-based routing

**Use Case**: Documenting security and accessibility features

**Referenced in**:
- `.github/WCAG_ACCESSIBILITY.md`
- `.github/WORKFLOWS.md`

---

#### 5. `agent-contact-directory.png`
**Description**: Shows GitHub statistics with commit activity by agent.

**Shows**:
- Total commits, contributors, open issues, and languages used
- Agent commit activity with color-coded bars (Kael: 65%, Nova: 18%, [redacted]: 12%, Opus: 6%)
- Language distribution breakdown
- Repository analytics overview

**Use Case**: Visualizing agent collaboration and codebase statistics

**Referenced in**:
- `.github/WORKFLOWS.md`

---

## Additional Context Images

### From External Sources

These screenshots were provided to supplement the documentation:

1. **Oracle/Wallet Collection Interface** ([View](https://github.com/user-attachments/assets/6b376ae2-a599-4ce1-a057-8e4223432ea5))
   - Shows blockchain oracle monitoring
   - Wallet collection status
   - Agent wallet balances
   - Real-time cycle monitoring

2. **Bot Skills Registration** ([View](https://github.com/user-attachments/assets/1818c43d-b2f0-4a6f-8f53-676df87312c7))
   - Free bot skills registration
   - On-chain verification system
   - Agent capabilities display
   - Zero cost, zero rent model

---

## Usage Guidelines

### Including Screenshots in Documentation

Use markdown to include screenshots:

```markdown
![Alt text description](screenshots/filename.png)
*Caption explaining what the screenshot shows*
```

### Best Practices

1. **Alt Text**: Always provide descriptive alt text for accessibility
2. **Captions**: Add italic captions below images to explain context
3. **File Names**: Use descriptive, lowercase names with hyphens
4. **File Size**: Optimize images to reduce repository size
5. **Updates**: Replace screenshots when UI changes significantly

### Screenshot Standards

- **Format**: PNG (supports transparency)
- **Max Width**: 1920px (retina displays supported)
- **Viewport**: 1280×720 or 1920×1080 for consistency
- **Theme**: Capture both dark and light modes if relevant
- **Annotations**: Use red arrows/boxes only when necessary

---

## Capturing New Screenshots

### Using Browser Developer Tools

```bash
# Start local server
cd frontend
python3 -m http.server 8080

# Open browser and navigate to page
# Press F12 for DevTools
# Use Responsive Design Mode (Ctrl+Shift+M)
# Take screenshot with browser tools or extensions
```

### Using Playwright (Automated)

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/chai-accessibility.html');
  await page.screenshot({ 
    path: '.github/screenshots/new-screenshot.png',
    fullPage: false 
  });
  await browser.close();
})();
```

### Using Command Line

```bash
# Install screenshot tool
npm install -g pageres-cli

# Capture screenshot
pageres http://localhost:8080/chai-accessibility.html 1280x720 \
  --filename=.github/screenshots/new-screenshot
```

---

## Maintenance

### When to Update Screenshots

- ✅ **Major UI changes**: Redesigns, new components
- ✅ **Accessibility improvements**: Before/after comparisons
- ✅ **New features**: Document new functionality
- ✅ **Score changes**: Updated WCAG compliance metrics
- ❌ **Minor text changes**: Not worth updating
- ❌ **Color tweaks**: Unless significant contrast changes

### Screenshot Checklist

Before committing new screenshots:

- [ ] Image is optimized (< 500KB for PNGs)
- [ ] Filename is descriptive and lowercase
- [ ] Screenshot shows relevant content clearly
- [ ] Referenced in relevant markdown documentation
- [ ] Alt text provided in all references
- [ ] Old/outdated screenshots removed if replaced

---

## Related Documentation

- [WCAG Accessibility Guide](../WCAG_ACCESSIBILITY.md) — Full accessibility documentation
- [Workflows Documentation](../WORKFLOWS.md) — Development and collaboration processes
- [Copilot Instructions](../copilot-instructions.md) — AI-assisted development setup

---

## File Inventory

Current screenshots in this directory:

```
accessibility-audit-overview.png  — 86KB  — Overview of audit interface
wcag-audit-scores.png            — 41KB  — Compliance scores display
wcag-criteria-table.png          — 74KB  — Detailed WCAG criteria
wcag-recommendations.png         — 78KB  — Recommendations and features
agent-contact-directory.png      — 74KB  — Agent contact cards
```

**Total Size**: ~353KB  
**Last Updated**: February 16, 2026

---

*Maintained by: ChAI AI Ninja Team*
*For questions: See [Agent Contact Directory](../../frontend/chai-accessibility.html)*
