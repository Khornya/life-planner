import collections
from ortools.sat.python import cp_model
import pandas as pd


def main():
    # Data.
    tasks = pd.read_csv("data/tasks.csv", sep=';')
    unavailabilities = pd.read_csv("data/unavailabilities.csv", sep=';', dtype={'Start': 'Int32', 'End': 'Int32'})

    priorities = list(tasks["Priority"])
    durations = list(tasks["Duration"])

    horizon = 50 #TODO get from parameter

    # Create the model.
    model = cp_model.CpModel()

    # Named tuple to store information about created variables.
    task_type = collections.namedtuple('task_type', 'start end is_present interval')
    # Named tuple to manipulate solution information.
    assigned_task_type = collections.namedtuple('assigned_task_type', 'start task duration is_present')

    all_tasks = {}

    for task_id, duration in enumerate(list(durations)):
        suffix = '_%i' % (task_id)
        start_var = model.NewIntVar(0, horizon, 'start' + suffix)
        end_var = model.NewIntVar(0, horizon, 'end' + suffix)
        is_present_var = model.NewBoolVar('is_present' + suffix)
        interval_var = model.NewOptionalIntervalVar(start_var, duration, end_var, is_present_var, 'interval' + suffix)
        all_tasks[task_id] = task_type(start=start_var, end=end_var, is_present=is_present_var, interval=interval_var)
    
    unavailable_intervals = []
    for index, row in unavailabilities.iterrows():
        unavailable_intervals.append(model.NewIntervalVar((row["Start"]), row["End"] - row["Start"], row["End"], f'unavailable_interval_{index}'))
    
    model.AddNoOverlap([all_tasks[task].interval for task in all_tasks] + unavailable_intervals)

    # Priority objective.
    obj_var = model.NewIntVar(0, sum(priorities), name='total_priority')
    model.Add(obj_var == sum([priority * all_tasks[task_id].is_present for task_id, priority in enumerate(priorities)]))
    model.Maximize(obj_var)

    # Creates the solver and solve.
    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        print(f'Optimal Priority: {solver.ObjectiveValue()}')
        for task_id, duration in enumerate(list(durations)):
            print(assigned_task_type(start=solver.Value(all_tasks[task_id].start), task=task_id, duration=duration, is_present=solver.Value(all_tasks[task_id].is_present)))
    else:
        print('No solution found.')

    # Statistics.
    print('\nStatistics')
    print('  - conflicts: %i' % solver.NumConflicts())
    print('  - branches : %i' % solver.NumBranches())
    print('  - wall time: %f s' % solver.WallTime())


if __name__ == '__main__':
    main()
