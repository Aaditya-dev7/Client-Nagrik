import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Map, Users, PlusCircle, User as UserIcon } from 'lucide-react'

const items = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/community', label: 'Feed', icon: Users },
  { to: '/report', label: 'Report', icon: PlusCircle, emphasize: true },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/profile', label: 'Profile', icon: UserIcon },
]

export default function BottomNav() {
  const loc = useLocation()
  const nav = useNavigate()

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto max-w-md grid grid-cols-5 gap-1 px-2 py-2">
        {items.map(({ to, label, icon: Icon, emphasize }) => {
          const active = loc.pathname === to
          return (
            <li key={to} className="flex justify-center">
              <button
                onClick={() => nav(to)}
                className={[
                  'flex flex-col items-center justify-center rounded-full px-3 py-1.5 text-[10px] leading-tight',
                  active ? 'text-orange-600' : 'text-slate-600',
                  emphasize ? 'shadow-sm bg-orange-50 text-orange-600' : '',
                ].join(' ')}
              >
                <Icon className={['h-5 w-5', active ? 'text-orange-600' : 'text-slate-600'].join(' ')} />
                <span className="mt-0.5">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
