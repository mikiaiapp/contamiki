import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import { ZoomIn, ZoomOut, RotateCw, Loader2, FileText, Check } from 'lucide-react';

// Configure local worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

interface PdfViewerProps {
  url: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.2);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        let loadingTask: any;
        if (url.startsWith('data:')) {
          const base64Data = url.replace(/^data:[^;]+;base64,/, '');
          const binaryString = window.atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          loadingTask = pdfjsLib.getDocument({ data: bytes });
        } else {
          loadingTask = pdfjsLib.getDocument({ url });
        }

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.error('Error cargando documento PDF:', err);
        setError(err.message || 'No se pudo cargar el documento PDF');
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [url]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 select-none">
      {/* Barra de herramientas superior */}
      <div className="px-4 py-2.5 bg-slate-950/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between text-white shrink-0 z-10">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-indigo-400" />
          <span className="text-xs font-bold text-slate-200">
            {numPages > 0 ? `${numPages} página${numPages === 1 ? '' : 's'}` : 'Cargando...'}
          </span>
        </div>

        {/* Controles de Zoom */}
        <div className="flex items-center gap-1.5 bg-white/10 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setScale(s => Math.max(0.6, Math.round((s - 0.2) * 10) / 10))}
            className="p-1 hover:bg-white/20 active:bg-white/30 rounded-lg text-white transition-colors cursor-pointer touch-action-manipulation"
            title="Reducir zoom"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] font-mono font-bold px-1.5 text-slate-300 min-w-[42px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale(s => Math.min(2.5, Math.round((s + 0.2) * 10) / 10))}
            className="p-1 hover:bg-white/20 active:bg-white/30 rounded-lg text-white transition-colors cursor-pointer touch-action-manipulation"
            title="Aumentar zoom"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => setScale(1.2)}
            className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider hover:bg-white/20 active:bg-white/30 rounded-lg text-indigo-300 transition-colors cursor-pointer touch-action-manipulation ml-1"
            title="Restablecer tamaño normal"
          >
            Ajustar
          </button>
        </div>
      </div>

      {/* Área de visualización con scroll continuo de todas las páginas */}
      <div 
        ref={containerRef} 
        className="flex-1 overflow-y-auto overflow-x-auto p-4 flex flex-col items-center gap-6 bg-slate-900/60 custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {loading && (
          <div className="flex flex-col items-center justify-center my-auto py-12 text-slate-400 gap-3">
            <Loader2 size={32} className="animate-spin text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-wider">Cargando todas las páginas del ticket...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center my-auto py-12 text-rose-400 gap-2 text-center p-4">
            <p className="text-sm font-bold">Error al procesar el archivo PDF</p>
            <p className="text-xs text-slate-400 max-w-sm">{error}</p>
          </div>
        )}

        {!loading && !error && pdfDocRef.current && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <PdfPageItem 
            key={`page-${pageNum}`} 
            pdf={pdfDocRef.current} 
            pageNum={pageNum} 
            totalPages={numPages} 
            scale={scale} 
          />
        ))}
      </div>
    </div>
  );
};

interface PdfPageItemProps {
  pdf: any;
  pageNum: number;
  totalPages: number;
  scale: number;
}

const PdfPageItem: React.FC<PdfPageItemProps> = ({ pdf, pageNum, totalPages, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState<boolean>(true);

  useEffect(() => {
    let renderTask: any = null;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        setRendering(true);
        const page = await pdf.getPage(pageNum);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Soporte para pantallas Retina (iPhone, iPad, MacBook)
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        renderTask = page.render({
          canvasContext: ctx,
          viewport: viewport
        });

        await renderTask.promise;
        if (!isCancelled) {
          setRendering(false);
        }
      } catch (err: any) {
        if (!isCancelled && err.name !== 'RenderingCancelledException') {
          console.error(`Error renderizando página ${pageNum}:`, err);
          setRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [pdf, pageNum, scale]);

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="flex items-center justify-between w-full px-2 text-[10px] font-bold text-slate-400">
        <span className="bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 text-slate-300">
          Página {pageNum} de {totalPages}
        </span>
      </div>
      <div className="relative rounded-xl overflow-hidden shadow-2xl bg-white border border-slate-700/50">
        {rendering && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          </div>
        )}
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
};
