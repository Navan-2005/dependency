import { generateImpactReport } from "../server/service/apiImpactMatcher.js";
import { buildCompatibilityResults } from "../server/service/apiCompatibility.js";

const oldApis = [
  {
    name: "verify",
    parameters: [
      {
        name: "token",
        type: "string",
        optional: false
      },
      {
        name: "secretOrPublicKey",
        type: "string",
        optional: false
      }
    ],
    returnType: "string"
  }
];

const newApis = [
  {
    name: "verify",
    parameters: [
      {
        name: "token",
        type: "string",
        optional: false
      },
      {
        name: "secretOrPublicKey",
        type: "string",
        optional: false
      },
      {
        name: "options",
        type: "object",
        optional: false
      }
    ],
    returnType: "string"
  }
];

const apiDiff = {
  added: [],
  removed: [],
  modified: [
    {
      api: "verify",
      old: oldApis[0],
      new: newApis[0],
      changeType: "signature-modified"
    }
  ],
  unchanged: []
};

const repositoryUsage = {
  file: "server/middleware/middleware.js",
  line: 11,
  package: "jsonwebtoken",
  api: "verify",
  callSite: {
    callee: "jwt.verify",
    argumentCount: 2,
    arguments: [
      "token",
      "process.env.JWT_SECRET"
    ]
  }
};

console.log("\n=== API DIFF ===");

console.log(
  JSON.stringify(apiDiff, null, 2)
);

console.log("\n=== COMPATIBILITY ===");

const compatibility = buildCompatibilityResults({
  impacts: [
    {
      package: "jsonwebtoken",
      api: "verify",
      usages: [
        repositoryUsage
      ]
    }
  ],
  oldApis,
  newApis
});

console.log(
  JSON.stringify(compatibility, null, 2)
);