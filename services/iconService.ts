
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
            
            // Prompt especializado en distinguir Marca vs Concepto
            const prompt = `Analiza el término: "${query}".
            TAREA:
            1. Si es una marca comercial: lista sus 2 dominios más probables (ej: "amazon.es").
            2. Si es un concepto genérico: busca los 5 términos en inglés más precisos para buscar un ICONO o PICTOGRAMA (ej: "supermercado" -> "grocery-store, shopping-basket, supermarket-cart").
            
            ADICIONALMENTE: Realiza una búsqueda en Google de "icono flat de ${query}" y devuelve las URLs de imágenes que encuentres.
            
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
            
            // Extraer URLs reales encontradas en la búsqueda (Grounding)
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                groundingChunks.forEach((chunk: any) => {
                    if (chunk.web?.uri) {
                        // Solo añadimos si parece una imagen o un sitio de iconos
                        const uri = chunk.web.uri;
                        if (uri.match(/\.(png|jpg|jpeg|svg|webp)$/i) || uri.includes('icon') || uri.includes('logo') || uri.includes('vector')) {
                            searchFoundUrls.push(uri);
                        }
                    }
                });
            }

            // Parsear dominios y conceptos del texto generado
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

    // --- BLOQUE A: ICONOS CONCEPTUALES (Prioridad para términos genéricos) ---
    const uniqueKeywords = Array.from(new Set(iconKeywords));
    if (uniqueKeywords.length > 0 || query.includes(' ')) {
        uniqueKeywords.forEach(k => {
            const term = k.replace(/\s+/g, '-');
            
            // 1. DiceBear (Generador de iconos vectoriales - Muy fiable para conceptos)
            results.push({ url: `https://api.dicebear.com/9.x/icons/svg?seed=${term}`, source: 'Icono Vectorial' });
            
            // 2. Icons8 Variantes (Conceptos)
            results.push({ url: `https://img.icons8.com/fluency/256/${term}.png`, source: 'Icono Fluency' });
            results.push({ url: `https://img.icons8.com/color/256/${term}.png`, source: 'Icono Color' });
            results.push({ url: `https://img.icons8.com/clouds/256/${term}.png`, source: 'Icono Clouds' });
            results.push({ url: `https://img.icons8.com/stickers/256/${term}.png`, source: 'Sticker' });
            results.push({ url: `https://img.icons8.com/cute-clipart/256/${term}.png`, source: 'Clipart' });
        });
    }

    // --- BLOQUE B: LOGOTIPOS CORPORATIVOS ---
    const uniqueDomains = Array.from(new Set(domains));
    uniqueDomains.forEach(domain => {
        results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: 'Logo Empresa' });
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: 'Social Logo' });
        results.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: 'Favicon' });
    });

    // --- BLOQUE C: IMÁGENES ENCONTRADAS WEB (Google Grounding) ---
    searchFoundUrls.forEach(url => {
        results.push({ url, source: 'Imagen Web' });
    });

    // --- BLOQUE D: FALLBACK (Iniciales) ---
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Iniciales'
    });

    // Limpieza de duplicados y filtrado de nulos
    const seenUrls = new Set<string>();
    const finalResults = results.filter(item => {
        if (!item.url || seenUrls.has(item.url)) return false;
        seenUrls.add(item.url);
        return true;
    });

    return finalResults.slice(0, 36);
};
