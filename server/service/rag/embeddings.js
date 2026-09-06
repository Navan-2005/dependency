import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


async function generateEmbedding(text) {

    if (!text || !text.trim()) {
        throw new Error("Text is required for embedding");
    }

    const response =
        await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: text
        });

    return response.embeddings[0].values;
}


async function generateEmbeddings(chunks) {

    const results = [];

    for (const chunk of chunks) {

        const vector =
            await generateEmbedding(
                chunk.content
            );

        results.push({

            ...chunk,

            embedding: vector
        });
    }

    return results;
}


export {
    generateEmbedding,
    generateEmbeddings
};