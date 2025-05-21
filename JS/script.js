const runBtn = document.getElementById('runBtn');
const resultDiv = document.getElementById('result');
const populationInput = document.getElementById('population');
const generationsInput = document.getElementById('generations');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');

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

  setLoading(true);

  // Cerrar cualquier fuente anterior
  if (window.currentEventSource) {
    window.currentEventSource.close();
  }

  // Ruta adaptada a tu backend local o de producción
  const url = `http://localhost:5000/run?population=${population}&generations=${generations}`;
  const eventSource = new EventSource(url);
  window.currentEventSource = eventSource;

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.status === 'running') {
      resultDiv.className = 'loading';
      resultDiv.textContent = `
Iteración ${data.iteration} de ${data.total_iterations}
Progreso: ${Math.round((data.iteration / data.total_iterations) * 100)}%
Costo actual: ${data.current_cost}
Clientes cubiertos: ${data.clients_covered}
      `.trim();

      const progress = (data.iteration / data.total_iterations) * 100;
      progressBar.style.width = progress + '%';
      progressContainer.setAttribute('aria-valuenow', progress.toFixed(0));
    }

    if (data.status === 'completed') {
      eventSource.close();
      showFinalResult(data);
      setLoading(false);
    }
  };

  eventSource.onerror = (e) => {
    eventSource.close();
    showError("Error durante la ejecución del algoritmo o conexión perdida.");
    setLoading(false);
  };
};
