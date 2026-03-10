import { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { motion } from "framer-motion";

// UI Components
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { UploadCloud, Gauge, Settings, LogOut } from "lucide-react";

const API = "/wms/api";

export default function LiveDemo() {
  const [token, setToken] = useState(null);
  const [file, setFile] = useState(null);

  const [model, setModel] = useState("0");
  const [multiplier, setMultiplier] = useState("2");

  const [jobId, setJobId] = useState(null);

  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [processing, setProcessing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [system, setSystem] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    fetchSystem();
    const t = setInterval(fetchSystem, 5000);
    return () => clearInterval(t);
  }, []);

  const fetchSystem = async () => {
    try {
      const r = await fetch(`${API}/system`);
      const data = await r.json();
      setSystem(data);
    } catch {}
  };

  const handleLogin = async (res) => {
    const r = await fetch(`${API}/auth/google?token=${res.credential}`, {
      method: "POST",
    });

    const data = await r.json();

    localStorage.setItem("token", data.access_token);
    setToken(data.access_token);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setFile(null);
    setJobId(null);
    setStatus(null);
    setProgress(0);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];

    setFile(f);

    setJobId(null);
    setStatus(null);
    setProgress(0);

    setUploading(false);
    setProcessing(false);
  };

  const uploadVideo = () => {
    if (!file) {
      alert("Select video");
      return;
    }

    const form = new FormData();
    form.append("file", file);

    const xhr = new XMLHttpRequest();

    xhr.open(
      "POST",
      `${API}/upload?model_id=${model}&multiplier=${multiplier}`,
    );

    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    setUploading(true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploading(false);

      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const err = JSON.parse(xhr.responseText);
          alert(err.detail || "Upload failed");
        } catch {
          alert("Upload failed");
        }

        return;
      }

      const data = JSON.parse(xhr.responseText);

      setJobId(data.job_id);

      setStatus("queued");
      setProgress(0);

      setProcessing(true);

      pollStatus(data.job_id);
    };

    xhr.onerror = () => {
      setUploading(false);
      alert("Network error");
    };

    xhr.send(form);
  };

  const pollStatus = (job) => {
    const interval = setInterval(async () => {
      const res = await fetch(`${API}/status/${job}`);
      const data = await res.json();

      setStatus(data.status);
      setProgress(data.progress);

      if (
        data.status === "done" ||
        data.status === "failed" ||
        data.status === "failed_oom"
      ) {
        clearInterval(interval);
        setProcessing(false);
      }
    }, 3000);
  };

  const download = async () => {
    if (downloading) return;

    setDownloading(true);

    try {
      const res = await fetch(`${API}/download/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert("Download failed");
        setDownloading(false);
        return;
      }

      const blob = await res.blob();

      let filename = "result.mp4";

      const disposition = res.headers.get("content-disposition");

      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      alert("Download error");
    }

    setDownloading(false);
  };

  return (
    <section className="mt-32 w-full max-w-6xl mx-auto px-6 pb-32">
      <div className="space-y-12 w-full">
        {/* Header - Center Aligned but spans container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-4"
        >
          <h2 className="text-3xl font-heading">Live GPU Demo</h2>
          <p className="text-textSecondary text-sm max-w-2xl mx-auto">
            Experience our motion-aware interpolation in real-time. Upload a
            video clip to see the domain-adapted model synthesize intermediate frames.
          </p>
        </motion.div>

        {/* System Status Bar - Correct Width */}
        {system && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="surface rounded-xl p-4 hero-glow flex gap-8 flex-wrap justify-center text-xs border border-white/5 w-full"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(134,245,247,0.8)]" />
              <span className="text-textSecondary">GPU Cluster Status:</span>
              <span className="font-semibold text-white">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-textSecondary">Active Jobs:</span>
              <span className="font-semibold text-white">
                {system.active_gpu_jobs}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-textSecondary">Queue Depth:</span>
              <span className="font-semibold text-white">
                {system.queue_length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-textSecondary">Available VRAM:</span>
              <span className="font-semibold text-accent">
                {system.free_vram_mb} MB
              </span>
            </div>
          </motion.div>
        )}

        {!token && (
          <div className="surface rounded-2xl p-16 hero-glow flex flex-col items-center justify-center space-y-6 text-center border border-white/5 w-full">
            <div className="p-4 rounded-full bg-accent/10 text-accent">
              <Settings size={32} />
            </div>
            <div>
              <h3 className="text-xl font-heading mb-2">
                Secure GPU Pipeline
              </h3>
              <p className="text-textSecondary text-sm mb-8 max-w-xs mx-auto">
                Please authenticate with Google to access the scientific processing backend.
              </p>
              <GoogleLogin
                onSuccess={handleLogin}
                onError={() => alert("Login Failed")}
              />
            </div>
          </div>
        )}

        {token && (
          <div className="grid gap-8 w-full">
            {/* SETTINGS - Now spans full 6xl width */}
            <div className="surface rounded-xl p-8 hero-glow border border-white/5 w-full">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-accent" />
                  <h3 className="font-heading text-lg">Processing Parameters</h3>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-textSecondary hover:text-white hover:bg-white/5"
                >
                  <LogOut size={14} className="mr-2" />
                  Logout
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-3">
                  <label className="text-xs text-textSecondary uppercase tracking-widest font-bold">
                    Model Architecture
                  </label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="bg-black/40 border-white/10 w-full py-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Baseline RIFE (Standard)</SelectItem>
                      <SelectItem value="1">WMS Finetuned (L1)</SelectItem>
                      <SelectItem value="2">Custom Motion Loss (Proposed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs text-textSecondary uppercase tracking-widest font-bold">
                    Temporal Upsampling
                  </label>
                  <Select value={multiplier} onValueChange={setMultiplier}>
                    <SelectTrigger className="bg-black/40 border-white/10 w-full py-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2x Multiplier</SelectItem>
                      <SelectItem value="3">3x Multiplier</SelectItem>
                      <SelectItem value="4">4x Multiplier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* UPLOAD - Now spans full 6xl width */}
            <div className="surface rounded-xl p-8 hero-glow border border-white/5 w-full">
              <div className="flex items-center gap-2 font-heading text-lg mb-8">
                <UploadCloud size={20} className="text-accent" />
                Media Upload
              </div>

              <label className="group border-2 border-dashed border-secondary/20 rounded-2xl p-16 flex flex-col items-center text-center cursor-pointer hover:border-accent/40 hover:bg-accent/5 transition-all">
                <div className="p-5 rounded-full bg-secondary/5 text-secondary group-hover:text-accent group-hover:scale-110 group-hover:bg-accent/10 transition-all mb-4">
                  <UploadCloud size={44} />
                </div>

                <p className="text-base font-semibold mb-1 text-white">
                  {file ? file.name : "Select or drag video file"}
                </p>
                <p className="text-xs text-textSecondary">
                  Scientific imagery (MP4, MOV) • Max 50MB
                </p>

                <Input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {uploading && (
                <div className="mt-8 space-y-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-textSecondary">
                      Streaming to GPU Cluster...
                    </span>
                    <span className="text-accent font-bold">
                      {uploadProgress}%
                    </span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5" />
                </div>
              )}

              <Button
                onClick={uploadVideo}
                className={`w-full mt-8 py-7 text-md font-bold uppercase tracking-wider transition-all duration-300 ${!file || uploading || processing ? "bg-secondary/10 text-secondary" : "bg-accent text-black hover:scale-[1.01] shadow-[0_0_20px_rgba(134,245,247,0.3)]"}`}
                disabled={!file || uploading || processing}
              >
                {uploading
                  ? "Uploading Data..."
                  : processing
                    ? "In Pipeline..."
                    : "Begin Processing"}
              </Button>
            </div>

            {/* STATUS - Now spans full 6xl width */}
            {jobId && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="surface rounded-xl p-8 hero-glow border border-accent/20 w-full"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2 font-heading text-lg">
                    <Gauge size={20} className="text-accent" />
                    GPU Task Status
                  </div>
                  <Badge
                    variant="outline"
                    className="border-accent/40 text-accent bg-accent/5 px-4 py-1 font-bold uppercase text-[10px] tracking-widest"
                  >
                    {status}
                  </Badge>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between text-xs">
                    <span className="text-textSecondary">
                      Frame Synthesis Progress
                    </span>
                    <span className="text-white font-bold text-sm">
                      {progress}%
                    </span>
                  </div>

                  <Progress value={progress} className="h-2.5" />

                  {status === "done" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-6"
                    >
                      <Button
                        onClick={download}
                        disabled={downloading}
                        className="w-full bg-white text-black py-7 font-bold hover:bg-gray-200 transition-colors"
                      >
                        {downloading
                          ? "Generating Stream..."
                          : "Download Interpolated Result"}
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}