import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

import VideoCompare from "../components/VideoCompare";
import Pipeline from "../components/Pipeline";
import ExampleGallery from "../components/ExampleGallery";
import LiveDemo from "../components/LiveDemo";
import ModelComparison from "../components/ModelComparison";

import beforeVideo from "../assets/videos/G.mp4";
import afterVideo from "../assets/videos/G.mp4";

export default function Hero() {
  const navigate = useNavigate();

  const scrollToDemo = () => {
    const el = document.getElementById("demo");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="min-h-screen flex flex-col items-center pt-12">

      {/* Title */}

      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-5xl font-heading text-primary text-center leading-tight"
      >
        Motion-Aware AI
        <br />
        Video Frame Interpolation
      </motion.h1>

      {/* Subtitle */}

      <motion.p
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="font-heading text-center max-w-xl"
      >
        Handling both rigid motion and complex deformable dynamics through
        domain-adaptive deep learning.
      </motion.p>

      {/* Comparison */}

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="mt-12 w-full flex justify-center"
      >
        <VideoCompare before={beforeVideo} after={afterVideo} />
      </motion.div>

      {/* CTA */}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="flex gap-6 mt-10"
      >
        <button
          onClick={scrollToDemo}
          className="bg-accent text-black px-6 py-3 rounded-lg flex items-center gap-2 font-semibold hover:scale-105 transition"
        >
          <Play size={18} />
          Try Live Demo
        </button>

        <button
          onClick={() => navigate("/research")}
          className="border border-secondary text-secondary px-6 py-3 rounded-lg hover:bg-secondary hover:text-white transition"
        >
          Explore Research
        </button>
      </motion.div>

      {/* Sections */}

      <Pipeline />

      <ModelComparison />

      <ExampleGallery />

      <div id="demo" className="w-full">
        <LiveDemo />
      </div>

    </section>
  );
}