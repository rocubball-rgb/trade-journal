import { supabase } from '@/lib/supabase'
import { SetupType } from '@/lib/types'

/** Ensures default setup types (e.g. META Pullback) exist, then returns all setup types. */
export async function getSetupTypes(): Promise<SetupType[]> {
  await supabase
    .from('setup_types')
    .upsert([{ name: 'META Pullback', color: '#ec4899' }], { onConflict: 'name', ignoreDuplicates: true })

  const { data } = await supabase.from('setup_types').select('*').order('name')
  return data || []
}
