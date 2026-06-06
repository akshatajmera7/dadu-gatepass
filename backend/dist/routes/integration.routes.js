"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const integration_controller_1 = require("../controllers/integration.controller");
const router = (0, express_1.Router)();
router.use(integration_controller_1.authenticateSWD);
router.get('/swd/student/:rollNumber', integration_controller_1.getStudentByRollNumber);
router.post('/swd/sync-status', integration_controller_1.syncStudentStatus);
exports.default = router;
