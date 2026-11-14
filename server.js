import http from "node:http";

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.LIVEAVATAR_API_KEY;
const AVATAR_ID = process.env.LIVEAVATAR_AVATAR_ID;
const VOICE_ID = process.env.LIVEAVATAR_VOICE_ID;
const CONTEXT_ID = process.env.LIVEAVATAR_CONTEXT_ID;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
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
