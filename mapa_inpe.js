document.addEventListener("DOMContentLoaded", () => {
  // Inicializa o mapa de risco de incêndio na seção correspondente
  const fireRiskMapContainer = document.getElementById("mapa-sar-container");
  if (fireRiskMapContainer) { initFireRiskMap("mapa-sar-container"); }

  // Inicializa a lógica para o mapa de desmatamento do INPE
  initInpeDeforestationMap();

  // Inicializa o mapa da TESE na seção final
  initThesisMap();
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

      L.circleMarker([regiao.coords.lat, regiao.coords.lon], {
        radius: 10, // Raio menor, em pixels
        color: "#111", // Cor do contorno
        fillColor: cor,
        fillOpacity: 0.8,
        weight: 2, // Espessura do contorno
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

async function initThesisMap() {
  const mapContainer = document.getElementById("tese-map-container");
  if (!mapContainer) {
    console.warn("Contêiner para o mapa da tese não encontrado.");
    return;
  }

  const thesisMap = L.map(mapContainer).setView([-10.8, -62.5], 6); // Foco em Rondônia

  // Camada de Mapa Base (Satélite)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
  }).addTo(thesisMap);

  // Camada de Risco de Fogo do INPE (WMS)
  const wmsUrl = 'https://terrabrasilis.dpi.inpe.br/geoserver/terrabrasilis/wms';
  const fireRiskLayer = L.tileLayer.wms(wmsUrl, {
      layers: 'terrabrasilis:risco_fogo_previsto',
      format: 'image/png',
      transparent: true,
      opacity: 0.6,
      attribution: 'Risco de Fogo &copy; INPE'
  });

  // Camada de Polígonos de Desmatamento (GeoJSON local)
  const deforestationLayer = L.geoJSON(desmatamentoRO2022, {
    style: {
      color: "#ff00ff", // Magenta para alto contraste
      weight: 1.5,
      fillOpacity: 0.4
    },
    onEachFeature: (feature, layer) => {
      const areaKm = (feature.properties.areakm).toFixed(2);
      layer.bindPopup(`<div class="fire-popup"><h4>Área Desmatada (2022)</h4><p><b>Área:</b> ${areaKm} km²</p></div>`);
    }
  });

  // Adiciona as camadas ao controle
  const overlayMaps = {
    "<span style='color: #ff00ff;'>Desmatamento (2022)</span>": deforestationLayer,
    "Risco de Fogo (INPE)": fireRiskLayer
  };

  // Adiciona as camadas ao mapa por padrão
  fireRiskLayer.addTo(thesisMap);
  deforestationLayer.addTo(thesisMap);

  L.control.layers(null, overlayMaps, { collapsed: false }).addTo(thesisMap);

  // Adiciona uma legenda customizada para a tese
  const thesisLegend = L.control({ position: 'bottomright' });
  thesisLegend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `
      <h4>Legenda da Análise</h4>
      <div><i style="background: #ff00ff; opacity: 0.7;"></i> Desmatamento (2022)</div>
      <hr style="border-color: #444; margin: 8px 0;">
      <strong>Risco de Fogo</strong><br>
      <div><i style="background: #d73027;"></i> Crítico</div>
      <div><i style="background: #fc8d59;"></i> Muito Alto</div>
      <div><i style="background: #fee08b;"></i> Alto</div>
      <div><i style="background: #91cf60;"></i> Baixo</div>
    `;
    return div;
  };
  thesisLegend.addTo(thesisMap);

  // Adiciona os contornos dos estados para contexto
  const estadosUrl = 'https://raw.githubusercontent.com/fititnt/gis-dataset-brasil/main/uf/geojson/uf.json';
  try {
    const response = await fetch(estadosUrl);
    const estadosData = await response.json();
    L.geoJSON(estadosData, { style: { color: 'rgba(255, 255, 255, 0.7)', weight: 1, fillOpacity: 0.0 } }).addTo(thesisMap);
  } catch (err) {
    console.error("Erro ao carregar o GeoJSON dos estados:", err);
  }
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
