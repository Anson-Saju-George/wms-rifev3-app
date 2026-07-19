import { useState } from "react";
import { motion } from "framer-motion";
import VideoCompare from "./VideoCompare";


// Logic and imports remain untouched
import rigidBefore from "../assets/videos/rigid/original.mp4";
import rigidAfter from "../assets/videos/rigid/interpolated.mp4";

import deformBefore from "../assets/videos/deform/original.mp4";
import deformAfter from "../assets/videos/deform/interpolated.mp4";

import slowBefore from "../assets/videos/slowmo/original.mp4";
import slowAfter from "../assets/videos/slowmo/interpolated.mp4";

import atmosBefore from "../assets/videos/atmos/original.mp4";
import atmosAfter from "../assets/videos/atmos/interpolated.mp4";

const examples = {
  rigid: {
    title: "Rigid Motion",
    before: rigidBefore,
    after: rigidAfter,
  },
  deform: {
    title: "Deformable Motion",
    before: deformBefore,
    after: deformAfter,
  },
  slow: {
    title: "Slow Motion",
    before: slowBefore,
    after: slowAfter,
  },
  atm: {
    title: "Atmospheric Imagery",
    before: atmosBefore,
    after: atmosAfter,
  },
};

export default function ExampleGallery() {
  const [active, setActive] = useState("rigid");

  const current = examples[active];

  return (
    <section className="mt-32 w-full max-w-6xl mx-auto px-6">
      {/* Updated Title Animation to match Hero/Research style */}
      <motion.h2
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-3xl font-heading text-center mb-12"
      >
        Interpolation Examples
      </motion.h2>

      {/* Tabs - Refined for consistency */}
      <div className="flex justify-center gap-4 mb-12 flex-wrap">
        {Object.keys(examples).map((key) => {
          const isActive = active === key;

          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`
                px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300
                ${
                  isActive
                    ? "bg-accent text-black scale-105 shadow-[0_0_20px_rgba(134,245,247,0.2)]"
                    : "border border-secondary/40 text-secondary hover:border-secondary hover:text-white"
                }
              `}
            >
              {examples[key].title}
            </button>
          );
        })}
      </div>

      {/* Video Transition */}
      <motion.div
        key={active}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center"
      >
        <VideoCompare before={current.before} after={current.after} />
      </motion.div>
    </section>
  );
}