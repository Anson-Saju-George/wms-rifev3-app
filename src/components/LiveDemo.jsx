import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { UploadCloud, Gauge } from "lucide-react";

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

  useEffect(() => {
    const saved = localStorage.getItem("token");

    if (saved) setToken(saved);
  }, []);

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
  };

  const handleFile = (e) => {
    const f = e.target.files[0];

    setFile(f);

    setJobId(null);
    setStatus(null);
    setProgress(0);
  };

  const uploadVideo = () => {
    if (!file) return;

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

      if (xhr.status !== 200) {
        alert("Upload failed");
        return;
      }

      const data = JSON.parse(xhr.responseText);

      setJobId(data.job_id);

      setProcessing(true);

      pollStatus(data.job_id);
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
    setDownloading(true);

    const res = await fetch(`${API}/download/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "interpolated.mp4";

    a.click();

    window.URL.revokeObjectURL(url);

    setDownloading(false);
  };

  return (
    <section className="max-w-5xl mx-auto mt-32 px-6 space-y-10">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-heading text-center"
      >
        Live GPU Demo
      </motion.h2>

      {!token && (
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleLogin}
            onError={() => alert("Login failed")}
          />
        </div>
      )}

      {token && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between">
                Upload Video
                <Button variant="outline" onClick={logout}>
                  Logout
                </Button>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <label className="border border-dashed rounded-xl p-10 flex flex-col items-center cursor-pointer hover:border-primary transition">
                <UploadCloud size={40} />

                <p className="text-sm mt-2">Drag or click to upload</p>

                <Input type="file" accept="video/*" onChange={handleFile} />
              </label>

              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Process</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <Button
                onClick={uploadVideo}
                disabled={!file || uploading || processing}
                className="w-full"
              >
                {uploading
                  ? `Uploading ${uploadProgress}%`
                  : processing
                    ? "Processing..."
                    : "Run Interpolation"}
              </Button>

              {uploading && <Progress value={uploadProgress} />}
            </CardContent>
          </Card>

          {jobId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge size={18} />
                  Processing Status
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <Badge>{status}</Badge>

                <Progress value={progress} />

                <p className="text-sm text-muted-foreground">
                  Progress {progress}%
                </p>

                {status === "done" && (
                  <Button onClick={download} disabled={downloading}>
                    {downloading ? "Downloading..." : "Download Result"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
