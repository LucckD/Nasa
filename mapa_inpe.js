document.addEventListener("DOMContentLoaded", function () {
  setupInpeMap();
  setupRioFireRiskMap();

  function setupInpeMap() {
    let inpeMapInitialized = false;

    ScrollTrigger.create({
      trigger: "#desmatamento-sar",
      start: "top 80%",
      once: true,
      onEnter: () => {
        if (inpeMapInitialized) return;
        console.log("SCROLLTRIGGER: Inicializando mapa do INPE...");
        initInpeMap();
        inpeMapInitialized = true;
      },
    });
  }

  function setupRioFireRiskMap() {
    let rioMapInitialized = false;

    ScrollTrigger.create({
      trigger: "#sar-rio",
      start: "top 80%",
      once: true,
      onEnter: () => {
        if (rioMapInitialized) return;
        console.log("SCROLLTRIGGER: Inicializando mapa de risco de fogo do Rio...");
        initRioFireRiskMap();
        rioMapInitialized = true;
      },
    });
  }
  function initRioFireRiskMap() {
    const rioCenter = [-22.9068, -43.1729];
    const rioMap = L.map("mapa-sar-container", {
      center: rioCenter,
      zoom: 10,
    });

    // 3. Adiciona um mapa base de satélite (Esri World Imagery)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }).addTo(rioMap);

    // 4. Criação de dados simulados de risco de fogo para áreas de vegetação (apenas para teste)
    const areasDeRiscoFogo = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": { "nome": "Parque Nacional da Tijuca", "risco": "Alto" },
          "geometry": {
            "type": "Polygon",
            "coordinates": [[[-43.28, -22.95], [-43.22, -22.91], [-43.23, -22.98], [-43.28, -22.95]]]
          }
        },
        {
          "type": "Feature",
          "properties": { "nome": "Parque Estadual da Pedra Branca", "risco": "Muito Alto" },
          "geometry": {
            "type": "Polygon",
            "coordinates": [[[-43.50, -22.90], [-43.40, -22.88], [-43.42, -22.96], [-43.50, -22.90]]]
          }
        },
        {
          "type": "Feature",
          "properties": { "nome": "Parque Natural Municipal de Grumari", "risco": "Médio" },
          "geometry": {
            "type": "Polygon",
            "coordinates": [[[-43.53, -23.04], [-43.50, -23.03], [-43.52, -23.05], [-43.53, -23.04]]]
          }
        }
      ]
    };

    // Camada de Polígonos de Risco
    const riscoFogoPoligonos = L.geoJSON(areasDeRiscoFogo, {
      style: function(feature) {
        const risco = feature.properties.risco;
        let color;
        if (risco === "Muito Alto") color = "#d73027"; // Vermelho
        else if (risco === "Alto") color = "#fc8d59"; // Laranja
        else color = "#fee08b"; // Amarelo
        return { color: color, weight: 2, fillOpacity: 0.5 };
      },
      onEachFeature: function (feature, layer) {
        const props = feature.properties;
        layer.bindPopup(`<h4>Área de Risco de Fogo</h4><p><b>Local:</b> ${props.nome}<br><b>Nível de Risco (Simulado):</b> ${props.risco}</p>`);
      }
    });

    const heatPoints = [];
    areasDeRiscoFogo.features.forEach(feature => {
      const bounds = L.geoJSON(feature).getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const risco = feature.properties.risco;
      
      let pointCount, intensity;
      if (risco === "Muito Alto") { pointCount = 150; intensity = 0.9; }
      else if (risco === "Alto") { pointCount = 70; intensity = 0.6; }
      else { pointCount = 30; intensity = 0.3; }

      for (let i = 0; i < pointCount; i++) {
        const lat = sw.lat + Math.random() * (ne.lat - sw.lat);
        const lon = sw.lng + Math.random() * (ne.lng - sw.lng);
        heatPoints.push([lat, lon, intensity]);
      }
    });

    const heatLayer = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 20,
        gradient: {0.4: 'blue', 0.65: 'lime', 1: 'red'}
    });

    heatLayer.addTo(rioMap);
    const overlayMaps = {
      "Mapa de Calor (Risco Simulado)": heatLayer,
      "Áreas de Risco (Polígonos)": riscoFogoPoligonos
    };

    L.control.layers(null, overlayMaps, { collapsed: false }).addTo(rioMap);

    console.log("MAPA RIO: Configuração do mapa de risco de fogo finalizada.");
  }
});