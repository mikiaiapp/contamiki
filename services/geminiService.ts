
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const recentTransactions = transactions.slice(0, 50).map(t => {
      const fam = families.find(f => f.id === t.familyId);
      const cat = categories.find(c => c.id === t.categoryId);
      
      return {
        date: t.date,
        amount: t.amount,
        type: t.type,
        desc: t.description,
        group: fam?.name || 'Otros',
        item: cat?.name || 'Otros'
      };
    });

    const accountSummaries = accounts.map(a => ({
      name: a.name,
      balance: a.initialBalance,
    }));

    const prompt = `
      Actúa como un experto asesor financiero.
      Datos del usuario:
      Cuentas: ${JSON.stringify(accountSummaries)}
      Últimas transacciones: ${JSON.stringify(recentTransactions)}

      Analiza y responde brevemente en Markdown:
      1. ¿En qué grupo se está gastando más dinero?
      2. ¿Qué hábito de consumo parece más ineficiente?
      3. Dame 3 consejos de ahorro directos.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No se pudo obtener una respuesta clara.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error al conectar con el motor de IA. Revisa la clave de API o intenta de nuevo.";
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
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
