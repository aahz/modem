declare module "swagger-ui-express" {
  import { RequestHandler } from "express";

  const serve: RequestHandler[];
  function setup(document: unknown): RequestHandler;

  export default {
    serve,
    setup,
  };
}
