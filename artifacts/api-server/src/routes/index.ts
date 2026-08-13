import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mesbookRouter from "./mesbook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mesbookRouter);

export default router;
