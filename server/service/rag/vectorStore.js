function cosineSimilarity(a, b) {

    if (!a || !b || a.length !== b.length) {
        return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {

        dotProduct += a[i] * b[i];

        magnitudeA += a[i] * a[i];

        magnitudeB += b[i] * b[i];
    }

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return (
        dotProduct /
        (
            Math.sqrt(magnitudeA) *
            Math.sqrt(magnitudeB)
        )
    );
}


class VectorStore {

    constructor() {
        this.documents = [];
    }


    add(document) {

        if (
            !document?.embedding ||
            !document?.content
        ) {
            return;
        }

        this.documents.push(document);
    }


    addMany(documents = []) {

        for (const document of documents) {
            this.add(document);
        }
    }


    search(queryEmbedding, limit = 5) {

        if (!queryEmbedding) {
            return [];
        }

        const results =
            this.documents.map(document => {

                const score =
                    cosineSimilarity(
                        queryEmbedding,
                        document.embedding
                    );

                return {
                    ...document,
                    score
                };
            });

        results.sort(
            (a, b) => b.score - a.score
        );

        return results.slice(0, limit);
    }


    clear() {
        this.documents = [];
    }


    size() {
        return this.documents.length;
    }
}


export {
    cosineSimilarity,
    VectorStore
};