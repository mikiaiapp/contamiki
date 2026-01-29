import React, { useState } from 'react';
import { AppState } from '../types';
import { generateFinancialAdvice } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { Sparkles, RefreshCcw } from 'lucide-react';

interface AIInsightsProps {
  data: AppState;
}

export const AIInsights: React.FC<AIInsightsProps> = ({ data }) => {
  const [advice, setAdvice] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (data.transactions.length === 0) {
      setAdvice("Por favor añade algunos movimientos primero para obtener información.");
      return;
    }
    setLoading(true);
    // Ahora pasamos categorías también
    const result = await generateFinancialAdvice(data.transactions, data.families, data.accounts, data.categories);
    setAdvice(result);
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-2">
          <Sparkles className="text-purple-500" /> Asesor Financiero IA
        </h2>
        <p className="text-slate-500">
          Obtén información personalizada sobre tus hábitos de gasto impulsada por Gemini.
        </p>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-3 rounded-full font-medium shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <RefreshCcw className="animate-spin" size={20} />
          ) : (
            <Sparkles size={20} />
          )}
          {loading ? 'Analizando...' : 'Analizar mis finanzas'}
        </button>
      </div>

      {(advice || loading) && (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-purple-100 min-h-[200px]">
          {loading ? (
            <div className="space-y-4 animate-pulse">
               <div className="h-4 bg-slate-100 rounded w-3/4"></div>
               <div className="h-4 bg-slate-100 rounded w-1/2"></div>
               <div className="h-4 bg-slate-100 rounded w-5/6"></div>
            </div>
          ) : (
            <div className="prose prose-slate max-w-none">
              <ReactMarkdown>{advice}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
};