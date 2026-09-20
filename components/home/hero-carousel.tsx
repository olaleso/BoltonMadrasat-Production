"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

const slides = [
  { image: "/hero/islamic-prayer-hall.jpg", eyebrow: "Qur’an • Arabic • Islamic Studies", title: "Nurturing confident young Muslims", text: "Structured learning, clear progress and strong partnership between teachers and families." },
  { image: "/hero/golden-mosque.jpg", eyebrow: "Faith • Knowledge • Character", title: "Learning with confidence, purpose and joy", text: "A welcoming Madrasah where children grow in Qur’an, Arabic, Islamic knowledge and character." },
  { image: "/hero/islamic-calligraphy.jpg", eyebrow: "Character • Community • Belonging", title: "Growing in faith, manners and belonging", text: "A warm environment that helps children build confidence, good character and a strong connection to their community." },
];

export default function HeroCarousel(){
  const [active,setActive]=useState(0);
  useEffect(()=>{ const t=window.setInterval(()=>setActive(c=>(c+1)%slides.length),7000); return ()=>window.clearInterval(t);},[]);
  const slide=slides[active];
  return <section className="home-hero" aria-label="Madrasah highlights">
    <div key={slide.image} className="home-hero-background" style={{backgroundImage:`url("${slide.image}")`}} aria-hidden="true" />
    <div className="home-hero-overlay" aria-hidden="true" />
    <div className="home-hero-content">
      <small>{slide.eyebrow}</small><h1>{slide.title}</h1><p>{slide.text}</p>
      <div className="home-hero-actions"><Link className="home-btn gold" href="/apply">Apply for admission <ArrowRight size={16}/></Link><Link className="home-btn glass" href="/login">Portal access <ArrowRight size={16}/></Link></div>
      <div className="home-dots" aria-label="Choose slide">{slides.map((_,i)=><button key={i} type="button" onClick={()=>setActive(i)} className={i===active?"active":""} aria-label={`Slide ${i+1}`} aria-pressed={i===active}/>)}</div>
    </div>
    <button type="button" className="home-arrow home-arrow-left" onClick={()=>setActive(c=>(c-1+slides.length)%slides.length)} aria-label="Previous slide"><ArrowLeft size={18}/></button>
    <button type="button" className="home-arrow home-arrow-right" onClick={()=>setActive(c=>(c+1)%slides.length)} aria-label="Next slide"><ArrowRight size={18}/></button>
  </section>;
}
