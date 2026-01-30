
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e imágenes utilizando una estrategia de mapeo de dominios ultra-robusta.
 * Extrae dominios de la respuesta de la IA sin importar el formato (texto, lista, markdown).
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    try {
        // Acceso directo a la API KEY según lineamientos de seguridad del entorno
        const apiKey = process.env.API_KEY;
        if (!apiKey) return [];

        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Identify the official website domains for the brand or entity: "${text}". 
            Return a simple list of domains like "brand.com, brand.io". 
            Be precise. Only domains.`,
            config: {
                thinkingConfig: { thinkingBudget: 0 }
            },
        });

        const rawResponse = response.text || "";
        
        // Regex robusta para capturar cualquier cosa que parezca un dominio (ej: google.com, sub.domain.es)
        const domainRegex = /([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}/gi;
        const matches = rawResponse.match(domainRegex) || [];
        
        const cleanDomains = Array.from(new Set(
            matches.map(d => d.toLowerCase().trim())
        )).filter(d => !d.includes(' ') && d.length > 4);

        const results: {url: string, source: string}[] = [];
        
        cleanDomains.forEach(domain => {
            // Fuentes diversificadas para maximizar probabilidad de éxito visual
            results.push({ url: `https://logo.clearbit.com/${domain}?size=512`, source: domain });
            results.push({ url: `https://unavatar.io/${domain}`, source: domain });
            results.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: domain });
        });

        // Generador de respaldo basado en iniciales si no hay dominios
        const cleanName = encodeURIComponent(text.trim());
        results.push({
            url: `https://ui-avatars.com/api/?name=${cleanName}&background=4f46e5&color=fff&size=512&bold=true`,
            source: 'Generado'
        });

        // Eliminar duplicados de URL
        return Array.from(new Map(results.map(item => [item.url, item])).values()).slice(0, 12);
    } catch (error) {
        console.error("Icon search failure:", error);
        return [];
    }
};
