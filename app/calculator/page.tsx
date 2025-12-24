'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function Calculator() {
  const [entryPrice, setEntryPrice] = useState<number>(0)
  const [stopPrice, setStopPrice] = useState<number>(0)
  const [riskPercent, setRiskPercent] = useState<number>(1)
  const [totalCapital, setTotalCapital] = useState<number>(0)

  useEffect(() => {
    loadCapital()
  }, [])

  async function loadCapital() {
    const currentYear = new Date().getFullYear()
    const { data: account } = await supabase
      .from('accounts')
      .select('starting_capital')
      .eq('year', currentYear)
      .single()

    if (account) {
      setTotalCapital(account.starting_capital)
    }
  }

  // Calculate values
  const riskAmount = totalCapital * (riskPercent / 100)
  const riskPerShare = Math.abs(entryPrice - stopPrice)
  const sharesToBuy = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0
  const totalPositionSize = sharesToBuy * entryPrice
  const positionPercent = totalCapital > 0 ? (totalPositionSize / totalCapital) * 100 : 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Position Size Calculator</h2>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Input Parameters</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Entry Price</label>
            <input
              type="number"
              step="0.01"
              value={entryPrice || ''}
              onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Stop Price</label>
            <input
              type="number"
              step="0.01"
              value={stopPrice || ''}
              onChange={(e) => setStopPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Risk % of Capital</label>
            <select
              value={riskPercent}
              onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="0.3">0.3%</option>
              <option value="0.25">0.25%</option>
              <option value="0.5">0.5%</option>
              <option value="0.75">0.75%</option>
              <option value="1">1%</option>
              <option value="1.5">1.5%</option>
              <option value="2">2%</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Calculated Results</h3>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Total Capital</span>
            <span className="text-xl font-semibold">${totalCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Risk Amount ({riskPercent}%)</span>
            <span className="text-xl font-semibold text-red-500">${riskAmount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Risk Per Share</span>
            <span className="text-xl font-semibold">${riskPerShare.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Shares to Buy</span>
            <span className="text-2xl font-bold text-blue-500">{sharesToBuy.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-400">Total Position Size</span>
            <span className="text-xl font-semibold">${totalPositionSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-gray-400">Position % of Portfolio</span>
            <span className="text-xl font-semibold">{positionPercent.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {entryPrice > 0 && stopPrice > 0 && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <div className="text-sm text-blue-300">
            <p className="mb-2">
              <strong>Summary:</strong> Buy {sharesToBuy} shares at ${entryPrice.toFixed(2)} with stop at ${stopPrice.toFixed(2)}
            </p>
            <p>
              If stopped out, you will lose ${riskAmount.toFixed(2)} ({riskPercent}% of capital)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
