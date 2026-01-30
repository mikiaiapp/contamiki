
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
                contents: `Identify visual identity for: "${query}".
                
                STRICT RULES:
                1. If it's a BRAND/STORE/COMPANY (e.g. Amazon, Netflix, Zara, Shell, Starbucks, BBVA), return ONLY its primary domain (e.g. "amazon.com").
                2. If it's a GENERAL CATEGORY (e.g. food, health, travel, salary), return ONLY 3 clear English keywords (e.g. "pizza, burger, food").
                
                OUTPUT: Comma-separated list only. No markdown. No labels.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const rawResponse = (response.text || "").toLowerCase();
            items = rawResponse.split(',')
                .map(i => i.trim())
                .map(i => i.replace(/^(domain|brand|icon|keyword|resultado):\s*/i, ''))
                .filter(i => i.length >= 2);
        }
    } catch (error) {
        console.warn("IA Icon extraction failed.");
    }

    if (items.length === 0) items = [query.toLowerCase()];

    const results: {url: string, source: string}[] = [];
    
    items.forEach(item => {
        const isDomain = item.includes('.') && !item.includes(' ');
        
        if (isDomain) {
            // Fuentes para marcas corporativas
            results.push({ url: `https://logo.clearbit.com/${item}?size=256`, source: 'Brand' });
            results.push({ url: `https://unavatar.io/${item}?fallback=false`, source: 'Brand' });
            results.push({ url: `https://www.google.com/s2/favicons?domain=${item}&sz=128`, source: 'Brand' });
        } else {
            // Fuentes para conceptos (Iconos de alta calidad)
            const keyword = item.replace(/\s+/g, '-');
            results.push({ url: `https://img.icons8.com/fluency/256/${keyword}.png`, source: 'Icon' });
            results.push({ url: `https://img.icons8.com/color/256/${keyword}.png`, source: 'Icon' });
            results.push({ url: `https://img.icons8.com/clouds/256/${keyword}.png`, source: 'Icon' });
            results.push({ url: `https://img.icons8.com/plasticine/256/${keyword}.png`, source: 'Icon' });
            results.push({ url: `https://img.icons8.com/bubbles/256/${keyword}.png`, source: 'Icon' });
        }
    });

    // Fallback de avatar de texto
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Default'
    });

    // Filtrado de duplicados y limitación
    const uniqueResults = Array.from(new Map(results.map(item => [item.url, item])).values());
    return uniqueResults.slice(0, 16);
};
