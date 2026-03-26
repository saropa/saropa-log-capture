"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert"));
const token_extractor_1 = require("../../../modules/project-indexer/token-extractor");
suite('Token Extractor Extended', () => {
    suite('extractTokensFromProto', () => {
        test('extracts proto schema symbols', () => {
            const proto = 'syntax = "proto3"; import "google/protobuf/timestamp.proto"; message User {} service UserService { rpc GetUser(GetUserReq) returns (User); }';
            const tokens = (0, token_extractor_1.extractTokensFromProto)(proto);
            assert.ok(tokens.includes('user'));
            assert.ok(tokens.includes('userservice'));
            assert.ok(tokens.includes('getuser'));
            assert.ok(tokens.includes('timestamp'));
        });
    });
    suite('extractTokensFromDockerfile', () => {
        test('extracts instructions and image details', () => {
            const docker = 'FROM node:20-alpine AS build\nRUN npm ci\nCOPY . .\n';
            const tokens = (0, token_extractor_1.extractTokensFromDockerfile)(docker);
            assert.ok(tokens.includes('node'));
            assert.ok(tokens.includes('alpine'));
            assert.ok(tokens.includes('build'));
            assert.ok(tokens.includes('copy'));
        });
    });
    suite('extractTokensFromHcl', () => {
        test('extracts terraform block names', () => {
            const hcl = 'resource "aws_s3_bucket" "assets" {} module "network" { source = "./mod" }';
            const tokens = (0, token_extractor_1.extractTokensFromHcl)(hcl);
            assert.ok(tokens.includes('resource'));
            assert.ok(tokens.includes('aws'));
            assert.ok(tokens.includes('bucket'));
            assert.ok(tokens.includes('network'));
        });
    });
    suite('extractTokensFromRequirements', () => {
        test('extracts package names', () => {
            const txt = 'requests==2.31.0\nflask>=3.0\n# comment';
            const tokens = (0, token_extractor_1.extractTokensFromRequirements)(txt);
            assert.ok(tokens.includes('requests'));
            assert.ok(tokens.includes('flask'));
        });
    });
    suite('extractTokensFromGoMod', () => {
        test('extracts module and require entries', () => {
            const gomod = 'module github.com/acme/app\nrequire github.com/gin-gonic/gin v1.10.0';
            const tokens = (0, token_extractor_1.extractTokensFromGoMod)(gomod);
            assert.ok(tokens.includes('github'));
            assert.ok(tokens.includes('gin'));
        });
    });
    suite('extractTokensFromPomXml', () => {
        test('extracts dependency coordinates', () => {
            const pom = '<dependency><groupId>org.slf4j</groupId><artifactId>slf4j-api</artifactId><version>2.0.9</version></dependency>';
            const tokens = (0, token_extractor_1.extractTokensFromPomXml)(pom);
            assert.ok(tokens.includes('org.slf4j:slf4j-api:2.0.9'));
            assert.ok(tokens.includes('slf4j'));
        });
    });
    suite('extractTokensFromDotNetProject', () => {
        test('extracts package references', () => {
            const csproj = '<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />';
            const tokens = (0, token_extractor_1.extractTokensFromDotNetProject)(csproj);
            assert.ok(tokens.includes('newtonsoft'));
            assert.ok(tokens.includes('json'));
        });
    });
    suite('extractTokensFromScriptText', () => {
        test('extracts make targets and commands', () => {
            const script = 'build:\n\techo hi\nrun:\n\tpython app.py';
            const tokens = (0, token_extractor_1.extractTokensFromScriptText)(script);
            assert.ok(tokens.includes('build'));
            assert.ok(tokens.includes('python'));
        });
    });
    suite('extractTokensFromHttpRequests', () => {
        test('extracts method and URL path tokens', () => {
            const http = 'GET https://api.example.com/v1/users?id=1';
            const tokens = (0, token_extractor_1.extractTokensFromHttpRequests)(http);
            assert.ok(tokens.includes('get'));
            assert.ok(tokens.includes('users'));
            assert.ok(tokens.includes('example'));
        });
    });
});
//# sourceMappingURL=token-extractor-extended.test.js.map