
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e imágenes utilizando una estrategia de mapeo de dominios ultra-robusta.
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) return [];

        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Identify 3 high-quality official website domains for: "${text}". 
            Return ONLY a comma-separated list of domains. Example: brand.com, brand.io.
            No conversational text, only the list.`,
            config: {
                thinkingConfig: { thinkingBudget: 0 }
            },
        });

        const rawResponse = response.text || "";
        
        // Regex para capturar dominios limpios
        const domainRegex = /([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}/gi;
        const matches = rawResponse.match(domainRegex) || [];
        
        const cleanDomains = Array.from(new Set(
            matches.map(d => d.toLowerCase().trim())
        )).filter(d => d.length > 4);

        const results: {url: string, source: string}[] = [];
        
        // Fuentes de alta fiabilidad
        cleanDomains.forEach(domain => {
            results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: domain });
            results.push({ url: `https://unavatar.io/${domain}`, source: domain });
            results.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: domain });
        });

        // Backup: Generador visual siempre disponible
        const cleanName = encodeURIComponent(text.trim());
        results.push({
            url: `https://ui-avatars.com/api/?name=${cleanName}&background=4f46e5&color=fff&size=512&bold=true`,
            source: 'Backup'
        });

        return Array.from(new Map(results.map(item => [item.url, item])).values()).slice(0, 10);
    } catch (error) {
        console.error("Icon search failure:", error);
        return [];
    }
};
