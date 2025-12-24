'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Trade, SetupType } from '@/lib/types'
import SetupBadge from '@/components/SetupBadge'
import { formatCurrency, formatRMultiple, getColorClass, getBgColorClass } from '@/lib/calculations'

export default function TradeList() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [setupTypes, setSetupTypes] = useState<SetupType[]>([])
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([])
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [filters, setFilters] = useState({
    setup_type: 'all',
    edge_type: 'all',
    result: 'all', // win/loss/all
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [filters, trades])

  async function loadData() {
    const { data: tradesData } = await supabase
      .from('trades')
      .select('*')
      .order('exit_date', { ascending: false })

    const { data: setupTypesData } = await supabase
      .from('setup_types')
      .select('*')

    if (tradesData) setTrades(tradesData)
    if (setupTypesData) setSetupTypes(setupTypesData)
  }

  function applyFilters() {
    let filtered = [...trades]

    if (filters.setup_type !== 'all') {
      filtered = filtered.filter((t) => t.setup_type === filters.setup_type)
    }

    if (filters.edge_type !== 'all') {
      filtered = filtered.filter((t) => t.edge_type === filters.edge_type)
    }

    if (filters.result === 'win') {
      filtered = filtered.filter((t) => t.net_pnl > 0)
    } else if (filters.result === 'loss') {
      filtered = filtered.filter((t) => t.net_pnl <= 0)
    }

    setFilteredTrades(filtered)
  }

  const getSetupColor = (setupName: string) => {
    const setup = setupTypes.find((st) => st.name === setupName)
    return setup?.color || '#6b7280'
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">Trade History</h2>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
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
            value={filters.edge_type}
            onChange={(e) => setFilters({ ...filters, edge_type: e.target.value })}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Edges</option>
            <option value="long_edge">Long Edge</option>
            <option value="short_edge">Short Edge</option>
            <option value="neutral">Neutral</option>
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
      </div>

      {filteredTrades.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-500">
          No trades found. Try adjusting your filters or add your first trade.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrades.map((trade) => (
            <div
              key={trade.id}
              onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
              className={`bg-gray-800 rounded-lg p-4 border border-gray-700 cursor-pointer transition-all hover:border-gray-600 ${
                selectedTrade?.id === trade.id ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg">{trade.ticker}</span>
                  <span className="text-xs px-2 py-1 rounded bg-gray-700 capitalize">
                    {trade.direction}
                  </span>
                  <SetupBadge name={trade.setup_type} color={getSetupColor(trade.setup_type)} />
                </div>
                <div className="text-right">
                  <div className={`font-bold ${getColorClass(trade.net_pnl)}`}>
                    {formatCurrency(trade.net_pnl)}
                  </div>
                  <div className={`text-sm ${getColorClass(trade.r_multiple)}`}>
                    {formatRMultiple(trade.r_multiple)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm text-gray-400">
                <div>Entry: ${trade.entry_price.toFixed(2)}</div>
                <div>Exit: ${trade.exit_price.toFixed(2)}</div>
                <div>Shares: {trade.shares}</div>
              </div>

              {selectedTrade?.id === trade.id && (
                <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Entry Date:</span>{' '}
                      <span className="text-gray-200">{trade.entry_date}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Exit Date:</span>{' '}
                      <span className="text-gray-200">{trade.exit_date}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Stop Price:</span>{' '}
                      <span className="text-gray-200">${trade.stop_price.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Risk:</span>{' '}
                      <span className="text-gray-200">${trade.total_risk.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Gross P&L:</span>{' '}
                      <span className={getColorClass(trade.gross_pnl)}>
                        {formatCurrency(trade.gross_pnl)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Fees:</span>{' '}
                      <span className="text-gray-200">${trade.total_fees.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">P&L %:</span>{' '}
                      <span className={getColorClass(trade.pnl_percent)}>
                        {trade.pnl_percent.toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">NCFD Reading:</span>{' '}
                      <span className="text-gray-200">{trade.ncfd_reading}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">FOMO Level:</span>{' '}
                      <span className="text-gray-200 capitalize">{trade.fomo_level}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Edge Type:</span>{' '}
                      <span className="text-gray-200 capitalize">
                        {trade.edge_type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {trade.setup_notes && (
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Notes:</div>
                      <div className="bg-gray-900 rounded p-3 text-sm text-gray-300">
                        {trade.setup_notes}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 text-center text-sm text-gray-500">
        Showing {filteredTrades.length} of {trades.length} trades
      </div>
    </div>
  )
}
