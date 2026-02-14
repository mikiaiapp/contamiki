import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Family, Account, Category, TransactionType } from "../types";

/**
 * Generates financial advice based on user transactions and accounts using Gemini 3.
 */
export const generateFinancialAdvice = async (
  transactions: Transaction[],
  families: Family[],
  accounts: Account[],
  categories: Category[]
): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return "## ⚠️ Clave de API no configurada\nEl servidor no ha proporcionado una clave de API de Gemini válida. Por favor, asegúrate de haberla configurado en tu archivo `.env` o en las variables de entorno del servidor y haber reiniciado la aplicación.";
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    const recentTransactions = transactions.slice(0, 100).map(t => {
      const fam = families.find(f => f.id === t.familyId);
      const cat = categories.find(c => c.id === t.categoryId);
      
      return {
        date: t.date,
        amount: t.amount,
        type: t.type,
        desc: t.description,
        family: fam?.name || 'Otros',
        category: cat?.name || 'Otros'
      };
    });

    const accountSummaries = accounts.map(a => ({
      name: a.name,
      balance: a.initialBalance,
    }));

    const prompt = `
      Actúa como un experto analista financiero senior de la plataforma ContaMiki.
      Tu misión es analizar los datos financieros del usuario para proporcionarle una visión estratégica de su economía.

      DATOS DEL USUARIO:
      - Cuentas y saldos iniciales: ${JSON.stringify(accountSummaries)}
      - Últimas 100 transacciones relevantes: ${JSON.stringify(recentTransactions)}

      TAREA - Realiza un informe en Markdown que incluya:
      1. **ANÁLISIS DE TIPOLOGÍA DE GASTOS**: ¿En qué categorías se va el dinero? Diferencia entre gastos fijos (vivienda, facturas) y variables (ocio, compras). Identifica si hay "gastos hormiga".
      2. **DETECCIÓN DE TENDENCIAS DE AHORRO**: Basado en los ingresos vs gastos, ¿el usuario está ahorrando o descapitalizándose? ¿Hay patrones estacionales o impulsivos?
      3. **PROPUESTAS DE MEJORA FINANCIERA**: Lanza 3 propuestas concretas, realistas y motivadoras para optimizar sus finanzas el próximo mes.

      REGLAS DE ESTILO:
      - Usa un tono profesional pero cercano.
      - Utiliza negritas, listas y emojis para que sea fácil de leer.
      - Si el saldo es negativo o crítico, sé directo pero constructivo.
      - Limítate a la información proporcionada.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No se pudo obtener una respuesta clara del motor financiero.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "## ⚠️ Error de Conexión\nNo se pudo conectar con el motor de IA. Esto puede deberse a una clave de API inválida, exceso de cuota o falta de conexión a internet.";
  }
};

/**
 * Analiza una muestra de datos de un extracto bancario (CSV/Excel) y devuelve un mapeo categorizado.
 */
export const mapBankTransactions = async (
  sampleData: any[],
  categories: Category[],
  families: Family[]
): Promise<any[]> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return [];

    const ai = new GoogleGenAI({ apiKey: apiKey });

    const categoryList = categories.map(c => ({
      id: c.id,
      name: c.name,
      type: families.find(f => f.id === c.familyId)?.type || 'EXPENSE'
    }));

    const prompt = `
      Analiza estas filas de un extracto bancario:
      ${JSON.stringify(sampleData)}

      Tengo estas categorías disponibles:
      ${JSON.stringify(categoryList)}

      TAREA:
      Identifica qué campos corresponden a:
      - Fecha (date, formato YYYY-MM-DD)
      - Descripción (description)
      - Importe (amount, número positivo para ingresos, negativo para gastos)
      - Tipo (type: 'INCOME' o 'EXPENSE')
      - Categoría sugerida (categoryId de la lista proporcionada)

      Devuelve un array JSON con los objetos mapeados. 
      Si el importe es negativo, conviértelo a positivo y pon type='EXPENSE'.
      Si es positivo, pon type='INCOME'.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING },
              categoryId: { type: Type.STRING },
              familyId: { type: Type.STRING }
            },
            required: ['date', 'description', 'amount', 'type', 'categoryId']
          }
        }
      }
    });

    const jsonStr = response.text || "[]";
    const mapped = JSON.parse(jsonStr);

    // Asegurar que cada objeto tenga el familyId correcto basándose en la categoría
    return mapped.map((item: any) => {
      const cat = categories.find(c => c.id === item.categoryId);
      return {
        ...item,
        familyId: cat?.familyId || ''
      };
    });
  } catch (error) {
    console.error("Error mapping transactions:", error);
    return [];
  }
};

/**
 * Interpreta datos de migración (texto pegado o CSV crudo) para extraer estructura de Cuentas, Familias y Categorías.
 */
export const parseMigrationData = async (rawData: string): Promise<{ accounts: any[], families: any[], categories: any[] }> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return { accounts: [], families: [], categories: [] };

    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // Limitamos la entrada para no exceder tokens si pegan algo gigante
    const contentSample = rawData.substring(0, 30000);

    const prompt = `
      Actúa como un ingeniero de migración de datos. Tengo datos crudos exportados de una aplicación antigua de contabilidad (ej: Contamoney).
      
      DATOS CRUDOS:
      ${contentSample}

      TAREA:
      Analiza el texto e intenta extraer estructuras de:
      1. CUENTAS (Bancos, Efectivo, Tarjetas) -> Extrae nombre y saldo aproximado si existe.
      2. FAMILIAS (Grupos de gastos/ingresos) -> Si no hay familias explícitas, infiérelas de las categorías (ej: "Supermercado" -> Familia "Alimentación").
      3. CATEGORÍAS -> Asócialas a una Familia.

      OUTPUT FORMAT (JSON):
      {
        "accounts": [{ "name": "...", "balance": 0, "currency": "EUR" }],
        "families": [{ "name": "...", "type": "EXPENSE" | "INCOME" }],
        "categories": [{ "name": "...", "familyName": "..." }]
      }

      REGLAS:
      - Asigna iconos (emojis) apropiados a cada elemento si puedes deducirlos.
      - Si encuentras movimientos pero no categorías claras, crea categorías genéricas basadas en los conceptos.
      - Devuelve solo el JSON válido.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const jsonStr = response.text || "{}";
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error("Migration parsing error:", error);
    return { accounts: [], families: [], categories: [] };
  }
};