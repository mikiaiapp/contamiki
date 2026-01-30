
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e iconos representativos en internet.
 * Utiliza Google Search Grounding para encontrar los mejores términos e imágenes.
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    const query = text.trim();
    const queryLower = query.toLowerCase();
    
    let domains: string[] = [];
    let iconKeywords: string[] = [];
    let searchFoundUrls: string[] = [];

    // 1. HEURÍSTICA INMEDIATA PARA MARCAS
    if (!query.includes(' ')) {
        domains.push(`${queryLower}.es`);
        domains.push(`${queryLower}.com`);
    }
    iconKeywords.push(queryLower);

    // 2. BÚSQUEDA CON GEMINI + GOOGLE SEARCH
    try {
        const apiKey = process.env.API_KEY;
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Busca iconos y representaciones visuales para el concepto: "${query}".
                
                Si es una marca, identifica su dominio oficial.
                Si es un concepto genérico (ej: ocio, impuestos, supermercado), busca los 5 términos en inglés más usados para sus iconos (ej: "leisure", "tax", "shopping-cart").
                
                Responde en una línea con este formato:
                DOMINIOS: dom1.com, dom2.es | KEYWORDS: word1, word2, word3`,
                config: {
                    tools: [{ googleSearch: {} }] // Usamos Google Search para mayor precisión
                },
            });

            const rawText = response.text || "";
            
            // Extraer URLs de la búsqueda de Google (Grounding)
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                groundingChunks.forEach((chunk: any) => {
                    if (chunk.web?.uri) searchFoundUrls.push(chunk.web.uri);
                });
            }

            // Parsear respuesta de texto
            const cleanText = rawText.toLowerCase().trim();
            const parts = cleanText.split('|');
            
            parts.forEach(part => {
                if (part.includes('dominios:')) {
                    const d = part.replace('dominios:', '').split(',').map(s => s.trim()).filter(s => s.includes('.'));
                    domains.push(...d);
                }
                if (part.includes('keywords:')) {
                    const k = part.replace('keywords:', '').split(',').map(s => s.trim()).filter(s => s.length > 2);
                    iconKeywords.push(...k);
                }
            });
        }
    } catch (error) {
        console.warn("Gemini Search failed, using fallbacks:", error);
    }

    const results: {url: string, source: string}[] = [];

    // A. AGREGAR RESULTADOS DE MARCAS (Dominios)
    const uniqueDomains = Array.from(new Set(domains));
    uniqueDomains.forEach(domain => {
        results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: 'Marca (HQ)' });
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: 'Marca (Social)' });
        results.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: 'Favicon' });
    });

    // B. AGREGAR RESULTADOS CONCEPTUALES (Basados en las Keywords encontradas por Google Search)
    const uniqueKeywords = Array.from(new Set(iconKeywords));
    uniqueKeywords.forEach(k => {
        const term = k.replace(/\s+/g, '-');
        // Probamos múltiples variantes de Icons8 que son el estándar para "iconos conceptuales"
        results.push({ url: `https://img.icons8.com/fluency/256/${term}.png`, source: 'Icono Fluency' });
        results.push({ url: `https://img.icons8.com/color/256/${term}.png`, source: 'Icono Color' });
        results.push({ url: `https://img.icons8.com/clouds/256/${term}.png`, source: 'Icono Clouds' });
        results.push({ url: `https://img.icons8.com/stickers/256/${term}.png`, source: 'Sticker' });
        results.push({ url: `https://img.icons8.com/emoji/256/${term}-emoji.png`, source: 'Emoji' });
        results.push({ url: `https://img.icons8.com/cute-clipart/256/${term}.png`, source: 'Clipart' });
    });

    // C. AGREGAR URLs ENCONTRADAS POR GOOGLE (Grounding) que parezcan imágenes o favicons
    searchFoundUrls.forEach(url => {
        if (url.match(/\.(jpeg|jpg|gif|png|svg)$/) || url.includes('icon') || url.includes('logo')) {
            results.push({ url, source: 'Búsqueda Web' });
        }
    });

    // D. FALLBACK FINAL
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Iniciales'
    });

    // Limpieza de duplicados y filtrado de resultados rotos
    const seenUrls = new Set<string>();
    const finalResults = results.filter(item => {
        if (seenUrls.has(item.url)) return false;
        seenUrls.add(item.url);
        return true;
    });

    return finalResults.slice(0, 32);
};
