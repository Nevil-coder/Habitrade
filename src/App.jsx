import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import * as Icons from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { starterHabits, navItems, todayKey, dateKey, isScheduled, isDone, streakFor } from './data'

const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback } }
const Icon = ({ name, size=18, ...props }) => { const C = Icons[name] || Icons.Circle; return <C size={size} strokeWidth={1.8} {...props} /> }
const uid = () => Math.random().toString(36).slice(2,10)
const fmt = d => d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})
const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const categories = ['Health','Learning','Fitness','Mindfulness','Personal','Work']

function App() {
  const reduceMotion = useReducedMotion()
  const [page,setPage] = useState('dashboard')
  const [theme,setTheme] = useState(()=>read('habitrade-theme','dark'))
  const [habits,setHabits] = useState(()=>read('habitrade-habits',starterHabits))
  const [name,setName] = useState(()=>read('habitrade-name','there'))
  const [modal,setModal] = useState(false)
  const [editing,setEditing] = useState(null)
  const [toast,setToast] = useState('')
  const [month,setMonth] = useState(new Date())
  const [selectedDate,setSelectedDate] = useState(todayKey())
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState('All')
  const [reminders,setReminders] = useState(()=>read('habitrade-reminders',true))
  const [motionLevel,setMotionLevel] = useState(()=>read('habitrade-motion','maximum'))
  const [form,setForm] = useState({name:'',category:'Health',target:'20 minutes',reminder:'08:00',schedule:[0,1,2,3,4,5,6],color:'#a78bfa'})
  const [profile,setProfile] = useState(()=>read('habitrade-profile',''))
  const today = todayKey()
  const scheduled = habits.filter(h=>isScheduled(h))
  const done = scheduled.filter(h=>isDone(h)).length
  const pct = scheduled.length ? Math.round(done/scheduled.length*100) : 0
  const totalXP = habits.reduce((sum,h)=>sum+(h.completions?.length||0)*10,0)
  const level = Math.floor(totalXP/100)+1
  const pageTitle = navItems.find(n=>n.id===page)?.label || 'Overview'
  const notify = msg => { setToast(msg); window.setTimeout(()=>setToast(''),2600) }

  useEffect(()=>localStorage.setItem('habitrade-habits',JSON.stringify(habits)),[habits])
  useEffect(()=>localStorage.setItem('habitrade-theme',JSON.stringify(theme)),[theme])
  useEffect(()=>localStorage.setItem('habitrade-name',JSON.stringify(name)),[name])
  useEffect(()=>localStorage.setItem('habitrade-reminders',JSON.stringify(reminders)),[reminders])
  useEffect(()=>localStorage.setItem('habitrade-motion',JSON.stringify(motionLevel)),[motionLevel])
  useEffect(()=>localStorage.setItem('habitrade-profile',JSON.stringify(profile)),[profile])
  useEffect(()=>{
    if(!reminders || !('Notification' in window) || Notification.permission !== 'granted') return
    const check = () => {
      const now = new Date(), hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      habits.filter(h=>h.reminder===hhmm && isScheduled(h,now) && !isDone(h)).forEach(h=>{
        const key = `habitrade-notified-${today}-${h.id}-${hhmm}`
        if(!localStorage.getItem(key)){ new Notification('Habitrade reminder', { body: `Time for: ${h.name}` }); localStorage.setItem(key,'1') }
      })
    }
    check(); const timer=window.setInterval(check,30000); return ()=>window.clearInterval(timer)
  },[habits,reminders,today])

  const toggleHabit = id => {
    setHabits(prev=>prev.map(h=>{
      if(h.id!==id) return h
      const completions = h.completions||[]
      const next = completions.includes(today) ? completions.filter(x=>x!==today) : [...completions,today]
      return {...h,completions:next}
    }))
    const h=habits.find(x=>x.id===id)
    notify(isDone(h) ? 'Habit marked as not completed' : 'Habit completed · +10 XP')
  }
  const openCreate = habit => {
    setEditing(habit?.id || null)
    setForm(habit ? {...habit,schedule:habit.schedule||[0,1,2,3,4,5,6]} : {name:'',category:'Health',target:'20 minutes',reminder:'08:00',schedule:[0,1,2,3,4,5,6],color:'#a78bfa'})
    setModal(true)
  }
  const saveHabit = e => {
    e.preventDefault()
    if(!form.name.trim()) return
    if(editing) setHabits(prev=>prev.map(h=>h.id===editing?{...h,...form}:h))
    else setHabits(prev=>[...prev,{...form,id:uid(),createdAt:new Date().toISOString(),completions:[]}])
    setModal(false); notify(editing?'Habit updated':'New habit created')
  }
  const deleteHabit = id => { if(confirm('Delete this habit and its history?')) { setHabits(prev=>prev.filter(h=>h.id!==id)); notify('Habit deleted') } }
  const exportData = () => {
    const blob = new Blob([JSON.stringify({habits,theme,name,reminders,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='habitrade-backup.json'; a.click(); URL.revokeObjectURL(url); notify('Backup downloaded')
  }
  const importData = e => {
    const file=e.target.files?.[0]; if(!file) return
    const reader=new FileReader()
    reader.onload=()=>{try{const data=JSON.parse(reader.result); if(!Array.isArray(data.habits)) throw new Error(); setHabits(data.habits); if(data.theme)setTheme(data.theme); notify('Backup restored')}catch{notify('That backup file is not valid')}}
    reader.readAsText(file); e.target.value=''
  }
  const askNotifications = async () => {
    if(!('Notification' in window)){notify('Notifications are not supported in this browser');return}
    const p=await Notification.requestPermission()
    setReminders(p==='granted'); notify(p==='granted'?'Notifications enabled':'Notification permission not granted')
  }

  return <div className={`app ${theme}`} data-motion={motionLevel}>
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Icon name="Orbit" size={22}/></div><span>habit<span className="brand-accent">rade</span></span></div>
      <div className="side-scroll">
        {['WORKSPACE','PERSONAL'].map(group=><div className="nav-group" key={group}>
          <div className="nav-label">{group}</div>
          {navItems.filter(n=>n.group===group).map(n=><button key={n.id} className={`nav-link ${page===n.id?'active':''}`} onClick={()=>setPage(n.id)}>
            <Icon name={n.icon}/><span>{n.label}</span>{page===n.id&&<motion.i layoutId="nav-pill" className="nav-pill"/>}
          </button>)}
        </div>)}
      </div>
      <div className="sidebar-bottom">
        <div className="level-card"><div className="level-icon"><Icon name="Zap" size={17}/></div><div className="level-copy"><b>Level {level} explorer</b><span>{totalXP%100}/100 XP to next level</span><div className="mini-progress"><i style={{width:`${totalXP%100}%`}}/></div></div></div>
        <button className="profile-row" onClick={()=>setPage('settings')}><div className="avatar">{(name||'H').slice(0,1).toUpperCase()}</div><div><b>{name||'Your profile'}</b><span>Personal space</span></div><Icon name="MoreHorizontal" size={17}/></button>
      </div>
    </aside>

    <main className="main-shell">
      <header className="topbar">
        <div className="crumb"><span>Workspace</span><Icon name="ChevronRight" size={14}/><b>{pageTitle}</b></div>
        <div className="top-actions">
          <div className="date-chip"><Icon name="CalendarDays" size={15}/>{fmt(new Date())}</div>
          <button className="icon-button" title="Toggle theme" onClick={()=>setTheme(theme==='dark'?'light':'dark')}><Icon name={theme==='dark'?'Sun':'Moon'} size={18}/></button>
          <button className="icon-button notification-button" title="Reminders" onClick={()=>setPage('reminders')}><Icon name="Bell" size={18}/><i/></button>
          <button className="avatar top-avatar" onClick={()=>setPage('settings')}>{(name||'H').slice(0,1).toUpperCase()}</button>
        </div>
      </header>
      <section className="content-viewport">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={page} className="page-stage"
            initial={reduceMotion?{opacity:0}:{opacity:0,y:22,rotateY:page==='dashboard'?0:9,scale:.965,filter:'blur(7px)',transformPerspective:1200}}
            animate={{opacity:1,y:0,rotateY:0,scale:1,filter:'blur(0px)'}}
            exit={reduceMotion?{opacity:0}:{opacity:0,y:-12,rotateY:-7,scale:.975,filter:'blur(5px)'}}
            transition={{duration: reduceMotion ? 0.12 : motionLevel === 'maximum' ? 0.68 : motionLevel === 'balanced' ? 0.35 : 0.12,ease:[.22,1,.36,1]}}>
            {page==='dashboard'&&<Dashboard habits={habits} scheduled={scheduled} done={done} pct={pct} name={name} totalXP={totalXP} onToggle={toggleHabit} onAdd={()=>openCreate()} onNavigate={setPage}/>}
            {page==='habits'&&<HabitsPage habits={habits} onToggle={toggleHabit} onAdd={()=>openCreate()} onEdit={openCreate} onDelete={deleteHabit} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter}/>}
            {page==='calendar'&&<CalendarPage habits={habits} month={month} setMonth={setMonth} selected={selectedDate} setSelected={setSelectedDate}/>}
            {page==='analytics'&&<AnalyticsPage habits={habits}/>}
            {page==='achievements'&&<AchievementsPage habits={habits} xp={totalXP} level={level}/>}
            {page==='reminders'&&<RemindersPage habits={habits} enabled={reminders} onEnable={askNotifications}/>}
            {page==='settings'&&<SettingsPage name={name} setName={setName} theme={theme} setTheme={setTheme} motionLevel={motionLevel} setMotionLevel={setMotionLevel} exportData={exportData} importData={importData} profile={profile} setProfile={setProfile}/>}
          </motion.div>
        </AnimatePresence>
      </section>
    </main>

    <AnimatePresence>{toast&&<motion.div className="toast" initial={{opacity:0,y:18,scale:.92}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12}}><Icon name="CheckCircle2" size={18}/>{toast}</motion.div>}</AnimatePresence>
    <AnimatePresence>{modal&&<HabitModal form={form} setForm={setForm} editing={editing} onClose={()=>setModal(false)} onSave={saveHabit}/>}</AnimatePresence>
    <div className="mobile-nav">{navItems.slice(0,5).map(n=><button key={n.id} className={page===n.id?'selected':''} onClick={()=>setPage(n.id)}><Icon name={n.icon} size={19}/><small>{n.label}</small></button>)}</div>
  </div>
}

function PageHeading({eyebrow,title,description,action}) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}
function StatCard({label,value,sub,icon,tone,progress}) {
  return <motion.div className="stat-card glass-card" whileHover={{y:-5,rotateX:2,rotateY:-2}} transition={{type:'spring',stiffness:260,damping:20}}>
    <div className={`stat-icon ${tone}`}><Icon name={icon} size={19}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-sub">{sub}</div>{progress!==undefined&&<div className="stat-line"><i style={{width:`${progress}%`}}/></div>}
  </motion.div>
}
function ProgressRing({value}) {
  return <div className="ring-wrap"><svg viewBox="0 0 150 150"><circle className="ring-track" cx="75" cy="75" r="61"/><motion.circle className="ring-value" cx="75" cy="75" r="61" initial={{pathLength:0}} animate={{pathLength:value/100}} transition={{duration:1.2,ease:'easeOut'}}/></svg><div className="ring-center"><strong>{value}%</strong><span>completed</span></div></div>
}
function HabitRow({habit,onToggle,compact=false}) {
  const done=isDone(habit)
  return <motion.div layout className={`habit-row ${done?'is-done':''}`}>
    <button className={`habit-check ${done?'checked':''}`} onClick={()=>onToggle(habit.id)} aria-label="Toggle completion">{done&&<motion.span initial={{scale:0,rotate:-40}} animate={{scale:1,rotate:0}}><Icon name="Check" size={15}/></motion.span>}</button>
    <div className="habit-color" style={{background:habit.color||'#a78bfa'}}/>
    <div className="habit-info"><b>{habit.name}</b><span>{habit.category} · {habit.target||'Daily goal'}</span></div>
    {!compact&&<div className="habit-streak"><Icon name="Flame" size={14}/>{streakFor(habit)} day streak</div>}
    <span className={`habit-status ${done?'done':''}`}>{done?'Completed':'In progress'}</span>
  </motion.div>
}
function Dashboard({habits,scheduled,done,pct,name,totalXP,onToggle,onAdd,onNavigate}) {
  const week=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const key=dateKey(d);return {day:days[d.getDay()],done:habits.filter(h=>(h.completions||[]).includes(key)).length}})
  const max=Math.max(1,...week.map(x=>x.done))
  return <div>
    <PageHeading eyebrow="YOUR PERSONAL SPACE" title={`Good ${new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}, ${name || 'there'} ✨`} description="Small steps, repeated daily, create remarkable change." action={<button className="primary-button" onClick={onAdd}><Icon name="Plus" size={17}/> New habit</button>}/>
    <div className="stats-grid">
      <StatCard label="Active habits" value={habits.length} sub="Your growth toolkit" icon="Layers3" tone="violet"/>
      <StatCard label="Completed today" value={`${done}/${scheduled.length}`} sub={`${pct}% of today's plan`} icon="CheckCircle2" tone="green" progress={pct}/>
      <StatCard label="Current streak" value={`${Math.max(0,...habits.map(streakFor))} days`} sub="Keep the momentum going" icon="Flame" tone="orange"/>
      <StatCard label="Total experience" value={`${totalXP} XP`} sub="Every action counts" icon="Zap" tone="blue"/>
    </div>
    <div className="dashboard-grid">
      <div className="panel progress-panel"><div className="panel-head"><div><span className="eyebrow">DAILY OVERVIEW</span><h2>Today's progress</h2></div><span className="date-tag">{new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span></div><div className="progress-body"><ProgressRing value={pct}/><div className="progress-copy"><h3>{pct===100?'Perfect day!':pct>=60?'You are doing great!':'You have got this!'}</h3><p>{done} of {scheduled.length} scheduled habits completed. Keep moving forward.</p><div className="progress-meta"><span><i className="dot purple"/>Completed</span><b>{done}</b><span><i className="dot muted"/>Remaining</span><b>{Math.max(0,scheduled.length-done)}</b></div></div></div></div>
      <div className="panel weekly-panel"><div className="panel-head"><div><span className="eyebrow">LAST 7 DAYS</span><h2>Weekly activity</h2></div><button className="text-button" onClick={()=>onNavigate('analytics')}>Details <Icon name="ArrowUpRight" size={14}/></button></div><div className="week-bars">{week.map((d,i)=><div className="week-col" key={i}><div className="bar-track"><motion.i initial={{height:0}} animate={{height:`${Math.max(5,d.done/max*100)}%`}} transition={{duration:.7,delay:i*.06}}/></div><span>{d.day}</span></div>)}</div><div className="chart-foot"><span><i className="dot purple"/>Habits completed per day</span><b>{week.reduce((s,x)=>s+x.done,0)} total</b></div></div>
    </div>
    <div className="panel habits-panel"><div className="panel-head"><div><span className="eyebrow">MAKE TODAY COUNT</span><h2>Today's habits</h2></div><button className="text-button" onClick={()=>onNavigate('habits')}>View all <Icon name="ArrowRight" size={14}/></button></div>
      {scheduled.length?scheduled.slice(0,5).map(h=><HabitRow key={h.id} habit={h} onToggle={onToggle}/>):<Empty title="No habits scheduled today" text="Add a habit or update its schedule to get started."/>}
    </div>
  </div>
}
function HabitsPage({habits,onToggle,onAdd,onEdit,onDelete,query,setQuery,filter,setFilter}) {
  const filtered=habits.filter(h=>(filter==='All'||h.category===filter)&&h.name.toLowerCase().includes(query.toLowerCase()))
  return <div><PageHeading eyebrow="YOUR ROUTINES" title="My habits" description="Design a routine that makes your future self proud." action={<button className="primary-button" onClick={onAdd}><Icon name="Plus" size={17}/> Add habit</button>}/>
    <div className="toolbar"><div className="search-box"><Icon name="Search" size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your habits..."/></div><select value={filter} onChange={e=>setFilter(e.target.value)}>{['All',...categories].map(c=><option key={c}>{c}</option>)}</select></div>
    <div className="habit-list-panel panel">{filtered.length?filtered.map(h=><div className="managed-habit" key={h.id}><HabitRow habit={h} onToggle={onToggle}/><div className="manage-actions"><button title="Edit" onClick={()=>onEdit(h)}><Icon name="Pencil" size={16}/></button><button title="Delete" onClick={()=>onDelete(h.id)}><Icon name="Trash2" size={16}/></button></div></div>):<Empty title="No habits found" text="Try another search or create a new habit."/>}</div>
  </div>
}
function CalendarPage({habits,month,setMonth,selected,setSelected}) {
  const year=month.getFullYear(),m=month.getMonth(),first=new Date(year,m,1).getDay(),count=new Date(year,m+1,0).getDate()
  const cells=[...Array(first).fill(null),...Array.from({length:count},(_,i)=>i+1)]
  const selectedHabits=habits.filter(h=>(h.completions||[]).includes(selected))
  return <div><PageHeading eyebrow="YOUR CONSISTENCY" title="Habit calendar" description="See the small wins that add up over time."/>
    <div className="calendar-layout"><div className="panel calendar-panel"><div className="panel-head"><div><span className="eyebrow">MONTHLY VIEW</span><h2>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2></div><div className="month-actions"><button onClick={()=>setMonth(new Date(year,m-1,1))}><Icon name="ChevronLeft"/></button><button onClick={()=>setMonth(new Date(year,m+1,1))}><Icon name="ChevronRight"/></button></div></div><div className="calendar-grid">{days.map(d=><b className="weekday" key={d}>{d}</b>)}{cells.map((day,i)=>{if(!day)return <span key={`blank${i}`}/>;const d=new Date(year,m,day),key=dateKey(d),completed=habits.filter(h=>(h.completions||[]).includes(key)).length,total=habits.filter(h=>isScheduled(h,d)).length,ratio=total?completed/total:0;return <button key={day} className={`calendar-day ${selected===key?'selected':''} ${key===todayKey()?'today':''}`} onClick={()=>setSelected(key)}><span>{day}</span>{total>0&&<i style={{background:ratio===1?'#39d6a0':ratio>0?'#a78bfa':'var(--line)'}}/>}</button>})}</div><div className="calendar-legend"><span><i className="dot green"/>All done</span><span><i className="dot purple"/>In progress</span><span><i className="dot muted"/>No activity</span></div></div>
      <div className="panel selected-day"><span className="eyebrow">DAY DETAILS</span><h2>{new Date(`${selected}T12:00:00`).toLocaleDateString(undefined,{month:'long',day:'numeric'})}</h2><div className="selected-count">{selectedHabits.length}<span>completed</span></div>{selectedHabits.length?selectedHabits.map(h=><div className="mini-habit" key={h.id}><i style={{background:h.color}}/>{h.name}</div>):<p className="muted-copy">No completed habits recorded for this day.</p>}</div></div>
  </div>
}
function AnalyticsPage({habits}) {
  const data=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);const key=dateKey(d);return {day:d.toLocaleDateString(undefined,{month:'short',day:'numeric'}),completed:habits.filter(h=>(h.completions||[]).includes(key)).length}})
  const total=habits.reduce((s,h)=>s+(h.completions?.length||0),0),possible=habits.length*14,rate=possible?Math.round(total/possible*100):0
  const perHabit=habits.map(h=>({name:h.name.length>13?h.name.slice(0,13)+'…':h.name,days:h.completions?.length||0}))
  return <div><PageHeading eyebrow="MEASURE YOUR MOMENTUM" title="Analytics" description="Turn consistency into something you can see and improve."/>
    <div className="stats-grid"><StatCard label="Total completions" value={total} sub="All-time recorded wins" icon="CheckCheck" tone="green"/><StatCard label="14-day activity" value={`${rate}%`} sub="Completion against 14-day target" icon="ChartNoAxesCombined" tone="violet"/><StatCard label="Tracked habits" value={habits.length} sub="Active routines" icon="Target" tone="blue"/></div>
    <div className="panel chart-panel"><div className="panel-head"><div><span className="eyebrow">CONSISTENCY TREND</span><h2>Last 14 days</h2></div><span className="date-tag">Daily completions</span></div><div className="large-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="fillPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9b70f7" stopOpacity={.38}/><stop offset="95%" stopColor="#9b70f7" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--line)" vertical={false}/><XAxis dataKey="day" stroke="var(--muted)" tickLine={false} axisLine={false}/><YAxis allowDecimals={false} stroke="var(--muted)" tickLine={false} axisLine={false}/><Tooltip contentStyle={{background:'var(--panel)',border:'1px solid var(--line)',borderRadius:12,color:'var(--text)'}}/><Area type="monotone" dataKey="completed" stroke="#a78bfa" strokeWidth={3} fill="url(#fillPurple)" /></AreaChart></ResponsiveContainer></div></div>
    <div className="panel chart-panel"><div className="panel-head"><div><span className="eyebrow">HABIT BREAKDOWN</span><h2>Completions by habit</h2></div></div><div className="large-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={perHabit} layout="vertical" margin={{left:12,right:20}}><CartesianGrid stroke="var(--line)" horizontal={false}/><XAxis type="number" stroke="var(--muted)" axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" width={110} stroke="var(--muted)" axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'var(--panel)',border:'1px solid var(--line)',borderRadius:12,color:'var(--text)'}}/><Bar dataKey="days" fill="#9870ed" radius={[0,8,8,0]}/></BarChart></ResponsiveContainer></div></div>
  </div>
}
function AchievementsPage({habits,xp,level}) {
  const completed=habits.reduce((s,h)=>s+(h.completions?.length||0),0),longest=Math.max(0,...habits.map(streakFor))
  const items=[['First Spark','Complete your first habit','Sparkles',completed>=1],['Getting Started','Record 5 completions','Footprints',completed>=5],['Week Warrior','Reach a 7-day streak','Flame',longest>=7],['Habit Builder','Record 30 completions','Hammer',completed>=30],['Consistency Pro','Reach 90% weekly completion','Crown',habits.length>0&&habits.filter(h=>streakFor(h)>=6).length>0],['Level 5','Reach level 5','Trophy',level>=5]]
  return <div><PageHeading eyebrow="CELEBRATE YOUR WINS" title="Achievements" description="Every small action earns a place in your story."/><div className="level-banner"><div className="level-orb"><Icon name="Trophy" size={30}/></div><div className="level-banner-copy"><span>YOUR CURRENT RANK</span><h2>Level {level} Explorer</h2><p>{xp%100} / 100 XP to level {level+1}</p><div className="level-progress"><i style={{width:`${xp%100}%`}}/></div></div><strong>{xp} <small>XP</small></strong></div><div className="achievement-grid">{items.map(([title,desc,icon,earned],i)=><motion.div className={`achievement-card panel ${earned?'earned':''}`} key={title} whileHover={{y:-5,rotateY:4}}><div className="achievement-icon"><Icon name={icon} size={25}/></div><span className="achievement-state">{earned?'UNLOCKED':'LOCKED'}</span><h3>{title}</h3><p>{desc}</p>{earned&&<div className="earned-line"><Icon name="CheckCircle2" size={14}/> Achievement earned</div>}</motion.div>)}</div></div>
}
function RemindersPage({habits,enabled,onEnable}) {
  return <div><PageHeading eyebrow="STAY ON TRACK" title="Reminders" description="Give your intentions a gentle nudge at the right time." action={<button className="primary-button" onClick={onEnable}><Icon name="BellRing" size={16}/>{enabled?'Notifications enabled':'Enable notifications'}</button>}/><div className="panel reminder-intro"><div className="reminder-art"><Icon name="BellRing" size={36}/></div><div><h2>Make time for what matters</h2><p>Habitrade can request browser notification permission and show reminders while the app is open. Browser and operating-system settings control delivery.</p><span className={`permission-pill ${enabled?'allowed':''}`}><i/>{enabled?'Permission enabled':'Permission not enabled'}</span></div></div><div className="panel"><div className="panel-head"><div><span className="eyebrow">YOUR SCHEDULE</span><h2>Habit reminder times</h2></div></div>{habits.filter(h=>h.reminder).length?habits.filter(h=>h.reminder).map(h=><div className="reminder-row" key={h.id}><div className="reminder-icon"><Icon name="Clock"/></div><div className="habit-info"><b>{h.name}</b><span>{h.category}</span></div><strong>{h.reminder}</strong></div>):<Empty title="No reminders set" text="Add reminder times while creating or editing habits."/>}</div></div>
}
function SettingsPage({name,setName,theme,setTheme,motionLevel,setMotionLevel,exportData,importData,profile,setProfile}) {
  return <div><PageHeading eyebrow="MAKE IT YOURS" title="Settings" description="Tune your Habitrade experience."/><div className="settings-grid"><div className="panel settings-panel"><span className="eyebrow">PROFILE</span><h2>Your details</h2><label className="field-label">Display name<input value={name} onChange={e=>setName(e.target.value)} placeholder="What should we call you?"/></label><label className="field-label">A little about you<textarea rows="3" value={profile} onChange={e=>setProfile(e.target.value)} placeholder="Your goals, focus or motivation..."/></label></div><div className="panel settings-panel"><span className="eyebrow">APPEARANCE</span><h2>Theme preference</h2><div className="choice-row"><button className={theme==='dark'?'choice active':''} onClick={()=>setTheme('dark')}><Icon name="Moon"/>Dark</button><button className={theme==='light'?'choice active':''} onClick={()=>setTheme('light')}><Icon name="Sun"/>Light</button></div><h2 className="settings-subhead">Motion intensity</h2><div className="choice-row three"><button className={motionLevel==='maximum'?'choice active':''} onClick={()=>setMotionLevel('maximum')}>Maximum</button><button className={motionLevel==='balanced'?'choice active':''} onClick={()=>setMotionLevel('balanced')}>Balanced</button><button className={motionLevel==='reduced'?'choice active':''} onClick={()=>setMotionLevel('reduced')}>Reduced</button></div></div><div className="panel settings-panel"><span className="eyebrow">YOUR DATA</span><h2>Backup & restore</h2><p className="muted-copy">Your data stays in this browser. Export a backup before clearing browser data or moving devices.</p><div className="backup-actions"><button className="secondary-button" onClick={exportData}><Icon name="Download"/> Export backup</button><label className="secondary-button upload-button"><Icon name="Upload"/> Import backup<input type="file" accept="application/json" onChange={importData}/></label></div></div><div className="panel settings-panel"><span className="eyebrow">ABOUT</span><h2>Habitrade</h2><p className="muted-copy">Build better habits. Track your growth. Become your best self.</p><div className="about-line"><span>Version</span><b>1.0.0</b></div><div className="about-line"><span>Storage</span><b>Local browser storage</b></div><div className="about-line"><span>Account</span><b>Not required</b></div></div></div></div>
}
function Empty({title,text}) { return <div className="empty-state"><div><Icon name="Sparkles" size={23}/></div><b>{title}</b><span>{text}</span></div> }
function HabitModal({form,setForm,editing,onClose,onSave}) {
  const toggleDay=d=>setForm(f=>({...f,schedule:f.schedule.includes(d)?f.schedule.filter(x=>x!==d):[...f.schedule,d]}))
  return <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><motion.form className="habit-modal" onSubmit={onSave} initial={{opacity:0,scale:.88,rotateX:9,y:22}} animate={{opacity:1,scale:1,rotateX:0,y:0}} exit={{opacity:0,scale:.94,y:12}} transition={{type:'spring',stiffness:260,damping:24}}><div className="modal-head"><div><span className="eyebrow">{editing?'REFINE YOUR ROUTINE':'START A NEW ROUTINE'}</span><h2>{editing?'Edit habit':'Create a habit'}</h2></div><button type="button" className="icon-button" onClick={onClose}><Icon name="X"/></button></div><label className="field-label">Habit name<input autoFocus required maxLength="48" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Read 10 pages"/></label><div className="form-two"><label className="field-label">Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="field-label">Daily target<input value={form.target} onChange={e=>setForm({...form,target:e.target.value})} placeholder="20 minutes"/></label></div><label className="field-label">Reminder time<input type="time" value={form.reminder} onChange={e=>setForm({...form,reminder:e.target.value})}/></label><div className="field-label">Repeat on<div className="weekday-picks">{days.map((d,i)=><button type="button" key={d} className={form.schedule.includes(i)?'picked':''} onClick={()=>toggleDay(i)}>{d[0]}</button>)}</div></div><label className="field-label">Accent color<div className="color-picks">{['#a78bfa','#60a5fa','#34d399','#fbbf24','#fb7185','#22d3ee'].map(c=><button type="button" key={c} className={form.color===c?'picked':''} style={{'--swatch':c}} onClick={()=>setForm({...form,color:c})}/>)}</div></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Icon name="Check" size={16}/>{editing?'Save changes':'Create habit'}</button></div></motion.form></motion.div>
}
export default App
