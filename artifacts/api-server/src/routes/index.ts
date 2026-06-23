import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import giftsRouter from "./gifts.js";
import upgradeRouter from "./upgrade.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(giftsRouter);
router.use(upgradeRouter);
router.use(adminRouter);

export default router;
