'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Position, Exit, SetupType, PositionWithExits } from '@/lib/types'
import SetupBadge from '@/components/SetupBadge'
import { calculatePositionMetrics, formatCurrency, formatRMultiple, getColorClass } from '@/lib/calculations'

export default function PositionsList() {
  const router = useRouter()
  const [positions, setPositions] = useState<PositionWithExits[]>([])
  const [setupTypes, setSetupTypes] = useState<SetupType[]>([])
  const [filteredPositions, setFilteredPositions] = useState<PositionWithExits[]>([])
  const [filters, setFilters] = useState({
    setup_type: 'all',
    market_cycle: 'all',
    status: 'open', // all/open/closed
    result: 'all', // all/win/loss
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [filters, positions])

  async function loadData() {
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
    const { data: setupTypesData } = await supabase
      .from('setup_types')
      .select('*')

    if (positionsData && exitsData) {
      // Combine positions with their exits
      const positionsWithExits: PositionWithExits[] = positionsData.map((position) => ({
        ...position,
        exits: exitsData.filter((exit) => exit.position_id === position.id),
      }))

      setPositions(positionsWithExits)
    }

    if (setupTypesData) setSetupTypes(setupTypesData)
  }

  function applyFilters() {
    let filtered = [...positions]

    if (filters.setup_type !== 'all') {
      filtered = filtered.filter((p) => p.setup_type === filters.setup_type)
    }

    if (filters.market_cycle !== 'all') {
      filtered = filtered.filter((p) => p.market_cycle === filters.market_cycle)
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter((p) => {
        const metrics = calculatePositionMetrics(p, p.exits)
        return filters.status === 'open' ? metrics.is_open : !metrics.is_open
      })
    }

    if (filters.result !== 'all') {
      filtered = filtered.filter((p) => {
        const metrics = calculatePositionMetrics(p, p.exits)
        return filters.result === 'win' ? metrics.total_pnl > 0 : metrics.total_pnl <= 0
      })
    }

    setFilteredPositions(filtered)
  }

  const getSetupColor = (setupName: string) => {
    const setup = setupTypes.find((st) => st.name === setupName)
    return setup?.color || '#6b7280'
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">Positions</h2>

        <button
          onClick={() => router.push('/add-position')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
        >
          + Add Position
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Positions</option>
          <option value="open">Open Only</option>
          <option value="closed">Closed Only</option>
        </select>

        <select
          value={filters.setup_type}
          onChange={(e) => setFilters({ ...filters, setup_type: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Setups</option>
          {setupTypes.map((st) => (
            <option key={st.id} value={st.name}>
              {st.name}
            </option>
          ))}
        </select>

        <select
          value={filters.market_cycle}
          onChange={(e) => setFilters({ ...filters, market_cycle: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Market Cycles</option>
          <option value="green">Green (QQQ 10 EMA &gt; 20 EMA)</option>
          <option value="red">Red (QQQ 10 EMA &lt; 20 EMA)</option>
        </select>

        <select
          value={filters.result}
          onChange={(e) => setFilters({ ...filters, result: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Results</option>
          <option value="win">Winners</option>
          <option value="loss">Losers</option>
        </select>
      </div>

      {filteredPositions.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-500">
          No positions found. Try adjusting your filters or add your first position.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPositions.map((position) => {
            const metrics = calculatePositionMetrics(position, position.exits)
            return (
              <div
                key={position.id}
                onClick={() => router.push(`/positions/${position.id}`)}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700 cursor-pointer transition-all hover:border-gray-600"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">{position.ticker}</span>
                    <span className="text-xs px-2 py-1 rounded bg-gray-700 capitalize">
                      {position.direction}
                    </span>
                    <SetupBadge
                      name={position.setup_type}
                      color={getSetupColor(position.setup_type)}
                    />
                    {metrics.is_open && (
                      <span className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-500 border border-green-600">
                        Open
                      </span>
                    )}
                    {metrics.exit_count > 1 && (
                      <span className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-500">
                        {metrics.exit_count} exits
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${getColorClass(metrics.total_pnl)}`}>
                      {formatCurrency(metrics.total_pnl)}
                    </div>
                    <div className={`text-sm ${getColorClass(metrics.r_multiple)}`}>
                      {formatRMultiple(metrics.r_multiple)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Entry:</span>{' '}
                    <span className="text-gray-200">${position.entry_price.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Shares:</span>{' '}
                    <span className="text-gray-200">
                      {metrics.shares_remaining} / {position.total_shares}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Realized:</span>{' '}
                    <span className={getColorClass(metrics.realized_pnl)}>
                      {formatCurrency(metrics.realized_pnl)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Unrealized:</span>{' '}
                    <span className={getColorClass(metrics.unrealized_pnl)}>
                      {formatCurrency(metrics.unrealized_pnl)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Days:</span>{' '}
                    <span className="text-gray-200">{metrics.days_held}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  Entered {position.entry_date}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 text-center text-sm text-gray-500">
        Showing {filteredPositions.length} of {positions.length} positions
      </div>
    </div>
  )
}
