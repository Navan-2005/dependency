function tokenize(text) {
    if (!text) {
        return [];
    }

    return text
        .toLowerCase()
        .split(/[^a-z0-9@._-]+/)
        .filter(Boolean);
}


function keywordScore(content, query) {
    const contentTokens =
        tokenize(content);

    const queryTokens =
        tokenize(query);

    if (
        contentTokens.length === 0 ||
        queryTokens.length === 0
    ) {
        return 0;
    }

    const contentSet =
        new Set(contentTokens);

    let matches = 0;

    for (const token of queryTokens) {
        if (contentSet.has(token)) {
            matches++;
        }
    }

    return matches / queryTokens.length;
}


function keywordSearch(
    documents,
    query,
    limit = 5
) {
    return (documents || [])
        .map(document => ({
            ...document,

            keywordScore:
                keywordScore(
                    document.content,
                    query
                )
        }))
        .filter(
            document =>
                document.keywordScore > 0
        )
        .sort(
            (a, b) =>
                b.keywordScore -
                a.keywordScore
        )
        .slice(0, limit);
}


export {
    tokenize,
    keywordScore,
    keywordSearch
};