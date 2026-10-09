interface Props {
  on: boolean
  onChange: (on: boolean) => void
  /** Accessible name — the visible row text. */
  label: string
}

/** iOS-style switch (51×31). */
export function Toggle({ on, onChange, label }: Props) {
  return (
    <button className="toggle" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span className="toggle-knob" />
    </button>
  )
}
