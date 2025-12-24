interface SetupBadgeProps {
  name: string
  color?: string
}

export default function SetupBadge({ name, color = '#6b7280' }: SetupBadgeProps) {
  return (
    <span
      className="inline-block px-2 py-1 rounded text-xs font-medium"
      style={{
        backgroundColor: `${color}20`,
        color: color,
        borderColor: color,
        borderWidth: '1px',
      }}
    >
      {name}
    </span>
  )
}
