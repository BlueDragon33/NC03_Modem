import test from "node:test";
import assert from "node:assert/strict";
import { buildStockWebUiAudit, stockUiAuditDiscoveryPaths } from "../src/modem/StockWebUiAudit.js";

test("stock Web UI audit extracts structure without retaining control values", () => {
  const audit=buildStockWebUiAudit([
    {
      path:"/index.html",
      source:[
        '<a href="/common/settings.html">Settings</a>',
        '<script src="/js/settings.js"></script>',
        '<input id="wifi_ssid" name="ssid" value="PRIVATE_SSID">',
        '<input id="wifi_psk" type="password" value="super-secret">',
        '<button id="applyWifi">Apply</button>'
      ].join("\n")
    },
    {
      path:"/js/settings.js",
      source:'saveAjaxJsonData("/action/wifi_set_ap_params", payload);'
    }
  ]);

  assert.equal(audit.schema,"nc03-stock-webui-audit/v2");
  assert.equal(audit.privacy,"STRUCTURE_ONLY_NO_CONTROL_VALUES");
  assert.ok(audit.pagePaths.includes("/common/settings.html"));
  assert.ok(audit.scriptPaths.includes("/js/settings.js"));
  assert.ok(audit.actionRoutes.includes("/action/wifi_set_ap_params"));
  assert.ok(audit.controls.some((item)=>item.id==="wifi_ssid"));
  assert.ok(audit.controls.some((item)=>item.id==="wifi_psk" && item.sensitive===true));

  const serialized=JSON.stringify(audit);
  assert.doesNotMatch(serialized,/PRIVATE_SSID/);
  assert.doesNotMatch(serialized,/super-secret/);
});

test("stock Web UI audit discovers only internal safe html/js paths", () => {
  const audit=buildStockWebUiAudit([{
    path:"/index.html",
    source:[
      '<a href="common/wifi.html?x=1">WiFi</a>',
      '<a href="https://example.com/evil.html">External</a>',
      '<script src="../js/wifi.js?v=2"></script>',
      '<img src="/img/logo.png">'
    ].join("\n")
  }]);

  const paths=stockUiAuditDiscoveryPaths(audit);
  assert.ok(paths.includes("/common/wifi.html"));
  assert.ok(paths.includes("/js/wifi.js"));
  assert.ok(!paths.some((path)=>path.includes("example.com")));
  assert.ok(!paths.some((path)=>path.endsWith(".png")));
});
