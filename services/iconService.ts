
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Busca logotipos e imágenes en tiempo récord utilizando una estrategia de mapeo de dominios.
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.length < 2) return [];
    
    try {
        // Usamos Gemini para identificar rápidamente la identidad y competidores
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analyze the query: "${text}". 
            Identify the primary brand or service. 
            Return ONLY a comma-separated list of the 8 most relevant and high-profile official domains for this brand and its direct global/local competitors.
            Prioritize domains that are likely to have high-quality logos on clearbit or unavatar.
            Example for "Food": mcdonalds.com, burgerking.com, starbucks.com, subway.com.
            Example for "Bank": santander.com, bva.com, caixabank.com, revolut.com.
            Do not include markdown, code blocks, or explanations.`,
            config: {
                tools: [{ googleSearch: {} }],
                thinkingConfig: { thinkingBudget: 0 }
            },
        });

        const domainText = response.text || "";
        const cleanDomains = domainText.replace(/```json|```|\[|\]/g, '');
        const potentialDomains = cleanDomains
            .split(',')
            .map(d => d.trim().toLowerCase())
            .filter(d => d.includes('.') && !d.includes(' ') && !d.includes('google'));

        const results: {url: string, source: string}[] = [];
        
        potentialDomains.forEach(domain => {
            // Unavatar
            results.push({
                url: `https://unavatar.io/${domain}`,
                source: domain
            });
            
            // Clearbit (Priorizamos alta resolución)
            results.push({
                url: `https://logo.clearbit.com/${domain}?size=512`,
                source: domain
            });

            // Google High Res
            results.push({
                url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
                source: domain
            });

            // DuckDuckGo
            results.push({
                url: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
                source: domain
            });
        });

        // Placeholder fallback
        const cleanName = encodeURIComponent(text.trim());
        results.push({
            url: `https://ui-avatars.com/api/?name=${cleanName}&background=4f46e5&color=fff&size=512&bold=true`,
            source: 'ContaMiki Generator'
        });

        const unique = Array.from(new Map(results.map(item => [item.url, item])).values());
        
        return unique.slice(0, 12);
    } catch (error) {
        console.error("Error in high-performance icon search:", error);
        return [];
    }
};
