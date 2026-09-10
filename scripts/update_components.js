const fs = require('fs');
const path = require('path');

const compDir = 'C:/Users/Furqan/Desktop/PeakPalsWebsite/src/components';

// 1. Transformations.jsx - Slideshow with slide 1 and slide 2
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
    <section className="bg-white text-black py-16 sm:py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        {/* Slideshow Container */}
        <div className="relative w-full rounded-2xl overflow-hidden shadow-xl border border-neutral-100 mb-10 group">
          <img
            src={slides[currentSlide].img}
            alt={slides[currentSlide].label}
            className="w-full h-auto object-contain transition-all duration-500"
          />

          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <CaretLeft size={22} weight="bold" />
          </button>
          <button
            onClick={nextSlide}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <CaretRight size={22} weight="bold" />
          </button>

          {/* Slide Indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                aria-label={\`Go to slide \${i + 1}\`}
                className={\`size-2.5 rounded-full transition-all \${currentSlide === i ? 'bg-[#539E28] w-6' : 'bg-black/30 hover:bg-black/50'}\`}
              />
            ))}
          </div>
        </div>

        {/* Wide Green CTA Button matching live site */}
        <button
          onClick={onOpenContact}
          className="bg-[#539E28] hover:bg-[#468722] active:scale-95 text-white font-bold text-base sm:text-lg px-16 py-3.5 rounded-full transition-all shadow-lg shadow-[#539E28]/30"
        >
          Contact Now
        </button>
      </div>
    </section>
  );
}
`;
fs.writeFileSync(path.join(compDir, 'Transformations.jsx'), transformationsJsx);

// 2. PlanCards.jsx - Clean side-by-side Diet & Workout plan images
const planCardsJsx = `import React from 'react';

export default function PlanCards({ onOpenContact }) {
  return (
    <section className="bg-white text-black py-16 sm:py-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center">
        {/* DIET PLAN CARD */}
        <div 
          onClick={onOpenContact}
          className="cursor-pointer rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 border border-neutral-100"
        >
          <img
            src="/assets/images/Frame_48096216.png"
            alt="Raghav Budhraja Diet Plan"
            className="w-full h-auto object-contain"
          />
        </div>

        {/* WORKOUT PLAN CARD */}
        <div 
          onClick={onOpenContact}
          className="cursor-pointer rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 border border-neutral-100"
        >
          <img
            src="/assets/images/Frame_48096216__1_.png"
            alt="Raghav Budhraja Workout Plan"
            className="w-full h-auto object-contain"
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

// 3. ConsistencySection.jsx - 6 Posters matching live site
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
    <section className="bg-white text-black py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 mb-4">
          How 100% Stay Consistent at Peakpals
        </h2>
        <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mb-12 font-medium">
          Beyond diet and workout, PeakPals solves all your problems from grocery lists to therapy, routine fixes & everything below
        </p>

        {/* 6 Posters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 w-full mb-12">
          {posters.map((item, idx) => (
            <div 
              key={idx}
              className="rounded-2xl overflow-hidden shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-neutral-100 bg-white"
            >
              <img
                src={item.img}
                alt={item.title}
                className="w-full h-auto object-contain"
              />
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

// 4. CoachingPrograms.jsx - 6 Coaching Guide Cards with price tags matching live site
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
    <section className="bg-white text-black py-16 sm:py-24 px-4 sm:px-6 border-t border-neutral-100">
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 max-w-3xl mb-12">
          Designed by India’s best coaches, solving what others miss skin, sleep, hormones, lifestyle, habits, and more.
        </h2>

        {/* 6 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 w-full mb-12">
          {coachingCards.map((card, idx) => (
            <div 
              key={idx}
              className="rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-neutral-100 bg-white"
            >
              <img
                src={card.img}
                alt={card.title}
                className="w-full h-auto object-contain"
              />
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

console.log('Components updated with exact live site graphics.');
