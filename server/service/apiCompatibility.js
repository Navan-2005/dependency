function normalizeParameters(parameters = []) {
  return parameters.map((param) => ({
    name: param.name || null,
    type: param.type || null,
    optional: Boolean(param.optional)
  }));
}

function getRequiredParameterCount(parameters = []) {
  return parameters.filter((param) => !param.optional).length;
}

function analyzeArgumentCount(repositoryUsage, targetApi) {
  if (!repositoryUsage || !targetApi) {
    return {
      compatible: false,
      risk: "unknown",
      certainty: "insufficient-evidence",
      reason: "Repository usage or target API information is missing."
    };
  }

  const argumentCount = repositoryUsage.argumentCount ?? 0;

  const parameters = normalizeParameters(
    targetApi.parameters || []
  );

  const requiredCount = getRequiredParameterCount(parameters);
  const maximumCount = parameters.length;

  // Too few arguments for required parameters
  if (argumentCount < requiredCount) {
        return {
            compatible: false,
            risk: "high",
            certainty: "confirmed",

            repositoryArgumentCount:
                repositoryUsage.argumentCount,

            targetRequiredParameterCount:
                requiredCount,

            repositoryArguments:
                repositoryUsage.arguments || [],

            reason:
                `The repository passes ${argumentCount} argument(s), ` +
                `but the target API requires at least ${requiredCount}.`
        };
  }

  // Too many arguments
  if (argumentCount > maximumCount) {
    return {
      compatible: false,
      risk: "medium",
      certainty: "likely",
      reason:
        `The repository passes ${argumentCount} argument(s), ` +
        `but the target API defines only ${maximumCount} parameter(s).`
    };
  }

        return {
            compatible: true,
            risk: "low",
            certainty: "confirmed",

            repositoryArgumentCount:
                repositoryUsage.argumentCount,

            targetRequiredParameterCount:
                requiredCount,

            targetMaximumParameterCount:
                maximumCount,

            repositoryArguments:
                repositoryUsage.arguments || [],

            reason:
                `The repository passes ${argumentCount} argument(s), ` +
                `and the target API accepts between ` +
                `${requiredCount} and ${maximumCount}.`
        };
}

function analyzeReturnTypeChange(oldApi, newApi) {
  const oldReturnType = oldApi?.returnType || null;
  const newReturnType = newApi?.returnType || null;

  if (!oldReturnType || !newReturnType) {
    return {
      changed: false,
      certainty: "insufficient-evidence"
    };
  }

  if (oldReturnType === newReturnType) {
    return {
      changed: false,
      certainty: "confirmed"
    };
  }

  return {
    changed: true,
    certainty: "confirmed"
  };
}

function analyzeApiCompatibility({
  oldApi,
  newApi,
  repositoryUsage
}) {
  if (!newApi) {
    return {
      compatible: false,
      risk: "high",
      certainty: "confirmed",
      reason: "The API does not exist in the target package version."
    };
  }

  const argumentAnalysis = analyzeArgumentCount(
    repositoryUsage,
    newApi
  );

  if (!argumentAnalysis.compatible) {
    return argumentAnalysis;
  }

  const returnTypeAnalysis = analyzeReturnTypeChange(
    oldApi,
    newApi
  );

  if (returnTypeAnalysis.changed) {
    return {
      compatible: false,
      risk: "medium",
      certainty: "confirmed",
      reason:
        `The API return type changed from ` +
        `${returnTypeAnalysis.oldReturnType || oldApi.returnType} ` +
        `to ${newApi.returnType}.`
    };
  }

  return {
    compatible: true,
    risk: "low",
    certainty: "confirmed",
    reason: argumentAnalysis.reason
  };
}

function buildCompatibilityResults({
  impacts = [],
  oldApis = [],
  newApis = []
}) {
  const results = [];

  for (const impact of impacts) {

    const apiName = impact.api;

    const oldApi = oldApis.find(
      api => getApiIdentity(api) === apiName
    );

    const newApi = newApis.find(
      api => getApiIdentity(api) === apiName
    );

    const usages = impact.usages || [];

    for (const usage of usages) {

      const repositoryUsage =
        usage.callSite || usage;

      const compatibility =
        analyzeApiCompatibility({
          oldApi,
          newApi,
          repositoryUsage
        });

      results.push({
        package: impact.package || null,
        api: apiName,

        file:
          usage.file ||
          repositoryUsage.file ||
          null,

        line:
          usage.line ||
          repositoryUsage.line ||
          null,

        compatibility
      });
    }
  }

  return results;
}

function getApiIdentity(api) {
  if (!api) return "";

  if (api.parent && api.name) {
    return `${api.parent}.${api.name}`;
  }

  return api.name || "";
}

export {
  analyzeApiCompatibility,
  analyzeArgumentCount,
  analyzeReturnTypeChange,
  buildCompatibilityResults,
  getApiIdentity
};