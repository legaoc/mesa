import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import {
  GROUPS,
  TEMPLATES,
  renderMockup,
  screenOf,
  templateById,
  type FinishId,
  type FitMode,
  type SceneId,
} from "@/lib/render-mockup";

const SCENES: { id: SceneId; label: string }[] = [
  { id: "papel", label: "Papel" },
  { id: "estudio", label: "Estudio" },
  { id: "tinta", label: "Tinta" },
  { id: "blanco", label: "Blanco" },
];

const FINISHES: { id: FinishId; label: string }[] = [
  { id: "grafito", label: "Grafito" },
  { id: "plata", label: "Plata" },
  { id: "arena", label: "Arena" },
];

const SAMPLES = [
  { id: "patio", name: "Patio", src: "/samples/patio.jpg" },
  { id: "bodegon", name: "Bodegón", src: "/samples/bodegon.jpg" },
  { id: "muro", name: "Muro", src: "/samples/muro.jpg" },
  { id: "campo", name: "Campo", src: "/samples/campo.jpg" },
];

export function Studio() {
  const [templateId, setTemplateId] = useState(TEMPLATES[0]!.id);
  const [scene, setScene] = useState<SceneId>("papel");
  const [finish, setFinish] = useState<FinishId>("grafito");
  const [fit, setFit] = useState<FitMode>("cover");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState("Patio");
  const [sampleId, setSampleId] = useState<string | null>("patio");
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fontTick, setFontTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const template = templateById(templateId);

  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const current = templateById(templateId);
    const pad = 28;
    const availW = Math.max(1, stage.clientWidth - pad);
    const availH = Math.max(1, stage.clientHeight - pad);
    const scale = Math.min(availW / current.w, availH / current.h);
    canvas.style.width = `${Math.max(1, Math.floor(current.w * scale))}px`;
    canvas.style.height = `${Math.max(1, Math.floor(current.h * scale))}px`;
  }, [templateId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = templateById(templateId);
    canvas.width = current.w;
    canvas.height = current.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderMockup(ctx, current.id, {
      scene,
      finish,
      art: { image, zoom, panX: pan.x, panY: pan.y, fit },
    });
    fitCanvas();
  }, [templateId, scene, finish, zoom, pan, image, fit, fontTick, fitCanvas]);

  useEffect(() => {
    for (const item of TEMPLATES) {
      const thumb = thumbs.current[item.id];
      if (!thumb) continue;
      const scale = 200 / item.w;
      thumb.width = Math.max(1, Math.round(item.w * scale));
      thumb.height = Math.max(1, Math.round(item.h * scale));
      const ctx = thumb.getContext("2d");
      if (!ctx) continue;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      renderMockup(ctx, item.id, {
        scene,
        finish,
        quiet: true,
        art: { image, zoom: 1, panX: 0, panY: 0, fit: "cover" },
      });
    }
  }, [image, scene, finish, fontTick]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => fitCanvas());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [fitCanvas]);

  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) setFontTick((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.94 : 1.06;
      setZoom((value) => Math.min(4, Math.max(0.35, value * factor)));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [templateId]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = "/samples/patio.jpg";
  }, []);

  function resetFrame() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function chooseTemplate(id: string) {
    setTemplateId(id);
    resetFrame();
  }

  function useSample(id: string, src: string, name: string) {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageName(name);
      setSampleId(id);
      setError("");
      resetFrame();
    };
    img.onerror = () => setError("No pude abrir esa muestra.");
    img.src = src;
  }

  function useFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Ese archivo no es una imagen.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageName(file.name);
      setSampleId(null);
      setError("");
      resetFrame();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("No pude leer esa imagen. Prueba con JPG o PNG.");
    };
    img.src = url;
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mesa-${template.id}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    }, "image/png");
  }

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const sx = canvas.width / bounds.width;
    const sy = canvas.height / bounds.height;
    const x = (event.clientX - bounds.left) * sx;
    const y = (event.clientY - bounds.top) * sy;
    const screen = screenOf(templateId);
    const inside =
      x >= screen.x && y >= screen.y && x <= screen.x + screen.w && y <= screen.y + screen.h;
    if (!inside) return;
    canvas.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const start = drag.current;
    if (!canvas || !start) return;
    const bounds = canvas.getBoundingClientRect();
    const sx = canvas.width / bounds.width;
    const sy = canvas.height / bounds.height;
    setPan({
      x: start.panX + (event.clientX - start.x) * sx,
      y: start.panY + (event.clientY - start.y) * sy,
    });
  }

  function pointerUp() {
    drag.current = null;
  }

  return (
    <div className="studio">
      <header className="head flex items-center justify-between gap-3 border-b border-rule bg-sheet px-4 py-3">
        <div className="min-w-0">
          <h1 className="mark text-3xl text-ink">Mesa</h1>
          <p className="text-sm text-mute">Sube una foto. Elige el marco. Descarga.</p>
        </div>
        <button type="button" className="btn btn-primary shrink-0" onClick={download} disabled={!image}>
          <Download className="size-4" aria-hidden="true" />
          {saved ? "Listo" : "Descargar"}
        </button>
      </header>

      <nav className="catalog" aria-label="Marcos">
        {GROUPS.map((group) => (
          <div className="group" key={group}>
            <p className="group-label">{group}</p>
            <div className="group-items">
              {TEMPLATES.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === templateId ? "item item-on" : "item"}
                  aria-pressed={item.id === templateId}
                  onClick={() => chooseTemplate(item.id)}
                >
                  <canvas
                    className="thumb"
                    ref={(node) => {
                      thumbs.current[item.id] = node;
                    }}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <em>
                      {item.w}×{item.h}
                    </em>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={over ? "stage is-over" : "stage"}
        ref={stageRef}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file = event.dataTransfer.files[0];
          if (file) useFile(file);
        }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Mockup ${template.name}`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onDoubleClick={resetFrame}
        />
      </div>

      <aside className="inspector">
        <div className="span-2">
          <span className="field-label">Imagen</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              Subir
            </button>
            <button type="button" className="btn" onClick={resetFrame}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Encajar
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) useFile(file);
              event.target.value = "";
            }}
          />
          <p className="mt-2 truncate text-sm text-mute">{error || imageName}</p>
        </div>

        <div className="span-2">
          <span className="field-label">Muestras</span>
          <div className="samples">
            {SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                className={sampleId === sample.id ? "sample sample-on" : "sample"}
                aria-pressed={sampleId === sample.id}
                aria-label={sample.name}
                onClick={() => useSample(sample.id, sample.src, sample.name)}
              >
                <img src={sample.src} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="field-label">Encaje</span>
          <div className="segment" role="group" aria-label="Encaje">
            <button type="button" aria-pressed={fit === "cover"} onClick={() => setFit("cover")}>
              Cubrir
            </button>
            <button type="button" aria-pressed={fit === "contain"} onClick={() => setFit("contain")}>
              Contener
            </button>
          </div>
        </div>

        <div>
          <span className="field-label">
            Zoom <span className="tabular-nums">{Math.round(zoom * 100)}</span>
          </span>
          <input
            type="range"
            min={35}
            max={400}
            value={Math.round(zoom * 100)}
            aria-label="Zoom"
            onChange={(event) => setZoom(Number(event.target.value) / 100)}
          />
        </div>

        <div className="span-2">
          <span className="field-label">Escena</span>
          <div className="chips" role="group" aria-label="Escena">
            {SCENES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip"
                aria-pressed={scene === item.id}
                onClick={() => setScene(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {template.hardware ? (
          <div className="span-2">
            <span className="field-label">Acabado</span>
            <div className="chips" role="group" aria-label="Acabado">
              {FINISHES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="chip"
                  aria-pressed={finish === item.id}
                  onClick={() => setFinish(item.id)}
                >
                  <span className={`swatch swatch-${item.id}`} aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="span-2 text-sm text-mute">
          {template.note}. Arrastra dentro del marco para encuadrar. La rueda hace zoom. Exporta a{" "}
          <span className="tabular-nums">
            {template.w}×{template.h}
          </span>{" "}
          px.
        </p>
      </aside>
    </div>
  );
}
