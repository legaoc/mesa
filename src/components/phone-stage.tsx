import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { FinishId, FitMode, SceneId } from "@/lib/render-mockup";
import { PhoneView, type PhonePose } from "@/lib/phone-view";

export type PhoneStageHandle = {
  capture: (transparent: boolean) => Promise<Blob | null>;
};

type Props = {
  modelId: string;
  finish: FinishId;
  scene: SceneId;
  cut: boolean;
  image: HTMLImageElement | null;
  fit: FitMode;
  zoom: number;
  pan: { x: number; y: number };
  pose: PhonePose;
  poseRev: number;
  mode: "girar" | "encuadrar";
  onPose: (pose: PhonePose) => void;
  onFrame: (frame: { pan: { x: number; y: number }; zoom: number }) => void;
  className?: string;
};

export const PhoneStage = forwardRef<PhoneStageHandle, Props>(function PhoneStage(
  { modelId, finish, scene, cut, image, fit, zoom, pan, pose, poseRev, mode, onPose, onFrame, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<PhoneView | null>(null);
  const poseRef = useRef(pose);
  const frameRef = useRef({ pan, zoom, mode });
  const onPoseRef = useRef(onPose);
  const onFrameRef = useRef(onFrame);
  poseRef.current = pose;
  frameRef.current = { pan, zoom, mode };
  onPoseRef.current = onPose;
  onFrameRef.current = onFrame;

  useImperativeHandle(ref, () => ({
    capture: (transparent) => viewRef.current?.capture(transparent) ?? Promise.resolve(null),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const view = new PhoneView(canvas, true);
    viewRef.current = view;
    view.onPose = (next) => onPoseRef.current(next);
    const parent = canvas.parentElement;
    const resize = () => {
      if (!parent) return;
      view.setSize(parent.clientWidth, parent.clientHeight);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (parent) observer.observe(parent);
    return () => {
      observer.disconnect();
      view.dispose();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.setModel(modelId);
    view.setArt({ image, zoom, panX: pan.x, panY: pan.y, fit });
    view.applyPose(poseRef.current);
    view.render();
  }, [modelId]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.setFinish(finish);
    view.render();
  }, [finish]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.setBackdrop(scene, cut);
    view.render();
  }, [scene, cut]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.setArt({ image, zoom, panX: pan.x, panY: pan.y, fit });
    view.render();
  }, [image, zoom, pan, fit]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.setOrbitEnabled(mode === "girar");
  }, [mode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.applyPose(poseRef.current);
    view.render();
  }, [poseRev]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let drag: { x: number; y: number; panX: number; panY: number } | null = null;

    const down = (event: PointerEvent) => {
      if (frameRef.current.mode !== "encuadrar") return;
      canvas.setPointerCapture(event.pointerId);
      drag = { x: event.clientX, y: event.clientY, panX: frameRef.current.pan.x, panY: frameRef.current.pan.y };
    };
    const move = (event: PointerEvent) => {
      if (!drag) return;
      const scale = 900 / Math.max(1, canvas.clientWidth);
      onFrameRef.current({
        pan: {
          x: drag.panX + (event.clientX - drag.x) * scale,
          y: drag.panY + (event.clientY - drag.y) * scale,
        },
        zoom: frameRef.current.zoom,
      });
    };
    const up = () => {
      drag = null;
    };
    const wheel = (event: WheelEvent) => {
      if (frameRef.current.mode !== "encuadrar") return;
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.94 : 1.06;
      onFrameRef.current({
        pan: frameRef.current.pan,
        zoom: Math.min(4, Math.max(0.35, frameRef.current.zoom * factor)),
      });
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className ? `phone-view ${className}` : "phone-view"}
      role="img"
      aria-label="Teléfono en 3D"
    />
  );
});
