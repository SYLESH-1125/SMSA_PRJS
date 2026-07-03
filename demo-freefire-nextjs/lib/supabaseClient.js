import {createClient} from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export async function saveScore({name='Anonymous', score=0}){
  if(!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase not configured')
  const {data,error} = await supabase.from('leaderboard').insert([{name,score}])
  if(error) throw error
  return data
}
export async function fetchTopScores(){
  if(!SUPABASE_URL || !SUPABASE_KEY) return []
  const {data,error} = await supabase.from('leaderboard').select('name,score').order('score',{ascending:false}).limit(10)
  if(error) return []
  return data
}
