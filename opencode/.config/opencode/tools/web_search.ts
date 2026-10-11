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

type Item = { title: string; url: string; source?: string; published?: Date; snippet: string }

function unescape(text: string): string {
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function field(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))
  return match ? unescape(match[1]) : ""
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
    return [
      {
        title,
        url,
        source: field(block, "News:Source") || field(block, "source") || undefined,
        published: Number.isNaN(published.getTime()) ? undefined : published,
        snippet: field(block, "description").slice(0, SNIPPET_CHARS),
      },
    ]
  })
}

async function feed(url: string): Promise<Item[]> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" } })
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`)
  return parseRss(await res.text())
}

async function search(query: string): Promise<{ items: Item[]; provider: string }> {
  const q = encodeURIComponent(query)
  const providers: [string, string][] = [
    ["Bing News", `https://www.bing.com/news/search?q=${q}&format=rss`],
    ["Google News", `https://news.google.com/rss/search?q=${q}&hl=en-GB&gl=GB&ceid=GB:en`],
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
  if (errors.length > 0) throw new Error(`News feeds unavailable (${errors.join("; ")}). Tell the user; do not claim nothing was found.`)
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
    "topics without news coverage fall back to a general web search. " +
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
    let { items, provider } = await search(query)
    let recent = items
      .filter((item) => !item.published || item.published >= since)
      .sort((a, b) => (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0))
      .slice(0, MAX_ITEMS)
    if (recent.length < 2) {
      try {
        const general = await exaSearch(query, today, floor)
        if (general.length > recent.length) {
          recent = general.slice(0, MAX_ITEMS)
          provider = "Exa web search"
        }
      } catch (error) {
        if (recent.length === 0) {
          return `No news articles found for "${query}" in the last ${days} days, and the general web search failed (${error instanceof Error ? error.message : String(error)}). Tell the user; try other words for the topic.`
        }
      }
    }
    if (recent.length === 0) {
      return `No articles found for "${query}" in the last ${days} days via ${provider} (today is ${today}). Try other words for the topic.`
    }
    const lines = recent.map((item, i) => {
      const date = item.published ? item.published.toISOString().slice(0, 10) : "undated"
      const source = item.source ? ` (${item.source})` : ""
      return `${i + 1}. ${item.title}${source}\n   ${date}  ${item.url}${item.snippet ? `\n   ${item.snippet}` : ""}`
    })
    return `Today is ${today}. Newest articles for "${query}" via ${provider} (last ${days} days):\n\n${lines.join("\n\n")}`
  },
})
