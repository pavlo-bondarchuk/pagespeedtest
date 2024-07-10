const express = require("express");
const fetch = require("node-fetch");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("."));

app.get("/api/pagespeed", async (req, res) => {
  const apiKey = process.env.PAGESPEED_API_KEY;
  const url = req.query.url;
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url
  )}&key=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error fetching PageSpeed Insights data" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
