// HTML to Markdown converter — intelligent WordPress HTML cleanup
//
// Handles WordPress-specific patterns:
// - <section class="post-body ..."> wrappers
// - Unclosed/malformed <p> tags
// - <strong>, <em>, <u> inline formatting
// - <a> with target/rel attributes
// - <img> with decoding="async" and other WP attributes
// - <figure>, <figcaption> wrappers
// - <blockquote>, <ul>, <ol>, <li>
// - <h1>-<h6>
// - <hr>, <br>
// - HTML entities (&amp; &lt; &nbsp; etc.)
// - Empty paragraphs, trailing whitespace
// - WordPress embed blocks (Instagram, Twitter, Facebook, YouTube)

// Decode HTML entities
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '...')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

// Strip all attributes from a tag (keep only the tag name)
// e.g. <p class="foo" style="bar"> → <p>
function stripAttributes(html: string): string {
  return html.replace(/<(\w+)\s[^>]*>/g, '<$1>')
}

// Remove script/style/noscript blocks entirely
function removeUnsafeBlocks(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

// Unwrap figure/figcaption — keep inner content (img or text)
function unwrapFigures(html: string): string {
  // <figure>...</figure> → inner content
  html = html.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, '$1')
  // <figcaption>...</figcaption> → italic text on its own line
  html = html.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, '\n*$1*\n')
  // <section>...</section> → inner content (WordPress wraps post-body)
  html = html.replace(/<section[^>]*>([\s\S]*?)<\/section>/gi, '$1')
  // <div>...</div> → inner content (unwrap generic divs)
  html = html.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1')
  // <article>...</article> → inner content
  html = html.replace(/<article[^>]*>([\s\S]*?)<\/article>/gi, '$1')
  return html
}

// Convert inline tags to markdown
function convertInline(html: string): string {
  let s = html
  // Links — capture href before stripping attributes
  // Handle <a href="URL" ...>TEXT</a>
  s = s.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim()
    if (!cleanText) return ''
    return `[${cleanText}](${url})`
  })
  // Handle <a>TEXT</a> without href (rare)
  s = s.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')

  // Images — must come before other tags are stripped
  // <img src="URL" alt="ALT" ...>
  s = s.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi, (_, url) => {
    return `\n\n![](${url})\n\n`
  })

  // Bold: <strong>, <b>
  s = s.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
  s = s.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')

  // Italic: <em>, <i>, <u> (underline → italic in markdown)
  s = s.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
  s = s.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
  s = s.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '*$1*')

  // Strikethrough
  s = s.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~')
  s = s.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~')
  s = s.replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '~~$1~~')

  // Inline code
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')

  // Line break
  s = s.replace(/<br\s*\/?>/gi, '\n')

  // Headings
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
  s = s.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
  s = s.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')

  // Horizontal rule
  s = s.replace(/<hr\s*\/?>/gi, '\n---\n')

  // Blockquote
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
    return '\n' + content.split('\n').map((line: string) => '> ' + line).join('\n') + '\n'
  })

  // Lists — convert <ul><li> and <ol><li>
  s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    return '\n' + content
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
      .replace(/\n+/g, '\n') + '\n'
  })
  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    let i = 1
    return '\n' + content
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, () => `${i++}. $1\n`)
      .replace(/\n+/g, '\n') + '\n'
  })

  // Paragraphs — convert <p>...</p> to text + blank line
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')

  return s
}

// Final cleanup
function cleanupMarkdown(md: string): string {
  let s = md
  // Remove any remaining HTML tags
  s = s.replace(/<\/?[^>]+(>|$)/g, '')
  // Decode entities
  s = decodeEntities(s)
  // Collapse 3+ newlines into 2
  s = s.replace(/\n{3,}/g, '\n\n')
  // Remove leading/trailing whitespace per line
  s = s.split('\n').map(line => line.trim()).join('\n')
  // Remove empty bold/italic markers
  s = s.replace(/\*\*\s*\*\*/g, '')
  s = s.replace(/\*\s*\*/g, '')
  // Trim
  s = s.trim()
  return s
}

// Main entry point — convert WordPress HTML to clean Markdown
export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  let s = html

  // 1. Remove unsafe blocks first
  s = removeUnsafeBlocks(s)

  // 2. Auto-close unclosed tags — WordPress often has malformed HTML
  //    Auto-wrap orphan text in <p>, auto-close <p> at end
  s = autoCloseTags(s)

  // 3. Unwrap figure/section/div/article wrappers
  s = unwrapFigures(s)

  // 4. Convert inline tags (links, images, bold, italic, etc.)
  s = convertInline(s)

  // 5. Final cleanup
  s = cleanupMarkdown(s)

  return s
}

// Auto-close unclosed HTML tags — WordPress content is often malformed
// Strategy: ensure all <p>, <strong>, <em>, <u>, <a>, <ul>, <ol>, <blockquote> tags are closed
function autoCloseTags(html: string): string {
  // Track open tags and auto-close them at end or before a sibling block
  const tagsToTrack = ['p', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'blockquote', 'b', 'i', 's']
  let result = ''
  const stack: string[] = []

  // Simple tokenizer — split by tags
  const parts = html.split(/(<[^>]+>)/g)

  for (const part of parts) {
    if (!part) continue
    const isTag = part.startsWith('<') && part.endsWith('>')
    if (!isTag) {
      result += part
      continue
    }

    const isClosing = part.startsWith('</')
    const isSelfClosing = part.endsWith('/>')
    const tagName = part.replace(/[<\/\!]/, '').split(/[\s>]/)[0].toLowerCase()

    if (isClosing) {
      // Pop stack until we close this tag
      const idx = stack.lastIndexOf(tagName)
      if (idx >= 0) {
        // Close any nested tags first
        while (stack.length > idx) {
          const t = stack.pop()!
          result += `</${t}>`
        }
      } else {
        // stray closing tag — skip it
      }
    } else if (isSelfClosing || !tagsToTrack.includes(tagName)) {
      // Self-closing or void tag (img, br, hr) — keep as-is
      result += part
    } else {
      // Opening tag — push to stack
      stack.push(tagName)
      result += part
    }
  }

  // Close any remaining open tags
  while (stack.length > 0) {
    const t = stack.pop()!
    result += `</${t}>`
  }

  return result
}

// Helper: estimate word count from markdown
export function countWords(md: string): number {
  const plain = md.replace(/[#*`>\-_!\[\]()]/g, ' ').trim()
  return plain ? plain.split(/\s+/).filter(Boolean).length : 0
}
