
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
                contents: `Analyze the financial term: "${query}". 
                1. Is it a specific BRAND/COMPANY? (e.g. Netflix, Zara, Santander) -> Return ONLY its main web domain (e.g. netflix.com).
                2. Is it a GENERAL CATEGORY/ACTIVITY? (e.g. ocio, viajes, seguros, restaurantes, salud) -> Return ONLY the 3 best English NOUNS for icon searching (e.g. "travel, suitcase, airplane" for "viajes").
                Return ONLY a comma-separated list. No labels, no quotes.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const rawResponse = (response.text || "").toLowerCase();
            items = rawResponse.split(',')
                .map(i => i.trim())
                .filter(i => i.length >= 2);
        }
    } catch (error) {
        console.warn("AI extraction failed, using query as keyword.");
    }

    if (items.length === 0) items = [query.toLowerCase()];

    const results: {url: string, source: string}[] = [];
    
    items.forEach(item => {
        const isDomain = item.includes('.');
        
        if (isDomain) {
            // Fuentes para marcas
            results.push({ url: `https://logo.clearbit.com/${item}`, source: item });
            results.push({ url: `https://unavatar.io/${item}`, source: item });
        } else {
            // Fuentes para conceptos genéricos (Icons8 Fluency - Alta Calidad)
            const keyword = item.replace(/\s+/g, '-');
            results.push({ url: `https://img.icons8.com/fluency/256/${keyword}.png`, source: item });
            results.push({ url: `https://img.icons8.com/color/256/${keyword}.png`, source: item });
            results.push({ url: `https://img.icons8.com/clouds/256/${keyword}.png`, source: item });
        }
    });

    // Fallback garantizado
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Generado'
    });

    // Filtrar duplicados y limitar
    const uniqueResults = Array.from(new Map(results.map(item => [item.url, item])).values());
    return uniqueResults.slice(0, 15);
};
