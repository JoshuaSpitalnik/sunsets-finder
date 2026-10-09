/** A post from a weather source: fetched by the scheduled job, or shared/pasted by the user. */
export interface OsintPost {
  id: string
  sourceId: string
  text: string
  /** ISO timestamp. */
  publishedAt: string
  url?: string
  /** The day the whole post is about (IMS forecasts carry one per day), YYYY-MM-DD. */
  forDate?: string
  /** Added by the user on this device (share / paste). */
  shared?: boolean
}

export type CueKey =
  | 'sunset'
  | 'cirrus'
  | 'highCloud'
  | 'clearing'
  | 'partlyCloudy'
  | 'rain'
  | 'storm'
  | 'lowCloud'
  | 'haze'
  | 'dust'
  | 'fog'
  | 'overcast'
  | 'clear'

/** One sunset-relevant clue found in a post, tied to a day. */
export interface Lead {
  postId: string
  sourceId: string
  publishedAt: string
  /** YYYY-MM-DD the clue refers to. */
  date: string
  cue: CueKey
  /** Signed weight after hedging and region: + helps colour, − hurts it. */
  weight: number
  hedged: boolean
  /** The post talks about another part of the country. */
  otherRegion: boolean
}

/** Character range in a post's text to highlight. */
export interface Mark {
  start: number
  end: number
  cue: CueKey
  positive: boolean
}

/** How forecasters moved one day's score. */
export interface DayOsint {
  /** Points added to (or taken from) the weather model's score. */
  adjustment: number
  /** Leads that contributed, strongest first. */
  leads: Lead[]
}

export type Reliability = 'off' | 'low' | 'medium' | 'high'
