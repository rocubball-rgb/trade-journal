'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PositionWithExits } from '@/lib/types'
import {
  buildImportPreview,
  buildPositionInsert,
  buildExitInsert,
  clonePositions,
  findOpenPositionForSell,
  addSimulatedBuy,
  addSimulatedSell,
  ExistingImportData,
  ImportPreview,
  ImportPreviewTrade,
} from '@/lib/ibkrImport'

function TradeTable({
  trades,
  showReason = false,
}: {
  trades: ImportPreviewTrade[]
  showReason?: boolean
}) {
  if (trades.length === 0) {
    return <p className="text-gray-500 text-sm py-2">None</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="text-left p-2">Symbol</th>
            <th className="text-left p-2">Side</th>
            <th className="text-left p-2">Date</th>
            <th className="text-right p-2">Shares</th>
            <th className="text-right p-2">Price</th>
            <th className="text-right p-2">Fees</th>
            <th className="text-left p-2">IBOrderID</th>
            {showReason && <th className="text-left p-2">Reason</th>}
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.ibOrderId} className="border-b border-gray-800">
              <td className="p-2 font-medium">{trade.symbol}</td>
              <td className="p-2">
                <span className={trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>
                  {trade.side}
                </span>
              </td>
              <td className="p-2">{trade.date}</td>
              <td className="p-2 text-right">{trade.shares}</td>
              <td className="p-2 text-right">${trade.price.toFixed(2)}</td>
              <td className="p-2 text-right">${trade.fees.toFixed(2)}</td>
              <td className="p-2 text-gray-400 font-mono text-xs">{trade.ibOrderId}</td>
              {showReason && <td className="p-2 text-gray-400">{trade.reason}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

async function loadExistingImportData(): Promise<ExistingImportData> {
  const { data: positionsData } = await supabase.from('positions').select('*')
  const { data: exitsData } = await supabase.from('exits').select('*')

  const positions: PositionWithExits[] = (positionsData ?? []).map((position) => ({
    ...position,
    ib_order_id: position.ib_order_id ?? null,
    exits: (exitsData ?? []).filter((exit) => exit.position_id === position.id).map((exit) => ({
      ...exit,
      ib_order_id: exit.ib_order_id ?? null,
    })),
  }))

  const positionIbOrderIds = new Set<string>()
  const exitIbOrderIds = new Set<string>()

  for (const position of positions) {
    if (position.ib_order_id) positionIbOrderIds.add(position.ib_order_id)
    for (const exit of position.exits) {
      if (exit.ib_order_id) exitIbOrderIds.add(exit.ib_order_id)
    }
  }

  return { positions, positionIbOrderIds, exitIbOrderIds }
}

export default function ImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<(ImportPreview & { totalParsed: number }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [existingData, setExistingData] = useState<ExistingImportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ positions: number; exits: number } | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setSuccess(null)
    setLoading(true)
    setFileName(file.name)

    try {
      const csvText = await file.text()
      const existing = await loadExistingImportData()
      setExistingData(existing)
      const result = buildImportPreview(csvText, existing)
      setPreview(result)
    } catch (err) {
      console.error(err)
      setError('Failed to parse CSV file.')
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!preview || !existingData || preview.newTrades.length === 0) return

    setConfirming(true)
    setError(null)

    try {
      const simulated = clonePositions(existingData.positions)
      let positionsInserted = 0
      let exitsInserted = 0

      for (const trade of preview.newTrades) {
        if (trade.side === 'BUY') {
          const { data, error: insertError } = await supabase
            .from('positions')
            .insert([buildPositionInsert(trade)])
            .select('id')
            .single()

          if (insertError) throw insertError
          addSimulatedBuy(simulated, trade, data.id)
          positionsInserted++
          continue
        }

        const match = findOpenPositionForSell(trade.symbol, trade.shares, simulated)
        if (!match) {
          throw new Error(`No open position for sell ${trade.symbol} (${trade.shares} shares)`)
        }

        const { error: insertError } = await supabase
          .from('exits')
          .insert([buildExitInsert(trade, match.id)])

        if (insertError) throw insertError
        addSimulatedSell(simulated, trade, match.id)
        exitsInserted++
      }

      setSuccess({ positions: positionsInserted, exits: exitsInserted })
      setPreview(null)
      setFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Import failed. Some rows may have been saved.')
    } finally {
      setConfirming(false)
    }
  }

  function handleReset() {
    setPreview(null)
    setFileName(null)
    setError(null)
    setSuccess(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Import CSV</h2>
          <p className="text-gray-400 text-sm mt-1">
            IBKR Flex Query export — stock executions only
          </p>
        </div>
        <Link
          href="/positions"
          className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
        >
          ← Back to Positions
        </Link>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || confirming}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
        >
          {loading ? 'Parsing...' : 'Choose CSV File'}
        </button>
        {fileName && <span className="ml-4 text-gray-400 text-sm">{fileName}</span>}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-green-300">
          <p className="font-medium">Import complete!</p>
          <p className="text-sm mt-1">
            {success.positions} position{success.positions !== 1 ? 's' : ''} and{' '}
            {success.exits} exit{success.exits !== 1 ? 's' : ''} imported.
          </p>
          <button
            onClick={() => router.push('/positions')}
            className="mt-3 text-sm bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded transition-colors"
          >
            View Positions
          </button>
        </div>
      )}

      {preview && (
        <>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-sm text-gray-300">
            Parsed <strong>{preview.totalParsed}</strong> aggregated order
            {preview.totalParsed !== 1 ? 's' : ''} from file
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-green-800/50">
            <h3 className="text-lg font-semibold text-green-400 mb-4">
              New trades to import ({preview.newTrades.length})
            </h3>
            <TradeTable trades={preview.newTrades} />
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-yellow-800/50">
            <h3 className="text-lg font-semibold text-yellow-400 mb-4">
              Duplicates skipped ({preview.duplicates.length})
            </h3>
            <TradeTable trades={preview.duplicates} showReason />
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-red-800/50">
            <h3 className="text-lg font-semibold text-red-400 mb-4">
              Failed to parse ({preview.failed.length})
            </h3>
            {preview.failed.length === 0 ? (
              <p className="text-gray-500 text-sm">None</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {preview.failed.map((item, i) => (
                  <li key={i} className="text-gray-300 border-b border-gray-700 pb-2">
                    {item.symbol && (
                      <span className="font-medium">{item.symbol} </span>
                    )}
                    {item.side && <span className="text-gray-400">{item.side} </span>}
                    {item.ibOrderId && (
                      <span className="text-gray-500 font-mono text-xs">({item.ibOrderId}) </span>
                    )}
                    — {item.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={confirming || preview.newTrades.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-2 rounded transition-colors"
            >
              {confirming
                ? 'Importing...'
                : `Confirm Import (${preview.newTrades.length})`}
            </button>
            <button
              onClick={handleReset}
              disabled={confirming}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
