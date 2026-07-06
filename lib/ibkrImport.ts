import Papa from 'papaparse'
import { Position, Exit, PositionWithExits } from './types'

export type TradeSide = 'BUY' | 'SELL'

export interface AggregatedTrade {
  symbol: string
  side: TradeSide
  shares: number
  price: number
  fees: number
  datetime: string
  date: string
  ibOrderId: string
}

export interface ImportPreviewTrade extends AggregatedTrade {
  reason?: string
  matchedPositionId?: string
}

export interface ImportPreview {
  newTrades: ImportPreviewTrade[]
  duplicates: ImportPreviewTrade[]
  failed: { symbol?: string; side?: string; ibOrderId?: string; reason: string }[]
}

export interface ExistingImportData {
  positions: PositionWithExits[]
  positionIbOrderIds: Set<string>
  exitIbOrderIds: Set<string>
}

interface ParsedRow {
  symbol: string
  side: TradeSide
  shares: number
  price: number
  fees: number
  datetime: string
  ibOrderId: string
}

const TRADES_HEADER_MARKERS = ['TradeID', 'TradePrice', 'IBCommission'] as const

function isTradesHeaderRow(cells: string[]): boolean {
  return TRADES_HEADER_MARKERS.every((marker) => cells.includes(marker))
}

function isSectionHeaderRow(cells: string[]): boolean {
  return cells[0] === 'ClientAccountID' && cells.includes('TradeID')
}

function parseIbkrDateTime(raw: string): { datetime: string; date: string } | null {
  const match = raw.trim().match(/^(\d{4})(\d{2})(\d{2});(\d{2})(\d{2})(\d{2})$/)
  if (!match) return null

  const [, year, month, day, hour, minute, second] = match
  const date = `${year}-${month}-${day}`
  const datetime = `${date}T${hour}:${minute}:${second}`
  return { datetime, date }
}

function parseNumber(raw: string): number | null {
  const value = parseFloat(raw.replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

function getCell(row: string[], columnMap: Map<string, number>, name: string): string {
  const index = columnMap.get(name)
  if (index === undefined) return ''
  return (row[index] ?? '').trim()
}

function findTradesSection(rows: string[][]): { headerIndex: number; columnMap: Map<string, number> } | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!isTradesHeaderRow(row)) continue

    const columnMap = new Map<string, number>()
    row.forEach((cell, index) => {
      if (cell) columnMap.set(cell, index)
    })

    if (
      columnMap.has('Symbol') &&
      columnMap.has('Buy/Sell') &&
      columnMap.has('Quantity') &&
      columnMap.has('IBOrderID') &&
      columnMap.has('LevelOfDetail') &&
      columnMap.has('AssetClass') &&
      columnMap.has('DateTime')
    ) {
      return { headerIndex: i, columnMap }
    }
  }

  return null
}

function parseExecutionRows(
  rows: string[][],
  headerIndex: number,
  columnMap: Map<string, number>
): { parsed: ParsedRow[]; failed: ImportPreview['failed'] } {
  const parsed: ParsedRow[] = []
  const failed: ImportPreview['failed'] = []

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length === 0 || row.every((cell) => !cell.trim())) continue
    if (isSectionHeaderRow(row)) break

    const levelOfDetail = getCell(row, columnMap, 'LevelOfDetail')
    const assetClass = getCell(row, columnMap, 'AssetClass')
    if (levelOfDetail !== 'EXECUTION' || assetClass !== 'STK') continue

    const symbol = getCell(row, columnMap, 'Symbol')
    const sideRaw = getCell(row, columnMap, 'Buy/Sell').toUpperCase()
    const quantityRaw = getCell(row, columnMap, 'Quantity')
    const priceRaw = getCell(row, columnMap, 'TradePrice')
    const feesRaw = getCell(row, columnMap, 'IBCommission')
    const datetimeRaw = getCell(row, columnMap, 'DateTime')
    const ibOrderId = getCell(row, columnMap, 'IBOrderID')

    if (!symbol || !ibOrderId) {
      failed.push({
        symbol: symbol || undefined,
        side: sideRaw || undefined,
        ibOrderId: ibOrderId || undefined,
        reason: 'Missing symbol or IBOrderID',
      })
      continue
    }

    if (sideRaw !== 'BUY' && sideRaw !== 'SELL') {
      failed.push({ symbol, side: sideRaw, ibOrderId, reason: `Invalid side: ${sideRaw || '(empty)'}` })
      continue
    }

    const quantity = parseNumber(quantityRaw)
    const price = parseNumber(priceRaw)
    const fees = parseNumber(feesRaw)
    const parsedDateTime = parseIbkrDateTime(datetimeRaw)

    if (quantity === null || quantity === 0) {
      failed.push({ symbol, side: sideRaw, ibOrderId, reason: 'Invalid quantity' })
      continue
    }
    if (price === null || price <= 0) {
      failed.push({ symbol, side: sideRaw, ibOrderId, reason: 'Invalid trade price' })
      continue
    }
    if (fees === null) {
      failed.push({ symbol, side: sideRaw, ibOrderId, reason: 'Invalid commission' })
      continue
    }
    if (!parsedDateTime) {
      failed.push({ symbol, side: sideRaw, ibOrderId, reason: `Invalid DateTime: ${datetimeRaw}` })
      continue
    }

    parsed.push({
      symbol,
      side: sideRaw,
      shares: Math.abs(Math.round(quantity)),
      price,
      fees: Math.abs(fees),
      datetime: parsedDateTime.datetime,
      ibOrderId,
    })
  }

  return { parsed, failed }
}

export function aggregateByOrderId(rows: ParsedRow[]): AggregatedTrade[] {
  const groups = new Map<string, ParsedRow[]>()

  for (const row of rows) {
    const existing = groups.get(row.ibOrderId) ?? []
    existing.push(row)
    groups.set(row.ibOrderId, existing)
  }

  const aggregated: AggregatedTrade[] = []

  for (const [, fills] of groups) {
    const first = fills[0]
    let totalShares = 0
    let weightedPriceSum = 0
    let totalFees = 0
    let earliest = fills[0].datetime

    for (const fill of fills) {
      totalShares += fill.shares
      weightedPriceSum += fill.price * fill.shares
      totalFees += fill.fees
      if (fill.datetime < earliest) earliest = fill.datetime
    }

    aggregated.push({
      symbol: first.symbol,
      side: first.side,
      shares: totalShares,
      price: weightedPriceSum / totalShares,
      fees: totalFees,
      datetime: earliest,
      date: earliest.slice(0, 10),
      ibOrderId: first.ibOrderId,
    })
  }

  return aggregated.sort((a, b) => a.datetime.localeCompare(b.datetime))
}

export function parseIbkrFlexCsv(csvText: string): {
  trades: AggregatedTrade[]
  parseFailures: ImportPreview['failed']
} {
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    return {
      trades: [],
      parseFailures: parsed.errors.map((error) => ({
        reason: `CSV parse error on row ${error.row ?? '?'}: ${error.message}`,
      })),
    }
  }

  const rows = parsed.data
  const section = findTradesSection(rows)

  if (!section) {
    return {
      trades: [],
      parseFailures: [{ reason: 'Could not find trades section (header with TradeID, TradePrice, IBCommission)' }],
    }
  }

  const { parsed: executionRows, failed } = parseExecutionRows(
    rows,
    section.headerIndex,
    section.columnMap
  )

  return {
    trades: aggregateByOrderId(executionRows),
    parseFailures: failed,
  }
}

function sharesRemaining(position: PositionWithExits): number {
  const sold = position.exits.reduce((sum, exit) => sum + exit.shares_sold, 0)
  return position.total_shares - sold
}

function findOpenPositionForSell(
  symbol: string,
  shares: number,
  positions: PositionWithExits[]
): PositionWithExits | null {
  const open = positions
    .filter((p) => p.ticker === symbol && p.direction === 'long' && sharesRemaining(p) >= shares)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))

  return open[0] ?? null
}

function isManualBuyDuplicate(trade: AggregatedTrade, positions: PositionWithExits[]): boolean {
  return positions.some(
    (p) =>
      !p.ib_order_id &&
      p.ticker === trade.symbol &&
      p.direction === 'long' &&
      p.entry_date === trade.date &&
      p.total_shares === trade.shares
  )
}

function isManualSellDuplicate(trade: AggregatedTrade, positions: PositionWithExits[]): boolean {
  return positions.some((p) =>
    p.exits.some(
      (exit) =>
        !exit.ib_order_id &&
        p.ticker === trade.symbol &&
        exit.exit_date === trade.date &&
        exit.shares_sold === trade.shares
    )
  )
}

function clonePositions(positions: PositionWithExits[]): PositionWithExits[] {
  return positions.map((p) => ({
    ...p,
    exits: [...p.exits],
  }))
}

function addSimulatedBuy(positions: PositionWithExits[], trade: AggregatedTrade, positionId: string) {
  positions.push({
    id: positionId,
    ticker: trade.symbol,
    direction: 'long',
    entry_date: trade.date,
    entry_price: trade.price,
    total_shares: trade.shares,
    entry_fee: trade.fees,
    stop_price: trade.price,
    setup_type: 'Other',
    ncfd_reading: 50,
    last_cycle: null,
    bars_since_low: null,
    market_cycle: 'green',
    notes: `Imported from IBKR (Order ${trade.ibOrderId})`,
    chart_url: null,
    current_price: null,
    ib_order_id: trade.ibOrderId,
    created_at: new Date().toISOString(),
    exits: [],
  })
}

function addSimulatedSell(positions: PositionWithExits[], trade: AggregatedTrade, positionId: string) {
  const position = positions.find((p) => p.id === positionId)
  if (!position) return

  const exit: Exit = {
    id: `sim-exit-${trade.ibOrderId}`,
    position_id: positionId,
    exit_date: trade.date,
    exit_price: trade.price,
    shares_sold: trade.shares,
    exit_fee: trade.fees,
    notes: `Imported from IBKR (Order ${trade.ibOrderId})`,
    ib_order_id: trade.ibOrderId,
    created_at: new Date().toISOString(),
  }

  position.exits.push(exit)
}

export function classifyImportTrades(
  trades: AggregatedTrade[],
  existing: ExistingImportData
): ImportPreview {
  const newTrades: ImportPreviewTrade[] = []
  const duplicates: ImportPreviewTrade[] = []
  const failed: ImportPreview['failed'] = []

  const simulated = clonePositions(existing.positions)

  for (const trade of trades) {
    if (existing.positionIbOrderIds.has(trade.ibOrderId) || existing.exitIbOrderIds.has(trade.ibOrderId)) {
      duplicates.push({ ...trade, reason: 'IBOrderID already imported' })
      continue
    }

    if (trade.side === 'BUY' && isManualBuyDuplicate(trade, existing.positions)) {
      duplicates.push({ ...trade, reason: 'Matches existing manual entry (symbol, date, shares)' })
      continue
    }

    if (trade.side === 'SELL' && isManualSellDuplicate(trade, existing.positions)) {
      duplicates.push({ ...trade, reason: 'Matches existing manual exit (symbol, date, shares)' })
      continue
    }

    if (trade.side === 'SELL') {
      const match = findOpenPositionForSell(trade.symbol, trade.shares, simulated)
      if (!match) {
        failed.push({
          symbol: trade.symbol,
          side: trade.side,
          ibOrderId: trade.ibOrderId,
          reason: `No open position with ${trade.shares} shares for ${trade.symbol}`,
        })
        continue
      }

      newTrades.push({ ...trade, matchedPositionId: match.id })
      addSimulatedSell(simulated, trade, match.id)
      continue
    }

    newTrades.push({ ...trade })
    addSimulatedBuy(simulated, trade, `sim-${trade.ibOrderId}`)
  }

  return { newTrades, duplicates, failed }
}

export function buildImportPreview(
  csvText: string,
  existing: ExistingImportData
): ImportPreview & { totalParsed: number } {
  const { trades, parseFailures } = parseIbkrFlexCsv(csvText)
  const classified = classifyImportTrades(trades, existing)

  return {
    ...classified,
    failed: [...parseFailures, ...classified.failed],
    totalParsed: trades.length,
  }
}

export function buildPositionInsert(trade: AggregatedTrade) {
  return {
    ticker: trade.symbol,
    direction: 'long' as const,
    entry_date: trade.date,
    entry_price: Number(trade.price.toFixed(4)),
    total_shares: trade.shares,
    entry_fee: Number(trade.fees.toFixed(2)),
    stop_price: Number(trade.price.toFixed(4)),
    setup_type: 'Other',
    ncfd_reading: 50,
    market_cycle: 'green' as const,
    notes: `Imported from IBKR (Order ${trade.ibOrderId})`,
    ib_order_id: trade.ibOrderId,
  }
}

export function buildExitInsert(trade: AggregatedTrade, positionId: string) {
  return {
    position_id: positionId,
    exit_date: trade.date,
    exit_price: Number(trade.price.toFixed(4)),
    shares_sold: trade.shares,
    exit_fee: Number(trade.fees.toFixed(2)),
    notes: `Imported from IBKR (Order ${trade.ibOrderId})`,
    ib_order_id: trade.ibOrderId,
  }
}

export { findOpenPositionForSell, clonePositions, addSimulatedBuy, addSimulatedSell }
