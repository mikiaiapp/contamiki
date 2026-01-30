
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

    // 1. LÓGICA DE MARCAS (Heurística rápida)
    if (!query.includes(' ') && query.length > 2) {
        domains.push(`${queryLower}.es`);
        domains.push(`${queryLower}.com`);
        domains.push(`${queryLower}.net`);
    }

    // 2. BÚSQUEDA PROFUNDA CON IA (Gemini + Google Search)
    try {
        // Use process.env.API_KEY directly as required by world-class GenAI SDK standards.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        // Prompt especializado para PRIORIZAR marcas y obtener SLUGS técnicos para conceptos
        const prompt = `Analiza el término: "${query}".
        TAREA:
        1. Si es una marca conocida: identifica sus 3 dominios web oficiales.
        2. Si es un concepto (ej: teatro, ocio): genera 10 términos técnicos en inglés que sean SLUGS de iconos (ej: "teatro" -> "theater, drama, masks, stage, performer").
        
        BÚSQUEDA WEB REQUERIDA (Google Search):
        - "logo:${query}"
        - "official brand logo ${query}"
        - "vector icon ${query} png transparent"
        
        FORMATO DE RESPUESTA:
        DOMINIOS: dom1.com, dom2.es | CONCEPTOS: term1, term2, term3, term4, term5`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            },
        });

        const rawText = response.text || "";
        
        // Extraer URLs de Google Search (Grounding)
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            groundingChunks.forEach((chunk: any) => {
                if (chunk.web?.uri) {
                    const uri = chunk.web.uri;
                    if (uri.match(/\.(png|jpg|jpeg|svg|webp)$/i) || uri.includes('logo') || uri.includes('brand') || uri.includes('icon')) {
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
    } catch (error) {
        console.warn("Error en búsqueda IA de iconos:", error);
    }

    const results: {url: string, source: string}[] = [];

    // --- BLOQUE 1: LOGOTIPOS CORPORATIVOS (PRIORIDAD MÁXIMA) ---
    const uniqueDomains = Array.from(new Set(domains));
    uniqueDomains.forEach(domain => {
        results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: 'Marca Oficial' });
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: 'Avatar Marca' });
    });

    // --- BLOQUE 2: RESULTADOS DE BÚSQUEDA WEB (Incluye logo:termino) ---
    searchFoundUrls.forEach(url => {
        results.push({ url, source: 'Búsqueda Web' });
    });

    // --- BLOQUE 3: ICONOS CONCEPTUALES (SOPORTE DE ALTA CALIDAD) ---
    const effectiveKeywords = iconKeywords.length > 0 ? iconKeywords : [queryLower.replace(/\s+/g, '-')];
    effectiveKeywords.forEach(k => {
        const term = k.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (term.length < 2) return;

        // Intentar el concepto como marca (ej: theater.com) suele dar logos muy icónicos
        results.push({ url: `https://logo.clearbit.com/${term}.com?size=256`, source: 'Concepto Brand' });

        // Iconify - Colecciones elegidas por su exhaustividad conceptual
        results.push({ url: `https://api.iconify.design/mdi:${term}.svg`, source: 'Material' });
        results.push({ url: `https://api.iconify.design/ri:${term}-fill.svg`, source: 'Remix' });
        results.push({ url: `https://api.iconify.design/flat-color-icons:${term}.svg`, source: 'Color' });
        results.push({ url: `https://api.iconify.design/ph:${term}-bold.svg`, source: 'Phosphor' });
        results.push({ url: `https://api.iconify.design/solar:${term}-bold-duotone.svg`, source: 'Solar' });
        results.push({ url: `https://api.iconify.design/lucide:${term}.svg`, source: 'Lucide' });
        
        // Icons8
        results.push({ url: `https://img.icons8.com/fluency/256/${term}.png`, source: 'Fluency' });
        results.push({ url: `https://img.icons8.com/color/256/${term}.png`, source: 'Color' });
    });

    // --- BLOQUE 4: FALLBACK ---
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Iniciales'
    });

    // Consolidación final y limpieza de duplicados
    const seenUrls = new Set<string>();
    const finalResults = results.filter(item => {
        if (!item.url || seenUrls.has(item.url)) return false;
        seenUrls.add(item.url);
        return true;
    });

    return finalResults.slice(0, 80);
};
