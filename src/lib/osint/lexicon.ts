import type { CueKey } from './types'

/**
 * Words forecasters use that say something about sunset colour. Weights are on the same rough
 * scale as the model's reasons: high/mid cloud ("ענני נוצה") is the classic colourful-sunset sign;
 * low cloud, haze, dust and rain mute it. Hebrew patterns allow common one-letter prefixes
 * (ו/ה/ב/ל) and reject matches inside longer words.
 */
export interface Cue {
  key: CueKey
  weight: number
  patterns: RegExp[]
}

const HEB = '\\u05D0-\\u05EA'
/** Whole Hebrew word (optionally prefixed by ו/ה/ב/ל/מ/ש). */
const he = (body: string) => new RegExp(`(?<![${HEB}])(?:[והבלמש]{1,2})?(?:${body})(?![${HEB}])`, 'g')
const en = (body: string) => new RegExp(`\\b(?:${body})\\b`, 'gi')

export const CUES: Cue[] = [
  {
    key: 'sunset',
    weight: 4,
    patterns: [
      he('שקיע(?:ה|ות)\\s+(?:יפ(?:ה|ות)|מרהיב\\S*|צבעוני\\S*|אדומ\\S*|מרשימ\\S*|מיוחד\\S*|מדהימ\\S*|ציורי\\S*|מהממ\\S*)'),
      he('שמיים\\s+צבעוניים|שמים\\s+צבעוניים'),
      en('(?:beautiful|colou?rful|stunning|spectacular|vivid|gorgeous)\\s+sunsets?'),
    ],
  },
  { key: 'cirrus', weight: 3, patterns: [he('ענני\\s+(?:נוצה|צעיף)'), en('cirr(?:us|ostratus|ocumulus)')] },
  {
    key: 'highCloud',
    weight: 2.5,
    patterns: [
      he('עננות\\s+(?:גבוהה|בינונית)|עננים\\s+גבוהים|ענני\\s+(?:גובה|ביניים)'),
      en('high(?:[\\s-]+level)?\\s+clouds?|altocumulus|altostratus'),
    ],
  },
  { key: 'clearing', weight: 2, patterns: [he('התבהרות|יתבהר|תתבהר|מתבהר'), en('clearing|clears\\s+up')] },
  { key: 'partlyCloudy', weight: 1, patterns: [he('מעונן\\s+חלקית'), en('partly\\s+cloudy')] },
  {
    key: 'storm',
    weight: -3,
    patterns: [he('סער(?:ה|ות)|סופ(?:ה|ת|ות)|סגריר'), en('storms?|thunderstorms?')],
  },
  {
    key: 'rain',
    weight: -2,
    patterns: [he('גשם|גשמים|ממטרים|טפטוף|טפטופים|ממטר'), en('rain|showers|drizzle')],
  },
  {
    key: 'lowCloud',
    weight: -2.5,
    patterns: [he('עננות\\s+נמוכה|עננים\\s+נמוכים|ענני\\s+סטרטוס'), en('low\\s+clouds?|stratus')],
  },
  { key: 'dust', weight: -2.5, patterns: [he('אבק|שרב'), en('dust(?:y)?|sharav|sandstorm')] },
  { key: 'haze', weight: -2, patterns: [he('אובך'), en('haz[ey]')] },
  { key: 'fog', weight: -2, patterns: [he('ערפל|ערפילים'), en('fog(?:gy)?')] },
  {
    key: 'overcast',
    weight: -1.5,
    // "מעונן חלקית" is partly cloudy (handled above), not overcast.
    patterns: [new RegExp(`(?<![${HEB}])ו?מעונן(?![${HEB}])(?!\\s+חלקית)`, 'g'), en('overcast|(?<!partly\\s)cloudy')],
  },
  { key: 'clear', weight: -1, patterns: [he('בהיר|שמשי'), en('clear\\s+skies?|sunny')] },
]

/** Words that soften a statement ("might", "could"): the clue counts for less. */
export const HEDGE = new RegExp(
  `(?<![${HEB}])(?:ייתכנ\\S*|יתכנ\\S*|ייתכן|יתכן|אולי|עשוי\\S*|סיכוי|אפשרות|לעיתים)(?![${HEB}])|\\b(?:might|may|could|possible|possibly|chance)\\b`,
  'i',
)
export const HEDGE_FACTOR = 0.6

/** A cue right after one of these ("ללא גשם", "no rain") is negated and ignored. */
export const NEGATION_BEFORE = new RegExp(`(?:(?<![${HEB}])(?:ללא|לא|בלי|אין)|\\b(?:no|not|without)\\b)\\s+(?:\\S+\\s+)?$`, 'i')

/** Reports of weather that already happened ("ירדו גשמים", "נמדדו") — a weak hint about the evening. */
export const PAST = new RegExp(
  `(?<![${HEB}])(?:ירדו|ירד|נמדדו|נמדד|הייתה\\s+לנו|היה\\s+לנו|הצטברו)(?![${HEB}])|\\b(?:fell|fallen|fell\\s+overnight|was\\s+recorded)\\b`,
  'i',
)
export const PAST_FACTOR = 0.3
