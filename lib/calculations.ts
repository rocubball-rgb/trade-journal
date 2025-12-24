import { Position, Exit, PositionMetrics, Direction } from './types'

/**
 * Calculate all metrics for a position with its exits
 */
export function calculatePositionMetrics(
  position: Position,
  exits: Exit[]
): PositionMetrics {
  // Calculate shares sold
  const shares_sold = exits.reduce((sum, exit) => sum + exit.shares_sold, 0)
  const shares_remaining = position.total_shares - shares_sold
  const is_open = shares_remaining > 0

  // Calculate total exit fees
  const total_exit_fees = exits.reduce((sum, exit) => sum + exit.exit_fee, 0)

  // Calculate days held
  const last_exit_date = exits.length > 0
    ? exits.reduce((latest, exit) =>
        exit.exit_date > latest ? exit.exit_date : latest
      , exits[0].exit_date)
    : null

  const entryDate = new Date(position.entry_date)
  const endDate = last_exit_date ? new Date(last_exit_date) : new Date()
  const days_held = Math.floor((endDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24))

  // Calculate realized P&L from all exits
  let realized_pnl = 0
  let weighted_exit_sum = 0

  exits.forEach((exit) => {
    let exit_gross_pnl: number
    if (position.direction === 'long') {
      exit_gross_pnl = (exit.exit_price - position.entry_price) * exit.shares_sold
    } else {
      exit_gross_pnl = (position.entry_price - exit.exit_price) * exit.shares_sold
    }
    realized_pnl += exit_gross_pnl - exit.exit_fee
    weighted_exit_sum += exit.exit_price * exit.shares_sold
  })

  // Subtract proportional entry fee from realized P&L
  const realized_entry_fee = shares_sold > 0
    ? (shares_sold / position.total_shares) * position.entry_fee
    : 0
  realized_pnl -= realized_entry_fee

  // Calculate average exit price
  const average_exit_price = shares_sold > 0 ? weighted_exit_sum / shares_sold : null

  // Calculate unrealized P&L
  let unrealized_pnl = 0
  if (shares_remaining > 0 && position.current_price !== null) {
    if (position.direction === 'long') {
      unrealized_pnl = (position.current_price - position.entry_price) * shares_remaining
    } else {
      unrealized_pnl = (position.entry_price - position.current_price) * shares_remaining
    }
    // Subtract remaining entry fee
    const unrealized_entry_fee = (shares_remaining / position.total_shares) * position.entry_fee
    unrealized_pnl -= unrealized_entry_fee
  }

  // Total P&L
  const total_pnl = realized_pnl + unrealized_pnl

  // Calculate risk per share
  const risk_per_share = Math.abs(position.entry_price - position.stop_price)

  // Calculate total risk (for original position)
  const total_risk = risk_per_share * position.total_shares

  // Calculate R-multiple based on total P&L
  const r_multiple = total_risk > 0 ? total_pnl / total_risk : 0

  return {
    shares_remaining,
    shares_sold,
    is_open,
    realized_pnl,
    unrealized_pnl,
    total_pnl,
    average_exit_price,
    total_exit_fees,
    risk_per_share,
    total_risk,
    r_multiple,
    exit_count: exits.length,
    days_held,
    last_exit_date,
  }
}

/**
 * Calculate P&L for a single exit
 */
export function calculateExitPnL(
  position: Position,
  exit: Exit,
  proportionalEntryFee: number
): number {
  let gross_pnl: number
  if (position.direction === 'long') {
    gross_pnl = (exit.exit_price - position.entry_price) * exit.shares_sold
  } else {
    gross_pnl = (position.entry_price - exit.exit_price) * exit.shares_sold
  }
  return gross_pnl - exit.exit_fee - proportionalEntryFee
}

export function formatCurrency(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}$${value.toFixed(2)}`
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatRMultiple(value: number): string {
  return `${value.toFixed(2)}R`
}

export function getColorClass(value: number): string {
  return value >= 0 ? 'text-green-500' : 'text-red-500'
}

export function getBgColorClass(value: number): string {
  return value >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
}
