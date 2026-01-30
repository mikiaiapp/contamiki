
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e iconos representativos en internet.
 * Clasifica la búsqueda en marcas (dominios) o conceptos (palabras clave).
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    const query = text.trim();
    let items: string[] = [];

    try {
        const apiKey = process.env.API_KEY;
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Analiza este término financiero o comercial: "${query}". 
                
                Instrucciones:
                1. Si es una MARCA o ESTABLECIMIENTO (ej. Netflix, Amazon, Mercadona, Santander), devuelve SOLO su dominio web principal (ej. "netflix.com").
                2. Si es un CONCEPTO o CATEGORÍA (ej. ocio, comida, viajes, salud), devuelve SOLO 3 palabras clave en inglés para buscar iconos (ej. "travel, suitcase, vacation").
                
                Responde ÚNICAMENTE con una lista separada por comas. Sin explicaciones ni etiquetas.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const rawResponse = (response.text || "").toLowerCase();
            // Limpieza de la respuesta para obtener solo los términos
            items = rawResponse.split(',')
                .map(i => i.replace(/[^a-z0-9.\-_]/gi, '').trim())
                .filter(i => i.length >= 2);
        }
    } catch (error) {
        console.warn("Error en IA de iconos, usando búsqueda directa.");
    }

    // Fallback: Si la IA falla, usamos el texto original
    if (items.length === 0) {
        items = [query.toLowerCase()];
    }

    const results: {url: string, source: string}[] = [];
    
    items.forEach(item => {
        // Un dominio suele tener un punto y no espacios
        const isDomain = item.includes('.') && !item.includes(' ');
        
        if (isDomain) {
            // Buscadores de logotipos de marcas
            results.push({ url: `https://logo.clearbit.com/${item}?size=256`, source: 'Clearbit' });
            results.push({ url: `https://unavatar.io/${item}?fallback=false`, source: 'Unavatar' });
            results.push({ url: `https://www.google.com/s2/favicons?domain=${item}&sz=128`, source: 'Google' });
        } else {
            // Buscadores de iconos conceptuales (Icons8 Fluency - Gran calidad visual)
            const keyword = item.replace(/\s+/g, '-');
            results.push({ url: `https://img.icons8.com/fluency/256/${keyword}.png`, source: 'Icons8' });
            results.push({ url: `https://img.icons8.com/color/256/${keyword}.png`, source: 'Icons8' });
            results.push({ url: `https://img.icons8.com/clouds/256/${keyword}.png`, source: 'Icons8' });
            results.push({ url: `https://img.icons8.com/plasticine/256/${keyword}.png`, source: 'Icons8' });
        }
    });

    // Avatar de texto como respaldo final
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Auto'
    });

    // Filtro de duplicados por URL
    const uniqueResults = Array.from(new Map(results.map(item => [item.url, item])).values());
    return uniqueResults.slice(0, 15);
};
