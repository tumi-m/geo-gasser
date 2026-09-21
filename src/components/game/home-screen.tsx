import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronDown, Compass, Globe2, MapPin, Settings as SettingsIcon, SlidersHorizontal, Trophy, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsPanel } from "./settings-panel";
import { AtlasPicker } from "./atlas-picker";
import { ModalShell } from "./modal-shell";
import { Tutorial } from "./tutorial";
import { audio, DIFFICULTY_SECONDS, enabledLocations, loadSettings, loadStats, planMatch, saveSettings, sanitizeAtlas, type GameSettings } from "@/lib/game";
import { cn } from "@/lib/utils";

export function HomeScreen() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [stats] = useState(loadStats);
  const [panel, setPanel] = useState<"settings" | "atlas" | "help" | null>(null);
  const plan = planMatch(1, settings.matchLength, settings.atlas);
  useEffect(() => {
    document.documentElement.classList.toggle("hc", settings.highContrast);
    document.documentElement.classList.toggle("reduce-motion", settings.reducedMotion);
    audio.setSettings(settings); saveSettings(settings);
  }, [settings]);
  const play = (to: "/play" | "/duel") => { audio.unlock(); audio.play("click"); void navigate({to}); };
  const choose = (preset: "sa-nl" | "world" | "custom") => {
    if (preset === "custom") { setPanel("atlas"); return; }
    setSettings(s => ({...s, atlas:sanitizeAtlas({preset})}));
  };
  const cards = [
    {id:"sa-nl", name:"South Africa × Netherlands", subtitle:"THE ORIGINAL", src:"/generated/home-cape.jpg", icon:Compass},
    {id:"world", name:"World tour", subtitle:"BEYOND THE FAMILIAR", src:"/locations/loc_100.jpg", icon:Globe2},
    {id:"custom", name:"Your own adventure", subtitle:"COUNTRIES & CITIES", src:"/generated/home-amsterdam.jpg", icon:SlidersHorizontal},
  ] as const;
  return <main className="expedition-home">
    <header className="expedition-nav"><a href="/" className="brand-lockup" aria-label="Atlas Duel home"><Compass size={32} strokeWidth={1.5}/><span>ATLAS<span className="text-accent">DUEL</span></span></a><nav className="flex items-center gap-3 sm:gap-7" aria-label="Main navigation"><button className="nav-link" onClick={()=>setPanel("help")}>How to play</button><Button variant="ghost" size="icon" aria-label="Settings" onClick={()=>setPanel("settings")}><SettingsIcon size={20}/></Button></nav></header>
    <section className="expedition-hero">
      <div className="hero-copy atlas-rise"><p className="eyebrow"><span className="status-dot"/> FOR THE WILDLY CURIOUS</p><h1>A world worth<br/>getting <span className="serif-word">lost in.</span></h1><p className="hero-description">Look around. Follow the clues.<br/>Find your place in the world.</p><div className="hero-actions"><Button size="lg" onClick={()=>play("/play")}>Play solo <ArrowRight size={20}/></Button><Button size="lg" variant="secondary" onClick={()=>play("/duel")}><Users size={18}/> Duel a friend</Button></div>
        <button className="hero-setup" onClick={()=>setPanel("settings")} aria-label="Change game setup"><span>{plan.totalQuestions} places</span><i/><span>{DIFFICULTY_SECONDS[settings.difficulty]}s per guess</span><ChevronDown size={14}/></button>
      </div>
      <div className="hero-collage atlas-rise atlas-rise-2"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="destination-card destination-back"><img src="/generated/home-amsterdam.jpg" alt="Illustrated Amsterdam canals"/><div><span>52.37° N · 4.90° E</span><strong>Amsterdam</strong></div></div><div className="destination-card destination-front"><img src="/generated/home-cape.jpg" alt="Illustrated Cape Town coastline" fetchPriority="high"/><div><span>33.92° S · 18.42° E</span><strong>Somewhere unforgettable.</strong><small>Illustrated destinations</small></div></div><div className="floating-stamp"><MapPin size={24}/><span>DROP A PIN.<br/><strong>Find a feeling.</strong></span></div></div>
    </section>
    <section className="expedition-packs" aria-labelledby="atlas-title"><div className="section-heading"><h2 id="atlas-title">Choose your playground.</h2><button className="nav-link" onClick={()=>setPanel("atlas")}>Explore maps <ArrowRight size={15}/></button></div><div className="pack-grid">{cards.map(card=>{const selected=card.id === "custom" ? !["sa-nl","world"].includes(settings.atlas.preset) : settings.atlas.preset===card.id;return <button className={cn("pack-card",selected&&"is-selected")} key={card.id} aria-pressed={selected} onClick={()=>choose(card.id)}><img src={card.src} alt="" loading="lazy"/><div className="pack-shade"/><div className="pack-top"><span>{card.subtitle}</span><span className="pack-check">{selected?<Check size={16}/>:<card.icon size={16}/>}</span></div><div className="pack-copy"><h3>{card.name}</h3>{selected&&<span>Selected{settings.atlas.cities?.length ? ` · ${settings.atlas.cities.length} cities` : ""}</span>}</div></button>})}</div></section>
    <footer className="expedition-footer"><span><Compass size={16}/>{enabledLocations().length} places. Endless perspective.</span>{stats.matchesPlayed>0?<span><Trophy size={15} className="text-accent"/> Personal best {stats.personalBest.toLocaleString()}</span>:<span>No account. Just curiosity.</span>}</footer>
    {panel==="atlas"&&<ModalShell titleId="atlas-title-modal" onClose={()=>setPanel(null)} wide><div className="flex justify-between items-center mb-6"><h2 id="atlas-title-modal" className="font-display text-2xl">Where to?</h2><Button variant="ghost" size="icon" aria-label="Close maps" onClick={()=>setPanel(null)}><X size={20}/></Button></div><AtlasPicker value={settings.atlas} onChange={atlas=>setSettings({...settings,atlas})}/><Button className="w-full mt-6" onClick={()=>setPanel(null)}>Save map <Check size={18}/></Button></ModalShell>}
    {panel==="settings"&&<SettingsPanel settings={settings} onChange={setSettings} onClose={()=>setPanel(null)}/>}
    {panel==="help"&&<Tutorial onClose={()=>setPanel(null)}/>}
  </main>;
}
