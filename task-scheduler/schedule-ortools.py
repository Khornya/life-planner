import collections
from ortools.sat.python import cp_model
import pandas as pd
import math
from ast import literal_eval

def invert_bit(bit):
    return 1 - bit

def main():
    # Data.
    tasks = pd.read_csv("data/tasks.csv", sep=';', dtype={'DueDate': 'Int32', 'MaxDueDate': 'Int32'})
    unavailabilities = pd.read_csv("data/unavailabilities.csv", sep=';', dtype={'Start': 'Int32', 'End': 'Int32'})
    reserved_tags = pd.read_csv("data/tags.csv", sep=';', dtype={'Start': 'Int32', 'End': 'Int32'})#.groupby('Tag')[['Start','End']].apply(lambda x: x.values.tolist())

    impacts = list(tasks["Impact"].fillna(0))
    durations = list(tasks["Duration"])
    dueDates = list(tasks['DueDate'])
    maxDueDates = list(tasks['MaxDueDate'])
    tags = list(tasks['Tags'].apply(literal_eval))

    horizon = max(tasks['MaxDueDate'].max(), 1000)
    max_raw_priority = math.floor(max([impact*100/durations[task_id] for impact, task_id in enumerate(impacts)]))

    # Create the model.
    model = cp_model.CpModel()

    # Named tuple to store information about created variables.
    task_type = collections.namedtuple('task_type', 'start end is_present interval raw_priority priority delay is_late')
    # Named tuple to manipulate solution information.
    assigned_task_type = collections.namedtuple('assigned_task_type', 'start task duration priority is_present delay is_late')
    reserved_tag_interval = collections.namedtuple('reserved_tag_interval', 'interval tags')

    all_tasks = {}

    reserved_tag_intervals = []
    for index, row in reserved_tags.iterrows():
        reserved_tag_intervals.append(reserved_tag_interval(tags= literal_eval(row['Tags']), interval=model.NewIntervalVar(row['Start'], row['End'] - row['Start'], row['End'], f'reserved_interval_{index}')))

    for task_id, duration in enumerate(list(durations)):
        suffix = '_%i' % (task_id)
        start_var = model.NewIntVar(0, horizon - duration, 'start' + suffix)
        end_var = model.NewIntVar(0, horizon, 'end' + suffix)
        is_present_var = model.NewBoolVar('is_present' + suffix)
        is_late_var = model.NewBoolVar('is_late' + suffix)
        interval_var = model.NewOptionalIntervalVar(start_var, duration, end_var, is_present_var, 'interval' + suffix)
        if pd.notna(maxDueDates[task_id]) and maxDueDates[task_id] != dueDates[task_id]:
            delay_var = model.NewIntVar(-100, 100, 'delay' + suffix)
            model.AddDivisionEquality(delay_var, (dueDates[task_id] - end_var)*100, maxDueDates[task_id] - dueDates[task_id])
            model.Add(delay_var < 0).OnlyEnforceIf(is_late_var)
            model.Add(delay_var >= 0).OnlyEnforceIf(is_late_var.Not())
            delay_var_abs = model.NewIntVar(0,100, 'delay_abs' + suffix)
            model.AddAbsEquality(delay_var_abs, delay_var)
            opt_delay_var = model.NewIntVar(0,100, 'opt_delay' + suffix)
            model.AddMultiplicationEquality(opt_delay_var, [is_present_var, delay_var_abs])
        else:
            delay_var = model.NewConstant(0)
            opt_delay_var = model.NewBoolVar('opt_delay' + suffix)
            model.Add(opt_delay_var == is_present_var)
        raw_priority = math.floor(impacts[task_id]*100/duration)
        priority_var = model.NewIntVar(0, max_raw_priority * 11 * 100, 'priority' + suffix)
        model.AddMultiplicationEquality(priority_var, [raw_priority * opt_delay_var, 10 + is_late_var.Not() - 2 * is_late_var])
        incompatible_intervals = []
        for reserved_interval in reserved_tag_intervals:
            if not(len([value for value in reserved_interval.tags if value in tags[task_id]])):
                incompatible_intervals.append(reserved_interval.interval)
        model.AddNoOverlap(incompatible_intervals + [interval_var])
        all_tasks[task_id] = task_type(start=start_var, end=end_var, is_present=is_present_var, interval=interval_var, raw_priority=raw_priority, priority=priority_var, delay=delay_var, is_late=is_late_var)
    
    unavailable_intervals = []
    for index, row in unavailabilities.iterrows():
        unavailable_intervals.append(model.NewIntervalVar((row["Start"]), row["End"] - row["Start"], row["End"], f'unavailable_interval_{index}'))
    
    model.AddNoOverlap([all_tasks[task].interval for task in all_tasks] + unavailable_intervals)

    # Priority objective.
    obj_var = model.NewIntVar(0, sum([all_tasks[task_id].raw_priority * 11 * 100 for task_id in all_tasks]), name='total_priority')
    model.Add(obj_var == sum([all_tasks[task_id].priority for task_id in all_tasks]))
    model.Maximize(obj_var)

    # Creates the solver and solve.
    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        print(f'Optimal Priority: {solver.ObjectiveValue()}')
        for task_id, duration in enumerate(list(durations)):
            print(assigned_task_type(start=solver.Value(all_tasks[task_id].start), task=task_id, duration=duration, priority=solver.Value(all_tasks[task_id].priority), is_present=solver.Value(all_tasks[task_id].is_present), delay=solver.Value(all_tasks[task_id].delay), is_late=solver.Value(all_tasks[task_id].is_late)))
    else:
        print('No solution found.')

    # Statistics.
    print('\nStatistics')
    print('  - conflicts: %i' % solver.NumConflicts())
    print('  - branches : %i' % solver.NumBranches())
    print('  - wall time: %f s' % solver.WallTime())


if __name__ == '__main__':
    main()
