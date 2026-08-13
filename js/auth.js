// ============================================================================
// auth.js
// منطق تسجيل الدخول/الخروج لكل صفحات النظام الأربع المحمية (register.html،
// waiting.html، dashboard.html، reports.html)، بالكامل بدون أي اسم مستخدم أو
// كلمة مرور مكتوبة داخل كود الواجهة — التحقق الفعلي يتم بالكامل داخل قاعدة
// بيانات Supabase عبر دالة verify_admin_login() (راجع sql/add_admin_login.sql):
// كلمة المرور تُرسَل عبر HTTPS إلى تلك الدالة فقط، وتُقارَن هناك بتجزئتها
// (bcrypt عبر pgcrypto) داخل الخادم، وتُعيد الدالة true/false فقط — لا تُرسَل
// أي تجزئة أو كلمة مرور مخزَّنة إلى المتصفح في أي اتجاه.
//
// بعد نجاح الدخول، تُحفظ جلسة محلية بسيطة (اسم المستخدم + وقت الدخول) في
// localStorage لمدة صلاحية محدودة (AUTH_SESSION_HOURS)، تُستخدم فقط لتفادي
// إعادة تسجيل الدخول في كل زيارة — وليست آلية حماية فعلية بديلة عن سياسات
// RLS في قاعدة البيانات.
//
// الاعتماديات المطلوب تحميلها قبل هذا الملف:
//   - في index.html (صفحة الدخول): js/config.js، js/ui.js، js/supabase.js (لاستدعاء RPC)
//   - في الصفحات المحمية الأربع: يكفي تحميله لأجل logoutAdmin() وربط رابط
//     تسجيل الخروج تلقائياً (راجع الجزء الأخير من هذا الملف)، فالحارس الفعلي
//     الذي يمنع عرض المحتوى قبل التحقق هو سكربت inline مستقل أعلى <head> كل
//     صفحة محمية (راجع التعليق في dashboard.html) لأنه يجب أن يُنفَّذ قبل
//     تحميل أي سكربت خارجي آخر لتفادي أي وميض للمحتوى المحمي.
// ============================================================================

const AUTH_STORAGE_KEY = "ibra_admin_session";
const AUTH_SESSION_HOURS = 12;

// ---------------------------------------------------------------------------
// إدارة الجلسة المحلية (localStorage)
// ---------------------------------------------------------------------------
/**
 * قراءة الجلسة المحلية الحالية إن وُجدت وكانت لا تزال سارية (لم تتجاوز
 * AUTH_SESSION_HOURS منذ وقت الدخول). تحذف الجلسة تلقائياً من localStorage
 * إن كانت منتهية الصلاحية أو تالفة الصياغة.
 * @returns {{username:string, loginAt:number}|null}
 */
function getAuthSession(){
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.username || !session.loginAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    const ageHours = (Date.now() - session.loginAt) / 3600000;
    if (ageHours > AUTH_SESSION_HOURS){
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return session;
  } catch (err){
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

/**
 * حفظ جلسة محلية جديدة بعد نجاح التحقق من قاعدة البيانات مباشرة.
 * @param {string} username - اسم المستخدم الذي سجَّل الدخول بنجاح
 */
function setAuthSession(username){
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    username,
    loginAt: Date.now(),
  }));
}

/**
 * حذف الجلسة المحلية الحالية (تسجيل خروج).
 */
function clearAuthSession(){
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * تسجيل الخروج: تحذف الجلسة المحلية وتعيد التوجيه لصفحة تسجيل الدخول
 * (index.html). مربوطة بزر/رابط «🚪 تسجيل الخروج» في الشريط العلوي لكل
 * صفحة إدارة محمية.
 */
function logoutAdmin(){
  clearAuthSession();
  location.href = "index.html";
}

// ---------------------------------------------------------------------------
// نموذج تسجيل الدخول (index.html فقط)
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return; // هذا الملف مُحمَّل أيضاً في صفحات الإدارة لأجل logoutAdmin() فقط

  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const errorEl = document.getElementById("loginError");
  const submitBtn = document.getElementById("loginSubmitBtn");

  // إن كانت هناك جلسة سارية أصلاً، لا داعي لعرض نموذج الدخول من جديد
  if (getAuthSession()){
    location.replace(resolveRedirectTarget());
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    errorEl.textContent = "";
    errorEl.classList.remove("show");

    if (!username || !password){
      errorEl.textContent = "يرجى إدخال اسم المستخدم وكلمة المرور";
      errorEl.classList.add("show");
      return;
    }

    setButtonLoading(submitBtn, true);
    try {
      const { data, error } = await supabaseClient.rpc("verify_admin_login", {
        p_username: username,
        p_password: password,
      });

      if (error) throw error;

      if (data === true){
        setAuthSession(username);
        location.href = resolveRedirectTarget();
      } else {
        errorEl.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة";
        errorEl.classList.add("show");
      }
    } catch (err){
      console.error("فشل التحقق من بيانات الدخول:", err);
      errorEl.textContent = "تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى";
      errorEl.classList.add("show");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
});

/**
 * تحديد الصفحة المطلوب التوجّه إليها بعد نجاح تسجيل الدخول: من معامل
 * redirect في رابط index.html إن وُجد وكان اسم ملف HTML صحيحاً ضمن المشروع
 * (لمنع أي إعادة توجيه لرابط خارجي)، وإلا فافتراضياً register.html (صفحة
 * تسجيل المتدربين — الوجهة الرئيسية للنظام عند فتح index.html مباشرة بلا
 * معامل).
 * @returns {string} اسم صفحة الوجهة
 */
function resolveRedirectTarget(){
  const params = new URLSearchParams(location.search);
  const target = params.get("redirect");
  const allowed = ["register.html", "waiting.html", "dashboard.html", "reports.html"];
  return allowed.includes(target) ? target : "register.html";
}

// ---------------------------------------------------------------------------
// ربط أي رابط/زر «تسجيل الخروج» في أي صفحة محمية بـ logoutAdmin() — عام لكل
// الصفحات المحمية (register.html، waiting.html، dashboard.html، reports.html)
// بدل تكرار الربط يدوياً في كل ملف dashboard.js/waiting.js/reports.js/app.js
// على حدة.
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#logoutLink, .logout-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      logoutAdmin();
    });
  });
});
