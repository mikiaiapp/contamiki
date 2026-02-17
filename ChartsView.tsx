        {/* DETAIL MODAL FOR CHART POINT */}
        {pointDetailTxs && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[250] p-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 sm:p-8 relative border border-white/20 flex flex-col max-h-[85vh]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Detalle del Periodo</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {localFilter.timeRange === 'MONTH' ? formatDateDisplay(pointDetailTxs.date) : formatDateLabel(pointDetailTxs.date + '-01')}
                            </p>
                        </div>
                        <button onClick={() => setPointDetailTxs(null)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={20}/></button>
                    </div>
                    
                    <div className="overflow-y-auto custom-scrollbar flex-1 -mx-2 px-2">
                        {pointDetailTxs.txs.map(t => (
                            <div key={t.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 rounded-xl px-2 transition-colors">
                                <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-4">
                                    <span className="text-xs font-bold text-slate-700 uppercase truncate" title={t.description}>{t.description}</span>
                                    <span className="text-[9px] text-slate-400 font-medium">{formatDateDisplay(t.date)}</span>
                                </div>
                                <span className={`text-sm font-black whitespace-nowrap ${getAmountColorClass(t.amount)}`}>{formatCurrency(t.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};