// ============================================================================
// report.js
// إنشاء تقرير قابل للطباعة/الحفظ كـ PDF لكل متدرب على حدة
// يعرض: شعار المستشفى في الأعلى وسطاً، بيانات الطالب، ثم جدول الأقسام والفترات
// ============================================================================

const HOSPITAL_NAME = "مستشفى إبراء";
const HOSPITAL_SUBTITLE = "قسم التدريب والتطوير المهني";

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
  const logoUrl = new URL("assets/logo.png", window.location.href).href;

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
  .report-header h1{ margin:0; font-size:21px; font-weight:800; color:#0F6CBD; }
  .report-header h2{ margin:4px 0 0; font-size:13.5px; font-weight:700; color:#4B5D71; }
  .report-header .r-date{ margin-top:8px; font-size:11.5px; color:#8A97A6; }

  .student-box{
    background:#F5F7FA;
    border-radius:14px;
    padding: 18px 22px;
    margin-bottom: 26px;
    display:grid;
    grid-template-columns: repeat(3, 1fr);
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
    text-align:center; font-size:11px; color:#8A97A6; margin-top: 30px;
    border-top:1px dashed #E3E8EE; padding-top:14px;
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
    هذا التقرير صادر آلياً من نظام تسجيل وإدارة المتدربين — ${HOSPITAL_SUBTITLE}
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