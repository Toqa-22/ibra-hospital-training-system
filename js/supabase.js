// ============================================================================
// supabase.js
// تهيئة Supabase + طبقة الوصول للبيانات (إدراج / جلب)
// ⚠️ استخدم فقط Anon Key هنا — لا تضع Service Role Key أبداً في كود الواجهة
// ============================================================================

// القيم الفعلية تُقرأ من js/config.js (ملف غير مرفوع لـ Git — انظر config.example.js)
if (!window.APP_CONFIG || !window.APP_CONFIG.SUPABASE_URL || !window.APP_CONFIG.SUPABASE_ANON_KEY){
  throw new Error(
    "إعدادات Supabase غير موجودة. انسخ js/config.example.js إلى js/config.js وضع بياناتك فيه."
  );
}

const SUPABASE_URL = window.APP_CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.APP_CONFIG.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLE_NAME = "students";

// -------- تعقيم النصوص قبل العرض (منع XSS) --------
function escapeHtml(str){
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -------- إدراج متدرب جديد --------
async function insertStudent(payload){
  const today = new Date().toISOString().slice(0, 10);

  const record = {
    student_name: payload.student_name.trim(),
    phone: String(payload.phone).trim(),
    specialization: payload.specialization.trim(),
    department: payload.department.trim(),
    training_start: payload.training_start,
    training_end: payload.training_end,
    registration_date: today,
  };

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .insert([record])
    .select();

  if (error) throw error;
  return data;
}

// -------- إدراج سجل مستقل لكل قسم مختار (نفس بيانات الطالب والتواريخ) --------
async function insertStudentsForDepartments(base, departments){
  const today = new Date().toISOString().slice(0, 10);

  const records = departments.map(dep => ({
    student_name: base.student_name.trim(),
    phone: String(base.phone).trim(),
    specialization: base.specialization.trim(),
    department: dep.trim(),
    training_start: base.training_start,
    training_end: base.training_end,
    registration_date: today,
  }));

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .insert(records)
    .select();

  if (error) throw error;
  return data;
}

// -------- إدراج سجل مستقل لكل قسم مختار، بفترة تدريب خاصة بكل قسم --------
async function insertStudentsWithPeriods(base, items){
  const today = new Date().toISOString().slice(0, 10);

  const records = items.map(item => ({
    student_name: base.student_name.trim(),
    phone: String(base.phone).trim(),
    specialization: base.specialization.trim(),
    college: (base.college || "").trim() || null,
    department: item.department.trim(),
    training_start: item.start,
    training_end: item.end,
    registration_date: today,
  }));

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .insert(records)
    .select();

  if (error) throw error;
  return data;
}

// -------- جلب جميع سجلات المتدربين --------
async function fetchAllStudents(){
  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}
