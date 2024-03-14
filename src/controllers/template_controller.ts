import ApiController from "./api_controller";
import { Router } from "express";

export default class TemplateController extends ApiController {
  super() {
    this.initializeRoutes();
  }

  public get(req: Request, res: Response): void {
    // Logic for handling the GET request
    res.json({ message: "This is the GET endpoint" });
  }

  private initializeRoutes(): void {
    this.router.get("/get", this.get);
  }

  public getRouter(): Router {
    return this.router;
  }
}
