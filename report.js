import { renderDiagnosticReportMarkup, REPORT_SCHEMA } from "./src/ui/DiagnosticReport.js";

const root = document.querySelector("#reportRoot");
const printButton = document.querySelector("#printReport");
const closeButton = document.querySelector("#closeReport");

function fail(message) {
  root.innerHTML = `<div class="error"><strong>Không thể dựng báo cáo</strong><p>${String(message)}</p></div>`;
  printButton.disabled = true;
}

try {
  const encoded = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  if (!encoded) throw new Error("Thiếu snapshot báo cáo.");
  const report = JSON.parse(decodeURIComponent(encoded));
  if (!report || report.schema !== REPORT_SCHEMA) throw new Error("Snapshot báo cáo không đúng schema.");
  history.replaceState(null, "", location.pathname);
  root.innerHTML = renderDiagnosticReportMarkup(report);
} catch (error) {
  fail(error instanceof Error ? error.message : "Dữ liệu báo cáo không hợp lệ.");
}

printButton.addEventListener("click", () => window.print());
closeButton.addEventListener("click", () => window.close());
