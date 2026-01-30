
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e iconos representativos.
 * Utiliza IA para decidir si buscar un dominio de marca o palabras clave para iconos conceptuales.
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
                contents: `Analyze the term: "${query}". 
                If it's a BRAND, return its main web domains (e.g. netflix.com).
                If it's a GENERAL CATEGORY (e.g. "ocio", "viajes", "seguros", "restaurantes"), return the 3 best descriptive English keywords for an icon search (e.g. "leisure", "travel", "insurance", "restaurant").
                Return ONLY a comma-separated list. No text, no quotes.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const rawResponse = (response.text || "").toLowerCase();
            items = rawResponse.split(',').map(i => i.trim()).filter(i => i.length > 2);
        }
    } catch (error) {
        console.warn("AI icon extraction failed, using fallback.");
    }

    // Fallback: Si la IA falla, usamos el término directo como palabra clave
    if (items.length === 0) {
        items = [query.toLowerCase()];
    }

    const results: {url: string, source: string}[] = [];
    
    items.forEach(item => {
        const isDomain = item.includes('.');
        
        if (isDomain) {
            // Fuentes para marcas
            results.push({ url: `https://logo.clearbit.com/${item}?size=256`, source: item });
            results.push({ url: `https://unavatar.io/${item}?fallback=false`, source: item });
            results.push({ url: `https://www.google.com/s2/favicons?domain=${item}&sz=128`, source: item });
        } else {
            // Fuentes para conceptos genéricos (Icons8 Fluency)
            const keyword = item.replace(/\s+/g, '-');
            results.push({ url: `https://img.icons8.com/fluency/256/${keyword}.png`, source: item });
            results.push({ url: `https://img.icons8.com/color/256/${keyword}.png`, source: item });
        }
    });

    // Siempre añadir un avatar de texto como última opción
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Generado'
    });

    // Eliminar duplicados y limitar
    const uniqueResults = Array.from(new Map(results.map(item => [item.url, item])).values());
    return uniqueResults.slice(0, 12);
};
