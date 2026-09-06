"use client";

import { useEffect, useRef, useState } from "react";
import QrScannerLib from "qr-scanner";
import { CameraIcon } from "./icons";
import { useT } from "@/lib/i18n";

interface QrScannerProps {
  onResult: (text: string) => void;
}

export function QrScanner({ onResult }: QrScannerProps) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerLib | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!videoRef.current) return;
      setStatus("starting");
      try {
        const hasCamera = await QrScannerLib.hasCamera();
        if (!hasCamera) {
          if (!cancelled) {
            setStatus("error");
            setErrorMsg(t("qr.noCamera"));
          }
          return;
        }
        const scanner = new QrScannerLib(
          videoRef.current,
          (result) => {
            if (doneRef.current) return;
            doneRef.current = true;
            onResult(result.data);
          },
          {
            preferredCamera: "environment",
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 5,
            returnDetailedScanResult: true,
          }
        );
        scannerRef.current = scanner;
        await scanner.start();
        if (!cancelled) setStatus("running");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(
            err instanceof Error && err.name === "NotAllowedError"
              ? t("qr.denied")
              : t("qr.cannotAccess")
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {status !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white/70">
            <CameraIcon width={32} height={32} />
            {status === "error" ? (
              <p className="text-sm text-danger">{errorMsg}</p>
            ) : (
              <p className="text-sm">{t("qr.requesting")}</p>
            )}
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted">{t("qr.hint")}</p>
    </div>
  );
}

/** Scan a QR code from an image file. Returns the otpauth text or null. */
export async function scanImageFile(file: File): Promise<string | null> {
  try {
    const result = await QrScannerLib.scanImage(file, { returnDetailedScanResult: true });
    return result.data;
  } catch {
    return null;
  }
}
