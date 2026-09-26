import fs from "node:fs";
import assert from "node:assert/strict";
import { PRIMARY_NAV } from "../src/ui/NavigationModel.js";

assert.deepEqual(PRIMARY_NAV.map((item) => item.id), ["home","network","wifi","devices","settings"]);
const app = fs.readFileSync("app.js", "utf8");
assert.ok(app.includes("Advanced Developer Mode"));
assert.ok(!app.includes('["discovery","API Discovery"]'), "Discovery must not be a normal quick action.");
const css = fs.readFileSync("styles.css", "utf8");
assert.ok(css.includes(".mobile-nav"));
assert.ok(css.includes("min-height:44px"), "Interactive controls must keep a 44px touch target.");
assert.ok(css.includes("button:focus-visible"), "Keyboard focus must remain visible.");
assert.ok(css.includes("repeat(4,minmax(0,1fr))"), "Desktop quick actions should use four balanced columns.");
assert.ok(app.includes("Báo cáo chẩn đoán an toàn"), "Settings must expose the safe diagnostic report.");
assert.ok(app.includes("Snapshot hiện tại"), "Fresh client counts must use snapshot wording instead of implying a persistent online state.");
console.log("UX PASS");
