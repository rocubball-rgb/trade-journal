interface StatCardProps {
  label: string
  value: string | number
  valueColor?: string
  subValue?: string
}

export default function StatCard({ label, value, valueColor, subValue }: StatCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className={`text-2xl font-bold ${valueColor || 'text-white'}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-gray-500 text-xs mt-1">{subValue}</div>
      )}
    </div>
  )
}
