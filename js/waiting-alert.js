// ============================================================================
// waiting-alert.js
// بطاقة تنبيه دورية تظهر تلقائياً كل 3 ساعات في كل صفحة تُحمِّل هذا الملف
// (register.html، dashboard.html، reports.html — وليس waiting.html نفسها،
// فلا داعي لتذكير المستخدم بقائمة الانتظار وهو أصلاً فيها، ولا index.html
// صفحة تسجيل الدخول التي يجب ألا يظهر فيها أي محتوى قبل الدخول). تعرض عدد
// المتدربين الحاليين في قائمة الانتظار (is_waitlist = true)، وتُغلق إما بزر
// ✕ أو بالنقر عليها للانتقال مباشرة لصفحة قائمة الانتظار (waiting.html).
//
// توقيت آخر ظهور يُخزَّن في localStorage (مشترك بين كل صفحات الموقع على نفس
// المتصفح/الجهاز) حتى لا تتكرر البطاقة عند كل تنقل بين الصفحات خلال أقل من
// 3 ساعات، وتُفحص أيضاً بشكل دوري (كل 5 دقائق) أثناء بقاء التبويب مفتوحاً
// لفترة طويلة دون إعادة تحميل، حتى تظهر البطاقة فور مرور 3 ساعات دون الحاجة
// لتحديث الصفحة يدوياً.
//
// الاعتماديات المطلوب تحميلها قبل هذا الملف: js/config.js وjs/supabase.js
// (تحديداً fetchWaitlistStudents()).
// ============================================================================

const WAITING_ALERT_KEY = "ibra_waiting_alert_last_shown";
const WAITING_ALERT_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 ساعات
const WAITING_ALERT_CHECK_EVERY_MS = 5 * 60 * 1000;    // إعادة فحص كل 5 دقائق
const WAITING_ALERT_INITIAL_DELAY_MS = 2500;           // تأخير أول ظهور بعد تحميل الصفحة

/**
 * هل مرّ 3 ساعات (أو أكثر) منذ آخر مرة ظهرت فيها البطاقة على هذا المتصفح؟
 * أول زيارة على الإطلاق (لا قيمة مخزَّنة بعد) تُعامَل كأن الوقت قد حان.
 * @returns {boolean}
 */
function shouldShowWaitingAlert(){
  const last = Number(localStorage.getItem(WAITING_ALERT_KEY) || 0);
  return (Date.now() - last) >= WAITING_ALERT_INTERVAL_MS;
}

/**
 * تسجيل الوقت الحالي كآخر ظهور للبطاقة في localStorage، حتى لا تظهر البطاقة
 * مرة أخرى قبل مرور 3 ساعات كاملة من هذه اللحظة — بغض النظر عن عدد الصفحات
 * أو مرات التنقل بينها خلال تلك المدة.
 */
function markWaitingAlertShown(){
  localStorage.setItem(WAITING_ALERT_KEY, String(Date.now()));
}

/**
 * الفحص الدوري الرئيسي: يتحقق من حان وقت إظهار البطاقة، يجلب عدد قائمة
 * الانتظار الحالي، ويعرض البطاقة إن كان العدد أكبر من صفر. عند فشل الجلب أو
 * كون القائمة فارغة حالياً، لا يُسجَّل وقت ظهور (لا markWaitingAlertShown)
 * حتى تُعاد المحاولة تلقائياً عند الفحص الدوري التالي (بعد 5 دقائق) بدل
 * الانتظار 3 ساعات كاملة لعدد قد يتغيّر خلالها.
 */
async function maybeShowWaitingAlert(){
  if (document.getElementById("waitingAlertCard")) return; // بطاقة معروضة أصلاً على الشاشة
  if (!shouldShowWaitingAlert()) return;

  let count = 0;
  try {
    const list = await fetchWaitlistStudents();
    count = list.length;
  } catch (err){
    console.error("تعذر تحميل عدد قائمة الانتظار للبطاقة الدورية:", err);
    return;
  }

  if (count === 0) return; // لا داعي لإزعاج المستخدم إن كانت القائمة فارغة حالياً

  renderWaitingAlertCard(count);
  markWaitingAlertShown();
}

/**
 * بناء بطاقة التنبيه فعلياً وإدراجها في الصفحة، مع مستمعي إغلاق (✕) والنقر
 * للانتقال المباشر لصفحة قائمة الانتظار.
 * @param {number} count - عدد المتدربين الحاليين في قائمة الانتظار
 */
function renderWaitingAlertCard(count){
  const card = document.createElement("div");
  card.id = "waitingAlertCard";
  card.className = "waiting-alert-card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.innerHTML = `
    <button type="button" class="waiting-alert-close" aria-label="إغلاق">✕</button>
    <div class="waiting-alert-icon">⏳</div>
    <div class="waiting-alert-body">
      <div class="waiting-alert-title">قائمة الانتظار</div>
      <div class="waiting-alert-count">${count} ${count === 1 ? "متدرب" : "متدربين"} بانتظار تحديد فترة التدريب</div>
      <div class="waiting-alert-hint">اضغط للانتقال إلى قائمة الانتظار ←</div>
    </div>
  `;

  card.querySelector(".waiting-alert-close").addEventListener("click", (e) => {
    e.stopPropagation();
    card.remove();
  });

  const goToWaitingPage = () => { location.href = "waiting.html"; };
  card.addEventListener("click", goToWaitingPage);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " "){
      e.preventDefault();
      goToWaitingPage();
    }
  });

  document.body.appendChild(card);
  requestAnimationFrame(() => card.classList.add("show"));
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(maybeShowWaitingAlert, WAITING_ALERT_INITIAL_DELAY_MS);
  setInterval(maybeShowWaitingAlert, WAITING_ALERT_CHECK_EVERY_MS);
});
