import { CohereClientV2 } from "cohere-ai";

if (!process.env.COHERE_API_KEY) {
    throw new Error("COHERE_API_KEY is not configured");
}

const cohere = new CohereClientV2({
    token: process.env.COHERE_API_KEY
});

const EMBEDDING_MODEL =
    process.env.RAG_EMBEDDING_MODEL || "embed-english-v3.0";

const MAX_BATCH_SIZE =
    Number(process.env.RAG_EMBEDDING_BATCH_SIZE) || 96;

const MAX_RETRIES =
    Number(process.env.RAG_EMBEDDING_MAX_RETRIES) || 3;

const RETRY_DELAY_MS =
    Number(process.env.RAG_EMBEDDING_RETRY_DELAY_MS) || 1000;

const RATE_LIMIT_DELAY_MS =
    Number(process.env.RAG_EMBEDDING_RATE_LIMIT_DELAY_MS) || 200;

const EMBEDDING_ENABLED =
    process.env.RAG_EMBEDDING_ENABLED !== "false";

function isRateLimitError(error) {
    return (
        error?.statusCode === 429 ||
        error?.code === 429 ||
        error?.message?.includes("429")
    );
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function embedTexts(texts, inputType) {
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response =
                await cohere.embed({
                    model: EMBEDDING_MODEL,
                    texts,
                    inputType,
                    embeddingTypes: ["float"]
                });

            const vectors =
                response?.embeddings?.float;

            if (!Array.isArray(vectors)) {
                throw new Error(
                    "Cohere embed response is missing float embeddings"
                );
            }

            return vectors;
        }
        catch (error) {
            lastError = error;

            if (isRateLimitError(error)) {
                const delay =
                    RETRY_DELAY_MS * Math.pow(2, attempt);

                console.warn(
                    `Rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES + 1}), ` +
                    `retrying in ${delay}ms...`
                );

                await sleep(delay);

                continue;
            }

            throw error;
        }
    }

    throw lastError;
}

async function generateEmbedding(text) {

    if (!text || !text.trim()) {
        throw new Error("Text is required for embedding");
    }

    const vectors =
        await embedTexts(
            [text],
            "search_query"
        );

    return vectors[0];
}

async function generateEmbeddings(chunks) {

    if (!EMBEDDING_ENABLED) {
        return [];
    }

    const results = [];

    for (let index = 0; index < chunks.length; index += MAX_BATCH_SIZE) {

        const batch =
            chunks.slice(
                index,
                index + MAX_BATCH_SIZE
            );

        const texts =
            batch.map(
                chunk => chunk.content
            );

        const vectors =
            await embedTexts(
                texts,
                "search_document"
            );

        for (
            let i = 0;
            i < batch.length;
            i++
        ) {
            results.push({
                ...batch[i],
                embedding: vectors[i]
            });
        }

        if (
            index + MAX_BATCH_SIZE <
            chunks.length
        ) {
            await sleep(RATE_LIMIT_DELAY_MS);
        }
    }

    return results;
}

export {
    generateEmbedding,
    generateEmbeddings
};