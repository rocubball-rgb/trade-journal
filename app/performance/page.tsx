'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PositionWithExits } from '@/lib/types'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

type ChartMode = 'percent' | 'r-multiple'
type TimePeriod = 'mtd' | 'qtd' | 'ytd' | '1y' | 'all'

interface ChartDataPoint {
  date: string
  value: number
  cumulativePnL: number
  cumulativeR: number
}

interface MonthlyData {
  month: string
  monthIndex: number
  trades: number
  netPnL: number
  returnPct: number
}

export default function Performance() {
  const [positions, setPositions] = useState<PositionWithExits[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [mode, setMode] = useState<ChartMode>('percent')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ytd')
  const [startingCapital, setStartingCapital] = useState<number>(0)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (positions.length > 0) {
      generateChartData()
    }
  }, [positions, startingCapital, timePeriod])

  async function loadData() {
    const currentYear = new Date().getFullYear()

    // Get starting capital
    const { data: account } = await supabase
      .from('accounts')
      .select('starting_capital')
      .eq('year', currentYear)
      .single()

    if (account) {
      setStartingCapital(account.starting_capital)
    }

    // Get all positions with exits
    const { data: positionsData } = await supabase
      .from('positions')
      .select(`
        *,
        exits (*)
      `)
      .order('entry_date', { ascending: true })

    if (positionsData) {
      const positionsWithExits: PositionWithExits[] = positionsData.map((position: any) => ({
        ...position,
        exits: position.exits || [],
      }))
      setPositions(positionsWithExits)
    }
  }

  function generateChartData() {
    // Determine date filter based on time period
    const now = new Date()
    let startDate: Date | null = null

    if (timePeriod === 'mtd') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1) // 1st of current month
    } else if (timePeriod === 'qtd') {
      // Quarter starts: Jan 1 (Q1), Apr 1 (Q2), Jul 1 (Q3), Oct 1 (Q4)
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
      startDate = new Date(now.getFullYear(), quarterStartMonth, 1)
    } else if (timePeriod === 'ytd') {
      startDate = new Date(now.getFullYear(), 0, 1) // Jan 1 of current year
    } else if (timePeriod === '1y') {
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) // 12 months ago
    }
    // 'all' means no start date filter

    // Create a timeline of all exit events
    const events: { date: string; pnl: number; r: number }[] = []

    positions.forEach((position) => {
      // Add each exit as an event
      position.exits.forEach((exit) => {
        // Filter by time period
        if (startDate) {
          const exitDate = new Date(exit.exit_date)
          if (exitDate < startDate) return
        }
        const proportionalFee = (exit.shares_sold / position.total_shares) * position.entry_fee
        let exitPnL: number

        if (position.direction === 'long') {
          exitPnL = (exit.exit_price - position.entry_price) * exit.shares_sold
        } else {
          exitPnL = (position.entry_price - exit.exit_price) * exit.shares_sold
        }

        exitPnL = exitPnL - exit.exit_fee - proportionalFee

        const riskPerShare = Math.abs(position.entry_price - position.stop_price)
        const totalRisk = riskPerShare * exit.shares_sold
        const rMultiple = totalRisk > 0 ? exitPnL / totalRisk : 0

        events.push({
          date: exit.exit_date,
          pnl: exitPnL,
          r: rMultiple,
        })
      })
    })

    // Sort by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate cumulative values
    let cumulativePnL = 0
    let cumulativeR = 0

    const data: ChartDataPoint[] = events.map((event) => {
      cumulativePnL += event.pnl
      cumulativeR += event.r

      const percentReturn = startingCapital > 0 ? (cumulativePnL / startingCapital) * 100 : 0

      return {
        date: event.date,
        value: mode === 'percent' ? percentReturn : cumulativeR,
        cumulativePnL,
        cumulativeR,
      }
    })

    setChartData(data)
  }

  // Generate monthly performance data
  function generateMonthlyData() {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Extract all years from exit dates
    const years = new Set<number>()
    positions.forEach((position) => {
      position.exits.forEach((exit) => {
        const year = new Date(exit.exit_date).getFullYear()
        years.add(year)
      })
    })

    const sortedYears = Array.from(years).sort((a, b) => b - a) // Descending
    setAvailableYears(sortedYears)

    // If selected year not in available years, default to current year or first available
    if (sortedYears.length > 0 && !sortedYears.includes(selectedYear)) {
      const currentYear = new Date().getFullYear()
      setSelectedYear(sortedYears.includes(currentYear) ? currentYear : sortedYears[0])
      return // Will re-run when selectedYear updates
    }

    // Initialize monthly data for all 12 months
    const monthly: MonthlyData[] = monthNames.map((month, index) => ({
      month,
      monthIndex: index,
      trades: 0,
      netPnL: 0,
      returnPct: 0,
    }))

    // Calculate P&L for each month in selected year
    positions.forEach((position) => {
      position.exits.forEach((exit) => {
        const exitDate = new Date(exit.exit_date)
        if (exitDate.getFullYear() !== selectedYear) return

        const monthIndex = exitDate.getMonth()
        const proportionalFee = (exit.shares_sold / position.total_shares) * position.entry_fee
        let exitPnL: number

        if (position.direction === 'long') {
          exitPnL = (exit.exit_price - position.entry_price) * exit.shares_sold
        } else {
          exitPnL = (position.entry_price - exit.exit_price) * exit.shares_sold
        }

        exitPnL = exitPnL - exit.exit_fee - proportionalFee

        monthly[monthIndex].trades += 1
        monthly[monthIndex].netPnL += exitPnL
      })
    })

    // Calculate return percentage for each month
    monthly.forEach((m) => {
      m.returnPct = startingCapital > 0 ? (m.netPnL / startingCapital) * 100 : 0
    })

    setMonthlyData(monthly)
  }

  useEffect(() => {
    if (positions.length > 0) {
      generateMonthlyData()
    }
  }, [positions, selectedYear, startingCapital])

  // Calculate compound return for the year
  const compoundReturn = monthlyData.reduce((acc, month) => {
    if (month.trades > 0) {
      return acc * (1 + month.returnPct / 100)
    }
    return acc
  }, 1) - 1

  useEffect(() => {
    if (chartData.length > 0) {
      // Recalculate values when mode changes
      const updatedData = chartData.map((point) => ({
        ...point,
        value: mode === 'percent'
          ? (startingCapital > 0 ? (point.cumulativePnL / startingCapital) * 100 : 0)
          : point.cumulativeR,
      }))
      setChartData(updatedData)
    }
  }, [mode])

  const currentValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0
  const currentPnL = chartData.length > 0 ? chartData[chartData.length - 1].cumulativePnL : 0
  const displayValue = mode === 'percent' && startingCapital === 0 ? currentPnL : currentValue
  const valueColor = displayValue >= 0 ? 'text-green-500' : 'text-red-500'
  const lineColor = displayValue >= 0 ? '#10b981' : '#ef4444'

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Performance Chart</h2>

        <div className="flex flex-wrap gap-2">
          {/* Time Period Toggles */}
          <div className="flex gap-1 bg-gray-900 p-1 rounded-lg">
            <button
              onClick={() => setTimePeriod('mtd')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                timePeriod === 'mtd'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              MTD
            </button>
            <button
              onClick={() => setTimePeriod('qtd')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                timePeriod === 'qtd'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              QTD
            </button>
            <button
              onClick={() => setTimePeriod('ytd')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                timePeriod === 'ytd'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              YTD
            </button>
            <button
              onClick={() => setTimePeriod('1y')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                timePeriod === '1y'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              1Y
            </button>
            <button
              onClick={() => setTimePeriod('all')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                timePeriod === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Value Type Toggles */}
          <div className="flex gap-1 bg-gray-900 p-1 rounded-lg">
            <button
              onClick={() => setMode('percent')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                mode === 'percent'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              % Return
            </button>
            <button
              onClick={() => setMode('r-multiple')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                mode === 'r-multiple'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              R Multiple
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="mb-4">
          <div className="text-sm text-gray-400">
            {mode === 'percent'
              ? (startingCapital > 0 ? 'Cumulative Return' : 'Total P&L (Set capital for %)')
              : 'Cumulative R Multiple'}
          </div>
          <div className={`text-3xl font-bold ${valueColor}`}>
            {mode === 'percent'
              ? (startingCapital > 0 ? `${currentValue.toFixed(2)}%` : `$${currentPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
              : `${currentValue.toFixed(2)}R`}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-gray-500 gap-2">
            <div>No closed positions in this time period.</div>
            <div className="text-sm">Try selecting a different time range, or use "All Time" to see all trades.</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getMonth() + 1}/${date.getDate()}`
                }}
              />
              <YAxis
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(value) =>
                  mode === 'percent' ? `${value.toFixed(0)}%` : `${value.toFixed(1)}R`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value: number) =>
                  mode === 'percent' ? `${value.toFixed(2)}%` : `${value.toFixed(2)}R`
                }
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={2}
                dot={{ fill: lineColor, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Starting Capital</div>
            <div className="text-xl font-semibold">
              ${startingCapital.toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Total P&L</div>
            <div className={`text-xl font-semibold ${chartData[chartData.length - 1].cumulativePnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${chartData[chartData.length - 1].cumulativePnL.toFixed(2)}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Return %</div>
            <div className={`text-xl font-semibold ${valueColor}`}>
              {startingCapital > 0
                ? `${((chartData[chartData.length - 1].cumulativePnL / startingCapital) * 100).toFixed(2)}%`
                : <span className="text-gray-500">Set capital in Settings</span>
              }
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Total R</div>
            <div className={`text-xl font-semibold ${chartData[chartData.length - 1].cumulativeR >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {chartData[chartData.length - 1].cumulativeR.toFixed(2)}R
            </div>
          </div>
        </div>
      )}

      {/* Monthly Performance Breakdown */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Monthly Performance Breakdown</h2>

          {/* Year Toggle */}
          {availableYears.length > 0 && (
            <div className="flex gap-1 bg-gray-900 p-1 rounded-lg">
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    selectedYear === year
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Compound Return Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">{selectedYear} Compound Return</div>
          <div className={`text-3xl font-bold ${compoundReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {startingCapital > 0 ? `${(compoundReturn * 100).toFixed(2)}%` : <span className="text-gray-500">Set capital in Settings</span>}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Calculated by compounding each month&apos;s return
          </div>
        </div>

        {/* Monthly Bar Chart */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Monthly Returns</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="month"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
              />
              <YAxis
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(value) => `${value.toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Return']}
              />
              <ReferenceLine y={0} stroke="#6b7280" />
              <Bar dataKey="returnPct" radius={[4, 4, 0, 0]}>
                {monthlyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.returnPct >= 0 ? '#10b981' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Month</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400"># Trades</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Net P&L ($)</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Return (%)</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((month) => (
                <tr key={month.month} className="border-t border-gray-700 hover:bg-gray-750">
                  <td className="px-4 py-3 font-medium">{month.month}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{month.trades}</td>
                  <td className={`px-4 py-3 text-right ${month.netPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${month.netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-right ${month.returnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {month.returnPct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
