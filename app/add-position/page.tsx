'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSetupTypes } from '@/lib/setupTypes'
import { PositionInput, SetupType } from '@/lib/types'

interface SavedCalculation {
  id: string
  ticker: string
  entry_price: number
  stop_price: number
  risk_percent: number
  shares_to_buy: number
}

export default function AddPosition() {
  const router = useRouter()
  const [setupTypes, setSetupTypes] = useState<SetupType[]>([])
  const [savedCalcs, setSavedCalcs] = useState<SavedCalculation[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<PositionInput>({
    ticker: '',
    direction: 'long',
    entry_date: '',
    entry_price: 0,
    total_shares: 0,
    entry_fee: 0,
    stop_price: 0,
    setup_type: 'Breakout',
    ncfd_reading: 50,
    market_cycle: 'green',
    notes: '',
    chart_url: '',
    current_price: null,
  })

  useEffect(() => {
    loadSetupTypes()
    loadSavedCalcs()
  }, [])

  async function loadSetupTypes() {
    const data = await getSetupTypes()
    setSetupTypes(data)
    if (data.length > 0) {
      setFormData((prev) => ({ ...prev, setup_type: data[0].name }))
    }
  }

  async function loadSavedCalcs() {
    const { data } = await supabase
      .from('saved_calculations')
      .select('*')
      .order('ticker', { ascending: true })

    if (data) setSavedCalcs(data)
  }

  function applyWatchlistItem(calc: SavedCalculation) {
    setFormData((prev) => ({
      ...prev,
      ticker: calc.ticker,
      entry_price: calc.entry_price,
      stop_price: calc.stop_price,
      total_shares: calc.shares_to_buy,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from('positions').insert([formData])

      if (error) throw error

      router.push('/positions')
    } catch (error) {
      console.error('Error adding position:', error)
      alert('Failed to add position. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }))
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Add Position</h2>

      {savedCalcs.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Quick Fill from Watchlist</h3>
          <div className="flex flex-wrap gap-2">
            {savedCalcs.map((calc) => (
              <button
                key={calc.id}
                type="button"
                onClick={() => applyWatchlistItem(calc)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm transition-colors"
              >
                {calc.ticker} <span className="text-gray-400">@ ${calc.entry_price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Ticker</label>
            <input
              type="text"
              name="ticker"
              value={formData.ticker}
              onChange={handleChange}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="AAPL"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Direction</label>
            <select
              name="direction"
              value={formData.direction}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entry Date</label>
            <input
              type="date"
              name="entry_date"
              value={formData.entry_date}
              onChange={handleChange}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entry Price</label>
            <input
              type="number"
              name="entry_price"
              value={formData.entry_price || ''}
              onChange={handleChange}
              required
              step="0.01"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Total Shares</label>
            <input
              type="number"
              name="total_shares"
              value={formData.total_shares || ''}
              onChange={handleChange}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Stop Price</label>
            <input
              type="number"
              name="stop_price"
              value={formData.stop_price || ''}
              onChange={handleChange}
              required
              step="0.01"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entry Fee</label>
            <input
              type="number"
              name="entry_fee"
              value={formData.entry_fee || ''}
              onChange={handleChange}
              step="0.01"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Current Price (optional)</label>
            <input
              type="number"
              name="current_price"
              value={formData.current_price || ''}
              onChange={handleChange}
              step="0.01"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="For unrealized P&L"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Setup Type</label>
            <select
              name="setup_type"
              value={formData.setup_type}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {setupTypes.map((st) => (
                <option key={st.id} value={st.name}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Market Cycle</label>
            <select
              name="market_cycle"
              value={formData.market_cycle}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="green">Green (QQQ 10 EMA &gt; 20 EMA)</option>
              <option value="red">Red (QQQ 10 EMA &lt; 20 EMA)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            NCFD Reading: {formData.ncfd_reading}
          </label>
          <input
            type="range"
            name="ncfd_reading"
            value={formData.ncfd_reading}
            onChange={handleChange}
            min="0"
            max="100"
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">TradingView Chart URL (optional)</label>
          <input
            type="url"
            name="chart_url"
            value={formData.chart_url || ''}
            onChange={handleChange}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://www.tradingview.com/chart/..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Notes</label>
          <textarea
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add notes about this position..."
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? 'Adding...' : 'Add Position'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/positions')}
            className="px-6 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
