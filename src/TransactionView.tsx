                                    <div className="flex-1 min-w-0 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-4 items-center">
                                        <div className="col-span-2 text-[10px] font-bold text-slate-500 whitespace-nowrap flex items-center gap-2">
                                            {formatDateDisplay(t.date)}
                                            {t.isDuplicate && <span className="inline-flex items-center gap-1 text-[8px] text-amber-600 font-black uppercase tracking-tight bg-amber-100 px-1.5 py-0.5 rounded-md" title="Posible Duplicado"><AlertTriangle size={8}/> Dup</span>}
                                        </div>
                                        {/* CONCEPTO EDITABLE */}
                                        <input 
                                            type="text" 
                                            className="col-span-4 text-xs font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-300 outline-none truncate transition-colors"
                                            value={t.description}
                                            title={t.description}
                                            onChange={(e) => {
                                                const newArr = [...proposedTransactions];
                                                newArr[idx].description = e.target.value;
                                                setProposedTransactions(newArr);
                                            }}
                                        />
                                        <div className={`col-span-7 text-xs font-black text-right whitespace-nowrap ${getAmountColor(t.amount, t.type)}`}>{formatCurrency(t.amount)}</div>
                                        
                                        {/* SELECTOR CUSTOMIZADO 2 COLUMNAS (MODAL CENTRADO) */}
                                        <div className="col-span-3 relative">