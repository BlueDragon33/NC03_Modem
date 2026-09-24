import fs from "node:fs";
import assert from "node:assert/strict";
import { PRIMARY_NAV } from "../src/ui/NavigationModel.js";

assert.deepEqual(PRIMARY_NAV.map((item) => item.id), ["home","network","wifi","devices","settings"]);
const app = fs.readFileSync("app.js", "utf8");
assert.ok(app.includes("Advanced Developer Mode"));
assert.ok(!app.includes('["discovery","API Discovery"]'), "Discovery must not be a normal quick action.");
const css = fs.readFileSync("styles.css", "utf8");
assert.ok(css.includes(".mobile-nav"));
assert.ok(css.includes("min-height:44px"), "Mobile controls must keep a 44px touch target.");
console.log("UX PASS");
