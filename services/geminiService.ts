
import { GoogleGenAI } from "@google/genai";
import { Transaction, Family, Account, Category } from "../types";

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
    // Guidelines: Always use new GoogleGenAI({ apiKey: process.env.API_KEY }) directly.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Prepare a summary for the prompt
    const recentTransactions = transactions.slice(0, 50).map(t => {
      // Family is Parent (Group)
      const fam = families.find(f => f.id === t.familyId);
      // Category is Child (Detail)
      const cat = categories.find(c => c.id === t.categoryId);
      
      return {
        date: t.date,
        amount: t.amount,
        type: t.type,
        desc: t.description,
        group: fam?.name || 'Desconocido',
        item: cat?.name || 'Desconocido'
      };
    });

    const accountSummaries = accounts.map(a => ({
      name: a.name,
      initial: a.initialBalance,
      icon: a.icon
    }));

    const prompt = `
      Actúa como un asesor financiero personal.
      Aquí tienes un resumen de los datos financieros del usuario (Últimas 50 transacciones y estado de cuentas):
      
      Cuentas: ${JSON.stringify(accountSummaries)}
      Transacciones Recientes: ${JSON.stringify(recentTransactions)}

      Analiza los hábitos de gasto. 
      1. Identifica la Familia (Grupo) con mayor gasto y qué categoría específica (Detalle) contribuye más.
      2. Detecta gastos recurrentes que podrían reducirse.
      3. Da 3 consejos específicos y accionables para ahorrar dinero.
      
      Formatea la respuesta en Markdown limpio y usa emojis donde sea apropiado.
    `;

    // Guidelines: Use 'gemini-3-flash-preview' for basic text tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Guidelines: Access the text output via the .text property.
    return response.text || "No hay información disponible en este momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "No se pudieron generar recomendaciones. Por favor verifica tu configuración de API o intenta más tarde.";
  }
};
