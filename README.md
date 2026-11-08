# ทะเบียนมะเร็ง · Cancer Registry Workspace

เว็บแอปภาษาไทย สีม่วงดอกรัก #9E76B4 สำหรับบันทึกและติดตามงานทะเบียนมะเร็งของทีม
ทำงานบน GitHub Pages (ไฟล์ static) + Supabase Auth / PostgreSQL (RLS) / Private Storage

## ความสามารถ

- แดชบอร์ด: ตัวเลขสรุป, กราฟรายเดือน 6 เดือน, สัดส่วนรายหมวด (donut), ยอดลงข้อมูลผู้ป่วยใหม่/เสียชีวิต, การ์ดทางลัดบันทึกตามหมวด
- บันทึกงาน 7 หมวด พร้อมช่องข้อมูลเฉพาะหมวด (HN เก็บเป็นข้อความ รักษาเลขศูนย์นำหน้า)
- ตารางงาน: ค้นหาทุกช่อง (รวม HN), กรองวันที่/หมวด/สถานะ, ช่วงด่วน (เดือนนี้, 3 เดือน, ปีนี้, ปีงบประมาณ), เรียงตามคอลัมน์, แบ่งหน้า
- หน้ารายละเอียดงาน แก้ไขได้เฉพาะผู้บันทึก งานของคนอื่นเปิดแบบอ่านอย่างเดียว
- แนบ PDF/JPG/PNG ≤ 10 MB (ลากวางได้), คลังเอกสาร, เปิดไฟล์ด้วย signed URL อายุ 60 วินาที
- ส่งออก CSV (UTF-8 BOM เปิดใน Excel ได้) แยกคอลัมน์ข้อมูลเฉพาะหมวด และกันสูตร CSV injection
- รองรับมือถือ (เมนูเลื่อนข้าง)

## ทดลองในเครื่อง (โหมดตัวอย่าง)

เมื่อ `config.js` ยังว่าง แอปจะเปิด **โหมดตัวอย่าง**: ข้อมูลสมมติเก็บใน localStorage ของเบราว์เซอร์นั้นเท่านั้น
ทดลองเพิ่ม/แก้ไข/แนบไฟล์ (≤ 2 MB)/ส่งออกได้ครบ และมีปุ่ม “รีเซ็ตข้อมูลตัวอย่าง”

```bash
python -m http.server 8080
```

แล้วเปิด http://localhost:8080 (หรือใช้เว็บเซิร์ฟเวอร์ static ใดก็ได้)

## ติดตั้งใช้งานจริงหลายคน

1. สร้าง Supabase project (แนะนำ region Singapore) แล้วเปิด SQL Editor รัน `schema.sql` หนึ่งครั้ง
2. Authentication > Sign In / Providers: **ปิด Allow new users to sign up** (ปิดสมัครสาธารณะ)
3. Authentication > Users > Add user: สร้างบัญชีเจ้าหน้าที่ (ติ๊ก Auto Confirm) แจ้งรหัสผ่านผ่านช่องทางส่วนตัว
4. เพิ่มแต่ละบัญชีเป็นสมาชิกทีม:

   ```sql
   insert into public.team_members(user_id, display_name)
   select id, 'ชื่อเจ้าหน้าที่' from auth.users where email = 'staff@example.com';
   ```

5. Project Settings > API: คัดลอก **Project URL** และ **anon / publishable key** ใส่ใน `config.js`
   (anon key เปิดเผยได้เพราะสิทธิ์ถูกคุมด้วย RLS) **ห้ามใส่ service_role / secret key รหัสผ่าน หรือข้อมูลผู้ป่วยใน repository**
6. Authentication > URL Configuration: ตั้ง Site URL เป็น URL ของ GitHub Pages
7. ขึ้น GitHub: push ไฟล์ทั้งหมดไป branch `main` แล้ว Settings > Pages > Source: **GitHub Actions**
   workflow `.github/workflows/pages.yml` จะเผยแพร่อัตโนมัติทุกครั้งที่ push

## เปิดการเข้าสู่ระบบด้วย Google (ไม่บังคับ)

ปุ่ม "เข้าสู่ระบบด้วย Google" ซ่อนอยู่จนกว่าจะตั้งค่า `googleLogin: true` ใน `config.js`

1. Google Cloud Console (https://console.cloud.google.com) > สร้าง project ใหม่
2. APIs & Services > OAuth consent screen: User type **External**, ชื่อแอป "ทะเบียนมะเร็ง", scopes เฉพาะ email/profile/openid แล้วกด Publish app
3. APIs & Services > Credentials > Create credentials > **OAuth client ID** > Web application
   - Authorized JavaScript origins: `https://tanapolthk-dev.github.io`
   - Authorized redirect URIs: `https://nzwowvkstrdfmrsjjwav.supabase.co/auth/v1/callback`
4. Supabase > Authentication > Sign In / Providers > **Google**: เปิด แล้วใส่ Client ID และ Client Secret (Secret ใส่ใน Supabase เท่านั้น ห้ามใส่ใน GitHub)
5. Supabase > Authentication > URL Configuration > Redirect URLs: เพิ่ม `https://tanapolthk-dev.github.io/cancer-registry/`
6. Sign In / Providers > เปิด **Allow new users to sign up** (ผู้ที่ไม่อยู่ใน `team_members` จะเข้าสู่ระบบได้ แต่ไม่เห็นและบันทึกข้อมูลไม่ได้)
7. ตั้ง `googleLogin: true` ใน `config.js` แล้ว push
8. ให้เจ้าหน้าที่กดเข้าสู่ระบบด้วย Google หนึ่งครั้ง แล้วเพิ่มเป็นสมาชิกด้วย SQL ในหัวข้อด้านบน (ใช้อีเมล Google ของแต่ละคน)

## ทดสอบสิทธิ์หลายบัญชี

**ฐานข้อมูล (อัตโนมัติ ไม่ต้องใช้รหัสผ่าน):** รัน `tests/rls-test.sql` ทั้งไฟล์ใน SQL Editor (กด "Run without RLS" เมื่อมีคำเตือน)
สคริปต์สร้างผู้ใช้ทดสอบชั่วคราวและ rollback ทั้งหมด ไม่ทิ้งข้อมูล ผลต้องเป็น PASS ทั้งหมด (ทดสอบล่าสุด 8 พ.ย. 2569: ผ่าน 12/12):

- A สร้างงานได้ และผู้สร้าง/ชื่อผู้บันทึกถูกบังคับเป็น A แม้ส่งค่าปลอม
- A อ้างไฟล์ในโฟลเดอร์ของ B ไม่ได้
- B อ่านงานของ A ได้ แต่แก้ไข/ลบไม่ได้
- A แก้ไขงานตนเองได้ แต่เปลี่ยนผู้สร้างไม่ได้ และลบจากหน้าเว็บไม่ได้
- C (ไม่ใช่สมาชิก) และผู้ไม่ได้เข้าสู่ระบบ อ่าน/เพิ่มไม่ได้
- ถอด B ออกจากทีมแล้ว B อ่านไม่ได้ทันที

**ผ่านหน้าเว็บ (เอกสารแนบ):** เข้าระบบเป็น A สร้างงานพร้อมแนบ PDF → เข้าระบบเป็น B ในหน้าต่างไม่ระบุตัวตน
เปิดเอกสารของ A ได้แต่ปุ่มแก้ไขไม่แสดง → คัดลอกลิงก์เอกสาร รอเกิน 60 วินาทีแล้วเปิดใหม่ต้องใช้ไม่ได้ → ออกจากระบบต้องกลับหน้าเข้าสู่ระบบ

## สิทธิ์และการจัดเก็บ

- สมาชิกทีมอ่านรายการและเอกสารร่วมกันได้ แก้ไขได้เฉพาะรายการตนเอง ผู้สร้างและชื่อผู้บันทึกกำหนดโดย trigger ฝั่งฐานข้อมูล
- ไฟล์ใหม่ต้องอยู่ในโฟลเดอร์ `<user id>/` ของผู้บันทึกเอง; เมื่อเปลี่ยนไฟล์แนบ ระบบลบไฟล์เก่าให้อัตโนมัติ
- ผู้ดูแลเพิ่ม/ถอดสมาชิกผ่าน `team_members` การถอดสมาชิกมีผลทันทีแม้ session ยังอยู่
- ไม่มีการลบงานจากหน้าเว็บ (ผู้ดูแลลบผ่าน Supabase) การกู้รหัสผ่านทำผ่านผู้ดูแล
- หน้าเว็บดึงไม่เกิน 5,000 รายการล่าสุด และแจ้งเมื่อถึงขีดจำกัด ต้องเพิ่ม server pagination/aggregate ก่อนใช้กับข้อมูลมากกว่านี้
- ยังไม่มีการนำเข้า Excel เดิม (ดูขั้นตอนใน DESIGN.md) ไฟล์ Excel ถูกกันไว้ใน `.gitignore`
- ก่อนใช้งานจริงต้องกำหนดทีมที่มีสิทธิ์เห็นข้อมูลสุขภาพ นโยบายสำรองข้อมูล และอายุเก็บเอกสารตามระเบียบหน่วยงาน
