import React, {useRef, useEffect, useState} from 'react'
import {saveScore} from '../lib/supabaseClient'

export default function GameCanvas(){
  const canvasRef = useRef(null)
  const [score,setScore] = useState(0)
  const [running,setRunning] = useState(true)
  const player = useRef({x:50,y:150,w:30,h:30,dx:0})
  const bullets = useRef([])

  useEffect(()=>{
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    function step(){
      // update
      const p = player.current
      p.x += p.dx
      if(p.x < 0) p.x = 0
      if(p.x > canvas.width - p.w) p.x = canvas.width - p.w
      bullets.current = bullets.current.map(b => ({...b, x: b.x + b.vx})).filter(b=> b.x<canvas.width)
      // collision: random target for demo
      if(Math.random()<0.02){ setScore(s=>s+5) }
      // draw
      ctx.clearRect(0,0,canvas.width,canvas.height)
      ctx.fillStyle = '#0b1220'
      ctx.fillRect(0,0,canvas.width,canvas.height)
      // player
      ctx.fillStyle = '#4ee1a1'
      ctx.fillRect(p.x,p.y,p.w,p.h)
      // bullets
      ctx.fillStyle = '#ffd166'
      bullets.current.forEach(b=> ctx.fillRect(b.x,b.y,6,3))
      // HUD
      ctx.fillStyle='white'
      ctx.font='16px monospace'
      ctx.fillText('Score: '+score,10,20)
      if(running) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return ()=>{ setRunning(false); cancelAnimationFrame(raf)}
  },[score,running])

  useEffect(()=>{
    function key(e){
      const p = player.current
      if(e.type==='keydown'){
        if(e.key==='ArrowLeft'){ p.dx = -6 }
        if(e.key==='ArrowRight'){ p.dx = 6 }
        if(e.key===' ' || e.code==='Space'){ bullets.current.push({x:p.x+p.w,y:p.y+10,vx:8}); setScore(s=>s+1) }
      } else if(e.type==='keyup'){
        if(e.key==='ArrowLeft' || e.key==='ArrowRight'){ p.dx = 0 }
      }
    }
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', key)
    return ()=>{ window.removeEventListener('keydown', key); window.removeEventListener('keyup', key)}
  },[])

  async function handleSave(){
    try{
      await saveScore({name:'ProDemo',score})
      alert('Score saved to Supabase (if configured).')
    }catch(e){ alert('Save failed (check Supabase env).') }
  }

  return (
    <div>
      <canvas ref={canvasRef} width={700} height={400} style={{display:'block',background:'#071021'}} />
      <div style={{marginTop:10}}>
        <button onClick={()=>{ setScore(0) }}>Reset Score</button>
        <button onClick={handleSave} style={{marginLeft:8}}>Save Score</button>
        <span style={{marginLeft:12,fontFamily:'monospace'}}>Score: {score}</span>
        <div style={{marginTop:8,color:'#888',fontSize:13}}>Controls: ArrowLeft ArrowRight to move, Space to shoot</div>
      </div>
    </div>
  )
}
