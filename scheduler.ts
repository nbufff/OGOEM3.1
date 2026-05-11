import { GoogleGenAI, Type } from "@google/genai";
import { WorkPackage, Task } from "../types";

// In a real app, this should be handled securely. For this demo, we access process.env.
const API_KEY = process.env.API_KEY || '';

export const generateProjectPlan = async (
  prompt: string
): Promise<{ workPackages: WorkPackage[]; tasks: Task[] } | null> => {
  if (!API_KEY) {
    console.error("API Key is missing");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const systemInstruction = `
    You are an expert Project Manager. 
    Break down the user's project request into logical Work Packages and specific Tasks.
    Estimate realistic durations (in days) for each task.
    Establish dependencies where tasks must happen in sequence (FS) or parallel (SS).
    Return strictly a JSON object matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create a project plan for: ${prompt}`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            workPackages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                },
                required: ["id", "name"],
              },
            },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  duration: { type: Type.NUMBER, description: "Duration in days" },
                  dependencies: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT,
                        properties: {
                            sourceId: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ['FS', 'SS', 'FF', 'SF'] }
                        },
                        required: ["sourceId", "type"]
                    },
                    description: "Dependencies for this task"
                  },
                  workPackageId: { type: Type.STRING, description: "The ID of the parent Work Package" },
                },
                required: ["id", "name", "duration", "workPackageId"],
              },
            },
          },
          required: ["workPackages", "tasks"],
        },
      },
    });

    if (response.text) {
        return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};