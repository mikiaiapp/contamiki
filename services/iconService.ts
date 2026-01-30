
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e imágenes utilizando una estrategia de mapeo de dominios ultra-robusta.
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    const query = text.trim();
    let cleanDomains: string[] = [];

    try {
        const apiKey = process.env.API_KEY;
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Identify the main official web domains for the brand: "${query}". 
                Return ONLY the domains separated by commas (e.g., brand.com, brand.es). 
                No markdown, no quotes, no extra text.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const rawResponse = (response.text || "").toLowerCase();
            // Extraer cualquier cadena que parezca un dominio
            const matches = rawResponse.match(/([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}/gi) || [];
            cleanDomains = Array.from(new Set(matches.map(d => d.replace(/^www\./, ''))));
        }
    } catch (error) {
        console.warn("AI domain extraction failed, using fallback logic.");
    }

    // Fallback: Si no hay dominios o la IA falló, construir uno probable
    if (cleanDomains.length === 0) {
        const slug = query.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (slug) cleanDomains = [`${slug}.com`, `${slug}.es`, `${slug}.io`].slice(0, 3);
    }

    const results: {url: string, source: string}[] = [];
    
    cleanDomains.forEach(domain => {
        // Clearbit es el más fiable para logos de alta calidad
        results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: domain });
        // Unavatar es excelente para marcas tecnológicas y sociales
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: domain });
        // Google Favicon como último recurso de alta disponibilidad
        results.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: domain });
    });

    // Siempre añadir un avatar generado por nombre como última opción
    const avatarName = encodeURIComponent(query);
    results.push({
        url: `https://ui-avatars.com/api/?name=${avatarName}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Generado'
    });

    // Eliminar duplicados y limitar
    const uniqueResults = Array.from(new Map(results.map(item => [item.url, item])).values());
    return uniqueResults.slice(0, 15);
};
