const fs = require('fs');
const path = require('path');

const compDir = 'C:/Users/Furqan/Desktop/PeakPalsWebsite/src/components';

// 1. Header.jsx
const headerJsx = `import React, { useState, useEffect } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';

export default function Header({ activeTab, setActiveTab, onOpenContact }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-4 sm:py-5 pointer-events-none transition-all duration-300">
      <nav className={\`pointer-events-auto max-w-4xl w-full flex items-center justify-between px-6 py-2.5 rounded-full transition-all duration-300 \${
        scrolled 
          ? 'bg-black/85 backdrop-blur-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.5)]' 
          : 'bg-black/60 backdrop-blur-lg border border-white/10 shadow-xl'
      }\`}>
        {/* Brand Logo */}
        <button 
          onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-2 focus:outline-none group cursor-pointer"
        >
          <img
            src="/assets/images/ChatGPT_Image_Jan_28__2026__09_33_04_PM-removebg-preview.png"
            alt="BePeak Logo"
            className="h-7 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </button>

        {/* Center Nav Links */}
        <div className="flex items-center gap-8 text-xs sm:text-sm font-medium">
          <button
            onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={\`transition-all duration-200 cursor-pointer \${
              activeTab === 'home' 
                ? 'text-white font-bold' 
                : 'text-white/60 hover:text-white'
            }\`}
          >
            Home
          </button>
          <button
            onClick={() => { setActiveTab('about'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={\`transition-all duration-200 cursor-pointer \${
              activeTab === 'about' 
                ? 'text-white font-bold' 
                : 'text-white/60 hover:text-white'
            }\`}
          >
            About
          </button>
        </div>

        {/* Contact CTA */}
        <button
          onClick={onOpenContact}
          className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white text-xs sm:text-sm font-bold px-5 py-2 rounded-full transition-all duration-200 shadow-md shadow-[#539E28]/25 flex items-center gap-1 cursor-pointer"
        >
          <span>Contact Us</span>
        </button>
      </nav>
    </header>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'Header.jsx'), headerJsx);

// 2. HeroSection.jsx
const heroSectionJsx = `import React, { useState } from 'react';
import { Star, ArrowUpRight, CheckCircle } from '@phosphor-icons/react';

export default function HeroSection({ onOpenContact }) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onOpenContact) onOpenContact(email);
  };

  return (
    <section className="relative min-h-[95vh] sm:min-h-screen flex items-center justify-center overflow-hidden bg-black pt-28 pb-20 px-4 sm:px-6">
      {/* Background Video / GIF with Depth */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <img
          src="/assets/images/hero-banner.gif"
          alt="Raghav Budhraja Fitness"
          className="w-full h-full object-cover object-center opacity-40 filter brightness-95 contrast-110 scale-[1.01]"
          onError={(e) => {
            e.currentTarget.src = '/assets/images/21ab67_edb2ccff9b534a1f885eeb8871134c4a_mv2.gif';
          }}
        />
        {/* Layered Vignette for Maximum Editorial Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
        {/* Status Chip */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md text-xs font-semibold text-white/90 mb-8 tracking-wide">
          <span className="size-2 rounded-full bg-[#539E28] animate-pulse" />
          <span>India’s Most Personalized 1-on-1 Fitness Program</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.12] sm:leading-[1.1] mb-8 font-sans">
          Lose 5–7kg in 28 days, cut belly fat and <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#62b531] to-[#8fe05d]">improve health</span> (300+ wins)
        </h1>

        {/* Premium Input Bar */}
        <form 
          onSubmit={handleSubmit}
          className="w-full max-w-xl flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl sm:rounded-full bg-white/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 mb-8 transition-all focus-within:ring-4 focus-within:ring-[#539E28]/20 focus-within:border-[#539E28]"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Write your email"
            className="w-full sm:flex-1 px-5 py-3 sm:py-2.5 rounded-full text-black placeholder-neutral-500 text-sm sm:text-base focus:outline-none bg-transparent font-medium"
            required
          />
          <button
            type="submit"
            className="w-full sm:w-auto bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-extrabold text-sm sm:text-base px-8 py-3 rounded-full transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#539E28]/35 shrink-0 cursor-pointer"
          >
            <span>See My Program Now</span>
            <ArrowUpRight size={18} weight="bold" />
          </button>
        </form>

        {/* 5-Star Reviews Badge */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
          <div className="flex text-amber-400 gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={15} weight="fill" />
            ))}
          </div>
          <span className="text-xs sm:text-sm font-semibold text-white/90 tracking-wide">
            4.8 out of 100+ reviews
          </span>
        </div>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'HeroSection.jsx'), heroSectionJsx);

// 3. Transformations.jsx
const transformationsJsx = `import React, { useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

const slides = [
  {
    id: 1,
    img: '/assets/images/21ab67_1edc50d9f1f0418f975a4e0b98c85ff4_mv2.png',
    label: 'Aakanksha, Geetesh, Sophia'
  },
  {
    id: 2,
    img: '/assets/images/21ab67_9de1c2b28d3f463589d885413b6aa829_mv2.png',
    label: 'Ishita, Jai, Sophia'
  }
];

export default function Transformations({ onOpenContact }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="bg-white text-black py-20 sm:py-28 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        {/* Slideshow Showcase with High-End Elevation */}
        <div className="relative w-full rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-neutral-200/80 mb-12 group bg-white">
          <img
            src={slides[currentSlide].img}
            alt={slides[currentSlide].label}
            className="w-full h-auto object-contain transition-all duration-500"
          />

          {/* Sleek Floating Navigation Buttons */}
          <button
            onClick={prevSlide}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 size-11 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg cursor-pointer active:scale-95"
          >
            <CaretLeft size={22} weight="bold" />
          </button>
          <button
            onClick={nextSlide}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 size-11 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg cursor-pointer active:scale-95"
          >
            <CaretRight size={22} weight="bold" />
          </button>

          {/* Indicator Pills */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                aria-label={\`Go to slide \${i + 1}\`}
                className={\`size-2.5 rounded-full transition-all duration-300 cursor-pointer \${
                  currentSlide === i ? 'bg-[#539E28] w-7' : 'bg-white/60 hover:bg-white'
                }\`}
              />
            ))}
          </div>
        </div>

        {/* Wide Green CTA Button */}
        <button
          onClick={onOpenContact}
          className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-extrabold text-base sm:text-lg px-16 py-4 rounded-full transition-all duration-200 shadow-xl shadow-[#539E28]/30 cursor-pointer hover:shadow-2xl hover:-translate-y-0.5"
        >
          Contact Now
        </button>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'Transformations.jsx'), transformationsJsx);

// 4. MagazineBanner.jsx
const magazineBannerJsx = `import React from 'react';

export default function MagazineBanner() {
  return (
    <section className="bg-[#050505] text-white py-24 sm:py-32 px-4 text-center border-t border-b border-white/10 relative overflow-hidden">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {/* Magazine Quote */}
        <p className="italic text-xl sm:text-3xl text-neutral-200 font-light max-w-2xl mb-2 font-serif leading-relaxed">
          “So personalized, Bepeak feels like cheating”
        </p>
        <p className="text-xs sm:text-sm text-neutral-400 font-medium tracking-widest uppercase mb-10">
          – US Times Magazine
        </p>

        {/* Main Headline */}
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
          Bepeak : India’s #1
          <br /> One-On-One Fitness Program
        </h2>

        {/* Slots Badge */}
        <div className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-white/[0.06] border border-white/15 backdrop-blur-md">
          <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm sm:text-base font-semibold text-neutral-200 tracking-wide">
            6 Slots till 28 Feb. Join Now.
          </span>
        </div>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'MagazineBanner.jsx'), magazineBannerJsx);

// 5. PlanCards.jsx
const planCardsJsx = `import React from 'react';

export default function PlanCards({ onOpenContact }) {
  return (
    <section className="bg-white text-black py-20 sm:py-28 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 items-stretch">
        {/* DIET PLAN CARD */}
        <div 
          onClick={onOpenContact}
          className="cursor-pointer rounded-3xl overflow-hidden shadow-[0_15px_45px_rgba(0,0,0,0.06)] hover:shadow-[0_25px_60px_rgba(0,0,0,0.12)] hover:-translate-y-1.5 transition-all duration-300 border border-neutral-200/80 bg-white flex flex-col group"
        >
          <img
            src="/assets/images/Frame_48096216.png"
            alt="Raghav Budhraja Diet Plan"
            className="w-full h-full object-contain group-hover:scale-[1.01] transition-transform duration-300"
          />
        </div>

        {/* WORKOUT PLAN CARD */}
        <div 
          onClick={onOpenContact}
          className="cursor-pointer rounded-3xl overflow-hidden shadow-[0_15px_45px_rgba(0,0,0,0.06)] hover:shadow-[0_25px_60px_rgba(0,0,0,0.12)] hover:-translate-y-1.5 transition-all duration-300 border border-neutral-200/80 bg-white flex flex-col group"
        >
          <img
            src="/assets/images/Frame_48096216__1_.png"
            alt="Raghav Budhraja Workout Plan"
            className="w-full h-full object-contain group-hover:scale-[1.01] transition-transform duration-300"
            onError={(e) => {
              e.currentTarget.src = '/assets/images/Frame%2048096216%20(1).png';
            }}
          />
        </div>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'PlanCards.jsx'), planCardsJsx);

// 6. ConsistencySection.jsx
const consistencySectionJsx = `import React from 'react';

const posters = [
  {
    title: 'Order In Guide',
    img: '/assets/images/order_in_guide.png'
  },
  {
    title: 'Veg Diet Options',
    img: '/assets/images/vegan_plan.png'
  },
  {
    title: 'Therapy Sessions',
    img: '/assets/images/1.png'
  },
  {
    title: 'Dessert Swaps',
    img: '/assets/images/dessert_swaps2_1.png'
  },
  {
    title: 'PCOS Reversal',
    img: '/assets/images/pcos.png'
  },
  {
    title: 'Curated Grocery List',
    img: '/assets/images/grocery_list.png'
  }
];

export default function ConsistencySection({ onOpenContact }) {
  return (
    <section className="bg-[#fafafa] text-black py-20 sm:py-32 px-4 sm:px-6 border-t border-neutral-200/60">
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
        {/* Eyebrow */}
        <span className="text-xs font-bold tracking-widest text-[#539E28] uppercase mb-3">
          SYSTEMS FOR LIFELONG RESULTS
        </span>

        {/* Headings */}
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-neutral-900 mb-4 max-w-3xl leading-tight">
          How 100% Stay Consistent at Peakpals
        </h2>
        <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mb-16 font-medium leading-relaxed">
          Beyond diet and workout, PeakPals solves all your problems from grocery lists to therapy, routine fixes & everything below
        </p>

        {/* 6 Posters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 w-full mb-16">
          {posters.map((item, idx) => (
            <div 
              key={idx}
              className="rounded-3xl overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] hover:-translate-y-2 transition-all duration-300 border border-neutral-200/80 bg-white group cursor-pointer"
              onClick={onOpenContact}
            >
              <img
                src={item.img}
                alt={item.title}
                className="w-full h-auto object-contain group-hover:scale-[1.02] transition-transform duration-300"
              />
            </div>
          ))}
        </div>

        {/* Green CTA Button */}
        <button
          onClick={onOpenContact}
          className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-extrabold text-base sm:text-lg px-14 py-4 rounded-full transition-all duration-200 shadow-xl shadow-[#539E28]/30 cursor-pointer hover:shadow-2xl hover:-translate-y-0.5"
        >
          View The Full Plan
        </button>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'ConsistencySection.jsx'), consistencySectionJsx);

// 7. CoachingPrograms.jsx
const coachingProgramsJsx = `import React from 'react';

const coachingCards = [
  {
    title: 'Nutritionist-Led Cooking Prep',
    img: '/assets/images/21ab67_06c38f7435f9460ab48a96916027a4ba_mv2.png'
  },
  {
    title: 'Clear Skin & Acne Fix',
    img: '/assets/images/21ab67_a14413f812a7453d934727cef37cb3a0_mv2.png'
  },
  {
    title: 'Gut Reset Program',
    img: '/assets/images/21ab67_302bf5ac92b54da1b84f9adfb9e12c90_mv2.png'
  },
  {
    title: 'Sleep & Routine Fix',
    img: '/assets/images/21ab67_88c8289d013a46a289db11498d3e419a_mv2.png'
  },
  {
    title: 'Testosterone & Energy fix',
    img: '/assets/images/21ab67_df0c692082824255bb69234c67d5a076_mv2.png'
  },
  {
    title: 'Hair Care',
    img: '/assets/images/21ab67_de9d6333db6243ed9936b82efdbc1d58_mv2.png'
  }
];

export default function CoachingPrograms({ onOpenContact }) {
  return (
    <section className="bg-white text-black py-20 sm:py-32 px-4 sm:px-6 border-t border-neutral-200/60">
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
        {/* Eyebrow */}
        <span className="text-xs font-bold tracking-widest text-[#539E28] uppercase mb-3">
          SPECIALTY COACHING MODULES
        </span>

        {/* Heading */}
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 max-w-3xl mb-16 leading-tight">
          Designed by India’s best coaches, solving what others miss skin, sleep, hormones, lifestyle, habits, and more.
        </h2>

        {/* 6 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 w-full mb-16">
          {coachingCards.map((card, idx) => (
            <div 
              key={idx}
              className="rounded-3xl overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] hover:-translate-y-2 transition-all duration-300 border border-neutral-200/80 bg-white group cursor-pointer"
              onClick={onOpenContact}
            >
              <img
                src={card.img}
                alt={card.title}
                className="w-full h-auto object-contain group-hover:scale-[1.02] transition-transform duration-300"
              />
            </div>
          ))}
        </div>

        {/* Green CTA Button */}
        <button
          onClick={onOpenContact}
          className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-extrabold text-base sm:text-lg px-12 py-4 rounded-full transition-all duration-200 shadow-xl shadow-[#539E28]/30 cursor-pointer hover:shadow-2xl hover:-translate-y-0.5"
        >
          Join Now & Save Rs 10,000
        </button>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'CoachingPrograms.jsx'), coachingProgramsJsx);

// 8. PerformersCollage.jsx
const performersCollageJsx = `import React from 'react';

export default function PerformersCollage({ onOpenContact }) {
  return (
    <section className="bg-white text-black py-24 sm:py-32 px-4 sm:px-6 relative overflow-hidden border-t border-neutral-200/60">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 sm:gap-16">
        {/* Left Side Client Collage */}
        <div className="w-full md:w-1/3 flex justify-center">
          <img
            src="/assets/images/21ab67_036d4a8bbc904ce4b5e2bfccb689f536_mv2.png"
            alt="Client transformations left"
            className="w-full max-w-sm object-contain rounded-2xl drop-shadow-md"
            onError={(e) => {
              e.currentTarget.src = '/assets/images/Frame_48095863.png';
            }}
          />
        </div>

        {/* Center Text Block */}
        <div className="w-full md:w-1/3 text-center flex flex-col items-center">
          <span className="text-xs font-bold tracking-widest text-[#539E28] uppercase mb-3">
            VERIFIED SUCCESS STORIES
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-neutral-900 mb-4 leading-tight">
            300+ Peak Performers Transformed
          </h2>
          <p className="text-base sm:text-lg text-neutral-600 font-medium mb-10 leading-relaxed">
            From a totally different Life, you're a tap away
          </p>
          <button
            onClick={onOpenContact}
            className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-extrabold text-base sm:text-lg px-12 py-4 rounded-full transition-all duration-200 shadow-xl shadow-[#539E28]/30 cursor-pointer hover:shadow-2xl hover:-translate-y-0.5"
          >
            Contact Us
          </button>
        </div>

        {/* Right Side Client Collage */}
        <div className="w-full md:w-1/3 flex justify-center">
          <img
            src="/assets/images/21ab67_036d4a8bbc904ce4b5e2bfccb689f536_mv2.png"
            alt="Client transformations right"
            className="w-full max-w-sm object-contain rounded-2xl drop-shadow-md scale-x-[-1]"
            onError={(e) => {
              e.currentTarget.src = '/assets/images/Frame_48095865.png';
            }}
          />
        </div>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'PerformersCollage.jsx'), performersCollageJsx);

console.log('Super-premium component enhancements written successfully.');
