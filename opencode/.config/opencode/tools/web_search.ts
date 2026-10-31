// OpenCode loads this file from its real path inside the dotfiles checkout, where
// no node_modules exists, so the plugin helper is imported from OpenCode's own
// config directory, which OpenCode populates on first start.
const configDir = process.env.XDG_CONFIG_HOME ?? `${process.env.HOME}/.config`
const { tool } = await import(`${configDir}/opencode/node_modules/@opencode-ai/plugin/dist/index.js`)

// Newest-first search for small local models. Public news RSS feeds need no
// key and have no daily quota, every item carries a publication date, and the
// date window is applied here at call time, so a model that believes it is still
// its training year gets this week's articles anyway. Each item is short enough
// to fit a 64K context.

const DEFAULT_DAYS = 90
const MAX_DAYS = 3650
const MAX_ITEMS = 8
const SNIPPET_CHARS = 300
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X) opencode-web_search"
const BROWSER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
const RESOLVE_TIMEOUT_MS = 10_000

// Bing News answers an empty feed when the query carries words like these
// ("local news London today" returns nothing, "London" returns eleven), so an
// empty answer is retried without them before falling back to Google.
const FILLER = /\b(?:today|tonight|latest|recent|current|breaking|top|stories|headlines|local|news)\b/gi

// How-to and documentation questions are answered by reference pages, which
// the news feeds do not carry ("how to configure LM Studio context length"
// got SEO blog posts from them, never LM Studio's docs), so these go to Exa
// first and fall back to the feeds.
const REFERENCE =
  /^\s*how\s+(?:to|do|does|can|should)\b|\b(?:docs?|documentation|tutorial|guide|manual|reference|configur\w*|install\w*|set\s?up|api|syntax|example|error)\b/i

// Sites that refused web_fetch's reader on 2026-10-31 (HTTP 401, 402 or 403).
// Bing often ranks them first, and the model fetches the first result and
// gives up when it is blocked, so they are marked before it picks.
const BLOCKS_READERS = /(^|\.)(?:ft\.com|telegraph\.co\.uk|news\.sky\.com|wsj\.com|bloomberg\.com|economist\.com|nytimes\.com|reuters\.com)$/i

function blocksReaders(url: string): boolean {
  try {
    return BLOCKS_READERS.test(new URL(url).hostname)
  } catch {
    return false
  }
}

type Item = { title: string; url: string; source?: string; published?: Date; snippet: string }

// Entities are decoded before tags are stripped because Google News escapes
// the HTML inside its descriptions, and &amp; goes last so "&amp;nbsp;" ends
// up as a space rather than a literal entity.
function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const letters = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")

function field(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))
  return match ? decodeEntities(match[1]) : ""
}

function parseRss(xml: string): Item[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, block]) => {
    const title = field(block, "title")
    let url = field(block, "link")
    if (!title || !url) return []
    // Bing wraps article links in a redirect that carries the real URL as a query parameter.
    try {
      const parsed = new URL(url)
      const real = parsed.searchParams.get("url")
      if (real && parsed.hostname.endsWith("bing.com")) url = real
    } catch {}
    const published = new Date(field(block, "pubDate"))
    const description = field(block, "description")
    return [
      {
        title,
        url,
        source: field(block, "News:Source") || field(block, "source") || undefined,
        published: Number.isNaN(published.getTime()) ? undefined : published,
        // Google's description is usually just the headline and source again.
        snippet: letters(description) === letters(title) ? "" : description.slice(0, SNIPPET_CHARS),
      },
    ]
  })
}

// Google News links are redirects no reader can follow: from the UK they land
// on a cookie-consent page (SOCS=CAI answers it), and past that the article
// URL only comes from Google's own decoding endpoint, keyed by a signature and
// timestamp embedded in the redirect page. Any failure keeps the original link.
const GOOGLE_HEADERS = { "User-Agent": BROWSER_AGENT, Cookie: "SOCS=CAI" }

async function resolveGoogleNews(url: string): Promise<string> {
  try {
    const id = new URL(url).pathname.match(/\/articles\/([^/]+)$/)?.[1]
    if (!id) return url
    const page = await fetch(url, { headers: GOOGLE_HEADERS, signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS) })
    const html = await page.text()
    const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1]
    const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1]
    if (!signature || !timestamp) return url
    const request = [
      "garturlreq",
      [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      id,
      Number(timestamp),
      signature,
    ]
    const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      headers: { ...GOOGLE_HEADERS, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ "f.req": JSON.stringify([[["Fbv4je", JSON.stringify(request), null, "generic"]]]) }),
      signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
    })
    const envelope = JSON.parse((await res.text()).split("\n\n")[1])
    const real = JSON.parse(envelope[0][2])[1]
    return typeof real === "string" && /^https?:\/\//.test(real) ? real : url
  } catch {
    return url
  }
}

async function feed(url: string): Promise<Item[]> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" } })
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`)
  return parseRss(await res.text())
}

async function search(query: string): Promise<{ items: Item[]; provider: string }> {
  const bing = (q: string) => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`
  const shorter = query.replace(FILLER, " ").replace(/\s+/g, " ").trim()
  const providers: [string, string][] = [
    ["Bing News", bing(query)],
    ...(shorter && shorter !== query ? [["Bing News", bing(shorter)] as [string, string]] : []),
    ["Google News", `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`],
  ]
  const errors: string[] = []
  for (const [provider, url] of providers) {
    try {
      const items = await feed(url)
      if (items.length > 0) return { items, provider }
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (errors.length > 0) throw new Error(`news feeds unavailable (${errors.join("; ")})`)
  return { items: [], provider: "news feeds" }
}

// Topics the news feeds do not cover (documentation, software, people) fall back
// to the same hosted Exa endpoint as OpenCode's built-in websearch. Its free
// tier is rate limited; EXA_API_KEY lifts that, exactly as for the built-in tool.
const EXA_ENDPOINT = process.env.EXA_API_KEY
  ? `https://mcp.exa.ai/mcp?exaApiKey=${encodeURIComponent(process.env.EXA_API_KEY)}`
  : "https://mcp.exa.ai/mcp"

async function exaRpc(session: string | undefined, body: Record<string, unknown>) {
  const res = await fetch(EXA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  })
  if (!res.ok && res.status !== 202) throw new Error(`Exa ${res.status}`)
  const messages = (await res.text())
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()))
  return { session: res.headers.get("mcp-session-id") ?? session, messages }
}

async function exaSearch(query: string, today: string, floor: string): Promise<Item[]> {
  const init = await exaRpc(undefined, {
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "opencode-web_search", version: "1" } },
  })
  await exaRpc(init.session, { method: "notifications/initialized" })
  const objective = `Rank the most recently published pages first. Today is ${today}; prefer pages published after ${floor}.`
  const call = await exaRpc(init.session, {
    id: 2,
    method: "tools/call",
    params: { name: "web_search_exa", arguments: { query, numResults: MAX_ITEMS, objective } },
  })
  const result = call.messages.find((m) => m.id === 2)?.result
  if (!result || result.isError) throw new Error("Exa returned no result")
  if (result._meta?.["ai.exa/rateLimited"]) throw new Error("Exa's free tier is rate limited; set EXA_API_KEY or retry later")
  const text = (result.content ?? []).map((c: { text?: string }) => c.text ?? "").join("\n")
  return text.split(/\n-{3,}\n/).flatMap((block) => {
    const get = (name: string) => block.match(new RegExp(`^${name}: (.*)$`, "m"))?.[1]?.trim()
    const title = get("Title")
    const url = get("URL")
    if (!title || !url) return []
    const published = new Date(get("Published") ?? "")
    const snippet = block.replace(/^(Title|URL|Published|Author|Highlights):.*$/gm, "").replace(/\s+/g, " ").trim()
    return [{ title, url, published: Number.isNaN(published.getTime()) ? undefined : published, snippet: snippet.slice(0, SNIPPET_CHARS) }]
  })
}

export default tool({
  description:
    "Search the web. Returns the newest articles about a topic first, each with its publication date, source, URL and a one-line excerpt; " +
    "how-to and documentation questions, and topics without news coverage, use a general web search. " +
    "Use it for news, current events, people, organisations, releases and any 'latest' or 'most recent' question. " +
    "Describe the topic in plain words; years in the query are ignored because the newest results are returned anyway.",
  args: {
    query: tool.schema.string().describe("Topic to find the newest articles about, without a year"),
    days: tool.schema
      .number()
      .int()
      .min(1)
      .max(MAX_DAYS)
      .optional()
      .describe(`How many days back to look (default ${DEFAULT_DAYS})`),
  },
  async execute(args: { query: string; days?: number }) {
    const days = args.days ?? DEFAULT_DAYS
    const now = new Date()
    const since = new Date(now.getTime() - days * 86_400_000)
    const today = now.toISOString().slice(0, 10)
    const floor = since.toISOString().slice(0, 10)
    // Small models stamp their training year onto queries; the date window below
    // already decides recency, so bare years only narrow the feed search.
    const query = args.query.replace(/\b(?:19|20)\d\d\b/g, " ").replace(/\s+/g, " ").trim() || args.query
    let recent: Item[] = []
    let provider = "news feeds"
    const failures: string[] = []
    const reason = (error: unknown) => (error instanceof Error ? error.message : String(error))
    const tryNews = async () => {
      try {
        const news = await search(query)
        const dated = news.items
          .filter((item) => !item.published || item.published >= since)
          .sort((a, b) => (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0))
          .slice(0, MAX_ITEMS)
        if (dated.length > recent.length) {
          recent = dated
          provider = news.provider
        }
      } catch (error) {
        failures.push(reason(error))
      }
    }
    const tryExa = async () => {
      try {
        const general = await exaSearch(query, today, floor)
        if (general.length > recent.length) {
          recent = general.slice(0, MAX_ITEMS)
          provider = "Exa web search"
        }
      } catch (error) {
        failures.push(`general web search: ${reason(error)}`)
      }
    }
    for (const attempt of REFERENCE.test(query) ? [tryExa, tryNews] : [tryNews, tryExa]) {
      if (recent.length >= 2) break
      await attempt()
    }
    if (recent.length === 0) {
      const failed = failures.length > 0 ? ` Searches failed (${failures.join("; ")}); tell the user, and do not claim nothing exists.` : ""
      return `No articles found for "${query}" in the last ${days} days (today is ${today}).${failed} Try other words for the topic.`
    }
    if (provider === "Google News") {
      recent = await Promise.all(recent.map(async (item) => ({ ...item, url: await resolveGoogleNews(item.url) })))
    }
    const lines = recent.map((item, i) => {
      const date = item.published ? item.published.toISOString().slice(0, 10) : "undated"
      const source = item.source ? ` (${item.source})` : ""
      const blocked = blocksReaders(item.url) ? " [paywalled: excerpt only, do not fetch]" : ""
      return `${i + 1}. ${item.title}${source}${blocked}\n   ${date}  ${item.url}${item.snippet ? `\n   ${item.snippet}` : ""}`
    })
    const heading =
      provider === "Exa web search"
        ? `Web pages for "${query}" via ${provider}`
        : `Newest articles for "${query}" via ${provider} (last ${days} days)`
    // Small models skip the system prompt's citation rule but follow one
    // placed beside the data.
    return `Today is ${today}. ${heading}:\n\n${lines.join("\n\n")}\n\n[Use only what these results say, and put the URL after each fact you take from them.]`
  },
})
