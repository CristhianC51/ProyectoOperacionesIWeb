const runBtn = document.getElementById('runBtn');
const resultDiv = document.getElementById('result');
const populationInput = document.getElementById('population');
const generationsInput = document.getElementById('generations');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const chartContainer = document.getElementById('chart-container');
const containerDiv = document.querySelector('.container');

let costChart = null;
let costHistory = [];

let map = null;
let antennaMarkers = [];
let clientMarkers = [];

function initMap() {
  // Destruye el mapa existente si hay uno
  if (map) {
    map.remove();
  }
  
  // Crea un nuevo mapa centrado en una ubicación por defecto (ej: CDMX)
  map = L.map('map').setView([7.12539, -73.1198], 12);
  
  // Añade capa de tiles de OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Limpia marcadores anteriores
  antennaMarkers = [];
  clientMarkers = [];
}

function setLoading(loading = true) {
  runBtn.disabled = loading;
  runBtn.setAttribute('aria-busy', loading ? 'true' : 'false');

  if (loading) {
    resultDiv.className = 'loading';
    resultDiv.textContent = "Ejecutando algoritmo, espera por favor...";
    progressBar.style.width = '0%';
    progressContainer.style.display = 'block';
  } else {
    progressBar.style.width = '100%';
    progressContainer.setAttribute('aria-valuenow', 100);
    setTimeout(() => {
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
    }, 800);
  }
}

function plotAntennas(selectedIndices) {
  if (!map) return;
  
  // Limpiar marcadores anteriores
  antennaMarkers.forEach(marker => map.removeLayer(marker));
  antennaMarkers = [];
  
  // Simulación de coordenadas - ¡REEMPLAZA CON TUS DATOS REALES!
  // En un caso real, deberías tener un archivo con las coordenadas de cada antena
  selectedIndices.forEach(index => {
    // Genera coordenadas aleatorias alrededor del centro del mapa
    const lat = 7.12539 + (Math.random() * 0.1 - 0.05);
    const lng = -73.1198 + (Math.random() * 0.1 - 0.05);
    
    const marker = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: "#e74c3c",
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map);

    const COVERAGE_RADIUS_KM = 0.5;
    
    L.circle([lat, lng], {
        radius: COVERAGE_RADIUS_KM * 1000,
        color: '#3498db',
        fillColor: '#3498db',
        fillOpacity: 0.2
      }).addTo(map);
    
    marker.bindPopup(`Antena #${index}`);
    antennaMarkers.push(marker);
  });
  
  // Ajusta el zoom para mostrar todas las antenas
  if (antennaMarkers.length > 0) {
    const group = new L.featureGroup(antennaMarkers);
    map.fitBounds(group.getBounds().pad(0.2));
  }
}

function showError(message) {
  resultDiv.className = 'error';
  resultDiv.textContent = "Error: " + message;
}

function showFinalResult(data) {
  resultDiv.className = 'success';
  resultDiv.innerHTML = `
    <strong>Optimización completada</strong><br>
    Antenas seleccionadas: ${data.antennas_selected}<br>
    Costo total: ${data.total_cost.toFixed(2)}<br>
    Clientes cubiertos: ${data.clients_covered} de ${data.total_clients}<br>
    <strong>Índices seleccionados:</strong><br>
    <small style="color:#555; font-family: monospace; max-height: 90px; overflow-y: auto; display: block; background: #fff; border-radius: 5px; padding: 8px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">${data.selected_indices.join(', ')}</small>
  `;

  // Mostrar el contenedor del mapa
  document.getElementById('map-container').style.display = 'block';
  
  // Inicializar y mostrar el mapa con las antenas seleccionadas
  initMap();
  plotAntennas(data.selected_indices);
}

runBtn.onclick = () => {
  const population = populationInput.value.trim();
  const generations = generationsInput.value.trim();
  const seed = document.getElementById('seed').value.trim();

  // Validaciones (se mantienen igual)
  if (population === '' || generations === '') {
    showError('Por favor completa todos los campos.');
    return;
  }
  if (isNaN(population) || isNaN(generations)) {
    showError('Los valores deben ser numéricos.');
    return;
  }
  if (+population < 1 || +generations < 1) {
    showError('Los valores deben ser mayores que 0.');
    return;
  }

  // Limpiar estado anterior
  costHistory = [];
  if (costChart) {
    costChart.destroy();
  }

  // Mostrar contenedores
  chartContainer.style.display = 'block';
  containerDiv.classList.add('shift-left');

  // Inicializar gráfica con configuración completa
  costChart = new Chart(document.getElementById('costChart'), {
    type: 'line',
    data: {
      datasets: [{
        label: 'Costo Total',
        data: [],
        borderColor: '#2980b9',
        backgroundColor: 'rgba(41,128,185,0.1)',
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.3,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 0 // Desactiva animación para actualizaciones en tiempo real
      },
      scales: {
        x: {
          title: { display: true, text: 'Iteración' },
          type: 'linear',
          min: 0,
          max: +generations,
          ticks: {
            stepSize: Math.ceil(+generations / 10)
          }
        },
        y: {
          title: { display: true, text: 'Costo Total' },
          beginAtZero: false,
          ticks: {
            callback: function(value) {
              return value.toLocaleString(); // Formato de números
            }
          }
        }
      },
      plugins: {
        zoom: {
          pan: {
            enabled: true,
            mode: 'xy',
            modifierKey: 'ctrl',
            threshold: 10
          },
          zoom: {
            wheel: { enabled: true, modifierKey: 'alt' },
            pinch: { enabled: true },
            mode: 'xy'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Iteración: ${context.parsed.x}, Costo: ${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      }
    }
  });

  setLoading(true);

  // Cerrar conexión anterior si existe
  if (window.currentEventSource) {
    window.currentEventSource.close();
  }

  const url = `http://localhost:5000/run?population=${population}&generations=${generations}&seed=${seed}`;
  const eventSource = new EventSource(url);
  window.currentEventSource = eventSource;

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Datos recibidos:', data); // Para depuración

    if (data.status === 'running') {
      // Actualizar interfaz
      resultDiv.className = 'loading';
      resultDiv.textContent = `
        Iteración ${data.iteration} de ${data.total_iterations}
        Progreso: ${Math.round((data.iteration / data.total_iterations) * 100)}%
        Costo actual: ${data.current_cost.toLocaleString()}
        Clientes cubiertos: ${data.clients_covered}
      `.trim();

      // Actualizar barra de progreso
      const progress = (data.iteration / data.total_iterations) * 100;
      progressBar.style.width = progress + '%';
      progressContainer.setAttribute('aria-valuenow', progress.toFixed(0));

      // Agregar datos al historial
      costHistory.push({ 
        x: data.iteration, 
        y: data.current_cost 
      });

      // Actualizar gráfica
      if (costChart) {
        costChart.data.datasets[0].data = costHistory;
        
        // Ajustar ejes dinámicamente
        if (data.iteration > costChart.options.scales.x.max) {
          costChart.options.scales.x.max = data.iteration + 5; // Pequeño margen
        }
        
        // Calcular límites del eje Y
        const yValues = costHistory.map(item => item.y);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        
        costChart.options.scales.y.min = yMin * 0.95;
        costChart.options.scales.y.max = yMax * 1.05;
        
        costChart.update();
      }
    }

    if (data.status === 'completed') {
      eventSource.close();
      showFinalResult(data);
      setLoading(false);
      
      // Asegurar que la gráfica muestre todos los datos
      if (costChart) {
        costChart.update();
      }
    }
  };

  eventSource.onerror = (e) => {
    console.error('Error en EventSource:', e);
    eventSource.close();
    showError("Error durante la ejecución del algoritmo o conexión perdida.");
    setLoading(false);
  };
};

// Botón de reset de zoom
document.addEventListener('DOMContentLoaded', () => {
  const resetZoomBtn = document.getElementById('resetZoomBtn');
  if (resetZoomBtn) {
    resetZoomBtn.onclick = () => {
      if (costChart) {
        costChart.resetZoom();
        // También restablecemos los límites manualmente
        costChart.options.scales.x.min = 0;
        costChart.options.scales.x.max = +generationsInput.value;
        costChart.update();
      }
    };
  }

  if (map && antennaMarkers.length > 0) {
    const group = new L.featureGroup(antennaMarkers);
    map.fitBounds(group.getBounds().pad(0.2));
  }
});