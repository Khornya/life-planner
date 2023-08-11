import collections
from ortools.sat.python import cp_model
import pandas as pd
import math

def invert_bit(bit):
    return 1 - bit

task_type = collections.namedtuple('task_type', 'id start end is_present interval raw_priority priority delay is_late')
assigned_task_type = collections.namedtuple('assigned_task_type', 'start task duration priority is_present delay is_late')
reserved_tag_interval = collections.namedtuple('reserved_tag_interval', 'interval tags')

def schedule(tasks, reserved_tags):
    if not len(tasks):
        return {
            "found": True,
            "tasks": []
        }
    tasks['maxDueDate'] = tasks['maxDueDate'].astype('Int32')
    tasks['dueDate'] = tasks['dueDate'].astype('Int32')
    durations = list(tasks["duration"])
    impacts = list(tasks["impact"].fillna(0))
    dueDates = list(tasks['dueDate'])
    maxDueDates = list(tasks['maxDueDate'])
    tags = list(tasks['tags'])

    horizon = max(tasks['maxDueDate'].max(), 1000)
    max_raw_priority = math.floor(max([impact*100/durations[task_id] for task_id, impact in enumerate(impacts)]))

    # Create the model.
    model = cp_model.CpModel()

    all_tasks = {}

    reserved_tag_intervals = []
    for index, row in reserved_tags.iterrows():
        reserved_tag_intervals.append(reserved_tag_interval(tags= row['tags'], interval=model.NewIntervalVar(row['start'], row['end'] - row['start'], row['end'], f'reserved_interval_{index}')))

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
        all_tasks[task_id] = task_type(id=tasks.iloc[task_id]['id'], start=start_var, end=end_var, is_present=is_present_var, interval=interval_var, raw_priority=raw_priority, priority=priority_var, delay=delay_var, is_late=is_late_var)
    
    model.AddNoOverlap([all_tasks[task].interval for task in all_tasks])

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
            print(assigned_task_type(
                start=solver.Value(all_tasks[task_id].start),
                task=task_id,
                duration=duration,
                priority=solver.Value(all_tasks[task_id].priority),
                is_present=solver.Value(all_tasks[task_id].is_present),
                delay=solver.Value(all_tasks[task_id].delay),
                is_late=solver.Value(all_tasks[task_id].is_late)
            ))
        return {
            "found": True,
            "tasks": [{
                "id": all_tasks[task_id].id,
                "start": solver.Value(all_tasks[task_id].start),
                "isPresent": bool(solver.Value(all_tasks[task_id].is_present)),
                "isLate": bool(solver.Value(all_tasks[task_id].is_late)),
                "duration": duration,
                "priority": solver.Value(all_tasks[task_id].priority),
                "delay": solver.Value(all_tasks[task_id].delay)
            } for task_id, duration in enumerate(list(durations))]
        }
    else:
        print('No solution found')
        return {
            "found": False,
            "tasks": []
        }


if __name__ == '__main__':
    tasks = pd.read_csv("data/tasks.csv", sep=';', dtype={'DueDate': 'Int32', 'MaxDueDate': 'Int32'})
    reserved_tags = pd.read_csv("data/tags.csv", sep=';', dtype={'Start': 'Int32', 'End': 'Int32'})
    schedule(tasks, reserved_tags)
