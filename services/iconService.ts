
import { GoogleGenAI } from "@google/genai";

/**
 * Busca logotipos e iconos representativos en internet.
 * Realiza una búsqueda dual: Marcas (dominios) + Conceptos (iconos).
 */
export const searchInternetLogos = async (text: string): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    const query = text.trim();
    const queryLower = query.toLowerCase();
    
    let domains: string[] = [];
    let concepts: string[] = [];

    // 1. HEURÍSTICA INMEDIATA (Sin esperar a la IA)
    if (!query.includes(' ')) {
        domains.push(`${queryLower}.es`);
        domains.push(`${queryLower}.com`);
    }
    // Conceptos base siempre incluidos
    concepts.push(queryLower);

    // 2. ENRIQUECIMIENTO CON IA
    try {
        const apiKey = process.env.API_KEY;
        if (apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Analiza: "${query}".
                
                Responde en una sola línea separada por comas:
                1. Los 2 dominios web más probables si es una empresa (ej: caixabank.es, caixabank.com).
                2. 3 sustantivos en inglés que describan el concepto (ej: bank, money, finance).
                
                SALIDA: Solo la lista de palabras, nada más.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const cleanResponse = (response.text || "").toLowerCase().trim().replace(/[`*]/g, '');
            const parts = cleanResponse.split(',').map(p => p.trim()).filter(p => p.length > 2);
            
            parts.forEach(p => {
                if (p.includes('.') && !p.includes(' ')) {
                    domains.push(p);
                } else {
                    concepts.push(p);
                }
            });
        }
    } catch (error) {
        console.warn("IA Enrichment failed, using basic search.");
    }

    const results: {url: string, source: string}[] = [];

    // A. AGREGAR LOGOS DE MARCAS (Dominios)
    const uniqueDomains = Array.from(new Set(domains));
    uniqueDomains.forEach(domain => {
        // Unavatar es excelente para marcas porque busca en redes sociales si falla el dominio
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: 'Marca (Social)' });
        results.push({ url: `https://logo.clearbit.com/${domain}?size=256`, source: 'Marca (HQ)' });
        results.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: 'Marca (Favicon)' });
    });

    // B. AGREGAR ICONOS DE CONCEPTOS (Keywords)
    const uniqueConcepts = Array.from(new Set(concepts));
    uniqueConcepts.forEach(c => {
        const term = c.replace(/\s+/g, '-');
        // Usamos múltiples estilos de Icons8 para dar variedad
        results.push({ url: `https://img.icons8.com/fluency/256/${term}.png`, source: 'Icono Fluency' });
        results.push({ url: `https://img.icons8.com/color/256/${term}.png`, source: 'Icono Color' });
        results.push({ url: `https://img.icons8.com/clouds/256/${term}.png`, source: 'Icono Clouds' });
        results.push({ url: `https://img.icons8.com/emoji/256/${term}-emoji.png`, source: 'Emoji' });
    });

    // C. FALLBACK FINAL (Avatar con iniciales)
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Iniciales'
    });

    // Limpieza de duplicados y limitación de resultados
    const uniqueResults = Array.from(new Map(results.map(item => [item.url, item])).values());
    
    return uniqueResults.slice(0, 24);
};
