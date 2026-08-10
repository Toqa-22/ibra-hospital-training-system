// ============================================================================
// report.js
// بناء تقريرين قابلين للطباعة/الحفظ كـ PDF عبر خاصية الطباعة في المتصفح
// (بدون أي مكتبة PDF خارجية)، وفتحهما في تبويب/نافذة مستقلة خاصة بالتقرير مع
// طباعة تلقائية وإغلاق تلقائي بعد الطباعة — راجع تعليق printReportHTML() لتفاصيل الآلية:
//   1) تقرير متدرب واحد (buildReportHTML/openStudentReport) — من زر «🖨️ طباعة»
//      لكل صف في جدول لوحة التحكم.
//   2) تقرير عام لعدة متدربين معاً (buildBulkReportHTML/openBulkStudentsReport)
//      — من لوحة «🖨️ طباعة تقرير لفترة محددة» المستقلة عن فلاتر البحث،
//      بتنسيق A4 أفقي (Landscape) مع تكرار رأس الجدول تلقائياً على كل صفحة.
//
// يعتمد على دوال من js/ui.js (escapeHtml, formatDateShort, calcDurationDays,
// formatDurationLabel, getTrainingStatus) وعلى js/departments.js
// (findCategoryForDepartment) — يجب تحميلهما قبل هذا الملف.
// ============================================================================

const MINISTRY_NAME = "وزارة الصحة";
const HOSPITAL_NAME = "مستشفى إبراء";
const HOSPITAL_SUBTITLE = "قسم التطوير والتوجيه المهني";

/**
 * بناء صفحة HTML مستقلة وكاملة (تحتوي كل الأنماط داخلها) لتقرير متدرب واحد:
 * شعار الوزارة/المستشفى وسماً توسيطاً في الأعلى، صندوق بيانات الطالب (الاسم،
 * الهاتف، التخصص، الكلية)، جدول بكل الأقسام التي سُجّل فيها مع فئة كل قسم
 * وفترته ومدته، وختم شفاف فوق سطر التذييل في أسفل الصفحة. لا تُستخدم مباشرة —
 * يستدعيها openStudentReport() فقط لكتابة الناتج داخل نافذة منبثقة جديدة.
 * @param {{student_name:string, phone:string, records:Array}} group - بيانات الطالب وكل سجلاته
 * @returns {string} نص HTML كامل جاهز لكتابته في مستند نافذة جديدة
 */
function buildReportHTML(group){
  const sortedRecords = group.records
    .slice()
    .sort((a, b) => new Date(b.training_start) - new Date(a.training_start));

  const rows = sortedRecords
    .map(r => {
      const cat = findCategoryForDepartment(r.department);
      return `
        <tr>
          <td>${escapeHtml(r.department)}</td>
          <td>${cat ? escapeHtml(cat.name) : "—"}</td>
          <td>${formatDateShort(r.training_start)}</td>
          <td>${formatDateShort(r.training_end)}</td>
          <td>${formatDurationLabel(calcDurationDays(r.training_start, r.training_end))}</td>
        </tr>`;
    }).join("");

  const generatedOn = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const specializationLabel = sortedRecords[0] ? (sortedRecords[0].specialization || "—") : "—";
  const collegeLabel = sortedRecords[0] ? (sortedRecords[0].college || "—") : "—";
  const logoUrl = new URL("assets/logo.png", window.location.href).href;
  const stampUrl = new URL("assets/stamp.png", window.location.href).href;

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(group.student_name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{ box-sizing:border-box; }
  @page{ size: A4 portrait; margin: 12mm; }
  body{
    font-family:'Cairo', Tahoma, sans-serif;
    direction: rtl;
    color:#1B2A3A;
    margin:0;
    padding: 34px 42px;
    min-height: 88vh;
    display:flex;
    flex-direction:column;
  }
  .report-header{
    display:flex;
    flex-direction:column;
    align-items:center;
    text-align:center;
    padding-bottom:18px;
    border-bottom: 3px solid #0F6CBD;
    margin-bottom: 26px;
  }
  .report-header img{
    width:64px; height:64px; object-fit:contain; margin-bottom:10px;
  }
  .report-header .logo-fallback{
    width:64px;height:64px;border-radius:14px;
    background: linear-gradient(135deg,#0F6CBD,#0A8F6A);
    color:#fff; font-weight:800; font-size:24px;
    display:flex;align-items:center;justify-content:center;
    margin-bottom:10px;
  }
  .report-header .r-ministry{ font-size:12.5px; font-weight:700; color:#0A8F6A; margin-bottom:4px; letter-spacing:.3px; }
  .report-header h1{ margin:0; font-size:21px; font-weight:800; color:#0F6CBD; }
  .report-header h2{ margin:4px 0 0; font-size:13.5px; font-weight:700; color:#4B5D71; }
  .report-header .r-date{ margin-top:8px; font-size:11.5px; color:#8A97A6; }

  .student-box{
    background:#F5F7FA;
    border-radius:14px;
    padding: 18px 22px;
    margin-bottom: 26px;
    display:grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }
  .student-box .s-item .s-label{ font-size:11.5px; color:#64748B; font-weight:700; margin-bottom:4px; }
  .student-box .s-item .s-value{ font-size:14.5px; font-weight:800; color:#1B2A3A; }

  table{ width:100%; border-collapse:collapse; margin-bottom: 20px; }
  thead th{
    background:#0F6CBD; color:#fff; font-size:12.5px; font-weight:800;
    padding:10px 12px; text-align:center;
  }
  tbody td{
    padding:10px 12px; font-size:12.8px; text-align:center;
    border-bottom:1px solid #E3E8EE;
  }
  tbody tr:nth-child(even){ background:#FAFCFE; }

  .report-footer{
    position:relative;
    text-align:center; font-size:11px; color:#8A97A6;
    margin-top: auto;
    margin-bottom: 24px;
    padding: 22px 14px 14px;
  }
  .report-footer .stamp-img{
    position:absolute;
    top:50%; left:50%;
    transform: translate(-50%, -50%);
    width:100px; height:100px; object-fit:contain;
    opacity:0.75;
    pointer-events:none;
  }
  .report-footer span{
    position:relative;
    z-index:1;
  }

  .table-wrap{ overflow-x:auto; }

  .print-bar{ text-align:center; margin-bottom:20px; }
  .print-bar button{
    background:#0A8F6A; color:#fff; border:none; padding:10px 22px;
    border-radius:10px; font-weight:800; font-size:13.5px; cursor:pointer;
    font-family:'Cairo', Tahoma, sans-serif;
  }
  @media print{ .print-bar{ display:none; } body{ padding:0 24px; } }

  @media (max-width: 640px){
    body{ padding: 22px 16px; }
    .report-header img, .report-header .logo-fallback{ width:52px; height:52px; }
    .report-header h1{ font-size:18px; }
    .student-box{ grid-template-columns: 1fr; padding:16px; }
    table{ min-width: 640px; }
  }
</style>
</head>
<body>

  <div class="print-bar">
    <button onclick="window.print()">🖨️ طباعة</button>
  </div>

  <div class="report-header">
    <img src="${logoUrl}" alt="شعار المستشفى" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'logo-fallback',textContent:'إ'}))">
    <div class="r-ministry">${MINISTRY_NAME}</div>
    <h1>${HOSPITAL_NAME}</h1>
    <h2>${HOSPITAL_SUBTITLE}</h2>
    <div class="r-date">تاريخ إصدار التقرير: ${generatedOn}</div>
  </div>

  <div class="student-box">
    <div class="s-item">
      <div class="s-label">اسم الطالب</div>
      <div class="s-value">${escapeHtml(group.student_name)}</div>
    </div>
    <div class="s-item">
      <div class="s-label">رقم الهاتف</div>
      <div class="s-value">${escapeHtml(group.phone)}</div>
    </div>
    <div class="s-item">
      <div class="s-label">التخصص</div>
      <div class="s-value">${escapeHtml(specializationLabel)}</div>
    </div>
    <div class="s-item">
      <div class="s-label">الكلية / الجامعة</div>
      <div class="s-value">${escapeHtml(collegeLabel)}</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>القسم</th>
          <th>الفئة الرئيسية</th>
          <th>بداية التدريب</th>
          <th>نهاية التدريب</th>
          <th>مدة التدريب</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <div class="report-footer">
    <img class="stamp-img" src="${stampUrl}" alt="ختم المستشفى" onerror="this.remove()">
    <span>هذا الطلب صادر آلياً من نظام تسجيل وإدارة المتدربين — ${HOSPITAL_SUBTITLE}</span>
  </div>

</body>
</html>`;
}

/**
 * فتح تقرير في تبويب/نافذة منفصلة خاصة به (سياق تصفح علوي حقيقي، وليس إطاراً
 * مخفياً ولا استبدالاً لمحتوى التبويب الحالي)، مع تشغيل الطباعة تلقائياً فور
 * اكتمال التحميل، وإغلاق تلك النافذة تلقائياً بمجرد إغلاق نافذة الطباعة (سواء
 * ضغط المستخدم "حفظ" أو "إلغاء") عبر الحدث afterprint. زر «🖨️ طباعة» يبقى
 * ظاهراً أعلى صفحة التقرير نفسه، يدوياً، لإعادة الطباعة إن أُلغيت بالخطأ.
 *
 * لماذا نافذة/تبويب حقيقي وليس إطاراً مخفياً (iframe) أو استبدال المستند في
 * نفس التبويب: كلتا الطريقتين جُرِّبتا سابقاً وفشلتا على أغلب متصفحات الجوال
 * (Safari على آيفون، ومتصفحات أندرويد المختلفة) — إما لأن هذه المتصفحات تطبع
 * فقط النافذة العلوية الأصلية متجاهلةً أي إطار فرعي بداخلها، أو لأن استبدال
 * المستند عبر document.write يخرج عن نطاق "بادرة المستخدم" المطلوبة لتشغيل
 * الطباعة بشكل موثوق. أما فتح نافذة/تبويب جديد عبر window.open() فهو نفسه
 * سياق تصفح علوي مستقل، فيُضمن طباعته بشكل صحيح على كل المنصات.
 *
 * تُستخدم رابط Blob حقيقي (وليس نافذة فارغة يُكتب بداخلها بـ document.write)
 * حتى لا يظهر عنوان النافذة/التبويب كـ "about:blank" — فيظهر بدلاً منه عنوان
 * التقرير الفعلي (وسم <title> بداخل الصفحة، وهو اسم الطالب في تقرير الفرد).
 * إن كانت النوافذ المنبثقة محظورة في المتصفح، تُعرض رسالة تنبيه بدل الفشل الصامت.
 * تُستخدم داخلياً من openStudentReport() وopenBulkStudentsReport() فقط.
 * @param {string} html - محتوى صفحة التقرير الكامل (من buildReportHTML أو buildBulkReportHTML)
 */
function printReportHTML(html){
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const reportWindow = window.open(blobUrl, "_blank");
  if (!reportWindow){
    showToast("يرجى السماح بالنوافذ المنبثقة لعرض التقرير", "warning");
    URL.revokeObjectURL(blobUrl);
    return;
  }

  reportWindow.addEventListener("load", () => {
    URL.revokeObjectURL(blobUrl);
    reportWindow.addEventListener("afterprint", () => {
      reportWindow.close();
    });
    reportWindow.focus();
    reportWindow.print();
  });
}

/**
 * طباعة تقرير طالب واحد (من buildReportHTML) مباشرة عبر printReportHTML() —
 * راجع تعليقها أعلاه لتفاصيل الآلية.
 * @param {object} group - بيانات الطالب الممررة كما هي إلى buildReportHTML
 */
function openStudentReport(group){
  printReportHTML(buildReportHTML(group));
}

// ============================================================================
// تقرير عام قابل للطباعة يضم كل المتدربين المطابقين للفلاتر الحالية
// (يُستخدم من لوحة التحكم بدلاً من تصدير Excel)
// ============================================================================

/**
 * بناء صفحة HTML مستقلة لتقرير عام يضم عدة متدربين دفعة واحدة (تقرير الفترة
 * المحددة من لوحة التحكم). الجدول بعرض ثابت النسب (table-layout: fixed) بحيث
 * تتّسع كل الأعمدة العشرة دائماً داخل عرض صفحة A4 الأفقية دون تمرير أفقي أو
 * خطوط رأسية، ورأس الجدول (thead) يتكرر تلقائياً أعلى كل صفحة جديدة عند
 * تجاوز البيانات لصفحة واحدة أثناء الطباعة.
 * @param {Array} students - السجلات المطلوب تضمينها (نتيجة فلترة حسب الفترة عادة)
 * @param {{periodFrom?:string, periodTo?:string}} periodInfo - حدود الفترة المستخدمة، لعرضها فقط في شريط الملخص
 * @returns {string} نص HTML كامل جاهز لكتابته في مستند نافذة جديدة
 */
function buildBulkReportHTML(students, periodInfo = {}){
  const sorted = students
    .slice()
    .sort((a, b) => (a.student_name || "").localeCompare(b.student_name, "ar") || new Date(a.training_start) - new Date(b.training_start));

  const rows = sorted.map(r => {
    const status = getTrainingStatus(r.training_start, r.training_end);
    return `
      <tr>
        <td>${escapeHtml(r.student_name)}</td>
        <td>${escapeHtml(r.phone)}</td>
        <td>${escapeHtml(r.college || "—")}</td>
        <td>${escapeHtml(r.specialization)}</td>
        <td>${escapeHtml(r.department)}</td>
        <td>${formatDateShort(r.training_start)}</td>
        <td>${formatDateShort(r.training_end)}</td>
        <td>${formatDurationLabel(calcDurationDays(r.training_start, r.training_end))}</td>
        <td>${formatDateShort(r.registration_date)}</td>
        <td><span class="r-status ${status.cls}">${status.label}</span></td>
      </tr>`;
  }).join("");

  const generatedOn = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const logoUrl = new URL("assets/logo.png", window.location.href).href;

  const periodLabel = (periodInfo.periodFrom || periodInfo.periodTo)
    ? `الفترة: من ${periodInfo.periodFrom ? formatDateShort(periodInfo.periodFrom) : "البداية"} إلى ${periodInfo.periodTo ? formatDateShort(periodInfo.periodTo) : "الآن"}`
    : "جميع الفترات";

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تقرير المتدربين</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  /* حجم الصفحة عند الطباعة/الحفظ كـ PDF: A4 أفقي (Landscape) بهوامش صغيرة */
  @page{ size: A4 landscape; margin: 10mm; }

  *{ box-sizing:border-box; }
  body{
    font-family:'Cairo', Tahoma, sans-serif;
    direction: rtl;
    color:#1B2A3A;
    margin:0 auto;
    padding: 24px 30px;
    max-width: 1150px; /* يقارب عرض صفحة A4 الأفقية على الشاشة قبل الطباعة */
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
  .report-header .r-ministry{ font-size:12.5px; font-weight:700; color:#0A8F6A; margin-bottom:4px; letter-spacing:.3px; }
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

  /* ===== الجدول: عرض ثابت النسب ليتّسع كل الأعمدة داخل عرض صفحة A4 الأفقية دائماً،
     بدون أي تمرير أفقي وبدون أي خطوط رأسية بين الأعمدة (فواصل صفوف فقط) ===== */
  table{
    width:100%;
    border-collapse:collapse;
    table-layout: fixed; /* يجبر الأعمدة على الالتزام بالعرض المحدد في colgroup بدل التمدد حسب المحتوى */
    margin-bottom: 20px;
  }
  /* لا حدود جانبية إطلاقاً على الجدول أو الخلايا — فقط خط أفقي رفيع يفصل بين الصفوف */
  table, th, td{ border-left:none; border-right:none; border-top:none; }

  /* تكرار صف رأس الجدول تلقائياً أعلى كل صفحة جديدة عند الطباعة إذا تجاوزت البيانات صفحة واحدة */
  thead{ display: table-header-group; }
  tbody{ display: table-row-group; }
  tr{ page-break-inside: avoid; } /* يمنع تقطيع منتصف صف واحد بين صفحتين */

  thead th{
    background:#0F6CBD; color:#fff; font-size:10.8px; font-weight:800;
    padding:8px 6px; text-align:center;
    word-break: break-word; /* يسمح بلف النص بدل تمديد العمود وكسر الصفحة */
  }
  tbody td{
    padding:7px 6px; font-size:10.5px; text-align:center;
    border-bottom:1px solid #E3E8EE;
    word-break: break-word;
  }
  tbody tr:nth-child(even){ background:#FAFCFE; }

  .r-status{ display:inline-block; padding:4px 11px; border-radius:999px; font-size:10px; font-weight:800; }
  .status-active{ background:#E7F7EF; color:#0A8F6A; }
  .status-upcoming{ background:#E9F1FC; color:#0F6CBD; }
  .status-ended{ background:#EEF1F4; color:#5B6B7C; }

  .report-footer{
    text-align:center; font-size:11px; color:#8A97A6; margin-top: 30px;
    border-top:1px dashed #E3E8EE; padding-top:14px;
  }

  /* عند الطباعة الفعلية: نخفي زر الطباعة نفسه، ونزيل الحشو الإضافي لأن @page يضبط الهامش الفعلي */
  .print-bar{ text-align:center; margin-bottom:20px; }
  .print-bar button{
    background:#0A8F6A; color:#fff; border:none; padding:10px 22px;
    border-radius:10px; font-weight:800; font-size:13.5px; cursor:pointer;
    font-family:'Cairo', Tahoma, sans-serif;
  }
  @media print{
    .print-bar{ display:none; }
    body{ padding:0; max-width:none; }
  }

  @media (max-width: 640px){
    body{ padding: 18px 14px; }
    .report-header img, .report-header .logo-fallback{ width:52px; height:52px; }
    .report-header h1{ font-size:18px; }
    thead th, tbody td{ font-size:9.5px; padding:6px 4px; }
  }
</style>
</head>
<body>

  <div class="print-bar">
    <button onclick="window.print()">🖨️ طباعة</button>
  </div>

  <div class="report-header">
    <img src="${logoUrl}" alt="شعار المستشفى" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'logo-fallback',textContent:'إ'}))">
    <div class="r-ministry">${MINISTRY_NAME}</div>
    <h1>${HOSPITAL_NAME}</h1>
    <h2>${HOSPITAL_SUBTITLE}</h2>
    <div class="r-title">تقرير عام بالمتدربين</div>
    <div class="r-date">تاريخ إصدار التقرير: ${generatedOn}</div>
  </div>

  <div class="summary-bar">
    <span>${periodLabel}</span>
    <span>عدد السجلات: <span class="count">${sorted.length}</span></span>
  </div>

  <table>
    <!-- عرض كل عمود بالنسبة المئوية بحيث يكون المجموع 100% دائماً، مهما كان محتوى الصفوف -->
    <colgroup>
      <col style="width:13%"> <!-- اسم الطالب -->
      <col style="width:9%">  <!-- رقم الهاتف -->
      <col style="width:12%"> <!-- الكلية -->
      <col style="width:11%"> <!-- التخصص -->
      <col style="width:13%"> <!-- القسم -->
      <col style="width:8%">  <!-- بداية التدريب -->
      <col style="width:8%">  <!-- نهاية التدريب -->
      <col style="width:8%">  <!-- مدة التدريب -->
      <col style="width:9%">  <!-- تاريخ التسجيل -->
      <col style="width:9%">  <!-- الحالة -->
    </colgroup>
    <thead>
      <tr>
        <th>اسم الطالب</th>
        <th>رقم الهاتف</th>
        <th>الكلية</th>
        <th>التخصص</th>
        <th>القسم</th>
        <th>بداية التدريب</th>
        <th>نهاية التدريب</th>
        <th>مدة التدريب</th>
        <th>تاريخ التسجيل</th>
        <th>الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="report-footer">
    هذا الطلب صادر آلياً من نظام تسجيل وإدارة المتدربين — ${HOSPITAL_SUBTITLE}
  </div>

</body>
</html>`;
}

/**
 * فتح التقرير العام لعدة متدربين معاً (من buildBulkReportHTML) عبر
 * printReportHTML() — بنفس منطق openStudentReport() تماماً
 * (راجع تعليق printReportHTML() أعلاه لتفاصيل الآلية).
 * @param {Array} students - السجلات الممررة كما هي إلى buildBulkReportHTML
 * @param {object} periodInfo - حدود الفترة الممررة كما هي إلى buildBulkReportHTML
 */
function openBulkStudentsReport(students, periodInfo = {}){
  printReportHTML(buildBulkReportHTML(students, periodInfo));
}
