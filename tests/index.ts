const request = require("supertest");
const express = require("express");

const api = express();
const router = express.Router();

router.get("/", (req: any, res: any) => {
  res.send("Hello world");
});

api.use("/", router);

// Export your API server for testing
export { api };

// Test cases
describe("GET /", () => {
  it('responds with text "Hello world"', async () => {
    const res = await request(api).get("/");
    expect(res.text).toEqual("Hello world");
    expect(res.status).toEqual(200);
  });
});

describe("GET /template", () => {
  it("responds with 400 status and error when parameters are missing", async () => {
    const res = await request(api).get("/template");
    expect(res.status).toEqual(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("missingParams");
  });

  it("responds with rendered template", async () => {
    const res = await request(api).get(
      "/template?template_name=test&first_name=John&last_name=Doe",
    );
    expect(res.status).toEqual(200);
    // Add more expectations as needed for the response body
  });
});
