'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TradeInput, SetupType } from '@/lib/types'
import { calculateTradeMetrics } from '@/lib/calculations'

export default function AddTrade() {
  const router = useRouter()
  const [setupTypes, setSetupTypes] = useState<SetupType[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<TradeInput>({
    ticker: '',
    direction: 'long',
    entry_date: '',
    exit_date: '',
    entry_price: 0,
    exit_price: 0,
    stop_price: 0,
    shares: 0,
    entry_fee: 0,
    exit_fee: 0,
    setup_type: 'Breakout',
    ncfd_reading: 50,
    fomo_level: 'neutral',
    edge_type: 'neutral',
    setup_notes: '',
  })

  useEffect(() => {
    loadSetupTypes()
  }, [])

  async function loadSetupTypes() {
    const { data } = await supabase.from('setup_types').select('*').order('name')
    if (data) {
      setSetupTypes(data)
      if (data.length > 0) {
        setFormData((prev) => ({ ...prev, setup_type: data[0].name }))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const calculatedTrade = calculateTradeMetrics(formData)

      const { error } = await supabase.from('trades').insert([calculatedTrade])

      if (error) throw error

      router.push('/trades')
    } catch (error) {
      console.error('Error adding trade:', error)
      alert('Failed to add trade. Please try again.')
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
      <h2 className="text-2xl font-bold mb-6">Add Trade</h2>

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
            <label className="block text-sm font-medium mb-2">Exit Date</label>
            <input
              type="date"
              name="exit_date"
              value={formData.exit_date}
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
            <label className="block text-sm font-medium mb-2">Exit Price</label>
            <input
              type="number"
              name="exit_price"
              value={formData.exit_price || ''}
              onChange={handleChange}
              required
              step="0.01"
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
            <label className="block text-sm font-medium mb-2">Shares</label>
            <input
              type="number"
              name="shares"
              value={formData.shares || ''}
              onChange={handleChange}
              required
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
            <label className="block text-sm font-medium mb-2">Exit Fee</label>
            <input
              type="number"
              name="exit_fee"
              value={formData.exit_fee || ''}
              onChange={handleChange}
              step="0.01"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium mb-2">FOMO Level</label>
            <select
              name="fomo_level"
              value={formData.fomo_level}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="neutral">Neutral</option>
              <option value="low">Low</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Edge Type</label>
            <select
              name="edge_type"
              value={formData.edge_type}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="neutral">Neutral</option>
              <option value="long_edge">Long Edge</option>
              <option value="short_edge">Short Edge</option>
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
          <label className="block text-sm font-medium mb-2">Setup Notes</label>
          <textarea
            name="setup_notes"
            value={formData.setup_notes || ''}
            onChange={handleChange}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add notes about this trade..."
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? 'Adding...' : 'Add Trade'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/trades')}
            className="px-6 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
