const axios = require("axios");

const testBseSecuritySearch = async (req, res) => {
  const startedAt = Date.now();

  try {
    const response = await axios.get(
      "https://api.bseindia.com/BseIndiaAPI/api/PeerSmartSearch/w",
      {
        params: {
          Type: "SS",
          text: "Crystal Crop Protection",
        },
        timeout: 15000,
        insecureHTTPParser: true,
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Origin: "https://www.bseindia.com",
          Referer: "https://www.bseindia.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
        },
        validateStatus: () => true,
      },
    );

    const contentType = response.headers["content-type"] || null;

    const body =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data ?? "");

    return res.status(200).json({
      success: true,
      diagnostic: "BSE_SECURITY_SEARCH",
      upstreamStatus: response.status,
      upstreamContentType: contentType,
      responseTimeMs: Date.now() - startedAt,
      responseLength: body.length,
      responsePreview: body.slice(0, 500),
      server: "RENDER",
    });
  } catch (error) {
    console.error("[BSE RENDER DIAGNOSTIC]", {
      code: error.code,
      message: error.message,
      status: error.response?.status || null,
    });

    return res.status(200).json({
      success: false,
      diagnostic: "BSE_SECURITY_SEARCH",
      upstreamStatus: error.response?.status || null,
      errorCode: error.code || null,
      errorMessage: error.message,
      responseTimeMs: Date.now() - startedAt,
      server: "RENDER",
    });
  }
};

module.exports = {
  testBseSecuritySearch,
};
