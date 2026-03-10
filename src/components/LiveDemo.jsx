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
    setDownloading(false);
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

      if (xhr.status !== 200) {
        alert("Upload failed");
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
      alert("Upload failed");
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        alert("Download failed");
        setDownloading(false);
        return;
      }

      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${jobId}.mp4`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Download error");
    }

    setDownloading(false);
  };

  return (
    <section className="max-w-5xl mx-auto mt-32 px-6 space-y-10">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold text-center"
      >
        Live GPU Demo
      </motion.h2>

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
              <Input type="file" accept="video/*" onChange={handleFileChange} />

              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name}
                </p>
              )}

              {uploading && (
                <div>
                  <Progress value={uploadProgress} />

                  <p className="text-sm mt-2">Uploading {uploadProgress}%</p>
                </div>
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
                    : "Run Interpolation"}
              </Button>
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
