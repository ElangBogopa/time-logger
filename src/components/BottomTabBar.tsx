'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, Calendar, BarChart3, Lightbulb, Settings } from 'lucide-react'

interface TabItem {
  label: string
  icon: React.ElementType
  path: string
  matchPaths?: string[]
  matchPrefix?: string[]
}

const tabs: TabItem[] = [
  {
    label: 'Today',
    icon: Home,
    path: '/',
    matchPaths: ['/'],
    matchPrefix: ['/log'],
  },
  {
    label: 'Calendar',
    icon: Calendar,
    path: '/calendar',
    matchPaths: ['/calendar'],
  },
  {
    label: 'Insights',
    icon: Lightbulb,
    path: '/insights',
    matchPaths: ['/insights'],
  },
  {
    label: 'Review',
    icon: BarChart3,
    path: '/weekly-review',
    matchPaths: ['/weekly-review'],
  },
  {
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    matchPaths: ['/settings', '/settings/connections', '/intentions'],
  },
]

export default function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()

  // Don't show on login page
  if (pathname === '/login') {
    return null
  }

  const isActive = (tab: TabItem): boolean => {
    // Check exact path matches
    if (tab.matchPaths && tab.matchPaths.some(p => pathname === p)) {
      return true
    }
    // Check prefix matches (e.g., /log/morning matches /log)
    if (tab.matchPrefix && tab.matchPrefix.some(p => pathname.startsWith(p))) {
      return true
    }
    return pathname === tab.path
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm safe-area-pb">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-4">
        {tabs.map((tab) => {
          const active = isActive(tab)
          const Icon = tab.icon

          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => router.push(tab.path)}
              className={`
                flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors
                ${active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-[10px] ${active ? 'font-medium' : ''}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
