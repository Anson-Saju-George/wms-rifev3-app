import { motion } from "framer-motion";
import { Layers, Cpu, GitBranch, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Layers,
    title: "Input Frames",
    desc: "Two consecutive frames from the original video are provided as input.",
  },
  {
    icon: GitBranch,
    title: "Motion Estimation",
    desc: "The neural network estimates intermediate optical flow between frames.",
  },
  {
    icon: Cpu,
    title: "Frame Synthesis",
    desc: "The model synthesizes a new intermediate frame using learned motion representations.",
  },
  {
    icon: Sparkles,
    title: "Interpolated Output",
    desc: "A smooth intermediate frame is generated, increasing the video frame rate.",
  },
];

export default function Pipeline() {
  return (
    <section className="mt-32 w-full max-w-6xl mx-auto px-6">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-3xl font-heading text-center mb-14"
      >
        How Neural Frame Interpolation Works
      </motion.h2>

      <div className="grid md:grid-cols-4 gap-8">
        {steps.map((step, i) => {
          const Icon = step.icon;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="surface p-6 rounded-xl hero-glow text-center"
            >
              <Icon size={36} className="mx-auto text-accent mb-4" />

              <h3 className="font-heading text-lg mb-2">{step.title}</h3>

              <p className="text-textSecondary text-sm">{step.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
