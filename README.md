# Trade Journal App

A comprehensive trading journal built with Next.js 14 and Supabase for tracking stock positions, analyzing performance, and managing risk.

## Features

- **Position Management**: Track entries, exits, and partial position scaling
- **Position Size Calculator**: Calculate optimal share quantities based on risk percentage
- **Performance Chart**: Visualize cumulative returns over time (% or R-multiple)
- **Setup Analysis**: Analyze performance by trading setup type
- **Dashboard**: Real-time overview of open positions and YTD metrics
- **Risk Metrics**: Automatic calculation of R-multiples, win rate, and P&L

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd trade-journal-app
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables

Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up the database

Run the SQL schema in your Supabase SQL editor:
- Execute `supabase/schema.sql` to create tables
- If migrating from old schema, run `supabase/migration.sql`

5. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Database Schema

### Tables

- **positions**: Trading positions (entries)
- **exits**: Exit transactions (partial or full)
- **setup_types**: Trading setup configurations
- **accounts**: Annual capital tracking

### Key Features

- Positions support partial exits with automatic P&L calculation
- Realized vs unrealized P&L tracking
- R-multiple calculations based on initial risk
- Market cycle tracking (green/red based on QQQ EMAs)

## Usage

1. **Add Position**: Enter a new trade with entry price, stop, shares, and setup type
2. **Manage Exits**: Sell partial or full positions from the position detail page
3. **Calculate Position Size**: Use the calculator to determine optimal share quantity
4. **View Performance**: Track cumulative returns on the performance chart
5. **Analyze Setups**: Review which trading setups perform best

## License

MIT
