
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e iconos representativos en internet.
 * Realiza una búsqueda dual profunda: 
 * 1. Marcas corporativas (Dominios + Social)
 * 2. Conceptos semánticos (Traducción + Sinónimos para Iconos)
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    const query = text.trim();
    const queryLower = query.toLowerCase();
    
    let domains: string[] = [];
    let iconKeywords: string[] = [];

    // 1. HEURÍSTICA INMEDIATA
    // Si no tiene espacios, es un candidato a dominio (marca)
    if (!query.includes(' ')) {
        domains.push(`${queryLower}.es`);
        domains.push(`${queryLower}.com`);
    }
    // Añadimos el query original por si acaso
    iconKeywords.push(queryLower);

    // 2. ENRIQUECIMIENTO CON IA (Crucial para traducción y conceptos)
    try {
        const apiKey = process.env.API_KEY;
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Analiza este término de contabilidad/gastos: "${query}".
                
                Responde estrictamente con una lista de palabras separadas por comas que incluya:
                1. Si es una marca o empresa: sus 2 dominios web más probables (ej. "mercadona.es, mercadona.com").
                2. Si es un concepto o actividad: 5 palabras clave en INGLÉS que mejor lo representen para buscar un icono (ej. si es "ocio" -> "leisure, cinema, party, game, popcorn"). 
                
                IMPORTANTE: Solo devuelve la lista de palabras, sin explicaciones ni encabezados.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const cleanResponse = (response.text || "").toLowerCase().trim().replace(/[`*]/g, '');
            const parts = cleanResponse.split(',').map(p => p.trim()).filter(p => p.length > 1);
            
            parts.forEach(p => {
                if (p.includes('.') && !p.includes(' ')) {
                    domains.push(p);
                } else {
                    iconKeywords.push(p);
                }
            });
        }
    } catch (error) {
        console.warn("IA Icon enrichment failed:", error);
    }

    const results: {url: string, source: string}[] = [];

    // A. FUENTES DE MARCAS (Basadas en dominios)
    const uniqueDomains = Array.from(new Set(domains));
    uniqueDomains.forEach(domain => {
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: 'Marca (Social)' });
        results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: 'Marca (HQ)' });
        results.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: 'Marca (Favicon)' });
    });

    // B. FUENTES DE CONCEPTOS (Basadas en keywords en inglés/español)
    const uniqueKeywords = Array.from(new Set(iconKeywords));
    uniqueKeywords.forEach(k => {
        const term = k.replace(/\s+/g, '-');
        // Icons8 es muy estricto con los nombres en inglés. La IA nos ha dado términos en inglés.
        // Probamos varios estilos populares de Icons8
        results.push({ url: `https://img.icons8.com/fluency/256/${term}.png`, source: 'Icono Fluency' });
        results.push({ url: `https://img.icons8.com/color/256/${term}.png`, source: 'Icono Color' });
        results.push({ url: `https://img.icons8.com/clouds/256/${term}.png`, source: 'Icono Clouds' });
        results.push({ url: `https://img.icons8.com/emoji/256/${term}-emoji.png`, source: 'Emoji' });
        results.push({ url: `https://img.icons8.com/stickers/256/${term}.png`, source: 'Sticker' });
    });

    // C. FALLBACK (Avatar visual con iniciales)
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Iniciales'
    });

    // Limpiar duplicados de URL y filtrar
    const seenUrls = new Set<string>();
    const finalResults = results.filter(item => {
        if (seenUrls.has(item.url)) return false;
        seenUrls.add(item.url);
        return true;
    });

    return finalResults.slice(0, 30); // Devolvemos un pool amplio para que el usuario elija
};
