
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
                contents: `Analiza: "${query}".
                
                REGLAS:
                1. Si es una MARCA/EMPRESA/TIENDA conocida (ej. Amazon, Netflix, Mercadona, Zara, Shell, BBVA):
                   Devuelve los 2 dominios más probables (ej. "zara.com, zara.es").
                2. Si es un CONCEPTO/CATEGORÍA (ej. comida, salud, viaje, nómina):
                   Devuelve 3 palabras clave en inglés para buscar iconos (ej. "pizza, burger, restaurant").
                
                SALIDA: Solo una lista separada por comas. Sin explicaciones ni etiquetas.`,
                config: {
                    thinkingConfig: { thinkingBudget: 0 }
                },
            });

            const rawResponse = (response.text || "").toLowerCase();
            items = rawResponse.split(',')
                .map(i => i.trim())
                .map(i => i.replace(/^(domain|brand|icon|keyword|resultado|marca):\s*/i, ''))
                .filter(i => i.length >= 2);
        }
    } catch (error) {
        console.warn("IA Icon extraction failed. Falling back to simple query.");
    }

    // Fallback si la IA no devuelve nada útil
    if (items.length === 0) {
        items = [query.toLowerCase()];
    }

    const results: {url: string, source: string}[] = [];
    
    items.forEach(item => {
        const isDomain = item.includes('.') && !item.includes(' ');
        
        if (isDomain) {
            // FUENTES PARA MARCAS (DOMINIOS)
            // Unavatar es muy bueno porque busca en twitter, facebook, etc si falla el logo
            results.push({ url: `https://unavatar.io/${item}?fallback=false`, source: 'Unavatar' });
            results.push({ url: `https://logo.clearbit.com/${item}?size=256`, source: 'Clearbit' });
            results.push({ url: `https://api.faviconkit.com/${item}/144`, source: 'FaviconKit' });
            results.push({ url: `https://www.google.com/s2/favicons?domain=${item}&sz=128`, source: 'Google' });
        } else {
            // FUENTES PARA CONCEPTOS (ICONOS)
            const keyword = item.replace(/\s+/g, '-');
            results.push({ url: `https://img.icons8.com/fluency/256/${keyword}.png`, source: 'Icons8 Fluency' });
            results.push({ url: `https://img.icons8.com/color/256/${keyword}.png`, source: 'Icons8 Color' });
            results.push({ url: `https://img.icons8.com/clouds/256/${keyword}.png`, source: 'Icons8 Clouds' });
            results.push({ url: `https://img.icons8.com/office/256/${keyword}.png`, source: 'Icons8 Office' });
            results.push({ url: `https://img.icons8.com/external-flat-icons-inmotus-design/256/external-${keyword}-flat-icons-inmotus-design.png`, source: 'Flat' });
        }
    });

    // Siempre incluimos un avatar de texto como última opción
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Default'
    });

    // Limpieza de duplicados por URL
    const uniqueResults = Array.from(new Map(results.map(item => [item.url, item])).values());
    return uniqueResults.slice(0, 20);
};
