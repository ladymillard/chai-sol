#!/usr/bin/env node

/**
 * generate-contract-pdfs.js
 *
 * Reads ChAI contract markdown files and generates professionally formatted
 * PDF documents using pdfkit. White background, black text, Helvetica font,
 * Letter size with 1-inch margins.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONTRACTS_DIR = path.join(__dirname, 'deliverables', 'contracts');
const OUTPUT_DIR = path.join(CONTRACTS_DIR, 'pdf');

const CONTRACTS = [
  { md: 'terms-of-service.md',              pdf: 'ChAI_Terms_of_Service.pdf',              subtitle: 'Terms of Service' },
  { md: 'agent-contributor-agreement.md',    pdf: 'ChAI_Agent_Contributor_Agreement.pdf',    subtitle: 'Agent Contributor Agreement' },
  { md: 'privacy-policy.md',                pdf: 'ChAI_Privacy_Policy.pdf',                subtitle: 'Privacy Policy' },
  { md: 'partnership-agreement-template.md', pdf: 'ChAI_Partnership_Agreement.pdf',          subtitle: 'Partnership Agreement' },
  { md: 'escrow-terms.md',                  pdf: 'ChAI_Escrow_Terms.pdf',                  subtitle: 'Escrow Terms' },
  { md: 'ip-assignment.md',                 pdf: 'ChAI_IP_Assignment.pdf',                 subtitle: 'IP Assignment Agreement' },
];

const MARGIN = 72; // 1 inch in points
const PAGE_WIDTH = 612;  // Letter width
const PAGE_HEIGHT = 792; // Letter height
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_OBLIQUE = 'Helvetica-Oblique';

const FOOTER_TEXT_LEFT = 'ChAI AI Ninja — Confidential';
const DATE_TEXT = 'February 8, 2026';
const DRAFT_TEXT = 'DRAFT — REQUIRES LICENSED ATTORNEY REVIEW';

// ---------------------------------------------------------------------------
// Markdown Parser
// ---------------------------------------------------------------------------

/**
 * Parses markdown content into an array of structured blocks.
 * Each block has a type and associated properties.
 */
function parseMarkdown(content) {
  const lines = content.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // Skip horizontal rules
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Skip the initial DRAFT line and top-level title lines (we render our own header)
    if (trimmed === '# DRAFT -- REQUIRES LICENSED ATTORNEY REVIEW') {
      i++;
      continue;
    }
    if (trimmed === '# ChAI AGENT LABOR MARKET' || trimmed === '# ChAI AGENT LABOR MARKET (CALM)') {
      i++;
      continue;
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];

      // Skip the document title headers (e.g., "# TERMS OF SERVICE") — we render subtitle ourselves
      if (level === 1) {
        i++;
        continue;
      }

      blocks.push({ type: 'header', level, text });
      i++;
      continue;
    }

    // Markdown table rows — detect signature blocks
    if (trimmed.startsWith('|')) {
      // Check if this is a table header separator row
      if (/^\|[-\s|]+\|$/.test(trimmed)) {
        i++;
        continue;
      }
      // Check for empty header row like "| | |"
      if (/^\|\s*\|\s*\|$/.test(trimmed)) {
        i++;
        continue;
      }
      // Parse table data row
      const cells = trimmed.split('|').filter(c => c.trim() !== '');
      if (cells.length >= 2) {
        const label = cells[0].trim().replace(/\*\*/g, '');
        const value = cells[1].trim().replace(/\*\*/g, '');
        blocks.push({ type: 'signature_row', label, value });
      }
      i++;
      continue;
    }

    // Lettered sub-items like "   (a) text..."
    const letteredMatch = trimmed.match(/^\(([a-z])\)\s+(.+)$/);
    if (letteredMatch) {
      // Collect the full text (may span multiple lines)
      let fullText = letteredMatch[2];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed === '' || nextTrimmed.startsWith('#') || nextTrimmed.startsWith('|') ||
            nextTrimmed.match(/^\([a-z]\)/) || nextTrimmed.match(/^\d+\.\d+\./) ||
            /^-{3,}$/.test(nextTrimmed)) {
          break;
        }
        fullText += ' ' + nextTrimmed;
        i++;
      }
      blocks.push({ type: 'lettered_item', letter: letteredMatch[1], text: fullText });
      continue;
    }

    // Numbered sections like "1.1." or "1.1. **Bold.** text"
    const numberedMatch = trimmed.match(/^(\d+\.\d+\.)\s+(.+)$/);
    if (numberedMatch) {
      // Collect the full paragraph text (may span multiple lines)
      let fullText = numberedMatch[2];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed === '' || nextTrimmed.startsWith('#') || nextTrimmed.startsWith('|') ||
            nextTrimmed.match(/^\([a-z]\)/) || nextTrimmed.match(/^\d+\.\d+\./) ||
            /^-{3,}$/.test(nextTrimmed)) {
          break;
        }
        fullText += ' ' + nextTrimmed;
        i++;
      }
      blocks.push({ type: 'numbered_section', number: numberedMatch[1], text: fullText });
      continue;
    }

    // Bold-only line like **CHAI AGENT LABOR MARKET**
    const boldLineMatch = trimmed.match(/^\*\*(.+)\*\*$/);
    if (boldLineMatch) {
      blocks.push({ type: 'bold_line', text: boldLineMatch[1] });
      i++;
      continue;
    }

    // Metadata lines like **Effective Date:** [____]
    const metadataMatch = trimmed.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (metadataMatch) {
      blocks.push({ type: 'metadata', label: metadataMatch[1], value: metadataMatch[2] });
      i++;
      continue;
    }

    // Regular paragraph — collect continuation lines
    let fullText = trimmed;
    i++;
    while (i < lines.length) {
      const nextLine = lines[i];
      const nextTrimmed = nextLine.trim();
      if (nextTrimmed === '' || nextTrimmed.startsWith('#') || nextTrimmed.startsWith('|') ||
          nextTrimmed.match(/^\([a-z]\)/) || nextTrimmed.match(/^\d+\.\d+\./) ||
          /^-{3,}$/.test(nextTrimmed) || nextTrimmed.startsWith('**')) {
        break;
      }
      fullText += ' ' + nextTrimmed;
      i++;
    }
    blocks.push({ type: 'paragraph', text: fullText });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// PDF Rendering Helpers
// ---------------------------------------------------------------------------

/**
 * Renders mixed bold/regular text. Splits on **...** patterns.
 * Returns the final Y position after rendering.
 */
function renderRichText(doc, text, x, y, options = {}) {
  const {
    fontSize = 10,
    lineGap = 3,
    width = CONTENT_WIDTH,
    align = 'left',
    indent = 0,
  } = options;

  const effectiveX = x + indent;
  const effectiveWidth = width - indent;

  // Split text into segments of bold and regular
  const segments = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  // If no bold segments, render as simple text
  if (segments.length === 0) {
    segments.push({ text, bold: false });
  }

  // Check if we need a new page
  doc.font(FONT_REGULAR).fontSize(fontSize);
  const estimatedHeight = doc.heightOfString(text, { width: effectiveWidth, lineGap });
  if (y + estimatedHeight > PAGE_HEIGHT - MARGIN - 30) {
    doc.addPage();
    y = MARGIN;
  }

  // Use pdfkit's rich text continuation
  doc.x = effectiveX;
  doc.y = y;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    doc.font(seg.bold ? FONT_BOLD : FONT_REGULAR).fontSize(fontSize);

    const isLast = (i === segments.length - 1);
    doc.text(seg.text, {
      width: effectiveWidth,
      align,
      lineGap,
      continued: !isLast,
    });
  }

  return doc.y;
}

/**
 * Ensures there is enough space on the current page, otherwise adds a new page.
 * Returns the current Y position (possibly reset to top of new page).
 */
function ensureSpace(doc, y, neededHeight) {
  if (y + neededHeight > PAGE_HEIGHT - MARGIN - 30) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

// ---------------------------------------------------------------------------
// PDF Generation
// ---------------------------------------------------------------------------

function generatePDF(contract) {
  return new Promise((resolve, reject) => {
    const mdPath = path.join(CONTRACTS_DIR, contract.md);
    const pdfPath = path.join(OUTPUT_DIR, contract.pdf);

    // Read markdown
    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const blocks = parseMarkdown(mdContent);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: `ChAI AI Ninja - ${contract.subtitle}`,
        Author: 'ChAI AI Ninja',
        Subject: contract.subtitle,
        Creator: 'ChAI Contract Generator',
      },
      bufferPages: true,
    });

    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    let y = MARGIN;

    // ---- Title Page Header ----

    // Title: "ChAI AI Ninja" — bold, centered
    doc.font(FONT_BOLD).fontSize(22);
    doc.text('ChAI AI Ninja', MARGIN, y, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
    y = doc.y + 8;

    // Subtitle: contract name — bold, centered
    doc.font(FONT_BOLD).fontSize(16);
    doc.text(contract.subtitle, MARGIN, y, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
    y = doc.y + 6;

    // Draft notice — small, centered
    doc.font(FONT_OBLIQUE).fontSize(9);
    doc.fillColor('black');
    doc.text(DRAFT_TEXT, MARGIN, y, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
    y = doc.y + 4;

    // Date
    doc.font(FONT_REGULAR).fontSize(10);
    doc.text(DATE_TEXT, MARGIN, y, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
    y = doc.y + 20;

    // Thin separator line
    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.5).stroke('black');
    y += 16;

    // ---- Render Body Blocks ----

    for (const block of blocks) {
      switch (block.type) {
        case 'hr': {
          y = ensureSpace(doc, y, 12);
          doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.5).stroke('black');
          y += 12;
          break;
        }

        case 'header': {
          const sizes = { 2: 13, 3: 11 };
          const fontSize = sizes[block.level] || 11;
          const spaceBefore = block.level === 2 ? 16 : 10;
          const spaceAfter = block.level === 2 ? 8 : 6;

          y = ensureSpace(doc, y + spaceBefore, fontSize + spaceAfter + 10);
          y += spaceBefore;

          doc.font(FONT_BOLD).fontSize(fontSize);
          doc.text(block.text, MARGIN, y, {
            width: CONTENT_WIDTH,
            align: 'left',
          });
          y = doc.y + spaceAfter;
          break;
        }

        case 'numbered_section': {
          y = ensureSpace(doc, y, 30);

          // Render section number in bold, then text with rich formatting
          const prefix = block.number + ' ';
          doc.font(FONT_BOLD).fontSize(10);
          const prefixWidth = doc.widthOfString(prefix);

          doc.text(prefix, MARGIN, y, {
            continued: false,
            width: CONTENT_WIDTH,
          });

          // Render the text starting right after the number on the same line area
          // Use indentation for wrapped lines
          const indent = 36;
          y = renderRichText(doc, block.text, MARGIN, y, {
            indent,
            width: CONTENT_WIDTH,
            align: 'left',
            lineGap: 3,
          });
          y += 6;
          break;
        }

        case 'lettered_item': {
          y = ensureSpace(doc, y, 24);
          const letterPrefix = `(${block.letter}) `;
          const indent = 54;

          doc.font(FONT_REGULAR).fontSize(10);
          doc.text(letterPrefix, MARGIN + 36, y, {
            continued: false,
            width: CONTENT_WIDTH - 36,
          });

          y = renderRichText(doc, block.text, MARGIN, y, {
            indent,
            width: CONTENT_WIDTH,
            align: 'left',
            lineGap: 3,
          });
          y += 4;
          break;
        }

        case 'bold_line': {
          y = ensureSpace(doc, y, 24);
          y += 8;
          doc.font(FONT_BOLD).fontSize(11);
          doc.text(block.text, MARGIN, y, {
            width: CONTENT_WIDTH,
            align: 'left',
          });
          y = doc.y + 6;
          break;
        }

        case 'metadata': {
          y = ensureSpace(doc, y, 18);
          doc.font(FONT_BOLD).fontSize(10);
          const label = block.label + ': ';
          doc.text(label, MARGIN, y, {
            continued: true,
            width: CONTENT_WIDTH,
          });
          doc.font(FONT_REGULAR).fontSize(10);
          doc.text(block.value || '', {
            width: CONTENT_WIDTH,
          });
          y = doc.y + 2;
          break;
        }

        case 'signature_row': {
          y = ensureSpace(doc, y, 22);
          const labelWidth = 140;
          const valueX = MARGIN + labelWidth + 10;
          const valueWidth = CONTENT_WIDTH - labelWidth - 10;

          doc.font(FONT_BOLD).fontSize(10);
          doc.text(block.label, MARGIN, y, {
            width: labelWidth,
            align: 'left',
          });

          // Render the value — if it contains underscores, draw a line
          const isBlank = /^_+$/.test(block.value.trim());
          if (isBlank) {
            // Draw an underline
            const lineY = y + 12;
            doc.moveTo(valueX, lineY).lineTo(valueX + valueWidth - 20, lineY).lineWidth(0.5).stroke('black');
          } else {
            doc.font(FONT_REGULAR).fontSize(10);
            doc.text(block.value, valueX, y, {
              width: valueWidth,
              align: 'left',
            });
          }
          y += 20;
          break;
        }

        case 'paragraph': {
          y = ensureSpace(doc, y, 24);
          y = renderRichText(doc, block.text, MARGIN, y, {
            width: CONTENT_WIDTH,
            align: 'left',
            lineGap: 3,
          });
          y += 8;
          break;
        }

        default:
          break;
      }
    }

    // ---- Add Footers to All Pages ----

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      // Temporarily remove bottom margin so pdfkit does not trigger a new page
      // when we write text in the footer area below the normal content boundary.
      const savedBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      const footerY = PAGE_HEIGHT - MARGIN + 16;

      // Footer separator line
      doc.moveTo(MARGIN, footerY - 4).lineTo(PAGE_WIDTH - MARGIN, footerY - 4).lineWidth(0.3).stroke('black');

      // Left footer: "ChAI AI Ninja — Confidential"
      doc.font(FONT_REGULAR).fontSize(8).fillColor('black');
      doc.text(FOOTER_TEXT_LEFT, MARGIN, footerY, {
        width: CONTENT_WIDTH / 2,
        align: 'left',
        lineBreak: false,
      });

      // Right footer: "Page X"
      doc.text(`Page ${i + 1}`, MARGIN + CONTENT_WIDTH / 2, footerY, {
        width: CONTENT_WIDTH / 2,
        align: 'right',
        lineBreak: false,
      });

      // Restore the original bottom margin
      doc.page.margins.bottom = savedBottomMargin;
    }

    doc.end();

    writeStream.on('finish', () => resolve(pdfPath));
    writeStream.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('ChAI Contract PDF Generator');
  console.log('===========================\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}\n`);
  }

  for (const contract of CONTRACTS) {
    const mdPath = path.join(CONTRACTS_DIR, contract.md);
    if (!fs.existsSync(mdPath)) {
      console.error(`  SKIP: ${contract.md} not found`);
      continue;
    }

    try {
      const pdfPath = await generatePDF(contract);
      const stats = fs.statSync(pdfPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`  Generated: ${contract.pdf} (${sizeKB} KB)`);
    } catch (err) {
      console.error(`  ERROR generating ${contract.pdf}: ${err.message}`);
    }
  }

  console.log('\nDone. All PDFs saved to:', OUTPUT_DIR);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
