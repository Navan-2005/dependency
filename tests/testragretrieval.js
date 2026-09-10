import "dotenv/config";

import {
    chunkDocuments
} from "../server/service/rag/documentChunker.js";

import {
    generateEmbeddings
} from "../server/service/rag/embeddings.js";

import {
    VectorStore
} from "../server/service/rag/vectorStore.js";

import {
    Retriever
} from "../server/service/rag/retriever.js";


const documents = [

    {
        file: "CHANGELOG.md",

        content: `
# Express 5

Express 5 introduces changes
to route handling.

Some old APIs have been removed.

Applications should update their
route patterns.

The router implementation has
also changed in Express 5.
`
    },

    {
        file: "CHANGELOG.md",

        content: `
# Express 4

Express 4 provided the traditional
routing behaviour.

Applications commonly used
app.get(), app.post(), and
express.Router().
`
    },

    {
        file: "README.md",

        content: `
Express is a web framework
for Node.js.

Use app.get() to define
HTTP GET routes.

Use app.post() to define
HTTP POST routes.
`
    }
];


const chunks =
    chunkDocuments(
        documents,
        {
            chunkSize: 300,
            overlap: 50
        }
    );


console.log(
    `Created ${chunks.length} chunks`
);


const embedded =
    await generateEmbeddings(chunks);


console.log(
    "Generated embeddings"
);


const vectorStore =
    new VectorStore();


vectorStore.addMany(
    embedded
);


console.log(
    "Vector store size:",
    vectorStore.size()
);


const retriever =
    new Retriever(vectorStore);


const results =
    await retriever.search(
        "Express 5 router changes and migration",
        3
    );


console.log(
    "\n=== SEARCH RESULTS ===\n"
);


for (const result of results) {

    console.log(
        "Score:",
        result.score.toFixed(4)
    );

    console.log(
        "Source:",
        result.source
    );

    console.log(
        "Content:",
        result.content
    );

    console.log(
        "--------------------"
    );
}