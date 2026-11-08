// Supabase Project URL และ publishable key (เปิดเผยได้ เพราะสิทธิ์ถูกคุมด้วย Row Level Security)
// ห้ามใส่ secret / service_role key, รหัสผ่าน หรือข้อมูลผู้ป่วยในไฟล์นี้
// ลบค่าทั้งสองออก (เหลือ '') เพื่อกลับไปใช้โหมดตัวอย่าง
window.APP_CONFIG = {
  supabaseUrl: 'https://nzwowvkstrdfmrsjjwav.supabase.co',
  supabaseAnonKey: 'sb_publishable_egfVhSb1G0pBYiGRMjj9Ug_-dsXMU_E',
  // เปลี่ยนเป็น true หลังเปิด Google provider ใน Supabase แล้ว (ดู README)
  googleLogin: true
};
