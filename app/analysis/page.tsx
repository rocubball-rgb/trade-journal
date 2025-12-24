import { supabase } from '@/lib/supabase'
import { PositionWithExits, SetupType } from '@/lib/types'
import SetupBadge from '@/components/SetupBadge'
import { formatCurrency, formatRMultiple, getColorClass, calculatePositionMetrics } from '@/lib/calculations'

async function getAnalysisData() {
  // Get ALL positions with their exits using Supabase relation query
  const { data: positionsData, error: posError } = await supabase
    .from('positions')
    .select(`
      *,
      exits (*)
    `)
    .order('entry_date', { ascending: false })

  if (posError) {
    console.error('[Analysis] Error fetching positions:', posError)
  }

  const { data: setupTypes } = await supabase.from('setup_types').select('*')

  // Transform the data to match PositionWithExits type
  const positionsWithExits: PositionWithExits[] = (positionsData || []).map((position: any) => ({
    ...position,
    exits: position.exits || [],
  }))

  console.log('[Analysis] Total positions fetched:', positionsData?.length || 0)
  console.log('[Analysis] Sample position exits count:', positionsWithExits?.[0]?.exits?.length || 0)

  return { positions: positionsWithExits, setupTypes: setupTypes || [] }
}

interface SetupAnalysis {
  name: string
  color: string
  numPositions: number
  numClosed: number
  winRate: number
  totalPnL: number
  avgR: number
  avgDaysHeld: number
  largestWinner: number
  largestLoser: number
}

function analyzeSetups(positions: PositionWithExits[], setupTypes: SetupType[]): SetupAnalysis[] {
  const setupMap = new Map<string, { positions: PositionWithExits[]; color: string }>()

  setupTypes.forEach((st) => {
    setupMap.set(st.name, { positions: [], color: st.color })
  })

  positions.forEach((position) => {
    const setup = setupMap.get(position.setup_type)
    if (setup) {
      setup.positions.push(position)
    }
  })

  return Array.from(setupMap.entries())
    .map(([name, { positions: setupPositions, color }]) => {
      if (setupPositions.length === 0) {
        return null
      }

      let totalPnL = 0
      let totalR = 0
      let totalDaysHeld = 0
      let numClosed = 0
      let winners = 0
      const closedPnLs: number[] = []

      setupPositions.forEach((position) => {
        const metrics = calculatePositionMetrics(position, position.exits)
        totalPnL += metrics.total_pnl
        totalR += metrics.r_multiple
        totalDaysHeld += metrics.days_held

        if (!metrics.is_open) {
          numClosed++
          closedPnLs.push(metrics.total_pnl)
          if (metrics.total_pnl > 0) winners++
        }
      })

      const winRate = numClosed > 0 ? (winners / numClosed) * 100 : 0
      const avgR = setupPositions.length > 0 ? totalR / setupPositions.length : 0
      const avgDaysHeld = setupPositions.length > 0 ? totalDaysHeld / setupPositions.length : 0

      const largestWinner = closedPnLs.length > 0 ? Math.max(...closedPnLs) : 0
      const largestLoser = closedPnLs.length > 0 ? Math.min(...closedPnLs) : 0

      return {
        name,
        color,
        numPositions: setupPositions.length,
        numClosed,
        winRate,
        totalPnL,
        avgR,
        avgDaysHeld,
        largestWinner,
        largestLoser,
      }
    })
    .filter((analysis): analysis is SetupAnalysis => analysis !== null)
    .sort((a, b) => b.totalPnL - a.totalPnL)
}

export default async function Analysis() {
  const { positions, setupTypes } = await getAnalysisData()
  const setupAnalysis = analyzeSetups(positions, setupTypes)

  // Calculate overall stats
  const totalPositions = positions.length
  const closedPositions = positions.filter((p) => {
    const metrics = calculatePositionMetrics(p, p.exits)
    return !metrics.is_open
  }).length

  const avgDaysHeld = positions.length > 0
    ? positions.reduce((sum, p) => {
        const metrics = calculatePositionMetrics(p, p.exits)
        return sum + metrics.days_held
      }, 0) / positions.length
    : 0

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Setup Analysis</h2>

      {setupAnalysis.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-500">
          No positions to analyze. Add positions to see detailed setup performance.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="text-left p-3 font-semibold">Setup</th>
                <th className="text-right p-3 font-semibold">Positions</th>
                <th className="text-right p-3 font-semibold">Closed</th>
                <th className="text-right p-3 font-semibold">Win Rate</th>
                <th className="text-right p-3 font-semibold">Total P&L</th>
                <th className="text-right p-3 font-semibold">Avg R</th>
                <th className="text-right p-3 font-semibold">Avg Days</th>
                <th className="text-right p-3 font-semibold">Largest Winner</th>
                <th className="text-right p-3 font-semibold">Largest Loser</th>
              </tr>
            </thead>
            <tbody>
              {setupAnalysis.map((analysis) => (
                <tr
                  key={analysis.name}
                  className="border-b border-gray-800 hover:bg-gray-800/50"
                >
                  <td className="p-3">
                    <SetupBadge name={analysis.name} color={analysis.color} />
                  </td>
                  <td className="text-right p-3 text-gray-300">
                    {analysis.numPositions}
                  </td>
                  <td className="text-right p-3 text-gray-300">
                    {analysis.numClosed}
                  </td>
                  <td
                    className={`text-right p-3 font-medium ${getColorClass(
                      analysis.winRate - 50
                    )}`}
                  >
                    {analysis.winRate.toFixed(1)}%
                  </td>
                  <td
                    className={`text-right p-3 font-bold ${getColorClass(
                      analysis.totalPnL
                    )}`}
                  >
                    {formatCurrency(analysis.totalPnL)}
                  </td>
                  <td
                    className={`text-right p-3 font-medium ${getColorClass(
                      analysis.avgR
                    )}`}
                  >
                    {formatRMultiple(analysis.avgR)}
                  </td>
                  <td className="text-right p-3 text-gray-300">
                    {analysis.avgDaysHeld.toFixed(1)}
                  </td>
                  <td className="text-right p-3 text-green-500 font-medium">
                    {formatCurrency(analysis.largestWinner)}
                  </td>
                  <td className="text-right p-3 text-red-500 font-medium">
                    {formatCurrency(analysis.largestLoser)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Key Insights</h3>
          <div className="space-y-3 text-sm">
            {setupAnalysis.length > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">Best Performing Setup:</span>
                  <SetupBadge
                    name={setupAnalysis[0].name}
                    color={setupAnalysis[0].color}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Highest Win Rate:</span>
                  <span className="font-medium">
                    {[...setupAnalysis].sort((a, b) => b.winRate - a.winRate)[0]
                      .name}{' '}
                    (
                    {[...setupAnalysis]
                      .sort((a, b) => b.winRate - a.winRate)[0]
                      .winRate.toFixed(1)}
                    %)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Best Avg R-Multiple:</span>
                  <span className="font-medium">
                    {[...setupAnalysis].sort((a, b) => b.avgR - a.avgR)[0].name} (
                    {formatRMultiple(
                      [...setupAnalysis].sort((a, b) => b.avgR - a.avgR)[0].avgR
                    )}
                    )
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Positions:</span>
                  <span className="font-medium">{totalPositions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Closed Positions:</span>
                  <span className="font-medium">{closedPositions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Days Held:</span>
                  <span className="font-medium">{avgDaysHeld.toFixed(1)} days</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Setup Distribution</h3>
          <div className="space-y-2">
            {setupAnalysis.map((analysis) => {
              const percentage = (analysis.numPositions / totalPositions) * 100
              return (
                <div key={analysis.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">{analysis.name}</span>
                    <span className="text-gray-300">
                      {analysis.numPositions} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: analysis.color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
