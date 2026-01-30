
import { GoogleGenAI } from "@google/genai";
import { Transaction, Family, Account, Category } from "../types";
import { getToken } from "./authService";

let cachedApiKey: string | null = null;

const fetchApiKey = async (): Promise<string> => {
  if (cachedApiKey) return cachedApiKey;
  const token = getToken();
  if (!token) return "";
  
  try {
    const response = await fetch('/api/config', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const config = await response.json();
    cachedApiKey = config.apiKey || "";
    return cachedApiKey || "";
  } catch (e) {
    return "";
  }
};

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
    const apiKey = await fetchApiKey();
    if (!apiKey) {
        return "Configuración de IA no disponible. Por favor, asegúrate de que el servidor tenga una API_KEY configurada.";
    }

    const ai = new GoogleGenAI({ apiKey });

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
    return "Error al conectar con el motor de IA. Revisa tu conexión o la clave de API.";
  }
};
