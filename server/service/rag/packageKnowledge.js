import {
    chunkDocuments
} from "./documentChunker.js";

import {
    generateEmbeddings
} from "./embeddings.js";

import {
    VectorStore
} from "./vectorStore.js";

import {
    Retriever
} from "./retriever.js";


async function buildPackageKnowledge(snapshot) {

    if (!snapshot) {
        throw new Error("Package snapshot is required");
    }

    const documents =
        snapshot.documentation || [];

    if (documents.length === 0) {

        return {
            package: snapshot.package,
            version: snapshot.version,
            vectorStore: new VectorStore(),
            retriever: null,
            chunks: []
        };
    }


    const chunks =
        chunkDocuments(
            documents,
            {
                chunkSize: 1200,
                overlap: 200
            }
        );


    const embeddedChunks =
        await generateEmbeddings(
            chunks
        );


    const vectorStore =
        new VectorStore();

    vectorStore.addMany(
        embeddedChunks
    );


    const retriever =
        new Retriever(
            vectorStore
        );


    return {

        package:
            snapshot.package,

        version:
            snapshot.version,

        vectorStore,

        retriever,

        chunks:
            embeddedChunks
    };
}


async function searchPackageKnowledge(
    knowledge,
    query,
    limit = 5
) {

    if (
        !knowledge ||
        !knowledge.retriever
    ) {
        return [];
    }


    return knowledge.retriever.search(
        query,
        limit
    );
}


export {
    buildPackageKnowledge,
    searchPackageKnowledge
};