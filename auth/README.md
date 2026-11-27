# ลงชื่อเข้า Hongtiew ด้วย ChatGPT

ติดตั้งแบบนี้เมื่อต้องการใช้บัญชี ChatGPT ยืนยันตัวตนบนเว็บ โดย Gemini และผู้ให้บริการโมเดลเดิมยังใช้การตั้งค่าของตนเอง ประวัติและคีย์ยังอยู่ในโปรไฟล์เบราว์เซอร์ และผู้ที่ใช้โปรไฟล์เดียวกันเข้าถึงข้อมูลชุดเดียวกันได้

1. ลงทะเบียนเว็บไซต์กับ OpenAI สำหรับ **website identity** แบบ confidential client และจดทะเบียน callback เป็น `https://YOUR-DOMAIN/oauth2/callback` ให้ตรงกับโดเมนจริง ดู [คู่มือ OpenAI](https://developers.openai.com/siwc/website)
2. กำหนดตัวแปรฝั่งเซิร์ฟเวอร์ `OAUTH2_PROXY_CLIENT_ID`, `OAUTH2_PROXY_CLIENT_SECRET`, `OAUTH2_PROXY_REDIRECT_URL` (callback ด้านบน) และ `OAUTH2_PROXY_COOKIE_SECRET` (สุ่ม 32 ไบต์แล้วเข้ารหัส base64url) เก็บ secret ใน secret manager ของโฮสต์
3. รันจากราก repo บนเครื่องที่มี Docker และวาง HTTPS reverse proxy ของโดเมนไว้หน้า port 4180

```sh
docker build -f auth/Dockerfile -t hongtiew .
docker run --rm -p 127.0.0.1:4180:4180 -e OAUTH2_PROXY_CLIENT_ID -e OAUTH2_PROXY_CLIENT_SECRET -e OAUTH2_PROXY_COOKIE_SECRET -e OAUTH2_PROXY_REDIRECT_URL hongtiew
```

เปิดเว็บ → ตั้งค่า → Sign in with ChatGPT แล้วกลับไปที่ตั้งค่าเพื่อดูสถานะหรือออกจากระบบ การติดตั้งแบบไฟล์สแตติกยังเปิดใช้ได้ตามเดิม การใช้งานแบบนั้นจะไม่มีปุ่มบัญชี
