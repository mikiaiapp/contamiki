
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e iconos representativos en internet.
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    const query = text.trim();
    let brandDomain = "";
    let keywords: string[] = [];

    try {
        const apiKey = process.env.API_KEY;
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            // Prompt extremadamente directivo para evitar explicaciones de la IA
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Identify the brand or concept: "${query}". 
                
                RULES:
                - If it's a COMPANY/BRAND (e.g. Netflix, Amazon, BBVA, Shell), return ONLY its domain (e.g. "netflix.com").
                - If it's a CATEGORY (e.g. food, car, salary), return ONLY 2 English nouns (e.g. "pizza, food").
                - NO MARKDOWN. NO INTRO. NO LABELS. JUST THE TEXT.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const cleanResponse = (response.text || "").toLowerCase().trim().replace(/[`*]/g, '');
            
            if (cleanResponse.includes('.') && !cleanResponse.includes(' ')) {
                brandDomain = cleanResponse;
            } else {
                keywords = cleanResponse.split(',').map(k => k.trim());
            }
        }
    } catch (error) {
        console.warn("IA Icon search failed, using query as fallback.");
    }

    const results: {url: string, source: string}[] = [];

    // 1. SI ES UNA MARCA (Dominio detectado)
    if (brandDomain || (query.includes('.') && !query.includes(' '))) {
        const domain = brandDomain || query.toLowerCase();
        results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: 'Brand' });
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: 'Brand' });
        results.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: 'Brand' });
    }

    // 2. SI SON CONCEPTOS O CATEGORÍAS
    const searchTerms = keywords.length > 0 ? keywords : [query.toLowerCase()];
    searchTerms.forEach(term => {
        const k = term.replace(/\s+/g, '-');
        results.push({ url: `https://img.icons8.com/fluency/256/${k}.png`, source: 'Icon' });
        results.push({ url: `https://img.icons8.com/color/256/${k}.png`, source: 'Icon' });
        results.push({ url: `https://img.icons8.com/clouds/256/${k}.png`, source: 'Icon' });
    });

    // 3. FALLBACK SEGURO (Avatar de texto)
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Default'
    });

    // Limpiar duplicados y URLs vacías
    return Array.from(new Map(results.map(item => [item.url, item])).values()).slice(0, 15);
};
