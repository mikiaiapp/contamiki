import { GoogleGenAI } from "@google/genai";

/**
 * Motor de búsqueda de iconos "ContaMiki Ultra V3 - Logo Hunter".
 * Especializado en encontrar marcas locales y corporativas con alta precisión.
 */
export const searchInternetLogos = async (
    text: string, 
    onStatusChange?: (status: string) => void
): Promise<{url: string, source: string}[]> => {
    if (!text || text.trim().length < 2) return [];
    
    const query = text.trim();
    const results: {url: string, source: string}[] = [];
    
    let brandDomains: string[] = [];
    let visualKeywords: string[] = [];
    let directImageLinks: string[] = [];

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) return [];

        onStatusChange?.("Localizando identidad oficial...");
        const ai = new GoogleGenAI({ apiKey });
        
        const systemInstruction = `Eres un experto en Identidad Visual Corporativa.
        Tu misión es localizar el dominio oficial y los recursos gráficos (logos) de una marca o concepto.
        
        REGLAS:
        1. Identifica el dominio exacto, especialmente para marcas locales (ej: "Cajamar" -> "cajamar.es").
        2. Si encuentras URLs directas de imágenes (.png, .svg) en la búsqueda, inclúyelas.
        3. Genera palabras clave visuales en inglés para iconos genéricos relacionados.`;

        const prompt = `Analiza detalladamente: "${query}". 
        Usa Google Search para confirmar el dominio oficial de la marca.
        Si es una empresa española, prioriza dominios .es.
        
        Responde estrictamente así:
        DOMAINS: [dominio1.tld, dominio2.tld]
        DIRECT_LOGOS: [url-imagen-1, url-imagen-2]
        KEYWORDS: [term1, term2, term3, term4, term5]`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                systemInstruction,
                tools: [{ googleSearch: {} }] // Re-activado para precisión en marcas como Cajamar
            },
        });

        const textOutput = response.text || "";
        
        // Extracción de Dominios
        const domainsMatch = textOutput.match(/DOMAINS:\s*\[?([^\]\n]+)\]?/i);
        if (domainsMatch) {
            brandDomains = domainsMatch[1].split(',').map(d => d.trim().replace(/\[|\]/g, '')).filter(d => d && d !== 'null');
        }

        // Extracción de URLs directas (si la IA las encontró)
        const directMatch = textOutput.match(/DIRECT_LOGOS:\s*\[?([^\]\n]+)\]?/i);
        if (directMatch) {
            directImageLinks = directMatch[1].split(',').map(u => u.trim().replace(/\[|\]/g, '')).filter(u => u.startsWith('http'));
        }

        // Extracción de Keywords
        const keywordsMatch = textOutput.match(/KEYWORDS:\s*\[?([^\]\n]+)\]?/i);
        if (keywordsMatch) {
            visualKeywords = keywordsMatch[1].split(',').map(k => k.trim().replace(/\[|\]/g, '')).filter(k => k !== '');
        }
        
        // Extraer también de los fragmentos de Grounding (Google Search)
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            groundingChunks.forEach((chunk: any) => {
                const uri = chunk.web?.uri;
                if (uri && (uri.match(/\.(png|svg|webp|ico|jpg)$/i) || uri.includes('logo') || uri.includes('brand'))) {
                    directImageLinks.push(uri);
                }
            });
        }

        onStatusChange?.("Compilando alternativas...");

    } catch (error) {
        console.error("Icon IA Search Error:", error);
    }

    // --- CONSTRUCCIÓN DEL CATÁLOGO DE RESULTADOS ---

    // 1. Enlaces directos encontrados por la IA (Alta prioridad)
    directImageLinks.forEach(url => {
        results.push({ url, source: 'Directo' });
    });

    // 2. Generación por Dominios (Cajamar.es, etc)
    brandDomains.forEach(domain => {
        results.push({ url: `https://logo.clearbit.com/${domain}`, source: 'Logo' });
        results.push({ url: `https://unavatar.io/${domain}?fallback=false`, source: 'Brand' });
        results.push({ url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`, source: 'Web' });
        
        // Intentar slug de marca en Iconify (ej: logos:cajamar)
        const slug = domain.split('.')[0];
        results.push({ url: `https://api.iconify.design/logos:${slug}.svg`, source: 'Vect' });
    });

    // 3. Variedad de Iconos Genéricos (Basado en Keywords)
    const searchTerms = Array.from(new Set([query.toLowerCase().replace(/\s+/g, '-'), ...visualKeywords]));
    const iconifyPrefixes = ['solar', 'tabler', 'lucide', 'fluent-emoji-flat', 'flat-color-icons', 'ph', 'ri'];

    searchTerms.forEach(term => {
        const cleanTerm = term.replace(/[^a-z0-9-]/g, '');
        if (cleanTerm.length < 2) return;

        // Estilos Icons8 (Muy representativos)
        results.push({ url: `https://img.icons8.com/fluency/256/${cleanTerm}.png`, source: 'Vibrante' });
        results.push({ url: `https://img.icons8.com/color/256/${cleanTerm}.png`, source: 'Color' });

        // Librerías vectoriales variadas
        iconifyPrefixes.forEach(prefix => {
            results.push({ url: `https://api.iconify.design/${prefix}:${cleanTerm}.svg`, source: 'SVG' });
        });
    });

    // 4. Fallback de texto
    results.push({
        url: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=4f46e5&color=fff&size=512&bold=true`,
        source: 'Auto'
    });

    // Filtro final: eliminar duplicados y nulos
    const seen = new Set<string>();
    return results.filter(item => {
        if (!item.url || item.url.includes('null') || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
    }).slice(0, 100);
};
