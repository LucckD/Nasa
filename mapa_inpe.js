document.addEventListener("DOMContentLoaded", () => {
  // Initialize the fire risk map in its section
  const fireRiskMapContainer = document.getElementById("mapa-sar-container");
  if (fireRiskMapContainer) { initFireRiskMap("mapa-sar-container"); }

  // Initialize INPE deforestation chart logic
  initInpeDeforestationMap();

  // Initialize the thesis map in the final section
  initThesisMap();
});

async function initFireRiskMap(mapId) {
  // Geographic bounds for Brazil
  const brazilBounds = L.latLngBounds(
    L.latLng(-34, -74), // Southwest corner
    L.latLng(6, -34)    // Northeast corner
  );

  const map = L.map(mapId, {
    zoomControl: false,       // Remove +/- zoom buttons
    scrollWheelZoom: false,   // Disable wheel zoom
    doubleClickZoom: false,   // Disable double-click zoom
    dragging: false,          // Disable map dragging
    touchZoom: false,         // Disable pinch-to-zoom on touch
    minZoom: 4,               // Lock min zoom
    maxZoom: 4,               // Lock max zoom
    maxBounds: brazilBounds,  // Restrict view to these bounds
    maxBoundsViscosity: 1.0   // Make bounds 'solid'
  }).setView([-15.78, -47.93], 4);

  // Use satellite tiles for richer visuals
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  }).addTo(map);

  // Load and display state boundaries
  const estadosPane = map.createPane('estadosPane');
  estadosPane.style.zIndex = 250; // Lower z-index so it's in the background

  const estadosUrl = 'https://raw.githubusercontent.com/fititnt/gis-dataset-brasil/main/uf/geojson/uf.json';
  try {
    const response = await fetch(estadosUrl);
    const estadosData = await response.json();
    L.geoJSON(estadosData, {
      pane: 'estadosPane', // Ensure layer is on the background pane
      style: {
        color: 'rgba(255, 255, 255, 0.6)', // semi-transparent white line
        weight: 1.5,
        fillOpacity: 0.0 // no fill
      }
    }).addTo(map);
    console.log("States layer loaded in map background.");
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

  /**
   * Calculate the Monte Alegre Fire Danger Index (FMA).
   * FMA is an ACCUMULATED index that increases for each day without significant rain.
   * FMA = Σ (100 - H) * N
   * H: Relative humidity at 13:00 (%).
   * N: Coefficient depending on number of consecutive dry days (> 2.5mm).
   *    - N increments by 0.1 per dry day, up to 2.0.
   *    - Index resets to zero if rainfall > 12.7mm occurs.
   */
  function calcularFMA(dailyPrecipitation, hourlyHumidity) {
    let fmaAcumulado = 0;
    let diasSemChuva = 0;

    for (let i = 0; i < dailyPrecipitation.length; i++) {
      const chuvaDoDia = dailyPrecipitation[i];

      // Reset index if heavy rain occurs
      if (chuvaDoDia > 12.7) {
        fmaAcumulado = 0;
        diasSemChuva = 0;
        continue;
      }

      if (chuvaDoDia > 2.5) {
        diasSemChuva = 0; // Reset dry day count
      } else {
        diasSemChuva++;
      }

      const umidade13h = hourlyHumidity[i * 24 + 13]; // humidity at 13:00
      if (umidade13h === undefined || umidade13h === null) continue;

      const N = Math.min(1.0 + diasSemChuva * 0.1, 2.0); // coefficient N
      const fmaDiario = (100 - umidade13h) * N;

      fmaAcumulado += fmaDiario;
    }

    return fmaAcumulado;
  }

  function getFmaInfo(fma) {
    if (fma > 3000) return { cor: "#d73027", perigo: "Critical" };
    if (fma > 1000) return { cor: "#fc8d59", perigo: "Very High" };
    if (fma > 500) return { cor: "#fee08b", perigo: "High" };
    if (fma > 200) return { cor: "#ffffbf", perigo: "Moderate" };
    return { cor: "#91cf60", perigo: "Low" };
  }

  const hoje = new Date();
  const dataInicio = new Date();
  dataInicio.setDate(hoje.getDate() - 30); // Fetch last 30 days of data

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

      L.circleMarker([regiao.coords.lat, regiao.coords.lon], {
        radius: 10,
        color: "#111",
        fillColor: cor,
        fillOpacity: 0.8,
        weight: 2,
      })
        .addTo(map)
        .bindPopup(`
          <div class="fire-popup">
            <h4>Region ${nomeRegiao}</h4>
            <p><b>FMA Index (Avg):</b> ${fmaMedio.toFixed(0)}</p>
            <p><b>Risk Level:</b> <span style="color:${cor}; font-weight:bold;">${perigo}</span></p>
            <hr style="border-color: #333; margin: 8px 0;">
            <p style="font-size: 0.8em; color: #aaa;">
              🌡️ Avg Temp: ${tempMedia.toFixed(1)}°C<br>
              💧 Avg Humidity: ${umidadeMedia.toFixed(0)}%
            </p>
          </div>
        `);
    } catch (err) {
      console.error(`Error processing data for region ${nomeRegiao}:`, err);
    }
  }

  // Add fire risk legend to the map
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [
      { fma: 0,    label: 'Low',       range: '0 - 200' },
      { fma: 201,  label: 'Moderate',  range: '201 - 500' },
      { fma: 501,  label: 'High',      range: '501 - 1000' },
      { fma: 1001, label: 'Very High', range: '1001 - 3000' },
      { fma: 3001, label: 'Critical',  range: '> 3000' },
    ];

    div.innerHTML = '<h4>Fire Risk</h4>';
    // Iterate levels and create colored label for each
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

async function initThesisMap() {
  const mapContainer = document.getElementById("tese-map-container");
  if (!mapContainer) {
    console.warn("Container for thesis map not found.");
    return;
  }

  const thesisMap = L.map(mapContainer).setView([-10.8, -62.5], 6); // Focus on Rondônia

  // Base map layer (satellite)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
  }).addTo(thesisMap);

  // INPE Fire Risk WMS layer
  const wmsUrl = 'https://terrabrasilis.dpi.inpe.br/geoserver/terrabrasilis/wms';
  const fireRiskLayer = L.tileLayer.wms(wmsUrl, {
      layers: 'terrabrasilis:risco_fogo_previsto',
      format: 'image/png',
      transparent: true,
      opacity: 0.6,
      attribution: 'Fire Risk &copy; INPE'
  });

  // Deforestation polygons (local GeoJSON variable desmatamentoRO2022)
  const deforestationLayer = L.geoJSON(desmatamentoRO2022, {
    style: {
      color: "#ff00ff", // magenta for contrast
      weight: 1.5,
      fillOpacity: 0.4
    },
    onEachFeature: (feature, layer) => {
      const areaKm = (feature.properties.areakm).toFixed(2);
      layer.bindPopup(`<div class="fire-popup"><h4>Deforested Area (2022)</h4><p><b>Area:</b> ${areaKm} km²</p></div>`);
    }
  });

  // Add layers to layer control
  const overlayMaps = {
    "<span style='color: #ff00ff;'>Deforestation (2022)</span>": deforestationLayer,
    "Fire Risk (INPE)": fireRiskLayer
  };

  // Add layers by default
  fireRiskLayer.addTo(thesisMap);
  deforestationLayer.addTo(thesisMap);

  L.control.layers(null, overlayMaps, { collapsed: false }).addTo(thesisMap);

  // Add a custom legend for the thesis map
  const thesisLegend = L.control({ position: 'bottomright' });
  thesisLegend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `
      <h4>Analysis Legend</h4>
      <div><i style="background: #ff00ff; opacity: 0.7;"></i> Deforestation (2022)</div>
      <hr style="border-color: #444; margin: 8px 0;">
      <strong>Fire Risk</strong><br>
      <div><i style="background: #d73027;"></i> Critical</div>
      <div><i style="background: #fc8d59;"></i> Very High</div>
      <div><i style="background: #fee08b;"></i> High</div>
      <div><i style="background: #91cf60;"></i> Low</div>
    `;
    return div;
  };
  thesisLegend.addTo(thesisMap);

  // Add state boundaries for context
  const estadosUrl = 'https://raw.githubusercontent.com/fititnt/gis-dataset-brasil/main/uf/geojson/uf.json';
  try {
    const response = await fetch(estadosUrl);
    const estadosData = await response.json();
    L.geoJSON(estadosData, { style: { color: 'rgba(255, 255, 255, 0.7)', weight: 1, fillOpacity: 0.0 } }).addTo(thesisMap);
  } catch (err) {
    console.error("Error loading states GeoJSON:", err);
  }
}

function initInpeDeforestationMap() {
  // Setup for the PRODES chart (runs when button clicked)
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

    // PRODES (INPE) deforestation data - deforested area (km²) in the Legal Amazon
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
