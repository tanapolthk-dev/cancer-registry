-- ทดสอบสิทธิ์ (RLS) แบบหลายบัญชีใน Supabase SQL Editor โดยไม่ต้องใช้รหัสผ่าน
-- 1) สร้างบัญชีทดสอบ 3 บัญชีใน Auth > Users (A และ B เป็นสมาชิกทีม, C ไม่ใช่สมาชิก)
-- 2) แก้อีเมล 3 บรรทัดด้านล่าง แล้วกด Run ทั้งไฟล์
-- ทุกอย่างอยู่ใน transaction และ ROLLBACK ตอนท้าย จึงไม่ทิ้งข้อมูลทดสอบไว้ในฐานข้อมูล
-- ผลลัพธ์ดูได้ในแท็บ Results (ตาราง rls_results) ทุกแถวต้องเป็น PASS

begin;
create temp table rls_results(step int, test text, result text) on commit drop;
grant all on rls_results to authenticated, anon;

do $$
declare
  email_a text := 'test-a@example.com';   -- สมาชิกทีม A
  email_b text := 'test-b@example.com';   -- สมาชิกทีม B
  email_c text := 'test-c@example.com';   -- ไม่ใช่สมาชิกทีม
  ua uuid; ub uuid; uc uuid; rec uuid; n int; s int := 0;
  procedure_ok boolean;
begin
  select id into ua from auth.users where email = email_a;
  select id into ub from auth.users where email = email_b;
  select id into uc from auth.users where email = email_c;
  if ua is null or ub is null or uc is null then raise exception 'ไม่พบบัญชีทดสอบ ตรวจอีเมลด้านบน'; end if;

  -- ให้ A และ B เป็นสมาชิกชั่วคราวภายใน transaction นี้ (C ไม่ใช่)
  insert into public.team_members values (ua, 'ทดสอบ A') on conflict (user_id) do nothing;
  insert into public.team_members values (ub, 'ทดสอบ B') on conflict (user_id) do nothing;
  delete from public.team_members where user_id = uc;

  -- ===== A สร้างงาน =====
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.work_records(category, title, work_date, status, created_by, author_name)
    values ('sso', '[TEST] งานของ A', current_date, 'กำลังดำเนินการ', ub, 'ปลอมชื่อ')  -- พยายามปลอมผู้สร้าง
    returning id into rec;
  select count(*) into n from public.work_records where id = rec and created_by = ua and author_name = 'ทดสอบ A';
  s := s + 1; insert into rls_results values (s, 'A สร้างงานได้ และ trigger บังคับผู้สร้าง/ชื่อเป็น A แม้ส่งค่าปลอม', case when n = 1 then 'PASS' else 'FAIL' end);

  begin
    insert into public.work_records(category, title, work_date, status, file_path)
      values ('sso', '[TEST] แนบไฟล์คนอื่น', current_date, 'กำลังดำเนินการ', ub::text || '/x.pdf');
    procedure_ok := false;
  exception when others then procedure_ok := true; end;
  s := s + 1; insert into rls_results values (s, 'A อ้างไฟล์ในโฟลเดอร์ของ B ไม่ได้', case when procedure_ok then 'PASS' else 'FAIL' end);
  execute 'reset role';

  -- ===== B อ่านได้ แต่แก้ไขงานของ A ไม่ได้ =====
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.work_records where id = rec;
  s := s + 1; insert into rls_results values (s, 'B อ่านงานของ A ได้', case when n = 1 then 'PASS' else 'FAIL' end);
  update public.work_records set title = '[TEST] B แก้' where id = rec;
  get diagnostics n = row_count;
  s := s + 1; insert into rls_results values (s, 'B แก้ไขงานของ A ไม่ได้ (0 แถว)', case when n = 0 then 'PASS' else 'FAIL' end);
  begin
    delete from public.work_records where id = rec;
    get diagnostics n = row_count;
    procedure_ok := (n = 0);
  exception when others then procedure_ok := true; end;
  s := s + 1; insert into rls_results values (s, 'B ลบงานของ A ไม่ได้', case when procedure_ok then 'PASS' else 'FAIL' end);
  execute 'reset role';

  -- ===== A แก้ไขงานตนเองได้ แต่เปลี่ยนผู้สร้างไม่ได้ =====
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.work_records set title = '[TEST] A แก้แล้ว', created_by = ub, author_name = 'ปลอม' where id = rec;
  get diagnostics n = row_count;
  s := s + 1; insert into rls_results values (s, 'A แก้ไขงานของตนเองได้', case when n = 1 then 'PASS' else 'FAIL' end);
  select count(*) into n from public.work_records where id = rec and created_by = ua and author_name = 'ทดสอบ A';
  s := s + 1; insert into rls_results values (s, 'แก้ไขแล้วผู้สร้าง/ชื่อผู้บันทึกยังเป็น A', case when n = 1 then 'PASS' else 'FAIL' end);
  begin
    delete from public.work_records where id = rec;
    get diagnostics n = row_count;
    procedure_ok := (n = 0);
  exception when others then procedure_ok := true; end;
  s := s + 1; insert into rls_results values (s, 'ลบงานจากหน้าเว็บไม่ได้ แม้เป็นเจ้าของ', case when procedure_ok then 'PASS' else 'FAIL' end);
  execute 'reset role';

  -- ===== C (ไม่ใช่สมาชิก) =====
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.work_records;
  s := s + 1; insert into rls_results values (s, 'C ที่ไม่ใช่สมาชิกอ่านข้อมูลไม่ได้', case when n = 0 then 'PASS' else 'FAIL' end);
  begin
    insert into public.work_records(category, title, work_date, status) values ('sso', '[TEST] C', current_date, 'กำลังดำเนินการ');
    procedure_ok := false;
  exception when others then procedure_ok := true; end;
  s := s + 1; insert into rls_results values (s, 'C เพิ่มงานไม่ได้', case when procedure_ok then 'PASS' else 'FAIL' end);
  execute 'reset role';

  -- ===== ผู้ที่ไม่ได้เข้าสู่ระบบ (anon) =====
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.work_records;
    procedure_ok := (n = 0);
  exception when others then procedure_ok := true; end;
  s := s + 1; insert into rls_results values (s, 'ผู้ไม่ได้เข้าสู่ระบบอ่านข้อมูลไม่ได้', case when procedure_ok then 'PASS' else 'FAIL' end);
  execute 'reset role';

  -- ===== ถอด B ออกจากทีม → อ่านไม่ได้ทันทีแม้ session ยังอยู่ =====
  delete from public.team_members where user_id = ub;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.work_records;
  s := s + 1; insert into rls_results values (s, 'ถอด B จากทีมแล้ว B อ่านข้อมูลไม่ได้', case when n = 0 then 'PASS' else 'FAIL' end);
  execute 'reset role';
end $$;

select * from rls_results order by step;
rollback;
