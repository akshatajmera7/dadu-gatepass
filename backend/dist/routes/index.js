"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const pass_routes_1 = __importDefault(require("./pass.routes"));
const verification_routes_1 = __importDefault(require("./verification.routes"));
const integration_routes_1 = __importDefault(require("./integration.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/passes', pass_routes_1.default);
router.use('/verification', verification_routes_1.default);
router.use('/integration', integration_routes_1.default);
exports.default = router;
