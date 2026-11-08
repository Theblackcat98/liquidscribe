"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Monitor, X, Circle, ScanLine } from "lucide-react";

type Props = { kind: "camera" | "screen"; onClose: () => void; onCapture: (image: string) => void; onNotice: (message: string) => void };

export function CapturePreview({ kind, onClose, onCapture, onNotice }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onClose, onNotice });
  callbacks.current = { onClose, onNotice };

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        if (!navigator.mediaDevices) throw new Error("Capture needs a secure browser connection (HTTPS or localhost).");
        const stream = kind === "camera"
          ? await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, facingMode: "environment" }, audio: false })
          : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        setReady(true);
        stream.getVideoTracks()[0]?.addEventListener("ended", () => callbacks.current.onClose());
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error && cause.name === "NotAllowedError" ? "Permission was declined. Allow access in your browser and try again." : cause instanceof Error ? cause.message : "This device could not be opened.");
      }
    };
    void start();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, [kind]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { onNotice("The preview is still getting ready. Try again in a moment."); return; }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.8));
    onClose();
  };

  return <section className="capture-preview" aria-label={`${kind} preview`}>
    <header><span>{kind === "camera" ? <Camera size={14} /> : <Monitor size={14} />}{kind === "camera" ? "Camera preview" : "Screen preview"}</span><button className="icon-button" onClick={onClose} aria-label="Close preview"><X size={15} /></button></header>
    <div className="capture-video"><video ref={videoRef} autoPlay muted playsInline />{!ready && <div className="capture-placeholder">{error ? <><ScanLine size={26} /><p>{error}</p></> : <><Circle size={18} className="pulse" /><p>Waiting for permission…</p></>}</div>}{ready && <span className="live-label"><i /> LIVE</span>}</div>
    <footer><span>Only shared when you send.</span><button className="small-primary" onClick={capture} disabled={!ready}><Camera size={13} /> Capture</button></footer>
  </section>;
}
