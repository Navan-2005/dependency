import { analyzeApiCompatibility } from "../server/service/apiCompatibility.js";

const oldApi = {
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
      optional: true
    }
  ],
  returnType: "string"
};

const newApi = {
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
      optional: true
    }
  ],
  returnType: "string"
};

const repositoryUsage = {
  file: "server/middleware/middleware.js",
  line: 11,
  argumentCount: 2,
  arguments: [
    "token",
    "process.env.JWT_SECRET"
  ]
};

const result = analyzeApiCompatibility({
  oldApi,
  newApi,
  repositoryUsage
});

console.log(JSON.stringify(result, null, 2));