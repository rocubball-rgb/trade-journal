'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PositionWithExits } from '@/lib/types'
import { calculatePositionMetrics } from '@/lib/calculations'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type ChartMode = 'percent' | 'r-multiple'

interface ChartDataPoint {
  date: string
  value: number
  cumulativePnL: number
  cumulativeR: number
}

export default function Performance() {
  const [positions, setPositions] = useState<PositionWithExits[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [mode, setMode] = useState<ChartMode>('percent')
  const [startingCapital, setStartingCapital] = useState<number>(0)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (positions.length > 0) {
      generateChartData()
    }
  }, [positions, startingCapital])

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
    // Create a timeline of all exit events
    const events: { date: string; pnl: number; r: number }[] = []

    positions.forEach((position) => {
      const metrics = calculatePositionMetrics(position, position.exits)

      // Add each exit as an event
      position.exits.forEach((exit) => {
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
  const valueColor = currentValue >= 0 ? 'text-green-500' : 'text-red-500'
  const lineColor = currentValue >= 0 ? '#10b981' : '#ef4444'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Performance Chart</h2>

        <div className="flex gap-2">
          <button
            onClick={() => setMode('percent')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'percent'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            % Return
          </button>
          <button
            onClick={() => setMode('r-multiple')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'r-multiple'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            R Multiple
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="mb-4">
          <div className="text-sm text-gray-400">
            {mode === 'percent' ? 'Cumulative Return' : 'Cumulative R Multiple'}
          </div>
          <div className={`text-3xl font-bold ${valueColor}`}>
            {mode === 'percent' ? `${currentValue.toFixed(2)}%` : `${currentValue.toFixed(2)}R`}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-96 flex items-center justify-center text-gray-500">
            No closed positions to display. Exit positions to see performance over time.
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
              {((chartData[chartData.length - 1].cumulativePnL / startingCapital) * 100).toFixed(2)}%
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
    </div>
  )
}
