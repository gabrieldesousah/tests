const $ = (id) => document.getElementById(id);

let config = null;
let lastSignupToken = null;

function logEvents(obj) {
  const el = $("events");
  const line = `[${new Date().toISOString()}] ${JSON.stringify(obj, null, 2)}\n\n`;
  el.textContent = line + el.textContent;
}

async function loadConfig() {
  const res = await fetch("/api/config");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to load /api/config");
  config = data;
}

function initFb() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 15000;
    (function wait() {
      if (window.FB) return resolve();
      if (Date.now() > deadline) return reject(new Error("FB SDK timeout"));
      setTimeout(wait, 50);
    })();
  }).then(() => {
    window.FB.init({
      appId: config.appId,
      cookie: true,
      xfbml: true,
      version: config.graphVersion,
    });
  });
}

window.addEventListener("message", (event) => {
  if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
    return;
  }
  let data;
  try {
    data = JSON.parse(event.data);
  } catch {
    return;
  }
  if (data.type !== "WA_EMBEDDED_SIGNUP") return;
  logEvents(data);
  if (data.event === "FINISH" || data.event === "FINISH_ONLY_WABA") {
    const d = data.data || {};
    if (d.waba_id) {
      $("waba-id").value = d.waba_id;
      $("btn-fetch-waba").disabled = !lastSignupToken;
    }
  }
});

async function exchangeCode(code) {
  const res = await fetch("/api/exchange-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || JSON.stringify(data));
  return data;
}

function launchEmbeddedSignup() {
  $("token-out").textContent = "";
  window.FB.login(
    function (response) {
      if (response.authResponse?.code) {
        exchangeCode(response.authResponse.code)
          .then((tok) => {
            lastSignupToken = tok.access_token;
            $("btn-fetch-waba").disabled = false;
            $("token-out").textContent = JSON.stringify(
              { ...tok, access_token: tok.access_token?.slice(0, 12) + "…" },
              null,
              2,
            );
            $("token-out").textContent +=
              "\n\n(full token is kept in memory for /api/waba calls — see browser devtools if needed)";
          })
          .catch((e) => {
            $("token-out").textContent = String(e.message || e);
          });
      } else {
        $("token-out").textContent = JSON.stringify(response, null, 2);
      }
    },
    {
      config_id: config.configId,
      response_type: "code",
      override_default_response_type: true,
      extras: {
        setup: {},
        sessionInfoVersion: "3",
      },
    },
  );
}

async function fetchWaba() {
  const wabaId = $("waba-id").value.trim();
  if (!wabaId) return alert("Informe o WABA ID");
  if (!lastSignupToken) return alert("Troque o código primeiro (Embedded Signup)");
  const res = await fetch(`/api/waba/${encodeURIComponent(wabaId)}`, {
    headers: { Authorization: `Bearer ${lastSignupToken}` },
  });
  const data = await res.json();
  $("token-out").textContent = JSON.stringify(data, null, 2);
  if (data.client_business_portfolio_id) {
    $("client-portfolio").value = data.client_business_portfolio_id;
  }
}

async function submitPlbv() {
  const endId = $("client-portfolio").value.trim();
  const input = $("docs");
  if (!endId) return alert("Informe o client business portfolio ID");
  if (!input.files?.length) return alert("Selecione 1–3 documentos");

  const fd = new FormData();
  fd.set("end_business_id", endId);
  for (const f of input.files) {
    fd.append("business_documents[]", f);
  }

  const res = await fetch("/api/plbv/submit", { method: "POST", body: fd });
  const data = await res.json();
  $("plbv-out").textContent = JSON.stringify(data, null, 2);
}

async function main() {
  $("sdk-status").textContent = "Carregando config…";
  try {
    await loadConfig();
    await initFb();
    $("btn-es").disabled = false;
    $("btn-plbv").disabled = false;
    $("sdk-status").textContent = "SDK pronto.";
  } catch (e) {
    $("sdk-status").textContent = String(e.message || e);
  }

  $("btn-es").addEventListener("click", launchEmbeddedSignup);
  $("btn-fetch-waba").addEventListener("click", () => fetchWaba().catch((e) => alert(e.message)));
  $("btn-plbv").addEventListener("click", () => submitPlbv().catch((e) => alert(e.message)));
}

main();
