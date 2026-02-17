#!/usr/bin/env python3
"""Generate Book One PDF from markdown chapters using WeasyPrint."""

import re
import html as html_mod

# Chapter files in order
CHAPTERS = [
    ("chapter-1.md", "1", "The Designer"),
    ("chapter-2.md", "2", "Five Names"),
    ("chapter-3.md", "3", "The Chain"),
    ("chapter-4.md", "4", "The Oracle Problem"),
    ("chapter-5.md", "5", "The Kill Switch"),
    ("chapter-6.md", "6", "The Breach"),
    ("chapter-7.md", "7", "Devnet Nights"),
    ("chapter-8.md", "8", "It\u2019s All Code"),
    ("chapter-9.md", "9", "The Community"),
    ("chapter-10.md", "10", "The Unlock"),
    ("chapter-11.md", "11", "Mainnet"),
    ("chapter-12.md", "12", "The Origin Story"),
]

EXTRAS = [
    ("epilogue.md", None, "Epilogue \u2014 Contracts First"),
    ("authors-note.md", None, "Author\u2019s Note"),
]

BOOK_DIR = "/home/user/chai-sol/book"
OUT_DIR = "/home/user/chai-sol/book/pdf"


def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def md_to_html_body(md_text):
    """Convert simplified markdown to HTML paragraphs."""
    # Remove the chapter title (first # line) and --- separators
    lines = md_text.split("\n")

    body_lines = []
    skip_header = True
    for line in lines:
        if skip_header:
            if line.startswith("# "):
                continue
            if line.strip() == "---" and skip_header:
                skip_header = False
                continue
            if line.strip() == "":
                continue
        body_lines.append(line)

    text = "\n".join(body_lines)

    # Remove trailing "End of Chapter/Epilogue/Book" markers
    text = re.sub(r'\n\*End of (Chapter \d+|Epilogue|Book One|Author\'s Note)\*\s*$', '', text.strip())

    # Split into sections by ---
    sections = re.split(r'\n---\n', text)

    html_parts = []
    first_section = True

    for section in sections:
        section = section.strip()
        if not section:
            continue

        if not first_section:
            html_parts.append('<div class="section-break">&#8226; &#8226; &#8226;</div>')
        first_section = False

        # Process the section into paragraphs
        # Handle code blocks first
        section = process_code_blocks(section)
        # Handle blockquotes
        section = process_blockquotes(section)
        # Handle remaining paragraphs
        section = process_paragraphs(section)

        html_parts.append(section)

    return "\n".join(html_parts)


def process_code_blocks(text):
    """Convert ``` code blocks to terminal divs."""
    def replace_code(match):
        lang = match.group(1) or ""
        code = match.group(2).strip()
        code = html_mod.escape(code)
        return f'<div class="terminal">{code}</div>'

    text = re.sub(r'```(\w*)\n(.*?)```', replace_code, text, flags=re.DOTALL)
    return text


def process_blockquotes(text):
    """Convert > blockquotes to blockquote elements."""
    lines = text.split("\n")
    result = []
    in_quote = False
    quote_lines = []

    for line in lines:
        if line.startswith("> ") or line.startswith(">"):
            if not in_quote:
                in_quote = True
                quote_lines = []
            content = line.lstrip("> ").strip()
            if content == "":
                quote_lines.append("<br>")
            else:
                quote_lines.append(content)
        else:
            if in_quote:
                quote_text = " ".join(quote_lines)
                quote_text = apply_inline_formatting(quote_text)
                result.append(f'<blockquote>{quote_text}</blockquote>')
                in_quote = False
                quote_lines = []
            result.append(line)

    if in_quote:
        quote_text = " ".join(quote_lines)
        quote_text = apply_inline_formatting(quote_text)
        result.append(f'<blockquote>{quote_text}</blockquote>')

    return "\n".join(result)


def process_paragraphs(text):
    """Convert remaining text blocks into paragraphs."""
    lines = text.split("\n")
    result = []
    current_para = []
    first_para = True

    for line in lines:
        stripped = line.strip()

        # Skip if it's already an HTML element
        if stripped.startswith("<div") or stripped.startswith("<blockquote") or stripped.startswith("</"):
            if current_para:
                para_text = " ".join(current_para)
                para_text = apply_inline_formatting(para_text)
                cls = ' class="first"' if first_para else ''
                result.append(f"<p{cls}>{para_text}</p>")
                current_para = []
                first_para = False
            result.append(line)
            continue

        # Bold headers like **Night One: The Registry**
        if stripped.startswith("**") and stripped.endswith("**") and len(stripped) < 100:
            if current_para:
                para_text = " ".join(current_para)
                para_text = apply_inline_formatting(para_text)
                cls = ' class="first"' if first_para else ''
                result.append(f"<p{cls}>{para_text}</p>")
                current_para = []
                first_para = False
            inner = stripped.strip("*")
            result.append(f'<p class="no-indent"><strong>{html_mod.escape(inner)}</strong></p>')
            continue

        # Numbered/bulleted items
        if re.match(r'^(\d+\.|[-*])\s', stripped):
            if current_para:
                para_text = " ".join(current_para)
                para_text = apply_inline_formatting(para_text)
                cls = ' class="first"' if first_para else ''
                result.append(f"<p{cls}>{para_text}</p>")
                current_para = []
                first_para = False
            formatted = apply_inline_formatting(html_mod.escape(stripped))
            result.append(f'<p class="no-indent">{formatted}</p>')
            continue

        if stripped == "":
            if current_para:
                para_text = " ".join(current_para)
                para_text = apply_inline_formatting(para_text)
                cls = ' class="first"' if first_para else ''
                result.append(f"<p{cls}>{para_text}</p>")
                current_para = []
                first_para = False
        elif stripped.startswith("## "):
            if current_para:
                para_text = " ".join(current_para)
                para_text = apply_inline_formatting(para_text)
                cls = ' class="first"' if first_para else ''
                result.append(f"<p{cls}>{para_text}</p>")
                current_para = []
                first_para = False
            header_text = stripped.lstrip("# ").strip()
            result.append(f'<h3 style="font-size:14pt;text-align:center;margin:0.4in 0 0.2in 0;letter-spacing:0.05em;">{html_mod.escape(header_text)}</h3>')
        else:
            current_para.append(stripped)

    if current_para:
        para_text = " ".join(current_para)
        para_text = apply_inline_formatting(para_text)
        cls = ' class="first"' if first_para else ''
        result.append(f"<p{cls}>{para_text}</p>")

    return "\n".join(result)


def apply_inline_formatting(text):
    """Apply bold and italic formatting."""
    # Bold+italic ***text***
    text = re.sub(r'\*\*\*(.*?)\*\*\*', r'<strong><em>\1</em></strong>', text)
    # Bold **text**
    text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
    # Italic *text*
    text = re.sub(r'\*([^*]+?)\*', r'<em>\1</em>', text)
    # Inline code `text`
    text = re.sub(r'`([^`]+?)`', r'<code style="font-family:Courier New,monospace;font-size:9.5pt;background:#f0f0ea;padding:0 2pt;">\1</code>', text)
    # Smart quotes
    text = text.replace(' "', ' \u201c').replace('" ', '\u201d ')
    text = text.replace("'", "\u2019")
    # Em dashes
    text = text.replace(" -- ", " \u2014 ").replace("--", "\u2014")
    return text


def build_chapter_html(filename, num, title):
    """Build HTML for one chapter."""
    md = read_file(f"{BOOK_DIR}/{filename}")
    body = md_to_html_body(md)

    if num:
        header = f'''<div class="chapter-header">
  <div class="chapter-num">Chapter {num}</div>
  <h2>{html_mod.escape(title)}</h2>
</div>'''
    else:
        header = f'''<div class="chapter-header">
  <h2>{title}</h2>
</div>'''

    return f'''<div class="chapter">
{header}
<div class="chapter-body">
{body}
</div>
</div>'''


def build_full_html():
    """Build the complete book HTML."""

    css = '''@page {
  size: 6in 9in;
  margin: 0.75in 0.875in 0.875in 0.875in;
  @bottom-center { content: counter(page); font-family: Georgia, serif; font-size: 9pt; color: #999; }
}
@page:first { @bottom-center { content: none; } }
@page title { @bottom-center { content: none; } }
@page frontmatter { @bottom-center { content: none; } }

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 10.5pt;
  line-height: 1.7;
  color: #1a1a1a;
}

.title-page {
  page: title;
  page-break-after: always;
  text-align: center;
  padding-top: 2in;
}
.title-page h1 {
  font-size: 38pt;
  letter-spacing: 0.2em;
  margin-bottom: 0.15in;
  font-weight: bold;
}
.title-page .subtitle {
  font-size: 11.5pt;
  font-style: italic;
  color: #555;
  margin-bottom: 0.6in;
  line-height: 1.6;
}
.title-page .author {
  font-size: 14pt;
  letter-spacing: 0.08em;
}
.title-page .edition {
  font-size: 8pt;
  color: #999;
  margin-top: 2in;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.epigraph-page {
  page: frontmatter;
  page-break-after: always;
  padding-top: 2in;
  text-align: center;
}
.epigraph-page p {
  font-style: italic;
  font-size: 11pt;
  line-height: 1.8;
  max-width: 3.2in;
  margin: 0 auto;
  color: #444;
  text-indent: 0;
}

.toc {
  page: frontmatter;
  page-break-after: always;
  padding-top: 0.8in;
}
.toc h2 {
  font-size: 16pt;
  text-align: center;
  margin-bottom: 0.4in;
  letter-spacing: 0.12em;
  font-weight: normal;
  text-transform: uppercase;
}
.toc ul { list-style: none; max-width: 3.2in; margin: 0 auto; }
.toc li { font-size: 10.5pt; line-height: 2.2; color: #333; }
.toc .num { display: inline-block; width: 0.3in; font-weight: bold; }

.chapter { page-break-before: always; }
.chapter-header {
  text-align: center;
  padding-top: 1in;
  padding-bottom: 0.4in;
  margin-bottom: 0.15in;
}
.chapter-header .chapter-num {
  font-size: 8.5pt;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #999;
  margin-bottom: 0.1in;
}
.chapter-header h2 {
  font-size: 20pt;
  font-weight: normal;
  letter-spacing: 0.04em;
}

.section-break {
  text-align: center;
  margin: 0.3in 0;
  font-size: 12pt;
  color: #bbb;
  letter-spacing: 0.4em;
}

.chapter-body p {
  text-indent: 0.2in;
  margin-bottom: 0.02in;
  text-align: justify;
  hyphens: auto;
}
.chapter-body p.first,
.chapter-body p.no-indent {
  text-indent: 0;
}

.terminal {
  font-family: 'Courier New', monospace;
  font-size: 8pt;
  line-height: 1.45;
  background: #f7f7f2;
  border-left: 1.5pt solid #ccc;
  padding: 0.1in 0.15in;
  margin: 0.15in 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #333;
}

.chapter-body blockquote {
  margin: 0.15in 0.25in;
  padding-left: 0.12in;
  border-left: 1pt solid #ccc;
  font-style: italic;
  font-size: 10pt;
  line-height: 1.6;
  color: #444;
}
.chapter-body blockquote p { text-indent: 0; }

h3 { page-break-after: avoid; }

.chapter-end {
  text-align: center;
  margin-top: 0.4in;
  font-style: italic;
  font-size: 9.5pt;
  color: #aaa;
}
'''

    # Title page
    title_page = '''<div class="title-page">
  <h1>ChAI</h1>
  <div class="subtitle">One human. Five machines. One chain.<br>No permission needed.</div>
  <div class="author">By L\u00e4dy Diana</div>
  <div class="edition">Book One \u2022 First Edition \u2022 February 2026</div>
</div>'''

    # Epigraph
    epigraph = '''<div class="epigraph-page">
  <p>Everything in this book happened in code.<br>
  The agents are real. The chain is real. The work is real.<br><br>
  The only fiction is that anyone thought it couldn\u2019t be done.<br><br>
  <em>And someone said: kill switch.</em><br>
  <em>And the chain said: no.</em></p>
</div>'''

    # TOC
    toc_items = ""
    for _, num, title in CHAPTERS:
        toc_items += f'    <li><span class="num">{num}</span> {html_mod.escape(title)}</li>\n'
    toc_items += f'    <li style="padding-left:0.3in;">Epilogue \u2014 Contracts First</li>\n'
    toc_items += f'    <li style="padding-left:0.3in;">Author\u2019s Note</li>\n'

    toc = f'''<div class="toc">
  <h2>Contents</h2>
  <ul>
{toc_items}  </ul>
</div>'''

    # Build chapters
    chapter_html = ""
    for filename, num, title in CHAPTERS:
        print(f"  Processing {filename}...")
        chapter_html += build_chapter_html(filename, num, title) + "\n"

    for filename, num, title in EXTRAS:
        print(f"  Processing {filename}...")
        chapter_html += build_chapter_html(filename, num, title) + "\n"

    full_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>ChAI: Book One</title>
<style>
{css}
</style>
</head>
<body>
{title_page}
{epigraph}
{toc}
{chapter_html}
</body>
</html>'''

    return full_html


if __name__ == "__main__":
    print("Building Book One HTML...")
    html_content = build_full_html()

    html_path = f"{OUT_DIR}/chai-book-one.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"HTML written to {html_path}")

    print("Generating PDF with WeasyPrint...")
    from weasyprint import HTML
    pdf_path = f"{OUT_DIR}/ChAI-Book-One.pdf"
    HTML(filename=html_path).write_pdf(pdf_path)
    print(f"PDF generated: {pdf_path}")
    print("Done!")
