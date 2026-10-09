#!/usr/bin/env node
/**
 * Collects recent weather posts from public sources into one JSON file the app reads.
 * Run by the Pages workflow every 30 minutes: `node scripts/fetch-osint.mjs dist/osint.json`.
 *
 * Only fetches and normalises; all keyword analysis happens in the app (src/lib/osint), so posts
 * the user shares from WhatsApp go through exactly the same logic. Never fails the build: a source
 * that errors is reported in `sources[].error` and skipped.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const out = process.argv[2] ?? 'dist/osint.json'
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

/** Public channel preview (t.me/s/<handle>) — the last ~20 posts as HTML. */
async function telegram(source) {
  const html = await get(`https://t.me/s/${source.fetch.handle}`)
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

const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000
const report = []
const posts = []
for (const source of sources) {
  const fetcher = FETCHERS[source.fetch.type]
  if (!fetcher) continue // "share" sources come from the user's device
  try {
    let got = (await fetcher(source)).filter((p) => p.text && Date.parse(p.publishedAt) >= cutoff)
    // Ignore links when topic-filtering: a channel footer like t.me/Weather_newsil isn't weather news.
    if (source.fetch.weatherOnly) got = got.filter((p) => WEATHER_RE.test(p.text.replace(/https?:\/\/\S+/g, '')))
    got = got.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, MAX_PER_SOURCE)
    posts.push(...got.map((p) => ({ ...p, sourceId: source.id, text: p.text.slice(0, 2000) })))
    report.push({ id: source.id, ok: true, count: got.length })
  } catch (err) {
    report.push({ id: source.id, ok: false, error: String(err?.message ?? err) })
  }
}

posts.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), sources: report, posts }))
console.log(`osint: ${posts.length} posts → ${out}`, report.map((r) => `${r.id}:${r.ok ? r.count : 'ERR ' + r.error}`).join(' '))
