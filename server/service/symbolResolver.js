// service/symbolResolver.js

function buildExportMap(results) {
    const exportMap = new Map();

    for (const result of results) {
        exportMap.set(
            result.file,
            result.exports || []
        );
    }

    return exportMap;
}


function resolveLocalImports(results) {

    const exportMap = buildExportMap(results);

    for (const result of results) {

        const localImports = result.imports.filter(
            (imp) =>
                imp.type === "local" &&
                imp.resolvedPath
        );

        if (localImports.length === 0) {
            continue;
        }


        for (const imp of localImports) {

            const sourceFile = imp.resolvedPath;

            const sourceExports =
                exportMap.get(sourceFile);


            if (!sourceExports) {
                continue;
            }


            for (const specifier of imp.specifiers) {

                const importedName =
                    specifier.imported;

                const localName =
                    specifier.local;


                const matchingExport =
                    sourceExports.find(
                        (exp) =>
                            exp.name === importedName
                    );


                if (!matchingExport) {
                    continue;
                }


                if (!result.resolvedSymbols) {
                    result.resolvedSymbols = [];
                }


                result.resolvedSymbols.push({
                    local: localName,
                    imported: importedName,
                    sourceFile,
                    sourceLine: matchingExport.line
                });
            }
        }
    }

    return results;
}


export {
    resolveLocalImports
};