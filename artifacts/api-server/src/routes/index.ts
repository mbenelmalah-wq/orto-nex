import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysisRouter from "./analysis";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analysisRouter);

export default router;
