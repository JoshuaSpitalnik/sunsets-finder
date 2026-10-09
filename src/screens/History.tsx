import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DayDetail } from '../components/DayDetail'
import { PlaceHeader } from '../components/PlaceHeader'
import { localeFor } from '../i18n'
import type { Place } from '../lib/location'
import { addDays, fetchSunsetHistory, HISTORY_START, isoDate, MAX_HISTORY_DAYS, type DayForecast } from '../lib/weather'

interface Props {
  place: Place
  /** Jump straight to this day (e.g. the date a photo was taken). */
  focusDate?: Date
  onUseGps: () => void
  onOpenMap: () => void
}

interface Range {
  from: Date
  to: Date
}

type State = { status: 'loading' } | { status: 'ready'; days: DayForecast[] } | { status: 'error' }

const PRESETS = [7, 30, 90]
const BEST_COUNT = 3

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const parseInputDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const sameDay = (a: Date, b: Date) => isoDate(a) === isoDate(b)

function lastDays(n: number): Range {
  const to = addDays(startOfDay(new Date()), -1)
  return { from: addDays(to, -(n - 1)), to }
}

function rangeAround(date: Date): Range {
  const yesterday = addDays(startOfDay(new Date()), -1)
  const to = addDays(startOfDay(date), 3) > yesterday ? yesterday : addDays(startOfDay(date), 3)
  return { from: addDays(startOfDay(date), -3), to }
}

/** Search past sunsets: score every day in a range from archived weather and rank them. */
export function History({ place, focusDate, onUseGps, onOpenMap }: Props) {
  const { t, i18n } = useTranslation()
  const [range, setRange] = useState<Range>(() => (focusDate ? rangeAround(focusDate) : lastDays(30)))
  const [draft, setDraft] = useState(() => ({ from: isoDate(range.from), to: isoDate(range.to) }))
  const [state, setState] = useState<State>({ status: 'loading' })
  const [selected, setSelected] = useState<string | undefined>(focusDate && isoDate(focusDate))
  const [sortByScore, setSortByScore] = useState(false)
  const { lat, lng } = place
  const detailRef = useRef<HTMLElement>(null)

  const fmt = new Intl.DateTimeFormat(localeFor(i18n.language), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const [maxDate] = useState(() => isoDate(addDays(new Date(), -1)))
  const minDate = isoDate(HISTORY_START)

  useEffect(() => {
    const controller = new AbortController()
    fetchSunsetHistory({ lat, lng }, range.from, range.to, controller.signal)
      .then((days) => setState({ status: 'ready', days }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [lat, lng, range])

  const showDay = (d: DayForecast) => {
    setSelected(isoDate(d.date))
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const search = (next: Range) => {
    let { from, to } = next
    if (to < from) [from, to] = [to, from]
    if (from < HISTORY_START) from = HISTORY_START
    if ((to.getTime() - from.getTime()) / 86_400_000 >= MAX_HISTORY_DAYS) to = addDays(from, MAX_HISTORY_DAYS - 1)
    setDraft({ from: isoDate(from), to: isoDate(to) })
    setState({ status: 'loading' })
    setSelected(undefined)
    setRange({ from, to })
  }

  const days = state.status === 'ready' ? state.days : []
  const best = [...days].sort((a, b) => b.result.score - a.result.score).slice(0, BEST_COUNT)
  const listed = sortByScore ? [...days].sort((a, b) => b.result.score - a.result.score) : [...days].reverse()
  const selectedDay = days.find((d) => isoDate(d.date) === selected)

  return (
    <main className="history">
      <PlaceHeader place={place} onUseGps={onUseGps} onOpenMap={onOpenMap} />

      <section className="search-panel">
        <h2>{t('history.title')}</h2>
        <div className="presets">
          {PRESETS.map((n) => (
            <button key={n} onClick={() => search(lastDays(n))}>
              {t('history.lastDays', { n })}
            </button>
          ))}
        </div>
        <form
          className="range-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.from && draft.to) search({ from: parseInputDate(draft.from), to: parseInputDate(draft.to) })
          }}
        >
          <label>
            {t('history.from')}
            <input type="date" min={minDate} max={maxDate} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </label>
          <label>
            {t('history.to')}
            <input type="date" min={minDate} max={maxDate} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </label>
          <button type="submit">{t('history.search')}</button>
        </form>
        <p className="muted small">{t('history.limits', { days: MAX_HISTORY_DAYS })}</p>
      </section>

      {state.status === 'loading' && <p className="status">{t('loadingForecast')}</p>}
      {state.status === 'error' && (
        <div className="status">
          <p>{t('error')}</p>
          <button onClick={() => search(range)}>{t('retry')}</button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          {selectedDay && (
            <section className="selected-day" ref={detailRef}>
              <h3>{fmt.format(selectedDay.date)}</h3>
              <DayDetail day={selectedDay} />
            </section>
          )}

          <section>
            <h3>{t('history.best')}</h3>
            <ol className="best">
              {best.map((d) => (
                <li key={isoDate(d.date)}>
                  <button className={`best-day score-${d.result.label}`} onClick={() => showDay(d)}>
                    <bdi className="day-score">{d.result.score}</bdi>
                    <span>{fmt.format(d.date)}</span>
                    <span className="day-label">{t(`labels.${d.result.label}`)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <div className="list-head">
              <h3>{t('history.allDays', { n: days.length })}</h3>
              <button className="link" onClick={() => setSortByScore(!sortByScore)}>
                {sortByScore ? t('history.sortDate') : t('history.sortScore')}
              </button>
            </div>
            <ul className="day-list">
              {listed.map((d) => (
                <li key={isoDate(d.date)}>
                  <button
                    className={`day-row score-${d.result.label}`}
                    aria-pressed={selected !== undefined && sameDay(d.date, parseInputDate(selected))}
                    onClick={() => showDay(d)}
                  >
                    <span className="day-row-date">{fmt.format(d.date)}</span>
                    <span className="bar" aria-hidden="true">
                      <span style={{ inlineSize: `${d.result.score}%` }} />
                    </span>
                    <bdi className="day-row-score">{d.result.score}</bdi>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}
