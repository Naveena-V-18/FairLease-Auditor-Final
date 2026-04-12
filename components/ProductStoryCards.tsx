"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, GripHorizontal } from "lucide-react";

type StoryCard = {
  title: string;
  body: string;
};

const STORY_CARDS: StoryCard[] = [
  {
    title: "The Problem",
    body: "Legal leases are designed to be confusing. We use AI to level the playing field for tenants.",
  },
  {
    title: "The Tech",
    body: "Built with Next.js 15, Supabase, and Gemini Pro. We utilize RAG (Retrieval-Augmented Generation) for 99% accuracy.",
  },
  {
    title: "Security",
    body: "Your data is isolated. All audits are encrypted and stored in your private dashboard.",
  },
  {
    title: "The Mission",
    body: "A Final Year project by Naveena V aiming to digitize legal aid for the common citizen.",
  },
];

const SWIPE_CONFIDENCE_THRESHOLD = 12000;

const cardVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 140 : -140,
    opacity: 0,
    rotate: direction > 0 ? 8 : -8,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    rotate: 0,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -160 : 160,
    opacity: 0,
    rotate: direction > 0 ? -10 : 10,
    scale: 0.92,
  }),
};

function swipePower(offset: number, velocity: number) {
  return Math.abs(offset) * velocity;
}

export default function ProductStoryCards() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const activeCard = STORY_CARDS[index];
  const nextCard = STORY_CARDS[(index + 1) % STORY_CARDS.length];
  const nextTwoCard = STORY_CARDS[(index + 2) % STORY_CARDS.length];

  const progressLabel = useMemo(() => `${index + 1}/${STORY_CARDS.length}`, [index]);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setIndex((prev) => (prev + newDirection + STORY_CARDS.length) % STORY_CARDS.length);
  };

  return (
    <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-950 px-6 py-8 md:px-8 md:py-10 shadow-[0_24px_70px_-30px_rgba(2,6,23,0.95)]">
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-[11px] uppercase tracking-[0.18em] font-black text-indigo-300">Product Story</p>
        <h3 className="text-2xl md:text-3xl font-black tracking-tight text-slate-100">Why FairLease Exists</h3>
        <p className="text-slate-400 text-sm md:text-base">Swipe through the stack to understand the problem, engineering choices, and mission.</p>
      </div>

      <div className="relative h-[290px] md:h-[270px]">
        <div className="absolute inset-0 rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl scale-[0.96] translate-y-5" />
        <div className="absolute inset-0 rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl scale-[0.98] translate-y-2" />

        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={index}
            custom={direction}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={(_, info) => {
              const swipe = swipePower(info.offset.x, info.velocity.x);
              if (swipe < -SWIPE_CONFIDENCE_THRESHOLD) {
                paginate(1);
              } else if (swipe > SWIPE_CONFIDENCE_THRESHOLD) {
                paginate(-1);
              }
            }}
            className="absolute inset-0 rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6 md:p-8 cursor-grab active:cursor-grabbing"
          >
            <div className="h-full flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold uppercase tracking-[0.16em]">
                  Story Card {progressLabel}
                </div>
                <h4 className="text-2xl md:text-3xl mt-5 text-slate-100 font-black tracking-tight">{activeCard.title}</h4>
                <p className="text-slate-300 text-base leading-relaxed mt-4 max-w-2xl">{activeCard.body}</p>
              </div>

              <div className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase font-bold tracking-[0.14em]">
                  <GripHorizontal className="w-4 h-4" /> Swipe or click to navigate
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => paginate(-1)}
                    className="h-10 w-10 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors flex items-center justify-center"
                    aria-label="Previous card"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => paginate(1)}
                    className="h-10 w-10 rounded-xl border border-slate-700 bg-indigo-600 text-white hover:bg-indigo-500 transition-colors flex items-center justify-center"
                    aria-label="Next card"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
        {STORY_CARDS.map((card, dotIndex) => (
          <button
            key={card.title}
            type="button"
            onClick={() => {
              const dir = dotIndex > index ? 1 : -1;
              setDirection(dir);
              setIndex(dotIndex);
            }}
            className={`h-1.5 rounded-full transition-all ${dotIndex === index ? "bg-indigo-500" : "bg-slate-700 hover:bg-slate-600"}`}
            aria-label={`Go to ${card.title}`}
          />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-slate-500">Up next: {nextCard.title}, then {nextTwoCard.title}.</p>
    </section>
  );
}
