const fs = require('fs');
const path = require('path');

const root = 'C:/Users/Furqan/Desktop/PeakPalsWebsite';
const compDir = path.join(root, 'src/components');
if (!fs.existsSync(compDir)) fs.mkdirSync(compDir, { recursive: true });

// 1. Header.jsx
const headerJsx = `import React from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';

export default function Header({ activeTab, setActiveTab, onOpenContact }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-4 sm:py-5 pointer-events-none">
      <nav className="pointer-events-auto max-w-4xl w-full flex items-center justify-between px-6 py-2.5 rounded-full bg-black/75 backdrop-blur-xl border border-white/10 shadow-2xl transition-all">
        {/* Brand Logo */}
        <button 
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2.5 focus:outline-none group"
        >
          <img
            src="/assets/images/ChatGPT_Image_Jan_28__2026__09_33_04_PM-removebg-preview.png"
            alt="BePeak Logo"
            className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span className="font-extrabold text-lg tracking-tight text-white font-sans">
            B<span className="text-[#539E28]">3</span>P<span className="text-[#539E28]">Λ</span>AK
          </span>
        </button>

        {/* Center Links */}
        <div className="flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('home')}
            className={\`transition-colors \${activeTab === 'home' ? 'text-white font-semibold' : 'text-white/70 hover:text-white'}\`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={\`transition-colors \${activeTab === 'about' ? 'text-white font-semibold' : 'text-white/70 hover:text-white'}\`}
          >
            About
          </button>
        </div>

        {/* Contact CTA */}
        <button
          onClick={onOpenContact}
          className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white text-xs sm:text-sm font-semibold px-5 py-2 rounded-full transition-all shadow-md shadow-[#539E28]/20 flex items-center gap-1.5"
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
import { Star, ArrowUpRight } from '@phosphor-icons/react';

export default function HeroSection({ onOpenContact }) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onOpenContact) onOpenContact(email);
  };

  return (
    <section className="relative min-h-[92vh] sm:min-h-screen flex items-center justify-center overflow-hidden bg-black pt-24 pb-16 px-4">
      {/* Hero Looping Video / Animated GIF Background */}
      <div className="absolute inset-0 z-0">
        <img
          src="/assets/images/hero-banner.gif"
          alt="Raghav Budhraja Fitness"
          className="w-full h-full object-cover object-center opacity-45 filter brightness-90 contrast-110"
          onError={(e) => {
            // Fallback to low-res gif if high-res fails
            e.currentTarget.src = '/assets/images/21ab67_edb2ccff9b534a1f885eeb8871134c4a_mv2.gif';
          }}
        />
        {/* Cinematic Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
      </div>

      {/* Hero Foreground Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
        {/* Main Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.18] sm:leading-[1.15] mb-8">
          Lose 5–7kg in 28 days, cut belly fat and improve health (300+ wins)
        </h1>

        {/* Input Bar */}
        <form 
          onSubmit={handleSubmit}
          className="w-full max-w-xl flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl sm:rounded-full bg-white/95 backdrop-blur-md shadow-2xl border border-white/20 mb-6"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Write your email"
            className="w-full sm:flex-1 px-5 py-3 sm:py-2.5 rounded-full text-black placeholder-neutral-500 text-sm sm:text-base focus:outline-none bg-transparent"
            required
          />
          <button
            type="submit"
            className="w-full sm:w-auto bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-bold text-sm sm:text-base px-7 py-3 sm:py-3 rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#539E28]/30 shrink-0"
          >
            <span>See My Program Now</span>
            <ArrowUpRight size={18} weight="bold" />
          </button>
        </form>

        {/* 5-Star Reviews Badge */}
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-white/90">
          <div className="flex text-amber-400 gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={16} weight="fill" />
            ))}
          </div>
          <span>4.8 out of 100+ reviews</span>
        </div>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'HeroSection.jsx'), heroSectionJsx);

// 3. Transformations.jsx
const transformationsJsx = `import React from 'react';

const clients = [
  {
    name: 'Aakanksha',
    flag: '🇮🇳',
    desc: 'Dropping 10kg in 7 weeks-no pills, no crazy restrictions.',
    img: '/assets/images/Frame_48095863.png'
  },
  {
    name: 'Geetesh',
    flag: '🇮🇳',
    desc: \"It's like having a coach in your pocket. Peakpals kept me consistent\",
    img: '/assets/images/Frame_48095864.png'
  },
  {
    name: 'Sophia',
    flag: '🇬🇧',
    desc: 'Finally lost belly fat, sharper jawline w/o any guesswork.',
    img: '/assets/images/Frame_48095865.png'
  }
];

export default function Transformations({ onOpenContact }) {
  return (
    <section className="bg-white text-black py-16 sm:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col items-center">
        {/* Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full mb-12">
          {clients.map((c, i) => (
            <div 
              key={i}
              className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-neutral-100 flex flex-col group"
            >
              {/* Photo Area */}
              <div className="w-full aspect-[4/3] overflow-hidden bg-neutral-100">
                <img
                  src={c.img}
                  alt={c.name}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Text Info */}
              <div className="p-5 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-1.5 mb-2">
                    {c.name} <span>{c.flag}</span>
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed">
                    {c.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Wide Green CTA Button */}
        <button
          onClick={onOpenContact}
          className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-bold text-base sm:text-lg px-14 py-3.5 rounded-full transition-all shadow-lg shadow-[#539E28]/30"
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
    <section className="bg-black text-white py-20 sm:py-24 px-4 text-center border-t border-b border-white/10 relative overflow-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Magazine Quote */}
        <p className="italic text-lg sm:text-2xl text-neutral-300 font-light mb-1">
          “So personalized, Bepeak feels like cheating”
        </p>
        <p className="text-sm sm:text-base text-neutral-400 mb-8 font-medium">
          –US Times Magazine
        </p>

        {/* Main Headline */}
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
          Bepeak : India’s #1
          <br className="hidden sm:block" /> One-On-One Fitness Program
        </h2>

        {/* Slots Subtitle */}
        <p className="text-base sm:text-xl text-neutral-300 font-medium">
          6 Slots till 28 Feb. Join Now.
        </p>
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
    <section className="bg-white text-black py-16 sm:py-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* DIET PLAN CARD (Light Green) */}
        <div 
          onClick={onOpenContact}
          className="cursor-pointer bg-[#e8f5e9] border border-[#c8e6c9] rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div>
            <div className="text-center mb-6">
              <span className="text-xs font-black tracking-widest text-neutral-800 uppercase">
                PΞΛKPALS
              </span>
            </div>

            {/* Header with Title and Raghav Portrait */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-neutral-300/60 mb-6">
              <div>
                <p className="text-xs font-bold text-neutral-700 tracking-wide uppercase">RAGHAV BUDHRAJA</p>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-[#2e7d32]">DIET PLAN</h3>
              </div>
              <div className="size-16 rounded-full overflow-hidden border-2 border-white shadow-md shrink-0 bg-neutral-200">
                <img
                  src="/assets/images/WhatsApp_Image_2025-05-15_at_11_13_38_PM-Photoroom_1.png"
                  alt="Raghav Budhraja"
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    e.currentTarget.src = '/assets/images/Cambridge__UCL__Warwick__et__2__1.png';
                  }}
                />
              </div>
            </div>

            {/* Bullets */}
            <ul className="space-y-3.5 text-neutral-800 text-sm sm:text-base font-medium">
              <li className="flex items-start gap-2.5">
                <span className="size-2 rounded-full bg-black shrink-0 mt-2" />
                <span>For your unique needs, goals & tastes.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="size-2 rounded-full bg-black shrink-0 mt-2" />
                <span>No confusion. No starving. No supplements.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="size-2 rounded-full bg-black shrink-0 mt-2" />
                <span>90% lost 3–5kg in just 2 weeks.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* WORKOUT PLAN CARD (Light Pink) */}
        <div 
          onClick={onOpenContact}
          className="cursor-pointer bg-[#fdebee] border border-[#ffcdd2] rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div>
            <div className="text-center mb-6">
              <span className="text-xs font-black tracking-widest text-neutral-800 uppercase">
                PΞΛKPALS
              </span>
            </div>

            {/* Header with Title and Raghav Portrait */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-neutral-300/60 mb-6">
              <div>
                <p className="text-xs font-bold text-neutral-700 tracking-wide uppercase">RAGHAV BUDHRAJA</p>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-[#c62828]">WORKOUT PLAN</h3>
              </div>
              <div className="size-16 rounded-full overflow-hidden border-2 border-white shadow-md shrink-0 bg-neutral-200">
                <img
                  src="/assets/images/WhatsApp_Image_2025-05-15_at_11_13_38_PM-Photoroom_1.png"
                  alt="Raghav Budhraja"
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    e.currentTarget.src = '/assets/images/Cambridge__UCL__Warwick__et__2__1.png';
                  }}
                />
              </div>
            </div>

            {/* Bullets */}
            <ul className="space-y-3.5 text-neutral-800 text-sm sm:text-base font-medium">
              <li className="flex items-start gap-2.5">
                <span className="size-2 rounded-full bg-black shrink-0 mt-2" />
                <span>Get exact sets, reps & form. No guesswork.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="size-2 rounded-full bg-black shrink-0 mt-2" />
                <span>Tone up, burn belly fat & sharpen jawline.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="size-2 rounded-full bg-black shrink-0 mt-2" />
                <span>80% built lean muscle & defined core.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'PlanCards.jsx'), planCardsJsx);

// 6. ConsistencySection.jsx
const consistencySectionJsx = `import React from 'react';

const consistencyItems = [
  {
    title: 'Order In Guide',
    sub: 'Exact orders from food delivery apps',
    img: '/assets/images/order_in_guide.png'
  },
  {
    title: 'Veg Diet Options',
    sub: 'Available for fat loss & muscle',
    img: '/assets/images/vegan_plan.png'
  },
  {
    title: 'Therapy Sessions',
    sub: \"Peakpals' therapist helps fix mindsets, not just diet\",
    img: '/assets/images/Frame_1.png'
  },
  {
    title: 'Dessert Swaps',
    sub: 'For zero cravings',
    img: '/assets/images/dessert_swaps2_1.png'
  },
  {
    title: 'PCOS Reversal',
    sub: 'Fix hormones with diet & lifestyle',
    img: '/assets/images/pcos.png'
  },
  {
    title: 'Curated Grocery List',
    sub: 'Erasing confusion with every visit',
    img: '/assets/images/grocery_list.png'
  }
];

export default function ConsistencySection({ onOpenContact }) {
  return (
    <section className="bg-white text-black py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
        {/* Main Headings */}
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 mb-4">
          How 100% Stay Consistent at Peakpals
        </h2>
        <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mb-12 font-medium">
          Beyond diet and workout, PeakPals solves all your problems from grocery lists to therapy, routine fixes & everything below
        </p>

        {/* 6 Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full mb-12">
          {consistencyItems.map((item, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 border border-neutral-100 flex flex-col group text-center p-6 bg-gradient-to-b from-neutral-50/50 to-white"
            >
              <div className="mb-2">
                <span className="text-[10px] font-black tracking-widest text-neutral-400 uppercase">
                  PΞΛKPALS
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-neutral-900 mb-1">
                {item.title}
              </h3>
              <p className="text-xs text-neutral-500 font-medium mb-6">
                {item.sub}
              </p>

              <div className="w-full aspect-square rounded-2xl overflow-hidden bg-neutral-100 flex items-center justify-center p-2">
                <img
                  src={item.img}
                  alt={item.title}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    // Fallback to frame if direct name differs
                    e.currentTarget.src = '/assets/images/Frame_48095764.png';
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Green CTA Button */}
        <button
          onClick={onOpenContact}
          className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-bold text-base sm:text-lg px-12 py-3.5 rounded-full transition-all shadow-lg shadow-[#539E28]/30"
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

const coachingGuides = [
  {
    title: 'Nutritionist-Led Cooking Prep',
    img: '/assets/images/Frame_48095905.png'
  },
  {
    title: 'Clear Skin & Acne Fix',
    img: '/assets/images/Frame_48095906.png'
  },
  {
    title: 'Gut Reset Program',
    img: '/assets/images/Frame_48095907.png'
  },
  {
    title: 'Sleep & Routine Fix',
    img: '/assets/images/Frame_48095909.png'
  },
  {
    title: 'Testosterone & Energy fix',
    img: '/assets/images/Frame_48095910.png'
  },
  {
    title: 'Hair Care',
    img: '/assets/images/Frame_48095913.png'
  }
];

export default function CoachingPrograms({ onOpenContact }) {
  return (
    <section className="bg-white text-black py-16 sm:py-24 px-4 sm:px-6 border-t border-neutral-100">
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
        {/* Main Heading */}
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 max-w-3xl mb-12">
          Designed by India’s best coaches, solving what others miss skin, sleep, hormones, lifestyle, habits, and more.
        </h2>

        {/* 6 Cards Grid with bottom price badge */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 w-full mb-12">
          {coachingGuides.map((guide, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-neutral-100 flex flex-col group"
            >
              {/* Card Body with image & title */}
              <div className="p-6 pb-4 flex flex-col items-center text-center flex-1">
                <span className="text-[10px] font-black tracking-widest text-neutral-400 uppercase mb-2">
                  PΞΛKPALS
                </span>
                <h3 className="text-lg font-extrabold text-neutral-900 mb-4 min-h-[50px] flex items-center justify-center">
                  {guide.title}
                </h3>
                <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100 flex items-center justify-center">
                  <img
                    src={guide.img}
                    alt={guide.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.src = '/assets/images/Frame_48095764.png';
                    }}
                  />
                </div>
              </div>

              {/* Bottom Price Tag: ₹2,500 ₹0 */}
              <div className="bg-black text-white px-6 py-4 flex items-center justify-between font-sans">
                <span className="text-sm sm:text-base text-neutral-400 line-through font-semibold">
                  ₹2,500
                </span>
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1">
                  ₹0
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Green CTA Button */}
        <button
          onClick={onOpenContact}
          className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-bold text-base sm:text-lg px-10 py-3.5 rounded-full transition-all shadow-lg shadow-[#539E28]/30"
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
    <section className="bg-white text-black py-20 sm:py-28 px-4 sm:px-6 relative overflow-hidden border-t border-neutral-100">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
        {/* Left Side Client Collage */}
        <div className="w-full md:w-1/3 flex justify-center">
          <img
            src="/assets/images/21ab67_036d4a8bbc904ce4b5e2bfccb689f536_mv2.png"
            alt="Client transformations left"
            className="w-full max-w-sm object-contain rounded-2xl"
            onError={(e) => {
              e.currentTarget.src = '/assets/images/Frame_48095863.png';
            }}
          />
        </div>

        {/* Center Text Block */}
        <div className="w-full md:w-1/3 text-center flex flex-col items-center">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-neutral-900 mb-4">
            300+ Peak Performers Transformed
          </h2>
          <p className="text-base sm:text-lg text-neutral-600 font-medium mb-8">
            From a totally different Life, you're a tap away
          </p>
          <button
            onClick={onOpenContact}
            className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-bold text-base sm:text-lg px-10 py-3.5 rounded-full transition-all shadow-lg shadow-[#539E28]/30"
          >
            Contact Us
          </button>
        </div>

        {/* Right Side Client Collage */}
        <div className="w-full md:w-1/3 flex justify-center">
          <img
            src="/assets/images/21ab67_036d4a8bbc904ce4b5e2bfccb689f536_mv2.png"
            alt="Client transformations right"
            className="w-full max-w-sm object-contain rounded-2xl scale-x-[-1]"
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

// 9. AboutPage.jsx
const aboutPageJsx = `import React from 'react';

export default function AboutPage({ onOpenContact }) {
  return (
    <div className="min-h-screen bg-white text-black pt-28 pb-20 px-4 sm:px-6 font-sans">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Outlined Heading */}
        <h1 className="text-6xl sm:text-8xl font-black tracking-widest text-transparent uppercase mb-10"
            style={{ WebkitTextStroke: '2px #539E28' }}>
          ABOUT
        </h1>

        {/* Story Card */}
        <div className="w-full bg-[#f1f8f3] rounded-3xl p-6 sm:p-12 border border-[#d2e8d7] shadow-sm mb-12">
          <span className="text-xs font-black tracking-widest text-[#539E28] uppercase mb-2 block">
            WELCOME
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 mb-6">
            The Story Behind
          </h2>

          <p className="text-base sm:text-lg text-neutral-700 font-medium max-w-2xl mx-auto mb-8">
            Hi, I’m Raghav Budhraja, Founder @PeakPals. 33% Of School Kids In New Delhi Are Obese, I Was One Of Them.
          </p>

          {/* Photo 1: Childhood */}
          <div className="w-full max-w-md mx-auto aspect-[4/3] rounded-2xl overflow-hidden shadow-md mb-8 bg-neutral-200">
            <img
              src="/assets/images/Cambridge__UCL__Warwick__et__2__1.png"
              alt="Raghav childhood"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/assets/images/Frame_48095764.png';
              }}
            />
          </div>

          <p className="text-base sm:text-lg text-neutral-700 font-medium max-w-2xl mx-auto mb-4">
            I Grew Obese But Dreamt To Be A Footballer. Tried Everything But Nothing Worked.
          </p>
          <p className="text-base sm:text-lg text-neutral-700 font-medium max-w-2xl mx-auto mb-8">
            All Changed When I Met With Right Mentor, Lost Weight Played Pro, But Broke Both My Knees In 2 Years & Left College.
          </p>

          {/* Photos 2 & 3: Crutches & Mentor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-md bg-neutral-200">
              <img
                src="/assets/images/Screenshot_2023-12-17_at_12_42_3__1_.png"
                alt="Raghav football"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/assets/images/Frame_48095863.png';
                }}
              />
            </div>
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-md bg-neutral-200">
              <img
                src="/assets/images/Screenshot_2023-12-17_at_12_43_4__1_.png"
                alt="Raghav injury"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/assets/images/Frame_48095864.png';
                }}
              />
            </div>
          </div>

          <p className="text-base sm:text-lg text-neutral-700 font-medium max-w-2xl mx-auto mb-8">
            Later, I Started Investing, And After 2 Years My Option Turnover Was 3Cr. But Lost It All & Was Depressed.
          </p>

          {/* Photo 4: Working on myself */}
          <div className="w-full max-w-xs mx-auto aspect-square rounded-2xl overflow-hidden shadow-md mb-8 bg-neutral-200">
            <img
              src="/assets/images/Screenshot_2023-12-17_at_4_10_1.png"
              alt="Raghav journey"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/assets/images/WhatsApp_Image_2025-05-15_at_11_13_38_PM-Photoroom_1.png';
              }}
            />
          </div>

          <p className="text-base sm:text-lg text-neutral-800 font-semibold max-w-xl mx-auto mb-2">
            The Only Thing That Kept Me Going Was Working On Myself,
            All In (At Peak) And Being With Right People (Pals)
          </p>
          <p className="text-lg sm:text-xl text-[#539E28] font-black uppercase">
            That's Why PEAKPALS.
          </p>
        </div>

        {/* Join Now Button */}
        <button
          onClick={onOpenContact}
          className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-black text-lg px-12 py-3.5 rounded-full transition-all shadow-lg shadow-[#539E28]/30 mb-14 uppercase"
        >
          JOIN NOW
        </button>

        {/* Vision Banner */}
        <div className="max-w-2xl mx-auto mb-12">
          <p className="text-xl sm:text-2xl text-neutral-800 font-medium mb-3">
            Imagine a world where every GenZ is performing at their peak to create a new future, together!
          </p>
          <p className="text-lg sm:text-xl font-black text-black">
            <span className="bg-black text-white px-3 py-1 rounded-lg mr-2 uppercase tracking-widest text-sm">PΞΛKPALS</span>
            IS MAKING THAT A REALITY.
          </p>
        </div>

        {/* Referral Box */}
        <div className="w-full max-w-2xl bg-neutral-50 rounded-3xl p-8 sm:p-10 border-2 border-black flex flex-col items-center">
          <p className="text-lg sm:text-xl font-bold text-neutral-900 mb-6">
            We’re Peak - Pals, If you get a Pal, and join our 2 - month program you both will get 1 month FREE (equals to 7,000 Rs off)
          </p>
          <a
            href="https://wa.me/919958092012?text=Hey%20Raghav!%20I%20want%20to%20refer%20my%20friend%20for%20PeakPals!"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-extrabold text-sm sm:text-base px-8 py-3.5 rounded-full transition-all shadow-md shadow-[#539E28]/20 uppercase"
          >
            SHARE WITH YOUR PAL
          </a>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'AboutPage.jsx'), aboutPageJsx);

// 10. ContactPage.jsx
const contactPageJsx = `import React, { useState } from 'react';
import { WhatsappLogo, PaperPlaneRight, CheckCircle } from '@phosphor-icons/react';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white text-black pt-28 pb-20 px-4 sm:px-6 font-sans">
      <div className="max-w-2xl mx-auto flex flex-col items-center">
        {/* Outlined Heading */}
        <h1 className="text-5xl sm:text-7xl font-black tracking-widest text-transparent uppercase mb-8 text-center"
            style={{ WebkitTextStroke: '2px #539E28' }}>
          CONTACT US
        </h1>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 mb-8 text-center">
          Send Us a Message
        </h2>

        {/* Message Form matching Screenshot */}
        {submitted ? (
          <div className="w-full bg-[#f1f8f3] border border-[#d2e8d7] rounded-3xl p-8 text-center shadow-md mb-16">
            <CheckCircle size={48} weight="fill" className="text-[#539E28] mx-auto mb-3" />
            <h3 className="text-2xl font-bold text-neutral-900 mb-2">Message Sent!</h3>
            <p className="text-neutral-600 mb-4">Raghav and the PeakPals team will get back to you via WhatsApp or Email within 24 hours.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-sm font-semibold text-[#539E28] hover:underline"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-4 mb-16">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
              <label className="sm:col-span-1 text-sm font-bold text-neutral-800">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="sm:col-span-3 border border-neutral-300 rounded-lg px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#539E28] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
              <label className="sm:col-span-1 text-sm font-bold text-neutral-800">Phone No.</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="sm:col-span-3 border border-neutral-300 rounded-lg px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#539E28] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
              <label className="sm:col-span-1 text-sm font-bold text-neutral-800">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="sm:col-span-3 border border-neutral-300 rounded-lg px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#539E28] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2">
              <label className="sm:col-span-1 text-sm font-bold text-neutral-800 pt-2">Message</label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="sm:col-span-3 border border-neutral-300 rounded-lg px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#539E28] transition-colors resize-none"
              />
            </div>

            <div className="flex justify-center pt-4">
              <button
                type="submit"
                className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-bold text-base px-10 py-2.5 rounded-full transition-all shadow-md shadow-[#539E28]/20"
              >
                Send Now
              </button>
            </div>
          </form>
        )}

        {/* WhatsApp Direct Section */}
        <div className="w-full text-center flex flex-col items-center pt-8 border-t border-neutral-200">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 mb-6">
            Or Whatsapp To Ask Anything
          </h3>

          <div className="w-32 h-32 mb-6">
            <img
              src="/assets/images/Or_Whatsapp_To_Ask_Anything.png"
              alt="WhatsApp avatar"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = '/assets/images/Frame_48096216.png';
              }}
            />
          </div>

          <a
            href="https://wa.me/919958092012?text=Hi%20Raghav!%20I%20have%20a%20question%20about%20the%20PeakPals%20program."
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-bold text-base px-10 py-3 rounded-full transition-all shadow-md shadow-[#539E28]/20 flex items-center gap-2"
          >
            <WhatsappLogo size={22} weight="fill" />
            <span>Whatsapp Us</span>
          </a>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'ContactPage.jsx'), contactPageJsx);

// 11. Footer.jsx
const footerJsx = `import React from 'react';
import { Phone, EnvelopeSimple, MapPin, LinkedinLogo, InstagramLogo } from '@phosphor-icons/react';

export default function Footer({ setActiveTab, onOpenContact }) {
  return (
    <footer className="bg-black text-white py-16 px-6 sm:px-12 border-t border-white/10 font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand Column */}
        <div className="flex flex-col items-start gap-4">
          <div className="flex items-center gap-2">
            <img
              src="/assets/images/ChatGPT_Image_Jan_28__2026__09_33_04_PM-removebg-preview.png"
              alt="BePeak Logo"
              className="h-8 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="font-extrabold text-xl tracking-tight text-white">
              B<span className="text-[#539E28]">3</span>P<span className="text-[#539E28]">Λ</span>AK
            </span>
          </div>

          <div className="flex items-center gap-3 mt-4 text-white/80">
            <a
              href="https://www.linkedin.com/in/raghav-budhraja/"
              target="_blank"
              rel="noopener noreferrer"
              className="size-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#539E28] hover:text-white transition-all"
            >
              <LinkedinLogo size={18} weight="fill" />
            </a>
            <a
              href="https://www.instagram.com/bepeak.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="size-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#539E28] hover:text-white transition-all"
            >
              <InstagramLogo size={18} weight="fill" />
            </a>
          </div>
        </div>

        {/* Nav Links */}
        <div className="flex flex-col gap-3 text-sm font-medium">
          <button
            onClick={() => { setActiveTab('about'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="text-left text-neutral-400 hover:text-white transition-colors"
          >
            About
          </button>
          <button
            onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="text-left text-neutral-400 hover:text-white transition-colors"
          >
            Home
          </button>
          <button
            onClick={onOpenContact}
            className="text-left text-neutral-400 hover:text-white transition-colors"
          >
            Contact
          </button>
        </div>

        {/* Contact Info */}
        <div className="md:col-span-2 flex flex-col gap-3 text-sm text-neutral-400 font-medium">
          <div className="flex items-center gap-3">
            <Phone size={16} className="text-[#539E28] shrink-0" />
            <a href="tel:+919958092012" className="hover:text-white transition-colors">+91 9958092012</a>
          </div>
          <div className="flex items-center gap-3">
            <EnvelopeSimple size={16} className="text-[#539E28] shrink-0" />
            <a href="mailto:raghav@peakpals.in" className="hover:text-white transition-colors">raghav@peakpals.in</a>
          </div>
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-[#539E28] shrink-0 mt-0.5" />
            <span>C-2, Sector-1, Noida, Uttar Pradesh – 201301</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-white/10 text-xs text-neutral-500 text-center">
        © {new Date().getFullYear()} BePeak (PeakPals). All rights reserved.
      </div>
    </footer>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'Footer.jsx'), footerJsx);

// 12. WhatsAppFloating.jsx
const whatsAppFloatingJsx = `import React from 'react';
import { WhatsappLogo } from '@phosphor-icons/react';

export default function WhatsAppFloating() {
  return (
    <a
      href="https://wa.me/919958092012?text=Hi%20Raghav!%20I%20want%20to%20learn%20more%20about%20the%20PeakPals%20program."
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform"
    >
      <WhatsappLogo size={32} weight="fill" />
    </a>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'WhatsAppFloating.jsx'), whatsAppFloatingJsx);

// 13. App.jsx
const appJsx = `import React, { useState } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import Transformations from './components/Transformations';
import MagazineBanner from './components/MagazineBanner';
import PlanCards from './components/PlanCards';
import ConsistencySection from './components/ConsistencySection';
import CoachingPrograms from './components/CoachingPrograms';
import PerformersCollage from './components/PerformersCollage';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import Footer from './components/Footer';
import WhatsAppFloating from './components/WhatsAppFloating';
import { X, CheckCircle } from '@phosphor-icons/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [modalOpen, setModalOpen] = useState(false);
  const [initialEmail, setInitialEmail] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleOpenContact = (email = '') => {
    if (typeof email === 'string' && email.includes('@')) {
      setInitialEmail(email);
    }
    setFormSubmitted(false);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#539E28] selection:text-white">
      {/* Fixed Header */}
      <Header 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }} 
        onOpenContact={() => handleOpenContact()}
      />

      {/* Main Views */}
      {activeTab === 'home' && (
        <main>
          <HeroSection onOpenContact={handleOpenContact} />
          <Transformations onOpenContact={() => handleOpenContact('Client Transformations')} />
          <MagazineBanner />
          <PlanCards onOpenContact={() => handleOpenContact('Diet & Workout Plans')} />
          <ConsistencySection onOpenContact={() => handleOpenContact('Full Consistency Plan')} />
          <CoachingPrograms onOpenContact={() => handleOpenContact('Specialty Coaching Guides')} />
          <PerformersCollage onOpenContact={() => handleOpenContact('Peak Performers Program')} />
        </main>
      )}

      {activeTab === 'about' && (
        <AboutPage onOpenContact={() => handleOpenContact('About Page Join')} />
      )}

      {activeTab === 'contact' && (
        <ContactPage />
      )}

      {/* Footer & Floating WhatsApp */}
      <Footer 
        setActiveTab={setActiveTab} 
        onOpenContact={() => setActiveTab('contact')} 
      />
      <WhatsAppFloating />

      {/* Interactive Contact Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-white text-black rounded-3xl p-6 sm:p-8 shadow-2xl border border-neutral-200">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-black transition-colors"
            >
              <X size={24} weight="bold" />
            </button>

            {formSubmitted ? (
              <div className="text-center py-6">
                <CheckCircle size={48} weight="fill" className="text-[#539E28] mx-auto mb-3" />
                <h3 className="text-2xl font-bold mb-2 text-neutral-900">Application Received!</h3>
                <p className="text-sm text-neutral-600 mb-6">
                  Raghav will review your fitness goals and message you directly on WhatsApp.
                </p>
                <button
                  onClick={() => setModalOpen(false)}
                  className="bg-[#539E28] text-white font-bold text-sm px-6 py-2.5 rounded-full hover:bg-[#468722] transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-2xl font-black text-neutral-900 mb-2">Join BePeak Program</h3>
                <p className="text-xs sm:text-sm text-neutral-500 mb-6">
                  6 slots left till 28 Feb. Fill your details to get your personalized diet & workout plan.
                </p>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFormSubmitted(true);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aryan Sharma"
                      className="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#539E28]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">WhatsApp Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      className="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#539E28]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      defaultValue={initialEmail}
                      required
                      placeholder="name@example.com"
                      className="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#539E28]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#539E28] hover:bg-[#468722] text-white font-bold text-base py-3 rounded-full transition-all shadow-lg shadow-[#539E28]/30 mt-2"
                  >
                    Submit Application
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
`;
fs.writeFileSync(path.join(root, 'src/App.jsx'), appJsx);

console.log('All React components written successfully.');
