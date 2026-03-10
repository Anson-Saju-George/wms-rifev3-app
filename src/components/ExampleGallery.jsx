import { useState } from "react";
import { motion } from "framer-motion";
import VideoCompare from "./VideoCompare";

// import rigidBefore from "../assets/videos/rigid-before.mp4";
// import rigidAfter from "../assets/videos/rigid-after.mp4";

// import deformBefore from "../assets/videos/deform-before.mp4";
// import deformAfter from "../assets/videos/deform-after.mp4";

// import slowBefore from "../assets/videos/slow-before.mp4";
// import slowAfter from "../assets/videos/slow-after.mp4";

// import atmBefore from "../assets/videos/atm-before.mp4";
// import atmAfter from "../assets/videos/atm-after.mp4";

import rigidBefore from "../assets/videos/G.mp4";
import rigidAfter from "../assets/videos/G.mp4";

import deformBefore from "../assets/videos/G.mp4";
import deformAfter from "../assets/videos/G.mp4";

import slowBefore from "../assets/videos/G.mp4";
import slowAfter from "../assets/videos/G.mp4";

import atmBefore from "../assets/videos/G.mp4";
import atmAfter from "../assets/videos/G.mp4";

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
    before: atmBefore,
    after: atmAfter,
  },
};

export default function ExampleGallery() {
  const [active, setActive] = useState("rigid");

  const current = examples[active];

  return (
    <section className="mt-32 w-full max-w-6xl mx-auto px-6">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-3xl font-heading text-center mb-12"
      >
        Interpolation Examples
      </motion.h2>

      {/* Tabs */}

      <div className="flex justify-center gap-4 mb-10 flex-wrap">
        {Object.keys(examples).map((key) => {
          const isActive = active === key;

          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`
px-4 py-2 rounded-lg text-sm transition
${
  isActive
    ? "bg-accent text-black"
    : "border border-secondary text-secondary hover:bg-secondary hover:text-white"
}
`}
            >
              {examples[key].title}
            </button>
          );
        })}
      </div>

      {/* Video */}

      <motion.div
        key={active}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center"
      >
        <VideoCompare before={current.before} after={current.after} />
      </motion.div>
    </section>
  );
}
