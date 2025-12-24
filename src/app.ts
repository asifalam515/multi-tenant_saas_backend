import express, { Request, Response } from "express";
import initDB from "./config/db";
export const app = express();
initDB();
app.get("/", (req: Request, res: Response) => {
  res.send("Vehicle rental system started!");
});
