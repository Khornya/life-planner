from pulp import *
import pulp as p
import pandas as pd

tasks = pd.read_csv("data/tasks.csv", sep=';')
schedule = pd.read_csv("data/schedule.csv", sep=';')

# Define and name the problem. The objective is to maximize the priority
prob = LpProblem("Schedule_Tasks", LpMaximize)

priorities = list(tasks["Priority"])
durations = list(tasks["Duration"])
availabilities = list(schedule["Availability"])
numTimeBlocks = len(availabilities)
numTasks = len(priorities)
numAvailableTimeBlocks = sum(availabilities)

assignments = LpVariable.dicts(
    f"Assignment", [(i, t) for i in range(numTasks) for t in range(numTimeBlocks)], cat=LpInteger, lowBound=0, upBound=1
)

# Maximize the priority of assigned tasks
prob += lpSum(priorities[taskIndex] * assignments[(taskIndex, timeBlockIndex)] for taskIndex, timeBlockIndex in itertools.product(range(numTasks), range(numTimeBlocks)))

for taskIndex in range(numTasks):
    # One task must be assigned to as many time blocks as its duration or not be assigned at all
    prob += lpSum(assignments[(taskIndex, timeBlockIndex)] for timeBlockIndex in range(numTimeBlocks)) / durations[taskIndex] <= 1
for timeBlockIndex in range(numTimeBlocks):
    # One time block cannot have more than one task
    prob += lpSum(assignments[(taskIndex, timeBlockIndex)] for taskIndex in range(numTasks)) <= 1

# prob.writeMPS('error_case.mps')
# prob.writeLP("test.lp")
prob.solve()
# print("Assignment accomplished! Total priority : {}". format([priorities[taskIndex] * assignments[(taskIndex, timeBlockIndex)].varValue for taskIndex, timeBlockIndex in itertools.product(range(numTasks), range(numTimeBlocks))]))
for timeBlockIndex in range(numTimeBlocks):
  for taskIndex in range(numTasks):
    if assignments[(taskIndex, timeBlockIndex)].varValue == 1:
      print("Task {} (priority {}) is assigned to block {}".format(tasks["Name"][taskIndex], tasks["Priority"][taskIndex], schedule["Time"][timeBlockIndex]))
