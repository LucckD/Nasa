document.addEventListener("DOMContentLoaded", () => {
  initInpeDeforestationMap();
});

async function initFireRiskMap(mapId) {
  const brazilBounds = L.latLngBounds(
    L.latLng(-34, -74),
    L.latLng(6, -34)
  );

  const map = L.map(mapId, {
    zoomControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    dragging: false,
    touchZoom: false,
    minZoom: 4,
    maxZoom: 4,
    maxBounds: brazilBounds,
    maxBoundsViscosity: 1.0
  }).setView([-15.78, -47.93], 4);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  }).addTo(map);

  const estadosPane = map.createPane('estadosPane');
  estadosPane.style.zIndex = 250;

  const estadosUrl = 'https://raw.githubusercontent.com/fititnt/gis-dataset-brasil/main/uf/geojson/uf.json';
  try {
    const response = await fetch(estadosUrl);
    const estadosData = await response.json();
    L.geoJSON(estadosData, {
      pane: 'estadosPane',
      style: {
        color: 'rgba(255, 255, 255, 0.6)',
        weight: 1.5,
        fillOpacity: 0.0
      }
    }).addTo(map);
    console.log("States layer loaded in the background of the map.");
  } catch (err) {
    console.error("Error loading states GeoJSON:", err);
  }

  const regioes = {
    "Norte": {
      coords: { lat: -5.0, lon: -60.0 },
      cidades: [
        { nome: "Manaus", lat: -3.1, lon: -60.0 },
        { nome: "Porto Velho", lat: -8.76, lon: -63.9 },
        { nome: "Belém", lat: -1.45, lon: -48.49 },
      ]
    },
    "Nordeste": {
      coords: { lat: -9.0, lon: -40.0 },
      cidades: [
        { nome: "Salvador", lat: -12.97, lon: -38.51 },
        { nome: "Recife", lat: -8.05, lon: -34.90 },
        { nome: "Fortaleza", lat: -3.71, lon: -38.54 },
      ]
    },
    "Centro-Oeste": {
      coords: { lat: -15.5, lon: -55.0 },
      cidades: [
        { nome: "Brasília", lat: -15.78, lon: -47.93 },
        { nome: "Cuiabá", lat: -15.6, lon: -56.1 },
        { nome: "Campo Grande", lat: -20.45, lon: -54.6 },
      ]
    },
    "Sudeste": {
      coords: { lat: -21.0, lon: -44.0 },
      cidades: [
        { nome: "São Paulo", lat: -23.55, lon: -46.63 },
        { nome: "Rio de Janeiro", lat: -22.90, lon: -43.17 },
        { nome: "Belo Horizonte", lat: -19.92, lon: -43.93 },
      ]
    },
    "Sul": {
      coords: { lat: -28.0, lon: -52.0 },
      cidades: [
        { nome: "Porto Alegre", lat: -30.03, lon: -51.23 },
        { nome: "Curitiba", lat: -25.42, lon: -49.27 },
        { nome: "Florianópolis", lat: -27.59, lon: -48.54 }
      ]
    }
  };

  function calcularFMA(dailyPrecipitation, hourlyHumidity) {
    let accumulatedFma = 0;
    let daysWithoutRain = 0;

    for (let i = 0; i < dailyPrecipitation.length; i++) {
      const chuvaDoDia = dailyPrecipitation[i];

      if (chuvaDoDia > 12.7) {
        accumulatedFma = 0;
        daysWithoutRain = 0;
        continue;
      }

      if (chuvaDoDia > 2.5) {
        daysWithoutRain = 0;
      } else {
        daysWithoutRain++;
      }

      const umidade13h = hourlyHumidity[i * 24 + 13];

      if (umidade13h === undefined || umidade13h === null) continue;

      const N = Math.min(1.0 + daysWithoutRain * 0.1, 2.0);
      const fmaDiario = (100 - umidade13h) * N;

      accumulatedFma += fmaDiario;
    }

    return accumulatedFma;
  }

  function getFmaInfo(fma) {
    if (fma > 3000) return { cor: "#d73027", perigo: "Critical" };
    if (fma > 1000) return { cor: "#fc8d59", perigo: "Very High" };
    if (fma > 500) return { cor: "#fee08b", perigo: "High" };
    if (fma > 200) return { cor: "#ffffbf", perigo: "Medium" };
    return { cor: "#91cf60", perigo: "Low" };
  }

  const hoje = new Date();
  const dataInicio = new Date();
  dataInicio.setDate(hoje.getDate() - 30);
  const hojeStr = hoje.toISOString().split("T")[0];
  const inicioStr = dataInicio.toISOString().split("T")[0];

  for (const nomeRegiao in regioes) {
    const regiao = regioes[nomeRegiao];
    let fmaTotal = 0;
    let tempTotal = 0;
    let umidadeTotal = 0;
    let cidadesProcessadas = 0;

    const promessas = regiao.cidades.map(cidade => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${cidade.lat}&longitude=${cidade.lon}&current=temperature_2m,relative_humidity_2m&hourly=relative_humidity_2m&daily=precipitation_sum&timezone=auto&start_date=${inicioStr}&end_date=${hojeStr}`;
      return fetch(url).then(resp => resp.json());
    });
    
    try {
      const resultados = await Promise.all(promessas);

      for (const data of resultados) {
        if (data && data.daily && data.current) {
          fmaTotal += calcularFMA(data.daily.precipitation_sum, data.hourly.relative_humidity_2m);
          tempTotal += data.current.temperature_2m;
          umidadeTotal += data.current.relative_humidity_2m;
          cidadesProcessadas++;
        }
      }

      if (cidadesProcessadas === 0) continue;

      const fmaMedio = fmaTotal / cidadesProcessadas;
      const tempMedia = tempTotal / cidadesProcessadas;
      const umidadeMedia = umidadeTotal / cidadesProcessadas;

      const { cor, perigo } = getFmaInfo(fmaMedio);

      const circle = L.circleMarker([regiao.coords.lat, regiao.coords.lon], {
        radius: 12,
        color: "#111",
        fillColor: cor,
        fillOpacity: 0.8,
        weight: 2.5,
      })
        .addTo(map)
        .bindPopup(`
          <div class="fire-popup">
            <h4>${nomeRegiao} Region</h4>
            <p><b>FMA Index (Avg):</b> ${fmaMedio.toFixed(0)}</p>
            <p><b>Danger Level:</b> <span style="color:${cor}; font-weight:bold;">${perigo}</span></p>
            <hr style="border-color: #333; margin: 8px 0;">
            <p style="font-size: 0.8em; color: #aaa;">
              🌡️ Avg. Temp: ${tempMedia.toFixed(1)}°C<br>
              💧 Avg. Humidity: ${umidadeMedia.toFixed(0)}%
            </p>
          </div>
        `);

      circle.on('mouseover', function (e) {
        this.openPopup();
        this.setStyle({ weight: 4, radius: 14 });
      });
      circle.on('mouseout', function (e) {
        this.setStyle({ weight: 2.5, radius: 12 });
      });
    } catch (err) {
      console.error(`Error processing data for region ${nomeRegiao}:`, err);
    }
  }

  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [
      { fma: 0,    label: 'Low',      range: '0 - 200' },
      { fma: 201,  label: 'Medium',      range: '201 - 500' },
      { fma: 501,  label: 'High',       range: '501 - 1000' },
      { fma: 1001, label: 'Very High', range: '1001 - 3000' },
      { fma: 3001, label: 'Critical',    range: '> 3000' },
    ];

    div.innerHTML = '<h4>Fire Risk</h4>';
    for (let i = 0; i < grades.length; i++) {
      const { cor } = getFmaInfo(grades[i].fma);
      div.innerHTML += `
        <div><i style="background:${cor}"></i> ${grades[i].label} <span class="legend-range">(${grades[i].range})</span></div>
      `;
    }
    return div;
  };
  legend.addTo(map);
}

function calculatePropagationRisk(weather) {
  if (!weather) {
    return { level: 'Unknown', color: '#999999', radius: 4, pulsating: false };
  }
  const { temp, humidity, wind } = weather;
  let score = 0;
  if (wind > 8) score++;
  if (humidity < 40) score++;
  if (temp > 30) score++; 

  if (score >= 3) return { level: 'Critical', color: '#d73027', radius: 12, pulsating: true };
  if (score === 2) return { level: 'High', color: '#fc8d59', radius: 9, pulsating: false };
  if (score === 1) return { level: 'Medium', color: '#fee08b', radius: 6, pulsating: false };
  return { level: 'Low', color: '#91cf60', radius: 4, pulsating: false };
}

function createPulsatingIcon(lat, lon, options) {
  const icon = L.divIcon({
    className: 'pulsating-icon',
    html: `<div class="pulsating-dot" style="background-color: ${options.color};"></div>`,
    iconSize: [options.radius * 2, options.radius * 2]
  });
  return L.marker([lat, lon], { icon });
}

function getThesisPopupContent(point, risk) {
  let content = `<h4>Hotspot Analysis</h4>
    <p><b>Lat:</b> ${point.lat.toFixed(4)} | <b>Lon:</b> ${point.lon.toFixed(4)}</p>
    <hr style="border-color: #333; margin: 8px 0;">
    <p><b>Propagation Risk:</b> <span style="color:${risk.color}; font-weight:bold;">${risk.level}</span></p>`;

  if (point.weather) {
    content += `<p style="font-size: 0.9em; color: #aaa;">
        💨 Wind: ${(point.weather.wind * 3.6).toFixed(1)} km/h<br>
        💧 Humidity: ${point.weather.humidity}%<br>
        🌡️ Temp: ${point.weather.temp}°C
      </p>`;
  }
  return content;
}

async function getThesisFireData() {
  const today = new Date().toISOString().split("T")[0];
  const NASA_API_KEY = "dad364bb4112d56be070ae5cb506ee8d";
  const apiUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_API_KEY}/VIIRS_SNPP_NRT/-79.4,-53.2,-33.9,13.4/1/${today}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`NASA API respondeu com status: ${response.status}`);
    
    const csvText = await response.text();
    if (csvText.includes("No fire alerts")) return [];

    const lines = csvText.split("\n").slice(1);
    return lines
      .map((line) => {
        const columns = line.split(",");
        if (columns.length > 2 && columns[0] && columns[1]) {
          return { lat: parseFloat(columns[0]), lon: parseFloat(columns[1]) };
        }
        return null;
      })
      .filter(p => p);
  } catch (error) {
    console.error("Failed to fetch hotspot data for thesis:", error);
    return [];
  }
}

async function initThesisMap() {
  const mapContainer = document.getElementById("tese-map-container");
  if (!mapContainer) {
    console.warn("Thesis map container not found.");
    return;
  }

  const thesisMap = L.map(mapContainer, {
    zoomControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    dragging: false,
    touchZoom: false,
    minZoom: 5,
    maxZoom: 5,
  }).setView([-15, -55], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(thesisMap);

  thesisMap.whenReady(async () => {
    const loaderHTML = `
      <div id="thesis-map-loader" style="display: flex; justify-content: center; align-items: center; background-color: rgba(10, 15, 25, 0.7); backdrop-filter: blur(4px);">
        <div class="thesis-loader-content">
          <p id="thesis-loader-text">Fetching hotspots...</p>
          <div class="progress-bar-container"><div id="thesis-progress-bar" class="progress-bar"></div></div>
        </div>
      </div>
    `;
    mapContainer.insertAdjacentHTML('beforeend', loaderHTML);

    const today = new Date().toISOString().split("T")[0];
    const allFireData = await getFireData(today);
    const loader = document.getElementById('thesis-map-loader');
    const loaderText = document.getElementById('thesis-loader-text');
    const progressBar = document.getElementById('thesis-progress-bar');

    if (allFireData.length === 0) {
      mapContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #fff; font-size: 1.2rem;">No hotspots detected today for analysis.</div>';
      return;
    }

    const sampleSize = 250;
    const fireSample = allFireData.sort(() => 0.5 - Math.random()).slice(0, sampleSize);

    let pointsProcessed = 0;
    loaderText.textContent = `Analyzing 0 of ${fireSample.length} hotspots...`;

    const promises = fireSample.map(point =>
      (async () => {
        try {
          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${point.lat.toFixed(2)}&longitude=${point.lon.toFixed(2)}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&wind_speed_unit=ms`;
          const response = await fetch(weatherUrl);
          const weatherData = await response.json();

          if (weatherData && weatherData.current) {
            point.weather = {
              temp: weatherData.current.temperature_2m,
              humidity: weatherData.current.relative_humidity_2m,
              wind: weatherData.current.wind_speed_10m,
            };

            const risk = calculatePropagationRisk(point.weather);
            const popupContent = getThesisPopupContent(point, risk);
            if (risk.pulsating) {
              createPulsatingIcon(point.lat, point.lon, risk).bindPopup(popupContent).addTo(thesisMap);
            } else {
              L.circleMarker([point.lat, point.lon], { color: risk.color, radius: risk.radius, fillOpacity: 0.9, weight: 1, stroke: true, fill: true }).bindPopup(popupContent).addTo(thesisMap);
            }
          }
        } catch (err) {
          console.error("Failed to fetch weather data for point:", point, err);
        }

        pointsProcessed++;
        loaderText.textContent = `Analyzing ${pointsProcessed} of ${fireSample.length} hotspots...`;
        progressBar.style.width = `${(pointsProcessed / fireSample.length) * 100}%`;
      })()
    );

    await Promise.all(promises);

    if (loader) {
      loader.style.transition = 'opacity 0.5s ease-out';
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }

    const thesisLegend = L.control({ position: 'bottomright' });
    thesisLegend.onAdd = function (map) {
      const div = L.DomUtil.create('div', 'info legend');
      div.innerHTML = `
        <h4>Propagation Risk</h4>
        <div><i style="background: #d73027;"></i> Critical <span class="legend-range">(High Wind/Temp, Low Humidity)</span></div>
        <div><i style="background: #fc8d59;"></i> High <span class="legend-range">(2 of 3 risk factors)</span></div>
        <div><i style="background: #fee08b;"></i> Medium <span class="legend-range">(1 of 3 risk factors)</span></div>
        <div><i style="background: #91cf60;"></i> Low <span class="legend-range">(Favorable conditions)</span></div>
      `;
      return div;
    };
    thesisLegend.addTo(thesisMap);
  });
}

function initInpeDeforestationMap() {
  const loadBtn = document.getElementById('load-deforestation-chart-btn');
  const chartContainer = document.getElementById('chart-container');
  const ctx = document.getElementById('deforestation-chart');

  if (!loadBtn || !chartContainer || !ctx) {
    console.warn("Elements for the deforestation chart not found.");
    return;
  }

  loadBtn.addEventListener('click', () => {
    loadBtn.style.display = 'none';
    chartContainer.style.display = 'block';

    const prodesData = {
      labels: ['2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023'],
      values: [5012, 6207, 7893, 6947, 7536, 10129, 10851, 13038, 11594, 9001]
    };

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: prodesData.labels,
        datasets: [{
          label: 'Deforested Area (km²)',
          data: prodesData.values,
          backgroundColor: 'rgba(26, 35, 126, 0.7)',
          borderColor: 'rgba(57, 73, 171, 1)',
          borderWidth: 2,
          hoverBackgroundColor: 'rgba(57, 73, 171, 1)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1c24',
            titleFont: { size: 16, weight: 'bold' },
            bodyFont: { size: 14 },
            callbacks: {
              label: function(context) {
                return `Area: ${context.parsed.y.toLocaleString('en-US')} km²`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Deforested Area (km²)', color: '#333' }
          },
          x: {
            title: { display: true, text: 'Year', color: '#333' }
          }
        }
      }
    });

    console.log("Deforestation chart initialized.");
  });
}
