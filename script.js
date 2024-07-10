document.getElementById('urlForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const url = document.getElementById('url').value;
    fetchPageSpeedInsights(url);
    setInterval(() => fetchPageSpeedInsights(url), 300000); // Оновлення кожні 5 хвилин
});

function fetchPageSpeedInsights(url) {
    const apiKey = 'AIzaSyCiklPqplbafEPdMruBXYEWooRrrbtXSDg';
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${url}&key=${apiKey}`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            document.getElementById('results').innerHTML = JSON.stringify(data, null, 2);
        })
        .catch(error => console.error('Error:', error));
}
