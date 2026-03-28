import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local manually
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: classes } = await supabase.from('classes').select('id, name')
  if (!classes) {
    console.log('No classes found or error fetching')
    return
  }

  for (const cls of classes) {
    // 7-A: No changes
    if (cls.name === '7-А') {
      console.log('Skipping 7-A')
      continue
    }

    let g = 250, p = 500
    // 7-V: 200/400
    if (cls.name === '7-В') { 
      g = 200; p = 400 
    }

    console.log(`Updating ${cls.name}: Game=${g}, Pizza=${p}`)
    const { error } = await supabase.from('classes').update({
      game_day_threshold: g,
      pizza_day_threshold: p
    }).eq('id', cls.id)
    
    if (error) console.error(`Error updating ${cls.name}:`, error)
  }
  console.log('Database thresholds update complete.')
}

run()
