function normalizeText(text) {
    if (!text) {
        return "";
    }

    return text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}


function chunkDocument(
    document,
    options = {}
) {

    const {
        chunkSize = 1200,
        overlap = 200
    } = options;

    if (!document?.content) {
        return [];
    }

    const text =
        normalizeText(
            document.content
        );

    if (!text) {
        return [];
    }

    const chunks = [];

    let start = 0;

    while (start < text.length) {

        const end =
            Math.min(
                start + chunkSize,
                text.length
            );

        const content =
            text.slice(
                start,
                end
            ).trim();

        if (content) {

        chunks.push({
            id: `${document.file}:${chunks.length}`,

            source: document.file,

            content,

            package: document.package || null,

            version: document.version || null,

            type: document.type || "documentation"
        });
        }

        if (end >= text.length) {
            break;
        }

        start =
            end - overlap;
    }

    return chunks;
}


function chunkDocuments(
    documents,
    options = {}
) {

    const chunks = [];

    for (
        const document
        of documents || []
    ) {

        const documentChunks =
            chunkDocument(
                document,
                options
            );

        chunks.push(
            ...documentChunks
        );
    }

    return chunks;
}


export {
    normalizeText,
    chunkDocument,
    chunkDocuments
};