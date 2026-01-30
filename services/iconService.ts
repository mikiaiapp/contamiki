
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e iconos representativos en internet.
 * Optimizado para distinguir entre marcas corporativas e iconos conceptuales genéricos.
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    const query = text.trim();
    const queryLower = query.toLowerCase();
    
    let domains: string[] = [];
    let iconKeywords: string[] = [];
    let searchFoundUrls: string[] = [];

    // 1. LÓGICA DE MARCAS (Heurística rápida)
    if (!query.includes(' ')) {
        domains.push(`${queryLower}.es`);
        domains.push(`${queryLower}.com`);
    }

    // 2. BÚSQUEDA PROFUNDA CON IA (Gemini + Google Search)
    try {
        const apiKey = process.env.API_KEY;
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            
            // Prompt especializado en distinguir Marca vs Concepto con múltiples sinónimos
            const prompt = `Analiza el término: "${query}".
            TAREA:
            1. Si es una marca comercial conocida: lista sus 2 dominios más probables (ej: "amazon.es").
            2. Si es un concepto genérico: busca los 6 términos más precisos en inglés para buscar un ICONO (sinónimos cortos). Ej: "ahorro" -> "savings, pig-bank, wallet, money, coin, safe".
            
            ADICIONALMENTE: Realiza una búsqueda en Google de "transparent png icon for ${query}" y devuelve las URLs de imágenes.
            
            FORMATO DE RESPUESTA:
            DOMINIOS: dom1.com, dom2.es | CONCEPTOS: term1, term2, term3, term4, term5, term6`;

            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }]
                },
            });

            const rawText = response.text || "";
            
            // Extraer URLs reales de la red (Grounding)
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                groundingChunks.forEach((chunk: any) => {
                    if (chunk.web?.uri) {
                        const uri = chunk.web.uri;
                        // Filtro agresivo para quedarnos con imágenes o sitios de recursos
                        if (uri.match(/\.(png|jpg|jpeg|svg|webp)$/i) || uri.includes('icon') || uri.includes('logo') || uri.includes('vector') || uri.includes('cdn')) {
                            searchFoundUrls.push(uri);
                        }
                    }
                });
            }

            // Parsear dominios y conceptos
            const parts = rawText.toLowerCase().split('|');
            parts.forEach(p => {
                if (p.includes('dominios:')) {
                    const ds = p.replace('dominios:', '').split(',').map(s => s.trim()).filter(s => s.includes('.'));
                    domains.push(...ds);
                }
                if (p.includes('conceptos:')) {
                    const cs = p.replace('conceptos:', '').split(',').map(s => s.trim()).filter(s => s.length > 2);
                    iconKeywords.push(...cs);
                }
            });
        }
    } catch (error) {
        console.warn("Error en búsqueda IA de iconos:", error);
    }

    const results: {url: string, source: string}[] = [];

    // --- BLOQUE A: ICONOS CONCEPTUALES (Enriquecido con Iconify) ---
    const uniqueKeywords = Array.from(new Set(iconKeywords));
    if (uniqueKeywords.length > 0 || query.includes(' ')) {
        uniqueKeywords.forEach(k => {
            const term = k.replace(/\s+/g, '-');
            
            // 1. Iconify API (Iconos vectoriales profesionales)
            results.push({ url: `https://api.iconify.design/solar:${term}-bold-duotone.svg`, source: 'Solar Duotone' });
            results.push({ url: `https://api.iconify.design/lucide:${term}.svg`, source: 'Lucide' });
            results.push({ url: `https://api.iconify.design/ph:${term}-fill.svg`, source: 'Phosphor' });
            results.push({ url: `https://api.iconify.design/tabler:${term}.svg`, source: 'Tabler' });
            results.push({ url: `https://api.iconify.design/material-symbols:${term}.svg`, source: 'Material' });
            
            // 2. DiceBear (Procedural)
            results.push({ url: `https://api.dicebear.com/9.x/icons/svg?seed=${term}`, source: 'Vector Art' });
            
            // 3. Icons8 (Coloridos)
            results.push({ url: `https://img.icons8.com/fluency/256/${term}.png`, source: 'Fluency' });
            results.push({ url: `https://img.icons8.com/color/256/${term}.png`, source: 'Color' });
            results.push({ url: `https://img.icons8.com/stickers/256/${term}.png`, source: 'Sticker' });
        });
    }

    // --- BLOQUE B: LOGOTIPOS CORPORATIVOS (Se mantiene intacto) ---
    const uniqueDomains = Array.from(new Set(domains));
    uniqueDomains.forEach(domain => {
        results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: 'Logo Oficial' });
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: 'Social' });
        results.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: 'Favicon' });
    });

    // --- BLOQUE C: IMÁGENES WEB (Google Search Grounding) ---
    searchFoundUrls.forEach(url => {
        results.push({ url, source: 'Web Image' });
    });

    // --- BLOQUE D: FALLBACK ---
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Iniciales'
    });

    // Consolidación final
    const seenUrls = new Set<string>();
    const finalResults = results.filter(item => {
        if (!item.url || seenUrls.has(item.url)) return false;
        seenUrls.add(item.url);
        return true;
    });

    return finalResults.slice(0, 48); // Aumentamos el límite para dar más opciones
};
