import { addDays, isoDate } from '../weather'
import { CUES, HEDGE, HEDGE_FACTOR, NEGATION_BEFORE, PAST, PAST_FACTOR } from './lexicon'
import { appliesTo, type Region } from './region'
import type { Lead, Mark, OsintPost } from './types'

/** A clue about another part of the country counts for this much. */
export const OTHER_REGION_FACTOR = 0.3

const HEB = '\\u05D0-\\u05EA'
const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const WEEKDAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

interface DayRef {
  index: number
  dates: Date[]
}

const atNoon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)
const parseDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
/** Next date on or after `base` that falls on weekday `wd` (0 = Sunday). */
const nextWeekday = (base: Date, wd: number) => addDays(base, (wd - base.getDay() + 7) % 7)

/** Day references in a sentence ("היום", "בשלישי", "(שני)", "מחר", "10/10", "סוף השבוע"), with positions. */
export function findDayRefs(segment: string, base: Date): DayRef[] {
  const refs: DayRef[] = []
  const add = (re: RegExp, toDates: (m: RegExpMatchArray) => Date[] | undefined) => {
    for (const m of segment.matchAll(re)) {
      const dates = toDates(m)
      if (dates?.length) refs.push({ index: m.index ?? 0, dates })
    }
  }
  const word = (body: string) => new RegExp(`(?<![${HEB}])(?:${body})(?![${HEB}])`, 'g')

  add(word('היום|הערב|הלילה|בערב|ערב\\s+זה'), () => [base])
  add(/\b(?:today|tonight|this\s+evening)\b/gi, () => [base])
  add(word('מחר|למחר|ומחר'), () => [addDays(base, 1)])
  add(/\btomorrow\b/gi, () => [addDays(base, 1)])
  add(word('מחרתיים'), () => [addDays(base, 2)])
  add(word('(?:ב)?סוף\\s+השבוע|סופ"ש|סופ״ש'), () => [nextWeekday(base, 5), nextWeekday(base, 6)])
  // Long range: "בעוד כ-8 ימים", "בעוד שבוע", "השבוע הבא" — far enough that it never lands on tonight.
  add(/בעוד\s+(?:כ[-־]?\s*)?(\d+)\s+ימים/g, (m) => [addDays(base, +m[1])])
  add(word('בעוד\\s+(?:כ)?שבוע(?:יים)?|(?:ב)?שבוע\\s+הבא|אחרי\\s+אמצע\\s+השבוע\\s+הבא'), () => [addDays(base, 7)])
  add(/\bin\s+(?:about\s+)?(\d+)\s+days\b/gi, (m) => [addDays(base, +m[1])])
  add(/\bnext\s+week\b/gi, () => [addDays(base, 7)])
  add(/\b(?:this\s+)?weekend\b/gi, () => [nextWeekday(base, 5), nextWeekday(base, 6)])
  // Weekdays need a cue that they mean a day ("בשלישי", "ביום שני", "(שני)", "שני:") — "שני" alone is also "two".
  const wd = WEEKDAYS_HE.join('|')
  add(
    new RegExp(`(?<![${HEB}])(?:ביום\\s+|יום\\s+|החל\\s+מ(?:יום\\s+)?|עד\\s+(?:יום\\s+)?|ב|מ|\\(\\s*)(${wd})(?![${HEB}])|(?<![${HEB}])(${wd})(?=\\s*[,:)])|(?<![${HEB}])(שבת)(?![${HEB}])`, 'g'),
    (m) => [nextWeekday(base, WEEKDAYS_HE.indexOf(m[1] ?? m[2] ?? m[3]))],
  )
  add(new RegExp(`\\b(${WEEKDAYS_EN.join('|')})\\b`, 'gi'), (m) => [nextWeekday(base, WEEKDAYS_EN.indexOf(m[1].toLowerCase()))])
  // Explicit dates, day first (Israeli style): 10/10, 9.10, 09/10/2026.
  add(/(?<![\d:])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d:])/g, (m) => {
    const day = +m[1]
    const month = +m[2]
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
    let year = m[3] ? +m[3] : base.getFullYear()
    if (year < 100) year += 2000
    let d = new Date(year, month - 1, day, 12)
    if (!m[3] && +d < +addDays(base, -180)) d = new Date(year + 1, month - 1, day, 12)
    return [d]
  })
  return refs.sort((a, b) => a.index - b.index)
}

/** Sentences (split on line breaks and . ! ?) with their offsets in the text. */
function segments(text: string): { start: number; text: string }[] {
  return [...text.matchAll(/[^\n.!?]+[.!?]*/g)].map((m) => ({ start: m.index ?? 0, text: m[0] }))
}

/**
 * Find the sunset clues in a post and the day each refers to. Day context carries across
 * sentences ("היום ... ענני נוצה. בשלישי גשם."), so a clue belongs to the nearest day named
 * before it, else the first one after it in the sentence, else the previous sentence's day.
 */
export function analyzePost(post: OsintPost, region: Region): { leads: Lead[]; marks: Mark[] } {
  const base = post.forDate ? parseDay(post.forDate) : atNoon(new Date(post.publishedAt))
  let context: Date[] = [base]
  const best = new Map<string, Lead>()
  const marks: Mark[] = []

  for (const seg of segments(post.text)) {
    const refs = post.forDate ? [] : findDayRefs(seg.text, base)
    const hedged = HEDGE.test(seg.text)
    // "ירדו גשמים" reports rain that already fell, which often clears before sunset.
    const past = PAST.test(seg.text)
    const local = appliesTo(seg.text, region)
    const covered: [number, number][] = []

    for (const cue of CUES) {
      for (const pattern of cue.patterns) {
        for (const m of seg.text.matchAll(pattern)) {
          const start = m.index ?? 0
          const end = start + m[0].length
          if (covered.some(([a, b]) => start < b && end > a)) continue
          covered.push([start, end])
          if (NEGATION_BEFORE.test(seg.text.slice(Math.max(0, start - 24), start))) continue

          const before = refs.filter((r) => r.index <= start).at(-1)
          const dates = before?.dates ?? refs[0]?.dates ?? context
          const weight =
            cue.weight * (hedged ? HEDGE_FACTOR : 1) * (local ? 1 : OTHER_REGION_FACTOR) * (past ? PAST_FACTOR : 1)
          marks.push({ start: seg.start + start, end: seg.start + end, cue: cue.key, positive: cue.weight > 0 })
          for (const d of dates) {
            const date = isoDate(d)
            const key = `${date}|${cue.key}`
            const prev = best.get(key)
            if (!prev || Math.abs(weight) > Math.abs(prev.weight)) {
              best.set(key, {
                postId: post.id,
                sourceId: post.sourceId,
                publishedAt: post.publishedAt,
                date,
                cue: cue.key,
                weight,
                hedged,
                otherRegion: !local,
              })
            }
          }
        }
      }
    }
    if (refs.length) context = refs[refs.length - 1].dates
  }
  return { leads: [...best.values()], marks: marks.sort((a, b) => a.start - b.start) }
}
