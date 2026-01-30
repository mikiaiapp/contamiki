
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
            // Prompt simplificado y directo para evitar ruido en la respuesta
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Analyze: "${query}". 
                Output format: ONLY a comma-separated list of values.
                Rules:
                1. If it's a BRAND/COMPANY (e.g. Netflix, Amazon, BBVA, Zara), return its domain (e.g. netflix.com).
                2. If it's a GENERAL CONCEPT (e.g. ocio, salud, viajes), return 3 English nouns (e.g. travel, plane, hotel).
                NO sentences, NO labels, NO quotes.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const rawResponse = (response.text || "").toLowerCase();
            // Limpieza más permisiva para no romper dominios
            items = rawResponse.split(',')
                .map(i => i.trim())
                .filter(i => i.length >= 2);
        }
    } catch (error) {
        console.warn("AI icon extraction failed, using query as fallback.");
    }

    // Fallback básico si la IA falla
    if (items.length === 0) {
        items = [query.toLowerCase()];
    }

    const results: {url: string, source: string}[] = [];
    
    items.forEach(item => {
        // Un dominio suele tener un punto
        const isDomain = item.includes('.') && !item.includes(' ');
        
        if (isDomain) {
            // Fuentes para logotipos corporativos
            results.push({ url: `https://logo.clearbit.com/${item}`, source: item });
            results.push({ url: `https://unavatar.io/${item}?fallback=false`, source: item });
            results.push({ url: `https://www.google.com/s2/favicons?domain=${item}&sz=128`, source: item });
        } else {
            // Fuentes para conceptos (Icons8 Fluency es muy visual y colorido)
            const keyword = item.replace(/\s+/g, '-');
            results.push({ url: `https://img.icons8.com/fluency/256/${keyword}.png`, source: item });
            results.push({ url: `https://img.icons8.com/color/256/${keyword}.png`, source: item });
            results.push({ url: `https://img.icons8.com/clouds/256/${keyword}.png`, source: item });
            results.push({ url: `https://img.icons8.com/office/256/${keyword}.png`, source: item });
            results.push({ url: `https://img.icons8.com/plasticine/256/${keyword}.png`, source: item });
        }
    });

    // Siempre añadir el avatar de texto como última opción
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Generado'
    });

    // Eliminamos duplicados y limitamos
    const uniqueResults = Array.from(new Map(results.map(item => [item.url, item])).values());
    return uniqueResults.slice(0, 15);
};
