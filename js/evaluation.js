// ============================================================================
// evaluation.js
// ميزة «📋 التقييم»: نموذج تقييم رسمي للمتدرب بثلاثة أقسام — يُفتح من زر
// مخصص في جدول لوحة الإدارة (dashboard.js)، ويُطبع على ترويسة مستشفى إبراء
// الرسمية (assets/letterhead.jpg) بنفس آلية الطباعة المستخدمة في التقارير
// العادية (printReportHTML من js/report.js — طباعة داخل نفس الصفحة، بلا أي
// نافذة منبثقة، أثبتت أنها الأسلوب الوحيد الموثوق فعلياً على متصفحات الجوال).
//
// الأقسام الثلاثة، مطابقة للنموذج الرسمي المعتمد بالمستشفى:
//   A. PERSONAL PARTICULARS — تلقائية بالكامل من سجل الطالب (الاسم، التخصص،
//      الجامعة، فترة التدريب)، عدا حقلين غير موجودين أصلاً في جدول students
//      (السنة الدراسية، الدولة) يُدخلان يدوياً بقيمة افتراضية معقولة للدولة.
//   B. STUDENTS PERFORMANCE — خمسة معايير (الحضور، المعرفة النظرية، المعرفة
//      العملية، المهارات، السلوك)، كل معيار درجة واحدة من: A/B/C/D.
//   C. GENERAL COMMENTS — ملاحظات حرة + اسم المشرف المباشر + التاريخ
//      (خانة التوقيع تبقى فارغة في الطباعة للتوقيع اليدوي الفعلي).
//
// يعتمد على: js/supabase.js (fetchLatestEvaluationForStudent, saveEvaluation)
// js/ui.js (showToast, escapeHtml, formatDateShort, describeSupabaseError)
// js/report.js (المتغيرات MINISTRY_NAME/HOSPITAL_NAME، ودالة printReportHTML)
// — يجب تحميل هذه الملفات جميعها قبل evaluation.js في dashboard.html.
// ============================================================================

const EVAL_RATING_ROWS = [
  { key: "attendance",  labelAr: "الحضور",              labelEn: "Attendance" },
  { key: "theoretical", labelAr: "المعرفة النظرية",      labelEn: "Theoretical Knowledge" },
  { key: "practical",   labelAr: "المعرفة العملية",      labelEn: "Practical Knowledge" },
  { key: "skills",      labelAr: "المهارات",             labelEn: "Skills" },
  { key: "attitude",    labelAr: "السلوك",               labelEn: "Attitude" },
];

const EVAL_RATING_OPTIONS = [
  { value: "A", labelAr: "ممتاز",     labelEn: "Excellent" },
  { value: "B", labelAr: "جيد جداً",  labelEn: "Very good" },
  { value: "C", labelAr: "جيد",       labelEn: "Good" },
  { value: "D", labelAr: "مقبول",     labelEn: "Acceptable" },
];

// ---------------------------------------------------------------------------
// إنشاء/إعادة استخدام نافذة نموذج التقييم
// ---------------------------------------------------------------------------
/**
 * التأكد من وجود نافذة نموذج التقييم في الصفحة، وإنشاؤها إن لم تكن موجودة
 * بعد. تُستدعى داخلياً من showEvaluationModal() فقط.
 * @returns {HTMLElement} عنصر الطبقة الخلفية (overlay) لهذه النافذة
 */
function ensureEvaluationModal(){
  let overlay = document.querySelector(".evaluation-modal-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.className = "modal-overlay evaluation-modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box edit-modal-box evaluation-modal-box">
      <h4 class="m-title">📋 تقييم المتدرب</h4>

      <div class="eval-section">
        <h5>A. البيانات الشخصية</h5>
        <div class="eval-grid">
          <div class="eval-field"><label>اسم الطالب</label><input class="ev-name" readonly></div>
          <div class="eval-field"><label>التخصص</label><input class="ev-specialty" readonly></div>
          <div class="eval-field"><label>الجامعة / الكلية</label><input class="ev-university" readonly></div>
          <div class="eval-field"><label>فترة التدريب</label><input class="ev-period" readonly></div>
          <div class="eval-field"><label>السنة الدراسية</label><input class="ev-year" placeholder="مثال: السنة الثانية"></div>
          <div class="eval-field"><label>الدولة</label><input class="ev-country"></div>
          <div class="eval-field full"><label>مكان التدريب</label><input class="ev-place"></div>
        </div>
      </div>

      <div class="eval-section">
        <h5>B. تقييم الأداء</h5>
        <div class="eval-rating-scroll">
          <table class="eval-rating-table">
            <thead>
              <tr>
                <th class="rt-label"></th>
                ${EVAL_RATING_OPTIONS.map(o => `<th>${o.labelAr}<span>(${o.value})</span></th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${EVAL_RATING_ROWS.map(row => `
                <tr data-row="${row.key}">
                  <td class="rt-label">${row.labelAr}</td>
                  ${EVAL_RATING_OPTIONS.map(o => `
                    <td><label class="rt-radio"><input type="radio" name="ev_rate_${row.key}" value="${o.value}"></label></td>
                  `).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="eval-section">
        <h5>C. ملاحظات عامة</h5>
        <textarea class="ev-comments" rows="4" placeholder="اكتب ملاحظات عامة عن أداء المتدرب خلال فترة التدريب..."></textarea>
        <div class="eval-grid" style="margin-top:12px">
          <div class="eval-field"><label>اسم المشرف المباشر</label><input class="ev-supervisor" placeholder="مثال: إبراهيم السيناوي"></div>
          <div class="eval-field"><label>التاريخ</label><input type="date" class="ev-date"></div>
        </div>
      </div>

      <p class="e-error"></p>
      <div class="modal-actions eval-actions">
        <button class="m-cancel">إغلاق</button>
        <button class="m-print-eval">🖨️ طباعة</button>
        <button class="m-save-eval">💾 حفظ التقييم</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

// ---------------------------------------------------------------------------
// فتح النموذج لطالب معيّن
// ---------------------------------------------------------------------------
/**
 * فتح نافذة تقييم لمجموعة سجلات طالب واحد (group بنفس بنية مجموعات لوحة
 * الإدارة: student_name, phone, college, specialization, records[]). تعبئة
 * القسم أ تلقائياً من أول سجل في المجموعة (الاسم، التخصص، الجامعة، الفترة)،
 * ثم محاولة تحميل آخر تقييم محفوظ سابقاً لهذا الطالب (إن وُجد) لتعبئة بقية
 * الحقول تلقائياً أيضاً بدل البدء من نموذج فارغ في كل مرة.
 * @param {{student_name:string, phone:string, college:string, specialization:string, records:Array}} group - مجموعة سجلات الطالب من جدول لوحة الإدارة
 */
async function showEvaluationModal(group){
  const overlay = ensureEvaluationModal();
  const primary = group.records[0];

  const nameInput = overlay.querySelector(".ev-name");
  const specialtyInput = overlay.querySelector(".ev-specialty");
  const universityInput = overlay.querySelector(".ev-university");
  const periodInput = overlay.querySelector(".ev-period");
  const yearInput = overlay.querySelector(".ev-year");
  const countryInput = overlay.querySelector(".ev-country");
  const placeInput = overlay.querySelector(".ev-place");
  const commentsInput = overlay.querySelector(".ev-comments");
  const supervisorInput = overlay.querySelector(".ev-supervisor");
  const dateInput = overlay.querySelector(".ev-date");
  const errorEl = overlay.querySelector(".e-error");

  // القسم أ: تعبئة تلقائية من سجل الطالب (لا تُعدَّل يدوياً — حقول readonly)
  // ملاحظة: group هنا من groupDuplicateStudents() في dashboard.js، وشكله
  // {student_name, phone, records[]} فقط — التخصص والجامعة والفترة تُقرأ من
  // أول سجل (primary) وليس من الكائن group نفسه مباشرة.
  nameInput.value = group.student_name || "";
  specialtyInput.value = (primary && primary.specialization) || "";
  universityInput.value = (primary && primary.college) || "";
  periodInput.value = (primary && primary.training_start && primary.training_end)
    ? `${formatDateShort(primary.training_start)} — ${formatDateShort(primary.training_end)}`
    : "غير محدد";

  // قيم افتراضية معقولة، تُستبدل لاحقاً بآخر تقييم محفوظ إن وُجد
  yearInput.value = "";
  countryInput.value = "سلطنة عُمان";
  placeInput.value = "مستشفى إبراء";
  commentsInput.value = "";
  supervisorInput.value = "";
  dateInput.value = new Date().toISOString().slice(0, 10);
  overlay.querySelectorAll('input[type="radio"]').forEach(r => { r.checked = false; });
  errorEl.textContent = "";
  errorEl.classList.remove("show");
  overlay.dataset.evalId = "";
  overlay.dataset.studentId = primary ? primary.id : "";

  overlay.classList.add("show");

  // محاولة تحميل آخر تقييم محفوظ سابقاً لهذا الطالب (وضع تعديل بدل إنشاء جديد)
  if (primary && primary.id){
    try {
      const existing = await fetchLatestEvaluationForStudent(primary.id);
      if (existing){
        overlay.dataset.evalId = existing.id;
        yearInput.value = existing.year_of_study || "";
        countryInput.value = existing.country || "سلطنة عُمان";
        placeInput.value = existing.place_of_training || "مستشفى إبراء";
        commentsInput.value = existing.general_comments || "";
        supervisorInput.value = existing.supervisor_name || "";
        dateInput.value = existing.evaluation_date || new Date().toISOString().slice(0, 10);
        EVAL_RATING_ROWS.forEach(row => {
          const val = existing[`rating_${row.key}`];
          if (val){
            const radio = overlay.querySelector(`input[name="ev_rate_${row.key}"][value="${val}"]`);
            if (radio) radio.checked = true;
          }
        });
      }
    } catch (err){
      console.error("تعذّر تحميل تقييم سابق:", err);
      // فشل التحميل هنا ليس خطأ فادحاً — يستمر النموذج بقيمه الافتراضية الفارغة
    }
  }

  bindEvaluationActions(overlay, group, primary);
}

/**
 * ربط أزرار نافذة التقييم (إغلاق، طباعة، حفظ) بمستمعي أحداث جديدة في كل مرة
 * تُفتح فيها النافذة — تُزال المستمعات القديمة أولاً عبر استنساخ الأزرار
 * (clone) لتفادي تراكم مستمعات مكررة من فتحات سابقة للنافذة لطلاب مختلفين.
 * @param {HTMLElement} overlay - عنصر نافذة التقييم
 * @param {object} group - مجموعة سجلات الطالب الحالي
 * @param {object} primary - أول سجل من مجموعة الطالب (لبيانات القسم أ)
 */
function bindEvaluationActions(overlay, group, primary){
  const cancelBtn = overlay.querySelector(".m-cancel");
  const printBtn = overlay.querySelector(".m-print-eval");
  const saveBtn = overlay.querySelector(".m-save-eval");

  const freshCancel = cancelBtn.cloneNode(true);
  cancelBtn.replaceWith(freshCancel);
  const freshPrint = printBtn.cloneNode(true);
  printBtn.replaceWith(freshPrint);
  const freshSave = saveBtn.cloneNode(true);
  saveBtn.replaceWith(freshSave);

  freshCancel.addEventListener("click", () => {
    overlay.classList.remove("show");
  });

  freshPrint.addEventListener("click", () => {
    const data = collectEvaluationFormData(overlay, group, primary);
    printReportHTML(buildEvaluationPrintHTML(data));
  });

  freshSave.addEventListener("click", async () => {
    const errorEl = overlay.querySelector(".e-error");
    const data = collectEvaluationFormData(overlay, group, primary);

    if (!data.supervisor_name){
      errorEl.textContent = "يرجى إدخال اسم المشرف المباشر قبل الحفظ";
      errorEl.classList.add("show");
      return;
    }

    setButtonLoading(freshSave, true);
    try {
      const payload = {
        id: overlay.dataset.evalId || undefined,
        student_id: overlay.dataset.studentId || null,
        student_name: data.student_name,
        specialty: data.specialty,
        university: data.university,
        year_of_study: data.year_of_study,
        country: data.country,
        place_of_training: data.place_of_training,
        period_from: primary ? primary.training_start : null,
        period_to: primary ? primary.training_end : null,
        rating_attendance: data.ratings.attendance || null,
        rating_theoretical: data.ratings.theoretical || null,
        rating_practical: data.ratings.practical || null,
        rating_skills: data.ratings.skills || null,
        rating_attitude: data.ratings.attitude || null,
        general_comments: data.general_comments,
        supervisor_name: data.supervisor_name,
        evaluation_date: data.evaluation_date,
      };
      const saved = await saveEvaluation(payload);
      if (saved && saved.id) overlay.dataset.evalId = saved.id;
      errorEl.classList.remove("show");
      showToast("تم حفظ التقييم بنجاح", "success");
    } catch (err){
      console.error("فشل حفظ التقييم:", err);
      showToast(describeSupabaseError(err, "تعذّر حفظ التقييم"), "error");
    } finally {
      setButtonLoading(freshSave, false);
    }
  });
}

/**
 * قراءة كل قيم نموذج التقييم الحالية من عناصر النافذة إلى كائن بيانات واحد،
 * تُستخدم من كل من زري «طباعة» و«حفظ» معاً لتفادي تكرار منطق القراءة.
 * @param {HTMLElement} overlay - عنصر نافذة التقييم
 * @param {object} group - مجموعة سجلات الطالب الحالي (للاسم/الهاتف عند الحاجة)
 * @param {object} primary - أول سجل من مجموعة الطالب (لتواريخ الفترة الأصلية)
 * @returns {object} بيانات التقييم الكاملة جاهزة للطباعة أو الحفظ
 */
function collectEvaluationFormData(overlay, group, primary){
  const ratings = {};
  EVAL_RATING_ROWS.forEach(row => {
    const checked = overlay.querySelector(`input[name="ev_rate_${row.key}"]:checked`);
    ratings[row.key] = checked ? checked.value : "";
  });

  return {
    student_name: overlay.querySelector(".ev-name").value.trim(),
    specialty: overlay.querySelector(".ev-specialty").value.trim(),
    university: overlay.querySelector(".ev-university").value.trim(),
    period_label: overlay.querySelector(".ev-period").value.trim(),
    year_of_study: overlay.querySelector(".ev-year").value.trim(),
    country: overlay.querySelector(".ev-country").value.trim(),
    place_of_training: overlay.querySelector(".ev-place").value.trim(),
    general_comments: overlay.querySelector(".ev-comments").value.trim(),
    supervisor_name: overlay.querySelector(".ev-supervisor").value.trim(),
    evaluation_date: overlay.querySelector(".ev-date").value,
    ratings,
  };
}

// ---------------------------------------------------------------------------
// بناء صفحة الطباعة على ترويسة المستشفى الرسمية
// ---------------------------------------------------------------------------
/**
 * بناء صفحة HTML لطباعة نموذج التقييم فوق صورة ترويسة مستشفى إبراء الرسمية
 * (assets/letterhead.jpg) كخلفية صفحة كاملة — المحتوى يُوضع ضمن هوامش آمنة
 * تتجنّب رأس وذيل الترويسة المطبوعين مسبقاً على الصورة. تُطبع عبر
 * printReportHTML() من js/report.js (نفس آلية طباعة التقارير العادية،
 * داخل نفس الصفحة الحالية بلا أي نافذة منبثقة).
 * @param {object} data - بيانات التقييم الكاملة من collectEvaluationFormData()
 * @returns {string} نص HTML كامل جاهز لتمريره إلى printReportHTML()
 */
function buildEvaluationPrintHTML(data){
  const ratingCell = (rowKey, optionValue) =>
    data.ratings[rowKey] === optionValue ? "✓" : "";

  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<title>Evaluation — ${escapeHtml(data.student_name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{ size: A4 portrait; margin: 0; }
  *{ box-sizing:border-box; }
  body{
    font-family:'Cairo', Tahoma, Arial, sans-serif;
    margin:0;
    width:210mm;
    height:297mm;
    position:relative;
    color:#1B2A3A;
  }
  .letterhead-bg{
    position:absolute; top:0; left:0;
    width:210mm; height:297mm;
    object-fit:cover;
  }
  .eval-page-content{
    position:absolute;
    top:62mm; left:20mm; right:20mm; bottom:38mm;
    font-size:11.5px;
    line-height:1.55;
    direction: ltr;
    text-align: left;
  }
  h3.sec-title{
    font-size:12.5px;
    font-weight:800;
    margin:0 0 8px;
    padding-bottom:4px;
    border-bottom:1.5px solid #1B2A3A;
  }
  .p-row{ display:flex; gap:6px; margin-bottom:5px; }
  .p-row .p-label{ font-weight:800; white-space:nowrap; }
  .p-row .p-value{ flex:1; border-bottom:1px dotted #8A97A6; padding-bottom:1px; }

  table.rate-table{
    width:100%;
    border-collapse:collapse;
    margin: 10px 0 14px;
    font-size:11px;
  }
  table.rate-table th, table.rate-table td{
    border:1px solid #1B2A3A;
    padding:5px 6px;
    text-align:center;
  }
  table.rate-table th{ font-weight:800; background:#F3F5F8; }
  table.rate-table td:first-child, table.rate-table th:first-child{
    text-align:right;
    font-weight:700;
    width:34%;
  }
  .mark{ font-weight:900; font-size:13px; }

  .comments-box{
    border:1px solid #1B2A3A;
    min-height:60px;
    padding:8px;
    margin-bottom:14px;
    white-space:pre-wrap;
    font-size:11px;
  }

  .sign-row{
    display:flex;
    justify-content:space-between;
    align-items:flex-end;
    margin-top:26px;
  }
  .sign-row .sign-block{ text-align:center; width:45%; }
  .sign-row .sign-line{ border-top:1px solid #1B2A3A; margin-top:26px; padding-top:4px; font-size:10.5px; }

  @media print{
    body{ margin:0; }
  }
</style>
</head>
<body>

  <img class="letterhead-bg" src="assets/letterhead.jpg" alt="">

  <div class="eval-page-content">

    <h3 class="sec-title">A. PERSONAL PARTICULARS</h3>
    <div class="p-row"><span class="p-label">Name of Student:</span><span class="p-value">${escapeHtml(data.student_name)}</span></div>
    <div class="p-row"><span class="p-label">Specialty:</span><span class="p-value">${escapeHtml(data.specialty)}</span></div>
    <div class="p-row"><span class="p-label">University:</span><span class="p-value">${escapeHtml(data.university)}</span></div>
    <div class="p-row"><span class="p-label">Year of Study:</span><span class="p-value">${escapeHtml(data.year_of_study)}</span></div>
    <div class="p-row"><span class="p-label">Country:</span><span class="p-value">${escapeHtml(data.country)}</span></div>
    <div class="p-row"><span class="p-label">Place of Training / Attachment:</span><span class="p-value">${escapeHtml(data.place_of_training)}</span></div>
    <div class="p-row"><span class="p-label">Period:</span><span class="p-value">${escapeHtml(data.period_label)}</span></div>

    <h3 class="sec-title" style="margin-top:14px">B. STUDENTS PERFORMANCE (Tick the appropriate letter below)</h3>
    <table class="rate-table">
      <thead>
        <tr>
          <th></th>
          <th>Excellent (A)</th>
          <th>Very good (B)</th>
          <th>Good (C)</th>
          <th>Acceptable (D)</th>
        </tr>
      </thead>
      <tbody>
        ${EVAL_RATING_ROWS.map(row => `
          <tr>
            <td>${escapeHtml(row.labelEn)}</td>
            <td class="mark">${ratingCell(row.key, "A")}</td>
            <td class="mark">${ratingCell(row.key, "B")}</td>
            <td class="mark">${ratingCell(row.key, "C")}</td>
            <td class="mark">${ratingCell(row.key, "D")}</td>
          </tr>`).join("")}
      </tbody>
    </table>

    <h3 class="sec-title">C. GENERAL COMMENTS</h3>
    <div class="comments-box">${escapeHtml(data.general_comments)}</div>

    <div class="sign-row">
      <div class="sign-block">
        <div class="sign-line">${escapeHtml(data.supervisor_name)}<br>Name of Immediate Supervisor</div>
      </div>
      <div class="sign-block">
        <div class="sign-line">&nbsp;<br>Signature</div>
      </div>
    </div>
    <div class="p-row" style="margin-top:14px"><span class="p-label">Date:</span><span class="p-value">${escapeHtml(formatDateShort(data.evaluation_date))}</span></div>

  </div>

</body>
</html>`;
}
