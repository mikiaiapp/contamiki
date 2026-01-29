import { GoogleGenAI } from "@google/genai";
import { Transaction, Family, Account, Category } from "../types";
import { getToken } from "./authService";

// Helper to get the AI instance lazily
const getAIClient = async () => {
    try {
        const token = getToken() || "preview_token";
        
        // En preview mode es posible que la API Key no se lea si auth falla, 
        // pero intentamos llamar al config endpoint de todas formas
        const res = await fetch('/api/config', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("No se pudo obtener la configuración");

        const config = await res.json();
        if (!config.apiKey) throw new Error("API Key no configurada en el servidor");
        return new GoogleGenAI({ apiKey: config.apiKey });
    } catch (e) {
        console.error("Failed to initialize AI:", e);
        return null;
    }
}

export const generateFinancialAdvice = async (
  transactions: Transaction[],
  families: Family[],
  accounts: Account[],
  categories: Category[]
): Promise<string> => {
  try {
    const ai = await getAIClient();
    if (!ai) return "Error: No se pudo conectar con la IA. Verifica tu conexión o credenciales.";

    // Prepare a summary
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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No hay información disponible en este momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "No se pudieron generar recomendaciones. Por favor verifica tu configuración de API o intenta más tarde.";
  }
};