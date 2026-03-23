import { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { motion, AnimatePresence } from "framer-motion";

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

import {
  UploadCloud,
  Gauge,
  Settings,
  LogOut,
  CreditCard,
  X,
  Sparkles,
} from "lucide-react";

const API = "/wms/api";
const RAZORPAY_KEY_ID = "rzp_live_SUhpE0sGoGzURD";

// --- Payment Modal Component ---
function PaymentModal({ isOpen, onClose, onConfirm, loading }) {
  const [selected, setSelected] = useState(1);
  const options = [
    { count: 1, price: 20, label: "Single Render" },
    { count: 5, price: 90, label: "Starter Pack", discount: "10% Off" },
    { count: 10, price: 150, label: "Pro Bundle", discount: "25% Off" },
  ];
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md surface border border-white/10 rounded-2xl p-8 hero-glow overflow-hidden"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-textSecondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          <div className="flex flex-col items-center text-center mb-8">
            <div className="p-3 rounded-xl bg-accent/10 text-accent mb-4">
              <CreditCard size={28} />
            </div>
            <h3 className="text-xl font-heading text-white">
              Refill GPU Credits
            </h3>
            <p className="text-sm text-textSecondary mt-1">
              Select a package to continue processing
            </p>
          </div>
          <div className="space-y-3 mb-8">
            {options.map((opt) => (
              <div
                key={opt.count}
                onClick={() => setSelected(opt.count)}
                className={`group relative p-4 rounded-xl border cursor-pointer transition-all duration-300 ${selected === opt.count ? "bg-accent/10 border-accent shadow-[0_0_15px_rgba(134,245,247,0.1)]" : "bg-white/5 border-white/5 hover:border-white/20"}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-lg">
                        {opt.count} Credit{opt.count > 1 ? "s" : ""}
                      </span>
                      {opt.discount && (
                        <span className="text-[10px] bg-accent text-black px-1.5 py-0.5 rounded font-bold uppercase">
                          {opt.discount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-textSecondary">{opt.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">₹{opt.price}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={() => onConfirm(selected)}
            disabled={loading}
            className="w-full py-7 bg-accent text-black hover:scale-[1.02] transition-transform font-bold text-md uppercase tracking-wider"
          >
            {loading ? (
              "Initializing..."
            ) : (
              <span className="flex items-center gap-2">
                Pay ₹{options.find((o) => o.count === selected).price}{" "}
                <Sparkles size={16} />
              </span>
            )}
          </Button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// --- Main LiveDemo Component ---
export default function LiveDemo() {
  const [token, setToken] = useState(null);
  const [userData, setUserData] = useState(null);
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [system, setSystem] = useState(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("token");
    if (saved) {
      setToken(saved);
      fetchUser(saved);
    }
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

  const fetchUser = async (authToken) => {
    try {
      const r = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (r.ok) {
        const data = await r.json();
        setUserData(data);
      } else if (r.status === 401) {
        logout();
      }
    } catch {}
  };

  const handleLogin = async (res) => {
    const r = await fetch(`${API}/auth/google?token=${res.credential}`, {
      method: "POST",
    });
    const data = await r.json();
    localStorage.setItem("token", data.access_token);
    setToken(data.access_token);
    fetchUser(data.access_token);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUserData(null);
    setFile(null);
    setJobId(null);
    setStatus(null);
    setProgress(0);
  };

  const handlePurchase = async (quantity) => {
    setPaymentLoading(true);
    try {
      const res = await fetch(
        `${API}/payments/create-order?num_credits=${quantity}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      const order = await res.json();
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        name: "WMS Video Engine",
        description: `Purchase ${quantity} GPU Credits`,
        order_id: order.id,
        handler: async function (response) {
          await fetch(`${API}/payments/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(response),
          });
          setIsModalOpen(false);
          fetchUser(token);
        },
        theme: { color: "#86F5F7" },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert("Failed to initiate payment");
    } finally {
      setPaymentLoading(false);
    }
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
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        setJobId(data.job_id);
        setStatus("queued");
        setProgress(0);
        setProcessing(true);
        fetchUser(token);
        pollStatus(data.job_id);
      } else {
        let msg = "Upload failed";
        try {
          const err = JSON.parse(xhr.responseText);
          msg = err.detail || msg;
        } catch (e) {}
        alert(msg);
        setFile(null);
      }
    };
    xhr.send(form);
  };

  const pollStatus = (job) => {
    const interval = setInterval(async () => {
      const res = await fetch(`${API}/status/${job}`);
      const data = await res.json();
      setStatus(data.status);
      setProgress(data.progress);
      if (data.status === "done" || data.status.startsWith("failed")) {
        clearInterval(interval);
        setProcessing(false);
        if (data.status.startsWith("failed")) fetchUser(token);
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

      // FIX: EXTRACT FILENAME FROM HEADER
      let filename = "result.mp4";

      const disposition = res.headers.get("content-disposition");

      if (disposition) {
        // 🔥 handle UTF-8 format (your backend)
        const utfMatch = disposition.match(/filename\*=UTF-8''(.+)/);

        if (utfMatch) {
          filename = decodeURIComponent(utfMatch[1]);
        } else {
          // fallback (older format)
          const normalMatch = disposition.match(/filename="(.+)"/);
          if (normalMatch) filename = normalMatch[1];
        }
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
    } finally {
      setDownloading(false);
    }
  };

  const isOutOfCredits =
    userData &&
    userData.role !== "admin" &&
    userData.credits_used >= userData.credits_total;

  return (
    <section className="mt-32 w-full max-w-6xl mx-auto px-6 pb-32">
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handlePurchase}
        loading={paymentLoading}
      />
      <div className="space-y-12 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-4"
        >
          <h2 className="text-3xl font-heading">Live GPU Demo</h2>
          <p className="text-textSecondary text-sm max-w-2xl mx-auto">
            Experience our motion-aware interpolation in real-time. Upload a
            video clip to see the domain-adapted model synthesize frames.
          </p>
        </motion.div>
        {system && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="surface rounded-xl p-4 hero-glow flex gap-8 flex-wrap justify-center text-xs border border-white/5 w-full"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(134,245,247,0.8)]" />
              <span className="text-textSecondary">Cluster:</span>{" "}
              <span className="text-white">Active</span>
            </div>
            <div className="flex items-center gap-2 text-textSecondary">
              Jobs: <span className="text-white">{system.active_gpu_jobs}</span>
            </div>
            <div className="flex items-center gap-2 text-textSecondary">
              Queue: <span className="text-white">{system.queue_length}</span>
            </div>
            <div className="flex items-center gap-2 text-textSecondary">
              VRAM:{" "}
              <span className="text-accent">{system.free_vram_mb} MB</span>
            </div>
          </motion.div>
        )}
        {!token && (
          <div className="surface rounded-2xl p-16 hero-glow flex flex-col items-center justify-center space-y-6 text-center border border-white/5 w-full">
            <div className="p-4 rounded-full bg-accent/10 text-accent">
              <Settings size={32} />
            </div>
            <div>
              <h3 className="text-xl font-heading mb-2">Secure GPU Pipeline</h3>
              <p className="text-textSecondary text-sm mb-8">
                Authenticate with Google to access the backend.
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
            <div className="surface rounded-xl p-8 hero-glow border border-white/5 w-full">
              <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Settings size={18} className="text-accent" />
                    <h3 className="font-heading text-lg">GPU Configuration</h3>
                  </div>
                  {userData && (
                    <div className="flex items-center gap-3 mt-2">
                      <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                        <span className="text-[10px] text-textSecondary uppercase font-bold block leading-none mb-1">
                          Compute Balance
                        </span>
                        <span className="text-sm font-mono text-white">
                          {userData.role === "admin"
                            ? "UNLIMITED"
                            : `${userData.credits_total - userData.credits_used} Credits Left`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(true)}
                    className="border-accent/40 text-accent hover:bg-accent/10"
                  >
                    <CreditCard size={14} className="mr-2" />
                    Refill
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-textSecondary hover:bg-white/5"
                  >
                    <LogOut size={14} className="mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-3">
                  <label className="text-xs text-textSecondary uppercase tracking-widest font-bold">
                    Model Architecture
                  </label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="bg-black/40 border-white/10 py-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Baseline RIFE</SelectItem>
                      <SelectItem value="1">WMS Finetuned (L1)</SelectItem>
                      <SelectItem value="2">Custom Motion Loss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <label className="text-xs text-textSecondary uppercase tracking-widest font-bold">
                    Temporal Upsampling
                  </label>
                  <Select value={multiplier} onValueChange={setMultiplier}>
                    <SelectTrigger className="bg-black/40 border-white/10 py-6">
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
            </div>
            <div className="surface rounded-xl p-8 hero-glow border border-white/5 w-full">
              <div className="flex items-center gap-2 font-heading text-lg mb-8">
                <UploadCloud size={20} className="text-accent" />
                Media Upload
              </div>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  if (isOutOfCredits) return;
                }}
                onDragEnter={(e) => {
                  if (isOutOfCredits) return;
                  e.currentTarget.classList.add("border-accent", "bg-accent/5");
                }}
                onDragLeave={(e) => {
                  // prevent flicker when moving inside children
                  if (e.currentTarget.contains(e.relatedTarget)) return;
                  e.currentTarget.classList.remove(
                    "border-accent",
                    "bg-accent/5",
                  );
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove(
                    "border-accent",
                    "bg-accent/5",
                  );

                  if (isOutOfCredits) return;

                  const files = e.dataTransfer.files;

                  if (!files || files.length === 0) return;

                  if (files.length > 1) {
                    alert("Only one file allowed");
                    return;
                  }

                  const droppedFile = files[0];

                  if (!droppedFile.type.startsWith("video/")) {
                    alert("Please drop a valid video file");
                    return;
                  }

                  if (droppedFile.size > 100 * 1024 * 1024) {
                    alert("File exceeds 100MB limit");
                    return;
                  }

                  // SAME STATE RESET (no logic change)
                  setFile(droppedFile);
                  setJobId(null);
                  setStatus(null);
                  setProgress(0);
                  setUploading(false);
                  setProcessing(false);
                }}
                className={`group border-2 border-dashed border-secondary/20 rounded-2xl p-16 flex flex-col items-center text-center cursor-pointer transition-all ${
                  isOutOfCredits
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:border-accent/40 hover:bg-accent/5"
                }`}
              >
                <div className="p-5 rounded-full bg-secondary/5 text-secondary group-hover:text-accent group-hover:bg-accent/10 transition-all mb-4">
                  <UploadCloud size={44} />
                </div>

                <p className="text-base font-semibold mb-1 text-white">
                  {file ? file.name : "Select or drag video file"}
                </p>

                <p className="text-xs text-textSecondary">
                  MP4, MOV • Max 100MB
                </p>

                {!isOutOfCredits && (
                  <Input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                )}
              </label>

              {uploading && (
                <div className="mt-8 space-y-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-textSecondary">Streaming...</span>
                    <span className="text-accent font-bold">
                      {uploadProgress}%
                    </span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5" />
                </div>
              )}
              {isOutOfCredits ? (
                <div className="mt-8 p-4 bg-accent/5 border border-accent/20 rounded-xl text-center">
                  <p className="text-sm text-accent font-bold mb-3 uppercase tracking-wider">
                    Quota Exhausted
                  </p>
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-accent text-black w-full py-6"
                  >
                    Refill Credits
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={uploadVideo}
                  disabled={!file || uploading || processing}
                  className={`w-full mt-8 py-7 text-md font-bold uppercase tracking-wider transition-all ${!file || uploading || processing ? "bg-secondary/10 text-secondary" : "bg-accent text-black shadow-[0_0_20px_rgba(134,245,247,0.3)]"}`}
                >
                  {uploading
                    ? "Uploading..."
                    : processing
                      ? "In Pipeline..."
                      : "Begin Processing"}
                </Button>
              )}
            </div>
            {jobId && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="surface rounded-xl p-8 hero-glow border border-accent/20 w-full"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2 font-heading text-lg">
                    <Gauge size={20} className="text-accent" />
                    Status
                  </div>
                  <Badge
                    variant="outline"
                    className="border-accent/40 text-accent bg-accent/5 px-4 font-bold uppercase text-[10px] tracking-widest"
                  >
                    {status}
                  </Badge>
                </div>
                <div className="space-y-6">
                  <div className="flex justify-between text-xs">
                    <span className="text-textSecondary">
                      Synthesis Progress
                    </span>
                    <span className="text-white font-bold text-sm">
                      {progress}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-2.5" />
                  {status === "done" && (
                    <Button
                      onClick={download}
                      disabled={downloading}
                      className="w-full bg-white text-black py-7 font-bold"
                    >
                      Download Result
                    </Button>
                  )}
                  {status.startsWith("failed") && (
                    <div className="pt-4 text-center">
                      <p className="text-red-400 text-xs font-bold uppercase">
                        Processing Failed
                      </p>
                      <p className="text-textSecondary text-[10px]">
                        Credit has been refunded.
                      </p>
                    </div>
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
