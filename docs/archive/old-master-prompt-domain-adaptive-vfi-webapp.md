# 🔥 MASTER PROMPT — Domain-Adaptive Motion-Aware VFI Web Application

---

## 🎯 Objective

Build a **production-grade research demonstration web application** for a domain-adapted **Video Frame Interpolation (VFI)** framework based on RIFE.

This project demonstrates:

- Generic VFI performance (rigid motion: objects, scenes, normal videos)
- Domain-adapted VFI for deformable motion (clouds, atmospheric imagery)
- A custom motion-weighted loss for complex non-rigid dynamics

This is both:

- A scientific research demo
- A general-purpose interpolation web app

Generate a full professional React application using:

- Vite
- TypeScript
- TailwindCSS

The result must look like a research lab product — not a hobby project.

---

# 🔹 Core Narrative

The application must clearly explain:

1. What is Video Frame Interpolation?
2. Why generic models struggle with deformable motion
3. Difference between rigid and non-rigid motion
4. Domain shift problem
5. Transfer learning solution
6. Custom motion-aware loss design
7. Quantitative + qualitative improvements
8. Live demo capability

The tone must be:

- Educational
- Technically credible
- Research-grade

---

# 🔹 Use Case Positioning

The app must show support for:

- 🎬 Consumer videos (rigid motion)
- 🌪 Atmospheric videos (deformable motion)
- 🎥 Slow motion generation
- 📈 Temporal super-resolution
- 🔬 Scientific analysis

Do NOT position as satellite-only.

Correct positioning:

> Motion-aware Video Frame Interpolation for both rigid and deformable dynamics.

---

# 🔹 Application Structure

---

## 1️⃣ Landing Page

### Hero

**Title:**  
Motion-Aware AI Video Frame Interpolation

**Subtitle:**  
Handling both rigid objects and complex deformable motion through domain-adaptive learning.

### Include:

- Side-by-side video comparison slider
- Rigid motion example
- Deformable motion example
- CTA button → “Try Live Demo”

---

## 2️⃣ Motion Types Explainer

Visual section explaining:

### Rigid Motion

- Cars
- People
- Objects

### Deformable Motion

- Clouds
- Smoke
- Fluids

Explain why deformable motion is harder:

- Shape-changing structures
- Non-linear displacement
- Occlusions
- Merging / splitting patterns

Include diagrams + concise technical descriptions.

---

## 3️⃣ Research & Model Section

Explain:

- Baseline RIFE model
- Fine-tuned domain-adapted model
- Custom motion-weighted loss
- Transfer learning pipeline

Display:

- PSNR comparison
- SSIM comparison
- Baseline vs fine-tuned visuals
- Artifact reduction examples
- Optional training curve placeholders

Include external links:

- GitHub repository
- Hugging Face model
- Hugging Face dataset
- Research paper PDF

---

## 4️⃣ Showcase Gallery

Pre-rendered video examples grouped by:

- Generic rigid motion
- Atmospheric deformable motion
- Slow-motion enhancement
- Before / After comparisons

Features:

- Synchronized playback
- Comparison slider
- Toggle model versions

---

## 5️⃣ Live GPU Demo Section

Must include:

- MP4 upload
- Interpolation factor selector (2×, 4×, 8×)
- Estimated processing time
- Real-time GPU availability
- Queue position display
- Live job status polling
- Animated progress bar
- Cancel job option
- Download result button

---

# 🔹 GPU Capacity System

Concurrency rules:

- 2× → max 4 jobs
- 4× → max 2 jobs
- 8× → max 1 job

Frontend must display:

- GPU load indicator:
  - 🟢 Low
  - 🟡 Medium
  - 🔴 High
- Queue position
- Estimated wait time
- Warning when selecting 8×

---

# 🔹 Time Estimation Model

Multipliers:

- 2× → 7× real-time
- 4× → 12× real-time
- 8× → 25× real-time

Formula:

Estimated time = video_length_seconds × multiplier

Display as:

- Minutes
- Seconds
- Human-friendly format

---

# 🔹 UI / UX Requirements

- Dark mode default
- Scientific but modern theme
- Smooth animations
- Clean typography
- GPU live pulse indicator
- Animated transitions
- Responsive design
- Professional dashboard aesthetic

---

# 🔹 Tech Stack

- React (Vite)
- TypeScript
- TailwindCSS
- Framer Motion
- Axios
- React Router
- Zustand or Context API
- Modular folder structure

---

# 🔹 Backend API Assumptions

### POST `/api/upload`

### GET `/api/status/{job_id}`

### GET `/api/gpu_status`

### POST `/api/cancel/{job_id}`

Example `gpu_status` response:

```json
{
  "active_jobs": 2,
  "max_capacity": 4,
  "queue_length": 3,
  "load_state": "medium"
}
```

---

# 🔹 Deliverables Required

Generate:

- Complete project structure
- All core pages
- Component architecture
- API layer
- State management
- GPU indicator component
- Comparison slider component
- Live demo page
- Research page
- Showcase gallery
- Tailwind configuration
- Example environment setup
- Local run instructions

The output must be production-ready and suitable for:

- Research demo
- Conference presentation
- Portfolio showcase
- Public GitHub release

---

# 📌 Final Positioning

Not:

Satellite interpolation tool

But:

> Motion-aware, domain-adaptive Video Frame Interpolation framework for both rigid and deformable dynamics.

This framing strengthens both:

- Academic credibility
- Commercial positioning
- Broader applicability

---

End of master prompt.
