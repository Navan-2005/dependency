import {
    generateEmbedding
} from "./embeddings.js";


class Retriever {

    constructor(vectorStore) {
        this.vectorStore = vectorStore;
    }


    async search(query, limit = 5) {

        if (!query || !query.trim()) {
            return [];
        }

        const queryEmbedding =
            await generateEmbedding(query);

        return this.vectorStore.search(
            queryEmbedding,
            limit
        );
    }
}


export {
    Retriever
};