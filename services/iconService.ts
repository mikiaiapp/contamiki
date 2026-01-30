
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
                1. If it's a specific BRAND or COMPANY (e.g. "Netflix", "Santander", "Amazon"), return its primary web domain (e.g. "netflix.com").
                2. If it's a GENERAL CATEGORY or ACTIVITY (e.g. "ocio", "viajes", "seguros", "restaurantes", "salud"), return 3 descriptive English nouns for an icon search (e.g. "leisure, joystick, cinema" for "ocio").
                Return ONLY a comma-separated list. No labels, no quotes, no explanations.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const rawResponse = (response.text || "").toLowerCase();
            // Limpiar la respuesta de posibles prefijos o formatos inesperados
            items = rawResponse.split(',')
                .map(i => i.replace(/[^a-z0-9.\-_]/gi, '').trim())
                .filter(i => i.length >= 2);
        }
    } catch (error) {
        console.warn("AI icon extraction failed, using fallback.");
    }

    // Fallback: Si la IA falla, usamos el término directo
    if (items.length === 0) {
        items = [query.toLowerCase()];
    }

    const results: {url: string, source: string}[] = [];
    
    items.forEach(item => {
        const isDomain = item.includes('.');
        
        if (isDomain) {
            // Fuentes para marcas (Logotipos)
            results.push({ url: `https://logo.clearbit.com/${item}?size=256`, source: item });
            results.push({ url: `https://unavatar.io/${item}?fallback=false`, source: item });
            results.push({ url: `https://www.google.com/s2/favicons?domain=${item}&sz=128`, source: item });
        } else {
            // Fuentes para conceptos genéricos (Iconografía de alta calidad de Icons8)
            const keyword = item.replace(/\s+/g, '-');
            results.push({ url: `https://img.icons8.com/fluency/256/${keyword}.png`, source: item });
            results.push({ url: `https://img.icons8.com/color/256/${keyword}.png`, source: item });
            results.push({ url: `https://img.icons8.com/clouds/256/${keyword}.png`, source: item });
            results.push({ url: `https://img.icons8.com/office/256/${keyword}.png`, source: item });
        }
    });

    // Siempre añadir un avatar de texto con las iniciales como respaldo final
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Generado'
    });

    // Eliminar duplicados por URL y filtrar enlaces muertos (optimización visual)
    const uniqueResults = Array.from(new Map(results.map(item => [item.url, item])).values());
    return uniqueResults.slice(0, 15);
};
