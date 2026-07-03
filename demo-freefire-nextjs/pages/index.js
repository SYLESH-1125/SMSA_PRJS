import dynamic from 'next/dynamic'
import Head from 'next/head'
const GameCanvas = dynamic(() => import('../components/GameCanvas'), { ssr: false })
const Leaderboard = dynamic(() => import('../components/Leaderboard'), { ssr: false })
export default function Home(){
  return (
    <div style={{fontFamily:'system-ui,Segoe UI,Roboto',padding:20}}>
      <Head>
        <title>Demo Free Fire — Next.js + Supabase</title>
      </Head>
      <h1>Demo Free Fire (Minimal)</h1>
      <p>Use Arrow keys to move, Space to shoot. Save score to Supabase leaderboard.</p>
      <div style={{display:'flex',gap:20,alignItems:'flex-start'}}> 
        <div style={{width:720,border:'1px solid #ddd',padding:10}}>
          <GameCanvas />
        </div>
        <div style={{width:320}}>
          <Leaderboard />
        </div>
      </div>
    </div>
  )
}
