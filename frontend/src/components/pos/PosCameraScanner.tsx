import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, CameraOff, Flashlight, ScanBarcode, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";

type PosCameraScannerProps = {
  onDetected: (barcode: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type AdvancedCameraSettings = MediaTrackConstraintSet & {
  focusMode?: string;
  torch?: boolean;
  zoom?: number;
};

type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
  focusMode?: string[];
};

const HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR
  ]],
  [DecodeHintType.TRY_HARDER, true]
]);

function cameraErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission was denied. Enable camera access in browser settings, then try again. Manual barcode search still works.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No usable camera was found. Connect or enable the camera, or enter the barcode manually.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is being used by another app. Close the other camera app and retry.";
  }
  return "Camera scanning could not start. Try again or use the manual barcode field.";
}

export function PosCameraScanner({ onDetected, onOpenChange, open }: PosCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const detectedRef = useRef(false);
  const callbackRef = useRef(onDetected);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  callbackRef.current = onDetected;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let localControls: IScannerControls | null = null;
    detectedRef.current = false;

    const start = async () => {
      setStatus("starting");
      setError(null);
      setTorchAvailable(false);
      setTorchOn(false);
      setZoomRange(null);

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError("Camera access requires HTTPS (or localhost) and an updated browser. You can still type or use a Bluetooth barcode scanner.");
        return;
      }
      const video = videoRef.current;
      if (!video) return;

      try {
        // ZXing decodes EAN, UPC, Code 128, and other retail 1D barcodes on
        // both Android and iOS, including browsers without BarcodeDetector.
        const reader = new BrowserMultiFormatReader(HINTS, 180);
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 30 }
          }
        };

        const controls = await reader.decodeFromConstraints(constraints, video, (result) => {
          if (!result || cancelled || detectedRef.current) return;
          const barcode = result.getText().trim();
          if (!barcode || barcode.length > 128) return;
          detectedRef.current = true;
          controlsRef.current?.stop();
          localControls?.stop();
          if ("vibrate" in navigator) navigator.vibrate?.(45);
          callbackRef.current(barcode);
        });

        localControls = controls;
        if (cancelled || detectedRef.current) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
        if (track) {
          trackRef.current = track;
          const capabilities = track.getCapabilities?.() as CameraCapabilities | undefined;
          if (capabilities?.torch) setTorchAvailable(true);
          if (capabilities?.zoom && capabilities.zoom.max > capabilities.zoom.min) {
            setZoomRange({
              min: capabilities.zoom.min,
              max: capabilities.zoom.max,
              step: capabilities.zoom.step || 0.5
            });
            setZoom(track.getSettings().zoom ?? capabilities.zoom.min);
          }
          if (capabilities?.focusMode?.includes("continuous")) {
            void track.applyConstraints({
              advanced: [{ focusMode: "continuous" } as AdvancedCameraSettings]
            }).catch(() => undefined);
          }
        }
        setStatus("scanning");
      } catch (reason) {
        if (cancelled) return;
        setError(cameraErrorMessage(reason));
        setStatus("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      detectedRef.current = true;
      localControls?.stop();
      controlsRef.current?.stop();
      controlsRef.current = null;
      trackRef.current?.stop();
      trackRef.current = null;
      const video = videoRef.current;
      if (video?.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    };
  }, [open]);

  async function changeTorch() {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as AdvancedCameraSettings]
      });
      setTorchOn((on) => !on);
    } catch {
      setTorchAvailable(false);
    }
  }

  async function changeZoom(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track || !zoomRange) return;
    const value = Math.max(
      zoomRange.min,
      Math.min(zoomRange.max, zoom + direction * Math.max(zoomRange.step, 0.5))
    );
    try {
      await track.applyConstraints({
        advanced: [{ zoom: value } as AdvancedCameraSettings]
      });
      setZoom(value);
    } catch {
      setZoomRange(null);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby="pos-camera-scanner-description"
        className="pos-camera-scanner"
      >
        <div className="pos-camera-scanner__heading">
          <div>
            <DialogTitle>Scan product barcode</DialogTitle>
            <DialogDescription id="pos-camera-scanner-description">
              Hold the barcode steady inside the frame. Move closer until the bars are sharp.
            </DialogDescription>
          </div>
          <button
            aria-label="Close camera scanner"
            className="pos-camera-scanner__close"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <div className="pos-camera-scanner__preview">
          <video
            aria-label="Live rear-camera barcode preview"
            autoPlay
            className="pos-camera-scanner__video"
            muted
            playsInline
            ref={videoRef}
          />
          <div aria-hidden="true" className="pos-camera-scanner__aim">
            <span className="pos-camera-scanner__aim-line" />
          </div>
          {status === "starting" ? (
            <div className="pos-camera-scanner__overlay-message">
              <Camera aria-hidden="true" size={25} />
              Starting rear camera…
            </div>
          ) : null}
          {status === "error" ? (
            <div className="pos-camera-scanner__overlay-message">
              <CameraOff aria-hidden="true" size={27} />
              Camera unavailable
            </div>
          ) : null}
        </div>

        <div aria-live="polite" className="pos-camera-scanner__status">
          {error ?? (status === "scanning"
            ? "Scanning EAN, UPC, Code 128 and retail barcodes automatically."
            : "Requesting camera access…")}
        </div>

        <div className="pos-camera-scanner__controls">
          {torchAvailable ? (
            <button
              aria-pressed={torchOn}
              className="pos-camera-scanner__control"
              onClick={() => void changeTorch()}
              type="button"
            >
              <Flashlight aria-hidden="true" size={17} />
              {torchOn ? "Light off" : "Flashlight"}
            </button>
          ) : null}
          {zoomRange ? (
            <div className="pos-camera-scanner__zoom">
              <button
                aria-label="Zoom out camera"
                disabled={zoom <= zoomRange.min}
                onClick={() => void changeZoom(-1)}
                type="button"
              >
                <ZoomOut aria-hidden="true" size={18} />
              </button>
              <span>{zoom.toFixed(1)}×</span>
              <button
                aria-label="Zoom in camera"
                disabled={zoom >= zoomRange.max}
                onClick={() => void changeZoom(1)}
                type="button"
              >
                <ZoomIn aria-hidden="true" size={18} />
              </button>
            </div>
          ) : null}
          <button
            className="pos-camera-scanner__manual"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <ScanBarcode aria-hidden="true" size={17} />
            Use manual search
          </button>
        </div>
        <p className="pos-camera-scanner__hint">
          For best results, wipe the lens, keep the barcode flat, and use good lighting.
          The camera stops as soon as a code is detected or the scanner closes.
        </p>
      </DialogContent>
    </Dialog>
  );
}
