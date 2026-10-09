import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarHeatmap } from '../components/CalendarHeatmap'
import { useFormat } from '../i18n/useFormat'
import type { LatLng } from '../lib/geo'
import { summaryKeys } from '../lib/score'
import { LABEL_COLOR } from '../lib/theme'
import { addDays, fetchSunsetHistory, HISTORY_START, isoDate, MAX_HISTORY_DAYS, type DayForecast } from '../lib/weather'

interface Props {
  place: LatLng
  placeName: string
  /** Jump straight to this day (e.g. the date a photo was taken). */
  focusDate?: Date
}

interface Range {
  from: Date
  to: Date
}

type Preset = 7 | 30 | 90 | 'custom'
type State = { status: 'loading' } | { status: 'ready'; days: DayForecast[] } | { status: 'error' }

const PRESETS = [7, 30, 90] as const

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const yesterday = () => addDays(startOfDay(new Date()), -1)
const parseInputDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function lastDays(n: number): Range {
  const to = yesterday()
  return { from: addDays(to, -(n - 1)), to }
}

/** A week around a date, clamped to yesterday. */
function rangeAround(date: Date): Range {
  const day = startOfDay(date)
  const to = addDays(day, 3) > yesterday() ? yesterday() : addDays(day, 3)
  return { from: addDays(day, -3), to }
}

/** Past sunsets at a place, scored from recorded weather: a calendar heatmap plus the best days. */
export function History({ place, placeName, focusDate }: Props) {
  const { t } = useTranslation()
  const f = useFormat()
  const [preset, setPreset] = useState<Preset>(focusDate ? 'custom' : 30)
  const [range, setRange] = useState<Range>(() => (focusDate ? rangeAround(focusDate) : lastDays(30)))
  const [customOpen, setCustomOpen] = useState(Boolean(focusDate))
  const [draft, setDraft] = useState(() => ({ from: isoDate(range.from), to: isoDate(range.to) }))
  const [state, setState] = useState<State>({ status: 'loading' })
  const [selected, setSelected] = useState<string | undefined>(focusDate && isoDate(focusDate))
  const [maxDate] = useState(() => isoDate(yesterday()))
  const { lat, lng } = place

  useEffect(() => {
    const controller = new AbortController()
    fetchSunsetHistory({ lat, lng }, range.from, range.to, controller.signal)
      .then((days) => setState({ status: 'ready', days }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [lat, lng, range])

  const show = (next: Range, p: Preset) => {
    let { from, to } = next
    if (to < from) [from, to] = [to, from]
    if (from < HISTORY_START) from = HISTORY_START
    if ((+to - +from) / 86_400_000 >= MAX_HISTORY_DAYS) to = addDays(from, MAX_HISTORY_DAYS - 1)
    setPreset(p)
    setDraft({ from: isoDate(from), to: isoDate(to) })
    setState({ status: 'loading' })
    setSelected(undefined)
    setRange({ from, to })
  }

  const days = state.status === 'ready' ? state.days : []
  const ranked = [...days].sort((a, b) => b.result.score - a.result.score)
  const picked = days.find((d) => isoDate(d.date) === selected)
  const shown = picked ?? ranked[0]
  const summary = shown && summaryKeys(shown.result)

  return (
    <main className="page">
      <header className="page-head">
        <h1>{t('history.title')}</h1>
        <p>{t('history.sub', { place: placeName })}</p>
      </header>

      <div className="segmented" role="group">
        {PRESETS.map((n) => (
          <button key={n} aria-pressed={preset === n} onClick={() => show(lastDays(n), n)}>
            {t('history.days', { n })}
          </button>
        ))}
      </div>
      <button className="text-link custom-link" aria-expanded={customOpen} onClick={() => setCustomOpen(!customOpen)}>
        {t('history.custom')}
      </button>
      {customOpen && (
        <form
          className="card range-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.from && draft.to) show({ from: parseInputDate(draft.from), to: parseInputDate(draft.to) }, 'custom')
          }}
        >
          <label>
            {t('history.from')}
            <input
              type="date"
              min={isoDate(HISTORY_START)}
              max={maxDate}
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label>
            {t('history.to')}
            <input
              type="date"
              min={isoDate(HISTORY_START)}
              max={maxDate}
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
          <button type="submit" className="primary-button small">
            {t('history.search')}
          </button>
          <p className="fine-print">{t('history.limits', { days: MAX_HISTORY_DAYS })}</p>
        </form>
      )}

      {state.status === 'loading' && <p className="status">{t('loading')}</p>}
      {state.status === 'error' && (
        <div className="status">
          <p>{t('error')}</p>
          <button className="chip-button" onClick={() => show(range, preset)}>
            {t('retry')}
          </button>
        </div>
      )}

      {state.status === 'ready' && shown && summary && (
        <>
          <section className="card day-card">
            <div className="day-card-head">
              <div className="day-card-when">
                <span className="muted-sm">{picked ? t('history.selected') : t('history.bestInRange')}</span>
                <span className="day-card-date">{f.full(shown.date)}</span>
                <span className="muted-sm">{t('history.sunset', { time: f.time(shown.times.sunset) })}</span>
              </div>
              <div className="day-card-score" style={{ color: LABEL_COLOR[shown.result.label] }}>
                <bdi className="serif-number">{shown.result.score}</bdi>
                <span>{t(`labels.${shown.result.label}`)}</span>
              </div>
            </div>
            <p className="serif-summary">
              {t(summary.head)} {t(summary.detail)}
            </p>
          </section>

          <section className="card calendar-card">
            <div className="calendar-title">
              <h2 className="card-title">
                {f.monthDay(days[0].date)} – {f.monthDay(days[days.length - 1].date)}
              </h2>
              <span className="fine-print">{t('history.tapDay')}</span>
            </div>
            <CalendarHeatmap days={days} selectedKey={isoDate(shown.date)} onSelect={setSelected} />
          </section>

          <section className="card list-card">
            <h2 className="card-title list-title">{t('history.bestInRange')}</h2>
            <ol className="best-list">
              {ranked.slice(0, 3).map((d, i) => (
                <li key={isoDate(d.date)}>
                  <button className="best-row-button" onClick={() => setSelected(isoDate(d.date))}>
                    <span className="best-rank">{i + 1}</span>
                    <span className="best-date">{f.full(d.date)}</span>
                    <bdi className="best-score-sm" style={{ color: LABEL_COLOR[d.result.label] }}>
                      {d.result.score}
                    </bdi>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  )
}
