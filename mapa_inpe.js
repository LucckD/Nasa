document.addEventListener("DOMContentLoaded", () => {
  // A inicialização dos mapas de risco e da tese foi movida para app.js
  // para usar o ScrollTrigger e carregar dinamicamente.

  // Inicializa a lógica para o mapa de desmatamento do INPE
  // Isso é leve (apenas um event listener), então pode continuar aqui.
  initInpeDeforestationMap();
});

async function initFireRiskMap(mapId) {
  // Define os limites geográficos para o Brasil
  const brazilBounds = L.latLngBounds(
    L.latLng(-34, -74), // Canto Sudoeste
    L.latLng(6, -34)    // Canto Nordeste
  );

  const map = L.map(mapId, {
    zoomControl: false,       // Remove os botões de +/- zoom
    scrollWheelZoom: false,   // Desativa o zoom pela roda do mouse
    doubleClickZoom: false,   // Desativa o zoom por duplo clique
    dragging: false,          // Desativa o arrastar do mapa
    touchZoom: false,         // Desativa o "pinch-to-zoom" em telas de toque
    minZoom: 4,               // Trava o zoom mínimo
    maxZoom: 4,               // Trava o zoom máximo
    maxBounds: brazilBounds,  // Restringe a visão a estes limites
    maxBoundsViscosity: 1.0   // Torna os limites "sólidos"
  }).setView([-15.78, -47.93], 4);
  // Trocando o mapa escuro por um de satélite para um visual mais rico
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  }).addTo(map);

  // Carregar e exibir as divisões dos estados
  const estadosPane = map.createPane('estadosPane');
  estadosPane.style.zIndex = 250; // Z-index baixo para ficar no fundo

  const estadosUrl = 'https://raw.githubusercontent.com/fititnt/gis-dataset-brasil/main/uf/geojson/uf.json';
  try {
    const response = await fetch(estadosUrl);
    const estadosData = await response.json();
    L.geoJSON(estadosData, {
      pane: 'estadosPane', // Garante que a camada fique no painel de fundo
      style: {
        color: 'rgba(255, 255, 255, 0.6)', // Linha branca semi-transparente
        weight: 1.5,
        fillOpacity: 0.0 // Sem preenchimento
      }
    }).addTo(map);
    console.log("Camada de estados carregada no fundo do mapa.");
  } catch (err) {
    console.error("Erro ao carregar o GeoJSON dos estados:", err);
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
   * Calcula o Índice de Risco de Incêndio usando a Fórmula de Monte Alegre (FMA).
   * A FMA é um índice ACUMULADO. Ele aumenta a cada dia sem chuva.
   * FMA = Σ (100 - H) * N
   * H: Umidade Relativa do ar às 13h (%).
   * N: Coeficiente que depende do número de dias (n) sem chuva > 2.5mm.
   *    - N é incrementado em 0.1 para cada dia 'n' sem chuva, até um máximo de 2.0.
   *    - O índice é zerado se ocorrer chuva > 12.7mm.
   */
  function calcularFMA(dailyPrecipitation, hourlyHumidity) {
    let fmaAcumulado = 0;
    let diasSemChuva = 0;

    for (let i = 0; i < dailyPrecipitation.length; i++) {
      const chuvaDoDia = dailyPrecipitation[i];

      // Zera o índice se a chuva for muito forte
      if (chuvaDoDia > 12.7) {
        fmaAcumulado = 0;
        diasSemChuva = 0;
        continue;
      }

      if (chuvaDoDia > 2.5) {
        diasSemChuva = 0; // Zera a contagem de dias secos
      } else {
        diasSemChuva++;
      }

      const umidade13h = hourlyHumidity[i * 24 + 13]; // Pega a umidade às 13h do dia
      if (umidade13h === undefined || umidade13h === null) continue;

      const N = Math.min(1.0 + diasSemChuva * 0.1, 2.0); // Coeficiente N
      const fmaDiario = (100 - umidade13h) * N;

      fmaAcumulado += fmaDiario;
    }

    return fmaAcumulado;
  }

  function getFmaInfo(fma) {
    if (fma > 3000) return { cor: "#d73027", perigo: "Crítico" };
    if (fma > 1000) return { cor: "#fc8d59", perigo: "Muito Alto" };
    if (fma > 500) return { cor: "#fee08b", perigo: "Alto" };
    if (fma > 200) return { cor: "#ffffbf", perigo: "Médio" };
    return { cor: "#91cf60", perigo: "Baixo" };
  }

  const hoje = new Date();
  const dataInicio = new Date();
  dataInicio.setDate(hoje.getDate() - 30); // Busca dados dos últimos 30 dias

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
        radius: 12, // Raio um pouco maior para melhor interação
        color: "#111", // Cor do contorno
        fillColor: cor,
        fillOpacity: 0.8,
        weight: 2.5, // Contorno mais destacado
      })
        .addTo(map)
        .bindPopup(`
          <div class="fire-popup">
            <h4>Região ${nomeRegiao}</h4>
            <p><b>Índice FMA (Médio):</b> ${fmaMedio.toFixed(0)}</p>
            <p><b>Nível de Perigo:</b> <span style="color:${cor}; font-weight:bold;">${perigo}</span></p>
            <hr style="border-color: #333; margin: 8px 0;">
            <p style="font-size: 0.8em; color: #aaa;">
              🌡️ Temp. Média: ${tempMedia.toFixed(1)}°C<br>
              💧 Umidade Média: ${umidadeMedia.toFixed(0)}%
            </p>
          </div>
        `);

      // Adiciona interatividade no hover
      circle.on('mouseover', function (e) {
        this.openPopup();
        this.setStyle({ weight: 4, radius: 14 }); // Destaca ao passar o mouse
      });
      circle.on('mouseout', function (e) {
        this.setStyle({ weight: 2.5, radius: 12 }); // Volta ao normal
      });
    } catch (err) {
      console.error(`Erro ao processar dados para a região ${nomeRegiao}:`, err);
    }
  }

  // Adiciona a legenda de risco de incêndio ao mapa
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [
      { fma: 0,    label: 'Baixo',      range: '0 - 200' },
      { fma: 201,  label: 'Médio',      range: '201 - 500' },
      { fma: 501,  label: 'Alto',       range: '501 - 1000' },
      { fma: 1001, label: 'Muito Alto', range: '1001 - 3000' },
      { fma: 3001, label: 'Crítico',    range: '> 3000' },
    ];

    div.innerHTML = '<h4>Risco de Incêndio</h4>';
    // Percorre os níveis de perigo e gera um rótulo com uma caixa colorida para cada um
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
  if (wind > 8) score++;    // Vento > ~28 km/h
  if (humidity < 40) score++; // Umidade baixa
  if (temp > 30) score++;     // Temperatura alta

  if (score >= 3) return { level: 'Critical', color: '#d73027', radius: 12, pulsating: true }; // Raio bem maior
  if (score === 2) return { level: 'High', color: '#fc8d59', radius: 9, pulsating: false };
  if (score === 1) return { level: 'Medium', color: '#fee08b', radius: 6, pulsating: false };
  return { level: 'Low', color: '#91cf60', radius: 4, pulsating: false }; // Raio menor
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
  let content = `<h4>Análise do Foco</h4>
    <p><b>Lat:</b> ${point.lat.toFixed(4)} | <b>Lon:</b> ${point.lon.toFixed(4)}</p>
    <hr style="border-color: #333; margin: 8px 0;">
    <p><b>Risco de Propagação:</b> <span style="color:${risk.color}; font-weight:bold;">${risk.level}</span></p>`;

  if (point.weather) {
    content += `<p style="font-size: 0.9em; color: #aaa;">
        💨 Vento: ${(point.weather.wind * 3.6).toFixed(1)} km/h<br>
        💧 Umidade: ${point.weather.humidity}%<br>
        🌡️ Temp: ${point.weather.temp}°C
      </p>`;
  }
  return content;
}

async function getThesisFireData() {
  const today = new Date().toISOString().split("T")[0];
  const NASA_API_KEY = "dad364bb4112d56be070ae5cb506ee8d"; // Sua chave da API FIRMS
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
    console.error("Falha ao buscar dados de focos de calor para a tese:", error);
    return [];
  }
}

async function initThesisMap() {
  const mapContainer = document.getElementById("tese-map-container");
  if (!mapContainer) {
    console.warn("Contêiner do mapa da tese não encontrado.");
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

  // Mapa base mais limpo e com nomes de estados
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(thesisMap);

  // Garante que o mapa esteja pronto antes de carregar os dados
  thesisMap.whenReady(async () => {
    // CRIA E ADICIONA O LOADER DEPOIS QUE O MAPA ESTÁ PRONTO
    const loaderHTML = `
      <div id="thesis-map-loader" style="display: flex; justify-content: center; align-items: center; background-color: rgba(10, 15, 25, 0.7); backdrop-filter: blur(4px);">
        <div class="thesis-loader-content">
          <p id="thesis-loader-text">Buscando focos de calor...</p>
          <div class="progress-bar-container"><div id="thesis-progress-bar" class="progress-bar"></div></div>
        </div>
      </div>
    `;
    mapContainer.insertAdjacentHTML('beforeend', loaderHTML);


    // OTIMIZAÇÃO: Reutiliza a função getFireData que usa o cache.
    const today = new Date().toISOString().split("T")[0];
    const allFireData = await getFireData(today);
    const loader = document.getElementById('thesis-map-loader');
    const loaderText = document.getElementById('thesis-loader-text');
    const progressBar = document.getElementById('thesis-progress-bar');

    if (allFireData.length === 0) {
      mapContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #fff; font-size: 1.2rem;">Nenhum foco de calor detectado hoje para análise.</div>';
      return;
    }

    // Analisamos uma amostra para não sobrecarregar a API
    const sampleSize = 250;
    const fireSample = allFireData.sort(() => 0.5 - Math.random()).slice(0, sampleSize);

    let pointsProcessed = 0;
    loaderText.textContent = `Analisando 0 de ${fireSample.length} pontos...`;

    // Executa as requisições em paralelo, mas atualiza a UI progressivamente
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

            // Adiciona o ponto ao mapa assim que os dados chegam
            const risk = calculatePropagationRisk(point.weather);
            const popupContent = getThesisPopupContent(point, risk);
            if (risk.pulsating) {
              createPulsatingIcon(point.lat, point.lon, risk).bindPopup(popupContent).addTo(thesisMap);
            } else {
              L.circleMarker([point.lat, point.lon], { color: risk.color, radius: risk.radius, fillOpacity: 0.9, weight: 1, stroke: true, fill: true }).bindPopup(popupContent).addTo(thesisMap);
            }
          }
        } catch (err) {
          console.error("Falha ao buscar dados de tempo para o ponto:", point, err);
        }

        // Atualiza a UI de progresso
        pointsProcessed++;
        loaderText.textContent = `Analisando ${pointsProcessed} de ${fireSample.length} pontos...`;
        progressBar.style.width = `${(pointsProcessed / fireSample.length) * 100}%`;
      })()
    );

    // Espera todas as promessas terminarem antes de esconder o loader
    await Promise.all(promises);

    // Animação de fade-out para o loader
    if (loader) {
      loader.style.transition = 'opacity 0.5s ease-out';
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }

    const thesisLegend = L.control({ position: 'bottomright' });
    thesisLegend.onAdd = function (map) {
      const div = L.DomUtil.create('div', 'info legend');
      div.innerHTML = `
        <h4>Risco de Propagação</h4>
        <div><i style="background: #d73027;"></i> Crítico <span class="legend-range">(Vento/Temp. altos, Umid. baixa)</span></div>
        <div><i style="background: #fc8d59;"></i> Alto <span class="legend-range">(2 de 3 fatores de risco)</span></div>
        <div><i style="background: #fee08b;"></i> Médio <span class="legend-range">(1 de 3 fatores de risco)</span></div>
        <div><i style="background: #91cf60;"></i> Baixo <span class="legend-range">(Condições favoráveis)</span></div>
      `;
      return div;
    };
    thesisLegend.addTo(thesisMap);
  });
}

function initInpeDeforestationMap() {
  // Função limpa após a remoção do gráfico.
  const loadBtn = document.getElementById('load-deforestation-chart-btn');
  const chartContainer = document.getElementById('chart-container');
  const ctx = document.getElementById('deforestation-chart');

  if (!loadBtn || !chartContainer || !ctx) {
    console.warn("Elementos para o gráfico de desmatamento não encontrados.");
    return;
  }

  loadBtn.addEventListener('click', () => {
    loadBtn.style.display = 'none';
    chartContainer.style.display = 'block';

    // Dados do PRODES (INPE) - Taxa de desmatamento (km²) na Amazônia Legal
    const prodesData = {
      labels: ['2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023'],
      values: [5012, 6207, 7893, 6947, 7536, 10129, 10851, 13038, 11594, 9001]
    };

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: prodesData.labels,
        datasets: [{
          label: 'Área Desmatada (km²)',
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
                return `Área: ${context.parsed.y.toLocaleString('pt-BR')} km²`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Área Desmatada (km²)', color: '#333' }
          },
          x: {
            title: { display: true, text: 'Ano', color: '#333' }
          }
        }
      }
    });

    console.log("Gráfico de desmatamento inicializado.");
  });
}
