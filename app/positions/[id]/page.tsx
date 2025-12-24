'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Position, Exit, PositionWithExits } from '@/lib/types'
import { calculatePositionMetrics, calculateExitPnL, formatCurrency, formatRMultiple, getColorClass } from '@/lib/calculations'
import SetupBadge from '@/components/SetupBadge'

export default function PositionDetail() {
  const router = useRouter()
  const params = useParams()
  const positionId = params.id as string

  const [position, setPosition] = useState<Position | null>(null)
  const [exits, setExits] = useState<Exit[]>([])
  const [setupColor, setSetupColor] = useState('#6b7280')
  const [showAddExit, setShowAddExit] = useState(false)
  const [loading, setLoading] = useState(false)

  const [exitForm, setExitForm] = useState({
    exit_date: '',
    exit_price: 0,
    shares_sold: 0,
    exit_fee: 0,
    notes: '',
  })

  useEffect(() => {
    loadPosition()
  }, [positionId])

  async function loadPosition() {
    const { data: positionData } = await supabase
      .from('positions')
      .select('*')
      .eq('id', positionId)
      .single()

    const { data: exitsData } = await supabase
      .from('exits')
      .select('*')
      .eq('position_id', positionId)
      .order('exit_date', { ascending: false })

    if (positionData) {
      setPosition(positionData)

      // Get setup color
      const { data: setupData } = await supabase
        .from('setup_types')
        .select('color')
        .eq('name', positionData.setup_type)
        .single()

      if (setupData) setSetupColor(setupData.color)
    }

    if (exitsData) setExits(exitsData)
  }

  const handleAddExit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!position) return

    const metrics = calculatePositionMetrics(position, exits)

    if (exitForm.shares_sold > metrics.shares_remaining) {
      alert(`Cannot sell ${exitForm.shares_sold} shares. Only ${metrics.shares_remaining} remaining.`)
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.from('exits').insert([
        {
          position_id: positionId,
          ...exitForm,
        },
      ])

      if (error) throw error

      await loadPosition()
      setShowAddExit(false)
      setExitForm({
        exit_date: '',
        exit_price: 0,
        shares_sold: 0,
        exit_fee: 0,
        notes: '',
      })
    } catch (error) {
      console.error('Error adding exit:', error)
      alert('Failed to add exit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCurrentPrice = async (newPrice: number) => {
    try {
      const { error } = await supabase
        .from('positions')
        .update({ current_price: newPrice })
        .eq('id', positionId)

      if (error) throw error
      await loadPosition()
    } catch (error) {
      console.error('Error updating current price:', error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this position? This will also delete all associated exits.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('positions')
        .delete()
        .eq('id', positionId)

      if (error) throw error
      router.push('/positions')
    } catch (error) {
      console.error('Error deleting position:', error)
      alert('Failed to delete position. Please try again.')
    }
  }

  if (!position) {
    return <div className="text-center py-12">Loading...</div>
  }

  const metrics = calculatePositionMetrics(position, exits)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/positions')}
          className="text-gray-400 hover:text-gray-200"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <SetupBadge name={position.setup_type} color={setupColor} />
          <button
            onClick={() => router.push(`/positions/${positionId}/edit`)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Position Header */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">{position.ticker}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm px-2 py-1 rounded bg-gray-700 capitalize">
                {position.direction}
              </span>
              <span className="text-sm text-gray-400">
                Entered {position.entry_date} • {metrics.days_held} days
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getColorClass(metrics.total_pnl)}`}>
              {formatCurrency(metrics.total_pnl)}
            </div>
            <div className={`text-lg ${getColorClass(metrics.r_multiple)}`}>
              {formatRMultiple(metrics.r_multiple)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Entry Price</div>
            <div className="font-semibold">${position.entry_price.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">Stop Price</div>
            <div className="font-semibold">${position.stop_price.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">Total Shares</div>
            <div className="font-semibold">{position.total_shares}</div>
          </div>
          <div>
            <div className="text-gray-400">Entry Fee</div>
            <div className="font-semibold">${position.entry_fee.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Shares Remaining</div>
          <div className="text-2xl font-bold">{metrics.shares_remaining}</div>
          <div className="text-xs text-gray-500">of {position.total_shares}</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Realized P&L</div>
          <div className={`text-2xl font-bold ${getColorClass(metrics.realized_pnl)}`}>
            {formatCurrency(metrics.realized_pnl)}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Unrealized P&L</div>
          <div className={`text-2xl font-bold ${getColorClass(metrics.unrealized_pnl)}`}>
            {formatCurrency(metrics.unrealized_pnl)}
          </div>
        </div>

        {metrics.average_exit_price && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm">Avg Exit Price</div>
            <div className="text-2xl font-bold">${metrics.average_exit_price.toFixed(2)}</div>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Total Risk</div>
          <div className="text-2xl font-bold">${metrics.total_risk.toFixed(2)}</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Status</div>
          <div className="text-2xl font-bold">
            {metrics.is_open ? '🟢 Open' : '⚫ Closed'}
          </div>
        </div>
      </div>

      {/* Current Price */}
      {metrics.is_open && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <label className="block text-sm font-medium mb-2">
            Current Price (for unrealized P&L)
          </label>
          <input
            type="number"
            step="0.01"
            value={position.current_price || ''}
            onChange={(e) => handleUpdateCurrentPrice(parseFloat(e.target.value) || 0)}
            className="w-full md:w-64 bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter current price"
          />
        </div>
      )}

      {/* Exits List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Exits ({exits.length})</h2>
          {metrics.is_open && (
            <button
              onClick={() => setShowAddExit(!showAddExit)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              {showAddExit ? 'Cancel' : 'Sell Shares'}
            </button>
          )}
        </div>

        {showAddExit && (
          <form onSubmit={handleAddExit} className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-4">
            <h3 className="font-semibold mb-4">
              Selling shares (Max: {metrics.shares_remaining})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Exit Date</label>
                <input
                  type="date"
                  value={exitForm.exit_date}
                  onChange={(e) => setExitForm({ ...exitForm, exit_date: e.target.value })}
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Exit Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={exitForm.exit_price || ''}
                  onChange={(e) => setExitForm({ ...exitForm, exit_price: parseFloat(e.target.value) || 0 })}
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Shares Sold</label>
                <input
                  type="number"
                  value={exitForm.shares_sold || ''}
                  onChange={(e) => setExitForm({ ...exitForm, shares_sold: parseInt(e.target.value) || 0 })}
                  required
                  max={metrics.shares_remaining}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {exitForm.shares_sold > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {metrics.shares_remaining - exitForm.shares_sold} will remain
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Exit Fee</label>
                <input
                  type="number"
                  step="0.01"
                  value={exitForm.exit_fee || ''}
                  onChange={(e) => setExitForm({ ...exitForm, exit_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                value={exitForm.notes}
                onChange={(e) => setExitForm({ ...exitForm, notes: e.target.value })}
                rows={2}
                className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded transition-colors"
            >
              {loading ? 'Adding...' : 'Add Exit'}
            </button>
          </form>
        )}

        {exits.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-500">
            No exits yet. Position is fully open.
          </div>
        ) : (
          <div className="space-y-3">
            {exits.map((exit) => {
              const proportionalFee = (exit.shares_sold / position.total_shares) * position.entry_fee
              const exitPnL = calculateExitPnL(position, exit, proportionalFee)
              return (
                <div
                  key={exit.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-400">{exit.exit_date}</div>
                      <div className="font-semibold">{exit.shares_sold} shares @ ${exit.exit_price.toFixed(2)}</div>
                    </div>
                    <div className={`font-bold ${getColorClass(exitPnL)}`}>
                      {formatCurrency(exitPnL)}
                    </div>
                  </div>
                  {exit.notes && (
                    <div className="text-sm text-gray-400 mt-2">{exit.notes}</div>
                  )}
                  {exit.exit_fee > 0 && (
                    <div className="text-xs text-gray-500 mt-1">Fee: ${exit.exit_fee.toFixed(2)}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Notes */}
      {position.notes && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold mb-2">Position Notes</h3>
          <p className="text-gray-300">{position.notes}</p>
        </div>
      )}

      {/* Additional Details */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="font-semibold mb-3">Additional Details</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-400">NCFD Reading:</span>{' '}
            <span className="text-gray-200">{position.ncfd_reading}</span>
          </div>
          <div>
            <span className="text-gray-400">Market Cycle:</span>{' '}
            <span className="text-gray-200 capitalize">
              {position.market_cycle === 'green' ? '🟢 Green' : '🔴 Red'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Days Held:</span>{' '}
            <span className="text-gray-200">{metrics.days_held}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
