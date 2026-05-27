'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import StatCard from '@/components/StatCard'
import SetupBadge from '@/components/SetupBadge'
import { formatCurrency, formatPercent, getColorClass, calculatePositionMetrics } from '@/lib/calculations'
import { SetupType, Account, PositionWithExits } from '@/lib/types'

function calculateYTDMetrics(positions: PositionWithExits[], startingCapital: number) {
  let totalNetPnL = 0
  let totalFees = 0
  let totalRealizedPnL = 0
  let totalUnrealizedPnL = 0
  let numClosedPositions = 0
  let numWinners = 0
  let totalR = 0

  positions.forEach((position) => {
    const metrics = calculatePositionMetrics(position, position.exits)
    totalNetPnL += metrics.total_pnl
    totalFees += position.entry_fee + metrics.total_exit_fees
    totalRealizedPnL += metrics.realized_pnl
    totalUnrealizedPnL += metrics.unrealized_pnl
    totalR += metrics.r_multiple

    if (!metrics.is_open) {
      numClosedPositions++
      if (metrics.total_pnl > 0) numWinners++
    }
  })

  const winRate = numClosedPositions > 0 ? (numWinners / numClosedPositions) * 100 : 0
  const avgR = positions.length > 0 ? totalR / positions.length : 0
  const ytdReturn = startingCapital > 0 ? (totalNetPnL / startingCapital) * 100 : 0

  const closedPositions = positions
    .filter((p) => {
      const metrics = calculatePositionMetrics(p, p.exits)
      return !metrics.is_open && metrics.last_exit_date
    })
    .sort((a, b) => {
      const aMetrics = calculatePositionMetrics(a, a.exits)
      const bMetrics = calculatePositionMetrics(b, b.exits)
      return (bMetrics.last_exit_date || '').localeCompare(aMetrics.last_exit_date || '')
    })

  let winStreak = 0
  let isWinStreak = true

  if (closedPositions.length > 0) {
    const firstMetrics = calculatePositionMetrics(closedPositions[0], closedPositions[0].exits)
    isWinStreak = firstMetrics.total_pnl > 0

    for (const position of closedPositions) {
      const metrics = calculatePositionMetrics(position, position.exits)
      const isWin = metrics.total_pnl > 0

      if (isWin === isWinStreak) {
        winStreak++
      } else {
        break
      }
    }
  }

  return {
    totalNetPnL,
    totalFees,
    totalRealizedPnL,
    totalUnrealizedPnL,
    winRate,
    avgR,
    ytdReturn,
    numPositions: positions.length,
    numClosedPositions,
    winStreak,
    isWinStreak,
  }
}

function calculateSetupPerformance(positions: PositionWithExits[], setupTypes: SetupType[]) {
  const setupMap = new Map<
    string,
    {
      positions: PositionWithExits[]
      color: string
    }
  >()

  setupTypes.forEach((st) => {
    setupMap.set(st.name, { positions: [], color: st.color })
  })

  positions.forEach((position) => {
    const setup = setupMap.get(position.setup_type)
    if (setup) {
      setup.positions.push(position)
    }
  })

  return Array.from(setupMap.entries())
    .map(([name, { positions: setupPositions, color }]) => {
      if (setupPositions.length === 0) return null

      let totalPnL = 0
      let totalR = 0
      let closedCount = 0
      let winners = 0

      setupPositions.forEach((position) => {
        const metrics = calculatePositionMetrics(position, position.exits)
        totalPnL += metrics.total_pnl
        totalR += metrics.r_multiple

        if (!metrics.is_open) {
          closedCount++
          if (metrics.total_pnl > 0) winners++
        }
      })

      const winRate = closedCount > 0 ? (winners / closedCount) * 100 : 0
      const avgR = setupPositions.length > 0 ? totalR / setupPositions.length : 0

      return {
        name,
        color,
        count: setupPositions.length,
        closedCount,
        winRate,
        totalPnL,
        avgR,
      }
    })
    .filter((analysis) => analysis !== null)
    .sort((a, b) => b!.totalPnL - a!.totalPnL)
}

export default function Dashboard() {
  const [account, setAccount] = useState<Account | null>(null)
  const [positions, setPositions] = useState<PositionWithExits[]>([])
  const [setupTypes, setSetupTypes] = useState<SetupType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({})
  const [sortBy, setSortBy] = useState<'default' | 'pnl-desc' | 'pnl-asc' | 'pct-desc' | 'pct-asc' | 'ticker'>('default')

  async function commitCurrentPrice(positionId: string) {
    const raw = editingPrices[positionId]
    if (raw === undefined) return

    setEditingPrices((prev) => {
      const next = { ...prev }
      delete next[positionId]
      return next
    })

    const newPrice = parseFloat(raw)
    if (isNaN(newPrice)) return

    // Optimistic local update
    setPositions((prev) =>
      prev.map((p) => (p.id === positionId ? { ...p, current_price: newPrice } : p))
    )

    const { error } = await supabase
      .from('positions')
      .update({ current_price: newPrice })
      .eq('id', positionId)

    if (error) {
      console.error('Error updating current price:', error)
      alert('Failed to update price.')
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    const currentYear = new Date().getFullYear()

    const { data: accountData } = await supabase
      .from('accounts')
      .select('*')
      .eq('year', currentYear)
      .single()

    const { data: positionsData } = await supabase
      .from('positions')
      .select('*')
      .order('entry_date', { ascending: false })

    const { data: exitsData } = await supabase
      .from('exits')
      .select('*')

    const { data: setupTypesData } = await supabase
      .from('setup_types')
      .select('*')

    const positionsWithExits: PositionWithExits[] = (positionsData || []).map((position) => ({
      ...position,
      exits: (exitsData || []).filter((exit) => exit.position_id === position.id),
    }))

    setAccount(accountData)
    setPositions(positionsWithExits)
    setSetupTypes(setupTypesData || [])
    setLoading(false)
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading...</div>
  }

  const startingCapital = account?.starting_capital || 0
  const metrics = calculateYTDMetrics(positions, startingCapital)
  const setupPerformance = calculateSetupPerformance(positions, setupTypes)

  const openPositions = positions.filter((p) => {
    const m = calculatePositionMetrics(p, p.exits)
    return m.is_open
  })

  const sortedOpenPositions = [...openPositions].sort((a, b) => {
    const ma = calculatePositionMetrics(a, a.exits)
    const mb = calculatePositionMetrics(b, b.exits)
    const pctA = a.current_price && a.entry_price
      ? ((a.current_price - a.entry_price) / a.entry_price) * 100 * (a.direction === 'long' ? 1 : -1)
      : 0
    const pctB = b.current_price && b.entry_price
      ? ((b.current_price - b.entry_price) / b.entry_price) * 100 * (b.direction === 'long' ? 1 : -1)
      : 0

    switch (sortBy) {
      case 'pnl-desc': return mb.unrealized_pnl - ma.unrealized_pnl
      case 'pnl-asc': return ma.unrealized_pnl - mb.unrealized_pnl
      case 'pct-desc': return pctB - pctA
      case 'pct-asc': return pctA - pctB
      case 'ticker': return a.ticker.localeCompare(b.ticker)
      default: return 0
    }
  })

  const getSetupColor = (setupName: string) => {
    const setup = setupTypes.find((st) => st.name === setupName)
    return setup?.color || '#6b7280'
  }

  const portfolioHeat = openPositions.reduce((total, position) => {
    const m = calculatePositionMetrics(position, position.exits)
    const riskPerShare = Math.abs(position.entry_price - position.stop_price)
    return total + riskPerShare * m.shares_remaining
  }, 0)

  const portfolioHeatPercent = startingCapital > 0 ? (portfolioHeat / startingCapital) * 100 : 0

  const getPortfolioHeatColor = () => {
    if (portfolioHeatPercent < 3) return 'text-green-500'
    if (portfolioHeatPercent <= 6) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">YTD Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Capital"
            value={`$${startingCapital.toLocaleString()}`}
            valueColor="text-gray-300"
          />
          <StatCard
            label="Current Equity"
            value={`$${(startingCapital + metrics.totalNetPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            valueColor={getColorClass(metrics.totalNetPnL)}
          />
          <StatCard
            label="YTD Return"
            value={formatPercent(metrics.ytdReturn)}
            valueColor={getColorClass(metrics.ytdReturn)}
          />
          <StatCard
            label="Net P&L"
            value={formatCurrency(metrics.totalNetPnL)}
            valueColor={getColorClass(metrics.totalNetPnL)}
          />
          <StatCard
            label="Realized P&L"
            value={formatCurrency(metrics.totalRealizedPnL)}
            valueColor={getColorClass(metrics.totalRealizedPnL)}
          />
          <StatCard
            label="Unrealized P&L"
            value={formatCurrency(metrics.totalUnrealizedPnL)}
            valueColor={getColorClass(metrics.totalUnrealizedPnL)}
          />
          <StatCard
            label="Portfolio Heat"
            value={formatCurrency(portfolioHeat)}
            valueColor={getPortfolioHeatColor()}
            subValue={`${portfolioHeatPercent.toFixed(2)}% at risk`}
          />
          <StatCard
            label="Total Fees"
            value={`$${metrics.totalFees.toFixed(2)}`}
            valueColor="text-gray-400"
          />
          <StatCard
            label="Win Rate"
            value={`${metrics.winRate.toFixed(1)}%`}
            valueColor={metrics.winRate >= 50 ? 'text-green-500' : 'text-red-500'}
            subValue={`${metrics.numClosedPositions} closed`}
          />
          <StatCard
            label="Total Positions"
            value={metrics.numPositions}
            valueColor="text-gray-400"
            subValue={`${openPositions.length} open`}
          />
          <StatCard
            label="Average R"
            value={`${metrics.avgR.toFixed(2)}R`}
            valueColor={getColorClass(metrics.avgR)}
          />
          <StatCard
            label="Win Streak"
            value={metrics.winStreak > 0 ? `${metrics.winStreak}${metrics.isWinStreak ? 'W' : 'L'}` : '-'}
            valueColor={metrics.winStreak > 0 ? (metrics.isWinStreak ? 'text-green-500' : 'text-red-500') : 'text-gray-400'}
            subValue={metrics.winStreak > 0 ? (metrics.isWinStreak ? 'win streak' : 'loss streak') : 'no streak'}
          />
        </div>
      </div>

      {/* Open Positions */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-xl font-bold">Open Positions ({openPositions.length})</h2>
          <div className="flex items-center gap-3">
            {openPositions.length > 1 && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="default">Most Recent</option>
                <option value="pnl-desc">P&L: High → Low</option>
                <option value="pnl-asc">P&L: Low → High</option>
                <option value="pct-desc">% Change: High → Low</option>
                <option value="pct-asc">% Change: Low → High</option>
                <option value="ticker">Ticker A → Z</option>
              </select>
            )}
            <Link
              href="/add-position"
              className="text-blue-500 hover:text-blue-400 text-sm"
            >
              + Add Position
            </Link>
          </div>
        </div>

        {openPositions.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-500">
            No open positions.
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Ticker</th>
                    <th className="text-left px-3 py-2 font-medium">Setup</th>
                    <th className="text-right px-3 py-2 font-medium">Shares</th>
                    <th className="text-right px-3 py-2 font-medium">Entry</th>
                    <th className="text-right px-3 py-2 font-medium">Stop</th>
                    <th className="text-right px-3 py-2 font-medium">Current</th>
                    <th className="text-right px-3 py-2 font-medium">P&L</th>
                    <th className="text-right px-3 py-2 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOpenPositions.map((position) => {
                    const m = calculatePositionMetrics(position, position.exits)
                    const pctChange = position.current_price && position.entry_price
                      ? ((position.current_price - position.entry_price) / position.entry_price) * 100 * (position.direction === 'long' ? 1 : -1)
                      : null
                    return (
                      <tr
                        key={position.id}
                        onClick={() => window.location.assign(`/positions/${position.id}`)}
                        className="border-t border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{position.ticker}</span>
                            <span className="text-xs text-gray-500 uppercase">{position.direction === 'long' ? 'L' : 'S'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <SetupBadge name={position.setup_type} color={getSetupColor(position.setup_type)} />
                        </td>
                        <td className="px-3 py-2 text-right text-gray-300">
                          {m.shares_remaining}
                          {m.shares_sold > 0 && <span className="text-gray-500"> / {position.total_shares}</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-300">${position.entry_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">${position.stop_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={editingPrices[position.id] !== undefined
                              ? editingPrices[position.id]
                              : (position.current_price ?? '')}
                            onChange={(e) =>
                              setEditingPrices((prev) => ({ ...prev, [position.id]: e.target.value }))
                            }
                            onBlur={() => commitCurrentPrice(position.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="—"
                            className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-right text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${getColorClass(m.unrealized_pnl)}`}>
                          {formatCurrency(m.unrealized_pnl)}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${getColorClass(pctChange || 0)}`}>
                          {pctChange !== null ? `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile compact list */}
            <div className="md:hidden divide-y divide-gray-700/50">
              {sortedOpenPositions.map((position) => {
                const m = calculatePositionMetrics(position, position.exits)
                const pctChange = position.current_price && position.entry_price
                  ? ((position.current_price - position.entry_price) / position.entry_price) * 100 * (position.direction === 'long' ? 1 : -1)
                  : null
                return (
                  <div
                    key={position.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-700/30 gap-2"
                  >
                    <Link href={`/positions/${position.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{position.ticker}</span>
                        <span className="text-xs text-gray-500 uppercase">{position.direction === 'long' ? 'L' : 'S'}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {m.shares_remaining}sh · entry ${position.entry_price.toFixed(2)}
                      </div>
                    </Link>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={editingPrices[position.id] !== undefined
                          ? editingPrices[position.id]
                          : (position.current_price ?? '')}
                        onChange={(e) =>
                          setEditingPrices((prev) => ({ ...prev, [position.id]: e.target.value }))
                        }
                        onBlur={() => commitCurrentPrice(position.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                        placeholder="price"
                        className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-right text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="text-right min-w-[70px]">
                        <div className={`font-semibold text-sm ${getColorClass(m.unrealized_pnl)}`}>
                          {formatCurrency(m.unrealized_pnl)}
                        </div>
                        <div className={`text-xs ${getColorClass(pctChange || 0)}`}>
                          {pctChange !== null ? `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Performance by Setup */}
      <div>
        <h2 className="text-xl font-bold mb-4">Performance by Setup</h2>
        {setupPerformance.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-500">
            No positions yet. Add your first position to see setup performance.
          </div>
        ) : (
          <div className="space-y-3">
            {setupPerformance.map((setup) => (
              <div
                key={setup!.name}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <SetupBadge name={setup!.name} color={setup!.color} />
                  <span className="text-sm text-gray-400">
                    {setup!.count} total ({setup!.closedCount} closed)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Win Rate</div>
                    <div className={getColorClass(setup!.winRate - 50)}>
                      {setup!.winRate.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Total P&L</div>
                    <div className={getColorClass(setup!.totalPnL)}>
                      {formatCurrency(setup!.totalPnL)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Avg R</div>
                    <div className={getColorClass(setup!.avgR)}>
                      {setup!.avgR.toFixed(2)}R
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
