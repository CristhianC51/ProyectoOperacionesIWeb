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
});