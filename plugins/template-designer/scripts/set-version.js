#!/usr/bin/env node

// Required because semantic-release/npm has problems with backstage:^ subs in package.json

const fs = require("fs");
const path = require("path");

const nextVersion = process.argv[2];

if (!nextVersion) {
  // eslint-disable-next-line no-console
  console.error("Usage: node scripts/set-version.js <version>");
  process.exit(1);
}

const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.version = nextVersion;
// eslint-disable-next-line prefer-template
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
