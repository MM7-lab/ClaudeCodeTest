// Copies the figure page into the app, so the app always ships the latest version.
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "..", "figure", "index.html");
const dst = path.join(__dirname, "..", "figure.html");
fs.copyFileSync(src, dst);
console.log("figure.html updated from", path.relative(process.cwd(), src));
