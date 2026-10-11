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
  type GroupId,
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
  const [section, setSection] = useState<GroupId>(TEMPLATES[0]!.group);
  const [scene, setScene] = useState<SceneId>("papel");
  const [finish, setFinish] = useState<FinishId>("grafito");
  const [fit, setFit] = useState<FitMode>("cover");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [yaw, setYaw] = useState(26);
  const [pitch, setPitch] = useState(14);
  const [cut, setCut] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState("Patio");
  const [sampleId, setSampleId] = useState<string | null>("patio");
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState<null | "escena" | "corte">(null);
  const [fontTick, setFontTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const gesture = useRef<
    | { kind: "pan"; x: number; y: number; panX: number; panY: number }
    | { kind: "orbit"; x: number; y: number; yaw: number; pitch: number }
    | null
  >(null);

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
      transparent: cut,
      yaw,
      pitch,
      art: { image, zoom, panX: pan.x, panY: pan.y, fit },
    });
    fitCanvas();
  }, [templateId, scene, finish, zoom, pan, image, fit, yaw, pitch, cut, fontTick, fitCanvas]);

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
        yaw,
        pitch,
        quiet: true,
        art: { image, zoom: 1, panX: 0, panY: 0, fit: "cover" },
      });
    }
  }, [image, scene, finish, yaw, pitch, fontTick]);

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
    const next = templateById(id);
    setTemplateId(next.id);
    setSection(next.group);
    resetFrame();
  }

  function chooseSection(group: GroupId) {
    setSection(group);
    if (template.group === group) return;
    const first = TEMPLATES.find((item) => item.group === group);
    if (!first) return;
    setTemplateId(first.id);
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

  function download(transparent: boolean) {
    if (!image) return;
    const current = templateById(templateId);
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = current.w;
    exportCanvas.height = current.h;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;
    renderMockup(ctx, current.id, {
      scene,
      finish,
      transparent,
      yaw,
      pitch,
      art: { image, zoom, panX: pan.x, panY: pan.y, fit },
    });
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = transparent ? `mesa-${current.id}-sin-fondo.png` : `mesa-${current.id}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setSaved(transparent ? "corte" : "escena");
      window.setTimeout(() => setSaved(null), 1600);
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
    if (inside) {
      canvas.setPointerCapture(event.pointerId);
      gesture.current = { kind: "pan", x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    if (template.dimensional) {
      canvas.setPointerCapture(event.pointerId);
      gesture.current = { kind: "orbit", x: event.clientX, y: event.clientY, yaw, pitch };
    }
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const current = gesture.current;
    if (!canvas || !current) return;
    if (current.kind === "pan") {
      const bounds = canvas.getBoundingClientRect();
      const sx = canvas.width / bounds.width;
      const sy = canvas.height / bounds.height;
      setPan({
        x: current.panX + (event.clientX - current.x) * sx,
        y: current.panY + (event.clientY - current.y) * sy,
      });
      return;
    }
    setYaw(Math.min(36, Math.max(-36, current.yaw + (event.clientX - current.x) * 0.15)));
    setPitch(Math.min(28, Math.max(-24, current.pitch + (event.clientY - current.y) * 0.12)));
  }

  function pointerUp() {
    gesture.current = null;
  }

  return (
    <div className="studio">
      <header className="head flex items-center justify-between gap-3 border-b border-rule bg-sheet px-4 py-3">
        <div className="min-w-0">
          <h1 className="mark text-3xl text-ink">Mesa</h1>
          <p className="truncate text-sm text-mute">Sección, modelo y PNG.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn" onClick={() => download(true)} disabled={!image}>
            {saved === "corte" ? "Listo" : "Sin fondo"}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => download(false)} disabled={!image}>
            <Download className="size-4" aria-hidden="true" />
            {saved === "escena" ? "Listo" : "Descargar"}
          </button>
        </div>
      </header>

      <nav className="catalog" aria-label="Marcos">
        <div className="section-tabs" role="tablist" aria-label="Secciones">
          {GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              role="tab"
              aria-selected={section === group}
              onClick={() => chooseSection(group)}
            >
              {group}
            </button>
          ))}
        </div>
        {GROUPS.map((group) => (
          <div className={section === group ? "group group-open" : "group"} key={group}>
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
                    <em>{item.dimensional ? "Modelo 3D" : "Modelo"}</em>
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
          className={cut ? "is-cut" : undefined}
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
            <button
              type="button"
              className="chip"
              aria-pressed={cut}
              onClick={() => setCut((value) => !value)}
            >
              Ver sin fondo
            </button>
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

        {template.dimensional ? (
          <div className="span-2">
            <span className="field-label">Volumen</span>
            <div className="chips" role="group" aria-label="Ángulo del modelo">
              <button
                type="button"
                className="chip"
                aria-pressed={yaw === 26 && pitch === 14}
                onClick={() => {
                  setYaw(26);
                  setPitch(14);
                }}
              >
                Ángulo
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={yaw === 0 && pitch === 0}
                onClick={() => {
                  setYaw(0);
                  setPitch(0);
                }}
              >
                Plano
              </button>
            </div>
            <span className="field-label mt-3">
              Giro <span className="tabular-nums">{Math.round(yaw)}°</span>
            </span>
            <input
              type="range"
              min={-36}
              max={36}
              value={Math.round(yaw)}
              aria-label="Giro"
              onChange={(event) => setYaw(Number(event.target.value))}
            />
            <span className="field-label mt-3">
              Inclinación <span className="tabular-nums">{Math.round(pitch)}°</span>
            </span>
            <input
              type="range"
              min={-24}
              max={28}
              value={Math.round(pitch)}
              aria-label="Inclinación"
              onChange={(event) => setPitch(Number(event.target.value))}
            />
          </div>
        ) : null}

        <p className="span-2 text-sm text-mute">
          {template.note}.{" "}
          {template.dimensional
            ? "Arrastra la pantalla para encuadrar y el cuerpo para girar el modelo."
            : "Arrastra dentro del marco para encuadrar."}{" "}
          La rueda hace zoom. Descarga el PNG con la escena o sin fondo.
        </p>
      </aside>
    </div>
  );
}
