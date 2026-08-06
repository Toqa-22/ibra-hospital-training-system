// ============================================================================
// report.js
// إنشاء تقرير قابل للطباعة/الحفظ كـ PDF لكل متدرب على حدة
// يعرض: شعار المستشفى في الأعلى وسطاً، بيانات الطالب، ثم جدول الأقسام والفترات
// ============================================================================

const MINISTRY_NAME = "وزارة الصحة";
const HOSPITAL_NAME = "مستشفى إبراء";
const HOSPITAL_SUBTITLE = "قسم التطوير والتوجيه المهني";

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
<title>تقرير المتدرب — ${escapeHtml(group.student_name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{ box-sizing:border-box; }
  body{
    font-family:'Cairo', Tahoma, sans-serif;
    direction: rtl;
    color:#1B2A3A;
    margin:0;
    padding: 34px 42px;
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
    text-align:center; font-size:11px; color:#8A97A6; margin-top: 30px;
    border-top:1px dashed #E3E8EE; padding: 22px 14px 14px;
  }
  .report-footer .stamp-img{
    position:absolute;
    top:50%; left:50%;
    transform: translate(-50%, -50%);
    width:100px; height:100px; object-fit:contain;
    opacity:0.4;
    pointer-events:none;
  }
  .report-footer span{
    position:relative;
    z-index:1;
  }

  .print-bar{ text-align:center; margin-bottom:20px; }
  .print-bar button{
    background:#0A8F6A; color:#fff; border:none; padding:10px 22px;
    border-radius:10px; font-weight:800; font-size:13.5px; cursor:pointer;
    font-family:'Cairo', Tahoma, sans-serif;
  }
  @media print{ .print-bar{ display:none; } body{ padding:0 24px; } }

  .table-wrap{ overflow-x:auto; }

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
    <button onclick="window.print()">🖨️ طباعة / حفظ كـ PDF</button>
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
    <span>هذا التقرير صادر آلياً من نظام تسجيل وإدارة المتدربين — ${HOSPITAL_SUBTITLE}</span>
  </div>

</body>
</html>`;
}

function openStudentReport(group){
  const reportWindow = window.open("", "_blank", "width=900,height=760");
  if (!reportWindow){
    showToast("يرجى السماح بالنوافذ المنبثقة لعرض التقرير", "warning");
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(buildReportHTML(group));
  reportWindow.document.close();
}

// ============================================================================
// تقرير عام قابل للطباعة يضم كل المتدربين المطابقين للفلاتر الحالية
// (يُستخدم من لوحة التحكم بدلاً من تصدير Excel)
// ============================================================================

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
  *{ box-sizing:border-box; }
  body{
    font-family:'Cairo', Tahoma, sans-serif;
    direction: rtl;
    color:#1B2A3A;
    margin:0;
    padding: 34px 42px;
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

  table{ width:100%; border-collapse:collapse; margin-bottom: 20px; }
  thead th{
    background:#0F6CBD; color:#fff; font-size:11.8px; font-weight:800;
    padding:9px 10px; text-align:center; white-space:nowrap;
  }
  tbody td{
    padding:9px 10px; font-size:11.8px; text-align:center;
    border-bottom:1px solid #E3E8EE; white-space:nowrap;
  }
  tbody tr:nth-child(even){ background:#FAFCFE; }

  .r-status{ display:inline-block; padding:4px 11px; border-radius:999px; font-size:10.5px; font-weight:800; }
  .status-active{ background:#E7F7EF; color:#0A8F6A; }
  .status-upcoming{ background:#E9F1FC; color:#0F6CBD; }
  .status-ended{ background:#EEF1F4; color:#5B6B7C; }

  .report-footer{
    text-align:center; font-size:11px; color:#8A97A6; margin-top: 30px;
    border-top:1px dashed #E3E8EE; padding-top:14px;
  }

  .print-bar{ text-align:center; margin-bottom:20px; }
  .print-bar button{
    background:#0A8F6A; color:#fff; border:none; padding:10px 22px;
    border-radius:10px; font-weight:800; font-size:13.5px; cursor:pointer;
    font-family:'Cairo', Tahoma, sans-serif;
  }
  @media print{ .print-bar{ display:none; } body{ padding:0 24px; } thead th{ position: static; } }

  .table-wrap{ overflow-x:auto; }

  @media (max-width: 640px){
    body{ padding: 22px 16px; }
    .report-header img, .report-header .logo-fallback{ width:52px; height:52px; }
    .report-header h1{ font-size:18px; }
    table{ min-width: 900px; }
  }
</style>
</head>
<body>

  <div class="print-bar">
    <button onclick="window.print()">🖨️ طباعة / حفظ كـ PDF</button>
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

  <div class="table-wrap">
    <table>
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
  </div>

  <div class="report-footer">
    هذا التقرير صادر آلياً من نظام تسجيل وإدارة المتدربين — ${HOSPITAL_SUBTITLE}
  </div>

</body>
</html>`;
}

function openBulkStudentsReport(students, periodInfo = {}){
  const reportWindow = window.open("", "_blank", "width=1100,height=780");
  if (!reportWindow){
    showToast("يرجى السماح بالنوافذ المنبثقة لعرض التقرير", "warning");
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(buildBulkReportHTML(students, periodInfo));
  reportWindow.document.close();
}
