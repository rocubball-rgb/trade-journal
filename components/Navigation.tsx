'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Add', href: '/add-position', icon: '➕' },
  { name: 'Calculator', href: '/calculator', icon: '🧮' },
  { name: 'Positions', href: '/positions', icon: '📋' },
  { name: 'Analysis', href: '/analysis', icon: '📈' },
  { name: 'Performance', href: '/performance', icon: '📉' },
  { name: 'Journal', href: '/journal', icon: '📝' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 md:static md:border-t-0 md:border-b md:mb-6 z-50">
      <div className="flex overflow-x-auto md:overflow-visible md:justify-center md:gap-4 max-w-7xl mx-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 py-3 px-3 md:px-4 flex-shrink-0 transition-colors ${
                isActive
                  ? 'text-blue-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className="text-xl md:text-base">{item.icon}</span>
              <span className="text-xs md:text-sm font-medium whitespace-nowrap">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
