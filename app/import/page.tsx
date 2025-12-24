'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'
import { TradeInput, SetupType } from '@/lib/types'
import { calculateTradeMetrics, formatCurrency, getColorClass } from '@/lib/calculations'

interface ParsedIBKRTrade {
  ticker: string
  direction: 'long' | 'short'
  entry_date: string
  exit_date: string
  entry_price: number
  exit_price: number
  shares: number
  entry_fee: number
  exit_fee: number
  setup_type: string
  stop_price: number
}

export default function ImportTrades() {
  const router = useRouter()
  const [setupTypes, setSetupTypes] = useState<SetupType[]>([])
  const [parsedTrades, setParsedTrades] = useState<ParsedIBKRTrade[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSetupTypes()
  }, [])

  async function loadSetupTypes() {
    const { data } = await supabase.from('setup_types').select('*').order('name')
    if (data) setSetupTypes(data)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const trades = parseIBKRCSV(results.data as any[])
        setParsedTrades(trades)
      },
      error: (error) => {
        console.error('Error parsing CSV:', error)
        alert('Failed to parse CSV file. Please check the format.')
      },
    })
  }

  function parseIBKRCSV(data: any[]): ParsedIBKRTrade[] {
    // This is a simplified parser - adjust based on actual IBKR CSV format
    const trades: ParsedIBKRTrade[] = []
    const tradeMap = new Map<string, any[]>()

    // Group transactions by symbol
    data.forEach((row) => {
      if (!row.Symbol || !row.Quantity) return
      const symbol = row.Symbol.toString().trim()
      if (!tradeMap.has(symbol)) {
        tradeMap.set(symbol, [])
      }
      tradeMap.get(symbol)!.push(row)
    })

    // Process each symbol's transactions
    tradeMap.forEach((transactions, symbol) => {
      transactions.sort((a, b) =>
        new Date(a['Date/Time']).getTime() - new Date(b['Date/Time']).getTime()
      )

      for (let i = 0; i < transactions.length - 1; i += 2) {
        const entry = transactions[i]
        const exit = transactions[i + 1]

        if (!entry || !exit) continue

        const quantity = Math.abs(parseFloat(entry.Quantity))
        const isLong = parseFloat(entry.Quantity) > 0

        trades.push({
          ticker: symbol,
          direction: isLong ? 'long' : 'short',
          entry_date: formatDate(entry['Date/Time']),
          exit_date: formatDate(exit['Date/Time']),
          entry_price: Math.abs(parseFloat(entry.Price)),
          exit_price: Math.abs(parseFloat(exit.Price)),
          shares: quantity,
          entry_fee: Math.abs(parseFloat(entry.Comm) || 0),
          exit_fee: Math.abs(parseFloat(exit.Comm) || 0),
          setup_type: 'Other',
          stop_price: 0,
        })
      }
    })

    return trades
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
  }

  const updateTrade = (index: number, field: string, value: any) => {
    setParsedTrades((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSaveAll = async () => {
    if (parsedTrades.some((t) => t.stop_price === 0)) {
      alert('Please set stop price for all trades before saving.')
      return
    }

    setLoading(true)

    try {
      const tradesToInsert = parsedTrades.map((trade) => {
        const tradeInput: TradeInput = {
          ticker: trade.ticker,
          direction: trade.direction,
          entry_date: trade.entry_date,
          exit_date: trade.exit_date,
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          stop_price: trade.stop_price,
          shares: trade.shares,
          entry_fee: trade.entry_fee,
          exit_fee: trade.exit_fee,
          setup_type: trade.setup_type,
          ncfd_reading: 50,
          fomo_level: 'neutral',
          edge_type: 'neutral',
          setup_notes: null,
        }
        return calculateTradeMetrics(tradeInput)
      })

      const { error } = await supabase.from('trades').insert(tradesToInsert)

      if (error) throw error

      router.push('/trades')
    } catch (error) {
      console.error('Error importing trades:', error)
      alert('Failed to import trades. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const calculatePreviewPnL = (trade: ParsedIBKRTrade) => {
    if (trade.stop_price === 0) return 0

    const gross_pnl = trade.direction === 'long'
      ? (trade.exit_price - trade.entry_price) * trade.shares
      : (trade.entry_price - trade.exit_price) * trade.shares

    return gross_pnl - trade.entry_fee - trade.exit_fee
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Import Trades</h2>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
        <label className="block mb-4">
          <span className="text-sm font-medium mb-2 block">
            Upload IBKR CSV File
          </span>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          />
        </label>
        <p className="text-sm text-gray-400">
          Upload your Interactive Brokers CSV file to automatically parse your trades.
        </p>
      </div>

      {parsedTrades.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              Parsed Trades ({parsedTrades.length})
            </h3>
            <button
              onClick={handleSaveAll}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Save All'}
            </button>
          </div>

          <div className="space-y-3">
            {parsedTrades.map((trade, index) => {
              const previewPnL = calculatePreviewPnL(trade)
              return (
                <div
                  key={index}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                    <div>
                      <span className="text-gray-400">Ticker:</span>{' '}
                      <span className="font-semibold">{trade.ticker}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Direction:</span>{' '}
                      <span className="capitalize">{trade.direction}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Entry:</span> $
                      {trade.entry_price.toFixed(2)}
                    </div>
                    <div>
                      <span className="text-gray-400">Exit:</span> $
                      {trade.exit_price.toFixed(2)}
                    </div>
                    <div>
                      <span className="text-gray-400">Shares:</span> {trade.shares}
                    </div>
                    <div>
                      <span className="text-gray-400">Date:</span> {trade.exit_date}
                    </div>
                    <div>
                      <span className="text-gray-400">Fees:</span> $
                      {(trade.entry_fee + trade.exit_fee).toFixed(2)}
                    </div>
                    <div>
                      <span className="text-gray-400">P&L:</span>{' '}
                      <span className={getColorClass(previewPnL)}>
                        {formatCurrency(previewPnL)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Setup Type
                      </label>
                      <select
                        value={trade.setup_type}
                        onChange={(e) =>
                          updateTrade(index, 'setup_type', e.target.value)
                        }
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {setupTypes.map((st) => (
                          <option key={st.id} value={st.name}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Stop Price *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={trade.stop_price || ''}
                        onChange={(e) =>
                          updateTrade(
                            index,
                            'stop_price',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="Required"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {parsedTrades.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-500">
          Upload a CSV file to see parsed trades here
        </div>
      )}
    </div>
  )
}
