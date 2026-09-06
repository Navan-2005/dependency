import "dotenv/config";

import {
    chunkDocuments
} from "./service/rag/documentChunker.js";

import {
    generateEmbeddings
} from "./service/rag/embeddings.js";


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
`
    },

    {
        file: "README.md",

        content: `
Express is a web framework for Node.js.

Use app.get() to define HTTP GET routes.

Use app.post() to define HTTP POST routes.
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
    "Embedding dimensions:",
    embedded[0].embedding.length
);


console.log(
    JSON.stringify(
        {
            source: embedded[0].source,
            content: embedded[0].content,
            embeddingPreview:
                embedded[0].embedding.slice(0, 5)
        },
        null,
        2
    )
);