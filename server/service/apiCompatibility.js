import { getApiIdentity } from "./apiDiff.js";

function normalizeParameters(parameters = []) {
  return parameters.map((param) => {
    if (typeof param === "string") {
      return {
        name: param,
        type: null,
        optional: false
      };
    }

    return {
      name: param.name || null,
      type: param.type || null,
      optional: Boolean(param.optional)
    };
  });
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

    const repositoryUsage =
      impact.callSite || {
        argumentCount:
          impact.argumentCount,
        arguments:
          impact.arguments,
        file:
          impact.file,
        line:
          impact.line
      };

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
        impact.file ||
        null,

      line:
        impact.line ||
        null,

      compatibility
    });
  }

  return results;
}

export {
  analyzeApiCompatibility,
  analyzeArgumentCount,
  analyzeReturnTypeChange,
  buildCompatibilityResults,
  getApiIdentity
};