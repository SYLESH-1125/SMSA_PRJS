import React, {useEffect, useState} from 'react'
import {fetchTopScores} from '../lib/supabaseClient'
export default function Leaderboard(){
  const [rows,setRows] = useState([])
  useEffect(()=>{ let mounted=true; fetchTopScores().then(r=>{ if(mounted) setRows(r) }).catch(()=>{}) ; return ()=> mounted=false },[])
  return (
    <div>
      <h3>Leaderboard</h3>
      <ol>
        {rows.length? rows.map((r,i)=> <li key={i}>{r.name} — {r.score}</li>) : <li>No scores yet</li>}
      </ol>
      <div style={{fontSize:12,color:'#666'}}>Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY</div>
    </div>
  )
}
