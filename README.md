# Web Motion Synthesizer (WMS)
![WMS Banner](docs/images/banner.png)
![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi)
![PyTorch](https://img.shields.io/badge/PyTorch-DeepLearning-ee4c2c?logo=pytorch)
![GPU](https://img.shields.io/badge/GPU-Accelerated-orange?logo=nvidia)
![License](https://img.shields.io/badge/License-Research-lightgrey)
![Status](https://img.shields.io/badge/Project-Prototype-purple)
**GPU-Accelerated Neural Video Frame Interpolation Platform**

# Live Demo: https://ansonsajugeorge.online/wms/

# Overview

Web Motion Synthesizer (WMS) is a **GPU-accelerated web platform** for deep learning–based **video frame interpolation**.

It allows users to upload videos and generate smoother motion using neural interpolation models derived from the **RIFE architecture** and custom research variants.

The system was developed as a **research prototype and demonstration platform** for presenting deep learning models through an interactive web interface.

The platform integrates:

- Neural frame interpolation models  
- GPU inference pipeline  
- Job scheduling system  
- Interactive web UI  
- Secure user authentication  
- Cloud-ready deployment infrastructure  

This repository contains the core infrastructure for the WMS prototype, which will later evolve into a **full research demonstration platform** with interactive storytelling and model explainability features.

---
# Demo
![WMS Demo](docs/demo.gif)
Try the live demo: https://ansonsajugeorge.online/wms/
---

# Interface Screens
*(Screenshots will be added after final UI update)*

## Login Interface
![Login](docs/screens/login.png)

## Model Configuration
![Model Settings](docs/screens/model_settings.png)

## Upload Interface
![Upload](docs/screens/upload.png)

## Processing Status
![Processing](docs/screens/status.png)

## Output Download
![Download](docs/screens/download.png)

---

# Key Features

- Neural video frame interpolation
- GPU-accelerated inference
- Multiple interpolation models
- Dynamic model loading and offloading
- GPU worker scheduling
- Upload progress tracking
- Real-time processing status updates
- Secure authentication (Google OAuth)
- Automatic resource cleanup
- Large video processing support

---

# System Architecture

```mermaid
graph TD

A[React Frontend] --> B[Nginx Reverse Proxy]
B --> C[FastAPI Backend]
C --> D[Job Queue]
D --> E[GPU Worker]
E --> F[PyTorch Model]
F --> G[Processed Video Output]
````

The architecture ensures **efficient GPU utilization** through:

* Controlled worker scheduling
* Model caching
* Asynchronous processing

---

# Technology Stack

## Frontend

* React
* Vite
* Tailwind UI
* Google OAuth authentication

## Backend

* FastAPI
* Gunicorn
* SQLAlchemy
* JWT authentication
* Asynchronous job scheduling

## Machine Learning

* PyTorch
* RIFE-based interpolation models
* Custom research variants

## Infrastructure

* Nginx reverse proxy
* Cloudflare CDN
* GPU server deployment
* systemd service management

---

# Repository Structure

```
wms/

backend/
│
├── app.py
├── core_engine.py
├── model_engine.py
├── database.py
├── models.py
├── auth.py
│
├── storage/
│   ├── uploads/
│   └── outputs/

frontend/
│
├── src/
│   ├── components/
│   └── App.jsx

nginx/
│
└── deployment configuration

docs/
│
├── banner.png
├── demo.gif
└── screens/
```

---

# Local Development

## Clone Repository

```bash
git clone https://github.com/Anson-Saju-George/wms.git
cd wms
```

---

# Backend Setup

```bash
python -m venv ml
source ml/bin/activate

pip install -r requirements.txt
```

Run backend server:

```bash
gunicorn app:app \
-k uvicorn.workers.UvicornWorker \
-b 127.0.0.1:8081
```

---

# Frontend Setup

```bash
npm install
npm run dev
```

---

# Deployment Architecture

Production deployment uses:

* Nginx reverse proxy
* Gunicorn + Uvicorn backend
* GPU inference server
* Cloudflare CDN
* systemd service management

---

# Performance

| Component      | Specification        |
| -------------- | -------------------- |
| GPU            | NVIDIA RTX 3060      |
| Backend        | FastAPI + Gunicorn   |
| ML Framework   | PyTorch              |
| Maximum Upload | 2GB                  |
| Queue System   | GPU worker scheduler |

---

# Research Context

This project contributes to research in:

* Neural video frame interpolation
* Motion synthesis
* GPU inference pipelines
* Interactive model demonstration systems

The final version will include:

* Interactive storytelling UI
* Model explainability features
* Research presentation tools

---

# Future Work

Planned improvements include:

* Interactive model explanation interface
* Research storytelling UI
* Multi-GPU inference support
* Real-time preview generation
* Distributed job queue
* Video streaming inference pipeline

---

# Author

**Anson Saju George**

Portfolio:
[https://ansonsajugeorge.online](https://ansonsajugeorge.online)

---

# License

This repository is provided for **research and educational purposes**.
