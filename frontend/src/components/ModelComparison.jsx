import { motion } from "framer-motion";
import { Cpu, Zap, Brain } from "lucide-react";

const models = [
  {
    icon: Cpu,
    title: "Baseline RIFE",
    desc: "Standard frame interpolation model trained on generic video datasets.",
    psnr: "32.75 dB",
    ssim: "0.8739",
  },
  {
    icon: Zap,
    title: "Fine-Tuned Model",
    desc: "Model adapted using transfer learning on atmospheric imagery data.",
    psnr: "34.37 dB",
    ssim: "0.8848",
  },
  {
    icon: Brain,
    title: "Custom Motion Loss",
    desc: "Our proposed loss emphasizing deformable motion dynamics.",
    psnr: "34.42 dB",
    ssim: "0.8991",
  },
];

export default function ModelComparison() {
  return (
    <section className="mt-32 w-full max-w-6xl mx-auto px-6">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-3xl font-heading text-center mb-14"
      >
        Model Comparison
      </motion.h2>

      <div className="grid md:grid-cols-3 gap-8">
        {models.map((model, i) => {
          const Icon = model.icon;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="surface p-8 rounded-xl hero-glow text-center hover:scale-[1.02] transition "
            >
              <Icon size={40} className="mx-auto text-accent mb-5" />

              <h3 className="text-xl font-heading mb-3">{model.title}</h3>

              <p className="text-textSecondary text-sm mb-6">{model.desc}</p>

              <div className="flex justify-center gap-8 text-sm">
                <div>
                  <p className="text-textSecondary">PSNR</p>
                  <p className="text-accent font-semibold">{model.psnr}</p>
                </div>

                <div>
                  <p className="text-textSecondary">SSIM</p>
                  <p className="text-accent font-semibold">{model.ssim}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
