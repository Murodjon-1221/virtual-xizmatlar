# VIRTUAL XIZMATLAR — LiveAvatar backend tayyorlov paketi

Bu backend LiveAvatar API kalitini brauzerga chiqarmasdan serverda saqlaydi.
U `/api/session` orqali FULL rejimida sessiya tokenini yaratadi va sessiyani boshlaydi.

## Muhim: hali kerak bo‘ladigan sozlamalar
- `LIVEAVATAR_API_KEY` — LiveAvatar'dan yangi yaratilgan maxfiy API key.
- `LIVEAVATAR_AVATAR_ID` — siz tanlagan avatar ID.
- `LIVEAVATAR_VOICE_ID` — o‘zbek tilini qo‘llaydigan ovoz ID.
- `LIVEAVATAR_CONTEXT_ID` — LiveAvatar FULL mode context ID.

Siz bergan avatar ID: `7ad91782-792a-4fd3-9359-883736780e48`

Oldin chatga yuborilgan API kalit xavfsizlik uchun bekor qilinib, yangisi ishlatilishi kerak.
API key'ni hech qachon HTML yoki brauzer JavaScript ichiga yozmang.

## Render’da backend yaratish
1. Ushbu papka ichidagi fayllarni GitHub `virtual-xizmatlar` repository'siga joylang.
2. Render → New → Web Service → repository `Murodjon-1221/virtual-xizmatlar`.
3. Agar backend fayllari repository root'ida bo‘lsa:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
4. Environment bo‘limiga yuqoridagi to‘rtta environment variable'ni kiriting.
5. `LIVEAVATAR_SANDBOX=true` bilan sinovdan boshlash mumkin. Ishlab chiqarishga chiqarishdan oldin LiveAvatar hisobingizdagi sandbox/production talablarini tekshiring.
6. `ALLOWED_ORIGIN=https://virtual-xizmatlar.onrender.com` qilib, CORS'ni saytingiz domeniga cheklang.

## Endpoint
`POST https://BACKEND-DOMEN/api/session`

Javobda LiveKit ulanish ma'lumotlari qaytadi. Frontend LiveAvatar Web SDK bilan ulanishi kerak:
`npm install @heygen/liveavatar-web-sdk`

## O‘zbekcha ovoz bo‘yicha eslatma
LiveAvatar FULL mode'da tanlangan voice va persona sozlamalariga bog‘liq. O‘zbekcha nutqni qo‘llaydigan Voice ID tanlanganini tekshiring. Agar Full mode'da o‘zbekcha ovoz mos kelmasa, LiveAvatar hujjatlaridagi LITE mode va o‘zbek tilini qo‘llaydigan alohida ASR/LLM/TTS provayderlari kerak bo‘ladi.
