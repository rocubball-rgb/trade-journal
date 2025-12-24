export type Direction = 'long' | 'short'
export type MarketCycle = 'green' | 'red'

export interface Position {
  id: string
  ticker: string
  direction: Direction
  entry_date: string
  entry_price: number
  total_shares: number
  entry_fee: number
  stop_price: number
  setup_type: string
  ncfd_reading: number
  market_cycle: MarketCycle
  notes: string | null
  current_price: number | null
  created_at: string
}

export interface Exit {
  id: string
  position_id: string
  exit_date: string
  exit_price: number
  shares_sold: number
  exit_fee: number
  notes: string | null
  created_at: string
}

export interface PositionWithExits extends Position {
  exits: Exit[]
}

export interface Account {
  id: string
  year: number
  starting_capital: number
  created_at: string
}

export interface SetupType {
  id: string
  name: string
  color: string
  created_at: string
}

export interface PositionInput {
  ticker: string
  direction: Direction
  entry_date: string
  entry_price: number
  total_shares: number
  entry_fee: number
  stop_price: number
  setup_type: string
  ncfd_reading: number
  market_cycle: MarketCycle
  notes?: string | null
  current_price?: number | null
}

export interface ExitInput {
  position_id: string
  exit_date: string
  exit_price: number
  shares_sold: number
  exit_fee: number
  notes?: string | null
}

export interface PositionMetrics {
  shares_remaining: number
  shares_sold: number
  is_open: boolean
  realized_pnl: number
  unrealized_pnl: number
  total_pnl: number
  average_exit_price: number | null
  total_exit_fees: number
  risk_per_share: number
  total_risk: number
  r_multiple: number
  exit_count: number
  days_held: number
  last_exit_date: string | null
}
