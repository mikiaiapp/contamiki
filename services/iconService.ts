
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

    // 1. LÓGICA DE MARCAS (Heurística rápida para empresas)
    if (!query.includes(' ') && query.length > 2) {
        domains.push(`${queryLower}.es`);
        domains.push(`${queryLower}.com`);
        domains.push(`${queryLower}.org`);
    }

    // 2. BÚSQUEDA PROFUNDA CON IA (Gemini + Google Search)
    try {
        const apiKey = process.env.API_KEY;
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            
            // Prompt mejorado incluyendo la sugerencia de "logo:term" y búsqueda de pictogramas
            const prompt = `Analiza el término: "${query}".
            TAREA:
            1. Si es una marca conocida: lista sus 3 dominios más probables.
            2. Si es un concepto genérico (ej: "teatro", "supermercado"): genera 10 términos técnicos en inglés que correspondan a SLUGS de iconos (ej: "teatro" -> "theater, drama, masks, cinema, stage, actor, comedy, performing-arts").
            
            IMPORTANTE: Los conceptos deben ser palabras simples en minúsculas, separadas por guiones.
            
            ADICIONALMENTE: Realiza una búsqueda en Google usando estos operadores:
            - "logo:${query}"
            - "vector icon ${query} transparent png"
            - "site:flaticon.com ${query}"
            Extrae las URLs directas de imágenes de los resultados.
            
            FORMATO DE RESPUESTA:
            DOMINIOS: dom1.com, dom2.es | CONCEPTOS: term1, term2, term3, term4, term5, term6, term7, term8, term9, term10`;

            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }]
                },
            });

            const rawText = response.text || "";
            
            // Extraer URLs reales (Grounding / Google Search)
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                groundingChunks.forEach((chunk: any) => {
                    if (chunk.web?.uri) {
                        const uri = chunk.web.uri;
                        // Filtramos para intentar quedarnos con imágenes o páginas de iconos
                        if (uri.match(/\.(png|jpg|jpeg|svg|webp)$/i) || uri.includes('icon') || uri.includes('logo') || uri.includes('brand') || uri.includes('cdn')) {
                            searchFoundUrls.push(uri);
                        }
                    }
                });
            }

            // Parsear dominios y conceptos de la respuesta de texto
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

    // --- BLOQUE A: ICONOS CONCEPTUALES (Iconify & Emojis) ---
    // Si la IA no devolvió nada, intentamos con la query original limpia
    const effectiveKeywords = iconKeywords.length > 0 ? iconKeywords : [queryLower.replace(/\s+/g, '-')];

    effectiveKeywords.forEach(k => {
        const term = k.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (term.length < 2) return;

        // Iconify - Expandido con más colecciones ricas en conceptos
        results.push({ url: `https://api.iconify.design/mdi:${term}.svg`, source: 'Material' });
        results.push({ url: `https://api.iconify.design/ri:${term}-fill.svg`, source: 'Remix' });
        results.push({ url: `https://api.iconify.design/flat-color-icons:${term}.svg`, source: 'Flat Color' });
        results.push({ url: `https://api.iconify.design/lucide:${term}.svg`, source: 'Lucide' });
        results.push({ url: `https://api.iconify.design/ph:${term}-bold.svg`, source: 'Phosphor' });
        results.push({ url: `https://api.iconify.design/solar:${term}-bold-duotone.svg`, source: 'Solar Duotone' });
        results.push({ url: `https://api.iconify.design/line-md:${term}.svg`, source: 'Line Art' });
        results.push({ url: `https://api.iconify.design/fxemoji:${term}.svg`, source: 'Emoji' });
        results.push({ url: `https://api.iconify.design/noto:${term}.svg`, source: 'Noto' });
        
        // Icons8 - Estilos visuales potentes
        results.push({ url: `https://img.icons8.com/fluency/256/${term}.png`, source: 'Fluency' });
        results.push({ url: `https://img.icons8.com/color/256/${term}.png`, source: 'Color' });
        results.push({ url: `https://img.icons8.com/plasticine/256/${term}.png`, source: 'Plasticine' });
        results.push({ url: `https://img.icons8.com/stickers/256/${term}.png`, source: 'Sticker' });

        // Truco: Probar el concepto como si fuera un dominio (ej: theater.com) en Clearbit
        // A veces las empresas con nombre genérico tienen el logo perfecto del concepto
        domains.push(`${term}.com`);
    });

    // --- BLOQUE B: LOGOTIPOS CORPORATIVOS ---
    const uniqueDomains = Array.from(new Set(domains));
    uniqueDomains.forEach(domain => {
        results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: 'Brand Logo' });
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: 'Social Brand' });
    });

    // --- BLOQUE C: GROUNDING DE BÚSQUEDA WEB ---
    searchFoundUrls.forEach(url => {
        results.push({ url, source: 'Web Result' });
    });

    // --- BLOQUE D: ARTE PROCEDURAL (DiceBear) ---
    effectiveKeywords.slice(0, 2).forEach(k => {
        results.push({ url: `https://api.dicebear.com/9.x/icons/svg?seed=${k}`, source: 'Vector Art' });
        results.push({ url: `https://api.dicebear.com/9.x/shapes/svg?seed=${k}`, source: 'Abstract' });
    });

    // --- BLOQUE E: FALLBACK ---
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Iniciales'
    });

    // Consolidación final y eliminación de duplicados por URL
    const seenUrls = new Set<string>();
    const finalResults = results.filter(item => {
        if (!item.url || seenUrls.has(item.url)) return false;
        seenUrls.add(item.url);
        return true;
    });

    // Devolvemos una lista amplia para que el usuario tenga donde elegir
    return finalResults.slice(0, 70);
};
