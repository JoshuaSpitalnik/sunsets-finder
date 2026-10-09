import { useTranslation } from 'react-i18next'
import { IconBookmark, IconHistory, IconMap, IconTonight } from './Icons'

export type Tab = 'tonight' | 'map' | 'spots' | 'history'

const TABS: { id: Tab; Icon: () => React.ReactElement }[] = [
  { id: 'tonight', Icon: () => <IconTonight /> },
  { id: 'map', Icon: () => <IconMap /> },
  { id: 'spots', Icon: () => <IconBookmark /> },
  { id: 'history', Icon: () => <IconHistory /> },
]

/** Floating glass pill with the four tabs. */
export function TabBar({ tab, onTab, dark }: { tab: Tab; onTab: (t: Tab) => void; dark?: boolean }) {
  const { t } = useTranslation()
  return (
    <nav className={dark ? 'tabbar tabbar-dark' : 'tabbar'}>
      {TABS.map(({ id, Icon }) => (
        <button key={id} className="tabbar-tab" aria-current={tab === id ? 'page' : undefined} onClick={() => onTab(id)}>
          <Icon />
          {t(`tabs.${id}`)}
        </button>
      ))}
    </nav>
  )
}
