const fetch = require("node-fetch");

exports.handler = async (event) => {
  const apiKey = process.env.PAGESPEED_API_KEY;
  const url = event.queryStringParameters.url;
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${url}&key=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error fetching PageSpeed Insights data" }),
    };
  }
};
