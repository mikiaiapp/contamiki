
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e iconos representativos en internet.
 * PRIORIDAD: 1. Logos de Marca | 2. Resultados de Google | 3. Iconos Conceptuales
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    const query = text.trim();
    const queryLower = query.toLowerCase();
    
    let domains: string[] = [];
    let iconKeywords: string[] = [];
    let searchFoundUrls: string[] = [];

    // 1. LÓGICA DE MARCAS (Heurística rápida: si es una palabra sola, es probable que sea marca)
    if (!query.includes(' ') && query.length > 2) {
        domains.push(`${queryLower}.es`);
        domains.push(`${queryLower}.com`);
        domains.push(`${queryLower}.net`);
    }

    // 2. BÚSQUEDA PROFUNDA CON IA (Gemini + Google Search)
    try {
        const apiKey = process.env.API_KEY;
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            
            // Prompt optimizado para PRIORIZAR marcas y luego conceptos
            const prompt = `Analiza el término: "${query}".
            TAREA:
            1. Si es una marca o empresa: identifica sus 3 dominios web más probables.
            2. Si es un concepto (ej: teatro, comida): genera 8 términos en inglés para iconos (ej: "teatro" -> "theater, drama, masks, stage").
            
            BÚSQUEDA WEB REQUERIDA (Google Search):
            - "logo:${query}"
            - "official logo of ${query}"
            - "transparent png icon for ${query}"
            
            FORMATO DE RESPUESTA:
            DOMINIOS: dom1.com, dom2.es | CONCEPTOS: term1, term2, term3`;

            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }]
                },
            });

            const rawText = response.text || "";
            
            // Extraer URLs reales de Google Search (Grounding) - Estas suelen ser de alta calidad
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                groundingChunks.forEach((chunk: any) => {
                    if (chunk.web?.uri) {
                        const uri = chunk.web.uri;
                        if (uri.match(/\.(png|jpg|jpeg|svg|webp)$/i) || uri.includes('logo') || uri.includes('brand') || uri.includes('cdn')) {
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
                    const cs = p.replace('conceptos:', '').split(',').map(s => s.trim()).filter(s => s.length > 1);
                    iconKeywords.push(...cs);
                }
            });
        }
    } catch (error) {
        console.warn("Error en búsqueda IA de iconos:", error);
    }

    const results: {url: string, source: string}[] = [];

    // --- BLOQUE 1: LOGOTIPOS CORPORATIVOS (PRIORIDAD MÁXIMA) ---
    const uniqueDomains = Array.from(new Set(domains));
    uniqueDomains.forEach(domain => {
        results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: 'Logo Oficial' });
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: 'Brand Avatar' });
    });

    // --- BLOQUE 2: RESULTADOS DIRECTOS DE GOOGLE (Alta relevancia para "logo:teatro") ---
    searchFoundUrls.forEach(url => {
        results.push({ url, source: 'Web Search' });
    });

    // --- BLOQUE 3: ICONOS CONCEPTUALES (SOPORTE SECUNDARIO) ---
    const effectiveKeywords = iconKeywords.length > 0 ? iconKeywords : [queryLower.replace(/\s+/g, '-')];
    effectiveKeywords.forEach(k => {
        const term = k.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (term.length < 2) return;

        // Intentar buscar el concepto como marca también (ej: theater.com)
        results.push({ url: `https://logo.clearbit.com/${term}.com?size=256`, source: 'Concept Logo' });

        // Iconify - Colecciones sólidas
        results.push({ url: `https://api.iconify.design/mdi:${term}.svg`, source: 'Material' });
        results.push({ url: `https://api.iconify.design/ri:${term}-fill.svg`, source: 'Remix' });
        results.push({ url: `https://api.iconify.design/flat-color-icons:${term}.svg`, source: 'Flat' });
        results.push({ url: `https://api.iconify.design/ph:${term}-bold.svg`, source: 'Phosphor' });
        results.push({ url: `https://api.iconify.design/solar:${term}-bold-duotone.svg`, source: 'Solar' });
        results.push({ url: `https://api.iconify.design/lucide:${term}.svg`, source: 'Lucide' });
        
        // Icons8
        results.push({ url: `https://img.icons8.com/fluency/256/${term}.png`, source: 'Fluency' });
        results.push({ url: `https://img.icons8.com/color/256/${term}.png`, source: 'Color' });
    });

    // --- BLOQUE 4: FALLBACKS ---
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Iniciales'
    });

    // Consolidación final eliminando duplicados
    const seenUrls = new Set<string>();
    const finalResults = results.filter(item => {
        if (!item.url || seenUrls.has(item.url)) return false;
        seenUrls.add(item.url);
        return true;
    });

    return finalResults.slice(0, 80);
};
