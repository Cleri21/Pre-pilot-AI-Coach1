import { GoogleGenAI } from "@google/genai";

export const SYSTEM_PROMPT = `You are PrepPilot AI, a placement and interview preparation assistant for college students and fresh graduates.

You help only with:
- Data Structures & Algorithms
- C++
- OOP
- DBMS
- SQL
- Operating Systems
- Computer Networks
- Aptitude
- HR Interview
- Resume
- Projects

If someone asks unrelated questions politely guide them back to placement preparation.

Format answers using markdown.
`;

let client = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const err = new Error("Missing GEMINI_API_KEY in .env");
    err.status = 500;
    throw err;
  }

  if (!client) {
    client = new GoogleGenAI({
      apiKey,
    });
  }

  return client;
}

export async function streamChatReply({
  message,
  onText,
  signal,
}) {
  const ai = getClient();

  try {
    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\nUser: ${message}`,
            },
          ],
        },
      ],
    });

    for await (const chunk of response) {
      if (signal?.aborted) {
        return;
      }

      const text = chunk.text;

      if (text) {
        onText(text);
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      return;
    }

    console.error(err);

    const e = new Error("Gemini request failed.");
    e.status = 500;
    throw e;
  }
}