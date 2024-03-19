"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Registry = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const provider_1 = require("./provider");
class Registry {
    constructor() {
        this.providers = {};
    }
    load(providerKey) {
        return __awaiter(this, void 0, void 0, function* () {
            this.providers[providerKey] = new provider_1.Provider(providerKey);
        });
    }
    loadAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const dir = path_1.default.join(__dirname);
            const keys = yield fs_1.promises.readdir(dir);
            for (const providerKey of keys) {
                const providerPath = path_1.default.join(dir, providerKey);
                const stats = yield fs_1.promises.lstat(providerPath);
                if (stats.isDirectory()) {
                    this.providers[providerKey] = new provider_1.Provider(providerKey);
                }
            }
        });
    }
    getProviderSpecification(providerKey) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.load(providerKey);
            const provider = this.providers[providerKey];
            return provider ? provider.getSpecification() : null;
        });
    }
    getAllProviderSpecifications() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadAll();
            return Object.values(this.providers).map((provider) => provider.getSpecification());
        });
    }
    syncProviderCollection(providerKey, collectionKey, context) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.load(providerKey);
            const provider = this.providers[providerKey];
            if (!provider) {
                throw new Error(`Failed to load provider ${providerKey}`);
            }
            return provider.syncCollection(collectionKey, context);
        });
    }
}
exports.Registry = Registry;
//# sourceMappingURL=registry.js.map