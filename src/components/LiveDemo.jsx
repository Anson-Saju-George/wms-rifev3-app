import { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { UploadCloud, Gauge, Cpu } from "lucide-react";

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
    <section className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-4xl space-y-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-heading text-center"
        >
          Live GPU Demo
        </motion.h2>

        {system && (
          <div className="surface rounded-xl p-6 hero-glow flex gap-4 flex-wrap justify-center text-sm">
            <Badge>GPU Workers: {system.active_gpu_jobs}</Badge>
            <Badge>Queue: {system.queue_length}</Badge>
            <Badge>Free VRAM: {system.free_vram_mb} MB</Badge>
          </div>
        )}

        {!token && (
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleLogin}
              onError={() => alert("Login Failed")}
            />
          </div>
        )}

        {token && (
          <div className="space-y-6">
            {/* SETTINGS */}

            <div className="surface rounded-xl p-6 hero-glow space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Model Settings</h3>

                <Button variant="outline" onClick={logout}>
                  Logout
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Baseline RIFE</SelectItem>
                    <SelectItem value="1">WMS Finetuned</SelectItem>
                    <SelectItem value="2">Custom Loss</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={multiplier} onValueChange={setMultiplier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2x</SelectItem>
                    <SelectItem value="3">3x</SelectItem>
                    <SelectItem value="4">4x</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* UPLOAD */}

            <div className="surface rounded-xl p-6 hero-glow space-y-4">
              <div className="flex items-center gap-2 font-semibold">
                <UploadCloud size={18} />
                Upload Video
              </div>

              <label className="border border-dashed border-secondary/40 rounded-xl p-10 flex flex-col items-center text-center cursor-pointer hover:border-accent transition">
                <UploadCloud size={36} className="text-accent mb-3" />

                <p className="text-sm text-textSecondary">
                  Drag or click to upload a video
                </p>

                <Input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {file && (
                <p className="text-sm text-textSecondary text-center">
                  Selected: {file.name}
                </p>
              )}

              {uploading && (
                <>
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-center">
                    Uploading {uploadProgress}%
                  </p>
                </>
              )}

              <Button
                onClick={uploadVideo}
                className="w-full"
                disabled={!file || uploading || processing}
              >
                {uploading
                  ? "Uploading..."
                  : processing
                    ? "Processing..."
                    : "Process Video"}
              </Button>
            </div>

            {/* STATUS */}

            {jobId && (
              <div className="surface rounded-xl p-6 hero-glow space-y-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Gauge size={18} />
                  Processing Status
                </div>

                <Badge>{status}</Badge>

                <Progress value={progress} />

                <p className="text-sm text-textSecondary">
                  Progress {progress}%
                </p>

                {status === "done" && (
                  <Button onClick={download} disabled={downloading}>
                    {downloading ? "Downloading..." : "Download Result"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
