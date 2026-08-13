// ============================================================================
// reports.js
// منطق صفحة التقارير (reports.html) بالكامل: جلب بيانات المتدربين (بلا فترة
// تدريب محددة مستبعدة تلقائياً عبر fetchAllStudents())، فلترة محلية حسب
// الفترة المشتركة (تاريخ بداية التدريب)، ثم بناء وطباعة كل تقرير من التقارير
// الثلاثة عبر printReportHTML() (المعرَّفة في js/report.js — نفس آلية طباعة
// لوحة الإدارة وتقرير كل متدرب، بلا نافذة منفصلة).
//
// الاعتماديات المطلوب تحميلها قبل هذا الملف (بنفس الترتيب في reports.html):
//   1) js/config.js   — بيانات الاتصال بـ Supabase
//   2) js/ui.js        — يوفر showToast
//   3) js/supabase.js  — يوفر fetchAllStudents() وescapeHtml()
//   4) js/report.js    — يوفر printReportHTML() وLOGO_IMAGE_DATA_URI
//                         وHOSPITAL_NAME وHOSPITAL_SUBTITLE
// ============================================================================

const reportsState = {
  allStudents: [], // كل المتدربين ذوي فترة تدريب محددة (بلا قائمة الانتظار)
};

document.addEventListener("DOMContentLoaded", async () => {
  bindReportButtons();
  try {
    reportsState.allStudents = await fetchAllStudents();
  } catch (err){
    console.error("تعذر تحميل بيانات المتدربين:", err);
    showToast("تعذر تحميل بيانات المتدربين", "error");
    reportsState.allStudents = [];
  }
});

// ---------------------------------------------------------------------------
// فلترة الفترة المشتركة (حسب تاريخ بداية التدريب فقط)
// ---------------------------------------------------------------------------
/**
 * تُرجع قائمة المتدربين الذين تبدأ فترة تدريبهم ضمن الفترة المحددة في حقلي
 * repFrom/repTo أعلى الصفحة. حقل فارغ (من أو إلى أو كلاهما) يعني عدم تحديد
 * حد لتلك الجهة — فترة فارغة بالكامل تعني كل السجلات دون استثناء.
 * @returns {{list:Array, periodFrom:string, periodTo:string}}
 */
function getFilteredReportStudents(){
  const from = document.getElementById("repFrom").value;
  const to = document.getElementById("repTo").value;

  const list = reportsState.allStudents.filter(s => {
    if (!s.training_start) return false;
    if (from && s.training_start < from) return false;
    if (to && s.training_start > to) return false;
    return true;
  });

  return { list, periodFrom: from, periodTo: to };
}

/**
 * نص وصف الفترة المختارة، لعرضه في شريط الملخص أعلى كل تقرير.
 */
function reportPeriodLabel(periodFrom, periodTo){
  if (!periodFrom && !periodTo) return "جميع الفترات";
  return `الفترة: من ${periodFrom ? formatDateShort(periodFrom) : "البداية"} إلى ${periodTo ? formatDateShort(periodTo) : "الآن"}`;
}

// ---------------------------------------------------------------------------
// ربط أزرار التقارير الثلاثة
// ---------------------------------------------------------------------------
function bindReportButtons(){
  document.getElementById("printDeptsReportBtn").addEventListener("click", () => {
    printDepartmentsReport();
  });
  document.getElementById("printCollegesReportBtn").addEventListener("click", () => {
    printCollegesReport();
  });
  document.getElementById("printDetailedReportBtn").addEventListener("click", () => {
    printDetailedReport();
  });
}

// ---------------------------------------------------------------------------
// دالة مساعدة عامة: تجميع عدد المتدربين حسب حقل معيّن (القسم أو الكلية)
// ---------------------------------------------------------------------------
/**
 * تُجمِّع قائمة متدربين حسب قيمة حقل معيّن (مثلاً department أو college)،
 * وتُرجع مصفوفة {label, count} مرتبة أبجدياً عربياً، بالإضافة إلى الإجمالي.
 * القيم الفارغة/الناقصة تُجمَّع تحت تسمية "غير محدد" بدل إسقاطها من التقرير.
 * @param {Array} list - قائمة سجلات المتدربين
 * @param {string} field - اسم الحقل المطلوب التجميع بحسبه
 * @returns {{rows:Array<{label:string,count:number}>, total:number}}
 */
function groupCountByField(list, field){
  const map = new Map();
  list.forEach(s => {
    const key = (s[field] || "").trim() || "غير محدد";
    map.set(key, (map.get(key) || 0) + 1);
  });
  const rows = Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label, "ar"));
  return { rows, total: list.length };
}

// ---------------------------------------------------------------------------
// الترويسة المشتركة لكل تقرير (الشعار + اسم المستشفى + اسم القسم + عنوان التقرير)
// ---------------------------------------------------------------------------
/**
 * ترويسة موحّدة أعلى كل تقرير من التقارير الثلاثة: شعار المستشفى، اسم
 * المستشفى، اسم قسم التطوير والتوجيه المهني، ثم عنوان التقرير نفسه وتاريخ
 * إصداره. تُستخدم داخلياً من دوال بناء التقارير الثلاثة فقط.
 * @param {string} title - عنوان التقرير المطلوب عرضه
 * @returns {string} نص HTML لعنصر .report-header جاهز للتضمين
 */
function reportHeaderHTML(title){
  const generatedOn = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  return `
  <div class="report-header">
    <img src="${LOGO_IMAGE_DATA_URI}" alt="شعار المستشفى" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'logo-fallback',textContent:'إ'}))">
    <h1>${HOSPITAL_NAME}</h1>
    <h2>${HOSPITAL_SUBTITLE}</h2>
    <div class="r-title">${escapeHtml(title)}</div>
    <div class="r-date">تاريخ إصدار التقرير: ${generatedOn}</div>
  </div>`;
}

/**
 * تُغلِّف جدول تقرير جاهز داخل صفحة HTML كاملة قابلة للطباعة مباشرة عبر
 * printReportHTML()، بنفس تنسيق تقرير لوحة الإدارة العام (buildBulkReportHTML
 * في js/report.js) لكن بحجم صفحة قابل للتخصيص (عمودي للتقريرين الأول
 * والثاني، أفقي للتقرير التفصيلي بسبب عدد أعمدته).
 * @param {string} title - عنوان التقرير (يُستخدم أيضاً كعنوان مستند الطباعة)
 * @param {string} periodLabel - نص وصف الفترة المختارة لعرضه في شريط الملخص
 * @param {number} total - إجمالي عدد السجلات، لعرضه في شريط الملخص
 * @param {string} tableHtml - نص HTML كامل لعنصر <table> التقرير (colgroup/thead/tbody)
 * @param {"portrait"|"landscape"} orientation - اتجاه صفحة الطباعة
 * @returns {string} نص HTML كامل جاهز لتمريره إلى printReportHTML()
 */
function buildReportPageHTML(title, periodLabel, total, tableHtml, orientation){
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{ size: A4 ${orientation}; margin: 12mm; }

  *{ box-sizing:border-box; }
  body{
    font-family:'Cairo', Tahoma, sans-serif;
    direction: rtl;
    color:#1B2A3A;
    margin:0 auto;
    padding: 24px 30px;
    max-width: ${orientation === "landscape" ? "1150px" : "760px"};
  }
  .report-header{
    display:flex;
    flex-direction:column;
    align-items:center;
    text-align:center;
    padding-bottom:18px;
    border-bottom: 3px solid #0F6CBD;
    margin-bottom: 20px;
  }
  .report-header img{ width:64px; height:64px; object-fit:contain; margin-bottom:10px; }
  .report-header .logo-fallback{
    width:64px;height:64px;border-radius:14px;
    background: linear-gradient(135deg,#0F6CBD,#0A8F6A);
    color:#fff; font-weight:800; font-size:24px;
    display:flex;align-items:center;justify-content:center;
    margin-bottom:10px;
  }
  .report-header h1{ margin:0; font-size:21px; font-weight:800; color:#0F6CBD; }
  .report-header h2{ margin:4px 0 0; font-size:13.5px; font-weight:700; color:#4B5D71; }
  .report-header .r-title{ margin-top:10px; font-size:15px; font-weight:800; color:#1B2A3A; }
  .report-header .r-date{ margin-top:6px; font-size:11.5px; color:#8A97A6; }

  .summary-bar{
    display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;
    background:#F5F7FA; border-radius:12px; padding:12px 18px; margin-bottom:20px;
    font-size:12.6px; font-weight:700; color:#31465C;
  }
  .summary-bar span.count{ color:#0A8F6A; }

  table{
    width:100%;
    border-collapse:collapse;
    table-layout: fixed;
    margin-bottom: 20px;
  }
  table, th, td{ border-left:none; border-right:none; border-top:none; }
  thead{ display: table-header-group; }
  tbody{ display: table-row-group; }
  tr{ page-break-inside: avoid; }

  thead th{
    background:#0F6CBD; color:#fff; font-size:11px; font-weight:800;
    padding:9px 6px; text-align:center;
    word-break: break-word;
  }
  tbody td{
    padding:8px 6px; font-size:11px; text-align:center;
    border-bottom:1px solid #E3E8EE;
    word-break: break-word;
  }
  tbody tr:nth-child(even){ background:#FAFCFE; }
  tbody tr.total-row td{
    background:#E9F1FC; color:#0F6CBD; font-weight:800; font-size:11.5px;
    border-top:2px solid #0F6CBD;
  }

  .report-footer{
    text-align:center; font-size:11px; color:#8A97A6; margin-top: 30px;
    border-top:1px dashed #E3E8EE; padding-top:14px;
  }

  @media print{
    body{ padding:0; max-width:none; }
  }

  @media (max-width: 640px){
    body{ padding: 18px 14px; }
    .report-header img, .report-header .logo-fallback{ width:52px; height:52px; }
    .report-header h1{ font-size:18px; }
    thead th, tbody td{ font-size:10px; padding:6px 4px; }
  }
</style>
</head>
<body>

  ${reportHeaderHTML(title)}

  <div class="summary-bar">
    <span>${periodLabel}</span>
    <span>عدد المتدربين: <span class="count">${total}</span></span>
  </div>

  ${tableHtml}

  <div class="report-footer">
    هذا التقرير صادر آلياً من نظام تسجيل وإدارة المتدربين — ${HOSPITAL_SUBTITLE}
  </div>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// التقرير الأول: عدد المتدربين بأقسام المستشفى
// ---------------------------------------------------------------------------
function printDepartmentsReport(){
  const { list, periodFrom, periodTo } = getFilteredReportStudents();
  if (list.length === 0){
    showToast("لا يوجد متدربون ضمن هذه الفترة", "warning");
    return;
  }

  const { rows, total } = groupCountByField(list, "department");
  const bodyRows = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.label)}</td>
      <td>${r.count}</td>
    </tr>`).join("");

  const tableHtml = `
  <table>
    <colgroup>
      <col style="width:70%">
      <col style="width:30%">
    </colgroup>
    <thead>
      <tr>
        <th>القسم</th>
        <th>عدد المتدربين</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      <tr class="total-row">
        <td>الإجمالي</td>
        <td>${total}</td>
      </tr>
    </tbody>
  </table>`;

  const html = buildReportPageHTML(
    "تقرير عدد المتدربين بأقسام المستشفى",
    reportPeriodLabel(periodFrom, periodTo),
    total,
    tableHtml,
    "portrait"
  );
  printReportHTML(html);
}

// ---------------------------------------------------------------------------
// التقرير الثاني: عدد المتدربين بالجامعات والكليات
// ---------------------------------------------------------------------------
function printCollegesReport(){
  const { list, periodFrom, periodTo } = getFilteredReportStudents();
  if (list.length === 0){
    showToast("لا يوجد متدربون ضمن هذه الفترة", "warning");
    return;
  }

  const { rows, total } = groupCountByField(list, "college");
  const bodyRows = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.label)}</td>
      <td>${r.count}</td>
    </tr>`).join("");

  const tableHtml = `
  <table>
    <colgroup>
      <col style="width:70%">
      <col style="width:30%">
    </colgroup>
    <thead>
      <tr>
        <th>الجامعة / الكلية</th>
        <th>عدد المتدربين</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      <tr class="total-row">
        <td>الإجمالي</td>
        <td>${total}</td>
      </tr>
    </tbody>
  </table>`;

  const html = buildReportPageHTML(
    "تقرير عدد المتدربين بالجامعات والكليات",
    reportPeriodLabel(periodFrom, periodTo),
    total,
    tableHtml,
    "portrait"
  );
  printReportHTML(html);
}

// ---------------------------------------------------------------------------
// التقرير الثالث: تقرير تفصيلي للمتدربين (حسب القسم)
// ---------------------------------------------------------------------------
/**
 * يُجمِّع قائمة متدربين حسب القسم مع تفصيل كل قسم إلى: عدد المتدربين، عدد
 * الذكور، عدد الإناث، عدد التدريب الإلزامي، وعدد التدريب التطوعي. السجلات
 * التي أُنشئت قبل إضافة حقلي الجنس/نوع التدريب (قيمتها فارغة) تُحتسب ضمن
 * إجمالي القسم لكنها لا تُضاف لأي من أعمدة التفصيل الأربعة.
 * @param {Array} list - قائمة سجلات المتدربين المفلترة حسب الفترة
 * @returns {{rows:Array<object>, totals:object}}
 */
function groupDetailedByDepartment(list){
  const map = new Map();
  list.forEach(s => {
    const dep = (s.department || "").trim() || "غير محدد";
    if (!map.has(dep)){
      map.set(dep, { department: dep, total: 0, male: 0, female: 0, mandatory: 0, volunteer: 0 });
    }
    const row = map.get(dep);
    row.total += 1;
    if (s.gender === "ذكر") row.male += 1;
    else if (s.gender === "انثى") row.female += 1;
    if (s.training_type === "تدريب إلزامي") row.mandatory += 1;
    else if (s.training_type === "تدريب تطوعي") row.volunteer += 1;
  });

  const rows = Array.from(map.values()).sort((a, b) => a.department.localeCompare(b.department, "ar"));

  const totals = rows.reduce((acc, r) => {
    acc.total += r.total;
    acc.male += r.male;
    acc.female += r.female;
    acc.mandatory += r.mandatory;
    acc.volunteer += r.volunteer;
    return acc;
  }, { total: 0, male: 0, female: 0, mandatory: 0, volunteer: 0 });

  return { rows, totals };
}

function printDetailedReport(){
  const { list, periodFrom, periodTo } = getFilteredReportStudents();
  if (list.length === 0){
    showToast("لا يوجد متدربون ضمن هذه الفترة", "warning");
    return;
  }

  const { rows, totals } = groupDetailedByDepartment(list);
  const bodyRows = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.department)}</td>
      <td>${r.total}</td>
      <td>${r.male}</td>
      <td>${r.female}</td>
      <td>${r.mandatory}</td>
      <td>${r.volunteer}</td>
    </tr>`).join("");

  const tableHtml = `
  <table>
    <colgroup>
      <col style="width:34%">
      <col style="width:14%">
      <col style="width:13%">
      <col style="width:13%">
      <col style="width:13%">
      <col style="width:13%">
    </colgroup>
    <thead>
      <tr>
        <th>القسم</th>
        <th>عدد المتدربين</th>
        <th>ذكر</th>
        <th>انثى</th>
        <th>تدريب إلزامي</th>
        <th>تدريب تطوعي</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      <tr class="total-row">
        <td>الإجمالي</td>
        <td>${totals.total}</td>
        <td>${totals.male}</td>
        <td>${totals.female}</td>
        <td>${totals.mandatory}</td>
        <td>${totals.volunteer}</td>
      </tr>
    </tbody>
  </table>`;

  const html = buildReportPageHTML(
    "تقرير تفصيلي للمتدربين",
    reportPeriodLabel(periodFrom, periodTo),
    totals.total,
    tableHtml,
    "landscape"
  );
  printReportHTML(html);
}
