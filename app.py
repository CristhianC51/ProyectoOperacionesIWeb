from flask import Flask, render_template, request
import pandas as pd
import numpy as np
from deap import base, creator, tools, algorithms
import random
import time

app = Flask(__name__)

# --- Cargar datos solo una vez ---
# Cargar matriz de cobertura
flat_data = pd.read_csv('CSV/set_cover_500x500.csv', header=None).squeeze()
flat_data = flat_data.iloc[1:]  # eliminar encabezado
coverage = flat_data.to_numpy().reshape((500, 500))

# Cargar vector de costos
df_cost = pd.read_excel('CSV/Costo_S.xlsx', header=None)
cost = df_cost.iloc[1, 1:501].to_numpy()

n_clients, n_antennas = coverage.shape

# --- Configuración de DEAP ---
creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
creator.create("Individual", list, fitness=creator.FitnessMin)

toolbox = base.Toolbox()
toolbox.register("attr_bool", lambda: random.randint(0, 1))
toolbox.register("individual", tools.initRepeat, creator.Individual, toolbox.attr_bool, n=n_antennas)
toolbox.register("population", tools.initRepeat, list, toolbox.individual)

def eval_set_cover(individual):
    selected = np.array(individual)
    total_cost = np.sum(cost * selected)

    coverage_matrix = coverage[:, selected == 1]
    clients_covered = np.sum(np.any(coverage_matrix, axis=1))
    uncovered = n_clients - clients_covered

    penalty = uncovered * 1e6
    return (total_cost + penalty,)

toolbox.register("evaluate", eval_set_cover)
toolbox.register("mate", tools.cxTwoPoint)
toolbox.register("mutate", tools.mutFlipBit, indpb=0.01)
toolbox.register("select", tools.selTournament, tournsize=3)

# --- Rutas de la app ---
@app.route("/", methods=["GET"])
def index():
    return render_template("index.html", show_results=False)

@app.route("/run", methods=["POST"])
def run_algorithm():
    try:
        ngen = int(request.form.get("ngen", 2000))
        pop_size = int(request.form.get("popsize", 1000))
    except ValueError:
        ngen = 2000
        pop_size = 1000

    random.seed(42)
    population = toolbox.population(n=pop_size)

    start_time = time.time()

    for gen in range(ngen):
        offspring = algorithms.varAnd(population, toolbox, cxpb=0.5, mutpb=0.2)
        fits = list(map(toolbox.evaluate, offspring))
        for ind, fit in zip(offspring, fits):
            ind.fitness.values = fit
        population = toolbox.select(offspring, k=len(population))

    best = tools.selBest(population, k=1)[0]
    best_cost = eval_set_cover(best)[0]
    selected_indices = [i for i, x in enumerate(best) if x == 1]
    coverage_matrix = coverage[:, np.array(best) == 1]
    clients_covered = np.sum(np.any(coverage_matrix, axis=1))
    total_time = round(time.time() - start_time, 2)

    return render_template("index.html",
                           show_results=True,
                           selected=selected_indices,
                           cost=round(best_cost, 2),
                           covered=clients_covered,
                           total=n_clients,
                           ngen=ngen,
                           pop_size=pop_size,
                           time=total_time)

# --- Ejecutar en local ---
if __name__ == "__main__":
    app.run(debug=True)
