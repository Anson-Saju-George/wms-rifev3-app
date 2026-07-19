import { motion } from "framer-motion";
import { Github, Database, Cpu, Activity, Layers, Target, Microscope } from "lucide-react";

export default function Research() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <section className="max-w-7xl mx-auto px-6 pt-32 pb-24 space-y-32">
      
      {/* HERO SECTION */}
      <div className="space-y-8 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-block px-4 py-1.5 rounded-full border border-accent/30 bg-accent/5 text-accent text-xs font-bold tracking-widest uppercase mb-4"
        >
          Scientific Publication
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl font-heading leading-tight"
        >
          Domain-Adapted VFI for 
          <span className="text-accent block">Atmospheric Satellite Imagery</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-textSecondary text-lg leading-relaxed"
        >
          A motion-aware deep learning framework that adapts RIFE architectures 
          to capture complex, non-rigid cloud dynamics like merging, splitting, and disintegration.
        </motion.p>

        {/* HERO CONSISTENT BUTTONS */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center gap-6 flex-wrap pt-4"
        >
          <a
            href="https://github.com/Anson-Saju-George/wms-rifev3"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent text-black px-8 py-3 rounded-lg flex items-center gap-2 font-bold hover:scale-105 transition shadow-[0_0_20px_rgba(134,245,247,0.3)]"
          >
            <Github size={18} />
            GitHub Code
          </a>

          <a
            href="https://huggingface.co/Anson-Saju-George/wms-rifev3"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-secondary text-secondary px-8 py-3 rounded-lg hover:bg-secondary hover:text-white transition flex items-center gap-2 font-semibold"
          >
            <Layers size={18} />
            Model Weights
          </a>

          <a
            href="https://huggingface.co/datasets/Anson-Saju-George/wms_dataset"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-secondary text-secondary px-8 py-3 rounded-lg hover:bg-secondary hover:text-white transition flex items-center gap-2 font-semibold"
          >
            <Database size={18} />
            94GB Dataset
          </a>
        </motion.div>
      </div>

      {/* ABSTRACT BENTO GRID */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid md:grid-cols-3 gap-8"
      >
        <motion.div variants={itemVariants} className="surface p-8 rounded-2xl hero-glow border border-white/5 space-y-4">
          <Target className="text-accent" size={32} />
          <h3 className="text-xl font-heading">The Problem</h3>
          <p className="text-sm text-textSecondary leading-relaxed">
            Generic VFI models (RIFE, DAIN) assume rigid motion. Satellite imagery features "deformable" 
            motion where clouds change shape, combine, and disintegrate, causing catastrophic artifacts 
            in standard models.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="surface p-8 rounded-2xl hero-glow border border-white/5 space-y-4">
          <Microscope className="text-accent" size={32} />
          <h3 className="text-xl font-heading">The Methodology</h3>
          <p className="text-sm text-textSecondary leading-relaxed">
            We employ a two-step transfer learning approach: initializing with weights from 
            Vimeo-90K, then fine-tuning on our WMS dataset using a custom Cloud-Aware loss function.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="surface p-8 rounded-2xl hero-glow border border-white/5 space-y-4">
          <Activity className="text-accent" size={32} />
          <h3 className="text-xl font-heading">The Impact</h3>
          <p className="text-sm text-textSecondary leading-relaxed">
            Achieved a significant 1.67 dB PSNR gain over baseline RIFE. The model provides 
            physically consistent interpolations for nowcasting and intense weather analysis.
          </p>
        </motion.div>
      </motion.div>

      {/* TECHNICAL FORMULATION */}
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <h2 className="text-3xl font-heading">Motion-Weighted Loss</h2>
          <p className="text-textSecondary">
            Traditional L1/L2 losses treat all pixels equally. In satellite imagery, an ocean pixel 
            is static while cloud pixels evolve rapidly. Our solution introduces a 
            <span className="text-white font-semibold"> Spatial Weight Mask (W)</span>.
          </p>
          <div className="surface p-6 rounded-xl border-l-4 border-accent bg-accent/5">
            <code className="text-accent text-lg">
              Loss = Σ (W * |I_pred - I_gt|)
            </code>
            <p className="text-xs text-textSecondary mt-4">
              Where W assigns higher weights to regions with high optical flow magnitude, 
              forcing the network to prioritize active atmospheric motion.
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="surface p-8 rounded-2xl hero-glow border border-white/5"
        >
          <h3 className="text-xl font-heading mb-6 flex items-center gap-2">
            <Cpu size={20} className="text-accent" />
            Hardware Environment
          </h3>
          <ul className="space-y-4 text-sm">
            <li className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-textSecondary">GPU</span>
              <span className="text-white font-mono">NVIDIA RTX 5080 (16GB VRAM)</span>
            </li>
            <li className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-textSecondary">Framework</span>
              <span className="text-white font-mono">PyTorch / RIFE / Anaconda</span>
            </li>
            <li className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-textSecondary">Training</span>
              <span className="text-white font-mono">10 Epochs / Adaptive LR</span>
            </li>
            <li className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-textSecondary">Dataset Size</span>
              <span className="text-white font-mono">94 GB (Cleaned)</span>
            </li>
          </ul>
        </motion.div>
      </div>

      {/* QUANTITATIVE RESULTS TABLE */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-heading">Benchmark Analysis</h2>
          <p className="text-textSecondary">Evaluated on the WMS_Cleaned test set</p>
        </div>

        <div className="surface rounded-2xl p-8 hero-glow border border-white/5 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-textSecondary border-b border-white/10">
                <th className="pb-4 font-heading font-normal">Model Configuration</th>
                <th className="pb-4 font-heading font-normal">Pre-trained</th>
                <th className="pb-4 font-heading font-normal">PSNR (dB) ↑</th>
                <th className="pb-4 font-heading font-normal">SSIM ↑</th>
                <th className="pb-4 font-heading font-normal">Delta</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-white/5">
                <td className="py-6">Model 1 (Generic Baseline)</td>
                <td>Vimeo-90K</td>
                <td>32.753</td>
                <td>0.8739</td>
                <td className="text-textSecondary">--</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-6">Model 2 (Fine-tuned L1)</td>
                <td>WMS Dataset</td>
                <td>34.373</td>
                <td>0.8848</td>
                <td className="text-accent">+1.62 dB</td>
              </tr>
              <tr className="bg-accent/5">
                <td className="py-6 pl-4 font-bold text-white">Model 3 (Custom Motion Loss)</td>
                <td className="font-semibold">WMS Dataset</td>
                <td className="font-bold text-accent text-lg">34.423</td>
                <td className="font-bold text-accent text-lg">0.8991</td>
                <td className="text-accent font-bold">+1.67 dB</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CITATION */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="space-y-6"
      >
        <h2 className="text-2xl font-heading text-center">Reference & Citation</h2>
        <div className="relative">
          <pre className="surface rounded-xl p-8 text-xs font-mono text-accent/80 overflow-x-auto border border-accent/20 leading-relaxed">
            {`@inproceedings{george2025wmsrife,
  title={Domain-Adapted Video Frame Interpolation for Atmospheric Satellite Imagery},
  author={Anson Saju George and T. Jemima Jebaseeli},
  institution={Karunya Institute of Technology & Sciences},
  year={2025},
  url={https://github.com/Anson-Saju-George/wms-rifev3}
}`}
          </pre>
          <div className="absolute top-4 right-4 text-[10px] text-accent font-bold uppercase tracking-widest bg-accent/10 px-2 py-1 rounded">
            BibTeX
          </div>
        </div>
      </motion.div>

    </section>
  );
}