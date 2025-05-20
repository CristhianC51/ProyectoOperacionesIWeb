from flask import Flask, render_template, request
import pandas as pd
import numpy as np
from deap import base, creator, tools, algorithms
import random

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/run', methods=['POST'])
def run_algorithm():
    # Cargar matriz de cobertura
    flat_data = pd.read_csv('CSV/set_cover_500x500.csv', header=None).squeeze()
    flat_data = flat_data.iloc[1:]
    coverage = flat_data.to_numpy().reshape((500, 500))

    # Cargar costos
    df_cost = pd.read_excel('CSV/Costo_S.xlsx', header=None)
    cost = df_cost.iloc[1, 1:501].to_numpy()

    n_clients, n_antennas = coverage.shape

    # DEAP setup
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

    # Algoritmo
    random.seed(42)
    population = toolbox.population(n=100)
    NGEN = 50

    for _ in range(NGEN):
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

    return render_template("index.html",
                           cost=round(best_cost, 2),
                           selected=selected_indices,
                           covered=clients_covered,
                           total=n_clients,
                           show_results=True)

if __name__ == '__main__':
    app.run(debug=True)
