import http from "node:http";

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.LIVEAVATAR_API_KEY;
const AVATAR_ID = process.env.LIVEAVATAR_AVATAR_ID;
const VOICE_ID = process.env.LIVEAVATAR_VOICE_ID;
const CONTEXT_ID = process.env.LIVEAVATAR_CONTEXT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const chatRate = new Map();

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "https://virtual-xizmatlar.onrender.com");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200).end(JSON.stringify({ ok: true, service: "virtual-xizmatlar-avatar" }));
    return;
  }


  if (req.method === "POST" && req.url === "/api/chat") {
    if (!OPENAI_API_KEY) {
      res.writeHead(503).end(JSON.stringify({ error: "ChatGPT API kaliti sozlanmagan." }));
      return;
    }
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const recent = (chatRate.get(ip) || []).filter(t => now - t < 60000);
    if (recent.length >= 10) {
      res.writeHead(429).end(JSON.stringify({ error: "Juda ko‘p so‘rov yuborildi. Bir daqiqadan keyin urinib ko‘ring." }));
      return;
    }
    recent.push(now);
    chatRate.set(ip, recent);
    try {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 20000) {
          res.writeHead(413).end(JSON.stringify({ error: "Xabar hajmi juda katta." }));
          return;
        }
      }
      const body = JSON.parse(raw || "{}");
      if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 12) {
        res.writeHead(400).end(JSON.stringify({ error: "Xabarlar formati noto‘g‘ri." }));
        return;
      }
      const messages = body.messages.map(m => {
        if (!["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 4000) {
          throw new Error("Xabar formati noto‘g‘ri yoki juda uzun.");
        }
        return { role: m.role, content: m.content.trim() };
      });
      if (messages[messages.length - 1].role !== "user") {
        res.writeHead(400).end(JSON.stringify({ error: "Oxirgi xabar foydalanuvchidan bo‘lishi kerak." }));
        return;
      }
      const ai = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5.5",
          instructions: "Siz VIRTUAL XIZMATLAR saytining o‘zbek tilidagi yordamchisisiz. Foydalanuvchilarga Word, Excel, PowerPoint, hujjatlar, arizalar, taqdimotlar, kompyuter va internet xizmatlari haqida aniq, qisqa va xushmuomala yordam bering. Xizmat narxi yoki muddati aniq berilmagan bo‘lsa, taxmin qilmang; tafsilotlarni so‘rang va operator bilan kelishishni tavsiya qiling. To‘lov yoki buyurtma bajarilgan deb da’vo qilmang.",
          input: messages,
          max_output_tokens: 500
        })
      });
      const result = await ai.json();
      if (!ai.ok) {
        console.error("[chat] OpenAI request failed", { status: ai.status, message: result?.error?.message || "OpenAI API error" });
        res.writeHead(ai.status === 429 ? 429 : 502).end(JSON.stringify({ error: "ChatGPT hozir javob bera olmadi. Birozdan keyin urinib ko‘ring." }));
        return;
      }
      const answer = (result.output || []).flatMap(item => item.content || []).filter(part => part.type === "output_text").map(part => part.text).join("\\n").trim();
      res.writeHead(200).end(JSON.stringify({ reply: answer || "Javob olinmadi. Qayta urinib ko‘ring." }));
    } catch (error) {
      console.error("[chat] Request failed", { message: error?.message || "Unknown error" });
      res.writeHead(400).end(JSON.stringify({ error: "Xabarni yuborishda xatolik. Qayta urinib ko‘ring." }));
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/session") {
    console.info("[session] /api/session request received");
    if (!API_KEY || !AVATAR_ID || !VOICE_ID || !CONTEXT_ID) {
      res.writeHead(503).end(JSON.stringify({
        error: "LiveAvatar sozlamalari to'liq kiritilmagan."
      }));
      return;
    }

    try {
      const tokenResponse = await fetch("https://api.liveavatar.com/v1/sessions/token", {
        method: "POST",
        headers: {
          "X-API-KEY": API_KEY,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          mode: "FULL",
          avatar_id: AVATAR_ID,
          is_sandbox: process.env.LIVEAVATAR_SANDBOX === "true",
          interactivity_type: "CONVERSATIONAL",
          avatar_persona: {
            voice_id: VOICE_ID,
            context_id: CONTEXT_ID,
            language: "uz"
          }
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData?.data?.session_token || !tokenData?.data?.session_id) {
        console.error("[session] LiveAvatar token request failed", { status: tokenResponse.status, message: tokenData?.message || tokenData?.detail || "Missing session_token/session_id in response" });
        res.writeHead(tokenResponse.status || 502).end(JSON.stringify({
          error: "LiveAvatar token yaratilmadi.",
          details: tokenData?.message || tokenData?.detail || "API xatosi"
        }));
        return;
      }

      console.info("[session] LiveAvatar token created; starting session");
      const sessionToken = tokenData.data.session_token;
      const sessionId = tokenData.data.session_id;

      const startResponse = await fetch("https://api.liveavatar.com/v1/sessions/start", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ session_id: sessionId })
      });

      const startData = await startResponse.json();

      if (!startResponse.ok || !startData?.data?.livekit_url || !startData?.data?.livekit_client_token) {
        console.error("[session] LiveAvatar session start failed", { status: startResponse.status, message: startData?.message || startData?.detail || "Missing LiveKit connection fields" });
        res.writeHead(startResponse.status || 502).end(JSON.stringify({
          error: "LiveAvatar sessiyasi ishga tushmadi.",
          details: startData?.message || startData?.detail || "Start xatosi"
        }));
        return;
      }

      console.info("[session] LiveAvatar session started successfully");
      res.writeHead(200).end(JSON.stringify({
        session_id: startData.data.session_id,
        livekit_url: startData.data.livekit_url,
        livekit_client_token: startData.data.livekit_client_token,
        session_token: sessionToken,
        max_session_duration: startData.data.max_session_duration
      }));
    } catch (error) {
      console.error("[session] Unexpected backend error", { message: error?.message || "Unknown error" });
      res.writeHead(500).end(JSON.stringify({
        error: "Server xatosi",
        details: error.message
      }));
    }
    return;
  }

  res.writeHead(404).end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`LiveAvatar backend listening on ${PORT}`);
});
