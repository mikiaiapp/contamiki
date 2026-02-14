
import React, { useState } from 'react';
import { AppState } from '../types';
import { generateFinancialAdvice } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { Sparkles, RefreshCcw, BrainCircuit, TrendingUp, Lightbulb, PieChart, ShieldCheck } from 'lucide-react';

interface AIInsightsProps {
  data: AppState;
}

export const AIInsights: React.FC<AIInsightsProps> = ({ data }) => {
  const [advice, setAdvice] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (data.transactions.length === 0) {
      setAdvice("### 📂 Datos insuficientes\nPor favor, añade algunos movimientos primero para que el motor de IA pueda analizar tus patrones de gasto y ahorro.");
      return;
    }
    setLoading(true);
    const result = await generateFinancialAdvice(data.transactions, data.families, data.accounts, data.categories);
    setAdvice(result);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
          <BrainCircuit size={14} /> Inteligencia Financiera
        </div>
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">
          Smart <span className="text-indigo-600">Insights.</span>
        </h2>
        <p className="text-slate-500 text-sm max-w-xl mx-auto font-medium">
          Nuestro motor de IA analiza tus movimientos bancarios para detectar ineficiencias, predecir tendencias y ayudarte a maximizar tu capacidad de ahorro.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center"><TrendingUp size={20}/></div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Tendencias</h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Identificamos si tu patrimonio crece o disminuye basándonos en tu flujo de caja real.</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center"><PieChart size={20}/></div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Tipología</h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Clasificamos tus gastos para detectar fugas de capital en categorías no esenciales.</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center"><Lightbulb size={20}/></div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Propuestas</h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Recibe consejos accionables para optimizar tus facturas y hábitos de consumo diarios.</p>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="relative group overflow-hidden bg-slate-950 text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-3"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="relative z-10 flex items-center gap-3">
            {/* Fix: changed RefreshCw to RefreshCcw to match the import on line 7 */}
            {loading ? <RefreshCcw className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {loading ? 'Procesando Motor IA...' : 'Generar Análisis Inteligente'}
          </span>
        </button>
      </div>

      {(advice || loading) && (
        <div className="bg-white p-8 sm:p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 min-h-[400px] relative overflow-hidden animate-in zoom-in-95 duration-500">
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <BrainCircuit size={200} />
          </div>
          
          {loading ? (
            <div className="space-y-8 animate-pulse relative z-10">
               <div className="h-8 bg-slate-100 rounded-2xl w-1/3"></div>
               <div className="space-y-3">
                  <div className="h-4 bg-slate-50 rounded-full w-full"></div>
                  <div className="h-4 bg-slate-50 rounded-full w-5/6"></div>
                  <div className="h-4 bg-slate-50 rounded-full w-4/6"></div>
               </div>
               <div className="h-32 bg-slate-50 rounded-[2rem] w-full"></div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="h-12 bg-slate-50 rounded-xl"></div>
                  <div className="h-12 bg-slate-50 rounded-xl"></div>
               </div>
            </div>
          ) : (
            <div className="prose prose-slate max-w-none relative z-10 
              prose-headings:text-slate-900 prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter
              prose-p:text-slate-600 prose-p:font-medium prose-p:leading-relaxed
              prose-li:text-slate-600 prose-li:font-medium
              prose-strong:text-indigo-600 prose-strong:font-black">
              <ReactMarkdown>{advice}</ReactMarkdown>
              
              <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-center gap-3 opacity-40">
                  <ShieldCheck size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Análisis auditado por ContaMiki AI Engine</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
