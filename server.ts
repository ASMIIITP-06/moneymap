import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Redact account numbers, card digits, phone numbers, and UPI reference IDs before AI processing
function redactSensitiveIdentifiers(input: string): string {
  return input
    .replace(/\b\d{9,18}\b/g, "[REDACTED_REF]")
    .replace(/(A\/c|Acct|Account|Card)\s*(No\.?|#|:)?\s*[Xx*\d-]{4,}/gi, "$1 [REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\b/g, "[UPI_OR_EMAIL]");
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/ai/explain-transaction", async (req, res) => {
    try {
      const { rawDescription, amount, type } = req.body as {
        rawDescription?: string;
        amount?: number;
        type?: string;
      };

      if (!rawDescription || typeof rawDescription !== "string") {
        res.status(400).json({ error: "Transaction description is required." });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            "Gemini AI key is not configured in Settings > Secrets. Deterministic categorization rules still work locally.",
        });
        return;
      }

      const redacted = redactSensitiveIdentifiers(rawDescription.slice(0, 300));

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Analyze this redacted personal finance transaction entry and explain what the merchant/charge likely is without inventing any account balances or numbers.
Description: "${redacted}"
Amount: ${Number(amount) || 0}
Direction: ${type === "income" ? "Credit/Income" : type === "transfer" ? "Internal Transfer" : "Debit/Expense"}`,
        config: {
          systemInstruction:
            "You are a transparent personal finance assistant. Explain cryptic bank or UPI transaction descriptions in plain English. Suggest the single best category from: Rent & Housing, Groceries, Dining, Utilities & Bills, Transport, Subscriptions, Shopping, Healthcare, Salary / Income, Freelance / Bonus, Transfer, Savings / Goal, Other. If the description is genuinely ambiguous, set confidence to 'Low' and say so honestly instead of guessing.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              normalizedMerchant: {
                type: Type.STRING,
                description: "Clean human-readable merchant or payee name.",
              },
              suggestedCategory: {
                type: Type.STRING,
                description: "One of the allowed MoneyMap categories.",
              },
              plainExplanation: {
                type: Type.STRING,
                description: "1-2 sentence plain-language explanation of the entry.",
              },
              confidence: {
                type: Type.STRING,
                description: "High, Medium, or Low.",
              },
            },
            required: [
              "normalizedMerchant",
              "suggestedCategory",
              "plainExplanation",
              "confidence",
            ],
          },
        },
      });

      const text = (response.text ?? "{}").trim();
      const parsed = JSON.parse(text);
      res.json({ ...parsed, redactedInput: redacted });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to explain transaction.";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/ai/monthly-brief", async (req, res) => {
    try {
      const { summary } = req.body as { summary?: Record<string, unknown> };
      if (!summary || typeof summary !== "object") {
        res.status(400).json({ error: "Validated monthly summary data is required." });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            "Gemini AI key is not configured in Settings > Secrets. Your deterministic P&L calculations and CSV export remain fully available.",
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Draft an encouraging, non-judgmental monthly personal finance coach brief strictly from these validated figures. Do NOT invent any new numbers, do NOT recommend specific stocks or mutual funds, and state assumptions clearly.\n\nValidated Figures:\n${JSON.stringify(summary, null, 2)}`,
        config: {
          systemInstruction:
            "You are MoneyMap, a practical, non-judgmental personal finance coach. Use the exact numbers provided in INR (₹). Never recommend specific securities, stocks, or funds. Keep the tone clear, empathetic, and student-simple.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: {
                type: Type.STRING,
                description: "One short summary sentence of the month's net result.",
              },
              whatChanged: {
                type: Type.STRING,
                description: "2-3 sentences summarizing income, expenses, and net profit/loss.",
              },
              driftInsight: {
                type: Type.STRING,
                description: "2 sentences highlighting any category spending drift or recurring cost change.",
              },
              nextSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2 concrete, user-controlled next steps for next month.",
              },
            },
            required: ["headline", "whatChanged", "driftInsight", "nextSteps"],
          },
        },
      });

      const text = (response.text ?? "{}").trim();
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate monthly brief.";
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MoneyMap server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start MoneyMap server:", err);
  process.exit(1);
});
