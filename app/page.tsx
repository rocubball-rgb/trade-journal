import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import StatCard from '@/components/StatCard'
import SetupBadge from '@/components/SetupBadge'
import { formatCurrency, formatPercent, getColorClass, calculatePositionMetrics } from '@/lib/calculations'
import { Position, Exit, SetupType, Account, PositionWithExits } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getDashboardData() {
  const currentYear = new Date().getFullYear()

  // Get current year account
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('year', currentYear)
    .single()

  // Get all positions
  const { data: positionsData } = await supabase
    .from('positions')
    .select('*')
    .order('entry_date', { ascending: false })

  // Get all exits
  const { data: exitsData } = await supabase
    .from('exits')
    .select('*')

  // Get setup types
  const { data: setupTypes } = await supabase
    .from('setup_types')
    .select('*')

  // Combine positions with their exits
  const positionsWithExits: PositionWithExits[] = (positionsData || []).map((position) => ({
    ...position,
    exits: (exitsData || []).filter((exit) => exit.position_id === position.id),
  }))

  return { account, positions: positionsWithExits, setupTypes: setupTypes || [] }
}

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

  // Calculate win streak
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

export default async function Dashboard() {
  const { account, positions, setupTypes } = await getDashboardData()
  const startingCapital = account?.starting_capital || 0
  const metrics = calculateYTDMetrics(positions, startingCapital)
  const setupPerformance = calculateSetupPerformance(positions, setupTypes)

  // Split positions into open and closed
  const openPositions = positions.filter((p) => {
    const m = calculatePositionMetrics(p, p.exits)
    return m.is_open
  })

  const closedPositions = positions.filter((p) => {
    const m = calculatePositionMetrics(p, p.exits)
    return !m.is_open
  })

  const getSetupColor = (setupName: string) => {
    const setup = setupTypes.find((st) => st.name === setupName)
    return setup?.color || '#6b7280'
  }

  // Calculate Portfolio Heat (total risk exposure for open positions)
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Open Positions ({openPositions.length})</h2>
          <Link
            href="/add-position"
            className="text-blue-500 hover:text-blue-400 text-sm"
          >
            + Add Position
          </Link>
        </div>

        {openPositions.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-500">
            No open positions. All positions have been closed.
          </div>
        ) : (
          <div className="space-y-3">
            {openPositions.map((position) => {
              const metrics = calculatePositionMetrics(position, position.exits)
              return (
                <Link
                  key={position.id}
                  href={`/positions/${position.id}`}
                  className="block bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg">{position.ticker}</span>
                      <span className="text-xs px-2 py-1 rounded bg-gray-700 capitalize">
                        {position.direction}
                      </span>
                      <SetupBadge name={position.setup_type} color={getSetupColor(position.setup_type)} />
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getColorClass(metrics.unrealized_pnl)}`}>
                        {formatCurrency(metrics.unrealized_pnl)}
                      </div>
                      <div className="text-xs text-gray-400">unrealized</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm text-gray-400">
                    <div>Entry: ${position.entry_price.toFixed(2)}</div>
                    <div>
                      Shares: {metrics.shares_remaining}
                      {metrics.shares_sold > 0 && ` / ${position.total_shares}`}
                    </div>
                    <div>Current: ${position.current_price?.toFixed(2) || '-'}</div>
                  </div>
                  {metrics.realized_pnl !== 0 && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-400">Realized: </span>
                      <span className={getColorClass(metrics.realized_pnl)}>
                        {formatCurrency(metrics.realized_pnl)}
                      </span>
                    </div>
                  )}
                </Link>
              )
            })}
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
