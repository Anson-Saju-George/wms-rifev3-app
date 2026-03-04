import { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";

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

import { Upload, Video, Gauge } from "lucide-react";

const API = "http://127.0.0.1:8000";

export default function App() {
  const [token, setToken] = useState(null);

  const [file, setFile] = useState(null);

  const [model, setModel] = useState("0");
  const [multiplier, setMultiplier] = useState("2");

  const [jobId, setJobId] = useState(null);

  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);

  const [drag, setDrag] = useState(false);

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

    setJobId(null);
    setProgress(0);
  };

  const uploadVideo = async () => {
    if (!file) {
      alert("Select video");
      return;
    }

    const form = new FormData();

    form.append("file", file);

    const res = await fetch(
      `${API}/upload?model_id=${model}&multiplier=${multiplier}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      },
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail);
      return;
    }

    setJobId(data.job_id);
    setStatus("queued");
    setProgress(0);

    pollStatus(data.job_id);
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
      }
    }, 5000);
  };

  const download = async () => {
    const res = await fetch(`${API}/download/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = `${jobId}.mp4`;

    a.click();
  };

  const statusColor = {
    queued: "secondary",
    processing: "default",
    waiting_gpu: "outline",
    done: "success",
    failed: "destructive",
    failed_oom: "destructive",
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-center">
          Web Motion Synthesizer
        </h1>

        {!token && (
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleLogin}
              onError={() => alert("Login Failed")}
            />
          </div>
        )}

        {token && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between">
                  Model Settings
                  <Button variant="outline" onClick={logout}>
                    Logout
                  </Button>
                </CardTitle>
              </CardHeader>

              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2">Model</p>

                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="0">Baseline RIFE</SelectItem>

                      <SelectItem value="1">WMS Finetuned</SelectItem>

                      <SelectItem value="2">WMS Custom Loss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="mb-2">Interpolation</p>

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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload size={18} />
                  Upload Video
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files[0])}
                />

                <Button onClick={uploadVideo} className="w-full">
                  Process Video
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
                  <Badge variant={statusColor[status]}>{status}</Badge>

                  <Progress value={progress} />

                  <p className="text-sm text-muted-foreground">
                    Progress {progress}%
                  </p>

                  {status === "done" && (
                    <Button onClick={download}>Download Result</Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
