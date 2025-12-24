import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          year: number
          starting_capital: number
          created_at: string
        }
        Insert: {
          id?: string
          year: number
          starting_capital: number
          created_at?: string
        }
        Update: {
          id?: string
          year?: number
          starting_capital?: number
          created_at?: string
        }
      }
      positions: {
        Row: {
          id: string
          ticker: string
          direction: 'long' | 'short'
          entry_date: string
          entry_price: number
          total_shares: number
          entry_fee: number
          stop_price: number
          setup_type: string
          ncfd_reading: number
          market_cycle: 'green' | 'red'
          notes: string | null
          current_price: number | null
          created_at: string
        }
        Insert: {
          id?: string
          ticker: string
          direction: 'long' | 'short'
          entry_date: string
          entry_price: number
          total_shares: number
          entry_fee?: number
          stop_price: number
          setup_type: string
          ncfd_reading: number
          fomo_level: 'high' | 'low' | 'neutral'
          edge_type: 'long_edge' | 'short_edge' | 'neutral'
          notes?: string | null
          current_price?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          ticker?: string
          direction?: 'long' | 'short'
          entry_date?: string
          entry_price?: number
          total_shares?: number
          entry_fee?: number
          stop_price?: number
          setup_type?: string
          ncfd_reading?: number
          fomo_level?: 'high' | 'low' | 'neutral'
          edge_type?: 'long_edge' | 'short_edge' | 'neutral'
          notes?: string | null
          current_price?: number | null
          created_at?: string
        }
      }
      exits: {
        Row: {
          id: string
          position_id: string
          exit_date: string
          exit_price: number
          shares_sold: number
          exit_fee: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          position_id: string
          exit_date: string
          exit_price: number
          shares_sold: number
          exit_fee?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          position_id?: string
          exit_date?: string
          exit_price?: number
          shares_sold?: number
          exit_fee?: number
          notes?: string | null
          created_at?: string
        }
      }
      setup_types: {
        Row: {
          id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          created_at?: string
        }
      }
    }
  }
}
