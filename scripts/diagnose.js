// Diagnostic script to check database schema and data
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://wzlrwsksxqqnysngjaoa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bHJ3c2tzeHFxbnlzbmdqYW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1Mjk5MDksImV4cCI6MjA4MjEwNTkwOX0.Nh-glcG_BSUu7uwBDAid91abI-BHsNygjgaWKH49QM0'

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnose() {
  console.log('🔍 Checking database...\n')

  // Check positions
  const { data: positions, error: posError } = await supabase
    .from('positions')
    .select('*')
    .limit(1)

  if (posError) {
    console.log('❌ Error fetching positions:', posError.message)
    console.log('   Details:', posError.details)
    console.log('   Hint:', posError.hint)
  } else {
    console.log('✅ Positions table accessible')
    console.log('   Sample record:', positions[0] ? 'Found' : 'No data')
    if (positions[0]) {
      console.log('   Columns:', Object.keys(positions[0]))
    }
  }

  // Check exits
  const { data: exits, error: exitError } = await supabase
    .from('exits')
    .select('*')
    .limit(1)

  if (exitError) {
    console.log('\n❌ Error fetching exits:', exitError.message)
  } else {
    console.log('\n✅ Exits table accessible')
    console.log('   Sample record:', exits[0] ? 'Found' : 'No data')
  }

  // Count records
  const { count: posCount } = await supabase
    .from('positions')
    .select('*', { count: 'exact', head: true })

  const { count: exitCount } = await supabase
    .from('exits')
    .select('*', { count: 'exact', head: true })

  console.log('\n📊 Record counts:')
  console.log('   Positions:', posCount || 0)
  console.log('   Exits:', exitCount || 0)

  // Check for old schema columns
  if (positions && positions[0]) {
    const hasOldFields = positions[0].hasOwnProperty('fomo_level') || positions[0].hasOwnProperty('edge_type')
    const hasNewField = positions[0].hasOwnProperty('market_cycle')

    console.log('\n🔧 Schema check:')
    console.log('   Has old fields (fomo_level/edge_type):', hasOldFields)
    console.log('   Has new field (market_cycle):', hasNewField)

    if (hasOldFields && !hasNewField) {
      console.log('\n⚠️  MIGRATION NEEDED!')
      console.log('   Your database still uses the old schema.')
      console.log('   Run the migration.sql file in Supabase SQL Editor.')
    } else if (!hasOldFields && hasNewField) {
      console.log('\n✅ Schema is up to date!')
    }
  }
}

diagnose()
