import express, { type Express } from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Дублируем пути, чтобы точно не промахнуться мимо роутера
app.use("/api", router);
app.use(router);

// Перехватчик №1: Если маршрут сбился, отдаем текст на телефон
app.use("/api", (req, res) => {
  res.status(404).json({ error: `Маршрут не найден: ${req.url}` });
});

// Перехватчик №2: Ловит скрытые падения базы или сервера и выводит текст на экран
app.use((err: any, req: any, res: any, next: any) => {
  const errorMsg = err.message || "Неизвестная ошибка на сервере";
  res.status(500).json({ error: `Скрытая ошибка: ${errorMsg}` });
});

const possiblePaths = [
  path.resolve(process.cwd(), "../mesbook/dist/client"),
  path.resolve(process.cwd(), "../mesbook/dist/public"),
  path.resolve(process.cwd(), "../mesbook/dist"),
  path.resolve(process.cwd(), "../mesbook/build"),
  path.resolve(process.cwd(), "../../dist"),
];

const clientDistPath = possiblePaths.find((p) => fs.existsSync(path.join(p, "index.html"))) || path.resolve(process.cwd(), "../mesbook/dist");

app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const indexPath = path.join(clientDistPath, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

export default app;
