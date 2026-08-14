import express, { type Express } from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req (req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res (res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Жесткий поиск именно файла index.html по всем возможным папкам сборки
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
