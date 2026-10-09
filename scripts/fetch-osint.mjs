#!/usr/bin/env node
/**
 * Collects recent weather posts from public sources into one JSON file the app reads, and keeps a
 * monthly archive of every post for searching past dates.
 *
 *   node scripts/fetch-osint.mjs dist/osint.json [--archive <dir>] [--backfill-until YYYY-MM-DD]
 *
 * Run by the Pages workflow every 30 minutes with `--archive` (a checkout of the `osint-data`
 * branch). `--backfill-until` pages Telegram channels back in time (t.me/s/<handle>?before=<id>);
 * IMS and news feeds only expose current items, so their history starts when archiving did.
 *
 * Only fetches and normalises; all keyword analysis happens in the app (src/lib/osint), so posts
 * the user shares from WhatsApp go through exactly the same logic. Never fails the build: a source
 * that errors is reported in `sources[].error` and skipped.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const out = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'dist/osint.json'
const archiveDir = flag('--archive')
const backfillUntil = flag('--backfill-until')
const sources = JSON.parse(await readFile(new URL('../src/lib/osint/sources.json', import.meta.url), 'utf8'))

const MAX_AGE_DAYS = 7
const MAX_PER_SOURCE = 25
const UA = 'SunsetFinder/1.0 (+https://github.com/JoshuaSpitalnik/sunsets-finder)'
/** Topic filter for general feeds that mix weather with other news. */
const WEATHER_RE = /מזג[\s-]?ה?אוויר|תחזית|חזאי|גשם|גשמים|ממטרים|שרב|אובך|ענן|עננות|שקיעה|סערה|סופה|weather|forecast|rain|cloud|sunset/i

const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')

const htmlToText = (s) =>
  decodeEntities(
    s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

async function get(url, encoding) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  return new TextDecoder(encoding ?? 'utf-8').decode(buf)
}

/** Public channel preview (t.me/s/<handle>) — ~20 posts as HTML, the latest or those before a post number. */
async function telegram(source, before) {
  const html = await get(`https://t.me/s/${source.fetch.handle}${before ? `?before=${before}` : ''}`)
  const posts = []
  // One block per message; photo-only posts have no text and are skipped.
  for (const block of html.split('tgme_widget_message_wrap').slice(1)) {
    const id = block.match(/data-post="([^"]+)"/)?.[1]
    const text = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1]
    const time = block.match(/<time datetime="([^"]+)"/)?.[1]
    if (!id || !text || !time) continue
    posts.push({ id: `${source.id}:${id}`, url: `https://t.me/${id}`, text: htmlToText(text), publishedAt: time })
  }
  return posts
}

/** IMS national forecast: one post per forecast day, each with its explicit date. */
async function imsForecast(source) {
  const xml = await get(source.fetch.url, 'iso-8859-8')
  const issued = xml.match(/<IssueDateTime>([^<]+)<\/IssueDateTime>/)?.[1]
  // IMS issue times are Israel local time.
  const publishedAt = issued ? new Date(`${issued.replace(' ', 'T')}:00+03:00`).toISOString() : new Date().toISOString()
  const posts = []
  for (const [, date, block] of xml.matchAll(/<TimeUnitData><Date>([^<]+)<\/Date>([\s\S]*?)<\/TimeUnitData>/g)) {
    const he = block.match(/<ElementName>Weather in Hebrew<\/ElementName><ElementValue>([^<]*)<\/ElementValue>/)?.[1]
    if (!he?.trim()) continue
    posts.push({ id: `${source.id}:${issued}:${date}`, url: source.link, text: decodeEntities(he).trim(), publishedAt, forDate: date })
  }
  return posts
}

async function rss(source) {
  const xml = await get(source.fetch.url)
  const posts = []
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const pick = (tag) => item.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))?.[1] ?? ''
    const title = htmlToText(decodeEntities(pick('title')))
    const body = htmlToText(decodeEntities(pick('description')))
    const date = new Date(pick('pubDate') || pick('guid'))
    const link = decodeEntities(pick('link')).trim() || source.link
    posts.push({
      id: `${source.id}:${pick('guid') || link || title}`,
      url: link,
      text: body && body !== title ? `${title}\n${body}` : title,
      publishedAt: Number.isNaN(+date) ? new Date().toISOString() : date.toISOString(),
    })
  }
  return posts
}

const FETCHERS = { telegram, 'ims-forecast': imsForecast, rss }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Telegram history: page back until `until` (YYYY-MM-DD) or the channel's start. */
async function telegramHistory(source, until) {
  const stop = Date.parse(`${until}T00:00:00Z`)
  const all = []
  let before
  for (let page = 0; page < 600; page++) {
    const got = await telegram(source, before)
    if (got.length === 0) break
    all.push(...got)
    const oldest = got.reduce((a, b) => (Date.parse(a.publishedAt) < Date.parse(b.publishedAt) ? a : b))
    const num = +oldest.id.split('/').pop()
    if (Date.parse(oldest.publishedAt) < stop || !num || num === before) break
    before = num
    await sleep(700) // be gentle with t.me
  }
  return all.filter((p) => Date.parse(p.publishedAt) >= stop)
}

const isWeather = (source, p) =>
  // Ignore links when topic-filtering: a channel footer like t.me/Weather_newsil isn't weather news.
  !source.fetch.weatherOnly || WEATHER_RE.test(p.text.replace(/https?:\/\/\S+/g, ''))
const tidy = (source, p) => ({ ...p, sourceId: source.id, text: p.text.slice(0, 2000) })

const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000
const report = []
const posts = []
/** Everything fetched this run (incl. backfill), for the archive. */
const fetched = []
for (const source of sources) {
  const fetcher = FETCHERS[source.fetch.type]
  if (!fetcher) continue // "share" sources come from the user's device
  try {
    const latest = (await fetcher(source)).filter((p) => p.text && isWeather(source, p)).map((p) => tidy(source, p))
    fetched.push(...latest)
    if (backfillUntil && source.fetch.type === 'telegram') {
      const history = await telegramHistory(source, backfillUntil)
      fetched.push(...history.filter((p) => p.text && isWeather(source, p)).map((p) => tidy(source, p)))
    }
    const recent = latest
      .filter((p) => Date.parse(p.publishedAt) >= cutoff)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .slice(0, MAX_PER_SOURCE)
    posts.push(...recent)
    report.push({ id: source.id, ok: true, count: recent.length })
  } catch (err) {
    report.push({ id: source.id, ok: false, error: String(err?.message ?? err) })
  }
}

posts.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), sources: report, posts }))
console.log(`osint: ${posts.length} posts → ${out}`, report.map((r) => `${r.id}:${r.ok ? r.count : 'ERR ' + r.error}`).join(' '))

/**
 * Archive: one file per month (by publish date, Israel time) holding every post ever seen, merged
 * by id so re-fetching never duplicates; index.json lists the months and their post counts.
 */
if (archiveDir) {
  await mkdir(archiveDir, { recursive: true })
  const monthOf = (iso) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit' }).format(new Date(iso))
  const byMonth = new Map()
  for (const p of fetched) {
    const m = monthOf(p.publishedAt)
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m).push(p)
  }
  let added = 0
  for (const [month, incoming] of byMonth) {
    const file = join(archiveDir, `${month}.json`)
    let existing = []
    try {
      existing = JSON.parse(await readFile(file, 'utf8')).posts ?? []
    } catch {
      // New month.
    }
    const ids = new Set(existing.map((p) => p.id))
    const fresh = incoming.filter((p) => !ids.has(p.id) && ids.add(p.id))
    if (fresh.length === 0) continue
    added += fresh.length
    const merged = [...existing, ...fresh].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    await writeFile(file, JSON.stringify({ month, posts: merged }))
  }
  const months = {}
  for (const name of (await readdir(archiveDir)).filter((n) => /^\d{4}-\d{2}\.json$/.test(n)).sort()) {
    months[name.slice(0, 7)] = (JSON.parse(await readFile(join(archiveDir, name), 'utf8')).posts ?? []).length
  }
  await writeFile(join(archiveDir, 'index.json'), JSON.stringify({ updatedAt: new Date().toISOString(), months }))
  console.log(`archive: +${added} posts, ${Object.keys(months).length} months in ${archiveDir}`)
}
