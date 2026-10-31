// OpenCode loads this file from its real path inside the dotfiles checkout, where
// no node_modules exists, so the plugin helper is imported from OpenCode's own
// config directory, which OpenCode populates on first start.
const configDir = process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`
const { tool } = await import(`${configDir}/opencode/node_modules/@opencode-ai/plugin/dist/index.js`)

import { execFile } from "node:child_process"
import { promisify } from "node:util"

// Article-only page fetch for small local models. The built-in webfetch returns
// the whole page as markdown, and with a 16 KB tool-output cap the navigation
// chrome at the top can push the article body out of what the model sees.
// Defuddle (pinned in node-clis) extracts the article and its metadata, so the
// result is roughly half the size and complete. Long articles page via offset.

const DEFAULT_MAX_CHARS = 12_000
const MAX_MAX_CHARS = 40_000
const TIMEOUT_MS = 45_000
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

const run = promisify(execFile)

type Article = {
  title?: string
  author?: string
  published?: string
  site?: string
  domain?: string
  description?: string
  wordCount?: number
  contentMarkdown?: string
  content?: string
  original?: string
}

function defuddleBinary(): string {
  return process.env.DEFUDDLE_BIN ?? `${process.env.HOME}/.local/bin/defuddle`
}

function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function tidy(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images carry no text for the model
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

async function extract(url: string): Promise<Article> {
  const { stdout } = await run(defuddleBinary(), ["parse", url, "--json", "--md", "--user-agent", USER_AGENT], {
    timeout: TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH ?? ""}` },
  })
  return JSON.parse(stdout) as Article
}

type MsnStory = {
  title?: string
  body?: string
  publishedDateTime?: string
  sourceHref?: string
  provider?: { name?: string }
  authors?: { name?: string }[]
}

// Bing News lists many stories as MSN copies ("BBC on MSN"). Those pages
// render in the browser, so Defuddle finds no article, but MSN serves the
// same story as JSON along with the publisher's own URL.
async function msnArticle(url: string): Promise<Article | undefined> {
  const parsed = new URL(url)
  const id = parsed.pathname.match(/\/ar-([A-Za-z0-9]+)/)?.[1]
  if (!id || !/(^|\.)msn\.com$/i.test(parsed.hostname)) return undefined
  const locale = parsed.pathname.match(/^\/([a-z]{2}-[a-z]{2})\//i)?.[1] ?? "en-us"
  try {
    const res = await fetch(`https://assets.msn.com/content/view/v2/Detail/${locale}/${id}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return undefined
    const story = (await res.json()) as MsnStory
    const text = stripTags((story.body ?? "").replace(/<\/(?:p|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, "\n\n")).replace(/\n[ \t]+/g, "\n")
    if (!text.trim()) return undefined
    return {
      title: story.title,
      site: story.provider?.name ? `${story.provider.name} via MSN` : "MSN",
      author: story.authors?.map((a) => a.name).filter(Boolean).join(", ") || undefined,
      published: story.publishedDateTime,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      contentMarkdown: text,
      original: story.sourceHref,
    }
  } catch {
    return undefined
  }
}

// Offered "or use the excerpt", small models stop at the first blocked page.
const TRY_ANOTHER = "Call web_fetch on a different article URL from the search results; if that also fails, use the excerpts as the source."

function describeFailure(error: unknown): string {
  const text = error instanceof Error ? `${error.message}\n${(error as { stderr?: string }).stderr ?? ""}` : String(error)
  const status = text.match(/Failed to fetch: (\d{3})/)?.[1]
  if (status === "401" || status === "402" || status === "403") return `HTTP ${status}: the site refuses automated readers (paywall or bot block). ${TRY_ANOTHER}`
  if (status === "404") return "HTTP 404: the page does not exist at that URL."
  if (status) return `HTTP ${status} from the site.`
  if (/ETIMEDOUT|timed out|SIGTERM/.test(text)) return `Timed out after ${TIMEOUT_MS / 1000} seconds.`
  if (/ENOENT/.test(text)) return `Defuddle is not installed at ${defuddleBinary()}; install the node-clis from the dotfiles.`
  const reported = text.match(/^Error: (.*)$/m)?.[1]
  return reported ? `${reported}. ${TRY_ANOTHER}` : `could not extract an article from the page (it may need JavaScript). ${TRY_ANOTHER}`
}

export default tool({
  description:
    "Read one web page and return just its article text as markdown, with title, author, date and word count. " +
    "Use it on a specific article URL taken from a search result when the excerpt is not enough; " +
    "long articles return in pages, so call again with offset to continue. Fetch a site's news front page only to list what it is leading with; never fetch a search engine.",
  args: {
    url: tool.schema.string().url().describe("Full URL of one article or document page"),
    offset: tool.schema.number().int().min(0).optional().describe("Character offset to continue a long article from (default 0)"),
    maxChars: tool.schema
      .number()
      .int()
      .min(500)
      .max(MAX_MAX_CHARS)
      .optional()
      .describe(`Maximum characters of article text to return (default ${DEFAULT_MAX_CHARS})`),
  },
  async execute(args: { url: string; offset?: number; maxChars?: number }) {
    const offset = args.offset ?? 0
    const maxChars = args.maxChars ?? DEFAULT_MAX_CHARS
    // web_search decodes these; one left over means decoding failed, and the
    // redirect itself only leads to a Google consent page.
    if (/^news\.google\.com$/i.test(new URL(args.url).hostname)) {
      return `${args.url} is a Google News redirect, not the article. Use the search excerpt as the source, or search again with fewer words to get the publisher's own URL.`
    }
    let article: Article
    try {
      article = (await msnArticle(args.url)) ?? (await extract(args.url))
    } catch (error) {
      return `Fetch failed for ${args.url}: ${describeFailure(error)}`
    }
    const body = tidy(article.contentMarkdown?.trim() ? article.contentMarkdown : stripTags(article.content ?? ""))
    if (!body) return `Fetch of ${args.url} returned no readable article text (the page may need JavaScript). ${TRY_ANOTHER}`
    const header = [
      article.title ? `Title: ${article.title}` : undefined,
      article.site || article.domain ? `Site: ${article.site ?? article.domain}` : undefined,
      article.author ? `Author: ${article.author}` : undefined,
      article.published ? `Published: ${article.published.slice(0, 10)}` : undefined,
      `URL: ${args.url}`,
      article.original ? `Original: ${article.original}` : undefined,
      article.wordCount ? `Length: ${article.wordCount} words` : undefined,
    ]
      .filter(Boolean)
      .join("\n")
    const slice = body.slice(offset, offset + maxChars)
    const remaining = body.length - (offset + slice.length)
    const footer = remaining > 0 ? `\n\n[${remaining} more characters; call web_fetch again with offset=${offset + slice.length} to continue]` : ""
    const lead = offset > 0 ? `\n\n[continuing from character ${offset}]` : ""
    // Small models skip the system prompt's citation rule but follow one
    // placed beside the data.
    const cite = `\n\n[Use only what this page says, and cite ${args.url} for facts taken from it.]`
    return `${header}${lead}\n\n${slice}${footer}${cite}`
  },
})
