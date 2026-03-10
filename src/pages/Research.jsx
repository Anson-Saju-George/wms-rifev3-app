import { motion } from "framer-motion";

export default function Research() {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-32 pb-24 space-y-24">
      {/* HERO */}

      <div className="space-y-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-4xl md:text-5xl font-heading leading-tight"
        >
          Domain-Adapted Video Frame Interpolation
          <br />
          for Atmospheric Satellite Imagery
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-textSecondary max-w-2xl mx-auto"
        >
          A motion-aware deep learning framework that adapts modern video frame
          interpolation models to highly deformable atmospheric dynamics such as
          cloud formation, splitting, and merging.
        </motion.p>

        {/* LINKS */}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center gap-4 flex-wrap"
        >
          <a
            href="https://github.com/Anson-Saju-George/wms-rifev3"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 rounded-lg bg-accent text-black font-semibold"
          >
            GitHub
          </a>

          <a
            href="https://huggingface.co/Anson-Saju-George/wms-rifev3"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 rounded-lg border border-secondary text-secondary"
          >
            Model
          </a>

          <a
            href="https://huggingface.co/datasets/Anson-Saju-George/wms_dataset"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 rounded-lg border border-secondary text-secondary"
          >
            Dataset
          </a>
        </motion.div>
      </div>

      {/* CONTRIBUTIONS */}

      <div className="space-y-6">
        <h2 className="text-2xl font-heading">Key Contributions</h2>

        <ul className="grid md:grid-cols-3 gap-6 text-textSecondary">
          <li className="surface rounded-xl p-6 hero-glow">
            Domain adaptation of the RIFE architecture for atmospheric satellite
            imagery with highly deformable cloud dynamics.
          </li>

          <li className="surface rounded-xl p-6 hero-glow">
            Motion-weighted loss formulation that prioritizes regions with high
            optical flow magnitude.
          </li>

          <li className="surface rounded-xl p-6 hero-glow">
            Creation of a high-resolution satellite interpolation dataset for
            evaluating scientific video reconstruction.
          </li>
        </ul>
      </div>

      {/* PROBLEM */}

      <div className="space-y-6">
        <h2 className="text-2xl font-heading">Problem</h2>

        <p className="text-textSecondary max-w-3xl">
          Most video frame interpolation models are trained on datasets
          containing rigid objects and everyday scenes. Atmospheric satellite
          imagery presents a significant domain shift, where cloud structures
          exhibit highly deformable motion including merging, splitting, and
          structural evolution.
        </p>

        <p className="text-textSecondary max-w-3xl">
          Applying generic interpolation models directly to such data often
          produces severe artifacts including ghosting, blurring, and structural
          distortions in cloud formations.
        </p>
      </div>

      {/* METHOD */}

      <div className="space-y-6">
        <h2 className="text-2xl font-heading">Proposed Method</h2>

        <p className="text-textSecondary max-w-3xl">
          The proposed framework adapts the RIFE architecture through
          domain-specific fine-tuning. The model estimates intermediate optical
          flow between frames, warps the inputs, and synthesizes an intermediate
          frame representing the predicted temporal state.
        </p>

        <p className="text-textSecondary max-w-3xl">
          To better capture complex cloud motion, the training objective
          incorporates a motion-aware weighting strategy that emphasizes regions
          with significant temporal change.
        </p>
      </div>

      {/* CUSTOM LOSS */}

      <div className="space-y-6">
        <h2 className="text-2xl font-heading">Motion-Weighted Loss</h2>

        <p className="text-textSecondary max-w-3xl">
          Traditional reconstruction losses treat all pixels equally.
          Atmospheric imagery however contains large static regions such as
          ocean backgrounds alongside rapidly evolving cloud structures.
        </p>

        <p className="text-textSecondary max-w-3xl">
          The proposed loss applies weights derived from optical flow magnitude,
          encouraging the model to prioritize high-motion regions during
          optimization.
        </p>
      </div>

      {/* DATASET */}

      <div className="space-y-6">
        <h2 className="text-2xl font-heading">Dataset</h2>

        <p className="text-textSecondary max-w-3xl">
          The WMS dataset consists of high-resolution atmospheric satellite
          imagery ranging from 2K to 4K resolution capturing diverse weather
          systems including convective clouds, frontal systems, and stratiform
          layers.
        </p>

        <p className="text-textSecondary max-w-3xl">
          Frames were cropped into 256×256 and 512×512 patches for efficient
          training while preserving detailed cloud structures.
        </p>
      </div>

      {/* RESULTS */}

      <div className="space-y-6">
        <h2 className="text-2xl font-heading">Results</h2>

        <div className="surface rounded-xl p-8 hero-glow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-textSecondary border-b border-secondary/30">
              <tr>
                <th className="text-left py-2">Model</th>
                <th className="text-left py-2">PSNR ↑</th>
                <th className="text-left py-2">SSIM ↑</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-secondary/20">
              <tr>
                <td className="py-2">Baseline RIFE</td>
                <td>32.753</td>
                <td>0.8739</td>
              </tr>

              <tr>
                <td className="py-2">Fine-tuned (L1)</td>
                <td>34.373</td>
                <td>0.8848</td>
              </tr>

              <tr className="font-semibold text-accent">
                <td className="py-2">Fine-tuned (Custom Loss)</td>
                <td>34.423</td>
                <td>0.8991</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-textSecondary max-w-3xl">
          Domain adaptation significantly improves interpolation quality,
          confirming the importance of training video interpolation models on
          domain-specific scientific imagery.
        </p>
      </div>

      {/* APPLICATIONS */}

      <div className="space-y-6">
        <h2 className="text-2xl font-heading">Applications</h2>

        <ul className="list-disc pl-6 text-textSecondary space-y-2 max-w-3xl">
          <li>Satellite weather nowcasting</li>
          <li>Cloud motion analysis</li>
          <li>Atmospheric flow visualization</li>
          <li>Scientific video reconstruction</li>
          <li>Temporal super-resolution for geophysical imagery</li>
        </ul>
      </div>

      {/* CITATION */}

      <div className="space-y-6">
        <h2 className="text-2xl font-heading">Citation</h2>

        <pre className="surface rounded-xl p-6 text-sm overflow-x-auto">
          {`@inproceedings{huang2022rife,
title={Real-Time Intermediate Flow Estimation for Video Frame Interpolation},
author={Huang, Zhewei and Zhang, Tianyuan and Heng, Wen and Shi, Boxin and Zhou, Shuchang},
booktitle={European Conference on Computer Vision},
year={2022}
}`}
        </pre>
      </div>
    </section>
  );
}
