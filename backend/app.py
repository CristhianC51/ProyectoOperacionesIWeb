from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import numpy as np
from deap import base, creator, tools, algorithms
import pandas as pd

app = Flask(__name__)
CORS(app)  # Permite CORS

# Carga datos una vez
flat_data = pd.read_csv('CSV/set_cover_500x500.csv', header=None).squeeze()
flat_data = flat_data.iloc[1:]
coverage = flat_data.to_numpy().reshape((500, 500))
df_cost = pd.read_excel('CSV/Costo_S.xlsx', header=None)
cost = df_cost.iloc[1, 1:501].to_numpy()
n_clients, n_antennas = coverage.shape

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

@app.route('/run', methods=['POST'])
def run_algorithm():
    data = request.json
    population_size = int(data.get('population', 100))
    generations = int(data.get('generations', 100))

    random.seed(42)
    population = toolbox.population(n=population_size)

    for gen in range(generations):
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

    result = {
        "antennas_selected": len(selected_indices),
        "total_cost": best_cost,
        "clients_covered": int(clients_covered),
        "total_clients": int(n_clients),
        "selected_indices": selected_indices
    }
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
